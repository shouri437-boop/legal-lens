# Phase 5: Agent Flow - Research

**Researched:** 2026-02-04
**Domain:** Real-time agent execution visualization, SSE streaming, HITL confirmation
**Confidence:** HIGH

## Summary

Phase 5 connects the existing frontend Command Center visualization (ReactFlow decision tree, sidebar, SSE hook, mock data from Phase 4.1) to real backend agent data. The frontend is complete and well-structured. The backend has a working SSE infrastructure (pub/sub, heartbeat, agent event types) and a working analysis pipeline (triage + orchestrator). The gap is in the **richness and real-time granularity** of the SSE events being emitted, plus new capabilities: thinking trace streaming, token usage reporting, HITL confirmation, and execution timeline data.

This research analyzed every file in the existing pipeline chain: `agents.py` (pipeline orchestration) -> `agent_events.py` (pub/sub) -> `sse.py` (SSE endpoint) -> `useCommandCenterSSE.ts` (frontend hook) -> `useAgentStates.ts` (state management) -> `command-center.ts` (types) -> `NodeDetailsSidebar.tsx` (display). The gaps are precisely identified.

**Primary recommendation:** Enhance the existing SSE event payloads to include thinking traces, token usage, and timing data. Add new event types (THINKING_UPDATE, AGENT_ERROR, PIPELINE_COMPLETE). Implement HITL via `asyncio.Event` pause/resume pattern (not ADK tool confirmation, which does not work with DatabaseSessionService). Build a state snapshot endpoint for reconnection.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `sse-starlette` | installed | SSE endpoint serving | EXISTING |
| `google-adk` | >=1.2.0 | Agent framework, callbacks | EXISTING |
| `fastapi` | installed | API framework | EXISTING |
| `@xyflow/react` | 12.x | ReactFlow canvas | EXISTING |
| `motion` | 12.x | Node animations | EXISTING |

### No New Libraries Required

This phase requires **zero new dependencies**. All work is:
- Enriching existing SSE event payloads (backend)
- Adding new SSE event types to existing infrastructure (backend)
- Adding new event handlers to existing hooks (frontend)
- New UI components for HITL modal and execution timeline (frontend)
- Wiring real data into existing sidebar sections (frontend)

## Architecture Patterns

### Existing Architecture (Verified from Codebase)

```
Pipeline Orchestration (agents.py)
    |
    |- run_triage() -> emit_agent_started/complete/error
    |- run_orchestrator() -> emit_agent_started/complete/error
    |- emit_processing_complete()
    |
Agent Event Pub/Sub (agent_events.py)
    |
    |- publish_agent_event() -> Queue per subscriber
    |- subscribe_to_agent_events() / unsubscribe_from_agent_events()
    |
SSE Endpoint (sse.py)
    |
    |- /sse/cases/{case_id}/command-center/stream
    |- command_center_generator() -> EventSourceResponse
    |- 15s heartbeat
    |
Frontend Hook (useCommandCenterSSE.ts)
    |
    |- EventSource -> /api/cases/{caseId}/command-center/stream
    |- Named event listeners: agent-started, agent-complete, agent-error, processing-complete
    |- Reconnect with exponential backoff (max 5 attempts)
    |
State Management (useAgentStates.ts)
    |
    |- Map<AgentType, AgentState>
    |- Demo mode fallback after 3s if no SSE connection
```

### Pattern 1: Enriched SSE Event Payloads

**What:** Extend existing `emit_agent_*` functions to include richer data (thinking traces, tokens, timing).

**Current `emit_agent_complete` payload:**
```python
{
    "type": "agent-complete",
    "agentType": "triage",
    "taskId": "uuid",
    "result": {
        "taskId": "uuid",
        "agentType": "triage",
        "outputs": [{"type": "triage-results", "data": {...}}],
        "routingDecisions": [...]
    }
}
```

