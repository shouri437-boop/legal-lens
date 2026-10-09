# Legal Lens Project State

**Last Updated:** 2026-02-09
**Current Phase:** 9 of 12 (Chat Interface) — COMPLETE (2/2 plans)
**Next Phase:** 11 (Corrections & Refinement)
**Current Milestone:** M1 - Legal Lens v1.0

## Progress Overview

| Phase | Name | Status | Started | Completed | Notes |
|-------|------|--------|---------|-----------|-------|
| 1 | Foundation Infrastructure | COMPLETE | 2026-01-21 | 2026-01-22 | |
| 1.1 | Frontend Design Foundation | COMPLETE | 2026-01-23 | 2026-01-24 | |
| 2 | Authentication & Case Shell | COMPLETE | 2026-01-24 | 2026-01-25 | |
| 3 | File Ingestion | COMPLETE | 2026-02-02 | 2026-02-02 | Verified 6/6 truths |
| 4 | Core Agent System | COMPLETE | 2026-02-03 | 2026-02-03 | Verified 6/6 must-haves |
| 4.1 | Agent Decision Tree Revamp | COMPLETE | 2026-02-04 | 2026-02-04 | 4 plans (18 commits): deps/config, DecisionNode/Sidebar, ReactFlow canvas, muted palette/FileRoutingEdge/page-level sidebar |
| 5 | Agent Flow | COMPLETE | 2026-02-04 | 2026-02-05 | SSE pipeline complete; HITL infra built but verification deferred to Phase 6+ |
| 6 | Domain Agents | COMPLETE | 2026-02-06 | 2026-02-06 | 5 plans (14 commits) + 21 post-plan commits (35 total): refactoring, routing HITL, production hardening, live-testing bugfixes |
| 7 | Knowledge Storage & Domain Agent Enrichment | COMPLETE | 2026-02-07 | 2026-02-07 | 6 plans (11 commits), 8/8 verified: 9 DB models + migration, KG/findings schemas, KG Builder + findings service, prompt enrichment, 10 API endpoints, pipeline wiring |
| 7.1 | LLM-Based KG Builder Agent | COMPLETE | 2026-02-08 | 2026-02-08 | 2 plans (4 commits): schema evolution, Pydantic schemas, agent runner/prompt/factory, pipeline wiring |
| 7.2 | KG Frontend (D3.js Enhancement) | COMPLETE | 2026-02-08 | 2026-02-08 | 5 plans (46 commits): types/config/API, source viewer system, GraphSvg D3 force canvas, FilterPanel/EntityTimeline, page integration + 4 rounds visual polish. Source viewer wiring deferred to Phase 10. |
| 7.3 | KG Frontend (vis-network) | DEFERRED | - | - | Optional; only if D3.js proves insufficient |
| 8 | Synthesis Agent & Intelligence Layer | COMPLETE | 2026-02-08 | 2026-02-09 | 7 plans (16 commits) + 3 bugfix commits: DB models + schemas, agent runner/prompt/factory, pipeline Stage 8, SSE events, 8 API endpoints, frontend types/api/hooks, 7 Verdict components, 3 detail panels, CC tab toggle + SSE synthesis readiness, timeline API wiring, verdict badges. Post-fix: Gemini schema compat, pipeline crash fixes, gap entity resolution with names/types, KG event routing |
| 8.1 | Geospatial Agent & Map View | COMPLETE | 2026-02-09 | 2026-02-09 | 5 plans (5 commits): GeocodingService, GeospatialAgentRunner + pipeline Stage 9, 6 REST API endpoints, frontend API client + hook + trigger UI, enhanced detail panel with 4 sections |
| 9 | Chat Interface & Research | COMPLETE | 2026-02-09 | 2026-02-09 | 2 plans (4 commits): backend (4 tools, SSE endpoint, chat service) + frontend (SSE hook, markdown, citations, tool activity, stop/clear) |
| 10 | Source Panel & Entity Resolution | COMPLETE | 2026-02-09 | 2026-02-09 | 3 plans (9 commits), 9/9 verified: shared citation utils + hooks, KG + Geospatial source wiring + entity resolution, Verdict + Timeline citation navigation |
| 11 | Corrections & Refinement | NOT_STARTED | - | - | |
| 12 | Demo Preparation | NOT_STARTED | - | - | |

**Status Legend:** COMPLETE | FRONTEND_DONE (backend pending and its connection to the frontend must also be made) | NOT_STARTED

---

## Current Context

**What was just completed:**
- **Phase 9 COMPLETE** (2026-02-09): Chat Interface -- 2 plans, 4 commits
  - Plan 01 (Backend): 4 closure-based tool factories, chat_service.py, SSE POST endpoint with 5 event types, system prompt with full synthesis context
  - Plan 02 (Frontend): @microsoft/fetch-event-source SSE hook, markdown rendering (react-markdown + remark-gfm), inline citation chips opening SourceViewerModal, tool activity expandable section, stop/clear buttons, disabled state, error bubbles with retry
  - Full user flow: type message -> SSE stream tokens -> markdown + citations -> click citation -> SourceViewerModal

- **Phase 10 COMPLETE** (2026-02-09): Source Panel & Entity Resolution -- 3 plans, 9 commits, 9/9 verified
  - Plan 01: Shared foundation (citation-utils, useSourceNavigation, useEntityResolver, CitationLink, EntityBadge)
  - Plan 02: KG entity panel source docs clickable, EntityTimelineEntry "View source evidence", Geospatial entity resolution + citation-to-source
  - Plan 03: Verdict hypothesis/contradiction evidence clickable, GapDetailPanel EntityBadge, Timeline expandable citation list
  - All 4 target views have functional citation-to-source navigation: KG, Geospatial, Verdict, Timeline

- **Phase 8.1 Complete** (2026-02-09): Geospatial Agent & Map View — 5 plans, 15 commits, 15/15 verified
  - Plan 01: GeocodingService with Google Maps API integration (forward/reverse/batch geocoding + in-memory caching)
  - Plan 02: GeospatialAgentRunner (text-only input from 6 DB sources, Flash model, pipeline Stage 9, auto-geocoding)
  - Plan 03: 6 REST API endpoints (POST /generate, GET /status, GET /locations, GET /locations/:id, GET /paths, DELETE)
  - Plan 04: Frontend API client + useGeospatialData hook + trigger UI (Generate/Refresh buttons, status banner, 3-second polling)
  - Plan 05: Enhanced GeospatialMap with 4-section detail panel (Events, Citations, Temporal Analysis, Related Entities)
  - Full pipeline: Triage → Orchestrator → Domain → Strategy → HITL → Save Findings → KG Builder → Entity Backfill → Synthesis → Geospatial (on-demand) → Final

**Phase 7 Complete** (2026-02-07): Knowledge Storage & Domain Agent Enrichment — 6 plans, 11 commits, 8/8 verified
  - Plan 01: 9 SQLAlchemy models (KgEntity, KgRelationship, CaseFinding, CaseHypothesis, CaseContradiction, CaseGap, CaseSynthesis, TimelineEvent, Location) + Alembic migration with tsvector GIN indexes
  - Plan 02: 15 Pydantic API schemas (KG + findings) + findings_text added to all 4 domain output models
  - Plan 03: KG Builder service (entity extraction, co-occurrence relationships, exact+fuzzy dedup, degree computation) + Findings service (storage, tsvector search, pagination)
  - Plan 04: Citation enrichment in all 4 domain agent prompts (exact excerpts, timestamp locators, findings_text narrative)
  - Plan 05: 10 API endpoints (7 KG CRUD + 3 findings) registered in main.py
  - Plan 06: 3 SSE event types + pipeline wiring (Save Findings → Build KG → Backfill Entity IDs)
  - Full pipeline: Triage → Orchestrator → Domain → Strategy → HITL → Save Findings → Build KG → Backfill Entity IDs → Final

