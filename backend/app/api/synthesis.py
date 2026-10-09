# ABOUTME: Synthesis API endpoints for hypotheses, contradictions, gaps, tasks, and synthesis summary.
# ABOUTME: Serves the frontend Verdict and Intelligence views with case-scoped ownership verification.

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case as sa_case
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import CurrentUser
from app.database import get_db
from app.models import (
    Case,
    CaseContradiction,
    CaseGap,
    CaseHypothesis,
    CaseSynthesis,
    InvestigationTask,
)
from app.models.knowledge_graph import KgEntity
from app.schemas.synthesis import (
    ContradictionResponse,
    GapResponse,
    HypothesisResponse,
    RelatedEntity,
    SynthesisResponse,
    TaskResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases/{case_id}", tags=["synthesis"])


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
# Synthesis summary
# ---------------------------------------------------------------------------


@router.get(
    "/synthesis",
    response_model=SynthesisResponse,
    summary="Get the latest synthesis summary for a case",
)
async def get_synthesis(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SynthesisResponse:
    """Return the most recent synthesis record with parsed verdict JSONB."""
    await _get_user_case(db, case_id, current_user.id)

    result = await db.execute(
        select(CaseSynthesis)
        .where(CaseSynthesis.case_id == case_id)
        .order_by(CaseSynthesis.created_at.desc())
        .limit(1)
    )
    synthesis = result.scalar_one_or_none()
    if not synthesis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Synthesis not found. Analysis may not have completed yet.",
        )

    return SynthesisResponse.model_validate(synthesis)


# ---------------------------------------------------------------------------
# Hypotheses
# ---------------------------------------------------------------------------


@router.get(
    "/hypotheses",
    response_model=list[HypothesisResponse],
    summary="List hypotheses with optional status filter",
)
async def list_hypotheses(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    hypothesis_status: Annotated[
        str | None,
        Query(
            alias="status", description="Filter by status: PENDING, SUPPORTED, REFUTED"
        ),
    ] = None,
) -> list[HypothesisResponse]:
    """Return hypotheses for a case, ordered by confidence descending."""
    await _get_user_case(db, case_id, current_user.id)

    query = select(CaseHypothesis).where(CaseHypothesis.case_id == case_id)

    if hypothesis_status is not None:
        query = query.where(CaseHypothesis.status == hypothesis_status.upper())

    query = query.order_by(CaseHypothesis.confidence.desc())

    result = await db.execute(query)
    hypotheses = list(result.scalars().all())

    return [HypothesisResponse.model_validate(h) for h in hypotheses]


@router.get(
    "/hypotheses/{hypothesis_id}",
    response_model=HypothesisResponse,
    summary="Get a single hypothesis by ID",
)
async def get_hypothesis(
    case_id: UUID,
    hypothesis_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> HypothesisResponse:
    """Return a single hypothesis by ID, scoped to the case."""
    await _get_user_case(db, case_id, current_user.id)

    result = await db.execute(
        select(CaseHypothesis).where(
            CaseHypothesis.id == hypothesis_id,
            CaseHypothesis.case_id == case_id,
        )
    )
    hypothesis = result.scalar_one_or_none()
    if not hypothesis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hypothesis not found",
        )

    return HypothesisResponse.model_validate(hypothesis)


# ---------------------------------------------------------------------------
# Contradictions
# ---------------------------------------------------------------------------


@router.get(
    "/contradictions",
    response_model=list[ContradictionResponse],
    summary="List contradictions with optional severity filter",
)
async def list_contradictions(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    severity: Annotated[
        str | None,
        Query(description="Filter by severity: minor, significant, critical"),
    ] = None,
) -> list[ContradictionResponse]:
    """Return contradictions for a case, ordered by severity (critical first)."""
    await _get_user_case(db, case_id, current_user.id)

    query = select(CaseContradiction).where(CaseContradiction.case_id == case_id)

    if severity is not None:
        query = query.where(CaseContradiction.severity == severity.lower())

    severity_order = sa_case(
        (CaseContradiction.severity == "critical", 1),
        (CaseContradiction.severity == "significant", 2),
        else_=3,
    )
    query = query.order_by(severity_order)

    result = await db.execute(query)
    contradictions = list(result.scalars().all())

    return [ContradictionResponse.model_validate(c) for c in contradictions]


# ---------------------------------------------------------------------------
# Entity resolution helpers
# ---------------------------------------------------------------------------


async def _resolve_entity_ids(
    db: AsyncSession,
    gaps: list[CaseGap],
) -> dict[str, RelatedEntity]:
    """Batch-resolve entity UUID strings stored in gaps to RelatedEntity objects.

    Collects all unique entity UUIDs across all gaps, performs a single DB
    query against KgEntity, and returns a lookup dict keyed by UUID string.
    Missing or invalid UUIDs are silently skipped.
    """
    all_ids: set[str] = set()
    for gap in gaps:
        if gap.related_entity_ids:
            all_ids.update(gap.related_entity_ids)

    if not all_ids:
        return {}

    # Convert to UUID objects, skipping invalid strings
    valid_uuids: list[UUID] = []
    for eid in all_ids:
        try:
            valid_uuids.append(UUID(eid))
        except (ValueError, AttributeError):
            logger.debug("Skipping invalid entity UUID in gap: %s", eid)

    if not valid_uuids:
        return {}

    result = await db.execute(
        select(KgEntity.id, KgEntity.name, KgEntity.entity_type).where(
            KgEntity.id.in_(valid_uuids)
        )
    )

    lookup: dict[str, RelatedEntity] = {}
    for entity_id, name, entity_type in result.all():
        lookup[str(entity_id)] = RelatedEntity(
            id=str(entity_id),
            name=name,
            entity_type=entity_type or "UNKNOWN",
        )

    return lookup


def _build_gap_response(
    gap: CaseGap,
    entity_lookup: dict[str, RelatedEntity],
) -> GapResponse:
    """Build a GapResponse with resolved related_entities from ORM object."""
    related_entities: list[RelatedEntity] = []
    if gap.related_entity_ids:
        for eid in gap.related_entity_ids:
            entity = entity_lookup.get(eid)
            if entity:
                related_entities.append(entity)

    return GapResponse(
        id=gap.id,
        case_id=gap.case_id,
        workflow_id=gap.workflow_id,
        description=gap.description,
        what_is_missing=gap.what_is_missing,
        why_needed=gap.why_needed,
        priority=gap.priority,
        related_entities=related_entities,
        suggested_actions=gap.suggested_actions,
        created_at=gap.created_at,
    )


# ---------------------------------------------------------------------------
# Gaps
# ---------------------------------------------------------------------------


@router.get(
    "/gaps",
    response_model=list[GapResponse],
    summary="List evidence gaps with optional priority filter",
)
async def list_gaps(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    priority: Annotated[
        str | None,
        Query(description="Filter by priority: low, medium, high, critical"),
    ] = None,
) -> list[GapResponse]:
    """Return gaps for a case, ordered by priority (critical first).

    Entity UUIDs stored in related_entity_ids are resolved to name/type
    via a single batch query against KgEntity.
    """
    await _get_user_case(db, case_id, current_user.id)

    query = select(CaseGap).where(CaseGap.case_id == case_id)

    if priority is not None:
        query = query.where(CaseGap.priority == priority.lower())

    priority_order = sa_case(
        (CaseGap.priority == "critical", 1),
        (CaseGap.priority == "high", 2),
        (CaseGap.priority == "medium", 3),
        else_=4,
    )
    query = query.order_by(priority_order)

    result = await db.execute(query)
    gaps = list(result.scalars().all())

    # Batch-resolve all referenced entity UUIDs to name + type
    entity_lookup = await _resolve_entity_ids(db, gaps)

    return [_build_gap_response(g, entity_lookup) for g in gaps]


# ---------------------------------------------------------------------------
# Investigation Tasks
# ---------------------------------------------------------------------------


@router.get(
    "/tasks",
    response_model=list[TaskResponse],
    summary="List investigation tasks with optional filters",
)
async def list_tasks(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    task_type: Annotated[
        str | None,
        Query(
            description="Filter by task type (e.g. resolve_contradiction, obtain_evidence)"
        ),
    ] = None,
    task_status: Annotated[
        str | None,
        Query(
            alias="status",
            description="Filter by status: pending, in_progress, completed, dismissed",
        ),
    ] = None,
) -> list[TaskResponse]:
    """Return investigation tasks for a case, ordered by priority then creation date."""
    await _get_user_case(db, case_id, current_user.id)

    query = select(InvestigationTask).where(InvestigationTask.case_id == case_id)

    if task_type is not None:
        query = query.where(InvestigationTask.task_type == task_type)
    if task_status is not None:
        query = query.where(InvestigationTask.status == task_status.lower())

    priority_order = sa_case(
        (InvestigationTask.priority == "critical", 1),
        (InvestigationTask.priority == "high", 2),
        (InvestigationTask.priority == "medium", 3),
        else_=4,
    )
    query = query.order_by(priority_order, InvestigationTask.created_at.asc())

    result = await db.execute(query)
    tasks = list(result.scalars().all())

    return [TaskResponse.model_validate(t) for t in tasks]