**Enhanced payload (Phase 5):**
```python
{
    "type": "agent-complete",
    "agentType": "triage",
    "taskId": "uuid",
    "result": {
        "taskId": "uuid",
        "agentType": "triage",
        "outputs": [{"type": "triage-results", "data": {...}}],
        "routingDecisions": [...],
        "toolsCalled": ["file_analyzer"],
        "metadata": {
            "thinkingTraces": "Full thinking text...",
            "inputTokens": 15420,
            "outputTokens": 3200,
            "thoughtsTokens": 4800,
            "durationMs": 3200,
            "startedAt": "2026-02-04T10:00:00Z",
            "completedAt": "2026-02-04T10:00:03.2Z",
            "model": "gemini-3-flash-preview"
        }
    }
}
```

### Pattern 2: Real-Time Thinking Trace Streaming

**What:** Stream thinking traces as they are generated, not after agent completion.

**Decision from CONTEXT.md:** "Stream thinking traces live in real-time as agents think (not after completion)" with dedicated `THINKING_UPDATE` SSE event type.

**Implementation approach:** The `after_model_callback` in `base.py` receives `LlmResponse` which contains `content.parts` where parts with `part.thought == True` contain thinking text. Currently the callback only fires a minimal event. It must be enhanced to extract and stream thinking text.

```python
# In base.py after_model callback
def after_model(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> LlmResponse | None:
    # Extract thinking traces from response parts
    thinking_parts = []
    if llm_response and llm_response.content and llm_response.content.parts:
        for part in llm_response.content.parts:
            if hasattr(part, 'thought') and part.thought and part.text:
                thinking_parts.append(part.text)

    if thinking_parts:
        _fire("THINKING_UPDATE", {
            "case_id": case_id,
            "agent_name": callback_context.agent_name,
            "timestamp": _now(),
            "thought": "\n".join(thinking_parts),
        })
    return None
```

**Key insight:** The `after_model_callback` fires on EACH model turn (including retries/multi-turn). For agents with `include_thoughts=True`, thinking parts appear in `llm_response.content.parts` where `part.thought == True`. This is already how `extract_thinking_traces()` in `parsing.py` works -- it checks `part.thought and part.text`.

**Confidence:** HIGH -- verified from both ADK docs and existing `parsing.py` code.

### Pattern 3: HITL Confirmation via asyncio.Event

**What:** Pause agent pipeline execution waiting for user confirmation, without using ADK's `require_confirmation` (which does not work with DatabaseSessionService).

**Decision from CONTEXT.md:** "Agent waits indefinitely for user response -- no timeout, pipeline stays paused."

**Implementation:**

```python
# Confirmation request stored in memory, keyed by request_id
_pending_confirmations: dict[str, asyncio.Event] = {}
_confirmation_results: dict[str, dict] = {}

async def request_confirmation(
    case_id: str,
    request_id: str,
    action_description: str,
    affected_items: list[str],
) -> dict:
    """Pause pipeline and wait for user confirmation via API."""
    event = asyncio.Event()
    _pending_confirmations[request_id] = event

    # Emit SSE event to frontend
    await emit_confirmation_required(case_id, request_id, action_description, affected_items)

    # Block until user responds (no timeout per CONTEXT.md)
    await event.wait()

    # Retrieve result and clean up
    result = _confirmation_results.pop(request_id, {"approved": False})
    _pending_confirmations.pop(request_id, None)
    return result

# API endpoint for user response
@router.post("/api/cases/{case_id}/confirmations/{request_id}")
async def respond_to_confirmation(case_id, request_id, body: ConfirmationResponse):
    if request_id in _pending_confirmations:
        _confirmation_results[request_id] = body.model_dump()
        _pending_confirmations[request_id].set()  # Unblock the waiting coroutine
```

**Why this works:** The pipeline runs as a background task (`run_analysis_workflow` in `agents.py`). Within that task, `await event.wait()` pauses the coroutine without blocking the event loop. The FastAPI endpoint can still handle the confirmation POST request, which sets the event and unblocks the pipeline.

**Confidence:** HIGH -- standard asyncio pattern, no ADK dependency.

### Pattern 4: State Snapshot for Reconnection

**What:** On SSE reconnect, send full state snapshot instead of replaying events.

**Decision from CONTEXT.md:** "On reconnect: backend sends full state snapshot of all agents' current status (no sequence-based replay)."

**Implementation:** When a new subscriber connects to the command center SSE endpoint, immediately send a `STATE_SNAPSHOT` event containing the current status of all agents for this case, derived from `agent_executions` table.

