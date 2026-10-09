# ABOUTME: Base agent configurations, model constants, and callback factories.
# ABOUTME: Provides SSE callback wiring for all agents.

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, TypeAlias, TypedDict

if TYPE_CHECKING:
    from app.services.agent_events import AgentEventType

from google.adk.agents.base_agent import AfterAgentCallback, BeforeAgentCallback
from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.llm_agent import (
    AfterModelCallback,
    AfterToolCallback,
    BeforeModelCallback,
    BeforeToolCallback,
)
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.tools.base_tool import BaseTool
from google.adk.tools.tool_context import ToolContext
from google.genai.types import Content

import app.agents.groq_llm  # noqa: F401  (registers GroqLlm for "groq/..." model IDs)
from app.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model constants (configurable via FLASH_MODEL / PRO_MODEL)
# ---------------------------------------------------------------------------

_settings = get_settings()
MODEL_FLASH: str = _settings.flash_model
MODEL_PRO: str = _settings.pro_model


# ---------------------------------------------------------------------------
# Callback types (aliases for readability)
# ---------------------------------------------------------------------------

PublishFn: TypeAlias = Callable[[str, dict[str, object]], Awaitable[None] | None]  # noqa: UP040


class AgentCallbacks(TypedDict):
    """Type-safe dict for ADK LlmAgent callback parameters.

    Each key corresponds to a callback parameter accepted by LlmAgent.__init__.
    Using TypedDict ensures type safety when unpacking with **callbacks.
    """

    before_agent_callback: BeforeAgentCallback
    after_agent_callback: AfterAgentCallback
    before_model_callback: BeforeModelCallback
    after_model_callback: AfterModelCallback
    before_tool_callback: BeforeToolCallback
    after_tool_callback: AfterToolCallback


# ---------------------------------------------------------------------------
# Callback factory
# ---------------------------------------------------------------------------


def _log_task_exception(task: asyncio.Task[object]) -> None:
    """Log exceptions from fire-and-forget tasks instead of silently dropping them."""
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        logger.warning("Fire-and-forget SSE publish failed: %s", exc)


