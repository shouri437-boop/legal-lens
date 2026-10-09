---
phase: 04-core-agent-system
plan: 04
subsystem: agents
tags: [google-adk, gemini-3-pro, orchestrator, routing, research-trigger, domain-agents]

# Dependency graph
requires:
  - phase: 04-core-agent-system/01
    provides: ADK service layer, agent factory, thinking planner, callback-to-SSE mapping
  - phase: 04-core-agent-system/02
    provides: AgentExecution model, TriageOutput schema, execution status enum
  - phase: 04-core-agent-system/03
    provides: TriageAgent, run_triage, triage output parsing patterns
provides:
  - Orchestrator output schemas (RoutingDecision, FileGroupForProcessing, ResearchTrigger, OrchestratorOutput)
  - Orchestrator system prompt with routing guardrails and dynamic thresholds
  - OrchestratorAgent wrapper class for ADK LlmAgent
  - run_orchestrator async function with stage-isolated sessions and execution logging
  - Text-only input preparation from TriageOutput (no file content in orchestrator context)
  - Domain agent invocation stub for Phase 6 integration
affects:
  - 05-agent-flow (Orchestrator events feed Command Center via SSE callbacks)
  - 06-domain-agents (Orchestrator routing decisions drive domain agent invocation)
  - 09-chat-research (Research trigger decisions feed Research/Discovery agent)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Text-only orchestrator input: TriageOutput JSON converted to structured text, keeping context ~10-50K tokens"
    - "Domain agent invocation stub: logs intended routing for Phase 6 integration"
    - "Parent execution tracking: orchestrator links to triage via parent_execution_id"

key-files:
  created:
    - backend/app/agents/orchestrator.py
    - backend/app/agents/prompts/orchestrator.py
  modified:
    - backend/app/agents/factory.py
    - backend/app/agents/__init__.py
    - backend/app/agents/prompts/__init__.py
    - backend/app/schemas/agent.py
    - backend/app/schemas/__init__.py

key-decisions:
  - "Orchestrator uses Gemini Pro (not Flash) for complex routing reasoning"
  - "Orchestrator receives text-only input (triage JSON) to keep context lightweight"
  - "Dynamic threshold routing: no fixed score cutoff, full-picture reasoning per file"
  - "Parent execution ID links orchestrator to triage for audit chain"

patterns-established:
  - "OrchestratorAgent wrapper: mirrors TriageAgent pattern for consistency"
  - "run_orchestrator() follows run_triage() pattern: session creation, execution logging, error handling"
  - "Text-only stage input: downstream agents receive structured text, not raw files"

# Metrics
duration: 4min
completed: 2026-02-03
---

# Phase 4 Plan 04: Orchestrator Agent Summary

**Orchestrator Agent with dynamic routing decisions, file groupings, research triggers, and Gemini Pro reasoning over text-only triage context**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-03T05:44:48Z
- **Completed:** 2026-02-03T05:48:40Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Orchestrator output schemas (RoutingDecision, FileGroupForProcessing, ResearchTrigger, OrchestratorOutput) with full field validation
- Comprehensive system prompt (6484 chars) with dynamic thresholds, routing guardrails, parallel-first execution, and research trigger criteria
- OrchestratorAgent class and run_orchestrator function with stage-isolated sessions, execution audit trail, and parent execution linking
- Factory updated from placeholder prompt to real ORCHESTRATOR_SYSTEM_PROMPT from prompts module

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Orchestrator output schemas** - `7f91182` (feat)
2. **Task 2: Create Orchestrator system prompt with routing guardrails** - `721c0f2` (feat)
3. **Task 3: Implement Orchestrator Agent and execution function** - `ebb3812` (feat)

## Files Created/Modified
- `backend/app/schemas/agent.py` - Added RoutingDecision, FileGroupForProcessing, ResearchTrigger, OrchestratorOutput schemas
- `backend/app/schemas/__init__.py` - Added new schema exports
- `backend/app/agents/prompts/orchestrator.py` - ORCHESTRATOR_SYSTEM_PROMPT with routing guardrails and JSON example
- `backend/app/agents/prompts/__init__.py` - Added ORCHESTRATOR_SYSTEM_PROMPT export
- `backend/app/agents/orchestrator.py` - OrchestratorAgent class, run_orchestrator function, output parsing, input preparation
- `backend/app/agents/factory.py` - Replaced placeholder prompt with real module import
- `backend/app/agents/__init__.py` - Added OrchestratorAgent, run_orchestrator, ORCHESTRATOR_SYSTEM_PROMPT exports

## Decisions Made
- Orchestrator uses Gemini Pro model for complex routing reasoning (per CONTEXT.md)
- Text-only input from triage (no file content) keeps orchestrator context at ~10-50K tokens vs 500K+ with files
- Dynamic threshold routing: no fixed score cutoff, orchestrator reasons about full picture per file
- Parent execution ID enables audit chain from orchestrator back to triage execution
- Entity list capped at 15 per file in orchestrator input to prevent context bloat

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Orchestrator uses existing ADK configuration (GOOGLE_API_KEY, model IDs) from Plan 01.

## Next Phase Readiness
- Orchestrator Agent ready for pipeline integration (domain agents will consume OrchestratorOutput)
- run_orchestrator function ready for API endpoint wiring
- Research trigger decisions captured for Phase 9 Research/Discovery agent
- Domain agent invocation stub ready to be replaced with real implementations in Phase 6
- Execution audit trail links orchestrator to triage for full pipeline traceability

---
*Phase: 04-core-agent-system*
*Completed: 2026-02-03*