```python
async def command_center_generator(case_id: str):
    queue = subscribe_to_agent_events(case_id)

    # Send initial state snapshot
    snapshot = await build_state_snapshot(case_id)
    yield {"event": "state-snapshot", "data": json.dumps(snapshot)}

    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield event
            except TimeoutError:
                yield {"event": "heartbeat", "data": "ping"}
    finally:
        unsubscribe_from_agent_events(case_id, queue)
```

### Pattern 5: SSE URL Mismatch Resolution

**Critical finding:** The frontend hook connects to `/api/cases/${caseId}/command-center/stream` but the backend endpoint is at `/sse/cases/${case_id}/command-center/stream`. There is NO Next.js rewrite/proxy configured in `next.config.ts`.

This means the SSE connection currently fails silently (which is why the frontend falls back to demo mode after 3 seconds). For local development, the frontend uses `NEXT_PUBLIC_API_URL` for REST API calls (defaulting to `http://localhost:8080`), but the EventSource in `useCommandCenterSSE.ts` uses a **relative URL** (`/api/cases/${caseId}/command-center/stream`) which hits the Next.js server, not the backend.

**Resolution options:**
1. Add Next.js rewrites to proxy `/api/cases/*/command-center/stream` to the backend `/sse/` path
2. Update the frontend SSE hook to use `NEXT_PUBLIC_API_URL` + correct backend path
3. Add Next.js rewrites for all `/sse/` paths

**Recommendation:** Option 2 -- update the SSE hook to use the full backend URL. This matches the pattern used by REST API calls (`files.ts`, `api-client.ts`) and avoids SSE-specific proxy issues with Next.js.

**Confidence:** HIGH -- verified by reading both files.

### Anti-Patterns to Avoid

- **Don't replay individual events on reconnect:** State snapshot is simpler and more reliable (CONTEXT.md decision)
- **Don't use ADK `require_confirmation`:** Does not work with DatabaseSessionService (official ADK limitation, verified)
- **Don't stream thinking traces after completion:** CONTEXT.md requires real-time streaming during agent thinking
- **Don't buffer thinking traces:** Stream immediately as `after_model_callback` fires
- **Don't add timeout to HITL confirmation:** CONTEXT.md says "Agent waits indefinitely"

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE transport | Custom WebSocket | Existing `sse-starlette` + `EventSourceResponse` | Already working, proven pattern |
| Pub/sub | Redis, external queue | Existing in-memory `asyncio.Queue` per subscriber | Single-instance hackathon deployment |
| Agent state derivation | Custom state machine | Query `agent_executions` table | Existing model has all fields needed |
| Thinking trace extraction | Custom parsing | Existing `extract_thinking_traces()` in `parsing.py` | Already handles `part.thought` check |
| Token usage extraction | Custom counting | Existing `extract_token_usage()` in `parsing.py` | Already accumulates `usage_metadata` |
| Event validation | Custom validator | Existing `command-center-validation.ts` | Already validates all event types |
| Execution timeline UI | Custom chart library | Simple CSS/HTML Gantt bars | Small dataset (5-8 agents), no library needed |

## Common Pitfalls

### Pitfall 1: SSE URL Mismatch
**What goes wrong:** Frontend SSE hook uses relative URL `/api/cases/...` which hits Next.js, not backend at `/sse/cases/...`
**Why it happens:** Different URL conventions between REST API calls (full URL via NEXT_PUBLIC_API_URL) and SSE hook (relative path)
**How to avoid:** Update `useCommandCenterSSE.ts` to construct full URL from `NEXT_PUBLIC_API_URL` + `/sse/cases/...`
**Warning signs:** SSE connection fails silently, demo mode activates after 3s

### Pitfall 2: Callback publish_fn Not Wired
**What goes wrong:** ADK callbacks exist in `base.py` but `publish_fn` is never passed during pipeline execution
**Why it happens:** In `agents.py`, `run_triage()` and `run_orchestrator()` are called without `publish_event` parameter
**How to avoid:** Pass a bound publish function that calls `publish_agent_event()` from `agent_events.py`
**Warning signs:** No real-time THINKING_UPDATE or AGENT_SPAWNED events during processing

