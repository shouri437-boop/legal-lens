---
phase: 04-core-agent-system
plan: 02
subsystem: database, api
tags: [sqlalchemy, pydantic, jsonb, alembic, agent-execution, triage-output]

# Dependency graph
requires:
  - phase: 04-core-agent-system/01
    provides: ADK service layer and agent factory
  - phase: 03-file-ingestion
    provides: CaseFile model pattern and case FK relationships
provides:
  - AgentExecution SQLAlchemy model with full audit trail
  - TriageOutput Pydantic schema with domain scores, entities, summaries, complexity
  - Agent execution CRUD schemas (Create/Update/Response)
  - Database migration for agent_executions table
affects: [04-core-agent-system/03, 06-domain-agents, 07-synthesis-knowledge-graph]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONB columns for flexible agent input/output storage"
    - "Self-referential FK for parent-child agent execution tracking"
    - "Enum-based status lifecycle for agent executions"

key-files:
  created:
    - backend/app/models/agent_execution.py
    - backend/app/schemas/agent.py
    - backend/alembic/versions/0562cc9e65bd_add_agent_executions_table.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/models/case.py
    - backend/app/schemas/__init__.py

key-decisions:
  - "JSONB for input_data/output_data/thinking_traces/tools_called: flexible schema for varied agent types"
  - "Self-referential parent_execution_id: enables sub-agent delegation tracking"
  - "Manual migration (not autogenerate): no live database required during development"

patterns-established:
  - "Agent audit pattern: every agent invocation logged with timing, tokens, and I/O"
  - "Typed triage output: DomainScore, ExtractedEntity, FileSummary, ComplexityAssessment"
  - "JSONB with list[dict] typing: structured but schema-flexible storage"

# Metrics
duration: 3min
completed: 2026-02-03
---

# Phase 4 Plan 02: Agent Execution Models & Schemas Summary

**SQLAlchemy AgentExecution model with JSONB audit trail, Pydantic TriageOutput schema with domain scores/entities/summaries/complexity, and Alembic migration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-03T05:31:52Z
- **Completed:** 2026-02-03T05:35:13Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- AgentExecution model with 17 columns covering full execution audit trail (timing, tokens, thinking traces, tool calls)
- TriageOutput schema hierarchy: TriageOutput > TriageFileResult > DomainScore/ExtractedEntity/FileSummary/ComplexityAssessment/FileGrouping
- Agent execution CRUD schemas (Create/Update/Response) ready for API endpoints
- Alembic migration with enum type, JSONB columns, 3 indexes, and cascading FKs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create agent execution SQLAlchemy model** - `9476ece` (feat)
2. **Task 2: Create Pydantic schemas for agent data** - `938b947` (feat)
3. **Task 3: Create database migration for agent_executions table** - `39a860e` (feat)

## Files Created/Modified
- `backend/app/models/agent_execution.py` - SQLAlchemy model with AgentExecutionStatus enum and AgentExecution model
- `backend/app/schemas/agent.py` - 10 Pydantic schemas for triage output types and execution CRUD
- `backend/alembic/versions/0562cc9e65bd_add_agent_executions_table.py` - Migration creating table, enum, indexes, FKs
- `backend/app/models/__init__.py` - Added AgentExecution and AgentExecutionStatus exports
- `backend/app/models/case.py` - Added agent_executions relationship with back_populates
- `backend/app/schemas/__init__.py` - Added all 10 new schema exports

## Decisions Made
- Used JSONB (not JSON) for input_data, output_data, thinking_traces, tools_called -- enables PostgreSQL indexing and containment queries
- Self-referential FK with SET NULL on delete for parent_execution_id -- preserves child records when parent is deleted
- Manual migration instead of autogenerate -- no live database needed during development; followed existing migration patterns exactly
- `list[dict]` typing for thinking_traces and tools_called in Pydantic schemas -- more specific than bare `list` while remaining flexible

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AgentExecution model ready for the Triage Agent (04-03) to log executions
- TriageOutput schema ready to be used as structured output from Triage Agent
- Migration ready to apply when database is available (`alembic upgrade head`)
- All schemas exported and importable for API route handlers

---
*Phase: 04-core-agent-system*
*Completed: 2026-02-03*
