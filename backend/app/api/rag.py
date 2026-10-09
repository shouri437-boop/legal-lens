# ABOUTME: Fast RAG endpoints: cited analysis of a case's PDFs and grounded question answering.
# ABOUTME: Retrieval is local (BM25 over page chunks); one Groq call per request.

import logging
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import CurrentUser
from app.api.files import get_user_case
from app.database import get_db
from app.groq_keys import is_request_too_large
from app.groq_lanes import RateLimited
from app.models import CaseFile
from app.services import rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases/{case_id}/rag", tags=["rag"])


class AskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)


async def _pdf_files(
    db: AsyncSession, case_id: UUID, user_id: str
) -> list[tuple[str, str, str]]:
    if not await get_user_case(db, case_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Case not found")
    rows = await db.execute(
        select(CaseFile).where(
            CaseFile.case_id == case_id, CaseFile.mime_type == "application/pdf"
        )
    )
    files = [(str(f.id), f.original_filename, f.storage_path) for f in rows.scalars()]
    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload a PDF first.")
    return files


def _llm_error(exc: Exception) -> HTTPException:
    text = str(exc)
    name = type(exc).__name__
    if isinstance(exc, RateLimited):
        return HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Every configured Groq key and model is rate limited. Try again in "
            f"about {exc.seconds:.0f} seconds.",
        )
    if is_request_too_large(text):
        return HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            "The request is larger than the Groq per-minute token limit. Lower "
            "RAG_MAX_CONTEXT_CHARS or raise GROQ_TPM_LIMIT for a higher Groq tier.",
        )
    if "RateLimit" in name or "rate_limit" in text.lower() or "429" in text[:60]:
        return HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Groq rate limit reached on every key. Try again shortly.",
        )
    if (
        "ServiceUnavailable" in name
        or "overloaded" in text.lower()
        or "503" in text[:60]
    ):
        return HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Groq is overloaded right now. Please retry in a moment.",
        )
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Analysis failed")


@router.get("/analysis")
async def get_analysis(case_id: UUID, current_user: CurrentUser) -> dict[str, Any]:
    cached = rag_service.load_cached_analysis(str(case_id))
    if cached is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No analysis yet")
    return cached


@router.post("/analyze")
async def run_analysis(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh: Annotated[bool, Query()] = False,
) -> dict[str, Any]:
    files = await _pdf_files(db, case_id, current_user.id)
    if not refresh:
        cached = rag_service.load_cached_analysis(str(case_id))
        if cached is not None and {f["id"] for f in cached["meta"]["files"]} == {
            f[0] for f in files
        }:
            return cached
    try:
        return await rag_service.analyze(str(case_id), files)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from None
    except Exception as exc:
        logger.exception("RAG analysis failed for case %s", case_id)
        raise _llm_error(exc) from None


@router.post("/ask")
async def ask_question(
    case_id: UUID,
    body: AskRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    files = await _pdf_files(db, case_id, current_user.id)
    try:
        return await rag_service.ask(str(case_id), files, body.question)
    except Exception as exc:
        logger.exception("RAG ask failed for case %s", case_id)
        raise _llm_error(exc) from None