### Pitfall 3: Thinking Traces Capped at 2000 chars in Storage
**What goes wrong:** `extract_thinking_traces()` in `parsing.py` caps individual thoughts at 2000 chars. CONTEXT.md says "Show full unfiltered thinking output"
**Why it happens:** STATE.md decision: "Thinking trace storage capped at 2000 chars in execution records"
**How to avoid:** Stream full thinking via SSE (no cap). The 2000 char cap is only for database storage in `agent_executions.thinking_traces`. The SSE stream should send full text.
**Warning signs:** Truncated thinking traces in sidebar

### Pitfall 4: Agent Complete Event Sets Status to "idle"
**What goes wrong:** In `useAgentStates.ts`, `handleAgentComplete` sets agent status to `"idle"`, not `"complete"`. This means completed agents don't render as "active" on the chosen path.
**Why it happens:** The mock data workaround sets completed agents to "idle" with a `lastResult`. The `isAgentActive()` function in `command-center-graph.ts` handles this: `state.status === "idle" && state.lastResult !== undefined` counts as active.
**How to avoid:** This is actually intentional design -- "idle" means "not currently processing" and `lastResult` presence indicates completion. Keep this pattern. The `isAgentActive()` predicate correctly handles it.
**Warning signs:** None -- this is working as designed.

### Pitfall 5: No `THINKING_UPDATE` Event Handler in Frontend
**What goes wrong:** The SSE hook only listens for `agent-started`, `agent-complete`, `agent-error`, `processing-complete`. No handler for `thinking-update`.
**Why it happens:** The backend `AgentEventType` enum includes `THINKING_UPDATE = "thinking-update"` but the frontend hook doesn't listen for it.
**How to avoid:** Add `thinking-update` event listener to `useCommandCenterSSE.ts` and handler to `useAgentStates.ts` that appends to a thinking trace buffer in agent state.
**Warning signs:** No real-time thinking display even when backend sends events

### Pitfall 6: Confirmation Pending Notification on Other Pages
**What goes wrong:** User navigates away from Command Center while HITL confirmation is pending
**Why it happens:** Confirmation events only visible on Command Center page
**How to avoid:** CONTEXT.md requires "Visual notification badge/pulse on Command Center tab/nav item when confirmation is pending and user is on another page". Implement via case-level state (zustand store or similar) that persists across page navigation.
**Warning signs:** User misses confirmation request, pipeline hangs

### Pitfall 7: Frontend Type Mismatch for New Event Types
**What goes wrong:** New SSE events (THINKING_UPDATE, CONFIRMATION_REQUIRED, STATE_SNAPSHOT, PIPELINE_COMPLETE) fail validation
**Why it happens:** `command-center-validation.ts` has strict type checking with `switch` on `event.type`
**How to avoid:** Update `CommandCenterSSEEvent` union type, add validators for each new event type, add event listeners in SSE hook
**Warning signs:** Events logged as "Unknown event type" in console

## Code Examples

### Backend: Enhanced agent-complete Event Emission

```python
# In agents.py run_analysis_workflow(), after triage completes:
await emit_agent_complete(
    case_id=case_id,
    agent_type="triage",
    task_id=triage_task_id,
    result={
        "taskId": triage_task_id,
        "agentType": "triage",
        "outputs": [
            {
                "type": "triage-results",
                "data": {
                    "fileCount": len(triage_output.file_results),
                    "groupings": len(triage_output.suggested_groupings),
                },
            }
        ],
        # NEW: Token usage from execution record
        "metadata": {
            "inputTokens": execution.input_tokens,
            "outputTokens": execution.output_tokens,
            "durationMs": int(duration_s * 1000) if duration_s else None,
            "startedAt": execution.started_at.isoformat() if execution.started_at else None,
            "completedAt": execution.completed_at.isoformat() if execution.completed_at else None,
            "model": settings.gemini_flash_model,
            "thinkingTraces": "\n\n".join(
                t["thought"] for t in (execution.thinking_traces or [])
            ),
        },
    },
)
```

### Backend: Wiring publish_fn into Agent Callbacks

