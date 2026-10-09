# ABOUTME: Findings API endpoints for listing, detail retrieval, and full-text search.
# ABOUTME: Delegates to findings_service for search and listing; enforces case ownership.

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import CurrentUser
from app.database import get_db
from app.models import Case
from app.schemas.findings import (
    FindingListResponse,
    FindingResponse,
    FindingSearchResponse,
    FindingSearchResult,
)
from app.services import findings_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases/{case_id}/findings", tags=["findings"])


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


# ---------------------------------------------------------------------------
# Search (defined BEFORE /{finding_id} to avoid path parameter capture)
# ---------------------------------------------------------------------------


@router.get(
    "/search",
    response_model=FindingSearchResponse,
    summary="Full-text search across case findings",
)
async def search_findings_endpoint(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str, Query(min_length=1, max_length=500, description="Search query")],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> FindingSearchResponse:
    """Search findings using PostgreSQL full-text search (tsvector).

    Results are ranked by relevance. The search uses plainto_tsquery
    for safe parsing of the query string.
    """
    await _get_user_case(db, case_id, current_user.id)

    results = await findings_service.search_findings(
        db=db,
        case_id=case_id,
        query=q,
        limit=limit,
    )

    return FindingSearchResponse(
        results=[
            FindingSearchResult(
                finding=FindingResponse.model_validate(finding),
                relevance_score=score,
            )
            for finding, score in results
        ],
        query=q,
        total=len(results),
    )


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=FindingListResponse,
    summary="List findings with optional filtering",
)
async def list_findings_endpoint(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    agent_type: Annotated[str | None, Query()] = None,
    category: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> FindingListResponse:
    """List findings for a case with optional agent_type and category filters."""
    await _get_user_case(db, case_id, current_user.id)

    findings, total = await findings_service.list_findings(
        db=db,
        case_id=case_id,
        agent_type=agent_type,
        category=category,
        limit=limit,
        offset=offset,
    )

    return FindingListResponse(
        findings=[FindingResponse.model_validate(f) for f in findings],
        total=total,
    )


# ---------------------------------------------------------------------------
# Detail
# ---------------------------------------------------------------------------


@router.get(
    "/{finding_id}",
    response_model=FindingResponse,
    summary="Get a single finding by ID",
)
async def get_finding(
    case_id: UUID,
    finding_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> FindingResponse:
    """Retrieve a single finding by ID, scoped to the case."""
    await _get_user_case(db, case_id, current_user.id)

    finding = await findings_service.get_finding_by_id(
        db=db,
        finding_id=finding_id,
        case_id=case_id,
    )

    if finding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finding not found",
        )

    return FindingResponse.model_validate(finding)
