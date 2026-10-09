# ABOUTME: Case CRUD API endpoints with user ownership enforcement.
# ABOUTME: All case operations are scoped to the authenticated user.

import logging
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import CurrentUser
from app.database import get_db
from app.models import Case, CaseStatus
from app.schemas.case import (
    CaseCreate,
    CaseListResponse,
    CaseResponse,
    CaseUpdate,
)
from app.schemas.common import ErrorResponse
from app.services.file_service import delete_case_storage
from app.services.rag_service import forget_case

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.post(
    "",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new case",
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def create_case(
    case_data: CaseCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Case:
    """Create a new investigation case for the authenticated user."""
    case = Case(
        user_id=current_user.id,
        name=case_data.name,
        description=case_data.description,
        type=case_data.type,
        status=CaseStatus.DRAFT,
        file_count=0,
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case


@router.get(
    "",
    response_model=CaseListResponse,
    summary="List user's cases",
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def list_cases(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1, description="Page number")] = 1,
    per_page: Annotated[int, Query(ge=1, le=100, description="Cases per page")] = 20,
    sort_by: Annotated[str, Query(description="Sort field")] = "updated_at",
    sort_order: Annotated[str, Query(description="Sort direction")] = "desc",
) -> CaseListResponse:
    """List all cases belonging to the authenticated user."""
    # Base query: user's non-deleted cases
    base_query = select(Case).where(
        Case.user_id == current_user.id,
        Case.deleted_at.is_(None),
    )

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply sorting
    sort_column = getattr(Case, sort_by, Case.updated_at)
    if sort_order == "desc":
        base_query = base_query.order_by(sort_column.desc())
    else:
        base_query = base_query.order_by(sort_column.asc())

    # Apply pagination
    offset = (page - 1) * per_page
    base_query = base_query.offset(offset).limit(per_page)

    # Execute
    result = await db.execute(base_query)
    cases = list(result.scalars().all())

    return CaseListResponse(
        cases=[CaseResponse.model_validate(c) for c in cases],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/{case_id}",
    response_model=CaseResponse,
    summary="Get a single case",
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        404: {"model": ErrorResponse, "description": "Not found"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def get_case(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Case:
    """Get a single case by ID if owned by the authenticated user."""
    result = await db.execute(
        select(Case).where(
            Case.id == case_id,
            Case.user_id == current_user.id,
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


@router.delete(
    "/{case_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a case",
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        404: {"model": ErrorResponse, "description": "Not found"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def delete_case(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a case: remove its stored files and mark it deleted (hidden)."""
    result = await db.execute(
        select(Case).where(
            Case.id == case_id,
            Case.user_id == current_user.id,
            Case.deleted_at.is_(None),
        )
    )
    case = result.scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    # Remove the case's stored files first: if that fails the case stays visible
    # and the delete can simply be retried, instead of leaving orphaned files.
    try:
        removed = await delete_case_storage(str(case_id))
    except Exception:
        logger.exception("Could not delete stored files for case %s", case_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not delete the case's files. Please try again.",
        ) from None
    forget_case(str(case_id))

    case.deleted_at = datetime.now(UTC)
    await db.commit()
    logger.info("Deleted case %s (%d stored files removed)", case_id, removed)


@router.patch(
    "/{case_id}",
    response_model=CaseResponse,
    summary="Update a case",
    responses={
        400: {"model": ErrorResponse, "description": "Bad request"},
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        404: {"model": ErrorResponse, "description": "Not found"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def update_case(
    case_id: UUID,
    case_update: CaseUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Case:
    """Update a case's name and/or description.

    At least one field must be provided. Type and status are not user-editable.
    """
    # Validate that at least one field is provided
    update_data = case_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update",
        )

    # Fetch the case
    result = await db.execute(
        select(Case).where(
            Case.id == case_id,
            Case.user_id == current_user.id,
            Case.deleted_at.is_(None),
        )
    )
    case = result.scalar_one_or_none()

    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    # Apply updates
    for field, value in update_data.items():
        setattr(case, field, value)

    # Update timestamp
    case.updated_at = datetime.now(UTC)

    await db.commit()
    await db.refresh(case)
    return case