```python
# In agents.py, create a publish function for the pipeline
from app.services.agent_events import publish_agent_event, AgentEventType

async def _create_publish_fn(case_id: str):
    """Create a bound publish function for agent callbacks."""
    async def publish(event_type: str, data: dict[str, object]) -> None:
        # Map internal callback event types to SSE event types
        type_map = {
            "AGENT_SPAWNED": AgentEventType.AGENT_STARTED,
            "AGENT_COMPLETED": AgentEventType.AGENT_COMPLETE,
            "THINKING_UPDATE": AgentEventType.THINKING_UPDATE,
            "TOOL_CALLED": AgentEventType.TOOL_CALLED,
        }
        sse_type = type_map.get(event_type)
        if sse_type:
            await publish_agent_event(case_id, sse_type, data)
    return publish
```

### Frontend: New Thinking Update Handler

```typescript
// In useCommandCenterSSE.ts, add new event listener:
eventSource.addEventListener("thinking-update", (e) => {
  const data = JSON.parse(e.data);
  onThinkingUpdate?.(data);
});

// In useAgentStates.ts, accumulate thinking traces:
const handleThinkingUpdate = useCallback((data: ThinkingUpdateEvent) => {
  setAgentStates((prev) => {
    const next = new Map(prev);
    const agentType = data.agentType as AgentType;
    const state = next.get(agentType);
    if (state) {
      const existingTraces = (state.lastResult?.metadata?.thinkingTraces as string) || "";
      next.set(agentType, {
        ...state,
        // Append to thinking buffer for real-time display
        lastResult: {
          ...(state.lastResult || { taskId: "", agentType, outputs: [] }),
          metadata: {
            ...(state.lastResult?.metadata || {}),
            thinkingTraces: existingTraces + "\n" + data.thought,
          },
        },
      });
    }
    return next;
  });
}, []);
```

### Frontend: HITL Confirmation Modal Pattern

```typescript
// New SSE event type
interface ConfirmationRequiredEvent {
  type: "confirmation-required";
  requestId: string;
  agentType: AgentType;
  actionDescription: string;
  affectedItems: string[];
  context: Record<string, unknown>;
}

// API call to respond
async function respondToConfirmation(
  caseId: string,
  requestId: string,
  approved: boolean,
  reason?: string
) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  await fetch(`${API_URL}/api/cases/${caseId}/confirmations/${requestId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved, reason }),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ADK `require_confirmation` for HITL | Frontend-driven confirmation via REST API + asyncio.Event | Phase 4 (discovery) | DatabaseSessionService limitation makes ADK HITL unusable |
| D3-based agent canvas | @xyflow/react + dagre | Phase 4.1 | ReactFlow canvas is the display target |
| Manual positions | Dagre auto-layout | Phase 4.1 | Nodes auto-positioned by layout engine |

