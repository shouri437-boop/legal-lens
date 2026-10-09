# ABOUTME: Server-Sent Events (SSE) endpoints for real-time streaming.
# ABOUTME: Includes file status streaming, command center agent events, and heartbeat for Cloud Run connections.

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import APIRouter
from sqlalchemy import select
from sse_starlette import EventSourceResponse

from app.config import get_settings
from app.services.agent_events import (
    AgentEventType,
    build_agent_result,
    build_execution_metadata,
    subscribe_with_replay,
    unsubscribe_from_agent_events,
)

logger = logging.getLogger(__name__)
_settings = get_settings()

router = APIRouter()

# In-memory pubsub for file events (single instance, suitable for hackathon)
# Maps case_id -> list of subscriber queues
_file_subscribers: dict[str, list[asyncio.Queue[dict[str, str]]]] = defaultdict(list)


async def publish_file_event(
    case_id: str, event_type: str, data: dict[str, Any]
) -> None:
    """
    Publish a file event to all subscribers for a case.

    Args:
        case_id: UUID string of the case
        event_type: Event type (file-uploaded, file-status, file-deleted, file-error)
        data: Event payload to send as JSON
    """
    event = {"event": event_type, "data": json.dumps(data)}
    subscribers = _file_subscribers.get(case_id, [])
    for queue in subscribers:
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            # Skip if queue is full (slow consumer)
            pass


async def heartbeat_generator():
    """Generate heartbeat events to keep connection alive."""
    while True:
        yield {"event": "heartbeat", "data": "ping"}
        await asyncio.sleep(_settings.sse_heartbeat_interval_seconds)


async def file_status_generator(case_id: str):
    """
    Generate file status events for a case with heartbeat.

    Yields events when files are uploaded, status changes, or files are deleted.
    Sends heartbeat every 15 seconds to keep connection alive.
    """
    queue: asyncio.Queue[dict[str, str]] = asyncio.Queue(maxsize=100)
    _file_subscribers[case_id].append(queue)

    try:
        while True:
            try:
                # Wait for event with timeout for heartbeat
                event = await asyncio.wait_for(
                    queue.get(), timeout=_settings.sse_heartbeat_interval_seconds
                )
                yield event
            except TimeoutError:
                # Send heartbeat on timeout
                yield {"event": "heartbeat", "data": "ping"}
    finally:
        # Clean up subscriber on disconnect
        try:
            _file_subscribers[case_id].remove(queue)
        except ValueError:
            pass
        # Clean up empty subscriber lists
        if not _file_subscribers[case_id]:
            del _file_subscribers[case_id]


@router.get("/sse/heartbeat")
async def sse_heartbeat():
    """SSE endpoint skeleton with heartbeat only."""
    return EventSourceResponse(
        heartbeat_generator(),
        headers={
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Cache-Control": "no-cache, no-transform",
        },
    )


@router.get("/sse/cases/{case_id}/files")
async def file_status_stream(case_id: str):
    """
    SSE endpoint for file status updates.

    Streams events when:
    - A file is uploaded (file-uploaded)
    - A file's processing status changes (file-status)
    - A file is deleted (file-deleted)
    - An error occurs during processing (file-error)

    Heartbeat events are sent every 15 seconds to keep the connection alive.
    """
    return EventSourceResponse(
        file_status_generator(case_id),
        headers={
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Cache-Control": "no-cache, no-transform",
        },
    )


# ---------------------------------------------------------------------------
# Command Center SSE (agent lifecycle events)
# ---------------------------------------------------------------------------


