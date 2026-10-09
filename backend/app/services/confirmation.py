# ABOUTME: Human-in-the-loop confirmation service for pipeline pause/resume.
# ABOUTME: Uses asyncio.Event to block pipeline coroutines while waiting for user decisions.

import asyncio
import logging
from datetime import UTC, datetime
from uuid import uuid4

from pydantic import BaseModel, Field

from app.config import get_settings
from app.services.agent_events import (
    emit_confirmation_batch_required,
    emit_confirmation_batch_resolved,
    emit_confirmation_required,
    emit_confirmation_resolved,
)

logger = logging.getLogger(__name__)
_settings = get_settings()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ConfirmationRequest(BaseModel):
    """Data describing a pending confirmation request."""

    request_id: str = Field(..., description="Unique ID for this confirmation request")
    case_id: str = Field(..., description="Case this confirmation belongs to")
    agent_type: str = Field(
        ..., description="Agent type requesting confirmation (e.g. financial, legal)"
    )
    action_description: str = Field(
        ..., description="Human-readable description of the pending action"
    )
    affected_items: list[str] = Field(
        default_factory=list,
        description="List of items (file names, entity IDs) affected by the action",
    )
    context: dict[str, object] = Field(
        default_factory=dict,
        description="Additional context about the action for frontend display",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When the confirmation was requested",
    )


class ConfirmationResult(BaseModel):
    """User's response to a confirmation request."""

    approved: bool = Field(..., description="Whether the action was approved")
    reason: str | None = Field(
        default=None, description="Optional user-provided reason for the decision"
    )
    responded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When the user responded",
    )


class BatchConfirmationItem(BaseModel):
    """A single item within a batch confirmation request."""

    item_id: str = Field(..., description="Unique ID for this item within the batch")
    action_description: str = Field(
        ..., description="Human-readable description of the pending action"
    )
    affected_items: list[str] = Field(
        default_factory=list,
        description="Items affected by this specific action",
    )
    context: dict[str, object] = Field(
        default_factory=dict,
        description="Per-item context for frontend display",
    )


class BatchConfirmationRequest(BaseModel):
    """A batch of confirmation items sent and resolved as a single unit."""

    batch_id: str = Field(..., description="Unique ID for this batch")
    case_id: str = Field(..., description="Case this batch belongs to")
    agent_type: str = Field(..., description="Agent type requesting the batch")
    items: list[BatchConfirmationItem] = Field(
        ..., description="Individual items to review"
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When the batch was requested",
    )


class BatchItemDecision(BaseModel):
    """User's decision on a single item within a batch."""

    item_id: str = Field(..., description="ID of the item being decided")
    approved: bool = Field(..., description="Whether this item was approved")
    reason: str | None = Field(
        default=None, description="Optional reason for this decision"
    )


class BatchConfirmationResult(BaseModel):
    """User's response to a batch confirmation request."""

    decisions: list[BatchItemDecision] = Field(
        ..., description="Per-item approval decisions"
    )
    responded_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When the user responded",
    )


# ---------------------------------------------------------------------------
# In-memory stores (suitable for single-instance hackathon deployment)
# ---------------------------------------------------------------------------

# Maps request_id -> asyncio.Event for pause/resume signaling
_pending_confirmations: dict[str, asyncio.Event] = {}

# Maps request_id -> user's response once they approve/reject
_confirmation_results: dict[str, ConfirmationResult] = {}

# Maps request_id -> original request data (for listing and frontend display)
_confirmation_requests: dict[str, ConfirmationRequest] = {}

