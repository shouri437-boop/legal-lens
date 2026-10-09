---
phase: 08-synthesis-intelligence
plan: 01
subsystem: database
tags: [sqlalchemy, alembic, pydantic, synthesis, investigation-tasks, verdict]

# Dependency graph
requires:
  - phase: 07-knowledge-storage
    provides: "CaseHypothesis, CaseContradiction, CaseGap, CaseSynthesis, TimelineEvent models + Alembic migrations"
  - phase: 07.1-llm-kg-builder
    provides: "KgBuilderOutput Pydantic schema pattern for Gemini structured output"
provides:
  - "InvestigationTask SQLAlchemy model with FK links to hypotheses, contradictions, gaps"
  - "Case.verdict_label and Case.verdict_summary columns"
  - "SynthesisOutput Pydantic schema (12 fields) for Gemini structured output"
  - "9 API response schemas for all synthesis data types"
  - "Alembic migration f8a3b2c91d40"
affects:
  - "08-02 (Synthesis Agent runner uses SynthesisOutput schema)"
  - "08-03 (API endpoints use response schemas)"
  - "08-04 (pipeline integration writes to InvestigationTask table)"
  - "08-05 (frontend consumes API response schemas)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "model_validator(mode='before') for merging split JSONB columns into flat list"
    - "model_validator for parsing JSONB dict into typed Pydantic sub-model"

key-files:
  created:
    - "backend/app/models/investigation_task.py"
    - "backend/app/schemas/synthesis.py"
    - "backend/alembic/versions/f8a3b2c91d40_add_investigation_tasks_and_verdict_cols.py"
  modified:
    - "backend/app/models/case.py"
    - "backend/app/models/__init__.py"

key-decisions:
  - "Store evidence split by role in existing supporting_evidence/contradicting_evidence columns; merge in API response via model_validator"
  - "Case verdict columns (verdict_label, verdict_summary) added directly to Case model for list-page access without joins"
  - "SynthesisOutput uses simple types (str, int, float, bool, list) for Gemini structured output compatibility"

patterns-established:
  - "model_validator(mode='before') to reshape ORM data before Pydantic validation (evidence merge, JSONB parse)"
  - "Dual-category schema files: Category A (LLM output target) + Category B (API response serialization)"

# Metrics
duration: 4min
completed: 2026-02-08
---

# Phase 08 Plan 01: Synthesis Schema Foundation Summary

**InvestigationTask model + Case verdict columns + SynthesisOutput Pydantic schema with 18 total schemas for Gemini output and API responses**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-08T23:00:23Z
- **Completed:** 2026-02-08T23:04:10Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- InvestigationTask model with 12 columns, FK constraints to case_hypotheses/case_contradictions/case_gaps, and case_id index
- Case model extended with verdict_label (String(30)) and verdict_summary (Text) for case list/header display
- SynthesisOutput Pydantic schema with all 12 fields matching RESEARCH.md design (Gemini structured output target)
- 9 API response schemas with from_attributes=True, UUID serialization, and model_validators for evidence merging and JSONB parsing

## Task Commits

Each task was committed atomically:

1. **Task 1: InvestigationTask model + Case verdict columns + Alembic migration** - `ba18917` (feat)
2. **Task 2: SynthesisOutput Pydantic schema + API response schemas** - `3f336c7` (feat)

## Files Created/Modified
- `backend/app/models/investigation_task.py` - InvestigationTask SQLAlchemy model (12 columns, 3 FKs, case_id index)
- `backend/app/models/case.py` - Added verdict_label and verdict_summary columns
- `backend/app/models/__init__.py` - Exported InvestigationTask
- `backend/alembic/versions/f8a3b2c91d40_add_investigation_tasks_and_verdict_cols.py` - Migration for investigation_tasks table + Case verdict columns
- `backend/app/schemas/synthesis.py` - 18 Pydantic schemas (9 Gemini output + 9 API response)

## Decisions Made
- **Evidence storage approach (Option 3 from RESEARCH.md):** Store evidence split by role in existing supporting_evidence/contradicting_evidence JSONB columns; HypothesisResponse uses model_validator(mode="before") to merge into flat list with role labels for frontend consumption. No migration needed.
- **Case verdict columns:** Added verdict_label and verdict_summary directly to Case model (not just in case_synthesis JSONB) so the cases list page can display verdict badges without joining to case_synthesis table.
- **SynthesisOutput typing:** All fields use simple types (str, float, int, bool, list[str], list[int]) compatible with Gemini structured output constraints. No datetime fields in LLM output (dates as ISO 8601 strings parsed during DB write).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Ruff import sorting (I001) flagged on schemas/synthesis.py pre-commit hook. Fixed with `ruff check --fix` before retry.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All DB models and Pydantic schemas ready for Plan 02 (Synthesis Agent runner + prompt)
- SynthesisOutput schema ready for Gemini constrained decoding target
- API response schemas ready for Plan 03 (API endpoints)
- InvestigationTask table ready for Plan 04 (pipeline integration writes)
- No blockers

---
*Phase: 08-synthesis-intelligence*
*Completed: 2026-02-08*
