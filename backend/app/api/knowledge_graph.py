# ABOUTME: Knowledge graph API endpoints for entity/relationship CRUD and full graph retrieval.
# ABOUTME: Serves the frontend KG visualization with case-scoped ownership verification.

import logging
import string
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import CurrentUser
from app.database import get_db
from app.models import Case, KgEntity, KgRelationship
from app.schemas.knowledge_graph import (
    EntityCreateRequest,
    EntityListResponse,
    EntityResponse,
    EntityUpdateRequest,
    GraphResponse,
    RelationshipCreateRequest,
    RelationshipListResponse,
    RelationshipResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases/{case_id}", tags=["knowledge-graph"])


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


def _normalize_name(name: str) -> str:
    """Normalize entity name: lowercase, strip, remove punctuation."""
    stripped = name.strip().lower()
    return stripped.translate(str.maketrans("", "", string.punctuation))


# ---------------------------------------------------------------------------
# Graph (full visualization payload)
# ---------------------------------------------------------------------------


@router.get(
    "/graph",
    response_model=GraphResponse,
    summary="Get full knowledge graph for a case",
)
async def get_graph(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> GraphResponse:
    """Return all non-merged entities and all relationships for the case.

    This endpoint provides the complete graph data needed by the frontend
    vis-network visualization.
    """
    await _get_user_case(db, case_id, current_user.id)

    # Fetch non-merged entities
    entity_result = await db.execute(
        select(KgEntity).where(
            KgEntity.case_id == case_id,
            KgEntity.merged_into_id.is_(None),
        )
    )
    entities = list(entity_result.scalars().all())

    # Fetch all relationships
    rel_result = await db.execute(
        select(KgRelationship).where(KgRelationship.case_id == case_id)
    )
    relationships = list(rel_result.scalars().all())

    return GraphResponse(
        entities=[EntityResponse.model_validate(e) for e in entities],
        relationships=[RelationshipResponse.model_validate(r) for r in relationships],
        entity_count=len(entities),
        relationship_count=len(relationships),
    )


# ---------------------------------------------------------------------------
# Entities CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/entities",
    response_model=EntityListResponse,
    summary="List entities with optional filtering",
)
async def list_entities(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    entity_type: Annotated[str | None, Query()] = None,
    domain: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query(description="Name search (ILIKE)")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EntityListResponse:
    """List non-merged entities with optional type, domain, and name filters."""
    await _get_user_case(db, case_id, current_user.id)

    base_query = select(KgEntity).where(
        KgEntity.case_id == case_id,
        KgEntity.merged_into_id.is_(None),
    )

    if entity_type is not None:
        base_query = base_query.where(KgEntity.entity_type == entity_type)
    if domain is not None:
        base_query = base_query.where(KgEntity.domain == domain)
    if search is not None:
        base_query = base_query.where(KgEntity.name.ilike(f"%{search}%"))

    # Total count
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch page
    paginated = (
        base_query.order_by(KgEntity.created_at.desc()).offset(offset).limit(limit)
    )
    result = await db.execute(paginated)
    entities = list(result.scalars().all())

    return EntityListResponse(
        entities=[EntityResponse.model_validate(e) for e in entities],
        total=total,
    )


@router.post(
    "/entities",
    response_model=EntityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new entity",
)
async def create_entity(
    case_id: UUID,
    body: EntityCreateRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EntityResponse:
    """Manually create a knowledge graph entity."""
    await _get_user_case(db, case_id, current_user.id)

    entity = KgEntity(
        case_id=case_id,
        name=body.name,
        name_normalized=_normalize_name(body.name),
        entity_type=body.entity_type,
        domain=body.domain,
        confidence=body.confidence,
        properties=body.metadata,
        context=body.context,
    )
    db.add(entity)
    await db.commit()
    await db.refresh(entity)

    logger.info(
        "Entity created: case=%s, entity=%s, name=%s", case_id, entity.id, body.name
    )
    return EntityResponse.model_validate(entity)


@router.patch(
    "/entities/{entity_id}",
    response_model=EntityResponse,
    summary="Update an entity",
)
async def update_entity(
    case_id: UUID,
    entity_id: UUID,
    body: EntityUpdateRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EntityResponse:
    """Update fields on an existing entity. Only provided (non-None) fields are changed."""
    await _get_user_case(db, case_id, current_user.id)

    result = await db.execute(
        select(KgEntity).where(
            KgEntity.id == entity_id,
            KgEntity.case_id == case_id,
        )
    )
    entity = result.scalar_one_or_none()
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entity not found",
        )

    if body.name is not None:
        entity.name = body.name
        entity.name_normalized = _normalize_name(body.name)
    if body.entity_type is not None:
        entity.entity_type = body.entity_type
    if body.metadata is not None:
        entity.properties = body.metadata
    if body.context is not None:
        entity.context = body.context

    await db.commit()
    await db.refresh(entity)

    logger.info("Entity updated: case=%s, entity=%s", case_id, entity_id)
    return EntityResponse.model_validate(entity)


@router.delete(
    "/entities/{entity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an entity",
)
async def delete_entity(
    case_id: UUID,
    entity_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Hard-delete an entity and cascade-delete its relationships."""
    await _get_user_case(db, case_id, current_user.id)

    result = await db.execute(
        select(KgEntity).where(
            KgEntity.id == entity_id,
            KgEntity.case_id == case_id,
        )
    )
    entity = result.scalar_one_or_none()
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entity not found",
        )

    await db.delete(entity)
    await db.commit()

    logger.info("Entity deleted: case=%s, entity=%s", case_id, entity_id)


# ---------------------------------------------------------------------------
# Relationships CRUD
# ---------------------------------------------------------------------------


@router.get(
    "/relationships",
    response_model=RelationshipListResponse,
    summary="List relationships with optional filtering",
)
async def list_relationships(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    entity_id: Annotated[
        UUID | None, Query(description="Filter by entity (source or target)")
    ] = None,
    relationship_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> RelationshipListResponse:
    """List relationships in a case with optional entity and type filters."""
    await _get_user_case(db, case_id, current_user.id)

    base_query = select(KgRelationship).where(KgRelationship.case_id == case_id)

    if entity_id is not None:
        base_query = base_query.where(
            (KgRelationship.source_entity_id == entity_id)
            | (KgRelationship.target_entity_id == entity_id)
        )
    if relationship_type is not None:
        base_query = base_query.where(
            KgRelationship.relationship_type == relationship_type
        )

    # Total count
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch page
    paginated = (
        base_query.order_by(KgRelationship.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(paginated)
    relationships = list(result.scalars().all())

    return RelationshipListResponse(
        relationships=[RelationshipResponse.model_validate(r) for r in relationships],
        total=total,
    )


@router.post(
    "/relationships",
    response_model=RelationshipResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new relationship",
)
async def create_relationship(
    case_id: UUID,
    body: RelationshipCreateRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RelationshipResponse:
    """Manually create a relationship between two entities in the same case."""
    await _get_user_case(db, case_id, current_user.id)

    # Verify both entities belong to this case
    for eid, role in [
        (body.source_entity_id, "source"),
        (body.target_entity_id, "target"),
    ]:
        result = await db.execute(
            select(KgEntity.id).where(
                KgEntity.id == eid,
                KgEntity.case_id == case_id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{role.capitalize()} entity not found in this case",
            )

    relationship = KgRelationship(
        case_id=case_id,
        source_entity_id=body.source_entity_id,
        target_entity_id=body.target_entity_id,
        relationship_type=body.relationship_type,
        label=body.label,
        strength=body.strength,
        properties=body.metadata,
    )
    db.add(relationship)
    await db.commit()
    await db.refresh(relationship)

    logger.info(
        "Relationship created: case=%s, rel=%s, type=%s",
        case_id,
        relationship.id,
        body.relationship_type,
    )
    return RelationshipResponse.model_validate(relationship)
