---
phase: 05-agent-flow
plan: 01
subsystem: api
tags: [sse, gemini, thinking-traces, token-usage, agent-callbacks, reconnection]

# Dependency graph
requires:
  - phase: 04-core-agent
    provides: "ADK agent callbacks, triage/orchestrator agents, agent_executions table, SSE pub/sub"
provides:
  - "Real-time THINKING_UPDATE SSE events with full untruncated thinking text"
  - "Enriched agent-complete events with inputTokens, outputTokens, durationMs, model, thinkingTraces"
  - "Enriched pipeline-complete events with totalDurationMs, totalInputTokens, totalOutputTokens"
  - "State snapshot on SSE reconnect (build_state_snapshot)"
  - "HITL event types: CONFIRMATION_REQUIRED, CONFIRMATION_RESOLVED"
  - "create_sse_publish_fn() factory for wiring callbacks to SSE pub/sub"
affects:
  - 05-agent-flow (plans 02-04 build on these enriched events)
  - 06-domain-agents (domain agents will use same callback/publish pattern)
  - frontend command-center (consumes enriched SSE events)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TypeAlias for cross-module callable type sharing (PublishFn)"
    - "after_model_callback extracts part.thought for real-time streaming"
    - "State snapshot on SSE connect for reconnection resilience"
    - "_build_execution_metadata() helper for consistent metadata extraction"

key-files:
  created: []
  modified:
    - "backend/app/agents/base.py"
    - "backend/app/services/agent_events.py"
    - "backend/app/api/agents.py"
    - "backend/app/api/sse.py"
    - "backend/app/agents/triage.py"
    - "backend/app/agents/orchestrator.py"

key-decisions:
  - "PublishFn uses TypeAlias (not type keyword) for Pyright compatibility across modules"
  - "Thinking traces sent as full untruncated text via SSE (truncation only for DB storage in parsing.py)"
  - "Token delta included in THINKING_UPDATE events when usage_metadata present on LlmResponse"
  - "State snapshot queries most recent workflow for case, not all workflows"
  - "Unified PublishFn type across base/triage/orchestrator (removed duplicate PublishEventFn)"

patterns-established:
  - "create_sse_publish_fn(case_id) factory: lazy event type mapping, deferred imports to avoid circular deps"
  - "_build_execution_metadata(execution, model_name) -> dict: consistent metadata extraction from AgentExecution"
  - "build_state_snapshot(case_id): query-based snapshot for SSE reconnection, sent before event loop"

# Metrics
duration: 10min
completed: 2026-02-04
---

# Phase 5 Plan 01: SSE Event Enrichment Summary

**Real-time thinking trace streaming via after_model_callback, enriched agent-complete/pipeline-complete metadata (tokens, duration, model), and state snapshot on SSE reconnect**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-04T06:09:50Z
- **Completed:** 2026-02-04T06:20:04Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- after_model_callback extracts thinking parts (part.thought==True) and fires THINKING_UPDATE with full untruncated text in real-time
- Agent-complete SSE events for triage and orchestrator include enriched metadata: inputTokens, outputTokens, durationMs, startedAt, completedAt, model, thinkingTraces
- Pipeline-complete SSE event includes totalDurationMs, totalInputTokens, totalOutputTokens
- SSE command-center stream sends state-snapshot immediately on connect for reconnection resilience
- New event types and emitters for HITL system: CONFIRMATION_REQUIRED, CONFIRMATION_RESOLVED

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrich agent callbacks and add real-time thinking trace streaming** - `2a21d90` (feat)
2. **Task 2: Enrich pipeline SSE events and add state snapshot on reconnect** - `167e521` (feat)

## Files Created/Modified
- `backend/app/agents/base.py` - Enhanced after_model_callback with thinking extraction, added create_sse_publish_fn() factory, unified PublishFn TypeAlias
- `backend/app/services/agent_events.py` - Added STATE_SNAPSHOT, CONFIRMATION_REQUIRED, CONFIRMATION_RESOLVED event types; emit_thinking_update(), emit_confirmation_required(), emit_confirmation_resolved() emitters; enriched emit_processing_complete() with totals
- `backend/app/api/agents.py` - Wired publish_fn to run_triage/run_orchestrator, enriched agent-complete events with _build_execution_metadata(), enriched pipeline-complete with aggregate token/duration totals
- `backend/app/api/sse.py` - Added build_state_snapshot() for reconnection, command_center_generator sends state-snapshot on connect
- `backend/app/agents/triage.py` - Replaced local PublishEventFn with PublishFn from base
- `backend/app/agents/orchestrator.py` - Replaced local PublishEventFn with PublishFn from base

## Decisions Made
- **PublishFn as TypeAlias:** Used `TypeAlias` annotation instead of `type` keyword for Pyright compatibility when importing across modules with `from __future__ import annotations`
- **Full thinking text in SSE:** THINKING_UPDATE events carry full untruncated text (CONTEXT.md: "Show full unfiltered thinking output"); the 2000-char cap in parsing.py only applies to database storage
- **Unified type alias:** Removed duplicate `PublishEventFn` from triage.py and orchestrator.py, using canonical `PublishFn` from base.py
- **State snapshot scope:** build_state_snapshot queries only the most recent workflow for a case, not all historical workflows

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed type incompatibility between PublishFn and PublishEventFn**
- **Found during:** Task 2
- **Issue:** `create_sse_publish_fn()` returned `PublishFn` (Awaitable) but run_triage/run_orchestrator expected `PublishEventFn` (Coroutine). Types were semantically compatible but statically incompatible.
- **Fix:** Removed duplicate `PublishEventFn` from triage.py and orchestrator.py, replaced with canonical `PublishFn` from base.py. Used TypeAlias annotation for Pyright compatibility.
- **Files modified:** backend/app/agents/base.py, backend/app/agents/triage.py, backend/app/agents/orchestrator.py
- **Verification:** ruff lint + py_compile + runtime import all pass
- **Committed in:** 167e521 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Type unification was necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Enriched SSE events ready for frontend consumption (Command Center already built in Phase 4.1)
- CONFIRMATION_REQUIRED/RESOLVED event types ready for HITL system (Plan 02)
- State snapshot pattern established for all future SSE endpoints
- create_sse_publish_fn() pattern ready for domain agents (Phase 6)

---
*Phase: 05-agent-flow*
*Completed: 2026-02-04*
