# ABOUTME: REST API endpoints for HITL confirmation responses.
# ABOUTME: Frontend calls these to approve/reject pending agent actions.

import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.confirmation import (
    BatchItemDecision,
    ConfirmationRequest,
    get_pending_confirmations,
    resolve_batch_confirmation,
    resolve_confirmation,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["confirmations"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class ConfirmationResponseBody(BaseModel):
    """Request body for responding to a pending confirmation."""

    approved: bool = Field(..., description="Whether to approve the pending action")
    reason: str | None = Field(
        default=None,
        description="Optional reason for the decision",
        max_length=1000,
    )


class ConfirmationResolveResponse(BaseModel):
    """Response after resolving a confirmation."""

    status: str = Field(..., description="Resolution status")
    approved: bool = Field(..., description="Whether the action was approved")


class ConfirmationListResponse(BaseModel):
    """Response listing pending confirmations for a case."""

    confirmations: list[ConfirmationRequest] = Field(
        ..., description="List of pending confirmation requests"
    )
    count: int = Field(..., description="Total number of pending confirmations")


class BatchDecisionBody(BaseModel):
    """Per-item decision within a batch response."""

    item_id: str = Field(..., description="ID of the item being decided")
    approved: bool = Field(..., description="Whether this item was approved")
    reason: str | None = Field(
        default=None, description="Optional reason", max_length=1000
    )


class BatchConfirmationResponseBody(BaseModel):
    """Request body for responding to a batch confirmation."""

    decisions: list[BatchDecisionBody] = Field(
        ..., description="Per-item approval decisions"
    )


class BatchConfirmationResolveResponse(BaseModel):
    """Response after resolving a batch confirmation."""

    status: str = Field(..., description="Resolution status")
    resolved_count: int = Field(..., description="Number of items resolved")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/api/cases/{case_id}/confirmations/{request_id}",
    response_model=ConfirmationResolveResponse,
    summary="Respond to a pending confirmation",
    responses={
        404: {"description": "Confirmation not found or already resolved"},
    },
)
async def respond_to_confirmation(
    case_id: UUID,
    request_id: str,
    body: ConfirmationResponseBody,
) -> ConfirmationResolveResponse:
    """Approve or reject a pending agent confirmation request.

    This unblocks the waiting pipeline coroutine, allowing the agent to
    proceed (if approved) or abort/skip (if rejected).

    No auth required for hackathon simplicity -- the SSE event is already
    scoped to the case.
    """
    resolved = resolve_confirmation(
        request_id=request_id,
        approved=body.approved,
        reason=body.reason,
    )

    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Confirmation {request_id} not found or already resolved",
        )

    logger.info(
        "Confirmation responded via API: case=%s request_id=%s approved=%s",
        case_id,
        request_id,
        body.approved,
    )

    return ConfirmationResolveResponse(
        status="resolved",
        approved=body.approved,
    )


@router.get(
    "/api/cases/{case_id}/confirmations/pending",
    response_model=ConfirmationListResponse,
    summary="List pending confirmations for a case",
)
async def list_pending_confirmations(
    case_id: UUID,
) -> ConfirmationListResponse:
    """Return all pending confirmations for a case.

    Used by the frontend to display confirmation dialogs and notification
    badges when the user navigates to the Command Center.
    """
    pending = get_pending_confirmations(str(case_id))
    return ConfirmationListResponse(
        confirmations=pending,
        count=len(pending),
    )


@router.post(
    "/api/cases/{case_id}/confirmations/batch/{batch_id}",
    response_model=BatchConfirmationResolveResponse,
    summary="Respond to a batch confirmation with per-item decisions",
    responses={
        404: {"description": "Batch not found or already resolved"},
    },
)
async def respond_to_batch_confirmation(
    case_id: UUID,
    batch_id: str,
    body: BatchConfirmationResponseBody,
) -> BatchConfirmationResolveResponse:
    """Submit per-item decisions for a batch confirmation.

    The frontend receives a ``confirmation-batch-required`` SSE event with
    all flagged items, renders a single multi-item review dialog, and
    submits all decisions here in one request.
    """
    decisions = [
        BatchItemDecision(
            item_id=d.item_id,
            approved=d.approved,
            reason=d.reason,
        )
        for d in body.decisions
    ]

    resolved = resolve_batch_confirmation(
        batch_id=batch_id,
        decisions=decisions,
    )

    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch confirmation {batch_id} not found or already resolved",
        )

    logger.info(
        "Batch confirmation responded via API: case=%s batch_id=%s items=%d",
        case_id,
        batch_id,
        len(decisions),
    )

    return BatchConfirmationResolveResponse(
        status="resolved",
        resolved_count=len(decisions),
    )
