---
phase: 07-knowledge-storage-and-domain-agent-enrichment
plan: 03
subsystem: database, api
tags: [knowledge-graph, rapidfuzz, tsvector, full-text-search, deduplication, entity-extraction]

# Dependency graph
requires:
  - phase: 07-01
    provides: KG and findings DB models (KgEntity, KgRelationship, CaseFinding) with migration
  - phase: 07-02
    provides: KG and findings Pydantic API schemas, findings_text field on domain outputs
provides:
  - KG Builder service: entity extraction, co-occurrence relationships, dedup, degree computation
  - Findings service: save, update_entity_ids, full-text search (tsvector), paginated list, get
  - rapidfuzz dependency for fuzzy entity matching
affects: [07-04+, phase-8-synthesis, phase-9-chat]

# Tech tracking
tech-stack:
  added: [rapidfuzz 3.14.3]
  patterns: [programmatic-kg-builder, soft-merge-dedup, tsvector-search]

key-files:
  created:
    - backend/app/services/kg_builder.py
    - backend/app/services/findings_service.py
  modified:
    - backend/pyproject.toml
    - backend/uv.lock

key-decisions:
  - "v1 search uses PG tsvector; Vertex AI vector search deferred to Phase 9"
  - "Cross-domain entity merging allowed (grouped by entity_type only, not domain)"
  - "Fuzzy matches flagged at 85%+ but not auto-merged; deferred to Phase 8 LLM resolution"
  - "Findings text enriched with output.findings_text when available for richer search"

patterns-established:
  - "Soft merge via merged_into_id: never hard-delete entities, point duplicates to primary"
  - "Entity dedup: exact match auto-merges, fuzzy match flags for LLM"
  - "Co-occurrence strength: +20 per shared finding, capped at 100"
  - "Service functions take AsyncSession as parameter (consistent with file_service.py)"

# Metrics
duration: 4min
completed: 2026-02-07
---

# Phase 7 Plan 03: KG Builder & Findings Service Summary

**Programmatic KG Builder with entity extraction, co-occurrence relationships, exact/fuzzy dedup via rapidfuzz, and findings storage with PG tsvector full-text search**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-07T18:14:48Z
- **Completed:** 2026-02-07T18:18:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- KG Builder service extracts all entities from all 4 domain agent output types (FinancialOutput, LegalOutput, EvidenceOutput, StrategyOutput) without filtering
- Co-occurrence relationships inferred from entity pairs within the same finding, with cumulative strength tracking
- Entity deduplication: exact matches auto-merged via soft merge (merged_into_id), fuzzy matches (>=85% rapidfuzz ratio) flagged for Phase 8 LLM resolution
- Findings service with save, full-text search (PG tsvector + plainto_tsquery + ts_rank), paginated listing, and single lookup
- update_finding_entity_ids function available for pipeline to backfill finding-to-entity links after KG build

## Task Commits

Each task was committed atomically:

1. **Task 1: Install rapidfuzz and implement KG Builder service** - `c4a88bf` (feat)
2. **Task 2: Implement findings storage service with full-text search** - `a60b384` (feat)

## Files Created/Modified
- `backend/app/services/kg_builder.py` - KG Builder: normalize, extract entities, build relationships, deduplicate, compute degrees, orchestrate
- `backend/app/services/findings_service.py` - Findings: save, update_entity_ids, search (tsvector), list (paginated), get
- `backend/pyproject.toml` - Added rapidfuzz dependency
- `backend/uv.lock` - Lock file updated with rapidfuzz 3.14.3

## Decisions Made
- v1 search uses PG tsvector full-text search; Vertex AI vector search (gemini-embedding-001) deferred to Phase 9 per roadmap
- Cross-domain entity merging allowed: entities grouped by entity_type only (not domain) per CONTEXT.md
- Fuzzy matches at 85%+ are logged but not auto-merged; deferred to Phase 8 LLM resolution
- findings_text from domain output appended to finding description for richer searchable text

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-commit ruff lint caught two unused loop variables (B007): `name` and `grp_label` in kg_builder.py. Fixed by prefixing with underscore per Python convention.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- KG Builder and Findings services ready for pipeline integration (Plan 04+)
- build_knowledge_graph accepts domain_results dict matching pipeline.py structure
- update_finding_entity_ids available for post-KG backfill in pipeline
- Entity dedup fuzzy flags logged for Phase 8 LLM resolution

---
*Phase: 07-knowledge-storage-and-domain-agent-enrichment*
*Completed: 2026-02-07*
