---
phase: 06-domain-agents
plan: 05
subsystem: api
tags: [pipeline, sse, domain-agents, strategy, hitl, confirmation, parallel]

# Dependency graph
requires:
  - phase: 06-domain-agents (plans 01-04)
    provides: Domain schemas, factory, prompts, domain runners, strategy agent
  - phase: 05-agent-flow
    provides: SSE pipeline, HITL confirmation service, agent events pub/sub
provides:
  - Full end-to-end pipeline: Triage -> Orchestrator -> Parallel Domain -> Strategy -> HITL -> Complete
  - SSE events with compound identifiers for multi-instance domain agents
  - emit_agent_fallback helper for fallback warning events
  - Status endpoint with domain_results_summary and domain_analysis stage
affects: [07-synthesis, 08-intelligence, 11-refinement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compound SSE identifiers ({agent_type}_{group_label}) for multi-instance agents"
    - "compute_agent_tasks as single source of truth for SSE pre-emission"
    - "Pipeline-level vs partial failure distinction in status endpoint"

key-files:
  created: []
  modified:
    - backend/app/api/agents.py
    - backend/app/services/agent_events.py

key-decisions:
  - "SSE pre-emission uses compute_agent_tasks from domain_runner (no duplicated iteration logic)"
  - "Pipeline-level failures distinguished from partial domain agent failures in status"
  - "Strategy completion marks pipeline complete (replaces orchestrator as terminal stage)"
  - "Backward compatible: orchestrator-complete without domain agents still shows complete"

patterns-established:
  - "Compound identifier pattern: {agent_type}_{group_label} for multi-instance SSE events"
  - "Sequential strategy after parallel domain agents pattern"
  - "HITL iteration over multi-result structure (dict[str, list[tuple[result, label]]])"

# Metrics
duration: 5min
completed: 2026-02-06
---

# Phase 6 Plan 05: Pipeline Wiring Summary

**Full pipeline integration: Triage -> Orchestrator -> file-group-based parallel domain agents -> Strategy -> HITL -> processing-complete with compound SSE identifiers and multi-execution status tracking**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-06T00:01:26Z
- **Completed:** 2026-02-06T00:06:28Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Wired Stage 3 (file-group-based parallel domain agents) with compute_agent_tasks for SSE pre-emission
- Wired Stage 4 (Strategy agent) consuming domain summaries via build_strategy_context
- Wired Stage 5 (HITL confirmation) for low-confidence findings from both domain and strategy agents
- Updated status endpoint with domain_results_summary field and domain_analysis pipeline stage
- Backward compatible: triage-only and triage+orchestrator flows still work

## Task Commits

Each task was committed atomically:

1. **Task 1: Add emit_agent_fallback helper and wire Stage 3** - `ee4ded0` (feat)
2. **Task 2: Wire Stage 4 strategy, Stage 5 HITL, relocate file status update** - `b57ac6e` (feat)
3. **Task 3: Update status endpoint and response schema** - `2b2c079` (feat)

## Files Created/Modified
- `backend/app/services/agent_events.py` - Added emit_agent_fallback convenience emitter for fallback warning events
- `backend/app/api/agents.py` - Extended run_analysis_workflow with Stages 3-5; updated AnalysisStatusResponse with domain_results_summary; updated pipeline status derivation for multi-stage awareness

## Decisions Made
- SSE pre-emission uses compute_agent_tasks from domain_runner as single source of truth (no duplicated file-group iteration logic in agents.py)
- Pipeline-level failures (triage/orchestrator/pipeline) distinguished from partial domain agent failures for status derivation
- Strategy agent completion marks pipeline as "complete" (replaces orchestrator as terminal)
- Backward compatible: orchestrator-complete without domain agents still reports "complete"
- orch_execution hoisted to outer scope (initialized to None before if/else block) for Stage 3 access

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Linter-driven import scoping**
- **Found during:** Task 1
- **Issue:** ruff flagged imports added for Task 2/3 as unused in Task 1's commit scope
- **Fix:** Deferred Task 2/3 imports (build_strategy_context, run_strategy, CONFIDENCE_THRESHOLD, request_confirmation) to Task 2 commit; removed top-level emit_agent_fallback import from agents.py (not used directly there)
- **Files modified:** backend/app/api/agents.py
- **Verification:** ruff-check passed on all commits

**2. [Rule 1 - Bug] Scoping of orch_execution variable**
- **Found during:** Task 1
- **Issue:** orch_execution was defined inside else block (orchestrator success path) but needed by Stage 3 at the outer scope
- **Fix:** Initialized orch_execution: AgentExecution | None = None before if/else, assigned inside else
- **Files modified:** backend/app/api/agents.py
- **Verification:** py_compile passes; orch_execution accessible when orchestrator_output is truthy

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 domain agent backend is now complete
- Full pipeline runs end-to-end: Triage -> Orchestrator -> Domain Agents -> Strategy -> HITL -> Complete
- Ready for Phase 7 (Synthesis & Knowledge Graph) which will consume domain agent findings
- Inter-agent communication for Strategy agent deferred to Phase 7

---
*Phase: 06-domain-agents*
*Completed: 2026-02-06*
