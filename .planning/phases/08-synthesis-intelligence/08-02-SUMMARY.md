---
phase: 08-synthesis-intelligence
plan: 02
subsystem: agents
tags: [gemini-pro, synthesis, pipeline, sse, domain-agent-runner, structured-output]

# Dependency graph
requires:
  - phase: 08-01
    provides: SynthesisOutput schema, DB models (CaseHypothesis, CaseContradiction, CaseGap, CaseSynthesis, TimelineEvent, InvestigationTask), Case verdict columns
  - phase: 07.1
    provides: KG Builder pattern (DomainAgentRunner subclass, text-only input, clear-and-rebuild DB write)
  - phase: 07
    provides: CaseFinding, KgEntity, KgRelationship models + findings service
provides:
  - SynthesisAgentRunner subclass with text-only input assembly
  - SYNTHESIS_SYSTEM_PROMPT covering all 12 SynthesisOutput fields
  - assemble_synthesis_input() querying 5 DB data sources
  - write_synthesis_output() writing to 6 tables + Case verdict columns
  - run_synthesis() top-level orchestrator for pipeline integration
  - Pipeline Stage 8 after KG Builder + Entity Backfill
  - SYNTHESIS_DATA_READY SSE event type + emit helper
  - AgentFactory.create_synthesis_agent() with Pro model + high thinking
affects: [08-03 (synthesis API endpoints), 08-04 (command center frontend), 09 (chat agent tools), 10 (source panel)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synthesis agent follows KG Builder pattern: DomainAgentRunner subclass, text-only input, clear-and-rebuild DB write"
    - "Batch SSE event (synthesis-data-ready) for atomic cache invalidation"
    - "Savepoint-per-record pattern for malformed item isolation"
    - "FK index resolution: 0-based output list indexes map to just-written DB record UUIDs"

key-files:
  created:
    - backend/app/agents/synthesis.py
    - backend/app/agents/prompts/synthesis.py
  modified:
    - backend/app/agents/factory.py
    - backend/app/services/pipeline.py
    - backend/app/services/agent_events.py

key-decisions:
  - "Synthesis agent uses text-only input (no multimodal files): domain agents already processed raw evidence"
  - "Clear-and-rebuild pattern: delete all synthesis data per case before writing new results"
  - "Batch SSE event (synthesis-data-ready) instead of per-item events: all outputs arrive atomically from single LLM call"
  - "Synthesis failure is non-blocking: pipeline continues to ANALYZED status even if synthesis fails"
  - "Hypothesis status derived from confidence: >60 SUPPORTED, <40 REFUTED, else PENDING"
  - "Verdict columns on Case model updated with evidence_strength label and first 200 chars of case_summary"

patterns-established:
  - "Pipeline Stage 8 pattern: agent-started -> run_synthesis -> agent-complete/agent-error -> commit -> synthesis-data-ready -> ANALYZED"
  - "Text-only synthesis input assembly: 5 sections (metadata, files, findings, entities, relationships) with [FINDING:uuid] and [ENTITY:uuid:name] prefixes"

# Metrics
duration: 12min
completed: 2026-02-09
---

# Phase 8 Plan 02: Synthesis Agent Runner Summary

**SynthesisAgentRunner with 12-field structured output, 5-source input assembly, 6-table DB writer, and pipeline Stage 8 integration with batch SSE events**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-08T23:06:40Z
- **Completed:** 2026-02-08T23:19:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Synthesis Agent follows KG Builder pattern exactly: DomainAgentRunner subclass with text-only input and structured output
- Input assembly queries all 5 data sources (case, files, findings, entities, relationships) with section markers
- Output writer populates 6 destination tables (case_synthesis, case_hypotheses, case_contradictions, case_gaps, timeline_events, investigation_tasks) + updates Case verdict columns
- Pipeline Stage 8 positioned after entity backfill, before file status update, with non-blocking failure handling
- SYNTHESIS_DATA_READY batch SSE event fires after DB commit for frontend cache invalidation

## Task Commits

Each task was committed atomically:

1. **Task 1: Synthesis Agent runner + prompt + factory method** - `489e1e7` (feat)
2. **Task 2: Pipeline Stage 8 integration + SSE events** - `65c3d33` (feat)

## Files Created/Modified
- `backend/app/agents/synthesis.py` - SynthesisAgentRunner, assemble_synthesis_input, write_synthesis_output, run_synthesis
- `backend/app/agents/prompts/synthesis.py` - SYNTHESIS_SYSTEM_PROMPT with 12-field output instructions + citation/quality rules
- `backend/app/agents/factory.py` - AgentFactory.create_synthesis_agent() static method
- `backend/app/services/pipeline.py` - Stage 8 block with agent lifecycle SSE events
- `backend/app/services/agent_events.py` - SYNTHESIS_DATA_READY enum value + emit_synthesis_data_ready() helper

## Decisions Made
- Synthesis agent uses text-only input following KG Builder pattern (domain agents already processed raw evidence)
- Clear-and-rebuild pattern for synthesis data (delete all per case, then insert fresh)
- Single batch SSE event (synthesis-data-ready) instead of per-item events (all outputs arrive atomically)
- Synthesis failure is non-blocking in pipeline (logged + SSE error emitted, pipeline continues to ANALYZED)
- Hypothesis status auto-derived from confidence score (>60 SUPPORTED, <40 REFUTED, else PENDING)
- Confidence stored as 0-1 float in DB (divided by 100 from LLM's 0-100 output)
- Case verdict_summary truncated to first 200 chars of case_summary for list page display

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pyright optional member access on current_agent.upper()**
- **Found during:** Task 1 (synthesis.py line 183)
- **Issue:** `current_agent` typed as `str | None`, calling `.upper()` without guard
- **Fix:** Added guard: `agent_label = current_agent.upper() if current_agent else "UNKNOWN"`
- **Files modified:** backend/app/agents/synthesis.py
- **Verification:** Pyright passes cleanly
- **Committed in:** 489e1e7 (Task 1 commit)

**2. [Rule 1 - Bug] Ruff UP017 lint: timezone.utc vs datetime.UTC**
- **Found during:** Task 1 (synthesis.py _parse_iso_date)
- **Issue:** Used `timezone.utc` instead of modern `datetime.UTC` alias
- **Fix:** Changed import to `from datetime import UTC, datetime` and usage to `replace(tzinfo=UTC)`
- **Files modified:** backend/app/agents/synthesis.py
- **Verification:** `ruff check` passes
- **Committed in:** 489e1e7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes necessary for type safety and lint compliance. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Synthesis Agent is fully integrated into the pipeline and writes to all synthesis tables
- Ready for Phase 8 Plan 03: Synthesis API endpoints (GET routes to read synthesis data)
- Ready for Phase 8 Plan 04: Command Center frontend integration (SSE event handling for synthesis)
- Pipeline order is now: Triage -> Orchestrator -> Domain -> Strategy -> HITL -> Save Findings -> KG Builder -> Entity Backfill -> Synthesis -> ANALYZED -> processing-complete

---
*Phase: 08-synthesis-intelligence*
*Completed: 2026-02-09*