# Batch confirmation stores (same pattern, keyed by batch_id)
_pending_batch_confirmations: dict[str, asyncio.Event] = {}
_batch_confirmation_results: dict[str, BatchConfirmationResult] = {}
_batch_confirmation_requests: dict[str, BatchConfirmationRequest] = {}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def request_confirmation(
    case_id: str,
    agent_type: str,
    action_description: str,
    affected_items: list[str],
    context: dict[str, object] | None = None,
) -> ConfirmationResult:
    """Request human confirmation before proceeding with an agent action.

    Creates an asyncio.Event, emits an SSE event to notify the frontend, then
    blocks the calling coroutine via ``await event.wait()`` until the user
    responds through the REST API. The event loop remains free to handle other
    requests while the pipeline coroutine is suspended.

    Timeout is controlled by ``confirmation_timeout_seconds`` config setting.
    If 0, waits indefinitely. If timeout expires, returns rejection.

    Args:
        case_id: UUID string of the case.
        agent_type: Agent type requesting confirmation (e.g. ``"legal"``).
        action_description: Human-readable description of the pending action.
        affected_items: List of affected items (file names, entity IDs, etc.).
        context: Optional additional context for the frontend.

    Returns:
        ConfirmationResult with the user's approval decision.
    """
    request_id = str(uuid4())
    event = asyncio.Event()

    # Store the event and request data
    _pending_confirmations[request_id] = event
    _confirmation_requests[request_id] = ConfirmationRequest(
        request_id=request_id,
        case_id=case_id,
        agent_type=agent_type,
        action_description=action_description,
        affected_items=affected_items,
        context=context or {},
    )

    logger.info(
        "Confirmation requested: request_id=%s case=%s agent=%s action=%s",
        request_id,
        case_id,
        agent_type,
        action_description,
    )

    # Notify connected SSE clients about the pending confirmation
    await emit_confirmation_required(
        case_id=case_id,
        agent_type=agent_type,
        task_id=request_id,
        action_description=action_description,
        context={"affectedItems": affected_items, **(context or {})},
    )

    # Block this coroutine until user responds (does NOT block the event loop)
    # Apply configurable timeout to prevent indefinite pipeline hangs
    timeout_seconds = _settings.confirmation_timeout_seconds

    try:
        if timeout_seconds > 0:
            await asyncio.wait_for(event.wait(), timeout=timeout_seconds)
        else:
            await event.wait()
    except TimeoutError:
        logger.warning(
            "Confirmation timed out after %ss: request_id=%s",
            timeout_seconds,
            request_id,
        )
        # Clean up the pending confirmation
        _pending_confirmations.pop(request_id, None)
        _confirmation_requests.pop(request_id, None)
        # Return rejection on timeout
        return ConfirmationResult(
            approved=False,
            reason=f"Timed out after {timeout_seconds} seconds",
        )

    # Retrieve and clean up (event already removed by resolve_confirmation)
    result = _confirmation_results.pop(request_id)
    _confirmation_requests.pop(request_id, None)

    logger.info(
        "Confirmation resolved: request_id=%s approved=%s reason=%s",
        request_id,
        result.approved,
        result.reason,
    )

    return result


def resolve_confirmation(
    request_id: str,
    approved: bool,
    reason: str | None = None,
) -> bool:
    """Resolve a pending confirmation request, unblocking the waiting pipeline.

    Called by the REST API when a user approves or rejects a confirmation.

    Uses atomic pop() to prevent race conditions from double-clicks that
    could otherwise overwrite the first decision.

    Args:
        request_id: The confirmation request ID to resolve.
        approved: Whether the action was approved.
        reason: Optional user-provided reason for the decision.

    Returns:
        True if the confirmation was found and resolved, False if not found.
    """
    # Atomic pop prevents race condition from double-click
    event = _pending_confirmations.pop(request_id, None)
    if event is None:
        logger.warning(
            "Confirmation not found: request_id=%s (already resolved or invalid)",
            request_id,
        )
        return False

    # Store the result before signaling, so the waiting coroutine can read it
    _confirmation_results[request_id] = ConfirmationResult(
        approved=approved,
        reason=reason,
    )

    # Look up the original request for SSE event emission
    original = _confirmation_requests.get(request_id)
    case_id = original.case_id if original else ""
    agent_type = original.agent_type if original else "unknown"

    # Unblock the waiting pipeline coroutine
    event.set()

    logger.info(
        "Confirmation resolved via API: request_id=%s approved=%s",
        request_id,
        approved,
    )

    # Emit SSE event asynchronously (best-effort from sync context)
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            emit_confirmation_resolved(
                case_id=case_id,
                agent_type=agent_type,
                task_id=request_id,
                approved=approved,
                reason=reason,
            )
        )
    except RuntimeError:
        # No running event loop -- skip SSE emission (unlikely in FastAPI)
        logger.debug(
            "No event loop for SSE emission of confirmation-resolved: request_id=%s",
            request_id,
        )

    return True


async def request_batch_confirmation(
    case_id: str,
    agent_type: str,
    items: list[BatchConfirmationItem],
    context: dict[str, object] | None = None,
) -> BatchConfirmationResult:
    """Request batch human confirmation as a single atomic unit.

    Emits ONE SSE event containing all items, then blocks until the user
    responds with per-item decisions via the batch REST endpoint. The
    frontend renders a single multi-item review dialog.

    Args:
        case_id: UUID string of the case.
        agent_type: Agent type requesting confirmation.
        items: List of BatchConfirmationItem to review.
        context: Optional batch-level context for frontend display.

    Returns:
        BatchConfirmationResult with per-item decisions.
    """
    batch_id = str(uuid4())
    event = asyncio.Event()

    _pending_batch_confirmations[batch_id] = event
    _batch_confirmation_requests[batch_id] = BatchConfirmationRequest(
        batch_id=batch_id,
        case_id=case_id,
        agent_type=agent_type,
        items=items,
    )

    logger.info(
        "Batch confirmation requested: batch_id=%s case=%s agent=%s items=%d",
        batch_id,
        case_id,
        agent_type,
        len(items),
    )

    await emit_confirmation_batch_required(
        case_id=case_id,
        agent_type=agent_type,
        batch_id=batch_id,
        items=[item.model_dump(mode="json") for item in items],
        context=context,
    )

    timeout_seconds = _settings.confirmation_timeout_seconds
    try:
        if timeout_seconds > 0:
            await asyncio.wait_for(event.wait(), timeout=timeout_seconds)
        else:
            await event.wait()
    except TimeoutError:
        logger.warning(
            "Batch confirmation timed out after %ss: batch_id=%s",
            timeout_seconds,
            batch_id,
        )
        _pending_batch_confirmations.pop(batch_id, None)
        _batch_confirmation_requests.pop(batch_id, None)
        # Reject all items on timeout
        return BatchConfirmationResult(
            decisions=[
                BatchItemDecision(
                    item_id=item.item_id,
                    approved=False,
                    reason=f"Timed out after {timeout_seconds} seconds",
                )
                for item in items
            ],
        )

    result = _batch_confirmation_results.pop(batch_id)
    _batch_confirmation_requests.pop(batch_id, None)

    logger.info(
        "Batch confirmation resolved: batch_id=%s approved=%d/%d",
        batch_id,
        sum(1 for d in result.decisions if d.approved),
        len(result.decisions),
    )
    return result


