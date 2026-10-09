---
phase: 06-domain-agents
plan: 03
subsystem: agents
tags: [gemini, adk, asyncio, pydantic, domain-agents, parallel-execution]

# Dependency graph
requires:
  - phase: 06-domain-agents/01
    provides: "Domain agent Pydantic schemas (FinancialOutput, LegalOutput, EvidenceOutput) and factory methods"
  - phase: 06-domain-agents/02
    provides: "Domain agent system prompts (FINANCIAL_SYSTEM_PROMPT, LEGAL_SYSTEM_PROMPT, EVIDENCE_SYSTEM_PROMPT)"
  - phase: 05-agent-flow
    provides: "SSE pipeline, PublishFn, agent_events pub/sub, adk_service helpers"
provides:
  - "run_financial, run_legal, run_evidence async functions with context_injection and Pro-to-Flash fallback"
  - "compute_agent_tasks: single source of truth for file-group iteration logic"
  - "run_domain_agents_parallel: concurrent agent execution with independent DB sessions"
  - "build_strategy_context: text summary builder for Strategy agent consumption"
affects: ["06-domain-agents/04", "06-domain-agents/05", "07-synthesis"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline Pro-to-Flash fallback (REQ-AGENT-007h) -- try Pro with retries, then Flash with retries"
    - "File-group-based spawning: one agent instance per (file_group, agent_type) pair"
    - "compute_agent_tasks as shared pure function for SSE pre-emission and actual execution"
    - "Independent DB sessions per parallel task via session factory callable"
    - "Context injection prepended to user message for case-specific framing"

key-files:
  created:
    - "backend/app/agents/financial.py"
    - "backend/app/agents/legal.py"
    - "backend/app/agents/evidence.py"
    - "backend/app/agents/domain_runner.py"
  modified: []

key-decisions:
  - "Inline Pro-to-Flash fallback over separate ResilientAgentWrapper class -- less indirection for 4-agent setup"
  - "AgentTask dataclass as intermediary between routing output and execution -- enables pre-computation for SSE"
  - "RUN_FNS dispatch table for clean agent type to function mapping"
  - "Strategy agent excluded from parallel domain runner -- runs sequentially after per CONTEXT.md"

patterns-established:
  - "Domain agent template: ABOUTME, imports, AgentClass, parse_X_output, _prepare_X_content, run_X"
  - "Context injection: prepend case context before analysis prompt, append hypotheses after"
  - "Stage suffix pattern: _grp_N for explicit groups, _ungrouped_N for implicit single-file groups"
  - "Fallback metadata: _metadata.fallback_used and _metadata.fallback_model in execution output_data"

# Metrics
duration: 5min
completed: 2026-02-06
---

# Phase 6 Plan 03: Domain Agent Modules Summary

**Financial, Legal, and Evidence agents with file-group-based parallel runner, context injection, and inline Pro-to-Flash fallback**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-05T23:50:16Z
- **Completed:** 2026-02-05T23:54:53Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Three domain agent modules (financial.py, legal.py, evidence.py) following identical template with context_injection, stage_suffix, hypothesis injection, and inline Pro-to-Flash fallback
- domain_runner.py with compute_agent_tasks as single source of truth for file-group iteration, avoiding duplication between execution and SSE pre-emission
- Parallel execution via asyncio.gather with independent DB sessions per agent task (avoiding shared session pitfall)
- build_strategy_context producing readable text summaries from multi-result domain outputs for Strategy agent

## Task Commits

Each task was committed atomically:

1. **Task 1: Financial agent module with context_injection** - `7fdccfb` (feat)
2. **Task 2: Legal/Evidence agents + file-group parallel runner** - `ba6410f` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `backend/app/agents/financial.py` - Financial domain agent with FinancialAgent class, parse_financial_output, run_financial
- `backend/app/agents/legal.py` - Legal domain agent with LegalAgent class, parse_legal_output, run_legal
- `backend/app/agents/evidence.py` - Evidence domain agent with EvidenceAgent class, parse_evidence_output, run_evidence
- `backend/app/agents/domain_runner.py` - AgentTask dataclass, compute_agent_tasks, run_domain_agents_parallel, build_strategy_context

## Decisions Made
- Inline Pro-to-Flash fallback rather than separate ResilientAgentWrapper class -- functionally equivalent, less indirection for 4-agent setup
- AgentTask dataclass used as intermediary between orchestrator routing and parallel execution -- enables compute_agent_tasks to be reused by both the runner and pipeline SSE pre-emission
- _DOMAIN_AGENT_TYPES frozenset excludes "strategy" -- Strategy agent runs sequentially after domain agents per CONTEXT.md
- Fallback metadata stored in execution output_data under _metadata key to avoid polluting the domain output schema

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused schema imports in domain_runner.py**
- **Found during:** Task 2 (domain_runner.py)
- **Issue:** FinancialOutput, LegalOutput, EvidenceOutput were imported but not directly used (run functions handle their own types)
- **Fix:** Removed unused imports, kept only OrchestratorOutput
- **Files modified:** backend/app/agents/domain_runner.py
- **Verification:** ruff-check passed
- **Committed in:** ba6410f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking -- lint failure)
**Impact on plan:** Trivial cleanup. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three domain agents ready for pipeline integration
- compute_agent_tasks available for SSE pre-emission in agents.py pipeline
- build_strategy_context ready for Strategy agent (Plan 04)
- HITL integration for low-confidence findings (Plan 04) can consume domain agent outputs

---
*Phase: 06-domain-agents*
*Completed: 2026-02-06*