**Architecture revision (2026-02-08):**
- Programmatic KG Builder replaced with LLM-based KG Builder Agent (Approach 4)
  - Research: Microsoft GraphRAG, KGGen (NeurIPS '25), LINK-KG, Epstein Doc Explorer all validate LLM-based KG construction
  - Root cause of poor graph quality: co-occurrence relationships + zero entity filtering + granular entity types
  - LLM agent sees ALL domain outputs holistically → cross-domain connections + semantic relationships + natural dedup
- D3.js retained as primary graph library (not replaced by vis-network)
  - Epstein Doc Explorer proves D3.js force simulation produces excellent investigative graphs
  - vis-network deferred to optional Phase 7.3
- New phase structure: 7.1 (LLM KG Builder) → 7.2 (D3.js Enhancement) → 7.3 (vis-network, optional)

**Phase 7.1 Complete** (2026-02-08): LLM-Based KG Builder Agent -- 2 plans, 4 commits
  - Plan 01: Alembic migration adding 10 new nullable columns + KgBuilderOutput Pydantic schemas with integer ID cross-referencing
  - Plan 02: KgBuilderAgentRunner with text-only input, KG_BUILDER_SYSTEM_PROMPT (8+1 entity taxonomy), AgentFactory.create_kg_builder_agent(), DB writer with clear-and-rebuild, pipeline Stage 7 replaced with LLM invocation
  - Full pipeline: Triage -> Orchestrator -> Domain -> Strategy -> HITL -> Save Findings -> LLM KG Builder -> Backfill Entity IDs -> Final

**Phase 7.2 Plan 01 Complete** (2026-02-08): Foundation types, config, and API layer -- 2 tasks, 2 commits
  - Task 1: d3-scale installed, knowledge-graph.ts rewritten with EntityResponse/RelationshipResponse/GraphResponse/ForceNode/ForceLink/GraphFilters matching backend schemas
  - Task 2: knowledge-graph-config.ts (9 entity colors, force/node/edge/SVG config), api/graph.ts (fetchGraph with auth), use-case-graph.ts refactored to real API

**Phase 7.2 Plan 02 Complete** (2026-02-08): Source viewer modal and media components -- 3 tasks, 3 commits
  - Task 1: 8 media deps (react-pdf-viewer suite, pdfjs-dist, wavesurfer.js, @wavesurfer/react), SourceViewerModal shell, PdfViewer with page-navigation + search/highlight
  - Task 2: AudioViewer (wavesurfer.js waveform + transcript), VideoViewer (HTML5 + markers), ImageViewer (zoom/pan)
  - Task 3: evidence-source-panel refactored from 462-line mock monolith to 58-line thin wrapper, detail-sidebar types updated

**Phase 7.2 Plan 03 Complete** (2026-02-08): GraphSvg D3 force canvas -- 2 tasks, 2 commits
  - Task 1: useGraphSimulation (5 forces, sqrt-scaled nodes, radial centrality, edge deduplication, D3 ref-based tick updates) + useGraphSelection (selection highlighting + search match highlighting in separate useEffects)
  - Task 2: GraphSvg component (dark SVG canvas, dot pattern, zoom/pan controls, simulation toggle, node/edge tooltips, background click deselect, searchMatchIds prop)
  - Performance pattern: zero React re-renders during simulation (D3 refs only)

**Phase 7.2 Plan 04 Complete** (2026-02-08): FilterPanel + EntityTimeline -- 2 tasks, 2 commits
  - Task 1: useGraphFilters (disabled-set pattern for lint-safe state, domain/type toggles, keyword filtering, search highlighting), FilterPanel (collapsible left panel: stats, search, keyword filter, 4 domain toggles, 9 entity type toggles)
  - Task 2: EntityTimeline (right sidebar: gradient header, date range, filter-by-entity, chronological list), EntityTimelineEntry (expandable: color-coded entities, evidence excerpt, corroboration badge, "Source not yet available" graceful degradation)

**Phase 7.2 Plan 05 Complete** (2026-02-08): KnowledgeGraphCanvas integration + 4 rounds visual polish -- 29 commits
  - Core: KnowledgeGraphCanvas 3-panel orchestrator (CanvasShell + GraphSvg + FilterPanel + SourceViewerModal), page rewrite with real API data
  - Round 1 (8 commits): CanvasShell/CollapsibleSection shared components, entity detail in app-wide DetailSidebar, floating FilterPanel, node shapes + icons, edge label disclosure, font normalization
  - Round 2 (6 commits): dot-pattern zoom scaling, tiered node sizing, composite edge weight, glassy node gradients, glass-blur tooltips, QC fixes (stale closure, tooltip overflow)
  - Round 3 (8 commits): simulation lifecycle stabilized on resize (no teardown), zoom performance (removed 100k rect), vibrant node colors, unified entity badge styling (CC + KG), sidebar text contrast, click-to-navigate connected entities, QC fix (callback ref stabilization), agent key alias (kg_builder)
  - Round 4 (6 commits): timeline text smoke colors for readability, CC-style borderless nodes with ambient glow, zoom-to-node on sidebar click, forceSelect sync for sidebar-triggered selection highlighting, date label sizing
  - **Source viewer NOT wired:** source_finding_ids → file URL chain requires backend API. Deferred to Phase 10.
  - Full summary: `.planning/phases/07.2-kg-frontend-d3-enhancement/07.2-05-SUMMARY.md`

**Phase 8 Plan 01 Complete** (2026-02-08): Synthesis schema foundation -- 2 tasks, 2 commits
  - Task 1: InvestigationTask model (12 columns, FKs to case_hypotheses/case_contradictions/case_gaps) + Case verdict_label/verdict_summary columns + Alembic migration f8a3b2c91d40
  - Task 2: SynthesisOutput Pydantic schema (12 fields for Gemini structured output) + 9 API response schemas with model_validators (evidence merge, JSONB verdict parse)

**Phase 8 Plan 02 Complete** (2026-02-09): Synthesis Agent runner + pipeline integration -- 2 tasks, 2 commits
  - Task 1: SynthesisAgentRunner (DomainAgentRunner[SynthesisOutput] subclass, text-only input), assemble_synthesis_input() (5 data sources: case, files, findings, entities, relationships), write_synthesis_output() (6 tables + Case verdict), SYNTHESIS_SYSTEM_PROMPT (12-field output instructions + citation/quality rules), AgentFactory.create_synthesis_agent()
  - Task 2: Pipeline Stage 8 after entity backfill (agent-started/agent-complete/agent-error SSE events), SYNTHESIS_DATA_READY event type + emit helper, non-blocking failure handling
  - Full pipeline: Triage -> Orchestrator -> Domain -> Strategy -> HITL -> Save Findings -> KG Builder -> Entity Backfill -> Synthesis -> ANALYZED -> processing-complete

**Phase 8 Plan 03 Complete** (2026-02-09): Synthesis API endpoints -- 2 tasks, 2 commits
  - Task 1: 6 synthesis endpoints (/synthesis, /hypotheses list+detail, /contradictions, /gaps, /tasks) with auth, sa_case() ordering, status/severity/priority/task_type filters
  - Task 2: 2 timeline endpoints (/timeline list with dateRange+layerCounts aggregation, /timeline/{id}), TimelineApiResponseModel schema, synthesis+timeline routers registered in main.py
  - All 8 endpoints enforce auth + case ownership following knowledge_graph.py pattern

**Phase 8 Plan 04 Complete** (2026-02-09): Synthesis frontend data layer -- 2 tasks, 2 commits
  - Task 1: 11 TypeScript interfaces in synthesis.ts matching backend Pydantic Category B schemas (SynthesisEvidenceItem, HypothesisResponse, ContradictionResponse, GapResponse, TaskResponse, SynthesisResponse, VerdictResponse, KeyFindingResponse, TimelineEventResponse, TimelineApiResponse)
  - Task 2: 5 fetch functions in api/synthesis.ts using shared api client (fetchSynthesis with 404->null, fetchHypotheses, fetchContradictions, fetchGaps, fetchTasks) + 5 React Query hooks in useSynthesisData.ts with 30s stale time
  - Used shared api-client.ts instead of duplicating fetchWithAuth (consistent with useAgentExecutionDetail.ts pattern)

**Phase 8 Plan 05 Complete** (2026-02-09): Verdict frontend components -- 2 tasks, 2 commits
  - Task 1: 6 card components (VerdictSummary, KeyFindingCard, HypothesisCard, ContradictionCard, GapCard, TaskCard) with Legal Lens dark theme, confidence dots (red/amber/green), severity badges, side-by-side claim comparison
  - Task 2: VerdictView main layout (6 scrollable sections with count badges, loading skeletons, empty states), 3 verdict sidebar descriptor types (VerdictHypothesisContent, VerdictContradictionContent, VerdictGapContent) added to SidebarContentDescriptor union, placeholder switch cases in detail-sidebar.tsx

**Phase 8 Plan 06 Complete** (2026-02-09): Command Center integration -- 2 tasks, 2 commits
  - Task 1: 3 verdict detail panels (HypothesisDetailPanel, ContradictionDetailPanel, GapDetailPanel) wired into DetailSidebar via SidebarContentDescriptor union
  - Task 2: "synthesis" added to AgentType union + validation + config + CSS vars, SynthesisDataReadyEvent SSE handling, synthesisReady state in useAgentStates (SSE event + state-snapshot detection), CC page tab toggle (Agent Flow / Verdict) with URL param persistence + disabled state with pulse indicator, React Query cache invalidation on synthesis-data-ready

**Phase 8 Plan 07 Complete** (2026-02-09): Timeline wiring + verdict badges -- 2 tasks, 2 commits
  - Task 1: Timeline wired to real synthesis API data (mock fallback removed), "financial" layer added to TimelineLayer/LAYER_CONFIG/filters/eventProcessors, JWT auth in timeline API client, backend-to-frontend field transformation (event_date->date), event type category badge on cards
  - Task 2: Backend CaseResponse schema + verdict_label/verdict_summary fields, VerdictLabel type in frontend, verdict badge in case header (Conclusive/Substantial/Inconclusive) with summary subtitle, verdict badge in CaseCard (grid+list), "Pending Analysis" badge for READY cases without verdict

**Phase 8 COMPLETE** (2026-02-09): Synthesis Agent & Intelligence Layer -- 7 plans, 16 commits + 3 bugfix commits
  - Full pipeline: Triage -> Orchestrator -> Domain -> Strategy -> HITL -> Save Findings -> KG Builder -> Entity Backfill -> Synthesis -> ANALYZED -> processing-complete
  - Backend: 9 DB models, Alembic migration, SynthesisAgentRunner, 8 API endpoints (synthesis + timeline), SSE synthesis-data-ready event
  - Frontend: 11 TypeScript interfaces, 5 API functions, 5 React Query hooks, VerdictView (6 sections), 3 detail panels, CC tab toggle, timeline wired to real API, verdict badges in case header + list
  - Post-fix 1: `CrossModalLink` typed model replaces `dict[str, str]` (Gemini rejects `additionalProperties` in JSON Schema)
  - Post-fix 2: `CaseFile.mime_type` (was `.content_type`), timeline date string→datetime parsing, Timeline ref hydration + scroll-position warnings
  - Post-fix 3: Gap entity display uses actual UUIDs (not position indices), `RelatedEntity` model with batch resolution in gaps API, entity name + type badge in GapDetailPanel; `_extract_agent_type` uses rsplit for multi-word prefixes (kg_builder → "kg" bug)

**Phase 8.1 Plan 01 Complete** (2026-02-09): Geocoding Service Foundation -- 2 tasks, 2 commits
  - Task 1: googlemaps>=4.10.0 dependency added and installed
  - Task 2: GeocodingService class with forward/reverse/batch geocoding, in-memory caching, async interface via asyncio.to_thread
  - Capabilities: address → {lat, lng}, {lat, lng} → address, batch geocoding with concurrent execution
  - Error handling: Returns None on failure, logs warnings, caches failed results to avoid redundant API calls
  - Type checking passes with googlemaps type ignores for incomplete library stubs

**Phase 8.1 Plan 02 Complete** (2026-02-09): Geospatial Agent Implementation -- 2 tasks, 2 commits (6 min)
  - Task 1: GeospatialOutput schema (Citation, EventAtLocation, LocationOutput, PathOutput) + GEOSPATIAL_SYSTEM_PROMPT (8-section structure)
  - Task 2: GeospatialAgentRunner subclass (text-only input from 6 DB sources), write_geospatial_output (clear-and-rebuild + auto-geocoding), Pipeline Stage 9 integration
  - Flash model with medium thinking for cost efficiency
  - SSE geospatial-complete event emitted after location data committed
  - Non-blocking pipeline failure (geospatial failure logs warning, doesn't crash pipeline)
  - Adapts to existing Location schema (coordinates/temporal_associations JSONB)

**Phase 8.1 Plan 03 Complete** (2026-02-09): Locations API Endpoints -- 2 tasks, 2 commits (7 min)
  - Task 1: 6 REST endpoints in locations.py (POST generate, GET status, GET list, GET detail, GET paths, DELETE)
  - Task 2: Router registration in main.py
  - All endpoints enforce auth via CurrentUser + case ownership via _get_user_case helper
  - Async task spawning with asyncio.create_task for non-blocking generation
  - SSE events: emit_agent_started + emit_geospatial_complete
  - Adapted response structure to actual Location schema (coordinates JSONB, temporal_associations JSONB)
  - Detail endpoint extracts events and temporal periods from temporal_associations JSONB
  - Type checking passes (pyright 0 errors)

**Phase 8.1 Plan 04 Complete** (2026-02-09): Geospatial Frontend Integration -- 2 tasks, 2 commits (12 min)
  - Task 1: geospatial.ts API client (5 functions: status, generate, locations, detail, delete), useGeospatialData hook with polling
  - Task 2: Geospatial page updated with trigger UI (status banner, generate/refresh buttons), Button/Alert components created
  - Status banner state machine: not_started → generating → complete
  - 3-second polling interval during generation until status becomes "complete"
  - Refresh button with confirmation pattern (click twice to execute)
  - LocationResponse → Landmark transformation in hook layer
  - Mock data completely removed from geospatial page

**Phase 8.1 Plan 05 Complete** (2026-02-09): Geospatial Map Detail Panel Enhancement -- 1 plan, 1 commit (4 min)
  - Enhanced GeospatialMap with 4-section detail panel: Events, Citations, Temporal Analysis, Related Entities
  - fetchLocationDetail API integration on marker click with loading states
  - Citations section displays file name, locator, excerpt with View button (Phase 10 integration point)
  - Temporal Analysis shows date range from temporal_associations JSONB field
  - Related Entities displays entity UUIDs (names deferred to Phase 10)
  - Lazy detail loading pattern: fetch on marker click, not during initial map render

**Phase 8.1 COMPLETE** (2026-02-09): Geospatial Agent & Map View -- 5 plans, 5 commits (38 min total)
  - Backend: GeocodingService (forward/reverse/batch with caching), GeospatialAgentRunner (Flash model, auto-geocoding), 6 REST API endpoints
  - Frontend: API client + useGeospatialData hook, trigger UI with status tracking, Button/Alert reusable components, enhanced detail panel with 4 sections
  - Full user flow: Generate button → 3-second polling → location extraction + geocoding → map display → click marker → detailed evidence context
  - Known limitations: Paths not rendered (v1), no SSE streaming (polling-based), entity names not resolved (UUIDs only)

**Phase 9 COMPLETE** (2026-02-09): Chat Interface & Research -- 2 plans, 6 commits, 20/20 verified
  - Plan 01: Backend -- 4 closure-based tool factories (query_knowledge_graph, get_findings with detail/list modes, get_synthesis, search_findings), build_chat_system_prompt with full context injection, chat_service (load_chat_context + create_chat_agent_and_runner with ADK session_service), SSE POST endpoint with 5 event types, router registered
  - Plan 02: Frontend -- @microsoft/fetch-event-source SSE streaming, useChatbot hook rewrite with AbortController + session persistence, ReactMarkdown + remark-gfm rendering, [[file_id|locator|label]] citation chips with SourceViewerModal, tool activity expandable section, stop/clear buttons, disabled state, error bubbles with retry
  - Full flow: User types message → POST SSE → Flash agent queries DB tools → tokens stream → citations parsed → markdown rendered → SourceViewerModal on click

**What's next:**
- Phase 11 (Corrections & Refinement) -- polish, bug fixes, integration testing
- Phase 12 (Demo Preparation) -- demo scenarios, sample data, walkthrough

---

## Implementation Mapping: Requirements -> Files

### REQ-VIS-001: Agent Flow — COMPLETE

| Component | File Path |
|-----------|-----------|
| Main container | `frontend/src/components/CommandCenter/CommandCenter.tsx` |
| Agent canvas (ReactFlow) | `frontend/src/components/CommandCenter/AgentFlowCanvas.tsx` |
| Decision nodes (ReactFlow) | `frontend/src/components/CommandCenter/DecisionNode.tsx` |
| File group nodes (ReactFlow) | `frontend/src/components/CommandCenter/FileGroupNode.tsx` |
| File routing edges (ReactFlow) | `frontend/src/components/CommandCenter/FileRoutingEdge.tsx` |
| Details sidebar (page-level) | `frontend/src/components/CommandCenter/NodeDetailsSidebar.tsx` |
| Agent state management hook | `frontend/src/hooks/useAgentStates.ts` |
| Graph building + layout hook | `frontend/src/hooks/useAgentFlowGraph.ts` |
| SSE hook | `frontend/src/hooks/useCommandCenterSSE.ts` |
| Node/edge construction | `frontend/src/lib/command-center-graph.ts` |
| Dagre layout engine | `frontend/src/lib/command-center-layout.ts` |
| Config (muted palette) | `frontend/src/lib/command-center-config.ts` |
| Shared zoom controls | `frontend/src/components/ui/canvas-zoom-controls.tsx` |
| Mock data (demo mode) | `frontend/src/lib/mock-command-center-data.ts` |
| Types | `frontend/src/types/command-center.ts` |
| Command center page | `frontend/src/app/(app)/cases/[id]/command-center/page.tsx` |
| Command center demo page | `frontend/src/app/(app)/cases/[id]/command-center-demo/page.tsx` |
| HITL confirmation modal | `frontend/src/components/CommandCenter/ConfirmationModal.tsx` |
| Execution timeline (Gantt) | `frontend/src/components/CommandCenter/ExecutionTimeline.tsx` |
| Confirmations API client | `frontend/src/lib/api/confirmations.ts` |
| SSE event validation | `frontend/src/lib/command-center-validation.ts` |
| Agent nodes (legacy, dead code) | `frontend/src/components/CommandCenter/AgentNode.tsx` |
| Details panel (legacy, dead code) | `frontend/src/components/CommandCenter/AgentDetailsPanel.tsx` |
| **Backend: SSE endpoint** | `backend/app/api/sse.py` |
| **Backend: Agent events pub/sub** | `backend/app/services/agent_events.py` |
| **Backend: Confirmation service** | `backend/app/services/confirmation_service.py` |
| **Backend: Confirmation API** | `backend/app/api/confirmations.py` |
| **Backend: Agent callbacks + SSE publish** | `backend/app/agents/base.py` |
| **Backend: Pipeline orchestration** | `backend/app/api/agents.py` |
| **Backend: DomainAgentRunner base** | `backend/app/agents/domain_agent_runner.py` |
| **Backend: Domain runner (parallel)** | `backend/app/agents/domain_runner.py` |
| **Backend: Shared parsing helpers** | `backend/app/agents/parsing.py` |
| **Backend: State snapshots** | `backend/app/api/sse.py` |

**Backend API:** ✅ Complete
- `SSE GET /sse/cases/:caseId/command-center/stream` (state-snapshot, thinking-update, tool-called, agent lifecycle, confirmation events)
- `POST /api/cases/:caseId/confirmations/:requestId` (approve/reject HITL confirmation)
- `GET /api/cases/:caseId/confirmations/pending` (list pending confirmations)

---

### REQ-VIS-003: Knowledge Graph — COMPLETE (Source viewer wired in Phase 10 Plan 02)

| Component | File Path |
|-----------|-----------|
| **Canvas orchestrator** | `frontend/src/components/knowledge-graph/KnowledgeGraphCanvas.tsx` |
| GraphSvg D3 force canvas | `frontend/src/components/knowledge-graph/GraphSvg.tsx` |
| Entity detail panel (DetailSidebar) | `frontend/src/components/knowledge-graph/KnowledgeGraphEntityPanel.tsx` |
| Force simulation hook | `frontend/src/hooks/useGraphSimulation.ts` |
| Selection/search hook | `frontend/src/hooks/useGraphSelection.ts` |
| Filter state hook | `frontend/src/hooks/useGraphFilters.ts` |
| Filter panel (floating left) | `frontend/src/components/knowledge-graph/FilterPanel.tsx` |
| Entity timeline (in DetailSidebar) | `frontend/src/components/knowledge-graph/EntityTimeline.tsx` |
| Timeline entry | `frontend/src/components/knowledge-graph/EntityTimelineEntry.tsx` |
| Canvas shell (shared UI) | `frontend/src/components/ui/canvas-shell.tsx` |
| Collapsible section (shared UI) | `frontend/src/components/ui/collapsible-section.tsx` |
| Source viewer modal | `frontend/src/components/source-viewer/SourceViewerModal.tsx` |
| PDF viewer | `frontend/src/components/source-viewer/PdfViewer.tsx` |
| Audio viewer | `frontend/src/components/source-viewer/AudioViewer.tsx` |
| Video viewer | `frontend/src/components/source-viewer/VideoViewer.tsx` |
| Image viewer | `frontend/src/components/source-viewer/ImageViewer.tsx` |
| Data hook (real API) | `frontend/src/hooks/use-case-graph.ts` |
| API client | `frontend/src/lib/api/graph.ts` |
| Visualization config + badge styles | `frontend/src/lib/knowledge-graph-config.ts` |
| Detail sidebar types | `frontend/src/types/detail-sidebar.ts` |
| Detail sidebar dispatch | `frontend/src/components/app/detail-sidebar.tsx` |
| Types (backend-matching) | `frontend/src/types/knowledge-graph.ts` |
| Main visualization (legacy, superseded) | `frontend/src/components/app/knowledge-graph.tsx` |
| Mock data (legacy, superseded) | `frontend/src/lib/mock-graph-data.ts` |

**Backend APIs:** All complete
- `GET /api/cases/:caseId/graph` - Full graph visualization data
- `GET /api/cases/:caseId/entities` - List entities with filters
- `POST /api/cases/:caseId/entities` - Create entity
- `PATCH /api/cases/:caseId/entities/:entityId` - Update entity
- `DELETE /api/cases/:caseId/entities/:entityId` - Delete entity
- `GET /api/cases/:caseId/relationships` - List relationships with filters
- `POST /api/cases/:caseId/relationships` - Create relationship

---

### REQ-VIS-004: Timeline — COMPLETE (SSE streaming deferred)

| Component | File Path |
|-----------|-----------|
| Main container | `frontend/src/components/Timeline/Timeline.tsx` |
| Core visualization | `frontend/src/components/Timeline/TimelineCore.tsx` |
| Controls | `frontend/src/components/Timeline/TimelineControls.tsx` |
| Header | `frontend/src/components/Timeline/TimelineHeader.tsx` |
| Event card | `frontend/src/components/Timeline/TimelineEventCard.tsx` |
| Skeleton | `frontend/src/components/Timeline/TimelineSkeleton.tsx` |
| Data hook | `frontend/src/hooks/useTimelineData.ts` |
| Filter hook | `frontend/src/hooks/useTimelineFilters.ts` |
| SSE hook | `frontend/src/hooks/useTimelineSSE.ts` |
| API client | `frontend/src/lib/api/timelineApi.ts` |
| Cache | `frontend/src/lib/cache/timelineCache.ts` |
| Mock data | `frontend/src/lib/mock-timeline-data.ts` |
| Types | `frontend/src/types/timeline.types.ts` |

**Backend APIs:**
- `GET /api/cases/:caseId/timeline` - List events with filters + aggregation (DONE)
- `GET /api/cases/:caseId/timeline/:id` - Get single event (DONE)
- `POST /api/cases/:caseId/timeline/events` - Create event (TODO)
- `PATCH/DELETE /api/cases/:caseId/timeline/events/:eventId` - Update/delete (TODO)
- `SSE GET /api/cases/:caseId/timeline/stream` - Real-time updates (TODO)

---

### REQ-CHAT-001: Chat Interface — COMPLETE

| Component | File Path |
|-----------|-----------|
| Chatbot UI | `frontend/src/components/app/chatbot.tsx` |
| Chat hook | `frontend/src/hooks/useChatbot.ts` |
| Types | `frontend/src/types/chatbot.ts` |
| **Backend: Chat tools** | `backend/app/agents/chat_tools.py` |
| **Backend: Chat prompt** | `backend/app/agents/prompts/chat.py` |
| **Backend: Chat service** | `backend/app/services/chat_service.py` |
| **Backend: Chat API** | `backend/app/api/chat.py` |

**Backend API:** `POST /api/cases/:caseId/chat` (SSE streaming) -- DONE
**Frontend wiring:** useChatbot.ts SSE streaming, chatbot.tsx markdown + citations + tool activity -- DONE

---

### REQ-CASE-005: Case Library / Evidence Library — COMPLETE

| Component | File Path |
|-----------|-----------|
| Library UI | `frontend/src/components/library/CaseLibrary.tsx` |
| API client | `frontend/src/lib/api/files.ts` |
| Upload hook | `frontend/src/hooks/useFileUpload.ts` |

**Backend APIs:** All complete
- `GET /api/cases/:caseId/files` - List files
- `POST /api/cases/:caseId/files` - Upload file
- `DELETE /api/cases/:caseId/files/:fileId` - Delete file
- `GET /api/cases/:caseId/files/:fileId/download` - Download via signed URL
- `SSE /sse/cases/:caseId/files` - Real-time status updates

---

### Navigation / Layout — COMPLETE

| Component | File Path |
|-----------|-----------|
| Case layout | `frontend/src/app/(app)/cases/[id]/layout.tsx` |
| Tab bar | `frontend/src/components/ui/expandable-tabs.tsx` |

---

## API Contracts Summary

All frontend features need these backend endpoints:

| Feature | Endpoint | Method | Priority | Status |
|---------|----------|--------|----------|--------|
| File Ingestion | `/api/cases/:caseId/files` | GET, POST, DELETE | HIGH | DONE |
| File Download | `/api/cases/:caseId/files/:fileId/download` | GET | HIGH | DONE |
| File SSE | `/sse/cases/:caseId/files` | SSE | HIGH | DONE |
| Chat | `/api/cases/:caseId/chat` | POST (SSE) | HIGH | DONE |
| Knowledge Graph | `/api/cases/:caseId/graph` | GET | HIGH | DONE |
| KG Entities | `/api/cases/:caseId/entities` | GET, POST, PATCH, DELETE | MEDIUM | DONE |
| KG Relationships | `/api/cases/:caseId/relationships` | GET, POST | MEDIUM | DONE |
| Findings | `/api/cases/:caseId/findings` | GET | HIGH | DONE |
| Findings Search | `/api/cases/:caseId/findings/search` | GET | HIGH | DONE |
| Finding Detail | `/api/cases/:caseId/findings/:findingId` | GET | HIGH | DONE |
| Synthesis | `/api/cases/:caseId/synthesis` | GET | HIGH | DONE |
| Hypotheses | `/api/cases/:caseId/hypotheses` | GET | HIGH | DONE |
| Hypothesis Detail | `/api/cases/:caseId/hypotheses/:id` | GET | HIGH | DONE |
| Contradictions | `/api/cases/:caseId/contradictions` | GET | HIGH | DONE |
| Gaps | `/api/cases/:caseId/gaps` | GET | HIGH | DONE |
| Tasks | `/api/cases/:caseId/tasks` | GET | HIGH | DONE |
| Timeline Events | `/api/cases/:caseId/timeline` | GET | MEDIUM | DONE |
| Timeline Event Detail | `/api/cases/:caseId/timeline/:id` | GET | MEDIUM | DONE |
| Timeline SSE | `/api/cases/:caseId/timeline/stream` | SSE | MEDIUM | TODO |
| Command Center SSE | `/sse/cases/:caseId/command-center/stream` | SSE | HIGH | DONE |
| Start Analysis | `/api/cases/:caseId/analyze` | POST | HIGH | DONE |
| Analysis Status | `/api/cases/:caseId/analysis/:workflowId` | GET | HIGH | DONE |
| Confirmations | `/api/cases/:caseId/confirmations/:requestId` | POST | HIGH | DONE |
| Pending Confirmations | `/api/cases/:caseId/confirmations/pending` | GET | HIGH | DONE |

---

## Roadmap Evolution

- **Phase 1.1 inserted after Phase 1:** Frontend Design Foundation (URGENT)
  - Reason: Establish robust frontend design foundation before subsequent phases build upon it
  - Reference: DOCS/UI/LANDING-INIT.md for landing page requirements

- **Phase 4.1 inserted after Phase 4:** Agent Decision Tree Revamp (URGENT)
  - Reason: Current D3-based Command Center visualization is visually poor (static layout, bad colors, no animations). Revamp with @xyflow/react + dagre to match reference design from agent-decision-tree-guide.md before proceeding to Phase 5 backend work.

- **Yatharth's frontend work (2026-02-02):** Phases 3, 5, 7, 9, 10 have frontend UI complete
  - All use mock data with graceful fallbacks
  - Backend integration is the remaining work for these phases
  - See `DEVELOPMENT_DOCS/YATHARTH_WORK_SUMMARY.md` for detailed file paths and TODOs

---

## Active Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Multimodal processing | Separate OCR/transcription pipelines vs Gemini native | Gemini native | Gemini 3 directly processes all modalities; eliminates pipeline complexity |
| Agent architecture | File-type agents vs Domain agents | Domain agents | Leverages Gemini multimodal; aligns with investigation workflows |
| Database | PostgreSQL vs Firestore | PostgreSQL | ADK DatabaseSessionService requires it; hybrid schema flexibility |
| Streaming | WebSocket vs SSE | SSE | Simpler, sufficient for unidirectional updates, auto-reconnect |
| Auth | NextAuth vs Better Auth | Better Auth | Modern, TypeScript-first, good PostgreSQL integration |
| Hypothesis system | Integrated in KG vs Separate view | Separate view | Cleaner UX, fullscreen capability, complements contradiction/gap detection |
| Graph library | D3.js vs vis-network | **D3.js (enhanced)** | D3.js retained and enhanced with Epstein-inspired physics/layout; vis-network deferred to optional Phase 7.3 |
| KG Builder approach | Programmatic vs LLM-based | **LLM-based (Approach 4)** | Research validates: co-occurrence relationships are fundamentally insufficient; LLM agent sees all findings holistically for cross-domain connections + semantic relationships + natural dedup |
| Map API | Mapbox vs alternatives | Mapbox (tentative) | Evaluate alternatives during implementation |
| Geospatial agent | Part of pipeline vs Post-synthesis | Post-synthesis utility | Autonomous when location data exists, on-demand via chat |
| Entity taxonomy | Core types only vs Full domain-specific | Full adoption | Better knowledge graph quality, domain-appropriate metadata |
| Research sources | Curated list vs Dynamic discovery | Dynamic discovery | Gemini web search more flexible, no maintenance overhead |
| Task UI | Sidebar vs Bottom drawer | Bottom drawer | Non-intrusive, always accessible |
| Hypothesis creation | User-driven vs Agent-driven | Agents propose, users curate | Better initial hypotheses, user maintains control |
| Hypothesis lifecycle | 6-state vs 3-state | 3-state (PENDING/SUPPORTED/REFUTED) | Simpler, user marks resolved; avoids over-engineering |
| Access classification | Multiple levels vs Binary | Binary (ACCESSIBLE/REQUIRES_ACTION) | Simpler, actionable |
| Confidence calculation | Deterministic vs AI-only | Deterministic (user override) | Simpler; sum(supporting)/sum(all), user can override |
| Research invocation | Chat-only vs Orchestrator-triggered | Both | Orchestrator suggests when gaps detected; user confirms |
| Task deduplication | Complex coordination vs Context injection | Context injection | Task list in agent context; simple approach |
| Cloud SQL tier | db-f1-micro vs db-g1-small | db-g1-small | Better cost/performance, 1.7GB RAM vs 0.6GB |
| Cloud Run initial images | Wait for CI/CD vs Placeholder | Placeholder hello image | Bypasses chicken-and-egg; CI/CD replaces |
| Cloud SQL networking | Private vs Public IP | Public IP | Hackathon simplicity; would use private in prod |
| Frontend Docker build | Bun runtime vs Node runtime | Bun build + Node runtime | Bun faster for build, Node slim more stable for production |
| SQLAlchemy async | Implicit vs Explicit greenlet | Explicit greenlet dependency | Required for async operations, must be explicit in pyproject.toml |
| Design tokens approach | CSS variables vs Tailwind @theme | Tailwind v4 @theme | Native utility generation, cleaner integration |
| Animation library | framer-motion vs motion | motion@12 | Canonical package name for v12+, React 19 compatible |
| Variable font control | Preset weights vs Axis utilities | Axis utilities | Fine-grained WONK/SOFT control for Fraunces |
| CI/CD migrations | Cloud Run job vs Cloud SQL Proxy | Cloud SQL Proxy | More reliable, no separate job infrastructure needed |
| Secret management | Values in terraform vs References only | References only | Security best practice; values added manually via GCP Console |
| Cross-service URLs | Build-time vs Post-deploy update | Post-deploy update | Solves chicken-and-egg URL problem with update-env job |
| File content hash | MD5 vs SHA-256 | SHA-256 | 64-char hex string, industry standard, collision resistant |
| File status lifecycle | 3-state vs 6-state | 6-state | UPLOADING/UPLOADED/QUEUED/PROCESSING/ANALYZED/ERROR for granular tracking |
| GCS upload chunk size | 4MB vs 8MB vs 16MB | 8MB | Balance between memory usage and network round trips |
| Services layer | Inline in routes vs Separate services/ | Separate services/ | Reusable business logic, cleaner route handlers |
| Signed URL expiration | 1h vs 24h vs 7d | 24h | Balance between security and usability |
| SSE pubsub | Redis vs In-memory | In-memory | Sufficient for single-instance hackathon deployment |
| ADK agent naming | Raw UUIDs vs Sanitized | Sanitized via regex | ADK requires valid Python identifiers; UUIDs have hyphens |
| Thinking config | generate_content_config vs BuiltInPlanner | BuiltInPlanner | ADK best practice; cleaner integration with ThinkingConfig |
| Model ID configurability | Hardcoded vs Env vars | Env vars (GEMINI_FLASH_MODEL, GEMINI_PRO_MODEL) | Smooth preview-to-GA migration path |
| SSE callback dispatch | Synchronous vs asyncio.create_task | asyncio.create_task | Non-blocking; graceful fallback when no event loop |
| Agent I/O storage | Typed columns vs JSONB | JSONB | Flexible schema for varied agent types; supports PostgreSQL indexing |
| Agent parent tracking | Separate table vs Self-referential FK | Self-referential FK with SET NULL | Simpler schema; preserves child records |
| Migration generation | Autogenerate vs Manual | Manual | No live database required during development |
| Triage prompt location | Inline in factory vs Separate prompts/ module | Separate prompts/ | Maintainability; prompts can be iterated without touching agent logic |
| Triage output parsing | Strict JSON vs Code-fence tolerant | Code-fence tolerant | Handles model responses with or without markdown code fences |
| Thinking trace storage | Full text vs Capped at 2000 chars | Capped at 2000 chars | Prevents JSONB column bloat in execution records |
| Orchestrator model | Flash vs Pro | Gemini Pro | Complex routing reasoning needs higher capability model |
| Orchestrator input | Full file content vs Text-only triage JSON | Text-only triage JSON | Keeps context ~10-50K tokens; orchestrator reasons about metadata, not files |
| Routing threshold | Fixed score cutoff vs Dynamic reasoning | Dynamic reasoning | No fixed threshold; orchestrator considers full picture per file |
| Orchestrator prompt location | Inline in factory vs Separate prompts/ module | Separate prompts/ | Consistent with triage pattern; prompts iterable without touching agent logic |
| Agent event pub/sub | Redis vs In-memory asyncio.Queue | In-memory asyncio.Queue | Same pattern as file events; single-instance hackathon deployment |
| Pipeline status tracking | Separate workflow table vs Derived from execution records | Derived from execution records | Avoids extra table; status computed from triage/orchestrator execution states |
| Background task DB session | FastAPI dependency vs Own session factory | Own session factory | Background tasks run outside request lifecycle; need independent DB access |
| Command center SSE path | /api/ prefix vs /sse/ prefix | /sse/ prefix | Consistent with file SSE pattern; frontend proxy or update can align |
| Motion easing types | String literals vs Cubic-bezier arrays | Cubic-bezier arrays | Satisfies motion/react strict Easing type without casts |
| Node animation layering | Single motion.div vs Nested wrappers | Nested wrappers | Separates floating (infinite loop) from entrance (one-shot) to avoid prop conflicts |
| Command Center accent scope | Global CSS vars vs Scoped selector | Scoped .command-center-scope | Teal accent isolated from Legal Lens warm neutral palette |
| Sidebar positioning | Fixed vs Absolute within CC container | Absolute within CC container | Avoids overlapping case layout chrome; sidebar scoped to Command Center |
| Sidebar output extraction | Unsafe casts vs Generic helper | Generic extractFromOutputs<T> | Type-safe extraction from AgentOutput[] without any casts |
| Canvas layout with sidebar | Flex split vs Absolute overlay | Absolute overlay | Full-width canvas; sidebar overlays instead of shrinking canvas |
| File group click behavior | Open sidebar vs No action | No sidebar (setSelectedAgent null) | File group nodes are intermediate grouping; no detailed agent data to show |
| ReactFlow nodeTypes placement | Inside component vs Outside | Outside component body | Prevents infinite re-renders per ReactFlow best practice |
| Agent color saturation | Full saturation vs Muted | Muted (~50% reduction) | Hues preserved for identity; avoids visual noise on dark canvas |
| Edge color scheme | Teal glow vs Gray neutral | Gray neutral tiers | Processing/chosen/inactive tiers; less visual noise than cyan glow |
| Edge type | Standard smoothstep vs Custom FileRoutingEdge | Custom FileRoutingEdge | Click-to-expand file list popup; shows routing context on demand |
| Graph construction | Inline in CommandCenter vs Extracted module | Extracted command-center-graph.ts | Separation of concerns; graph building logic reusable and testable |
| Layout computation | Inline in CommandCenter vs Extracted module | Extracted command-center-layout.ts | Dagre engine isolated; progressive visibility logic separated |
| Agent state management | Inline in CommandCenter vs Custom hook | Extracted useAgentStates hook | State logic reusable across command-center and command-center-demo pages |
| Sidebar ownership | CommandCenter (absolute overlay) vs Page level (30% panel) | Page level 30% panel | Sidebar as peer to canvas, not overlay; cleaner layout, no z-index issues |
| PublishFn type alias | type keyword vs TypeAlias annotation | TypeAlias annotation | Pyright compatibility when importing across modules with from __future__ import annotations |
| SSE thinking traces | Truncated vs Full text | Full untruncated text | CONTEXT.md: "Show full unfiltered thinking output"; DB storage still capped at 2000 chars |
| SSE reconnection | Event replay vs State snapshot | State snapshot | Simpler; queries most recent workflow executions, no sequence tracking needed |
| Publish type unification | Separate PublishEventFn per module vs Shared PublishFn | Shared PublishFn from base.py | Single canonical type alias; removes duplicate definitions in triage/orchestrator |
| Confirmation timeout | Timeout vs Indefinite wait | Indefinite wait | Per CONTEXT.md: "Agent waits indefinitely for user response" |
| Confirmation storage | Database vs In-memory | In-memory dicts | Single-instance hackathon deployment; three dicts for events/results/requests |
| Confirmation auth | Full auth vs No auth | No auth | Hackathon simplicity; SSE events already scoped to case |
| Confirmation SSE emission from sync | Inline await vs loop.create_task | loop.create_task | resolve_confirmation is sync (called from FastAPI endpoint); uses create_task for non-blocking async SSE emission |
| Frontend SSE URL | Relative /api/ path vs NEXT_PUBLIC_API_URL | NEXT_PUBLIC_API_URL + /sse/ prefix | Matches backend route pattern; env var consistent with REST API client |
| Backend status mapping | Direct string passthrough vs Mapped enum | mapSnapshotStatus() translation | Backend sends pending/running/completed/failed; frontend uses idle/processing/complete/error |
| Confirmation state shape | Separate store vs In useAgentStates | In useAgentStates as pendingConfirmations array | Colocated with agent state; Plan 04 consumes directly |
| Sidebar token/timing sections | Inline variables vs IIFE scoping | IIFE pattern for CollapsibleSections | Scopes metadata extraction locally without polluting component scope |
| Sidebar cross-agent data | React context vs Optional prop | allAgentStates optional prop | Self-contained; avoids provider overhead for single consumer |
| Confirmation modal dismiss | Click-outside-to-dismiss vs Blocked | Blocked (no outside dismiss) | Important agent decisions should not be accidentally dismissed |
| Tab notification badge | New cross-page context vs Tab badge property | Tab badge property | Lightweight; rendering support in ExpandableTabs, wiring per-page |
| SSE domainScore range | Normalize to 0-1 in backend vs Accept 0-100 in frontend | Accept 0-100 in frontend | Backend schema uses 0-100 (percentage); frontend validation and display adjusted |
| Domain agent architecture | Per-agent run functions vs Template Method base class | DomainAgentRunner Template Method | Eliminates ~800 lines of duplication; subclasses override only agent_type, output_type, _create_agent |
| Domain agent parsing | Per-agent parse_X_output vs Generic extract_structured_json | Generic extract_structured_json | Single function in parsing.py replaces 4 near-identical parsers; handles code fences, thought filtering, retry |
| Routing HITL granularity | All-or-nothing vs Per-agent-type | Per-agent-type rejection | User can reject routing to one agent while keeping others; batch modal with individual checkboxes |
| Routing HITL thresholds | Global threshold vs Per-agent-type | Per-agent-type thresholds | ROUTING_CONFIDENCE_THRESHOLDS dict in agents.py: financial=50, legal=50, evidence=40, strategy=60 |
| Strategy dispatch gating | Run whenever domain agents ran vs Orchestrator-requested only | Orchestrator-requested only | Strategy only runs when explicitly in routing decisions, parallel_agents, or sequential_agents |
| compute_agent_tasks dedup | Skip grouped files vs Track (file_id, agent_type) covered pairs | Track covered pairs | Allows per-file routing to additional agents not covered by file group routing |
| DomainEntity.metadata | dict[str, str] vs list[MetadataEntry] | list[MetadataEntry] | Gemini structured output requires list of objects, not arbitrary dict; MetadataEntry has key+value fields |
| Thinking trace display | Raw text passthrough vs JSON normalization | JSON normalization via format_thinking_traces | Gemini multimodal thinking produces JSON; normalize to key-labeled text for readability |
| SSE routing decisions | One card per file (first agent) vs One card per (file, agent) | One card per (file, agent) | Flattened double loop ensures all target agents visible in frontend sidebar |
| Confirmation event field naming | requestId vs taskId | taskId | Backend sends taskId consistently; frontend types/validation aligned |
| SSE event type field | Implicit from event name vs Explicit in payload | Explicit type field in every payload | Frontend validation dispatches on data.type; ensures consistent event handling |
| Tool-called event mapping | Map TOOL_COMPLETED separately vs Same as TOOL_CALLED | Same event type | Both TOOL_CALLED and TOOL_COMPLETED mapped to tool-called SSE event |
| Thinking update timestamp | Required vs Optional | Optional in frontend, always sent by backend | Backend callbacks include timestamp; emit_thinking_update adds default; frontend validates optionally |
| Domain entity type field | Literal enum vs Free-form str | Free-form str | Supports per-domain taxonomies (monetary_amount, statute, alias, etc.) with 'other' overflow |
| Strategy media resolution | HIGH vs MEDIUM | MEDIUM | Strategy processes playbooks/docs, not dense scanned content requiring high-res OCR |
| Domain agent model default | Flash vs Pro | MODEL_PRO | Domain analysis requires complex reasoning; Pro model for all 4 agents |
| Domain factory imports | Top-level vs Lazy | Lazy imports inside factory methods | Handles parallel plan execution where prompt modules may not exist yet |
| Video/audio file preparation | Size-based routing vs Always File API | Always File API for video/audio | Avoids VideoMetadata + inline data 500 error (Gemini API issue) |
| Domain prompt structure | Freeform vs Standardized 12-section | Standardized 12-section | Consistent structure across all 4 domain agents; easier to maintain and compare |
| Strategy agent input description | Implicit vs Explicit in prompt | Explicit dual-input documentation | Prompt explicitly describes own files + domain agent summaries as two input types |
| Evidence quality_assessment | Optional vs Always required | Always required in prompt | Evidence agent must always produce quality_assessment even when no findings |
| Domain prompt JSON examples | No examples vs Full realistic examples | Full realistic domain-specific examples | Guides model toward correct output structure with domain-appropriate content |
| Resilience pattern | ResilientAgentWrapper class vs Inline fallback | Inline Pro-to-Flash fallback | Less indirection for 4-agent setup; functionally equivalent retry-with-simpler-model |
| Domain runner dispatch | Hardcoded if/elif vs Dict dispatch table | Dict dispatch table (RUN_FNS) | Clean mapping from agent_type string to run function; extensible |
| Parallel agent DB sessions | Shared caller session vs Independent per task | Independent per task via factory | Avoids SQLAlchemy shared session conflicts (RESEARCH.md Pitfall 3) |
| Fallback metadata storage | Separate field vs Nested in output_data | _metadata key in output_data JSONB | Avoids schema changes; metadata colocated with output |
| Strategy no-files content | build_domain_agent_content vs text-only Content | text-only Content when files=[] | Strategy may run with only domain summaries; text-only avoids empty file preparation |
| Strategy input_data tracking | Minimal vs Verbose | Verbose (domain_summaries_length + has_own_files) | Audit visibility into what strategy agent actually received |
| SSE compound identifiers | Single agent_type vs Compound {type}_{group} | Compound {agent_type}_{group_label} | Supports multiple instances of same agent type in Command Center |
| SSE pre-emission source | Inline file-group iteration vs compute_agent_tasks | compute_agent_tasks from domain_runner | Single source of truth; SSE events always match actual execution tasks |
| Pipeline terminal stage | Orchestrator vs Strategy | Strategy completion | Strategy runs after parallel domain agents; marks pipeline as "complete" |
| Pipeline failure scope | All failures fatal vs Pipeline-level only | Pipeline-level only (triage/orchestrator/pipeline) | Partial domain agent failures are expected and non-fatal |
| KG entity/relationship metadata column | `metadata` vs `properties` | `properties` | SQLAlchemy reserves `metadata` attribute on DeclarativeBase; renamed to `properties` for JSONB column |
| tsvector mapping | SQLAlchemy column vs Raw SQL generated column | Raw SQL in migration | Avoids Alembic autogenerate phantom diffs (Pitfall 6); queries use func.to_tsvector() directly |
| findings_text backward compat | Required vs Optional (default=None) | Optional (default=None) | Existing agent_executions.output_data records lack this field; optional avoids breaking deserialization |
| Citation excerpt enforcement | Schema-required vs Prompt-enforced | Prompt-enforced (schema stays optional) | Field type stays str|None for backward compat; description documents char-for-char requirement |
| v1 search implementation | PG tsvector vs Vertex AI vector search | PG tsvector | v1 uses built-in PG full-text search; Vertex AI vector search deferred to Phase 9 |
| Entity dedup scope | Per-domain vs Cross-domain | Cross-domain (grouped by entity_type only) | Per CONTEXT.md decision; allows merging same entity found by different agents |
| Fuzzy match handling | Auto-merge vs Flag for LLM | Flag for LLM (>=85% ratio) | Avoids incorrect merges; deferred to Phase 8 LLM resolution |
| Findings text enrichment | Description only vs Description + findings_text | Append findings_text when available | Richer searchable text without losing original description |
| Findings search route ordering | Before /{finding_id} vs After | Before /{finding_id} | Prevents FastAPI treating "search" as UUID path param |
| KG API data access | Direct model queries vs Service layer | Direct model queries | Simple CRUD doesn't need service abstraction; findings uses service for complex search |
| EntityCreateRequest metadata mapping | Direct field vs Renamed | metadata -> properties | Schema field "metadata" maps to DB column "properties" (SQLAlchemy reserved attribute) |
| KG Builder entity cross-referencing | Name matching vs Integer IDs | Integer IDs (1, 2, 3...) | Eliminates name-matching inconsistencies; LLM assigns sequential IDs, mapped to DB UUIDs during write |
| KG Builder input format | Multimodal files vs Text-only | Text-only (findings + entities + case description) | Domain agents already processed raw evidence; KG Builder only needs pre-processed text |
| KG Builder rebuild strategy | Incremental merge vs Clear-and-rebuild | Clear-and-rebuild | Clean slate every run; delete all KG data then insert curated LLM output |
| KG Builder failure handling | Block pipeline vs Non-blocking | Non-blocking (try/except, continue) | KG Builder failure emits SSE error, pipeline continues; KG page shows empty state |
| KG Builder media resolution | HIGH vs None | None (text-only input) | No generate_content_config needed; KG Builder receives text, not files |
| pdfjs-dist version | Latest (5.x) vs Compatible (3.x) | 3.11.174 | @react-pdf-viewer 3.12 requires pdfjs-dist ^2.16 or ^3.0; v5 is incompatible |
| wavesurfer.js import strategy | Static import vs Dynamic import | Dynamic import | ESM-only package; dynamic import() inside useEffect for Next.js compatibility |
| Zoom pan reset pattern | useEffect on zoom vs Inline in zoom handlers | Inline in zoom handlers | Avoids eslint react-hooks/set-state-in-effect cascading render violation |
| detail-sidebar Evidence type | Keep Evidence type vs Replace with SourceViewerContent | SourceViewerContent | Evidence type removed in Plan 01; SourceViewerContent is the production-quality replacement |
| D3 .each() ESLint pattern | this-aliasing vs select(elements[i]) | select(elements[i]) | Arrow fn with third arg of .each() avoids @typescript-eslint/no-this-alias violation |
| KG tooltip implementation | SVG foreignObject vs React fixed overlay | React fixed overlay | Avoids SVG clipping and z-index issues; positioned at mouse coordinates |
| KG search vs selection visual | Same style vs Distinct styles | Distinct: coral (#E87461) for search, white (#ffffff) for selection | Two highlighting modes must be visually distinguishable |
| KG edge label orientation | Rotated along edge vs Always horizontal | Always horizontal | Readability per CONTEXT.md specification |
| KG filter state model | Active-set vs Disabled-set | Disabled-set pattern | ESLint react-hooks rules prohibit setState in useMemo/useEffect; inverted model avoids sync entirely |
| KG source viewer wiring | Wire onViewSource vs Graceful degradation | Graceful degradation | source_finding_ids -> file URL chain requires backend API not available in Phase 7.2; show "Source not yet available" |
| KG timeline relationship input | Full list + filter in component vs Pre-filtered by parent | Pre-filtered by parent | EntityTimeline receives only relationships involving selected entity; keeps component focused on display |
| Hypothesis evidence storage | Flat list in one column vs Split by role in two columns vs Both columns split by role | Both columns split by role (Option 3) | Preserves original schema intent (supporting_evidence + contradicting_evidence JSONB); API response model_validator merges into flat list with role labels |
| Case verdict persistence | Fetch from case_synthesis JSONB vs Columns on Case model | Columns on Case model (verdict_label + verdict_summary) | Cases list page needs verdict badge without joining to case_synthesis; direct column access |
| Synthesis schema typing | Complex nested types vs Simple Gemini-compatible types | Simple types (str/int/float/bool/list) | Gemini structured output constraints require simple types; dates as ISO 8601 strings, entity IDs as integers |
| Synthesis agent input format | Multimodal files vs Text-only | Text-only (5 DB sources) | Domain agents already processed raw evidence; synthesis only needs pre-processed text from DB |
| Synthesis rebuild strategy | Incremental merge vs Clear-and-rebuild | Clear-and-rebuild | Same pattern as KG Builder; delete all synthesis data per case, then insert fresh |
| Synthesis SSE granularity | Per-item events vs Batch event | Batch event (synthesis-data-ready) | All outputs arrive atomically from single LLM call; per-item events add complexity with no UX benefit |
| Synthesis failure handling | Block pipeline vs Non-blocking | Non-blocking | Synthesis failure emits SSE error, pipeline continues to ANALYZED status |
| Hypothesis status derivation | User-driven vs Confidence-based | Confidence-based (>60 SUPPORTED, <40 REFUTED, else PENDING) | Auto-classification from LLM confidence scores; user can override later |
| Pipeline terminal stage | Strategy vs Synthesis | Synthesis completion | Processing-complete now fires after Stage 8 (synthesis), not after Stage 7b (entity backfill) |
| Timeline dateRange scope | Full table vs Filtered results | Filtered results | Date boundaries reflect active filters, not entire dataset |
| Timeline layer counts | SQL GROUP BY vs Python Counter | Python Counter | Simpler code for small result sets; no extra DB query |
| Query param alias pattern | Direct param name vs Query(alias=) | Query(alias="status") | Avoids Python reserved keyword conflicts in function signatures |
| Synthesis API client pattern | Duplicate fetchWithAuth vs Shared api client | Shared api client (api-client.ts) | Consistent with useAgentExecutionDetail.ts; avoids duplicating JWT auth logic |
| Synthesis fetch 404 handling | Throw error vs Return null | Return null for fetchSynthesis | Analysis may not have run yet; null signals empty state without error boundary |
| React Query filter cache | Single queryKey vs Filter-inclusive queryKey | Filter params in queryKey | Different filter combinations get separate cache entries and proper invalidation |
| React Compiler useMemo dependency | Sub-property vs Full object | Full object (`[synthesis]`) | React Compiler infers full object as dependency; `[synthesis?.key_findings_summary]` fails preserve-manual-memoization lint rule |
| TaskCard interactivity | Clickable with onClick vs Read-only | Read-only (no onClick) | Task management (status updates, assignment) deferred; tasks are informational-only for v1 |
| Verdict sidebar descriptor rendering | Render panel now vs Placeholder | Placeholder (return null) | Actual detail panels for verdict-hypothesis/contradiction/gap built in Plan 06 |
| Synthesis AgentType registration | String comparison vs Union member | Union member ("synthesis" added to AgentType) | Type-safe handling across validation, config, and color systems; backend sends agentType: "synthesis" |
| Synthesis readiness detection | SSE-only vs Dual (SSE + API fallback) | Dual: SSE synthesisReady + useSynthesis API data | SSE for live sessions; API fallback for page reload after analysis completes |
| Synthesis cache invalidation | Polling vs SSE-triggered | SSE-triggered (on synthesis-data-ready) | Immediate cache invalidation when synthesis completes; no polling overhead |
| CC tab toggle state | React state only vs URL search params | URL search params (?tab=verdict) | Deep-linkable, survives page refresh, shareable |
| Timeline Zod datetime validation | Strict z.string().datetime() vs Relaxed z.string() | Relaxed z.string() | Backend sends ISO dates without timezone offset; strict validation rejects valid dates |
| Timeline field transformation | Frontend adapts to backend vs Backend adapts to frontend | Frontend transformBackendEvent() | Centralized mapping (event_date->date, case_id->caseId) in API client; backend schema unchanged |
| Verdict badge priority | Always show status vs Verdict replaces status | Verdict replaces status when present | Verdict is more informative than READY status; "Pending Analysis" fills the gap between READY and verdict |
| CaseCard badge logic | Inline conditional vs resolveBadge() helper | resolveBadge() helper | Reusable across grid and list modes; single source of truth for badge resolution |
| Financial layer color | New unique color vs Reuse existing | Teal (#45B5AA) | Consistent with asset entity color in knowledge-graph-config.ts; matches financial domain identity |
| Gemini schema dict types | `dict[str, str]` vs typed Pydantic model | `CrossModalLink` typed model | Gemini API rejects `additionalProperties` in JSON Schema; explicit fields required |
| Gap entity referencing | Position indices (0,1,2) vs Entity UUIDs | Entity UUIDs | Position indices are meaningless after storage; UUIDs enable resolution to names/types |
| Gap entity API resolution | Raw IDs vs Enriched objects | Batch-resolved `RelatedEntity` (id, name, entity_type) | Single DB query resolves all UUIDs; frontend displays human-readable names + type badges |
| Agent type extraction | `split("_", 1)` vs `rsplit("_", 1)` | `rsplit("_", 1)` | Multi-word prefixes like `kg_builder` need right-split to preserve full prefix before case ID suffix |
| Geocoding library | googlemaps vs geopy vs requests | googlemaps (official Google client) | Official client with built-in rate limiting, retry logic, production-tested reliability |
| Geocoding caching | In-memory vs Redis | In-memory for v1 | Simple implementation, sufficient for single-instance deployment; can upgrade to Redis in Phase 9 |
| Geocoding error handling | Raise exceptions vs Return None | Return None on failure | Graceful degradation allows partial results; agent can mark unmappable locations |
| Geocoding async pattern | Sync client vs asyncio.to_thread wrapper | asyncio.to_thread wrapper | googlemaps library is synchronous; asyncio.to_thread provides non-blocking async interface |
| Geospatial agent model | Flash vs Pro | Flash with medium thinking | Location extraction less complex than synthesis; Flash provides cost efficiency |
| Geospatial Location schema | Add columns vs Adapt to existing | Adapt to existing JSONB | Location model has coordinates/temporal_associations JSONB; no migration needed |
| Geospatial entity IDs | UUID mapping vs Integer storage | Integer storage | LLM outputs 1,2,3..., stored as-is; UUID resolution deferred to Phase 8.2 or 9 |
| Geospatial pipeline failure | Blocking vs Non-blocking | Non-blocking | Geospatial optional; failure logs warning, emits error SSE, pipeline continues |
| Geospatial confidence scale | Percentages vs 0.0-1.0 | 0.0-1.0 scale | Consistent with synthesis agent; avoids 0-1 vs 0-100 confusion |
| Locations API async pattern | Blocking vs Async task spawn | Async task spawn (asyncio.create_task) | Non-blocking 202 response; SSE events for progress updates |
| Locations API Query params | Old FastAPI vs Annotated | Annotated[type, Query(...)] = default | Modern FastAPI pattern; avoids syntax errors with dependency injection |
| Geospatial polling interval | 1s vs 3s vs 5s | 3-second polling | Balance between responsiveness and API load during generation |
| Geospatial refresh confirmation | Direct action vs Confirmation | Confirmation (click twice) | Prevents accidental deletion + regeneration of expensive analysis |
| UI component creation | Inline styles vs Reusable components | Reusable Button/Alert components | Benefits entire codebase; consistent UI patterns |
| Geospatial detail loading | Upfront vs Lazy on-demand | Lazy on marker click | LocationResponse list lightweight (coordinates+counts); detail API heavy (full events/citations arrays); faster initial render |
| Geospatial entity display | Resolve names vs Show IDs | Show UUIDs only | Entity name resolution requires additional API or preloading; deferred to Phase 10 with KG navigation |
| Citation excerpt quotes | Literal vs HTML entities | &ldquo; / &rdquo; entities | React react/no-unescaped-entities lint rule rejects literal quotes in JSX text |
| File lookup map pattern | useRef vs useMemo | useMemo derived from React Query data | React Compiler's react-hooks/refs rule forbids ref mutation during render; useMemo is the correct pattern for derived data |
| Entity resolution caching | Dedicated endpoint vs Graph endpoint | Graph endpoint (fetchGraph) | All entities already returned by /graph; 5-min stale time cache; avoids new backend endpoint |
| Unresolved entity fallback | Throw error vs Graceful degradation | Graceful fallback (Unknown Entity, type=other) | Missing entities should not crash UI; fallback allows partial resolution |
| PDF highlight excerpt length | Full excerpt vs Truncated | Truncated to 100 chars | Shorter text matches more reliably in @react-pdf-viewer/search plugin |
| KG Canvas caseId passing | useParams inside vs Prop from page | Prop from page | Keeps canvas component decoupled from routing; page is the routing boundary |
| KG source navigation callback stability | Direct callback vs Stable ref pattern | Stable ref pattern (openFromFindingRef) | Prevents sidebar content effect re-triggering on every openFromFinding recreation |
| Geospatial file name lookup type | Map<string, string> vs Record<string, string> | Record<string, string> | Map import from @vis.gl/react-google-maps shadows global Map constructor |
| Geospatial source navigation | Prop-based (onViewSource) vs Self-contained hook | Self-contained useSourceNavigation hook | Component manages its own SourceViewerModal portal; no prop drilling |
| SourceViewerModal layering in geospatial | Same z-index as dialog vs Higher | z-[60] above z-50 dialog | Source viewer must appear above the detail dialog without closing it |
| Verdict source navigation wiring | Direct hook in panels vs Callback threading | Callback threading via sidebar descriptors | Detail panels render inside DetailSidebar without caseId access; callback threaded from page through VerdictView -> descriptor props |
| Timeline citation source | event.sourceIds vs event.metadata.citations | event.metadata.citations | sourceIds contains entity UUIDs (misnamed); metadata.citations has actual file refs (file_id, locator, excerpt) |
| Timeline citation UX | Modal with all citations vs Expandable list | Expandable list in card | Progressive disclosure; click count to expand, click individual citation to open SourceViewerModal |
| Chat SSE library | Native EventSource vs fetchEventSource | @microsoft/fetch-event-source | EventSource only supports GET; chat endpoint is POST with body; fetchEventSource supports POST + headers + AbortController |
| Chat auth token | api-client.ts wrapper vs getToken direct | getToken from auth-client.ts | fetchEventSource needs explicit headers; getToken provides raw JWT without api-client wrapper |
| Chat session persistence | Frontend session tracking vs Server-side ADK | Server-side ADK with session_id ref | ADK manages conversation history; frontend only stores session_id to reconnect |
| Citation regex mutation | Module-level global regex vs Local creation | Local new RegExp() inside useMemo | React Compiler immutability rule prevents lastIndex mutation on module-level regex |
| Chat disabled derivation | caseStatus only vs latest_workflow_id + status | latest_workflow_id !== null && status !== PROCESSING | Chat requires completed analysis; in-progress analysis data is incomplete |

---

## Known Issues

- **PDF Viewer**: Has rendering/display bugs (identified during Phase 10 testing)
- **Audio Viewer**: Not yet tested with real data; may have issues

---

## Blockers

None currently.

---

## Session Continuity

Last session: 2026-02-09
Stopped at: Phase 9 COMPLETE (2/2 plans, 4 commits). Chat backend + frontend fully wired.
Resume file: None
Next action: Phase 11 (Corrections & Refinement)

---

## Notes

- **Git commits:** User handles all commits manually (NEVER auto-commit)
- **Execution mode:** YOLO except for invasive commands and git commits
- **Depth:** Comprehensive - each phase gets detailed planning file
- **Frontend reference:** `DEVELOPMENT_DOCS/YATHARTH_WORK_SUMMARY.md` for all frontend file paths and TODOs

---

*State file auto-updated during GSD workflow*