def resolve_batch_confirmation(
    batch_id: str,
    decisions: list[BatchItemDecision],
) -> bool:
    """Resolve a pending batch confirmation, unblocking the waiting pipeline.

    Called by the REST API when the user submits per-item decisions.

    Args:
        batch_id: The batch confirmation ID to resolve.
        decisions: Per-item approval decisions.

    Returns:
        True if the batch was found and resolved, False if not found.
    """
    event = _pending_batch_confirmations.pop(batch_id, None)
    if event is None:
        logger.warning(
            "Batch confirmation not found: batch_id=%s (already resolved or invalid)",
            batch_id,
        )
        return False

    _batch_confirmation_results[batch_id] = BatchConfirmationResult(
        decisions=decisions,
    )

    original = _batch_confirmation_requests.get(batch_id)
    case_id = original.case_id if original else ""
    agent_type_val = original.agent_type if original else "unknown"

    event.set()

    logger.info(
        "Batch confirmation resolved via API: batch_id=%s items=%d",
        batch_id,
        len(decisions),
    )

    # Emit SSE event asynchronously (best-effort)
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            emit_confirmation_batch_resolved(
                case_id=case_id,
                agent_type=agent_type_val,
                batch_id=batch_id,
                decisions=[d.model_dump(mode="json") for d in decisions],
            )
        )
    except RuntimeError:
        logger.debug(
            "No event loop for SSE emission of batch-resolved: batch_id=%s",
            batch_id,
        )

    return True


def get_pending_confirmations(case_id: str) -> list[ConfirmationRequest]:
    """Return all pending confirmations for a case.

    Args:
        case_id: UUID string of the case.

    Returns:
        List of ConfirmationRequest objects with pending status.
    """
    return [req for req in _confirmation_requests.values() if req.case_id == case_id]


def get_pending_confirmation_count(case_id: str) -> int:
    """Return the number of pending confirmations for a case.

    Useful for notification badge counts in the frontend.

    Args:
        case_id: UUID string of the case.

    Returns:
        Count of pending confirmations.
    """
    return sum(1 for req in _confirmation_requests.values() if req.case_id == case_id)


def cleanup_stale_confirmations(max_age_seconds: float | None = None) -> int:
    """Clean up stale confirmation requests that exceeded their expected lifetime.

    This handles edge cases where the awaiting coroutine crashed or was
    cancelled without proper cleanup. Should be called periodically or
    during application startup.

    Args:
        max_age_seconds: Maximum age in seconds before a confirmation is
            considered stale. Defaults to 2x the configured timeout.

    Returns:
        Number of stale confirmations that were cleaned up.
    """
    if max_age_seconds is None:
        max_age_seconds = _settings.confirmation_timeout_seconds * 2

    now = datetime.now(UTC)
    stale_ids: list[str] = []

    for req in _confirmation_requests.values():
        age = (now - req.created_at).total_seconds()
        if age > max_age_seconds:
            stale_ids.append(req.request_id)

    for request_id in stale_ids:
        _pending_confirmations.pop(request_id, None)
        _confirmation_requests.pop(request_id, None)
        _confirmation_results.pop(request_id, None)
        logger.warning(
            "Cleaned up stale confirmation: request_id=%s age=%ss",
            request_id,
            max_age_seconds,
        )

    # Also clean up stale batch confirmations
    stale_batch_ids: list[str] = []
    for req in _batch_confirmation_requests.values():
        age = (now - req.created_at).total_seconds()
        if age > max_age_seconds:
            stale_batch_ids.append(req.batch_id)

    for batch_id in stale_batch_ids:
        _pending_batch_confirmations.pop(batch_id, None)
        _batch_confirmation_requests.pop(batch_id, None)
        _batch_confirmation_results.pop(batch_id, None)
        logger.warning(
            "Cleaned up stale batch confirmation: batch_id=%s age=%ss",
            batch_id,
            max_age_seconds,
        )

    return len(stale_ids) + len(stale_batch_ids)