def create_agent_callbacks(
    case_id: str,
    publish_fn: PublishFn,
) -> AgentCallbacks:
    """Build all six ADK agent callback hooks wired to an SSE publish function.

    Each callback publishes a structured event via ``publish_fn`` so the
    Command Center UI can render real-time agent activity.

    Args:
        case_id: The investigation case ID (included in every event).
        publish_fn: ``async def publish(event_type, data)`` that pushes to SSE.

    Returns:
        Dict with keys matching LlmAgent callback parameter names:
        before_agent_callback, after_agent_callback,
        before_model_callback, after_model_callback,
        before_tool_callback, after_tool_callback.
    """

    def _fire(event_type: str, data: dict[str, object]) -> None:
        """Schedule an SSE publish without blocking the agent loop."""
        try:
            result = publish_fn(event_type, data)
            if result is not None:
                task = asyncio.ensure_future(result)  # type: ignore[arg-type]
                task.add_done_callback(_log_task_exception)
        except RuntimeError:
            # No running event loop (e.g. during tests); log instead.
            logger.debug("No event loop for SSE publish: %s %s", event_type, data)

    def _now() -> str:
        return datetime.now(tz=UTC).isoformat()

    # -- before_agent ---------------------------------------------------------

    def before_agent(
        callback_context: CallbackContext,
    ) -> Content | None:
        _fire(
            "AGENT_SPAWNED",
            {
                "case_id": case_id,
                "agent_name": callback_context.agent_name,
                "timestamp": _now(),
            },
        )
        return None  # Continue normal execution

    # -- after_agent ----------------------------------------------------------

    def after_agent(
        callback_context: CallbackContext,
    ) -> Content | None:
        _fire(
            "AGENT_COMPLETED",
            {
                "case_id": case_id,
                "agent_name": callback_context.agent_name,
                "timestamp": _now(),
            },
        )
        return None

    # -- before_model ---------------------------------------------------------

    def before_model(
        callback_context: CallbackContext,
        llm_request: LlmRequest,
    ) -> LlmResponse | None:
        _fire(
            "THINKING_UPDATE",
            {
                "case_id": case_id,
                "agent_name": callback_context.agent_name,
                "timestamp": _now(),
                "status": "reasoning",
            },
        )
        return None

    # -- after_model ----------------------------------------------------------

    def after_model(
        callback_context: CallbackContext,
        llm_response: LlmResponse,
    ) -> LlmResponse | None:
        # Extract thinking parts from model response for real-time streaming
        thinking_parts: list[str] = []
        if llm_response.content and llm_response.content.parts:
            for part in llm_response.content.parts:
                if getattr(part, "thought", False) and part.text:
                    thinking_parts.append(part.text)

        # Extract token usage delta from this model turn
        token_delta: dict[str, int] | None = None
        usage = getattr(llm_response, "usage_metadata", None)
        if usage is not None:
            delta: dict[str, int] = {}
            if getattr(usage, "prompt_token_count", None):
                delta["inputTokens"] = usage.prompt_token_count
            if getattr(usage, "candidates_token_count", None):
                delta["outputTokens"] = usage.candidates_token_count
            if getattr(usage, "thoughts_token_count", None):
                delta["thoughtsTokens"] = usage.thoughts_token_count
            if delta:
                token_delta = delta

        # Fire THINKING_UPDATE with full untruncated text if thinking parts exist
        if thinking_parts:
            _fire(
                "THINKING_UPDATE",
                {
                    "case_id": case_id,
                    "agent_name": callback_context.agent_name,
                    "timestamp": _now(),
                    "thought": "\n".join(thinking_parts),
                    **({"tokenDelta": token_delta} if token_delta else {}),
                },
            )
        else:
            # Still fire MODEL_RESPONSE for non-thinking turns
            _fire(
                "MODEL_RESPONSE",
                {
                    "case_id": case_id,
                    "agent_name": callback_context.agent_name,
                    "timestamp": _now(),
                    **({"tokenDelta": token_delta} if token_delta else {}),
                },
            )
        return None

    # -- before_tool ----------------------------------------------------------

    def before_tool(
        tool: BaseTool,
        args: dict[str, Any],
        tool_context: ToolContext,
    ) -> dict[str, Any] | None:
        _fire(
            "TOOL_CALLED",
            {
                "case_id": case_id,
                "agent_name": tool_context.agent_name,
                "tool_name": tool.name,
                "timestamp": _now(),
            },
        )
        return None

    # -- after_tool -----------------------------------------------------------

    def after_tool(
        tool: BaseTool,
        args: dict[str, Any],
        tool_context: ToolContext,
        tool_result: dict[str, Any],
    ) -> dict[str, Any] | None:
        _fire(
            "TOOL_COMPLETED",
            {
                "case_id": case_id,
                "agent_name": tool_context.agent_name,
                "tool_name": tool.name,
                "timestamp": _now(),
            },
        )
        return None

    return {
        "before_agent_callback": before_agent,
        "after_agent_callback": after_agent,
        "before_model_callback": before_model,
        "after_model_callback": after_model,
        "before_tool_callback": before_tool,
        "after_tool_callback": after_tool,
    }


# ---------------------------------------------------------------------------
# SSE publish function factory
# ---------------------------------------------------------------------------

# Mapping from internal callback event names to AgentEventType enum values
_CALLBACK_TO_EVENT_TYPE: dict[str, AgentEventType] = {}


def _get_event_type_map() -> dict[str, AgentEventType]:
    """Lazily build the callback-name-to-AgentEventType mapping.

    Deferred import avoids circular dependency at module load time
    (base -> agent_events -> base).

    NOTE: AGENT_SPAWNED and AGENT_COMPLETED are intentionally NOT mapped here.
    These events from ADK callbacks lack required fields (taskId, fileId, fileName)
    that the frontend validation expects. Agent lifecycle events should come from
    the direct emitters (emit_agent_started, emit_agent_complete) in the pipeline
    code which has access to all required context.

    ADK callbacks only provide real-time thinking updates during model execution.
    """
    global _CALLBACK_TO_EVENT_TYPE
    if not _CALLBACK_TO_EVENT_TYPE:
        from app.services.agent_events import AgentEventType

        _CALLBACK_TO_EVENT_TYPE = {
            # AGENT_SPAWNED and AGENT_COMPLETED are NOT mapped - they lack
            # required fields and conflict with emit_agent_started/complete
            "THINKING_UPDATE": AgentEventType.THINKING_UPDATE,
            "MODEL_RESPONSE": AgentEventType.THINKING_UPDATE,
            "TOOL_CALLED": AgentEventType.TOOL_CALLED,
            "TOOL_COMPLETED": AgentEventType.TOOL_CALLED,
        }
    return _CALLBACK_TO_EVENT_TYPE


