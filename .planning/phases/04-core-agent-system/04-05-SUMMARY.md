---
phase: 04-core-agent-system
plan: 05
subsystem: api
tags: [sse, fastapi, agent-events, background-tasks, pub-sub]

# Dependency graph
requires:
  - phase: 04-02
    provides: AgentExecution model and schemas for audit trail
  - phase: 04-03
    provides: Triage agent run_triage function
  - phase: 04-04
    provides: Orchestrator agent run_orchestrator function
provides:
  - Agent event publishing service with typed SSE events
  - Command center SSE endpoint for real-time agent visualization
  - Analysis start API endpoint (POST /api/cases/{case_id}/analyze)
  - Analysis status API endpoint (GET /api/cases/{case_id}/analysis/{workflow_id})
  - Background analysis pipeline orchestrating triage -> orchestrator stages
affects: [05-agent-flow-frontend, 06-domain-agents, 07-synthesis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-memory pub/sub with asyncio.Queue for SSE agent events"
    - "Background task pipeline with stage-isolated agent execution"
    - "Typed event enums matching frontend CommandCenterSSEEvent union"

key-files:
  created:
    - backend/app/services/agent_events.py
    - backend/app/api/agents.py
  modified:
    - backend/app/services/__init__.py
    - backend/app/api/sse.py
    - backend/app/main.py

key-decisions:
  - "Used same in-memory pub/sub pattern as file events (asyncio.Queue + defaultdict)"
  - "Background task creates its own DB session to avoid FastAPI dependency lifecycle"
  - "Pipeline status derived from execution records rather than separate status table"
  - "Extra event types (thinking-update, tool-called) included for future extensibility"

patterns-established:
  - "Agent event pub/sub: subscribe_to_agent_events / unsubscribe_from_agent_events per case"
  - "Background pipeline: run_analysis_workflow with stage-isolated agent invocations"
  - "Convenience emitters: emit_agent_started/complete/error/processing_complete"

# Metrics
duration: 12min
completed: 2026-02-03
---

# Phase 4 Plan 05: Agent API & SSE Integration Summary

**Agent execution API with background analysis pipeline, SSE event publishing, and command center streaming endpoint**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-03T05:52:10Z
- **Completed:** 2026-02-03T06:04:10Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Agent event publishing service with 6 typed events matching frontend CommandCenterSSEEvent
- Command center SSE endpoint at /sse/cases/{case_id}/command-center/stream with heartbeat
- Analysis API: POST to start workflow, GET to check status with triage/orchestrator results
- Background pipeline orchestrating triage -> orchestrator with file status transitions
- SSE events emitted at each stage: agent-started, agent-complete, agent-error, processing-complete

## Task Commits

Each task was committed atomically:

1. **Task 1: Create agent event publishing service** - `9af1c44` (feat)
2. **Task 2: Add command center SSE endpoint** - `30c944f` (feat)
3. **Task 3: Create agent execution API endpoints** - `d70e647` (feat)

## Files Created/Modified
- `backend/app/services/agent_events.py` - Agent event pub/sub with typed events and convenience emitters
- `backend/app/api/agents.py` - Start analysis and status endpoints with background pipeline
- `backend/app/api/sse.py` - Command center SSE endpoint added alongside existing file events
- `backend/app/services/__init__.py` - Exports for agent event functions
- `backend/app/main.py` - Agents router registered

## Decisions Made
- Used same in-memory pub/sub pattern (asyncio.Queue) as file events for consistency
- Background task creates its own DB session factory to work outside FastAPI request lifecycle
- Pipeline status is derived from execution records (no separate workflow status table)
- Added thinking-update and tool-called event types beyond what frontend currently uses, for extensibility
- File status transitions follow the 6-state lifecycle: UPLOADED -> QUEUED -> PROCESSING -> ANALYZED/ERROR

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 backend is complete: ADK infrastructure, triage, orchestrator, and API integration
- Frontend command center can now connect to /sse/cases/{case_id}/command-center/stream
- Frontend can POST to /api/cases/{case_id}/analyze to start workflows
- Domain agents (Phase 6) will plug into the background pipeline's domain_agents stage
- Synthesis agent (Phase 7) will add a final pipeline stage

---
*Phase: 04-core-agent-system*
*Completed: 2026-02-03*
