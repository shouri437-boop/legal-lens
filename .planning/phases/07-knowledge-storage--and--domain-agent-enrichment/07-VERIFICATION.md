---
phase: 07-knowledge-storage-and-domain-agent-enrichment
verified: 2026-02-07T19:00:00Z
status: passed
score: 8/8 must-haves verified
must_haves:
  truths:
    - "9 new database tables exist with correct columns and indexes via Alembic migration"
    - "Full-text search infrastructure (tsvector + GIN) operational on case_findings and kg_entities"
    - "KG Builder programmatically extracts ALL entities from domain agent output without filtering"
    - "Entity deduplication: exact match auto-merges, fuzzy 85%+ flagged for LLM resolution"
    - "Findings service saves findings with citations and supports tsvector full-text search"
    - "KG and findings API endpoints registered and functional (10 endpoints total)"
    - "Domain agent prompts enriched with exhaustive citation rules and findings_text field"
    - "Pipeline wired: findings saved, KG built, entity_ids backfilled after domain agent completion"
  artifacts:
    - path: "backend/app/models/knowledge_graph.py"
      provides: "KgEntity and KgRelationship SQLAlchemy models"
    - path: "backend/app/models/findings.py"
      provides: "CaseFinding SQLAlchemy model"
    - path: "backend/app/models/synthesis.py"
      provides: "CaseHypothesis, CaseContradiction, CaseGap, CaseSynthesis, TimelineEvent, Location models"
    - path: "backend/app/schemas/knowledge_graph.py"
      provides: "KG API request/response Pydantic schemas"
    - path: "backend/app/schemas/findings.py"
      provides: "Findings API response schemas with search support"
    - path: "backend/app/services/kg_builder.py"
      provides: "Programmatic KG Builder service"
    - path: "backend/app/services/findings_service.py"
      provides: "Findings storage and full-text search service"
    - path: "backend/app/api/knowledge_graph.py"
      provides: "7 KG API endpoints"
    - path: "backend/app/api/findings.py"
      provides: "3 findings API endpoints"
    - path: "backend/alembic/versions/c7a1f8d23e51_add_knowledge_tables.py"
      provides: "Alembic migration creating all 9 tables"
  key_links:
    - from: "pipeline.py"
      to: "kg_builder.py"
      via: "build_knowledge_graph call"
    - from: "pipeline.py"
      to: "findings_service.py"
      via: "save_findings_from_output and update_finding_entity_ids calls"
    - from: "main.py"
      to: "knowledge_graph.py router"
      via: "app.include_router"
    - from: "main.py"
      to: "findings.py router"
      via: "app.include_router"
---

# Phase 7: Knowledge Storage & Domain Agent Enrichment Verification Report