**ADK Callback Status:**
- `after_model_callback` can extract thinking parts via `llm_response.content.parts` where `part.thought == True` (HIGH confidence, verified in ADK docs and codebase)
- Token usage available via `event.usage_metadata` with `prompt_token_count`, `candidates_token_count`, `thoughts_token_count` fields (HIGH confidence)
- ADK tool confirmation does NOT work with `DatabaseSessionService` (HIGH confidence, official docs)
- Known ADK bug: HITL does not pause custom agent pipelines properly (Issue #3184) -- irrelevant since we use frontend-driven approach

## Open Questions

1. **Execution Timeline Gantt Chart Implementation**
   - What we know: CONTEXT.md requires "Gantt-style execution timeline in sidebar showing agent execution overlap to visualize parallelism"
   - What's unclear: Since only triage and orchestrator exist (sequential), there's no parallelism to visualize yet. Domain agents (Phase 6) will run in parallel.
   - Recommendation: Build the Gantt component with the data structure that supports parallel agents, but current display will show sequential triage -> orchestrator. It will become useful when domain agents are added in Phase 6.

2. **Notification Badge for HITL on Other Pages**
   - What we know: CONTEXT.md requires visual notification on Command Center tab when confirmation pending
   - What's unclear: The tab bar component (`expandable-tabs.tsx`) and case layout (`layout.tsx`) architecture for cross-page state
   - Recommendation: Use a lightweight in-memory store (React context or small zustand store at layout level) to track pending confirmations, render badge on tab

3. **File Routing Data in SSE Events**
   - What we know: CONTEXT.md says "Include file routing data in SSE events -- which files routed to which agents, so FileRoutingEdge populates dynamically"
   - What's unclear: The orchestrator already includes routing in the `agent-complete` result. Is this sufficient or do we need a separate event?
   - Recommendation: The existing `agent-complete` event for orchestrator already contains `routingDecisions`. The `command-center-graph.ts` already extracts `file_routing` from `orchState.lastResult.metadata`. Enrich this metadata from real orchestrator output. No separate event needed.

## Key Gaps to Fill (Backend -> Frontend Data Flow)

| Data | Backend Source | Current SSE Status | Frontend Consumer | Gap |
|------|---------------|-------------------|-------------------|-----|
| Agent lifecycle (spawned/complete/error) | `agents.py` emit functions | Working but coarse | `useAgentStates.ts` | Needs real-time callback events, not just pipeline-level |
| Thinking traces (real-time) | `after_model_callback` in `base.py` | Callback exists but publish_fn not wired | `NodeDetailsSidebar.tsx` Thinking section | Wire publish_fn, add SSE event type, add frontend handler |
| Thinking traces (stored) | `agent_executions.thinking_traces` | Stored but not in SSE payload | `NodeDetailsSidebar.tsx` | Include in agent-complete result metadata |
| Token usage (per-agent) | `agent_executions.input_tokens/output_tokens` | Stored but not in SSE payload | New UI in sidebar | Include in agent-complete result metadata |
| Duration (per-agent) | `agent_executions.started_at/completed_at` | Timestamps stored | `DecisionNode.tsx` badge + sidebar | Include in agent-complete, compute duration |
| File routing | `OrchestratorOutput.routing_decisions` | In agent-complete result | `FileRoutingEdge.tsx`, `command-center-graph.ts` | Already structured, just needs real data |
| HITL confirmation | Not implemented | Not implemented | Not implemented | Full implementation needed |
| Connection status | SSE `onerror`/`onopen` | Working | `CommandCenter.tsx` header | Working, no change needed |
| Heartbeat | 15s in `sse.py` | Working | Implicit (keeps connection alive) | Working, within CONTEXT.md range (15-30s) |
| State snapshot | Not implemented | Not implemented | Not implemented | Full implementation needed for reconnect |
| Pipeline complete | `emit_processing_complete()` | Working | `useAgentStates.ts` | Needs enrichment with total tokens and duration |

## Sources

### Primary (HIGH confidence)
- Codebase files read directly: `agents.py`, `agent_events.py`, `sse.py`, `base.py`, `factory.py`, `triage.py`, `orchestrator.py`, `parsing.py`, `adk_service.py`, `agent_execution.py`, `agent.py` (schemas), `useCommandCenterSSE.ts`, `useAgentStates.ts`, `command-center.ts`, `command-center-config.ts`, `command-center-graph.ts`, `command-center-validation.ts`, `NodeDetailsSidebar.tsx`, `DecisionNode.tsx`, `mock-command-center-data.ts`, `next.config.ts`
- [ADK Callback Types Documentation](https://google.github.io/adk-docs/callbacks/types-of-callbacks/) -- Callback signatures and data availability
- [ADK Tool Confirmation Documentation](https://google.github.io/adk-docs/tools-custom/confirmation/) -- Confirms DatabaseSessionService incompatibility

### Secondary (MEDIUM confidence)
- [ADK Token Usage Discussion](https://github.com/google/adk-python/discussions/97) -- `event.usage_metadata` field details
- [ADK HITL Bug Report](https://github.com/google/adk-python/issues/3184) -- Confirms custom agent HITL does not pause properly
- [ADK Thinking Traces Issue](https://github.com/google/adk-python/issues/354) -- Confirms `part.thought` field for thinking extraction
- [ADK Events Documentation](https://google.github.io/adk-docs/events/) -- Event structure and lifecycle

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing code verified
- Architecture: HIGH -- all patterns verified against existing codebase
- Pitfalls: HIGH -- every pitfall identified by reading actual source code
- HITL pattern: HIGH -- asyncio.Event is standard Python, ADK limitation verified in official docs
- Thinking trace extraction: HIGH -- verified in both ADK docs and existing `parsing.py`

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (stable -- all based on existing codebase patterns)