def _extract_agent_type(agent_name: str) -> str:
    """Extract the logical agent type from an ADK agent name.

    ADK agent names are formatted as "{type}_{case_id_prefix}" by _safe_name().
    The suffix is always a single underscore + 8 alphanumeric chars, so we
    split from the right to preserve multi-word prefixes like "kg_builder".

    Examples:
        "triage_e6f15c88" -> "triage"
        "kg_builder_e6f15c88" -> "kg_builder"
        "synthesis_e6f15c88" -> "synthesis"

    Args:
        agent_name: The ADK agent name (e.g., "kg_builder_e6f15c88").

    Returns:
        The logical agent type (e.g., "kg_builder").
    """
    parts = agent_name.rsplit("_", 1)
    return parts[0] if len(parts) == 2 else agent_name


def create_sse_publish_fn(case_id: str) -> PublishFn:
    """Create a bound publish function that maps callback event types to
    AgentEventType values and dispatches via ``publish_agent_event()``.

    The returned function transforms raw ADK callback data into the format
    expected by the frontend Command Center validation.

    Args:
        case_id: The investigation case ID for all published events.

    Returns:
        An async callable ``(event_type, data) -> None``.
    """

    async def _publish(event_type: str, data: dict[str, object]) -> None:
        from app.services.agent_events import publish_agent_event

        event_map = _get_event_type_map()
        mapped = event_map.get(event_type)
        if mapped is None:
            logger.debug(
                "Unmapped callback event type %s for case=%s, skipping SSE publish",
                event_type,
                case_id,
            )
            return

        # Transform ADK callback data to frontend-expected format
        transformed = _transform_callback_data(event_type, data)
        await publish_agent_event(case_id, mapped, transformed)

    return _publish


def _transform_callback_data(
    event_type: str,
    data: dict[str, object],
) -> dict[str, object]:
    """Transform raw ADK callback data to frontend-expected SSE event format.

    ADK callbacks provide agent_name like "triage_e6f15c88", but the frontend
    expects agentType like "triage". This function performs the necessary
    field mapping.

    Only THINKING_UPDATE, MODEL_RESPONSE, TOOL_CALLED, and TOOL_COMPLETED
    events are processed here. Agent lifecycle events (started/complete)
    are handled by direct emitters in the pipeline code.

    Args:
        event_type: The internal callback event type (e.g., "THINKING_UPDATE").
        data: Raw callback data with agent_name, timestamp, etc.

    Returns:
        Transformed data matching frontend CommandCenterSSEEvent validation.
    """
    # Start with a copy to avoid mutating the original
    result: dict[str, object] = {}

    # Extract agentType from agent_name (e.g., "triage_e6f15c88" -> "triage")
    agent_name = data.get("agent_name")
    if isinstance(agent_name, str):
        result["agentType"] = _extract_agent_type(agent_name)

    # Copy timestamp if present
    if "timestamp" in data:
        result["timestamp"] = data["timestamp"]

    # Event-specific transformations
    if event_type in ("THINKING_UPDATE", "MODEL_RESPONSE"):
        # thinking-update requires: agentType, thought, timestamp
        if "thought" in data:
            result["thought"] = data["thought"]
        else:
            # For "reasoning started" status events, use empty thought
            # Frontend validation requires thought to be a string
            result["thought"] = ""
        if "tokenDelta" in data:
            result["tokenDelta"] = data["tokenDelta"]

    elif event_type in ("TOOL_CALLED", "TOOL_COMPLETED"):
        # tool-called events include tool_name
        if "tool_name" in data:
            result["toolName"] = data["tool_name"]

    return result