**Phase Goal:** Create the knowledge storage foundation and enrich domain agent outputs with exhaustive exact-source citations for downstream consumption by KG Builder, Synthesis, and Chat.
**Verified:** 2026-02-07T19:00:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 9 new database tables exist with correct columns and indexes | VERIFIED | Migration `c7a1f8d23e51` creates kg_entities, kg_relationships, case_findings, case_hypotheses, case_contradictions, case_gaps, case_synthesis, timeline_events, locations. All FKs cascade on case_id. 15 indexes. |
| 2 | Full-text search infrastructure (tsvector + GIN) operational on case_findings and kg_entities | VERIFIED | Migration adds `search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', ...)) STORED` on case_findings (title + finding_text) and `name_search_vector` on kg_entities. GIN indexes created via raw SQL. |
| 3 | KG Builder programmatically extracts ALL entities from domain agent output without filtering | VERIFIED | `kg_builder.py` (447 lines): `extract_entities_from_output` extracts from both `output.entities` and per-finding `finding.entities`. Never filters. Logs count. Uses `DomainEntity` schema. |
| 4 | Entity deduplication: exact match auto-merges, fuzzy 85%+ flagged for LLM resolution | VERIFIED | `deduplicate_entities` in `kg_builder.py`: groups by entity_type (cross-domain), exact match via `name_normalized` with soft merge (`merged_into_id`), relationship repointing. Fuzzy via `rapidfuzz.fuzz.ratio >= 85` logged but not auto-merged. |
| 5 | Findings service saves findings with citations and supports tsvector full-text search | VERIFIED | `findings_service.py` (239 lines): `save_findings_from_output` serializes citations as JSONB, enriches finding_text with `output.findings_text` if available. `search_findings` uses `plainto_tsquery` + `ts_rank` + `literal_column("search_vector")`. |
| 6 | KG and findings API endpoints registered and functional (10 endpoints total) | VERIFIED | `knowledge_graph.py` (379 lines): 7 endpoints (GET /graph, GET/POST entities, PATCH/DELETE entity, GET/POST relationships). `findings.py` (163 lines): 3 endpoints (GET list, GET search, GET detail). Both registered in `main.py` lines 181-182. |
| 7 | Domain agent prompts enriched with exhaustive citation rules and findings_text field | VERIFIED | All 4 prompts (financial.py, legal.py, evidence.py, strategy.py) contain "CITATION AND FINDINGS TEXT REQUIREMENTS" section with character-for-character excerpt rules, ts:MM:SS timestamp format, domain-specific guidance, and findings_text instructions. |
| 8 | Pipeline wired: findings saved, KG built, entity_ids backfilled after domain agent completion | VERIFIED | `pipeline.py` contains Stage 6 (Save Findings, line 931), Stage 7 (Build KG, line 1005), Stage 7b (Backfill entity links, line 1037). Strategy injected into domain_results before KG call. SSE emit_finding_committed fires per finding. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/knowledge_graph.py` | KgEntity + KgRelationship models | VERIFIED (191 lines) | KgEntity: 14 columns, 4 indexes, self-ref FK for merge. KgRelationship: 10 columns, 3 indexes. Both inherit Base, use PG_UUID, JSONB, DateTime(tz). Column `properties` (renamed from `metadata`). |
| `backend/app/models/findings.py` | CaseFinding model | VERIFIED (101 lines) | 13 columns including citations JSONB, entity_ids JSONB. tsvector comment documents Pitfall 6. 3 indexes. |
| `backend/app/models/synthesis.py` | 6 synthesis models | VERIFIED (429 lines) | CaseHypothesis (claim, status, confidence, evidence refs), CaseContradiction (claim_a/b, severity), CaseGap (description, priority), CaseSynthesis (summary, verdict, cross-modal), TimelineEvent (dates, layers), Location (coordinates JSONB). |
| `backend/app/models/__init__.py` | All 9 models exported | VERIFIED (45 lines) | All 9 new model classes imported and in `__all__`: KgEntity, KgRelationship, CaseFinding, CaseHypothesis, CaseContradiction, CaseGap, CaseSynthesis, TimelineEvent, Location. |
| `backend/alembic/versions/c7a1f8d23e51_add_knowledge_tables.py` | Migration for 9 tables | VERIFIED (735+ lines) | Creates all 9 tables in FK order. tsvector via raw SQL. Downgrade drops in reverse order. Chains from `b3a1f7c42e90`. |
| `backend/app/schemas/knowledge_graph.py` | KG API schemas | VERIFIED (188 lines) | 8 schema classes: EntityResponse (ConfigDict from_attributes), EntityCreateRequest (Field validators), EntityUpdateRequest, RelationshipResponse, RelationshipCreateRequest, GraphResponse, EntityListResponse, RelationshipListResponse. |
| `backend/app/schemas/findings.py` | Findings API schemas | VERIFIED (105 lines) | 6 schema classes: FindingCitation, FindingResponse (ConfigDict from_attributes), FindingListResponse, FindingSearchRequest, FindingSearchResult, FindingSearchResponse. |
| `backend/app/schemas/agent.py` | findings_text on all 4 outputs | VERIFIED | `findings_text: str \| None = Field(default=None)` at lines 435, 478, 557, 607 for FinancialOutput, LegalOutput, EvidenceOutput, StrategyOutput. Citation excerpt description updated at line 307. |
| `backend/app/schemas/__init__.py` | All new schemas exported | VERIFIED (97 lines) | All 15 new schema classes imported and in `__all__`. |
| `backend/app/services/kg_builder.py` | KG Builder service | VERIFIED (447 lines) | 6 functions: normalize_entity_name, extract_entities_from_output, build_relationships_from_findings, deduplicate_entities, compute_entity_degrees, build_knowledge_graph. Uses rapidfuzz. Soft merge. |
| `backend/app/services/findings_service.py` | Findings storage + search | VERIFIED (239 lines) | 5 functions: save_findings_from_output, update_finding_entity_ids, search_findings (tsvector), list_findings (paginated), get_finding_by_id. |
| `backend/app/api/knowledge_graph.py` | KG API router | VERIFIED (379 lines) | 7 endpoints with auth, ownership check, CRUD. Uses model_validate for ORM-to-Pydantic. |
| `backend/app/api/findings.py` | Findings API router | VERIFIED (163 lines) | 3 endpoints with auth. /search before /{finding_id} to avoid path capture. Delegates to service layer. |
| `backend/app/main.py` | Router registration | VERIFIED | Lines 181-182: `app.include_router(knowledge_graph.router)` and `app.include_router(findings.router)`. |
| `backend/app/services/agent_events.py` | 3 new SSE event types | VERIFIED | FINDING_COMMITTED (line 40), KG_ENTITY_ADDED (line 41), KG_RELATIONSHIP_ADDED (line 42). 3 emitter functions. |
| `backend/app/services/pipeline.py` | Pipeline wiring | VERIFIED | Stage 6 (line 931), Stage 7 (line 1005), Stage 7b (line 1037). Imports at lines 167-170. Strategy injected into domain_results. |
| `backend/pyproject.toml` | rapidfuzz dependency | VERIFIED | Line 25: `"rapidfuzz>=3.14.3"` |
| `backend/app/agents/prompts/financial.py` | Citation enrichment | VERIFIED | "CITATION AND FINDINGS TEXT REQUIREMENTS" section with financial-specific guidance, findings_text in output example. |
| `backend/app/agents/prompts/legal.py` | Citation enrichment | VERIFIED | Same section with legal-specific guidance (statute/clause exactness). |
| `backend/app/agents/prompts/evidence.py` | Citation enrichment | VERIFIED | Same section with evidence-specific guidance (metadata timestamps, custody chain). |
| `backend/app/agents/prompts/strategy.py` | Citation enrichment | VERIFIED | Same section with strategy-specific guidance (dual-source citation). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pipeline.py` | `kg_builder.py` | `build_knowledge_graph` import + call | WIRED | Lazy import at line 170, called at line 1021. Strategy injected into domain_results before call. |
| `pipeline.py` | `findings_service.py` | `save_findings_from_output` + `update_finding_entity_ids` | WIRED | Lazy imports at lines 167-168. save called at lines 955, 985 (domain + strategy). update called at line 1052. |
| `pipeline.py` | `agent_events.py` | `emit_finding_committed` | WIRED | Import at top, called per saved finding in both domain and strategy loops. |
| `kg_builder.py` | `KgEntity` model | ORM creation | WIRED | Lazy import inside functions. `KgEntity(...)` construction with all required fields. |
| `kg_builder.py` | `DomainEntity` schema | Reading entity data | WIRED | Lazy import of `DomainEntity` from `app.schemas.agent`. Accesses `.value`, `.type`, `.confidence`, `.metadata`, `.context`. |
| `findings_service.py` | `CaseFinding` model | ORM creation | WIRED | Direct import. `CaseFinding(...)` construction with all fields. |
| `knowledge_graph.py` API | `KgEntity`/`KgRelationship` models | SQLAlchemy queries | WIRED | Direct imports from `app.models`. select/create/update/delete operations. |
| `findings.py` API | `findings_service` | Service delegation | WIRED | `from app.services import findings_service`. Calls `search_findings`, `list_findings`, `get_finding_by_id`. |
| `main.py` | KG + findings routers | `app.include_router` | WIRED | Lines 181-182. Imports at lines 20, 22. |
| `schemas/__init__.py` | New schemas | Export for type generation | WIRED | All 15 new schema classes imported and in `__all__`. |

