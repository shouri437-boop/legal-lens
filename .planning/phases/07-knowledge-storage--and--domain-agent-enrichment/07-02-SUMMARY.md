---
phase: 07-knowledge-storage-and-domain-agent-enrichment
plan: 02
subsystem: api
tags: [pydantic, knowledge-graph, findings, schemas, api-contracts]

# Dependency graph
requires:
  - phase: 07-01
    provides: "SQLAlchemy models for kg_entities, kg_relationships, case_findings"
provides:
  - "Pydantic request/response schemas for KG entity/relationship CRUD"
  - "Pydantic response schemas for case findings with search support"
  - "findings_text field on all 4 domain agent output models"
  - "All schemas exported from schemas/__init__.py for type generation"
affects: ["07-03 KG Builder service", "07-04 findings service", "07-05 API endpoints", "08 synthesis agent"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ConfigDict(from_attributes=True) on all response models for ORM serialization"
    - "Field validators (min_length, max_length, ge, le) on all request models"
    - "Optional fields with default=None for backward compatibility on schema additions"

key-files:
  created:
    - "backend/app/schemas/knowledge_graph.py"
    - "backend/app/schemas/findings.py"
  modified:
    - "backend/app/schemas/agent.py"
    - "backend/app/schemas/__init__.py"

key-decisions:
  - "findings_text is optional (default=None) for backward compatibility with existing agent_executions.output_data"
  - "Citation excerpt description updated to require character-for-character preservation for PDF.js highlighting"

patterns-established:
  - "KG request schemas use 'metadata' field name; response schemas use 'properties' to match ORM column"

# Metrics
duration: 3min
completed: 2026-02-07
---

# Phase 7 Plan 02: KG & Findings API Schemas Summary

**Pydantic request/response schemas for KG entity/relationship CRUD, findings with full-text search, and findings_text on all 4 domain outputs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T18:09:27Z
- **Completed:** 2026-02-07T18:12:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created 9 Pydantic schema classes for KG API (EntityResponse, EntityCreateRequest, EntityUpdateRequest, RelationshipResponse, RelationshipCreateRequest, GraphResponse, EntityListResponse, RelationshipListResponse)
- Created 6 Pydantic schema classes for findings API (FindingCitation, FindingResponse, FindingListResponse, FindingSearchRequest, FindingSearchResult, FindingSearchResponse)
- Added optional findings_text field to FinancialOutput, LegalOutput, EvidenceOutput, StrategyOutput with zero breaking changes
- Updated Citation.excerpt description to enforce character-for-character preservation for PDF.js search highlighting
- All 15 new schema classes exported from schemas/__init__.py

## Task Commits

Each task was committed atomically:

1. **Task 1: Create KG and findings API schemas** - `e90c2b8` (feat)
2. **Task 2: Enhance domain agent schemas and update exports** - `ba3783b` (feat)

## Files Created/Modified
- `backend/app/schemas/knowledge_graph.py` - KG entity/relationship request/response Pydantic schemas with ConfigDict(from_attributes=True)
- `backend/app/schemas/findings.py` - Case findings response schemas with full-text search request/response models
- `backend/app/schemas/agent.py` - Added findings_text to 4 domain outputs; updated Citation.excerpt description
- `backend/app/schemas/__init__.py` - Exported all 15 new schema classes with __all__ entries

## Decisions Made
- findings_text uses `str | None = Field(default=None)` for backward compatibility with existing agent_executions records that lack this field
- Citation excerpt description updated from generic "Relevant text excerpt" to explicit "Exact character-for-character excerpt" requirement, per CONTEXT.md decision for PDF.js search highlighting
- Request schemas use `metadata` field name while response schemas use `properties` (matching the ORM column renamed from `metadata` in Plan 01)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All API contracts defined and ready for service layer implementation (Plan 03+)
- KG and findings schemas align with SQLAlchemy models from Plan 01
- findings_text field ready for enriched domain agent prompts in later plans
- All schemas exported for `make generate-types` pipeline

---
*Phase: 07-knowledge-storage-and-domain-agent-enrichment*
*Completed: 2026-02-07*
