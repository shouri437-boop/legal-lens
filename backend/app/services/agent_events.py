# ABOUTME: Agent event publishing service for SSE Command Center updates.
# ABOUTME: Manages pub/sub subscriptions, typed agent lifecycle events, and shared result serialization.

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict, deque
from enum import Enum
from typing import TYPE_CHECKING, Any, TypedDict

if TYPE_CHECKING:
    from app.models.agent_execution import AgentExecution

logger = logging.getLogger(__name__)


class SSEEvent(TypedDict):
    """Type-safe SSE event structure sent to subscribers."""

    event: str  # Event type (e.g., "agent-started")
    data: str  # JSON-serialized payload


class AgentEventType(str, Enum):
    """Agent lifecycle event types matching frontend CommandCenterSSEEvent."""

    AGENT_STARTED = "agent-started"
    AGENT_COMPLETE = "agent-complete"
    AGENT_ERROR = "agent-error"
    THINKING_UPDATE = "thinking-update"
    TOOL_CALLED = "tool-called"
    PROCESSING_COMPLETE = "processing-complete"
    STATE_SNAPSHOT = "state-snapshot"
    CONFIRMATION_REQUIRED = "confirmation-required"
    CONFIRMATION_RESOLVED = "confirmation-resolved"
    CONFIRMATION_BATCH_REQUIRED = "confirmation-batch-required"
    CONFIRMATION_BATCH_RESOLVED = "confirmation-batch-resolved"
    FINDING_COMMITTED = "finding-committed"
    KG_ENTITY_ADDED = "kg-entity-added"
    KG_RELATIONSHIP_ADDED = "kg-relationship-added"
    SYNTHESIS_DATA_READY = "synthesis-data-ready"
    GEOSPATIAL_COMPLETE = "geospatial-complete"


# ---------------------------------------------------------------------------
# Subscriber management (in-memory pub/sub, suitable for single-instance)
# ---------------------------------------------------------------------------

# Maps case_id -> list of subscriber queues
_agent_subscribers: dict[str, list[asyncio.Queue[SSEEvent]]] = defaultdict(list)

# Per-case event replay buffer. Stores recent events so late-joining
# SSE subscribers can receive events emitted before they connected.
# Bounded to 50 events per case to limit memory usage.
_EVENT_BUFFER_MAX = 50
_event_buffer: dict[str, deque[SSEEvent]] = defaultdict(
    lambda: deque(maxlen=_EVENT_BUFFER_MAX)
)


def unsubscribe_from_agent_events(case_id: str, queue: asyncio.Queue[SSEEvent]) -> None:
    """Unsubscribe from agent events for a case.

    Removes the queue from the subscriber list and cleans up empty lists.

    Args:
        case_id: UUID string of the case.
        queue: The queue returned by subscribe_with_replay.
    """
    try:
        _agent_subscribers[case_id].remove(queue)
    except ValueError:
        pass
    # Clean up empty subscriber lists
    if not _agent_subscribers[case_id]:
        del _agent_subscribers[case_id]
    logger.debug("Agent event subscriber removed for case=%s", case_id)


def subscribe_with_replay(
    case_id: str,
    exclude_agents: set[str],
) -> asyncio.Queue[SSEEvent]:
    """Subscribe to agent events with replay of buffered events.

    Late-joining subscribers receive events emitted before they connected,
    filtered to exclude agents already represented in the state snapshot.
    The subscribe and buffer drain are synchronous (no await) so no events
    can be published between the buffer read and the subscription.

    Args:
        case_id: UUID string of the case.
        exclude_agents: Agent IDs already in the snapshot (skip their events).

    Returns:
        Queue pre-populated with buffered events, then receiving live events.
    """
    queue: asyncio.Queue[SSEEvent] = asyncio.Queue(maxsize=100)

    # Replay buffered events for agents NOT covered by the snapshot.
    # Events fall into two categories:
    #   - Agent-scoped (have agentType): skip if that agent is in the snapshot
    #   - Case-scoped (no agentType, e.g. processing-complete): always replay
    for event in _event_buffer.get(case_id, []):
        try:
            data = json.loads(event["data"])
        except (json.JSONDecodeError, KeyError):
            continue
        agent_id = data.get("agentType", "")
        if agent_id in exclude_agents:
            continue
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            break

    # Subscribe to live events (after buffer drain, atomically)
    _agent_subscribers[case_id].append(queue)
    logger.debug(
        "Agent event subscriber added with replay for case=%s (buffered=%d, excluded=%d, total=%d)",
        case_id,
        len(_event_buffer.get(case_id, [])),
        len(exclude_agents),
        len(_agent_subscribers[case_id]),
    )
    return queue


