# ABOUTME: SSE streaming chat endpoint for case Q&A with citation-backed responses.
# ABOUTME: POST /api/cases/{case_id}/chat streams token-by-token via Server-Sent Events.

from __future__ import annotations

import json
import logging
import re
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from google.genai import types
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette import EventSourceResponse

from app.api.auth import CurrentUser
from app.database import get_db
from app.models import Case
from app.services.chat_service import create_chat_agent_and_runner, load_chat_context

logger = logging.getLogger(__name__)

# Suppress the "non-text parts in the response" warning from google-genai.
# The ADK framework internally accesses GenerateContentResponse.text during
# debug logging, which triggers a noisy warning when responses contain
# function_call parts alongside text parts. We handle each part type
# individually in our event iteration, so this warning is harmless noise.
logging.getLogger("google_genai.types").setLevel(logging.ERROR)

router = APIRouter(prefix="/api/cases/{case_id}", tags=["chat"])

# Regex for extracting citation markers from model output
_CITATION_REGEX = re.compile(r"\[\[([a-f0-9-]+)\|([^|]*)\|([^\]]+)\]\]")


class ChatRequest(BaseModel):
    """Request body for the chat endpoint."""

    message: str
    session_id: str | None = None


def _extract_citations(text: str) -> list[dict[str, str]]:
    """Extract structured citations from text containing [[file_id|locator|label]] markers.

    Args:
        text: The full response text potentially containing citation markers.

    Returns:
        List of citation dicts with file_id, locator, and label fields.
    """
    citations: list[dict[str, str]] = []
    seen: set[str] = set()

    for match in _CITATION_REGEX.finditer(text):
        file_id, locator, label = match.group(1), match.group(2), match.group(3)
        key = f"{file_id}|{locator}"
        if key not in seen:
            seen.add(key)
            citations.append(
                {
                    "file_id": file_id,
                    "locator": locator,
                    "label": label,
                }
            )

    return citations


async def _get_user_case(
    db: AsyncSession,
    case_id: UUID,
    user_id: str,
) -> Case:
    """Fetch a case ensuring ownership. Raises 404 if not found or not owned."""
    result = await db.execute(
        select(Case).where(
            Case.id == case_id,
            Case.user_id == user_id,
            Case.deleted_at.is_(None),
        )
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )
    return case


@router.post(
    "/chat",
    summary="Chat with the case investigation assistant",
    description=(
        "Send a message and receive a streaming response via Server-Sent Events. "
        "The chat agent has access to all case analysis data (findings, knowledge graph, "
        "synthesis, timeline, locations) and responds with citation-backed answers."
    ),
)
async def chat_endpoint(
    case_id: UUID,
    body: ChatRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventSourceResponse:
    """Stream a chat response as Server-Sent Events.

    Events emitted:
    - chat-token: Incremental text token {"text": "..."}
    - chat-tool-start: Tool invocation started {"tool_name": "..."}
    - chat-tool-end: Tool invocation completed {"tool_name": "..."}
    - chat-done: Response complete {"message": "...", "citations": [...]}
    - chat-error: Error occurred {"error": "..."}
    """
    # Validate case ownership
    await _get_user_case(db, case_id, current_user.id)

    # Load case context for the system prompt
    try:
        context = await load_chat_context(db, case_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        ) from None

    # Check if analysis has been run
    if not context.get("analysis_available", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis has not been run for this case. "
            "Please run analysis first before using chat.",
        )

    # Create agent and runner (outside the generator so errors raise before SSE starts)
    case_id_str = str(case_id)
    user_id_str = current_user.id
    runner, session_id = await create_chat_agent_and_runner(
        case_id=case_id_str,
        user_id=user_id_str,
        context=context,
        session_id=body.session_id,
    )

    logger.debug(
        "Chat session: case=%s user=%s session_id=%s (from_client=%s)",
        case_id_str,
        user_id_str,
        session_id,
        body.session_id,
    )

    # Build the user message
    user_message = types.Content(
        role="user",
        parts=[types.Part(text=body.message)],
    )

    async def event_generator():
        """Yield SSE events from the ADK runner stream.

        Iterates through each event's content.parts individually to avoid
        triggering the google-genai "non-text parts" warning. Each part type
        (function_call, function_response, thought, text) is handled
        explicitly so that mixed-part responses are processed correctly.
        """
        full_text = ""

        try:
            async for event in runner.run_async(
                user_id=user_id_str,
                session_id=session_id,
                new_message=user_message,
            ):
                # Skip events with no content
                if event.content is None or event.content.parts is None:
                    continue

                for part in event.content.parts:
                    # Skip thinking/reasoning parts (internal model deliberation)
                    if part.thought is True:
                        continue

                    # Handle function_call parts (tool invocation started)
                    if part.function_call is not None:
                        tool_name = part.function_call.name or "unknown"
                        yield {
                            "event": "chat-tool-start",
                            "data": json.dumps({"tool_name": tool_name}),
                        }
                        continue

                    # Handle function_response parts (tool invocation completed)
                    if part.function_response is not None:
                        tool_name = part.function_response.name or "unknown"
                        yield {
                            "event": "chat-tool-end",
                            "data": json.dumps({"tool_name": tool_name}),
                        }
                        continue

                    # Handle text parts (the actual response content)
                    # Check part.text is not None explicitly -- empty string
                    # is a valid (if unusual) text part and should not be skipped
                    if part.text is not None and part.text:
                        full_text += part.text
                        yield {
                            "event": "chat-token",
                            "data": json.dumps({"text": part.text}),
                        }

            # Final event with complete message and extracted citations
            citations = _extract_citations(full_text)
            yield {
                "event": "chat-done",
                "data": json.dumps(
                    {
                        "message": full_text,
                        "citations": citations,
                        "session_id": session_id,
                    }
                ),
            }

        except Exception:
            logger.exception(
                "Chat stream error for case=%s user=%s session=%s",
                case_id_str,
                user_id_str,
                session_id,
            )
            yield {
                "event": "chat-error",
                "data": json.dumps(
                    {
                        "error": "An error occurred while generating the response. "
                        "Please try again.",
                    }
                ),
            }

    return EventSourceResponse(
        event_generator(),
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
        },
    )
