---
phase: 07-knowledge-storage-and-domain-agent-enrichment
plan: 01
subsystem: database
tags: [sqlalchemy, postgresql, alembic, tsvector, gin-index, knowledge-graph, findings]

# Dependency graph
requires:
  - phase: 06-domain-agents
    provides: "AgentExecution model, agent_executions table, domain agent output schemas"
provides:
  - "9 SQLAlchemy models: KgEntity, KgRelationship, CaseFinding, CaseHypothesis, CaseContradiction, CaseGap, CaseSynthesis, TimelineEvent, Location"
  - "Alembic migration c7a1f8d23e51 creating all 9 tables with indexes"
  - "Full-text search infrastructure (tsvector + GIN) on case_findings and kg_entities"
  - "Soft-merge dedup infrastructure (merged_into_id, merge_count) on KgEntity"
affects: [07-02, 07-03, 07-04, 08-synthesis, 09-chat, knowledge-graph-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "tsvector generated columns via raw SQL in migration (not SQLAlchemy column mapping)"
    - "Soft-merge entity deduplication via merged_into_id self-referential FK"
    - "JSONB for flexible structured data (citations, evidence refs, coordinates)"

key-files:
  created:
    - "backend/app/models/knowledge_graph.py"
    - "backend/app/models/findings.py"
    - "backend/app/models/synthesis.py"
    - "backend/alembic/versions/c7a1f8d23e51_add_knowledge_tables.py"
  modified:
    - "backend/app/models/__init__.py"

key-decisions:
  - "Renamed 'metadata' to 'properties' on KgEntity/KgRelationship (SQLAlchemy reserves 'metadata' attribute)"
  - "tsvector columns added via raw SQL in migration, not mapped in SQLAlchemy model (Pitfall 6)"
  - "All synthesis tables created now but populated in Phase 8"

patterns-established:
  - "Knowledge layer models follow same PG_UUID/DateTime/JSONB patterns as agent_execution.py"
  - "tsvector generated columns use raw SQL ALTER TABLE in migrations to avoid Alembic autogenerate phantom diffs"

# Metrics
duration: 5min
completed: 2026-02-07
---

# Phase 7 Plan 01: Knowledge Layer Database Schema Summary

**9 SQLAlchemy models + 1 Alembic migration for KG entities, relationships, findings, hypotheses, contradictions, gaps, synthesis, timeline events, and locations with tsvector full-text search**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-07T18:02:21Z
- **Completed:** 2026-02-07T18:06:59Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- 9 new SQLAlchemy model classes across 3 files, all registered in `__init__.py` for Alembic visibility
- Single Alembic migration creating all 9 tables in correct FK dependency order with 15 indexes
- Full-text search via tsvector generated columns + GIN indexes on `case_findings` (title + finding_text) and `kg_entities` (name)
- Soft-merge dedup infrastructure on KgEntity with `merged_into_id` self-referential FK and `merge_count` counter

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQLAlchemy models for all 9 tables** - `f53b82e` (feat)
2. **Task 2: Create Alembic migration for all 9 tables** - `c2235ec` (feat)

## Files Created/Modified
- `backend/app/models/knowledge_graph.py` - KgEntity (14 cols, 4 indexes) + KgRelationship (10 cols, 3 indexes)
- `backend/app/models/findings.py` - CaseFinding (13 cols, 3 indexes + tsvector GIN)
- `backend/app/models/synthesis.py` - CaseHypothesis, CaseContradiction, CaseGap, CaseSynthesis, TimelineEvent, Location (6 models, 6 indexes)
- `backend/app/models/__init__.py` - Added imports and __all__ entries for all 9 new model classes
- `backend/alembic/versions/c7a1f8d23e51_add_knowledge_tables.py` - Single migration with 9 create_table + tsvector raw SQL

## Decisions Made
- **Renamed 'metadata' to 'properties':** SQLAlchemy reserves the `metadata` attribute on declarative classes (it holds table metadata). Renamed to `properties` on both KgEntity and KgRelationship to avoid `InvalidRequestError`. The KG Builder service will map `DomainEntity.metadata` entries to the `properties` JSONB column.
- **tsvector via raw SQL only:** Following RESEARCH.md Pitfall 6, tsvector generated columns are added via `op.execute()` raw SQL in the migration, not mapped as SQLAlchemy columns. Queries will use `func.to_tsvector()` and `func.plainto_tsquery()` directly.
- **Synthesis tables created empty:** All 6 synthesis models (hypotheses, contradictions, gaps, synthesis, timeline events, locations) are created now with the schema from ROADMAP.md. Phase 8 Synthesis Agent will populate them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLAlchemy reserved attribute 'metadata'**
- **Found during:** Task 1 (model creation)
- **Issue:** Plan specified `metadata` as a column name on KgEntity and KgRelationship, but SQLAlchemy's DeclarativeBase reserves `metadata` as a class attribute for table metadata
- **Fix:** Renamed column to `properties` on both models. Migration uses `properties` as the DB column name.
- **Files modified:** `backend/app/models/knowledge_graph.py`
- **Verification:** `from app.models import KgEntity, KgRelationship` imports without error
- **Committed in:** f53b82e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Column rename from `metadata` to `properties` is functionally equivalent. No scope creep.

## Issues Encountered
None beyond the reserved attribute name fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 9 tables ready for the KG Builder service (Plan 02) and Findings service (Plan 03)
- Migration chain has single head at `c7a1f8d23e51`, ready for additional migrations if needed
- Models are importable and visible to Alembic for any future schema adjustments

---
*Phase: 07-knowledge-storage-and-domain-agent-enrichment*
*Completed: 2026-02-07*