def clear_event_buffer(case_id: str) -> None:
    """Clear the event replay buffer for a case.

    Called at pipeline start (new workflow) and pipeline end (processing-complete).
    """
    _event_buffer.pop(case_id, None)


# ---------------------------------------------------------------------------
# Event publishing
# ---------------------------------------------------------------------------


async def publish_agent_event(
    case_id: str,
    event_type: AgentEventType,
    data: dict[str, Any],
) -> None:
    """Publish agent event to all subscribers for a case.

    Events are sent as dicts with 'event' (type string) and 'data' (JSON string)
    keys, matching the SSE format expected by EventSourceResponse.

    Args:
        case_id: UUID string of the case.
        event_type: Type of agent lifecycle event.
        data: Event payload to serialize as JSON.
    """
    # Copy dict to avoid mutating caller's data (prevents side effects)
    data_to_send = data.copy()

    # Ensure `type` is always present in the payload so the frontend
    # validation switch (which dispatches on `data.type`) never sees
    # `undefined`.  Direct emitters already include it, but callback-
    # sourced events from create_sse_publish_fn() may not.
    if "type" not in data_to_send:
        data_to_send["type"] = event_type.value

    event: SSEEvent = {
        "event": event_type.value,
        "data": json.dumps(data_to_send),
    }
    _event_buffer[case_id].append(event)
    subscribers = _agent_subscribers.get(case_id, [])
    for queue in subscribers:
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            # Skip slow consumers to avoid backpressure
            logger.warning(
                "Agent event queue full for case=%s, dropping event=%s",
                case_id,
                event_type.value,
            )


# ---------------------------------------------------------------------------
# Convenience emitters for common events
# ---------------------------------------------------------------------------


async def emit_agent_started(
    case_id: str,
    agent_type: str,
    task_id: str,
    file_id: str,
    file_name: str,
) -> None:
    """Emit an agent-started event.

    Args:
        case_id: UUID string of the case.
        agent_type: Agent type (triage, orchestrator, legal, etc.).
        task_id: Unique identifier for this agent task.
        file_id: ID of the file being processed.
        file_name: Original filename for display.
    """
    await publish_agent_event(
        case_id,
        AgentEventType.AGENT_STARTED,
        {
            "type": AgentEventType.AGENT_STARTED.value,
            "agentType": agent_type,
            "taskId": task_id,
            "fileId": file_id,
            "fileName": file_name,
        },
    )


async def emit_agent_complete(
    case_id: str,
    agent_type: str,
    task_id: str,
    result: dict[str, Any],
) -> None:
    """Emit an agent-complete event.

    Args:
        case_id: UUID string of the case.
        agent_type: Agent type (triage, orchestrator, legal, etc.).
        task_id: Unique identifier for this agent task.
        result: AgentResult-compatible dict with outputs and metadata.
    """
    await publish_agent_event(
        case_id,
        AgentEventType.AGENT_COMPLETE,
        {
            "type": AgentEventType.AGENT_COMPLETE.value,
            "agentType": agent_type,
            "taskId": task_id,
            "result": result,
        },
    )


async def emit_agent_error(
    case_id: str,
    agent_type: str,
    task_id: str,
    error: str,
) -> None:
    """Emit an agent-error event.

    Args:
        case_id: UUID string of the case.
        agent_type: Agent type (triage, orchestrator, legal, etc.).
        task_id: Unique identifier for this agent task.
        error: Human-readable error description.
    """
    await publish_agent_event(
        case_id,
        AgentEventType.AGENT_ERROR,
        {
            "type": AgentEventType.AGENT_ERROR.value,
            "agentType": agent_type,
            "taskId": task_id,
            "error": error,
        },
    )