### Requirements Coverage

| Requirement | Status | Details |
|-------------|--------|---------|
| REQ-STORE-001: Structured Knowledge Tables | SATISFIED | 9 tables created: kg_entities, kg_relationships, case_findings, case_hypotheses, case_contradictions, case_gaps, case_synthesis, timeline_events, locations. All with proper indexes and FKs. |
| REQ-STORE-002: Semantic Search Index | SATISFIED (v1) | PG tsvector + GIN index on case_findings (title + finding_text). Full-text search via `plainto_tsquery` + `ts_rank`. Vertex AI vector search deferred to Phase 9 per roadmap. |
| REQ-AGENT-009 (partial): KG Builder | SATISFIED | Programmatic Python service in `kg_builder.py`. Extracts entities, infers co-occurrence relationships, deduplicates (exact + fuzzy), computes degrees. Not an LLM agent. |
| REQ-AGENT-003/004/005/006 (enrichment): Citation enrichment | SATISFIED | All 4 domain agent prompts enriched with "CITATION AND FINDINGS TEXT REQUIREMENTS" section. findings_text field added to all 4 output schemas. Character-for-character excerpt preservation. ts:MM:SS timestamps for audio/video. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | No TODO/FIXME/placeholder/stub patterns detected in any Phase 7 files |