async def build_state_snapshot(case_id: str) -> dict[str, Any]:
    """Build a state snapshot of all agent executions for reconnection.

    Queries executions for the case's latest_workflow_id (authoritative source)
    and returns each agent's current status, metadata (tokens, duration,
    thinking traces), and lastResult for refresh resilience.

    Args:
        case_id: UUID string of the case.

    Returns:
        Dict with "agents" key mapping agent names to their status, metadata,
        and lastResult.
    """
    from app.database import _get_sessionmaker
    from app.models.agent_execution import AgentExecution
    from app.models.case import Case

    session_factory = _get_sessionmaker()
    agents: dict[str, Any] = {}

    try:
        async with session_factory() as db:
            from uuid import UUID as PyUUID

            # Use Case.latest_workflow_id as authoritative source (Bug 6 fix).
            # Avoids the two-step query that could select the wrong workflow
            # if execution records from different workflows overlap.
            case_result = await db.execute(
                select(Case.latest_workflow_id).where(Case.id == PyUUID(case_id))
            )
            latest_workflow_id = case_result.scalar_one_or_none()
            if latest_workflow_id is None:
                return {"agents": agents}

            # Get all executions for the authoritative workflow
            workflow_result = await db.execute(
                select(AgentExecution)
                .where(AgentExecution.workflow_id == latest_workflow_id)
                .order_by(AgentExecution.created_at.asc())
            )
            executions = list(workflow_result.scalars().all())

            for execution in executions:
                metadata_dict = build_execution_metadata(
                    execution, execution.model_name
                )

                agent_entry: dict[str, Any] = {
                    "status": execution.status.value.lower(),
                    "metadata": metadata_dict,
                }

                last_result = build_agent_result(execution, metadata_dict)
                if last_result is not None:
                    agent_entry["lastResult"] = last_result

                # Build compound snapshot key from agent_name + stage_suffix
                # so multiple instances (e.g. legal_grp_0, legal_grp_1)
                # don't overwrite each other under the same base-type key.
                raw_suffix = ""
                if execution.input_data and isinstance(execution.input_data, dict):
                    raw_suffix = execution.input_data.get("stage_suffix", "")
                    if not isinstance(raw_suffix, str):
                        raw_suffix = ""

                group_label = raw_suffix.lstrip("_") if raw_suffix else ""
                if group_label:
                    snapshot_key = f"{execution.agent_name}_{group_label}"
                else:
                    snapshot_key = execution.agent_name

                agents[snapshot_key] = agent_entry

    except Exception:
        logger.exception("Failed to build state snapshot for case=%s", case_id)

    return {"agents": agents}


async def command_center_generator(case_id: str):
    """Generate agent lifecycle events for Command Center visualization.

    Sends a state snapshot immediately on connect for reconnection resilience,
    then streams live events.

    Events:
    - state-snapshot: Full agent state on connect (reconnection support)
    - agent-started: Agent begins processing a file/task
    - agent-complete: Agent finishes with results
    - agent-error: Agent encountered an error
    - thinking-update: Agent reasoning trace (real-time)
    - tool-called: Agent invoked a tool
    - processing-complete: All agents finished for this case

    Heartbeat every 15 seconds per REQ-INF-004.
    """
    # Send state snapshot immediately on connect.
    # Include `type` so the frontend validation switch dispatches correctly.
    snapshot = await build_state_snapshot(case_id)
    snapshot_agent_ids = set(snapshot.get("agents", {}).keys())
    snapshot["type"] = AgentEventType.STATE_SNAPSHOT.value
    yield {
        "event": AgentEventType.STATE_SNAPSHOT.value,
        "data": json.dumps(snapshot),
    }

    # Subscribe with replay of buffered events for agents not in the snapshot.
    # This bridges the gap when events fire before the subscriber connects
    # (e.g. triage agent-started emitted before SSE connection established).
    queue = subscribe_with_replay(case_id, exclude_agents=snapshot_agent_ids)

    try:
        while True:
            try:
                event = await asyncio.wait_for(
                    queue.get(), timeout=_settings.sse_heartbeat_interval_seconds
                )
                yield event
            except TimeoutError:
                yield {"event": "heartbeat", "data": "ping"}
    finally:
        unsubscribe_from_agent_events(case_id, queue)


@router.get("/sse/cases/{case_id}/command-center/stream")
async def command_center_stream(case_id: str):
    """SSE endpoint for Command Center agent visualization.

    Streams agent lifecycle events for real-time display in the
    Command Center Agent Flow canvas:
    - agent-started: When an agent begins processing
    - agent-complete: When an agent finishes with results
    - agent-error: When an agent encounters an error
    - processing-complete: When all processing is done

    Heartbeat every 15 seconds to keep connection alive on Cloud Run.
    """
    return EventSourceResponse(
        command_center_generator(case_id),
        headers={
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Cache-Control": "no-cache, no-transform",
        },
    )