async def emit_processing_complete(
    case_id: str,
    files_processed: int,
    entities_created: int,
    relationships_created: int,
    total_duration_ms: int | None = None,
    total_input_tokens: int | None = None,
    total_output_tokens: int | None = None,
) -> None:
    """Emit a processing-complete event when all agents finish.

    Args:
        case_id: UUID string of the case.
        files_processed: Number of files that were analyzed.
        entities_created: Number of entities extracted.
        relationships_created: Number of relationships discovered.
        total_duration_ms: Total pipeline duration in milliseconds.
        total_input_tokens: Sum of input tokens across all agents.
        total_output_tokens: Sum of output tokens across all agents.
    """
    data: dict[str, Any] = {
        "type": AgentEventType.PROCESSING_COMPLETE.value,
        "caseId": case_id,
        "filesProcessed": files_processed,
        "entitiesCreated": entities_created,
        "relationshipsCreated": relationships_created,
    }
    if total_duration_ms is not None:
        data["totalDurationMs"] = total_duration_ms
    if total_input_tokens is not None:
        data["totalInputTokens"] = total_input_tokens
    if total_output_tokens is not None:
        data["totalOutputTokens"] = total_output_tokens
    await publish_agent_event(
        case_id,
        AgentEventType.PROCESSING_COMPLETE,
        data,
    )


async def emit_thinking_update(
    case_id: str,
    agent_type: str,
    thought: str,
    token_delta: dict[str, int] | None = None,
    timestamp: str | None = None,
) -> None:
    """Emit a thinking-update event with real-time thinking trace text.

    Fires during agent execution as each model turn produces thinking parts,
    providing a live feed of agent reasoning to the Command Center.

    Args:
        case_id: UUID string of the case.
        agent_type: Agent type (triage, orchestrator, legal, etc.).
        thought: Full untruncated thinking text from the model.
        token_delta: Optional per-turn token usage delta with keys
            inputTokens, outputTokens, thoughtsTokens.
        timestamp: Optional ISO timestamp. If not provided, current UTC time is used.
    """
    from datetime import UTC, datetime

    data: dict[str, Any] = {
        "type": AgentEventType.THINKING_UPDATE.value,
        "agentType": agent_type,
        "thought": thought,
        "timestamp": timestamp or datetime.now(tz=UTC).isoformat(),
    }
    if token_delta is not None:
        data["tokenDelta"] = token_delta
    await publish_agent_event(
        case_id,
        AgentEventType.THINKING_UPDATE,
        data,
    )


async def emit_agent_fallback(
    case_id: str,
    agent_type: str,
    fallback_model: str,
    reason: str | None = None,
) -> None:
    """Emit a thinking-update event indicating an agent fell back to a simpler model.

    Rendered as a warning badge on the agent node in the Command Center.
    Uses thinking-update event type since the frontend already handles it.

    Args:
        case_id: UUID string of the case.
        agent_type: Agent type that fell back (e.g., "legal").
        fallback_model: Name of the fallback model used.
        reason: Optional reason for the fallback.
    """
    from datetime import UTC, datetime

    warning_text = f"[FALLBACK] Agent switched to {fallback_model}"
    if reason:
        warning_text += f": {reason}"

    await publish_agent_event(
        case_id,
        AgentEventType.THINKING_UPDATE,
        {
            "type": AgentEventType.THINKING_UPDATE.value,
            "agentType": agent_type,
            "thought": warning_text,
            "timestamp": datetime.now(tz=UTC).isoformat(),
            "isFallback": True,
            "fallbackModel": fallback_model,
        },
    )


async def emit_confirmation_required(
    case_id: str,
    agent_type: str,
    task_id: str,
    action_description: str,
    context: dict[str, Any] | None = None,
) -> None:
    """Emit a confirmation-required event for HITL approval workflows.

    Fires when an agent needs human approval before proceeding with
    a sensitive or destructive action.

    Args:
        case_id: UUID string of the case.
        agent_type: Agent type requesting confirmation.
        task_id: Unique identifier for this agent task.
        action_description: Human-readable description of the pending action.
        context: Optional additional context about the action.
    """
    data: dict[str, Any] = {
        "type": AgentEventType.CONFIRMATION_REQUIRED.value,
        "agentType": agent_type,
        "taskId": task_id,
        "actionDescription": action_description,
    }
    if context is not None:
        data["context"] = context
    await publish_agent_event(
        case_id,
        AgentEventType.CONFIRMATION_REQUIRED,
        data,
    )