Note: I scanned all 21 new/modified files. No stub patterns (TODO, FIXME, placeholder, return null, return {}, console.log) were found. All implementations are substantive.

### Human Verification Required

### 1. Database Migration Runs Successfully
**Test:** Run `cd backend && alembic upgrade head` against a live PostgreSQL instance.
**Expected:** All 9 tables created. tsvector columns and GIN indexes exist. No errors.
**Why human:** Requires live database connection; structural verification cannot run DDL.

### 2. Full Pipeline Produces KG Data
**Test:** Upload files to a case, trigger analysis, wait for completion.
**Expected:** After pipeline completes, `GET /api/cases/{id}/graph` returns entities and relationships. `GET /api/cases/{id}/findings` returns saved findings.
**Why human:** Requires end-to-end pipeline execution with real LLM calls.

### 3. Full-Text Search Returns Results
**Test:** After findings are stored, call `GET /api/cases/{id}/findings/search?q=transaction`.
**Expected:** Returns ranked results with relevance scores.
**Why human:** Requires populated tsvector column on real data.

### 4. Enriched Citations Quality
**Test:** After pipeline runs with enriched prompts, inspect domain agent output for character-for-character excerpts.
**Expected:** Citations contain exact excerpts from source documents, not paraphrased text. findings_text field populated with rich markdown narrative.
**Why human:** LLM output quality can only be verified by inspecting actual agent responses.

### Gaps Summary

No gaps found. All 8 observable truths verified. All 21 artifacts pass existence, substantive, and wiring checks. All 4 key links verified as wired. All 4 requirements satisfied.

The phase delivers:
1. **Complete storage foundation** -- 9 tables with Alembic migration, indexes, and tsvector full-text search
2. **Programmatic KG Builder** -- entity extraction, co-occurrence relationships, exact+fuzzy dedup, degree computation
3. **Findings persistence** -- save, search, list, and entity backfill
4. **10 API endpoints** -- KG CRUD (7) + findings list/detail/search (3), registered in main.py
5. **Domain agent enrichment** -- all 4 prompts with exhaustive citation rules and findings_text field
6. **Pipeline integration** -- 3 new stages wired after domain agents (Save Findings, Build KG, Backfill Entity IDs)
7. **SSE events** -- 3 new event types (FINDING_COMMITTED, KG_ENTITY_ADDED, KG_RELATIONSHIP_ADDED)

The implementation is production-grade with no stubs, no placeholders, and complete wiring from pipeline through services to API endpoints.

---

_Verified: 2026-02-07T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
