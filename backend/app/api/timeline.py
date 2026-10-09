# ABOUTME: Timeline API endpoints for listing and retrieving timeline events.
# ABOUTME: Serves the frontend Timeline view with case-scoped ownership verification.

import logging
from collections import Counter
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import CurrentUser
from app.database import get_db
from app.models import Case, TimelineEvent
from app.schemas.synthesis import TimelineApiResponseModel, TimelineEventResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases/{case_id}", tags=["timeline"])


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
# Timeline list
# ---------------------------------------------------------------------------


@router.get(
    "/timeline",
    response_model=TimelineApiResponseModel,
    summary="List timeline events with filtering and aggregation",
)
async def list_timeline_events(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    layers: Annotated[
        str | None,
        Query(description="Comma-separated layer filter (e.g. 'financial,legal')"),
    ] = None,
    start_date: Annotated[
        str | None,
        Query(
            alias="startDate",
            description="Filter events on or after this ISO 8601 date",
        ),
    ] = None,
    end_date: Annotated[
        str | None,
        Query(
            alias="endDate", description="Filter events on or before this ISO 8601 date"
        ),
    ] = None,
    q: Annotated[
        str | None,
        Query(description="Search query matching title or description (ILIKE)"),
    ] = None,
    min_confidence: Annotated[
        float | None,
        Query(
            alias="minConfidence",
            ge=0,
            le=1,
            description="Minimum confidence threshold",
        ),
    ] = None,
) -> TimelineApiResponseModel:
    """Return timeline events with date range and layer count aggregation.

    Events are ordered by event_date ascending (nulls last).
    """
    await _get_user_case(db, case_id, current_user.id)

    query = select(TimelineEvent).where(TimelineEvent.case_id == case_id)

    # Layer filter (comma-separated)
    if layers is not None:
        layer_list = [
            layer.strip().lower() for layer in layers.split(",") if layer.strip()
        ]
        if layer_list:
            query = query.where(TimelineEvent.layer.in_(layer_list))

    # Date range filters — parse ISO 8601 strings to timezone-aware datetime
    if start_date is not None:
        try:
            start_dt = datetime.fromisoformat(start_date)
            query = query.where(TimelineEvent.event_date >= start_dt)
        except ValueError:
            logger.warning("Invalid startDate filter: %s", start_date)
    if end_date is not None:
        try:
            end_dt = datetime.fromisoformat(end_date)
            query = query.where(TimelineEvent.event_date <= end_dt)
        except ValueError:
            logger.warning("Invalid endDate filter: %s", end_date)

    # Text search
    if q is not None:
        search_pattern = f"%{q}%"
        query = query.where(
            TimelineEvent.title.ilike(search_pattern)
            | TimelineEvent.description.ilike(search_pattern)
        )

    query = query.order_by(TimelineEvent.event_date.asc().nullslast())

    result = await db.execute(query)
    events = list(result.scalars().all())

    # Compute date range from results
    dates = [e.event_date for e in events if e.event_date is not None]
    if dates:
        earliest = min(dates).isoformat()
        latest = max(dates).isoformat()
    else:
        earliest = ""
        latest = ""

    # Compute layer counts
    layer_counts: dict[str, int] = dict(
        Counter(e.layer for e in events if e.layer is not None)
    )

    event_responses = [TimelineEventResponse.model_validate(e) for e in events]

    return TimelineApiResponseModel(
        events=event_responses,
        totalCount=len(event_responses),
        dateRange={"earliest": earliest, "latest": latest},
        layerCounts=layer_counts,
    )


# ---------------------------------------------------------------------------
# Timeline detail
# ---------------------------------------------------------------------------


@router.get(
    "/timeline/{event_id}",
    response_model=TimelineEventResponse,
    summary="Get a single timeline event by ID",
)
async def get_timeline_event(
    case_id: UUID,
    event_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TimelineEventResponse:
    """Retrieve a single timeline event by ID, scoped to the case."""
    await _get_user_case(db, case_id, current_user.id)

    result = await db.execute(
        select(TimelineEvent).where(
            TimelineEvent.id == event_id,
            TimelineEvent.case_id == case_id,
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timeline event not found",
        )

    return TimelineEventResponse.model_validate(event)