async def emit_confirmation_resolved(
    case_id: str,
    agent_type: str,
    task_id: str,
    approved: bool,
    reason: str | None = None,
) -> None:
    """Emit a confirmation-resolved event when a HITL decision is made.

    Fires when the user approves or rejects a pending confirmation request,
    allowing the agent to proceed or abort.

    Args:
        case_id: UUID string of the case.
        agent_type: Agent type whose confirmation was resolved.
        task_id: Unique identifier for this agent task.
        approved: Whether the action was approved.
        reason: Optional user-provided reason for the decision.
    """
    data: dict[str, Any] = {
        "type": AgentEventType.CONFIRMATION_RESOLVED.value,
        "agentType": agent_type,
        "taskId": task_id,
        "approved": approved,
    }
    if reason is not None:
        data["reason"] = reason
    await publish_agent_event(
        case_id,
        AgentEventType.CONFIRMATION_RESOLVED,
        data,
    )


async def emit_confirmation_batch_required(
    case_id: str,
    agent_type: str,
    batch_id: str,
    items: list[dict[str, Any]],
    context: dict[str, Any] | None = None,
) -> None:
    """Emit a batch confirmation request as a single atomic SSE event.

    All flagged items arrive in one event so the frontend can render a
    single multi-item review dialog instead of N individual dialogs.

    Args:
        case_id: UUID string of the case.
        agent_type: Agent type requesting confirmation.
        batch_id: Unique identifier for this batch.
        items: List of item dicts each with itemId, actionDescription,
            affectedItems, and context.
        context: Optional batch-level context.
    """
    data: dict[str, Any] = {
        "type": AgentEventType.CONFIRMATION_BATCH_REQUIRED.value,
        "agentType": agent_type,
        "batchId": batch_id,
        "items": items,
    }
    if context is not None:
        data["context"] = context
    await publish_agent_event(
        case_id,
        AgentEventType.CONFIRMATION_BATCH_REQUIRED,
        data,
    )


async def emit_confirmation_batch_resolved(
    case_id: str,
    agent_type: str,
    batch_id: str,
    decisions: list[dict[str, Any]],
) -> None:
    """Emit a batch confirmation resolved event.

    Args:
        case_id: UUID string of the case.
        agent_type: Agent type whose batch was resolved.
        batch_id: Batch identifier.
        decisions: List of per-item decisions.
    """
    await publish_agent_event(
        case_id,
        AgentEventType.CONFIRMATION_BATCH_RESOLVED,
        {
            "type": AgentEventType.CONFIRMATION_BATCH_RESOLVED.value,
            "agentType": agent_type,
            "batchId": batch_id,
            "decisions": decisions,
        },
    )


async def emit_finding_committed(
    case_id: str,
    finding_id: str,
    agent_type: str,
    title: str,
) -> None:
    """Emit a finding-committed event when a CaseFinding is persisted.

    Fires after each finding is saved to case_findings, enabling the
    frontend to show real-time finding accumulation during pipeline execution.

    Args:
        case_id: UUID string of the case.
        finding_id: UUID string of the saved CaseFinding.
        agent_type: Domain agent type that produced the finding.
        title: Finding title for display.
    """
    await publish_agent_event(
        case_id,
        AgentEventType.FINDING_COMMITTED,
        {
            "type": AgentEventType.FINDING_COMMITTED.value,
            "findingId": finding_id,
            "agentType": agent_type,
            "title": title,
        },
    )


async def emit_kg_entity_added(
    case_id: str,
    entity_id: str,
    entity_name: str,
    entity_type: str,
) -> None:
    """Emit a kg-entity-added event when a KgEntity is created.

    Fires after each entity is persisted to the knowledge graph,
    enabling real-time graph visualization updates.

    Args:
        case_id: UUID string of the case.
        entity_id: UUID string of the created KgEntity.
        entity_name: Display name of the entity.
        entity_type: Domain-specific entity type.
    """
    await publish_agent_event(
        case_id,
        AgentEventType.KG_ENTITY_ADDED,
        {
            "type": AgentEventType.KG_ENTITY_ADDED.value,
            "entityId": entity_id,
            "entityName": entity_name,
            "entityType": entity_type,
        },
    )


async def emit_kg_relationship_added(
    case_id: str,
    relationship_id: str,
    source_entity_name: str,
    target_entity_name: str,
    relationship_type: str,
) -> None:
    """Emit a kg-relationship-added event when a KgRelationship is created.

    Fires after each relationship is persisted, enabling the frontend
    to animate new edges on the knowledge graph in real-time.

    Args:
        case_id: UUID string of the case.
        relationship_id: UUID string of the created KgRelationship.
        source_entity_name: Display name of the source entity.
        target_entity_name: Display name of the target entity.
        relationship_type: Type of the relationship edge.
    """
    await publish_agent_event(
        case_id,
        AgentEventType.KG_RELATIONSHIP_ADDED,
        {
            "type": AgentEventType.KG_RELATIONSHIP_ADDED.value,
            "relationshipId": relationship_id,
            "sourceEntityName": source_entity_name,
            "targetEntityName": target_entity_name,
            "relationshipType": relationship_type,
        },
    )


async def emit_synthesis_data_ready(
    case_id: str,
    counts: dict[str, int],
) -> None:
    """Emit synthesis-data-ready event after all synthesis data is committed to DB.

    Fires once after the Synthesis Agent writes all outputs (hypotheses,
    contradictions, gaps, timeline events, tasks, case summary, verdict).
    The frontend uses this to invalidate React Query caches and refetch
    all synthesis data.

    Args:
        case_id: UUID string of the case.
        counts: Dict with counts of written records (hypotheses, contradictions,
            gaps, timeline_events, tasks).
    """
    await publish_agent_event(
        case_id,
        AgentEventType.SYNTHESIS_DATA_READY,
        {
            "type": AgentEventType.SYNTHESIS_DATA_READY.value,
            "caseId": case_id,
            "counts": counts,
        },
    )


async def emit_geospatial_complete(
    case_id: str,
    counts: dict[str, int],
) -> None:
    """Emit geospatial-complete event after all geospatial data is committed to DB.

    Fires once after the Geospatial Agent writes all location outputs.
    The frontend uses this to invalidate React Query caches and refetch
    geospatial data.

    Args:
        case_id: UUID string of the case.
        counts: Dict with counts of written records (locations, paths, unmappable).
    """
    await publish_agent_event(
        case_id,
        AgentEventType.GEOSPATIAL_COMPLETE,
        {
            "type": AgentEventType.GEOSPATIAL_COMPLETE.value,
            "caseId": case_id,
            "counts": counts,
        },
    )


# ---------------------------------------------------------------------------
# Shared AgentResult builder
# ---------------------------------------------------------------------------


def build_execution_metadata(
    execution: AgentExecution,
    model_name: str,
) -> dict[str, Any]:
    """Build enriched metadata dict from an AgentExecution record.

    Single source of truth for execution metadata used by both live SSE
    events (pipeline emission) and snapshot reconstruction (sse.py).

    Args:
        execution: The completed AgentExecution database record.
        model_name: Model ID used for this agent.

    Returns:
        Dict with inputTokens, outputTokens, durationMs, startedAt,
        completedAt, model, and thinkingTraces.
    """
    from app.agents.parsing import format_thinking_traces

    duration_ms: int | None = None
    if execution.started_at and execution.completed_at:
        delta = execution.completed_at - execution.started_at
        duration_ms = int(delta.total_seconds() * 1000)

    return {
        "executionId": str(execution.id),
        "inputTokens": execution.input_tokens or 0,
        "outputTokens": execution.output_tokens or 0,
        "durationMs": duration_ms or 0,
        "startedAt": (
            execution.started_at.isoformat() if execution.started_at else None
        ),
        "completedAt": (
            execution.completed_at.isoformat() if execution.completed_at else None
        ),
        "model": model_name,
        "thinkingTraces": format_thinking_traces(execution.thinking_traces),
    }


def build_agent_result(
    execution: AgentExecution,
    metadata_dict: dict[str, Any],
) -> dict[str, Any] | None:
    """Construct a frontend-compatible AgentResult dict from an execution record.

    Single source of truth for AgentResult serialization used by both live
    SSE events (pipeline emission) and snapshot reconstruction (sse.py).

    Args:
        execution: AgentExecution record with output_data populated.
        metadata_dict: Pre-built metadata dict (tokens, duration, model, etc.).

    Returns:
        AgentResult-compatible dict, or None if no output_data exists.
    """
    output = execution.output_data
    if not output or not isinstance(output, dict):
        return None

    agent_name = execution.agent_name
    result: dict[str, Any] = {
        "taskId": "",
        "agentType": agent_name,
        "outputs": [],
        "metadata": metadata_dict,
    }

    if agent_name == "triage":
        file_results = output.get("file_results", [])
        groupings = output.get("suggested_groupings", [])
        result["outputs"] = [
            {
                "type": "triage-results",
                "data": {
                    "fileCount": (
                        len(file_results) if isinstance(file_results, list) else 0
                    ),
                    "groupings": (len(groupings) if isinstance(groupings, list) else 0),
                },
            }
        ]

    elif agent_name == "orchestrator":
        decisions = output.get("routing_decisions", [])
        result["outputs"] = [
            {
                "type": "routing-decisions",
                "data": {
                    "routingCount": (
                        len(decisions) if isinstance(decisions, list) else 0
                    ),
                    "parallelAgents": output.get("parallel_agents", []),
                    "researchTriggered": (output.get("research_trigger") or {}).get(
                        "should_trigger", False
                    ),
                },
            }
        ]
        # Convert snake_case routing decisions to camelCase for frontend.
        # Flatten to one card per (file, agent) pair with domain-specific scores.
        if isinstance(decisions, list):
            routing_decisions_camel: list[dict[str, Any]] = []
            for rd in decisions:
                if not isinstance(rd, dict):
                    continue
                target_agents = rd.get("target_agents", [])
                domain_scores = rd.get("domain_scores", {})
                for agent in target_agents:
                    score = domain_scores.get(agent, 0)
                    if not isinstance(score, (int, float)):
                        score = 0
                    routing_decisions_camel.append(
                        {
                            "fileId": rd.get("file_id", ""),
                            "fileName": rd.get("file_name", ""),
                            "targetAgent": agent,
                            "reason": rd.get("reasoning", ""),
                            "domainScore": score,
                            "priority": rd.get("priority", "medium"),
                            "routingConfidence": rd.get("routing_confidence"),
                        }
                    )
            result["routingDecisions"] = routing_decisions_camel

    elif agent_name == "strategy":
        findings = output.get("findings", [])
        result["outputs"] = [
            {
                "type": "strategy-findings",
                "data": {
                    "findingCount": (
                        len(findings) if isinstance(findings, list) else 0
                    ),
                },
            }
        ]

    else:
        # Domain agents (legal, evidence)
        findings = output.get("findings", [])
        entities = output.get("entities", [])
        # Extract group label and file names from input_data
        group_label = "default"
        file_names: list[str] = []
        if execution.input_data and isinstance(execution.input_data, dict):
            raw_suffix = execution.input_data.get("stage_suffix", "")
            group_label = (
                raw_suffix.lstrip("_") if isinstance(raw_suffix, str) else "default"
            ) or "default"
            raw_names = execution.input_data.get("file_names", [])
            if isinstance(raw_names, list):
                file_names = [str(n) for n in raw_names]

        result["baseAgentType"] = agent_name
        result["groupLabel"] = group_label
        result["fileNames"] = file_names
        result["outputs"] = [
            {
                "type": f"{agent_name}-findings",
                "data": {
                    "findingCount": (
                        len(findings) if isinstance(findings, list) else 0
                    ),
                    "entityCount": (len(entities) if isinstance(entities, list) else 0),
                    "groupLabel": group_label,
                },
            }
        ]

    return result
