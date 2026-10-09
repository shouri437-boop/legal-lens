# Legal Lens Development Roadmap

**Version:** 1.0
**Created:** 2026-01-18
**Status:** DRAFT

## Milestone: M1 - Legal Lens v1.0

**Goal:** Production-ready legal intelligence platform with full agentic pipeline, transparency visualization, and knowledge graph capabilities for fraud investigation demo.

**Success Criteria:**
- End-to-end demo: Upload fraud case files → Agentic analysis → Knowledge Graph → Chat with citations
- Agent Flow shows full reasoning transparency
- Contradictions and gaps detected and displayed
- All findings have source citations
- Deployed and accessible via public URL

---

## Phase Overview

| Phase | Name | Focus | Requirements Covered | Status |
|-------|------|-------|---------------------|--------|
| 1 | Foundation Infrastructure | CI/CD, Database, Storage, SSE skeleton | REQ-INF-* | ✅ COMPLETE |
| 1.1 | Frontend Design Foundation (INSERTED) | Design system, Liquid Glass, Landing page | UX quality (foundational) | ✅ COMPLETE |
| 2 | Authentication & Case Shell | Auth system, Case CRUD, basic UI shell | REQ-AUTH-*, REQ-CASE-001/002/003 | ✅ COMPLETE |
| 3 | File Ingestion | Upload, storage, file management | REQ-CASE-004/005, REQ-SOURCE-* (basic) | ✅ COMPLETE |
| 4 | Core Agent System | ADK setup, Triage Agent, Orchestrator, Research/Discovery stubs | REQ-AGENT-001/002/007/007a/007b/007e | ✅ COMPLETE |
| 4.1 | Agent Decision Tree Revamp (INSERTED) | Replace D3 Command Center with @xyflow/react + dagre decision tree | REQ-VIS-001 (visual quality) | ✅ COMPLETE |
| 5 | Agent Flow | Real-time visualization, SSE streaming, HITL dialogs | REQ-VIS-001/001a/002, REQ-INF-004 | ✅ COMPLETE |
| 6 | Domain Agents | Financial, Legal, Strategy, Evidence agents, Entity taxonomy, Hypothesis evaluation | REQ-AGENT-003/004/005/006/007c/007d/007h, REQ-HYPO-002/003 | ✅ COMPLETE |
| 7 | Knowledge Storage & Domain Agent Enrichment | DB schema, enriched citations, KG Builder, findings storage, KG API | REQ-AGENT-009, REQ-STORE-001/002, REQ-AGENT-003-006 (enrichment) | ✅ COMPLETE |
| 7.1 | LLM-Based KG Builder Agent | Replace programmatic KG Builder with LLM agent for curated entities + semantic relationships | REQ-AGENT-009 (revised) | ✅ COMPLETE |
| 7.2 | Knowledge Graph Frontend (D3.js Enhancement) | Improve D3.js graph with Epstein-inspired layout, physics, sidebars, filtering, document excerpts | REQ-VIS-003 | ✅ COMPLETE |
| 7.3 | Knowledge Graph Frontend (vis-network) — OPTIONAL | Premium vis-network graph visualization (preserved for experimentation) | REQ-VIS-003 (alternative) | ⏳ DEFERRED |
| 8 | Synthesis Agent & Intelligence Layer | Cross-referencing, hypotheses, contradictions, gaps, timeline, case summary/verdict | REQ-AGENT-008, REQ-HYPO-*, REQ-WOW-*, REQ-VIS-004/005/006, REQ-TASK-001/002 | ✅ COMPLETE |
| 8.1 | Geospatial Agent & Map View | Location intelligence, geocoding, movement patterns, Earth Engine | REQ-GEO-* | ✅ COMPLETE |
| 9 | Chat Interface & Research | Multi-source tool-based Q&A, research/discovery, context caching | REQ-CHAT-*, REQ-RESEARCH-*, REQ-HYPO-007/008 | ✅ COMPLETE |
| 10 | Source Panel & Entity Resolution | Citation-to-source wiring, entity name resolution across all views | REQ-SOURCE-* | ✅ COMPLETE |
| 11 | Corrections & Refinement | Error flagging, Verification, Regeneration | REQ-CORR-* | ⏳ NOT_STARTED |
| 12 | Demo Preparation | Demo case showcasing all integration features | Demo readiness, REQ-RESEARCH-004, REQ-AGENT-007i | ⏳ NOT_STARTED |

> **Status Legend:** ✅ COMPLETE | 🟡 FRONTEND_DONE (backend pending) | ⏳ NOT_STARTED | ⏳ PLANNED
> **Note:** Phase 10 complete (2026-02-09). Citation-to-source navigation wired across all 4 views (KG, Geospatial, Verdict, Timeline) with shared hooks and entity resolution. Known issues: PDF viewer has rendering bugs, audio viewer untested. Architecture revised 2026-02-08: Programmatic KG Builder replaced with LLM-based KG Builder Agent (Approach 4); D3.js retained and enhanced (Epstein-inspired); vis-network deferred to optional Phase 7.3.

**Post-MVP:**
| Phase | Name | Focus | Requirements |
|-------|------|-------|--------------|
| 13 | Memory Service | Cross-case learning, pattern recognition | REQ-MEM-001 |


> NOTE: Use the design guide in DOCS/UI/DESIGN-SYSTEM.md to align yourself for the UI.
---

## Phase 1: Foundation Infrastructure

**Goal:** Establish deployment pipeline and core infrastructure that all other phases depend on.

**Requirements:** REQ-INF-001, REQ-INF-002, REQ-INF-003, REQ-INF-004 (partial)

**Plans:** 6 plans in 3 waves

Plans:
- [x] 01-01-PLAN.md — Monorepo scaffolding (workspaces, tooling, Docker Compose)
- [x] 01-02-PLAN.md — Terraform infrastructure (Cloud SQL, GCS, Cloud Run, WIF)
- [x] 01-03-PLAN.md — Type generation pipeline (Pydantic to TypeScript)
- [x] 01-04-PLAN.md — Backend skeleton (FastAPI, health, SSE, Alembic)
- [x] 01-05-PLAN.md — Frontend skeleton (Next.js, home page, Dockerfile)
- [x] 01-06-PLAN.md — CI/CD pipeline (GitHub Actions, deployment verification)

**Deliverables:**
- GitHub Actions CI/CD pipeline deploying to Cloud Run
- PostgreSQL on Cloud SQL with initial schema
- Cloud Storage bucket configured
- FastAPI skeleton with health endpoint
- Next.js skeleton with home page
- SSE endpoint skeleton (heartbeat only)
- Monorepo structure: `/backend`, `/frontend`

**Technical Notes:**
- Use Workload Identity Federation for GitHub → GCP auth
- Separate Cloud Run services for frontend and backend
- Environment variables managed via Secret Manager
- Database migrations via Alembic from CI

**Exit Criteria:**
- Push to main triggers successful deployment
- `/health` endpoint returns 200 from Cloud Run URL
- Database connection verified
- GCS bucket accessible from backend

---

## Phase 1.1: Frontend Design Foundation (INSERTED)

**Goal:** Establish frontend design system and create an impressive landing page before building upon the frontend in subsequent phases.

**Requirements:** None (foundational work for UX quality)

**Plans:** 5 plans in 3 waves

Plans:
- [x] 01.1-01-PLAN.md — Design tokens, typography, Motion library setup
- [x] 01.1-02-PLAN.md — UI primitives (GlassCard, AnimatedSection) and animation utilities
- [x] 01.1-03-PLAN.md — Above-the-fold sections (Navigation, Hero, Problem)
- [x] 01.1-04-PLAN.md — Core content sections (Solution, How It Works, Feature Highlights)
- [x] 01.1-05-PLAN.md — Final sections (Trust, CTA, Footer) and page assembly

**Deliverables:** ✓ COMPLETE
- Design system and component library foundation
- Liquid Glass design language implementation (premium cream palette)
- Dark theme with professional aesthetic
- Impressive landing page with all 9 sections from LANDING-INIT.md
- Motion animations and scroll interactions
- Responsive design (desktop-first, mobile-optimized)
- Inline video player with play/pause controls
- Ethereal shadow background effect
- Logo with scroll-based letter fade animation
- Hero video hosted on GCS bucket for production

**Technical Notes:**
- Reference: DOCS/UI/LANDING-INIT.md for landing page requirements
- Motion library (v12+) for animations, not framer-motion
- Fraunces font via next/font for distinctive typography
- Tailwind CSS v4 with @theme directive for design tokens
- Detective noir meets modern AI aesthetic
- Video loaded via NEXT_PUBLIC_VIDEO_URL env var (GCS in production)

**Exit Criteria:** ✓ ALL MET
- Landing page implemented with all sections from LANDING-INIT.md
- Liquid Glass design elements functional
- Scroll-triggered animations working
- Responsive across desktop and mobile
- Dark theme polished and consistent

---

## Phase 2: Authentication & Case Shell

**Goal:** Implement auth system and basic case management shell.

**Requirements:** REQ-AUTH-001, REQ-AUTH-002, REQ-AUTH-003, REQ-AUTH-004, REQ-CASE-001, REQ-CASE-002, REQ-CASE-003

**Plans:** 7 plans in 5 waves

Plans:
- [x] 02-01-PLAN.md — Backend auth infrastructure (models, session validation, migration)
- [x] 02-02-PLAN.md — Backend case CRUD endpoints
- [x] 02-03-PLAN.md — Frontend Better Auth setup (config, middleware, client)
- [x] 02-04-PLAN.md — Auth UI (login/signup page with forms)
- [x] 02-05-PLAN.md — App shell (sidebar, layout, user menu)
- [x] 02-06-PLAN.md — Case list and creation UI
- [x] 02-07-PLAN.md — Infrastructure deployment updates (secrets, Cloud SQL, CI/CD)

**Deliverables:** ✓ COMPLETE
- Better Auth integration in Next.js
- Email/password signup and login
- Google OAuth login
- Session persistence with JWT
- Protected routes
- Case creation form
- Case list view with status
- Case deletion with confirmation
- FastAPI middleware for session validation

**Technical Notes:**
- Better Auth stores sessions in shared PostgreSQL
- FastAPI reads auth tables, doesn't write
- User ID from session used for all case queries
- Database schema: users, sessions, accounts, cases tables

**Exit Criteria:** ✓ ALL MET
- User can register, login, logout
- Google OAuth works
- Session persists across refresh
- Cases visible only to owner
- Case CRUD operations work

---

## Phase 3: File Ingestion

**Goal:** Enable evidence file upload and management.

**Requirements:** REQ-CASE-004, REQ-CASE-005, REQ-SOURCE-001 (basic), REQ-SOURCE-002 (basic), REQ-SOURCE-003 (basic), REQ-SOURCE-004 (basic)

**Status:** ✅ COMPLETE

**Plans:** 3 plans in 3 waves

Plans:
- [x] 03-01-PLAN.md — Database model (CaseFile), migration, Pydantic schemas
- [x] 03-02-PLAN.md — File upload endpoint with GCS chunked streaming
- [x] 03-03-PLAN.md — List/download/delete APIs, SSE events, frontend integration

**Verification:** `.planning/phases/03-file-ingestion/03-VERIFICATION.md` — 6/6 observable truths verified

**Deliverables:** ✓ COMPLETE
- Drag-and-drop file upload UI (`CaseLibrary.tsx`)
- Multiple file upload with progress tracking
- Files stored in GCS (`cases/{case_id}/files/{file_uuid}.{ext}`)
- File metadata in PostgreSQL (`case_files` table with 18 fields)
- Case Library view with list layout
- File type icons and category badges
- File status indicators (UPLOADING, UPLOADED, QUEUED, PROCESSING, ANALYZED, ERROR)
- Duplicate detection via SHA-256 content hash
- Conflict resolution UI (View Original, Keep Both, Remove Duplicate)
- Multi-select with bulk delete
- Download via 24h signed URLs
- Real-time SSE status updates
- Basic file viewers deferred to Phase 10

**Technical Notes:**
- Chunked upload with 8MB chunks, 500MB max file size
- SHA-256 content hash computed during upload for duplicate detection
- Signed URLs with service account impersonation for local development
- File status: UPLOADING, UPLOADED, QUEUED, PROCESSING, ANALYZED, ERROR
- SSE pubsub via in-memory for single-instance deployment
- **Key files:**
  - Backend: `backend/app/api/files.py`, `backend/app/services/file_service.py`, `backend/app/models/file.py`
  - Frontend: `frontend/src/components/library/CaseLibrary.tsx`, `frontend/src/hooks/useFileUpload.ts`, `frontend/src/lib/api/files.ts`

**Exit Criteria:** ✓ ALL MET
- ✅ Upload multiple files to a case
- ✅ View files in Case Library
- ✅ Download files via signed URLs
- ✅ Delete individual and bulk files
- ✅ Duplicate detection with conflict resolution
- ✅ Real-time status updates via SSE
- Basic preview for all file types (deferred to Phase 10)

---

## Phase 4: Core Agent System

**Goal:** Establish ADK infrastructure and first agents (Triage + Orchestrator).

**Requirements:** REQ-AGENT-007, REQ-AGENT-007a, REQ-AGENT-007b, REQ-AGENT-007e, REQ-AGENT-001, REQ-AGENT-002 (partial)

**Plans:** 5 plans in 3 waves

Plans:
- [x] 04-01-PLAN.md — ADK infrastructure (dependencies, config, services, factory pattern)
- [x] 04-02-PLAN.md — Database models and schemas (agent execution logging, triage output)
- [x] 04-03-PLAN.md — Triage Agent implementation (prompts, processing, output parsing)
- [x] 04-04-PLAN.md — Orchestrator Agent skeleton (routing logic, research triggers)
- [x] 04-05-PLAN.md — API endpoints and SSE integration (start analysis, command center stream)

**Deliverables:**
- Google ADK 1.23.x integration
- DatabaseSessionService with PostgreSQL
- GcsArtifactService for versioned storage
- Agent factory pattern (fresh instances per workflow)
- State scope prefix usage (none, user:, app:, temp:)
- Triage Agent implementation with `thinking_level="low"`
- Triage outputs: domain scores, complexity, summary, entities
- Orchestrator Agent skeleton with `thinking_level="high"`
- **Orchestrator routing stubs for Research/Discovery agents** (future phases)
- **Orchestrator → Research trigger logic** (autonomous when gaps detected)
- Agent execution logging to database
- Callback-to-SSE mapping for visualization
- ADK limitations documented and mitigated

**Technical Notes:**
- ADK constraint: single parent per agent instance
- State namespacing: `{user_id}_{case_id}_{workflow_id}`
- Gemini Flash for Triage (speed), Pro for Orchestrator (reasoning)
- Store agent outputs in JSONB columns
- Configure `include_thoughts=True` for all agents
- Implement all 6 ADK callbacks for real-time visualization
- Tool confirmation NOT available with DatabaseSessionService (use frontend)
- Orchestrator routing logic prepared for Research/Discovery invocation

**Status:** ✅ COMPLETE

**Verification:** `.planning/phases/04-core-agent-system/04-VERIFICATION.md` — 6/6 must-haves verified

**Exit Criteria:** ✓ ALL MET
- ✅ Triage Agent processes uploaded files
- ✅ Domain scores and entities extracted
- ✅ Orchestrator receives triage output
- ✅ Agent execution logged to database
- ✅ SSE events fire for agent lifecycle (AGENT_SPAWNED, THINKING_UPDATE, AGENT_COMPLETED)
- ✅ Thinking traces captured and available for display

---

## Phase 4.1: Agent Decision Tree Revamp (INSERTED)

**Goal:** Completely revamp the Command Center agent visualization from the current D3-based static node layout to a @xyflow/react + dagre-powered decision tree with rich animations, chosen-path highlighting, smoothstep edges, portal tooltips, and a spring-animated details sidebar — matching the reference implementation from the agent-decision-tree-guide.

**Depends on:** Phase 4

**Requirements:** REQ-VIS-001 (visual quality improvement)

**Plans:** 4 plans in 3 waves

Plans:
- [x] 04.1-01-PLAN.md — Dependencies, scoped CSS variables, config update, DecisionNode component
- [x] 04.1-02-PLAN.md — NodeDetailsSidebar with spring animation and color-coded sections
- [x] 04.1-03-PLAN.md — ReactFlow canvas with dagre layout, CommandCenter integration, state hooks, layout engine
- [x] 04.1-04 (unplanned refinement) — Muted color palette, FileRoutingEdge, page-level sidebar lift

**Deliverables:** ✓ COMPLETE
- Replace D3 SVG canvas with `@xyflow/react` + dagre auto-layout
- Custom `DecisionNode` with motion entrance/hover animations, muted glow (no text shadow)
- Muted per-agent color palette (~50% saturation reduction, hues preserved for identity)
- Gray neutral edge tiers (processing/chosen/inactive) replacing cyan glow
- Custom `FileRoutingEdge` with click-to-expand file list popup on edges
- `FileGroupNode` intermediate layer between orchestrator and domain agents
- Dagre top-to-bottom hierarchical layout (`rankdir: TB`)
- Portal-rendered tooltip ("Click for more details") via `getBoundingClientRect()`
- `NodeDetailsSidebar` as page-level 30% screen-width panel (not overlay)
- Color-coded sidebar sections with compact badge styling
- Dark canvas background with dot grid via ReactFlow `<Background>`
- Auto-fit viewport with 1.5s smooth animation
- State lifted to page level: `useAgentStates` + `selectedAgent` owned by page
- Extracted `command-center-graph.ts` (node/edge builder) and `command-center-layout.ts` (dagre layout engine)
- `useAgentFlowGraph` hook composing graph building + layout in a single useMemo
- `mock-command-center-data.ts` for demo mode fallback
- All existing SSE integration, types, and hooks preserved

**Technical Notes:**
- Install `@xyflow/react` and `@dagrejs/dagre` as dependencies (no separate @types needed)
- `motion` (v12+) already installed — use for node animations
- Map existing `AgentType` (triage, orchestrator, financial, legal, strategy, knowledge-graph) to decision tree nodes
- Map existing `DEFAULT_CONNECTIONS` to ReactFlow edges
- Chosen path = agent with status `processing` or `complete`; unchosen = `idle`
- Agent pipeline is a fixed tree: triage → orchestrator → [financial, legal, strategy] → knowledge-graph
- Node dimensions: 300px wide, 100px tall, `rounded-lg` (~8px radius)
- Color system: Use existing Legal Lens design tokens where possible, add accent variables for chosen-path highlighting
- Sidebar replaces current `AgentDetailsPanel` with spring animation and color-coded sections
- Wrap parent page in `<ReactFlowProvider>`
- Import `@xyflow/react/dist/style.css`
- **Reference: `DOCS/UI/agent-decision-tree-guide.md`** — READ THIS FIRST for pixel-level visual spec, data model, component breakdown, color system, animation specs, and layout geometry

**Key files created:**
- `frontend/src/components/CommandCenter/DecisionNode.tsx` — Custom ReactFlow node with motion animations
- `frontend/src/components/CommandCenter/NodeDetailsSidebar.tsx` — Spring-animated sidebar with agent-type sections
- `frontend/src/components/CommandCenter/FileGroupNode.tsx` — Intermediate file group layer node
- `frontend/src/components/CommandCenter/FileRoutingEdge.tsx` — Custom edge with click-to-expand file list popup
- `frontend/src/hooks/useAgentStates.ts` — Agent state management extracted from CommandCenter
- `frontend/src/hooks/useAgentFlowGraph.ts` — Composing graph building + dagre layout
- `frontend/src/lib/command-center-graph.ts` — Node/edge construction from agent states
- `frontend/src/lib/command-center-layout.ts` — Dagre layout engine with progressive visibility
- `frontend/src/lib/mock-command-center-data.ts` — Mock data for demo mode fallback

**Key files modified:**
- `frontend/src/components/CommandCenter/AgentFlowCanvas.tsx` — Rewritten with ReactFlow (simplified thin wrapper)
- `frontend/src/components/CommandCenter/CommandCenter.tsx` — Rewritten with ReactFlowProvider, uses extracted hooks
- `frontend/src/lib/command-center-config.ts` — Muted palette, AGENT_TYPE_TINTS, removed manual positions
- `frontend/src/app/globals.css` — Scoped .command-center-scope CSS variables
- `frontend/src/app/(app)/cases/[id]/command-center/page.tsx` — Sidebar lifted to page level
- `frontend/src/app/(app)/cases/[id]/command-center-demo/page.tsx` — Same sidebar lift

**Files preserved (no changes):**
- `frontend/src/types/command-center.ts` — All types remain
- `frontend/src/hooks/useCommandCenterSSE.ts` — SSE hook remains
- `frontend/src/lib/command-center-validation.ts` — Validation remains

**Dead code (not deleted, superseded):**
- `frontend/src/components/CommandCenter/AgentNode.tsx` — Replaced by DecisionNode
- `frontend/src/components/CommandCenter/AgentDetailsPanel.tsx` — Replaced by NodeDetailsSidebar

**Exit Criteria:**
- Agent decision tree renders with hierarchical dagre layout (top-to-bottom)
- Active/chosen agents have accent-colored nodes with glow, floating animation, pulsing border
- Inactive agents are muted dark gray with hover effects
- Smoothstep edges animate along chosen path with glowing trail
- Clicking any node opens spring-animated sidebar with color-coded sections
- Portal tooltip appears on hover above each node
- Canvas has dark background with dot grid pattern
- Viewport auto-fits all nodes on mount
- Pan/zoom works, nodes are not draggable
- All existing SSE events and agent state management still functional

---

## Phase 5: Agent Flow

**Goal:** Real-time visualization of agent execution with full transparency.

**Requirements:** REQ-VIS-001, REQ-VIS-001a, REQ-VIS-002, REQ-INF-004 (complete)

**Plans:** 4 plans in 3 waves

Plans:
- [x] 05-01-PLAN.md — Backend SSE enrichment (thinking traces, tokens, timing, state snapshots)
- [x] 05-02-PLAN.md — Backend HITL confirmation system (asyncio.Event pause/resume)
- [x] 05-03-PLAN.md — Frontend SSE wiring (URL fix, new event types, thinking trace accumulation)
- [x] 05-04-PLAN.md — Frontend HITL modal, token display, duration badges, execution timeline

**Status:** ✅ COMPLETE (2026-02-05) — 4 plans + 15 post-plan commits

### Frontend Completed
The Command Center frontend was built in three stages:

**Stage 1 — Yatharth's initial implementation (2026-02-02):**
- Original D3-based canvas and agent nodes (fully superseded by Phase 4.1)
- SSE hook (`useCommandCenterSSE.ts`) and connection status indicator (still in use)

**Stage 2 — Phase 4.1: Decision Tree Revamp (2026-02-04, 19 commits):**
- ✅ @xyflow/react + dagre hierarchical decision tree (replaced D3 canvas)
- ✅ Custom `DecisionNode` with motion entrance/hover animations, muted glow
- ✅ Custom `FileGroupNode` intermediate layer between orchestrator and domain agents
- ✅ Custom `FileRoutingEdge` with click-to-expand file list popup
- ✅ Muted per-agent color palette (~50% saturation, hues preserved for identity)
- ✅ Gray neutral edge tiers (processing/chosen/inactive)
- ✅ `NodeDetailsSidebar` as page-level 30% screen-width panel with spring animation
- ✅ Color-coded sidebar sections with compact badge styling
- ✅ Portal-rendered tooltip ("Click for more details") via `getBoundingClientRect()`
- ✅ Dagre top-to-bottom auto-layout with auto-fit viewport (1.5s smooth animation)
- ✅ State management hooks: `useAgentStates`, `useAgentFlowGraph`
- ✅ Utility modules: `command-center-graph.ts` (node/edge builder), `command-center-layout.ts` (dagre engine)
- ✅ Mock data for demo mode fallback (`mock-command-center-data.ts`)
- ✅ Dark canvas background with dot grid via ReactFlow `<Background>`

**Stage 3 — Post-4.1 cleanup (2026-02-04, 1 commit):**
- ✅ Shared `CanvasZoomControls` component extracted to `ui/canvas-zoom-controls.tsx` (used by both Command Center and Knowledge Graph)

### Backend Work Completed (2026-02-05)
- ✅ Real-time updates via SSE with ADK callback mapping (THINKING_UPDATE, TOOL_CALLED events)
- ✅ Thinking traces integration (full untruncated text via after_model_callback)
- ✅ Token usage display (inputTokens, outputTokens, durationMs in metadata)
- ✅ Execution timeline (Gantt chart with agent timing overlap)
- ⏳ Human-in-the-loop confirmation dialogs — **infra built** (asyncio.Event, REST API, frontend modal); **E2E verification deferred to Phase 6+** when domain agents can trigger confirmations

**Deliverables:** ✓ COMPLETE (HITL infra only)
- ~~ReactFlow canvas for agent visualization~~ ✅ (@xyflow/react + dagre, Phase 4.1)
- ~~Agent nodes with type-based styling~~ ✅ (DecisionNode, 7 agent types including evidence)
- ~~Animated edges during data flow~~ ✅ (FileRoutingEdge, gray tier system)
- ~~Click-to-expand agent detail sidebar~~ ✅ (NodeDetailsSidebar, page-level 30% panel)
- ~~Detail view: model, input, tools, output, duration, thinking traces~~ ✅ (complete with real data)
- ~~SSE hook with reconnection~~ ✅ (useCommandCenterSSE.ts with state-snapshot on reconnect)
- ~~Connection status indicator~~ ✅ (Connected/Reconnecting/Demo Mode)
- ~~Zoom controls~~ ✅ (shared CanvasZoomControls component)
- ~~Real-time updates via SSE with callback mapping~~ ✅ (THINKING_UPDATE, TOOL_CALLED, state-snapshot)
- ~~Token usage display~~ ✅ (CollapsibleSection in sidebar with input/output tokens, model)
- ~~Execution timeline~~ ✅ (Gantt chart showing agent timing overlap)
- Human-in-the-loop confirmation dialogs ⏳ **infra built** (ConfirmationModal, REST API, asyncio.Event) — **E2E verification deferred to Phase 6+**

**Technical Notes:**
- @xyflow/react 12 + @dagrejs/dagre for hierarchical layout
- motion (v12+) for node entrance/hover animations
- Memoization via useMemo in useAgentFlowGraph hook
- Async queue for callback → SSE event translation (backend)
- Thinking traces from `include_thoughts=True` configuration (backend)
- Frontend confirmation dialogs needed (ADK limitation: require_confirmation only works with InMemorySessionService)
- **Frontend files:**
  - Components: `frontend/src/components/CommandCenter/` (DecisionNode, FileGroupNode, FileRoutingEdge, NodeDetailsSidebar, AgentFlowCanvas, CommandCenter)
  - Shared UI: `frontend/src/components/ui/canvas-zoom-controls.tsx`
  - Hooks: `frontend/src/hooks/useCommandCenterSSE.ts`, `frontend/src/hooks/useAgentStates.ts`, `frontend/src/hooks/useAgentFlowGraph.ts`
  - Utilities: `frontend/src/lib/command-center-graph.ts`, `frontend/src/lib/command-center-layout.ts`, `frontend/src/lib/command-center-config.ts`
  - Types: `frontend/src/types/command-center.ts`
  - Pages: `frontend/src/app/(app)/cases/[id]/command-center/page.tsx`, `frontend/src/app/(app)/cases/[id]/command-center-demo/page.tsx`
  - Dead code (superseded): `AgentNode.tsx`, `AgentDetailsPanel.tsx`

**Exit Criteria:** ✓ MET (HITL deferred)
- ✅ Real-time agent flow visible during processing (SSE events fire for all lifecycle stages)
- ✅ Click any node for full details in sidebar (token usage, timing, thinking traces)
- ✅ Thinking traces displayed correctly (full untruncated text from after_model_callback)
- ✅ SSE connection stable with reconnection (state-snapshot on reconnect, exponential backoff)
- ⏳ Confirmation dialogs work for sensitive operations — **infra built, E2E verification deferred to Phase 6+**

---

## Phase 6: Domain Agents

**Goal:** Implement all four domain analysis agents with proper thinking configuration.

**Status:** ✅ COMPLETE (2026-02-06) — 5 plans (14 commits) + 21 post-plan commits (35 total)

**Verification:** `.planning/phases/06-domain-agents/06-VERIFICATION.md` — 10/10 must-haves verified + post-plan addendum

**Requirements:** REQ-AGENT-003, REQ-AGENT-004, REQ-AGENT-005, REQ-AGENT-006, REQ-AGENT-007b, REQ-AGENT-007c, REQ-AGENT-007d, REQ-AGENT-007h, REQ-AGENT-002 (complete), REQ-HYPO-002, REQ-HYPO-003

**Plans:** 5 plans in 3 waves

Plans:
- [x] 06-01-PLAN.md — Domain output schemas, factory extension, infrastructure updates
- [x] 06-02-PLAN.md — Domain agent prompts (Financial, Legal, Evidence, Strategy)
- [x] 06-03-PLAN.md — Financial, Legal, Evidence agent modules + parallel runner
- [x] 06-04-PLAN.md — Strategy agent module (sequential, receives domain summaries)
- [x] 06-05-PLAN.md — Pipeline wiring, SSE events, HITL confirmation integration


**Deliverables:**
- Financial Analysis Agent (`thinking_level="high"`, `media_resolution="high"`)
  - **Full entity taxonomy for financial domain** (monetary_amount, account, transaction, asset)
- Legal Analysis Agent (`thinking_level="high"`, `media_resolution="high"`)
  - **Full entity taxonomy for legal domain** (statute, case_citation, contract, legal_term, court)
- Strategy Analysis Agent (`thinking_level="high"`, `media_resolution="medium"`)
- Evidence Analysis Agent (`thinking_level="high"`, `media_resolution="high"`)
  - Authenticity analysis (manipulation detection, metadata consistency)
  - Chain of custody documentation
  - Corroboration scoring
  - Quality assessment output schema
  - **Full entity taxonomy for evidence domain** (communication, alias, vehicle, property, timestamp)
- **Hypothesis evaluation in all domain agent prompts**
  - Agents evaluate findings against existing hypotheses
  - Output includes hypothesis_evaluations
- Parallel execution via asyncio.gather (not ADK ParallelAgent)
- Inline Pro-to-Flash fallback for each domain agent
- Video/audio processing via Gemini File API
- Structured output schemas per agent (Pydantic models)
- Span-level citation extraction
- Agent output aggregation for Synthesis
- **HITL E2E verification** (deferred from Phase 5): Domain agents trigger confirmations for sensitive operations
- **DomainAgentRunner Template Method base class** (post-plan refactoring)
  - All 4 domain agents migrated to subclasses (~800 lines of duplication eliminated)
  - `extract_structured_json` generic parser replaces per-agent parse functions
- **Per-agent routing HITL system** (post-plan feature)
  - Routing confidence scoring with per-agent-type thresholds
  - Batch confirmation modal with per-agent rejection
  - Strategy agent standalone execution with HITL
- **Production hardening** (post-plan)
  - State snapshot refresh resilience (lastResult preservation)
  - Exception handling in domain agent runner for SSE error emission
  - Orchestrator execution committed to DB before domain agent launch
  - JSON thinking trace normalization for Gemini multimodal output
- **Pipeline bugfixes from live testing** (post-plan)
  - compute_agent_tasks covered-pairs tracking for per-file multi-agent routing
  - Strategy gated on orchestrator routing decision
  - Routing decisions flattened to one card per (file, agent) pair
  - Thought parts excluded from JSON parsing

**Technical Notes:**
- All agents receive file content directly (Gemini multimodal)
- Citation format: `{file_id}#{locator}` where locator is page/timestamp/region
- Domain agents run in parallel via asyncio.gather after Orchestrator routing
- Use `media_resolution="high"` for dense document processing
- Video/audio forced through Gemini File API regardless of size
- Audio: request speaker diarization in prompts (best-effort)
- Inline Pro-to-Flash fallback pattern (not separate ResilientAgentWrapper class)
- **DomainAgentRunner** Template Method base class: subclasses override agent_type, output_type, _create_agent
- **extract_structured_json** generic parser: filters thought parts, handles code fences, validates via Pydantic
- **format_thinking_traces**: normalizes JSON-structured thinking (common with multimodal) to readable text
- **compute_agent_tasks** uses covered_pairs set[tuple[str, str]] to track (file_id, agent_type) coverage
- **Per-agent routing HITL**: ROUTING_CONFIDENCE_THRESHOLDS per agent type, batch confirmation modal
- **Strategy gating**: only runs when explicitly requested by orchestrator (parallel_agents/sequential_agents/routing_decisions)
- **Domain agent prompts include: "Evaluate findings against existing hypotheses"**
- **Key architecture files:**
  - `backend/app/agents/domain_agent_runner.py` — DomainAgentRunner Template Method base class
  - `backend/app/agents/domain_runner.py` — compute_agent_tasks, run_domain_agents_parallel, build_strategy_context
  - `backend/app/agents/parsing.py` — extract_structured_json, extract_response_texts, format_thinking_traces
  - `backend/app/api/agents.py` — Pipeline wiring, strategy gating, routing HITL, SSE emission
  - `backend/app/api/sse.py` — State snapshots, thinking trace normalization, routing decision flattening

**Exit Criteria:** ✓ ALL MET (10/10 + post-plan hardening)
- ✅ All four domain agents process files (migrated to DomainAgentRunner base class)
- ✅ Parallel execution via asyncio.gather with independent DB sessions
- ✅ Thinking traces captured for all agents (JSON normalized for multimodal)
- ✅ Video/audio forced through File API for reliable processing
- ✅ Graceful degradation works (inline Pro-to-Flash fallback)
- ✅ Structured findings with span-level citations output
- ✅ Hypothesis evaluations included in agent output
- ✅ Domain-specific entity taxonomy extracted
- ✅ Outputs aggregated for next phase (build_strategy_context + domain_results dict)
- ✅ HITL confirmation flow verified E2E (agent triggers → modal appears → user responds → agent continues)
- ✅ Per-agent routing HITL with batch confirmation (post-plan)
- ✅ Strategy agent gated on orchestrator routing decision (post-plan)
- ✅ Routing decisions display all target agents per file (post-plan)
- ✅ State snapshot refresh resilience with lastResult preservation (post-plan)

---

## Phase 7: Knowledge Storage & Domain Agent Enrichment

**Goal:** Create the knowledge storage foundation and enrich domain agent outputs with exhaustive exact-source citations for downstream consumption by KG Builder, Synthesis, and Chat.

**Requirements:** REQ-AGENT-009 (partial — programmatic KG Builder), REQ-STORE-001, REQ-STORE-002, REQ-AGENT-003/004/005/006 (citation enrichment)

**Depends on:** Phase 6 (Domain Agents)

**Status:** ✅ COMPLETE (2026-02-07) — 6 plans, 11 commits

**Verification:** `.planning/phases/07-knowledge-storage--and--domain-agent-enrichment/07-VERIFICATION.md` — 8/8 must-haves verified

**Plans:** 6 plans in 3 waves

Plans:
- [x] 07-01-PLAN.md — DB schema: 9 new tables (KG, findings, synthesis) + Alembic migration + tsvector search
- [x] 07-02-PLAN.md — Pydantic schemas for KG/findings APIs + domain agent findings_text enrichment
- [x] 07-03-PLAN.md — KG Builder service (entity extraction, relationships, deduplication) + findings service (storage, full-text search)
- [x] 07-04-PLAN.md — Domain agent prompt enrichment (exhaustive citations, findings_text instructions)
- [x] 07-05-PLAN.md — API endpoints (KG + findings) + router registration
- [x] 07-06-PLAN.md — SSE events + pipeline wiring (findings storage, KG Builder, entity backfill)

### Frontend Available (Yatharth, 2026-02-02)
- ✅ D3.js Knowledge Graph visualization (to be replaced by vis-network in Phase 7.1)
- ✅ Entity detail panel, legend, zoom/pan controls
- ✅ Evidence source panel (`evidence-source-panel.tsx`)
- ✅ Hooks ready (`use-case-graph.ts`)

### Backend Work
**Deliverables:**
- New database tables + Alembic migrations:
  - `kg_entities` (id, case_id, name, entity_type, domain, metadata JSONB, source_execution_id, source_finding_index, merged_into_id, created_at)
  - `kg_relationships` (id, case_id, source_entity_id, target_entity_id, type, label, strength, source_execution_id, metadata JSONB, created_at)
  - `case_findings` (id, case_id, workflow_id, agent_type, agent_execution_id, file_group_label, category, title, finding_text, confidence, citations JSONB, entity_ids JSONB, created_at)
  - `case_hypotheses` (id, case_id, workflow_id, claim, status, confidence, supporting_evidence JSONB, contradicting_evidence JSONB, source_agent, reasoning, created_at)
  - `case_contradictions` (id, case_id, workflow_id, claim_a, claim_b, source_a JSONB, source_b JSONB, severity, domain, resolution_status, created_at)
  - `case_gaps` (id, case_id, workflow_id, description, what_is_missing, why_needed, priority, related_entity_ids JSONB, suggested_actions, created_at)
  - `case_synthesis` (id, case_id, workflow_id, case_summary, case_verdict JSONB, cross_modal_links JSONB, cross_domain_conclusions JSONB, key_findings_summary, risk_assessment, timeline_event_count, created_at)
  - `timeline_events` (id, case_id, workflow_id, title, description, event_date, event_end_date, event_type, layer, source_entity_ids JSONB, citations JSONB, created_at)
  - `locations` (id, case_id, workflow_id, name, coordinates JSONB, location_type, source_entity_ids JSONB, temporal_associations JSONB, created_at) — populated later by Geospatial Agent (Phase 8.1)
- Domain agent prompt enrichment:
  - Exhaustive span-level citations for EVERY statement (exact excerpts, page numbers, timestamps)
  - Rich markdown `findings_text` field: detailed analysis paragraphs per finding with inline source references
  - Instruction reinforcement: "Every factual claim must reference the exact source excerpt"
- Domain agent output schema enhancements:
  - Add `findings_text: str` field (markdown format, extensive analysis with inline citations)
  - Ensure `Citation` model captures exact excerpts and page/timestamp locators
- Programmatic KG Builder service (Python, NOT an LLM agent):
  - Reads domain agent structured output (`agent_executions.output_data`)
  - Extracts ALL entities from `DomainEntity` lists across all domain agents
  - Creates relationship edges (entity A mentioned with entity B in same finding)
  - Entity deduplication: exact name+type match → auto-merge; fuzzy >85% → flag for LLM resolution in Phase 8
  - Degree computation (connection counts for node sizing)
  - Additive-only: NEVER filters or discards entities/relationships
- case_findings storage service:
  - Saves each finding to `case_findings` table after domain agent completes
  - Links to agent_execution via agent_execution_id for audit trail
- KG API endpoints:
  - `GET /api/cases/:caseId/graph` — Full graph data (nodes + edges for frontend)
  - `GET /api/cases/:caseId/entities` — Entity list with search/filter
  - `GET /api/cases/:caseId/relationships` — Relationship list
  - `POST /api/cases/:caseId/entities` — Create entity (manual user addition)
  - `PATCH /api/cases/:caseId/entities/:entityId` — Update entity
  - `DELETE /api/cases/:caseId/entities/:entityId` — Delete entity
  - `POST /api/cases/:caseId/relationships` — Create relationship (manual)
- Findings API endpoints:
  - `GET /api/cases/:caseId/findings` — List findings by agent/category
  - `GET /api/cases/:caseId/findings/:findingId` — Get finding with full citations
- SSE events:
  - `FINDING_COMMITTED` — Finding saved, available for sidebar display
  - `KG_ENTITY_ADDED` — Entity added to KG
  - `KG_RELATIONSHIP_ADDED` — Relationship added to KG
- Vector store setup (v1 = PG full-text search via tsvector; Vertex AI RAG upgrade path in Phase 9):
  - Raw finding text indexed for semantic/keyword search by Chat Agent
  - Full-text search index on case_findings.finding_text
- Pipeline wiring update in agents.py:
  - After each domain agent completes: save findings → extract entities → build relationships → emit SSE
  - After ALL domain agents complete: run entity deduplication pass
  - SSE events fire as data is committed

**Technical Notes:**
- KG Builder is a Python service (NOT an LLM agent) — reads structured Pydantic output, writes to DB tables
- Entity deduplication: exact name+type match for easy cases (95%+), fuzzy matching for harder cases (Levenshtein distance)
- Domain agents produce dual output: structured entities (for KG) + rich markdown text (for display + vector/full-text search)
- All citation fields must include: file_id, locator (page/timestamp), exact_excerpt, surrounding_context
- case_findings rows link to agent_executions via agent_execution_id for full audit trail
- Pipeline remains: Triage → Orchestrator → Domain Agents (parallel) → [KG Builder + findings storage]
- Vector store is optional for Phase 7 (PG full-text search sufficient); Vertex AI RAG can be added in Phase 9
- **Key architecture files to create:**
  - `backend/app/services/kg_builder.py` — Programmatic KG Builder
  - `backend/app/services/findings_service.py` — case_findings storage
  - `backend/app/models/knowledge_graph.py` — KgEntity, KgRelationship models
  - `backend/app/models/findings.py` — CaseFinding model
  - `backend/app/models/synthesis.py` — Hypothesis, Contradiction, Gap, Synthesis, TimelineEvent models
  - `backend/app/api/knowledge_graph.py` — KG API endpoints
  - `backend/app/api/findings.py` — Findings API endpoints

**Exit Criteria:**
- Domain agents produce enriched findings with exhaustive exact-source citations for every statement
- All findings stored in case_findings table and accessible via API
- All entities and relationships extracted and stored in KG tables
- KG API returns valid graph data for frontend consumption
- SSE events fire for findings + KG updates
- Entity deduplication produces clean, non-redundant entity set
- No entity or relationship from domain agents is lost in the programmatic extraction
- Full-text search operational on case_findings

---

## Phase 7.1: LLM-Based KG Builder Agent

**Goal:** Replace the programmatic KG Builder with an LLM-based agent that reads ALL domain agent outputs holistically and produces a curated knowledge graph with deduplicated high-level entities and semantic relationships — enabling cross-domain connections impossible with per-finding co-occurrence.

**Requirements:** REQ-AGENT-009 (revised — LLM-based, not programmatic)

**Depends on:** Phase 7 (case_findings + raw entities stored, KG API endpoints exist)

**Status:** ✅ COMPLETE (2026-02-08) — 2 plans, 6 commits, 8/8 must-haves verified

**Verification:** `.planning/phases/07.1-llm-kg-builder-agent/07.1-VERIFICATION.md` — 8/8 must-haves verified

**Plans:** 2 plans in 2 waves

Plans:
- [x] 07.1-01-PLAN.md — DB schema evolution (Alembic migration, ORM columns) + Pydantic schemas (LLM output + API response)
- [x] 07.1-02-PLAN.md — KG Builder agent (runner, factory, prompt, input assembly, DB write) + pipeline wiring

**Context / Why This Change:**
The Phase 7 programmatic KG Builder produces low-quality graphs because:
1. **Zero entity filtering** — every entity (timestamps, dollar amounts, hardware model numbers) becomes a graph node
2. **Pure co-occurrence relationships** — edges labeled "co-occurrence (Authenticity Analysis)" carry zero semantic signal
3. **Incomplete deduplication** — "$2,000" and "2,000 dollars" stay as separate nodes (fuzzy matches logged but not merged)
4. **No cross-domain connections** — each domain agent operates in isolation; the programmatic builder can't connect financial findings to legal findings

Research (Microsoft GraphRAG, KGGen NeurIPS 2025, LINK-KG, Epstein Doc Explorer) confirms: **LLM-based relationship extraction + LLM-based deduplication** is the state of the art. The programmatic approach is suitable only when structured relationships are already available.

**Deliverables:**
- **KG Builder Agent** (Gemini Pro, `thinking_level="high"`, 1M context window):
  - Input: ALL `case_findings` (rich markdown with citations) + all raw `DomainEntity` lists from `agent_executions.output_data` + case description + file metadata
  - Output (`KGBuilderOutput` Pydantic model):
    - `entities: list[CuratedEntity]` — Deduplicated, high-level investigation entities only
    - `relationships: list[SemanticRelationship]` — Typed semantic relationships with evidence grounding
  - Entity taxonomy (investigation-focused, inspired by LINK-KG + Epstein Doc Explorer):
    - **PERSON** — Named individuals (suspects, witnesses, victims, officers)
    - **ORGANIZATION** — Companies, agencies, groups, shell entities
    - **LOCATION** — Physical places, addresses, jurisdictions
    - **EVENT** — Specific occurrences with dates (transactions, meetings, communications)
    - **ASSET** — Properties, vehicles, investments, digital wallets
    - **FINANCIAL_ENTITY** — Bank accounts, transactions, instruments
    - **COMMUNICATION** — Phone calls, emails, messages, documents exchanged
    - **DOCUMENT** — Key evidence items referenced across findings
  - Timestamps, monetary amounts, physical objects → metadata on entities/relationships, NOT standalone nodes
  - Entity deduplication handled naturally by the LLM seeing all findings together (e.g., "$2,000" and "2,000 dollars" → single entity with aliases)
  - Cross-domain relationship inference: financial agent found wire transfer + legal agent found regulatory violation → LLM connects them
  - Every relationship must include `evidence_excerpt` (exact source text) and `source_finding_ids` for traceability
- **Pydantic output schemas:**
  ```python
  class CuratedEntity(BaseModel):
      name: str                       # Canonical name
      entity_type: str                # PERSON, ORGANIZATION, LOCATION, EVENT, ASSET, etc.
      aliases: list[str]              # All known aliases/variants found across agents
      description: str                # Brief description synthesized from findings
      domain: str                     # Primary domain (financial/legal/evidence/strategy)
      confidence: float               # 0-100
      source_finding_ids: list[int]   # Traceability to case_findings

  class SemanticRelationship(BaseModel):
      source_entity: str              # Must match an entity name
      target_entity: str              # Must match an entity name
      relationship_type: str          # Semantic: "employed_by", "transferred_funds_to", "owns"
      label: str                      # Human-readable: "CEO of", "Wire transfer to"
      strength: float                 # 0-100
      temporal_context: str | None    # When: "2016-05-02", "Q4 2019", etc.
      evidence_excerpt: str           # Exact source text supporting this relationship
      source_finding_ids: list[int]   # Traceability
  ```
- **Pipeline wiring changes:**
  - Remove programmatic KG Builder calls from pipeline (extract_entities_from_output, build_relationships_from_findings, deduplicate_entities)
  - After ALL domain agents complete + findings saved → invoke KG Builder Agent
  - KG Builder Agent clears old kg_entities/kg_relationships for this workflow → writes curated data
  - Emit SSE events: `KG_BUILDER_STARTED`, `KG_BUILDER_COMPLETE`
  - Raw entities from domain agents still saved in `agent_executions.output_data` for audit trail
- **KG API compatibility:**
  - Existing `GET /api/cases/:caseId/graph` endpoint continues to work (reads from same kg_entities/kg_relationships tables)
  - No frontend API changes needed — curated data replaces noisy data in same tables
  - Entity `aliases` stored in `properties` JSONB column
- **Prompt design:**
  - Instruct: "Extract only investigation-relevant entities. Do NOT create standalone nodes for timestamps, monetary values, or physical objects — these are metadata on events and relationships."
  - Instruct: "Every relationship must have a specific semantic type (not 'co-occurrence'). Use verbs like 'employed_by', 'transferred_funds_to', 'owns', 'met_with', 'signed', 'authorized'."
  - Instruct: "Deduplicate entities across all domain agents. If the financial agent found 'J. Smith' and the legal agent found 'John Smith', merge them into one entity with both as aliases."
  - Instruct: "Identify cross-domain connections. If a wire transfer (financial) relates to a contract violation (legal), create a relationship between them."

**Technical Notes:**
- KG Builder Agent runs in fresh stage-isolated ADK session (consistent with pipeline pattern)
- Input is TEXT from PostgreSQL (case_findings.finding_text + entity lists), NOT multimodal file content
- 1M context window handles even large cases (~100-150K tokens for 50-file case)
- Cost: ~$0.05-0.15 per KG build at Gemini Pro rates (single LLM call)
- The curated KG directly improves Phase 8 Synthesis quality — cleaner entity data → better hypotheses and contradictions
- **Key files to create/modify:**
  - `backend/app/agents/kg_builder/` — KG Builder agent module (agent, prompts, schemas)
  - `backend/app/services/kg_builder.py` — Refactor: replace programmatic logic with LLM agent invocation + result storage
  - `backend/app/schemas/knowledge_graph.py` — Add CuratedEntity, SemanticRelationship, KGBuilderOutput schemas
  - `backend/app/api/agents.py` — Update pipeline: remove programmatic KG calls, add KG Builder Agent invocation

**Exit Criteria:**
- KG Builder Agent produces curated entity list with ~15-30 entities (not 50+ noisy ones) for a typical case
- Relationships have semantic type labels (e.g., "CEO of", "transferred $50K to") not "co-occurrence"
- Entity deduplication works across domain agents (same person found by financial + legal = one entity)
- Cross-domain relationships exist (financial finding connected to legal finding)
- No standalone timestamp/amount/physical-object nodes in the graph
- Every entity has aliases array populated from cross-agent dedup
- Every relationship has evidence_excerpt for traceability
- Existing KG API returns the curated data without changes
- Graph quality comparable to Image 1 (mock) or Epstein Doc Explorer (Image 3) in terms of clarity and semantic meaning

---

## Phase 7.2: Knowledge Graph Frontend (D3.js Enhancement)

**Goal:** Transform the existing D3.js knowledge graph into a premium investigative visualization with Epstein Doc Explorer-inspired layout, physics, filtering panels (local to KG canvas), multi-media source viewer, and relationship timeline — while adapting to Legal Lens's Liquid Glass design system.

**Requirements:** REQ-VIS-003 (D3.js approach)

**Depends on:** Phase 7.1 (curated KG data with semantic relationships), Phase 7 (KG API endpoints)

**Status:** ✅ COMPLETE (2026-02-08) — 5 plans + 28 post-plan polish commits (46 total)

**Verification:** `.planning/phases/07.2-kg-frontend-d3-enhancement/07.2-05-SUMMARY.md` — Full summary with all 29 Plan 05 commits

**Plans:** 5 plans in 3 waves

Plans:
- [x] 07.2-01-PLAN.md — Foundation: types rewrite, entity color config, force params, API client, data hook
- [x] 07.2-02-PLAN.md — Source viewer: modal shell + PDF/audio/video/image sub-components
- [x] 07.2-03-PLAN.md — D3 graph canvas: GraphSvg, simulation hook (5 forces, D3 refs), selection hook
- [x] 07.2-04-PLAN.md — Panels: FilterPanel (domain/type/search), EntityTimeline sidebar, filter hook
- [x] 07.2-05-PLAN.md — Integration: KnowledgeGraphCanvas orchestrator, page rewrite, fullscreen, + 4 rounds visual polish

**Reference:** `DOCS/reference/epstein-network-ui/` — Epstein Doc Explorer frontend code (layout, physics, interactions). Adapt patterns to Legal Lens design system and use case.

**Deliverables:**
- **D3.js force simulation enhancement** (improve existing `knowledge-graph.tsx`):
  - D3 force simulation with 5 forces: link, charge, center, collision, radial
  - Radial force: high-connection entities near center, low-connection pushed outward
  - Collision detection using actual circle radius + padding
  - Sqrt-scaled node radius (connection count → 5-100px range)
  - Link distance: constant base (50px) or relationship-type-based
  - Charge repulsion: -400 (tunable)
  - Continuous simulation with tick-based position updates
- **Node rendering and interaction:**
  - SVG circles with domain-colored fills (person=orange, org=green, location=blue — consistent with Legal Lens palette)
  - Node labels (entity names) below circles
  - Click node → highlight node + all connected edges (white), dim unconnected edges
  - Click same node again → deselect
  - Hover tooltip: entity name, connection count, entity type
  - Drag individual nodes (fix position during drag, release on drop)
  - Zoom/pan with `d3.zoom()` (scale extent [0.01, 10])
- **Left panel — Filters & Controls** (local to KG canvas, NOT in the app-wide sidebar):
  - Positioned on the left side of the knowledge graph canvas area
  - Selected entity display with Clear button
  - Graph stats: entity count, relationship count, domain breakdown
  - Entity search (debounced text input, highlights matching nodes)
  - Keyword filter (comma-separated fuzzy match against relationship labels/entity names)
  - Domain layer toggles (Financial, Legal, Evidence, Strategy) with select/deselect all
  - Document category toggles (with counts) mapped from source file types
  - Density threshold slider (prune low-connection nodes by percentage of average)
- **Right panel — Entity Timeline** (local to KG canvas):
  - Appears when entity is selected
  - Chronological list of relationships involving selected entity
  - Each entry: year/date, relationship description (actor → action → target), source citation reference
  - Filter by related entity name (text input)
  - Source citations act as navigation index for the source viewer (click a citation → jump to excerpt/timestamp)
  - Scrollable timeline with entity names highlighted in accent colors
  - Stays visible when source viewer is open (does not get hidden)
- **Source viewer panel** (replaces simple "document excerpt modal" — details to be refined during phase discussions):
  - Multi-media: renders content based on source type (document text, video player, audio player, image viewer)
  - For documents: full text excerpt with entity names highlighted (selected entity = yellow, related = orange)
  - For audio/video: playback with timestamp navigation from right panel citations
  - For images: viewer with annotation overlay capability
  - Opens alongside (not replacing) the right panel — right panel citations serve as navigable index
  - Source metadata header (summary, category, date range)
  - Close button (X)
  - NOTE: Reusable component beyond KG view (Evidence Library, Timeline, etc.) — full specification during phase discussions
- **Edge rendering:**
  - SVG lines with relationship-type-based opacity
  - Highlight connected edges on node selection (white, full opacity); dim unconnected edges
  - Edge hover tooltip: relationship label, temporal context, source document
  - Edge deduplication: multiple relationships between same entity pair → single edge with count
- **Responsive layout:**
  - Three-panel layout LOCAL to KG canvas: left panel (320px) | center graph | right panel (384px, appears on select) — not in app-wide sidebar
  - Dark canvas background consistent with Legal Lens theme
  - Bottom instruction bar: "Click nodes to explore relationships · Scroll to zoom · Drag to pan"
  - Fullscreen capability with maximize button
- **Connected to real KG API** from Phase 7 (curated data from Phase 7.1)

**Technical Notes:**
- Enhance existing D3.js implementation — do NOT replace with vis-network
- Use raw D3.js (d3.forceSimulation, d3.zoom, d3.drag) inside React useEffect hooks
- Adapt Epstein Doc Explorer patterns (radial force, density pruning, sidebar layout) to Legal Lens design system
- Entity timeline right panel inspired by Epstein's relationship timeline (stays visible when source viewer opens)
- Multi-media source viewer inspired by Epstein's document viewer with entity highlighting (extends to audio/video/image)
- Maintain Legal Lens Liquid Glass aesthetic (cream palette, glass effects, Fraunces typography)
- **Reference code:** `DOCS/reference/epstein-network-ui/` (NetworkGraph.tsx, App.tsx, types, API patterns)
- **Key frontend files created:**
  - `frontend/src/components/knowledge-graph/KnowledgeGraphCanvas.tsx` — 3-panel orchestrator (CanvasShell + GraphSvg + FilterPanel + SourceViewerModal)
  - `frontend/src/components/knowledge-graph/GraphSvg.tsx` — D3.js SVG canvas with tooltips, zoom controls, simulation toggle
  - `frontend/src/components/knowledge-graph/FilterPanel.tsx` — Floating filter panel (domain/type toggles, search, keyword filter)
  - `frontend/src/components/knowledge-graph/KnowledgeGraphEntityPanel.tsx` — Entity detail for app-wide DetailSidebar
  - `frontend/src/components/knowledge-graph/EntityTimeline.tsx` — Chronological relationship timeline
  - `frontend/src/components/knowledge-graph/EntityTimelineEntry.tsx` — Expandable timeline entry with evidence excerpt
  - `frontend/src/components/source-viewer/SourceViewerModal.tsx` — Multi-media source viewer shell
  - `frontend/src/components/source-viewer/PdfViewer.tsx` — PDF viewer with page navigation
  - `frontend/src/components/source-viewer/AudioViewer.tsx` — Audio viewer with wavesurfer.js waveform
  - `frontend/src/components/source-viewer/VideoViewer.tsx` — HTML5 video with timestamp markers
  - `frontend/src/components/source-viewer/ImageViewer.tsx` — Zoom/pan image viewer
  - `frontend/src/components/ui/canvas-shell.tsx` — Shared canvas container (used by CC and KG)
  - `frontend/src/components/ui/collapsible-section.tsx` — Shared accordion section
  - `frontend/src/hooks/useGraphSimulation.ts` — D3 force simulation lifecycle (5 forces, D3 refs, zoomToNode)
  - `frontend/src/hooks/useGraphSelection.ts` — Selection + search highlighting (forceSelect for external sync)
  - `frontend/src/hooks/useGraphFilters.ts` — Filter state with disabled-set pattern
  - `frontend/src/hooks/use-case-graph.ts` — Real API data hook (refactored from mock)
  - `frontend/src/lib/api/graph.ts` — KG API client
  - `frontend/src/lib/knowledge-graph-config.ts` — Entity colors, force params, badge styles, alias map
  - `frontend/src/types/knowledge-graph.ts` — Backend-matching types (EntityResponse, RelationshipResponse, ForceNode, ForceLink)
- **Key frontend files modified:**
  - `frontend/src/components/CommandCenter/NodeDetailsSidebar.tsx` — Uses shared getEntityBadgeStyle()
  - `frontend/src/lib/command-center-validation.ts` — Agent key alias map (kg_builder → knowledge-graph)
  - `frontend/src/components/app/detail-sidebar.tsx` — Passes onEntitySelect prop to KG entity panel
  - `frontend/src/types/detail-sidebar.ts` — onEntitySelect in KG entity content type

**Exit Criteria:** ✓ ALL MET (source viewer deferred)
- ✅ KG renders with D3.js force simulation using curated entity/relationship data from API
- ✅ High-connection entities visually closer to center (radial force)
- ✅ Clicking a node highlights it and all connected edges, opens entity detail in app-wide DetailSidebar
- ✅ Entity detail shows chronological relationships, connected entities (click-to-navigate + zoom-to-node)
- ⏳ Source viewer panel: components built (PDF/audio/video/image) but NOT wired — `source_finding_ids → file URL` chain requires backend API. **Deferred to Phase 10 (Source Panel).** Currently shows "Source not yet available" graceful degradation.
- ✅ Filter panel provides filtering by domain, keywords, entity search, entity type toggles
- ✅ Graph tells a clear story: a first-time user can identify key persons, organizations, and their relationships
- ✅ CanvasShell layout with floating filter panel, adapts to screen size
- ✅ Fullscreen mode works
- ✅ Performance: ambient glow on all nodes, smooth zoom, no simulation teardown on sidebar open
- ✅ Node aesthetic matches Command Center: gradient fills, ambient glow, stronger hover glow, borderless by default, white stroke on selection
- ✅ Entity colors unified between CC extracted entities and KG badges via shared getEntityBadgeStyle()

---

## Phase 7.3: Knowledge Graph Frontend (vis-network) — OPTIONAL

**Goal:** Premium knowledge graph visualization with intelligent clustering, physics-based layout, and relationship-aware spacing — Alternative implementation using vis-network. Preserved for experimentation if D3.js approach (Phase 7.2) proves insufficient for large graphs.

**Requirements:** REQ-VIS-003 (alternative approach)

**Depends on:** Phase 7.1 (curated KG data), Phase 7 (KG API)

**Status:** ⏳ DEFERRED

**Plans:** 5 plans in 3 waves

Plans:
- [ ] 07.3-01-PLAN.md — Shared domain colors config, API-aligned TypeScript types, KG API client, vis-network install
- [ ] 07.3-02-PLAN.md — Core vis-network rendering: hook, physics config, data transformer, main graph component
- [ ] 07.3-03-PLAN.md — UI chrome: filter panel, search, legend, entity detail sidebar, clustering, page wiring

**Deliverables:**
- Replace D3.js force-directed graph with vis-network (direct integration via `useRef`/`useEffect` for full TypeScript control)
- Group-based entity type clustering with ForceAtlas2-based physics simulation
- Relationship-type-based edge configuration (length, width, color by category)
- Entity detail panel, 5 toggleable layers, search and highlight, fullscreen
- Node scaling by degree, zoom/pan controls
- Lazy clustering for graphs with >200 nodes (vis-network clustering API)

**Technical Notes:**
- vis-network integrated directly via `useRef<HTMLDivElement>` + `useEffect` pattern
- ForceAtlas2Based solver for superior cluster formation
- Dependencies: `vis-network` and `vis-data` npm packages
- Consider only if D3.js approach (Phase 7.2) proves insufficient for >500 node graphs or if Canvas rendering is needed for performance

**Exit Criteria:**
- Same as Phase 7.2 exit criteria, using vis-network instead of D3.js

---

## Phase 8: Synthesis Agent & Intelligence Layer

**Goal:** Cross-reference all domain findings to generate hypotheses, contradictions, evidence gaps, timeline events, cross-modal/cross-domain conclusions, and case-level summary/verdict. Connect existing frontend components to real data.

**Requirements:** REQ-AGENT-008, REQ-HYPO-001/002/003/004/005/006, REQ-WOW-001/002/003/004, REQ-VIS-004/005/006, REQ-TASK-001/002

**Depends on:** Phase 7.1 (curated KG with semantic relationships), Phase 7 (case_findings + DB tables)

**Status:** ✅ COMPLETE (2026-02-09)

**Plans:** 7 plans in 3 waves — all complete, plus 3 post-completion bugfix commits

Plans:
- [x] 08-01-PLAN.md — DB schema (InvestigationTask model, Case verdict columns, Alembic migration, Pydantic schemas)
- [x] 08-02-PLAN.md — Synthesis Agent (runner, prompt, factory, input assembly, output writer, pipeline Stage 8)
- [x] 08-03-PLAN.md — Backend API endpoints (synthesis, hypotheses, contradictions, gaps, tasks, timeline)
- [x] 08-04-PLAN.md — Frontend types, API client, React Query hooks for synthesis data
- [x] 08-05-PLAN.md — Frontend Verdict card components + VerdictView layout
- [x] 08-06-PLAN.md — Frontend DetailSidebar panels + Command Center tab toggle + SSE wiring
- [x] 08-07-PLAN.md — Frontend Timeline wiring + Case header verdict badge + backend CaseResponse schema

Post-completion fixes:
- [x] Gemini schema compat: replaced `dict[str, str]` with `CrossModalLink` typed model (Gemini rejects `additionalProperties`)
- [x] Pipeline crash: `CaseFile.content_type` → `CaseFile.mime_type`, timeline date string→datetime parsing, Timeline hydration/scroll-position warnings
- [x] Gap entity display: prompt changed from position indices to UUIDs, `RelatedEntity` model with batch resolution in API, entity name + type badge in sidebar; KG agent event routing fixed (`_extract_agent_type` rsplit for multi-word prefixes)

### Frontend Available (Yatharth, 2026-02-02)
- ✅ Timeline view with day/week/month/year zoom, layer filtering, event cards, search (`Timeline/`)
- ✅ Evidence source panel (`evidence-source-panel.tsx`)
- ✅ Timeline SSE hooks ready (`useTimelineSSE.ts`)
- ⏳ Hypothesis view (pending implementation or connection)
- ⏳ Contradictions panel (basic conflict UI in Evidence Library)
- ⏳ Evidence gaps panel (not started)

**Deliverables:**
- Synthesis Agent implementation (LLM, Gemini Pro, `thinking_level="high"`):
  - **Input Assembly (two-source DB read pattern):**
    1. **Domain agent findings** (via `case_findings` table): ALL rows for the case's workflow — each contains `finding_text` (rich markdown with inline citations), `citations` (JSONB with file_id + locator + exact_excerpt), `agent_type` (financial/legal/evidence/strategy), `category`, `confidence`. These are the outputs from all domain agents + strategy agent, saved to DB in pipeline Stage 6 (Save Findings).
    2. **Curated knowledge graph** (via `kg_entities` + `kg_relationships` tables): Entities with `name`, `entity_type`, `description_brief`, `description_detailed`, `aliases`, `domains`, `source_finding_ids` — and relationships with `label`, `relationship_type`, `evidence_excerpt`, `temporal_context`, `source_finding_ids`, `confidence`. These are the curated outputs from the LLM KG Builder Agent (pipeline Stage 7), which reads ALL domain outputs holistically.
    3. **Case metadata**: `cases.name`, `cases.description`, `cases.case_type`
    4. **File metadata**: `case_files.original_filename`, file type, upload date (for cross-referencing citations)
  - Gemini 3 Pro with 1M context window (sufficient: ~100-150K tokens for 50-file cases)
  - Output (SynthesisOutput Pydantic model):
    a. `hypotheses: list[Hypothesis]` — Case hypotheses with initial confidence + supporting/contradicting evidence
    b. `contradictions: list[Contradiction]` — Detected contradictions with exact source pairs, severity (minor/significant/critical)
    c. `gaps: list[EvidenceGap]` — Missing evidence with priority ranking, what's needed, why
    d. `cross_modal_links: list[CrossModalLink]` — Temporal correlations across modalities (video ↔ document, audio ↔ text)
    e. `cross_domain_conclusions: list[CrossDomainConclusion]` — Insights from combining financial + legal + evidence + strategy findings
    f. `timeline_events: list[TimelineEvent]` — Chronological events extracted from findings with date/time, type, layer
    g. `case_summary: str` — Executive summary of the entire case
    h. `case_verdict: CaseVerdict` — Overall assessment with confidence, key strengths, key weaknesses
    i. `risk_assessment: str` — Risk factors and mitigation suggestions
    j. `has_location_data: bool` — Trigger flag for Geospatial Agent (Phase 8.1)
- Store results in dedicated synthesis tables (schema from Phase 7 migrations):
  - case_hypotheses, case_contradictions, case_gaps, case_synthesis, timeline_events
- Pipeline wiring:
  - New Stage 8 in the pipeline, triggered after LLM KG Builder (Stage 7) + Entity Backfill (Stage 7b) complete
  - Reads `case_findings` + `kg_entities` + `kg_relationships` via SQL (not through LLM session state — fresh stage-isolated session)
  - Both data sources populated by earlier pipeline stages: findings from domain agents (Stage 6), KG from LLM KG Builder (Stage 7)
  - Stores all outputs via dedicated storage services
  - Triggers Geospatial Agent (Phase 8.1) if `has_location_data == True`
- SSE events:
  - `SYNTHESIS_STARTED`, `SYNTHESIS_COMPLETE`
  - `HYPOTHESIS_CREATED` (per hypothesis)
  - `CONTRADICTION_DETECTED` (per contradiction)
  - `GAP_IDENTIFIED` (per gap)
  - `TIMELINE_EVENT_CREATED` (per event)
- Synthesis API endpoints:
  - `GET /api/cases/:caseId/synthesis` — Full synthesis results (summary, verdict, conclusions)
  - `GET /api/cases/:caseId/hypotheses` — Hypotheses with evidence links
  - `GET /api/cases/:caseId/contradictions` — Contradictions with source pairs
  - `GET /api/cases/:caseId/gaps` — Evidence gaps with priorities
  - `GET /api/cases/:caseId/timeline/events` — Timeline events
- Frontend integration (connecting existing components to real data):
  - Hypothesis view → case_hypotheses API (cards with claim, status badge, confidence meter, evidence counts)
  - Contradictions panel → case_contradictions API (claim A vs claim B, severity, source navigation)
  - Evidence gaps panel → case_gaps API (description, priority, suggestions)
  - Timeline → timeline_events API (TimelineCore.tsx, TimelineEventCard.tsx connected to real events)
  - Case summary/verdict display (in case layout or dedicated component)
- Investigation task generation:
  - Tasks from contradictions (`resolve_contradiction`)
  - Tasks from gaps (`obtain_evidence`)
  - Tasks from pending hypotheses (`verify_hypothesis`)
  - Task deduplication via existing task list injection into synthesis prompt
  - Stored in investigation_tasks table

**Known Issues to Resolve (from `.planning/MINOR_ISSUES.md`):**
- ~~**MI-003**: Fuzzy entity deduplication~~ — **RESOLVED by Phase 7.1**: The programmatic KG Builder (with fuzzy dedup) was replaced by the LLM-based KG Builder Agent, which uses a clear-and-rebuild strategy with natural LLM deduplication. No fuzzy matching exists anymore.
- **MI-004**: Pipeline summary log mixes triage entity count + domain entity count as `entities=N`, confusingly alongside `kg_entities=M`. Fix: rename or separate the counters in `pipeline.py` for clarity.

**Technical Notes:**
- Synthesis Agent runs in fresh stage-isolated ADK session (consistent with existing pattern)
- Input is TEXT from PostgreSQL (case_findings + kg_entities + kg_relationships), NOT multimodal file content
- Synthesis reads the outputs of ALL agents that ran for this workflow: domain agent findings (financial, legal, evidence) + strategy findings are in case_findings; the curated entity/relationship graph from LLM KG Builder is in kg_entities/kg_relationships
- 1M context window handles even large cases comfortably (~100-150K tokens for 50-file case)
- Cost estimate: ~$0.10-0.15 per synthesis run at Gemini Pro rates
- Synthesis prompt: "Every contradiction must cite exact source excerpts from both sides"
- Hypothesis confidence: deterministic (sum(supporting_weights) / sum(all_weights)), user override allowed
- Timeline events are a natural byproduct of chronological cross-referencing (no separate timeline agent)
- Synthesis is a BATCH operation, runs once per analysis pipeline
- All synthesis outputs reference back to case_findings IDs and kg_entity IDs for traceability
- Full pipeline: Triage → Orchestrator → Domain Agents (parallel) → Strategy (sequential) → HITL → Save Findings → LLM KG Builder → Backfill Entity IDs → **Synthesis** → [Geospatial if locations] → Final
- `investigation_tasks` table does NOT exist yet — must be created in Phase 8 (new model + Alembic migration) if task generation is included, or deferred
- **Key files to create:**
  - `backend/app/agents/synthesis/` — Synthesis agent module (agent, prompts, schemas)
  - `backend/app/services/synthesis_service.py` — Storage service for synthesis outputs
  - `backend/app/api/synthesis.py` — Synthesis API endpoints
  - `backend/app/api/timeline.py` — Timeline API endpoints
  - `backend/app/api/hypotheses.py` — Hypothesis API endpoints

**Exit Criteria:**
- Synthesis Agent produces unified analysis from all domain findings
- Hypotheses generated with evidence links and confidence scores
- Contradictions detected with severity and exact source citations on both sides
- Evidence gaps identified with priority and actionable suggestions
- Timeline events populate the Timeline view with real data
- Cross-modal and cross-domain conclusions identified
- Case summary and verdict generated
- All results stored in appropriate tables and accessible via API
- SSE events signal data readiness for frontend
- Existing frontend components display real data (not mock)
- Investigation tasks generated from contradictions/gaps/hypotheses

---

## Phase 8.1: Geospatial Agent & Map View (On-Demand)

**Goal:** On-demand geospatial intelligence: user-triggered extraction, geocoding, and visualization of location-based case evidence with citations.

**Requirements:** REQ-GEO-001 through REQ-GEO-011

**Depends on:** Phase 8 (Synthesis data: hypotheses, contradictions, gaps, timeline)

**Status:** ⏳ PLANNED

**Plans:** 5 plans in 5 waves

Plans:
- [ ] 08.1-01-PLAN.md — Geocoding service (googlemaps library + caching)
- [ ] 08.1-02-PLAN.md — Geospatial Agent (runner + prompt + schemas + pipeline integration)
- [ ] 08.1-03-PLAN.md — Locations API (6 endpoints: generate, status, list, detail, paths, delete)
- [ ] 08.1-04-PLAN.md — Frontend data hook + trigger UI (useGeospatialData + status banner + generate/refresh buttons)
- [ ] 08.1-05-PLAN.md — Location detail panel enhancement (citations, temporal analysis, related entities)

**Deliverables:**
- Geospatial Agent implementation (LLM with tools):
  - **On-demand execution** (user-triggered from Geospatial tab, NOT auto-triggered)
  - Accesses synthesis outputs, domain findings, KG entities, timeline events from DB
  - Extracts location references (addresses, place names, coordinates)
  - Disambiguates ambiguous place names using context
  - Geocodes locations to coordinates via Google Maps Geocoding API
  - Detects movement patterns and temporal-spatial relationships
  - Categorizes locations by type (crime_scene, witness_location, evidence_location, suspect_location, other)
  - Associates events with locations (what happened where, when)
  - **Citation-based**: every location must have source file_id + page/timestamp + excerpt
  - Gemini 3 Pro with `thinking_level="medium"`
  - Inline Pro-to-Flash fallback
- Geocoding Service (`backend/app/services/geocoding_service.py`):
  - Google Maps Geocoding API integration
  - Address → coordinates resolution
  - Reverse geocoding for coordinate-only locations
  - Caching to avoid redundant API calls
- Locations API endpoints (`backend/app/api/locations.py`):
  - `POST /api/cases/:caseId/geospatial/generate` — Trigger geospatial analysis (on-demand)
  - `GET /api/cases/:caseId/geospatial/status` — Check if analysis exists + status
  - `GET /api/cases/:caseId/locations` — All locations with coordinates, types, events
  - `GET /api/cases/:caseId/locations/:locationId` — Location detail with citations
  - `DELETE /api/cases/:caseId/geospatial` — Clear geospatial data (for regeneration)
- Locations table population (schema exists from Phase 7):
  - name, coordinates {lat, lng}, location_type, source_entity_ids, temporal_associations
  - Hybrid storage: DB persistence + regeneration capability
- Movement pattern detection:
  - Connect locations showing movement over time (using timeline + temporal_associations)
  - GeospatialPath generation (from → to, with timestamps)
  - Route type classification (confirmed vs inferred based on evidence)
- Frontend enhancements (GeospatialMap component):
  - **"Generate Geospatial Intelligence" button** (triggers POST /geospatial/generate)
  - **Status indicator** (not generated / generating / complete)
  - **Refresh button** (regenerate analysis after new evidence added)
  - Replace mock data with real API data
  - Color-coded location markers by type
  - Movement paths visualization (solid for confirmed, dashed for inferred)
  - Click interactions → detailed intelligence panel
  - Intelligence panel shows: location name, type, events at location, citations, temporal associations
  - Basic filtering (by location type, date range)
- SSE events: `GEOSPATIAL_GENERATING`, `LOCATION_ENRICHED`, `GEOSPATIAL_COMPLETE`

**Technical Notes:**
- Geospatial Agent is an **on-demand** utility, triggered only when user requests it
- Storage is **hybrid**: results stored in DB (persistent), but can be regenerated
- Agent reads from: case_findings, case_synthesis, case_hypotheses, timeline_events, kg_entities, kg_relationships
- Google Maps API already integrated in frontend (GeospatialMap uses it)
- Map component already exists with Google Maps — replace mock data, add trigger UI
- **Key files to create:**
  - `backend/app/agents/geospatial.py` — Geospatial agent (follows synthesis.py pattern)
  - `backend/app/agents/prompts/geospatial.py` — Agent system prompt
  - `backend/app/services/geocoding_service.py` — Geocoding API wrapper
  - `backend/app/api/locations.py` — Location API endpoints
  - `backend/app/schemas/geospatial.py` — Pydantic schemas for geospatial output
- **Key files to modify:**
  - `frontend/src/app/(app)/cases/[id]/geospatial/page.tsx` — Add trigger button, replace mock data
  - `frontend/src/components/Geospatial/GeospatialMap.tsx` — Enhanced props for events + citations

**Exit Criteria:**
- User can trigger geospatial analysis from Geospatial tab
- Locations extracted and geocoded from case data (synthesis + findings + KG + timeline)
- Locations stored in DB with citations (file_id, page/timestamp, excerpt)
- Movement patterns detected and stored as paths
- Map View displays real location data with color-coded markers
- Location markers clickable → detail panel with events, citations, temporal data
- Regeneration capability (user can refresh analysis)
- No auto-triggering (purely on-demand)

---

## Phase 9: Chat Interface

**Goal:** Evidence-backed case Q&A via a Chat Agent that has full access to every analysis table (findings, KG, synthesis, timeline, locations, tasks). Every statement the agent makes MUST be grounded in exact sources already stored in the database from prior agent runs. The agent receives the complete verdict and synthesis context on initialization, then fetches filtered data from DB tables for every query.

**Requirements:** REQ-CHAT-001 (frontend done), REQ-CHAT-002, REQ-CHAT-004, REQ-AGENT-007f, REQ-SOURCE-005 (complete from Phase 10)

**Deferred to later phases:** REQ-CHAT-003 (agent escalation), REQ-CHAT-005 (DB-persisted history), REQ-AGENT-007g (context compaction), REQ-RESEARCH-001/002/003/005/006/007/008/009 (Research/Discovery system), REQ-HYPO-008 (hypothesis fullscreen), REQ-GEO-010 (geo temporal sync)

**Depends on:** Phase 7 (KG tables), Phase 8 (synthesis tables), Phase 10 (source viewer wiring)

**Plans:** 2 plans in 2 waves

Plans:
- [x] 09-01-PLAN.md — Backend: Chat tools (4 DB-query tool factories), system prompt with context injection, chat service, SSE streaming POST endpoint, router registration
- [x] 09-02-PLAN.md — Frontend: SSE streaming hook rewrite, markdown rendering, citation chips, tool activity indicators, stop/clear buttons, disabled state


**Status:** ✅ COMPLETE

### Frontend Completed (Yatharth, 2026-02-02)
- ✅ Floating chat button with animations (`chatbot.tsx`)
- ✅ Draggable/resizable chat window
- ✅ Message history display with user/assistant distinction
- ✅ Typing indicator with animated dots
- ✅ Case context awareness (name, status, description)
- ✅ Minimize/maximize functionality
- ✅ Liquid glass effect styling
- ✅ Keyboard support (Enter to send, Shift+Enter newline)
- ✅ Mock fallback when backend unavailable (`useChatbot.ts`)

### Backend Work

**Deliverables:**

#### 1. Chat Agent (standalone LlmAgent with DB-querying tools)
- Model: Gemini 3 Flash with `thinking_level="high"`
- **System prompt context injection** (loaded when pipeline finishes or chat session starts):
  - Full `case_synthesis.case_verdict` (JSONB — structured verdict assessment)
  - Full `case_synthesis.case_summary` (executive summary text)
  - Full `case_synthesis.key_findings_summary` (distilled key findings)
  - Full `case_synthesis.risk_assessment` (risk narrative)
  - `case_synthesis.cross_domain_conclusions` (cross-domain links)
  - Counts: number of findings, entities, hypotheses, contradictions, gaps, timeline events, locations, tasks
  - This gives the agent full investigative context from message #1 — no cold start
- **System prompt tool-table mapping** (explicit instructions per tool):
  - The system prompt MUST describe each tool, the exact DB table it queries, the filterable columns, and when to use it
  - The prompt MUST instruct: "For EVERY factual statement you make, you MUST first call the relevant tool to fetch the supporting data. NEVER state facts from memory alone — always ground in a tool call result. Include the exact citation (file_id, page/timestamp, excerpt) from the tool result in your response."
  - The prompt MUST include the query strategy: "For questions about entities/relationships → query_knowledge_graph. For domain-specific findings → get_domain_findings. For hypotheses/status → get_hypotheses. For conflicts between sources → get_contradictions. For missing info → get_gaps. For chronological questions → get_timeline_events. For location questions → get_locations. For broad evidence search → search_findings."

- **Tools (7 tools, all SQL-backed, each maps to explicit DB tables):**

  - `query_knowledge_graph` — Queries `kg_entities` and `kg_relationships` tables
    - Params: entity_name (fuzzy match on `name`/`name_normalized`), entity_type filter, relationship_type filter, domain filter
    - Returns: Matching entities with properties, aliases, descriptions, confidence, source_finding_ids; relationships with labels, evidence_excerpt, temporal_context, confidence
    - Table columns: kg_entities.{name, entity_type, domain, confidence, properties, aliases, description_brief, description_detailed, source_finding_ids} + kg_relationships.{relationship_type, label, strength, evidence_excerpt, source_finding_ids, temporal_context, confidence}

  - `get_domain_findings` — Queries `case_findings` table filtered by agent_type and/or category
    - Params: agent_type (financial/legal/evidence/strategy), category (optional), min_confidence (optional)
    - Returns: Findings with title, finding_text, confidence, citations[], entity_ids[]
    - Table columns: case_findings.{agent_type, category, title, finding_text, confidence, citations, entity_ids}
    - Citations contain: {file_id, locator, excerpt} — these are the EXACT source references

  - `get_hypotheses` — Queries `case_hypotheses` table
    - Params: status filter (PENDING/SUPPORTED/REFUTED), min_confidence (optional)
    - Returns: Hypotheses with claim, status, confidence, supporting_evidence[], contradicting_evidence[], reasoning
    - Table columns: case_hypotheses.{claim, status, confidence, supporting_evidence, contradicting_evidence, source_agent, reasoning}

  - `get_contradictions` — Queries `case_contradictions` table
    - Params: severity filter (minor/significant/critical), resolution_status filter (unresolved/resolved)
    - Returns: Contradictions with claim_a, claim_b, source_a, source_b, severity, domain
    - Table columns: case_contradictions.{claim_a, claim_b, source_a, source_b, severity, domain, resolution_status}

  - `get_gaps` — Queries `case_gaps` table
    - Params: priority filter (low/medium/high/critical)
    - Returns: Gaps with description, what_is_missing, why_needed, priority, related_entity_ids, suggested_actions
    - Table columns: case_gaps.{description, what_is_missing, why_needed, priority, related_entity_ids, suggested_actions}

  - `get_timeline_events` — Queries `timeline_events` table
    - Params: date_range (start/end), event_type filter, entity_id filter
    - Returns: Events with title, description, event_date, event_end_date, event_type, layer, source_entity_ids, citations[]
    - Table columns: timeline_events.{title, description, event_date, event_end_date, event_type, layer, source_entity_ids, citations}

  - `search_findings` — Full-text search over `case_findings` via PostgreSQL tsvector
    - Params: query string, agent_type filter (optional), limit
    - Returns: Ranked findings matching the search query, with citations
    - Uses: case_findings tsvector GIN index for fast full-text search

#### 2. Chat API Endpoint
- `POST /api/cases/:caseId/chat` (streaming SSE response)
- Request: `{ message, context, history[] }` (session-only history sent from frontend)
- Response: SSE stream with events: `message_chunk`, `tool_call`, `tool_result`, `citation`, `done`
- On first request per session: loads full synthesis context into agent system prompt

#### 3. Chat Session (no DB persistence)
- Chat history lives in frontend React state only (session-scoped)
- History sent with each request for conversational continuity
- **PDF export button**: Exports the complete chat session as a well-formatted PDF
  - Includes: all messages (user + assistant), inline citations, timestamps
  - Formatted with case name, date, and proper typography
  - Generated server-side via `GET /api/cases/:caseId/chat/export-pdf` with chat history in request body
  - Or generated client-side using a PDF library (e.g., `jspdf` or `@react-pdf/renderer`)

#### 4. Inline Citations in Responses
- Citations formatted as [1], [2] with footer list per message
- Each citation links to source file + exact location (file_id, locator, excerpt)
- Hover shows source preview (excerpt text)
- Click opens SourceViewerModal at exact page/timestamp (reuses Phase 10 `useSourceNavigation` hook)
- The agent MUST include citations from tool call results — it cannot fabricate source references

#### 5. Context Caching (REQ-AGENT-007f)
- Context cache created when chat session starts for a case
- Cache includes full synthesis context (verdict, summary, conclusions)
- TTL: 2 hours (session duration)
- Chat queries use `cached_content` parameter for cost reduction

**Technical Notes:**
- **Context injection trigger**: When pipeline completes (status → READY), the synthesis context is ready for chat. On first chat message, the API loads case_synthesis + counts from all tables and injects into the agent's system prompt.
- **Mandatory tool grounding**: The system prompt enforces that the agent MUST call tools before making factual claims. This prevents hallucination by requiring DB-backed evidence for every statement.
- **Citation passthrough**: Domain agent findings already contain `citations: [{file_id, locator, excerpt}]`. The chat agent passes these through to the response. No citation fabrication — only citations that exist in the DB.
- **Frontend API path update**: Current frontend calls `POST /api/chat` — must update to `POST /api/cases/:caseId/chat`
- **Frontend citation rendering**: Must add citation parsing ([1], [2] format), hover preview, and click-to-open SourceViewerModal wiring in `chatbot.tsx`
- **Key files to create:**
  - `backend/app/agents/chat/` — Chat agent module (agent definition, system prompt, tool definitions)
  - `backend/app/api/chat.py` — Chat API endpoint with SSE streaming
  - `backend/app/services/chat_service.py` — Tool implementations (DB queries), context assembly
- **Frontend files to modify:**
  - `frontend/src/components/app/chatbot.tsx` — Add citation rendering, PDF export button, real API integration
  - `frontend/src/hooks/useChatbot.ts` — Replace mock with SSE streaming, add export function
  - `frontend/src/types/chatbot.ts` — Add citation types, export types

**Exit Criteria:**
- Chat answers questions about case using DB-backed tools
- Every factual statement in chat responses has an inline citation to an exact source (file_id + page/timestamp + excerpt)
- Citations are clickable and open SourceViewerModal at the correct location
- Full verdict + synthesis context available to the agent from the first message
- Agent queries the correct DB table for each type of question (KG, findings, hypotheses, contradictions, gaps, timeline)
- Chat session exportable as well-formatted PDF
- Context caching working (verify via Gemini API cost reduction)
- Frontend mock replaced with real SSE streaming API
- All type checks and build pass

---

## Phase 10: Source Panel & Entity Resolution

**Goal:** Wire citation-to-source navigation across all views and resolve all entity IDs to human-readable names with type badges.

**Requirements:** REQ-SOURCE-001 (complete), REQ-SOURCE-002 (complete), REQ-SOURCE-003 (complete), REQ-SOURCE-004 (complete)

**Status:** ✅ COMPLETE (2026-02-09)

**Plans:** 3 plans in 3 waves

Plans:
- [x] 10-01-PLAN.md -- Shared utilities: citation-utils, useSourceNavigation hook, useEntityResolver hook, CitationLink + EntityBadge components
- [x] 10-02-PLAN.md -- Wire KG entity panel, EntityTimelineEntry, and Geospatial detail panel
- [x] 10-03-PLAN.md -- Wire Verdict detail panels (hypothesis, contradiction, gap) and Timeline event cards

**Scope (narrowed from original Phase 10 via CONTEXT.md):**
- **Track 1 -- Source Viewer Wiring:** Connect citations across ALL views to open SourceViewerModal with real source files at exact page/timestamp locations. Components already built in Phase 7.2 (SourceViewerModal, PdfViewer, AudioViewer, VideoViewer, ImageViewer); only the data pipeline needs wiring.
- **Track 2 -- Entity Name Resolution:** Resolve ALL entity integer IDs and UUIDs to human-readable names + type badges across every view (KG, Geospatial, Verdict, Timeline).

**Deferred (out of scope for this phase):**
- Agent Flow refinements (thinking overlay, task badges, time-scrubbing, playback, pause/resume, fullscreen)
- Investigation Task Panel
- Narrative generation (executive summary, reports)
- PDF/DOCX export
- Image bounding box annotations
- Audio transcript sync highlighting

**Deliverables:**
- Shared useSourceNavigation hook: citation {file_id, locator, excerpt} -> SourceViewerContent with signed URL
- Shared useEntityResolver hook: entity UUID -> {name, entity_type, color} via cached graph data
- citation-utils.ts: locator parser (page:N, ts:HH:MM:SS, region:x,y,w,h), category-to-viewer mapper
- Reusable CitationLink and EntityBadge UI components
- KG entity panel: source finding IDs clickable -> opens SourceViewerModal
- EntityTimelineEntry: "View source evidence" replaces "Source not yet available"
- Geospatial detail panel: citations open SourceViewerModal, entity IDs show resolved names + type badges
- Verdict hypothesis evidence items clickable -> two-hop finding -> citation -> source navigation
- Verdict contradiction source excerpts clickable
- Verdict gap entity badges use consistent getEntityColor styling
- Timeline event card source count expandable with clickable source links

**Technical Notes:**
- Frontend-only phase: no new backend endpoints needed (all data accessible via existing APIs)
- Two-hop resolution for findings: finding_id -> GET /findings/:id -> citations[] -> file_id -> signed URL
- Entity resolution via cached graph data: GET /graph returns all entities, cached per case session
- File metadata cached via React Query (staleTime: 5 min)
- Signed URLs cached via existing useFileUrlCache hook (1h cache, 24h expiry)
- Race condition prevention via request counter ref in useSourceNavigation
- PDF highlight: first 100 chars of excerpt for search match reliability

**Exit Criteria:**
- Citations clickable from ALL views: KG entity panel, KG timeline entry, Verdict (hypothesis/contradiction), Geospatial detail, Timeline cards
- Clicking any citation opens SourceViewerModal at correct page/timestamp with excerpt highlighting
- Entity IDs resolved to human-readable names + type badges in Geospatial and across all views
- No "Source not yet available" placeholders remain in KG views
- All type checking and build pass

---

## Phase 11: Corrections & Refinement

**Goal:** Enable user corrections and regeneration of stale items.

**Requirements:** REQ-CORR-001, REQ-CORR-002, REQ-CORR-003, REQ-CORR-004

**Deliverables:**
- Error flagging UI on findings/nodes
- Correction input form
- Verification Agent implementation
- Correction verification flow
- Knowledge Graph update logic
- Stale item tracking
- Stale item indicators
- Regeneration triggers

**Technical Notes:**
- Verification Agent re-checks sources before accepting correction
- Corrections logged with provenance
- Downstream items marked STALE via graph traversal
- Regeneration re-runs affected portion of pipeline

**Exit Criteria:**
- User can flag errors
- Verification Agent validates corrections
- Confirmed corrections update graph
- Stale items visible and regenerable

---

## Phase 12: Demo Preparation

**Goal:** Prepare compelling demo with fraud case, showcasing all integration features.

**Requirements:** Demo readiness (non-functional), REQ-AGENT-007i (optional), REQ-RESEARCH-004

**Deliverables:**
- Fraud demo case dataset
  - Financial records (invoices, statements)
  - Video depositions (2-3 clips)
  - Audio recordings (phone calls)
  - Images (photos, scans)
  - Legal documents (contracts, filings)
  - Planted contradictions and gaps
  - **Location data for geospatial demo** (addresses, GPS coordinates)
  - **Multiple hypotheses to demonstrate lifecycle**
- **Integration features showcase:**
  - **Hypothesis system demo:** Show PENDING → SUPPORTED → CONFIRMED lifecycle
  - **Map View demo:** Location extraction, movement patterns, satellite imagery
  - **Investigation Tasks demo:** Tasks from contradictions/gaps, bottom drawer interaction
  - **Research/Discovery demo:** On-demand research via chat
- **Deep Research Agent demo (optional WOW feature):**
  - Integration with `deep-research-pro-preview-12-2025`
  - Background autonomous research on case subjects
  - Progress streaming via `thinking_summaries: "auto"`
  - Demo flow: "Research background on [demo subject]"
  - Results integrated into case context
- Demo script with talking points
- Performance optimization
  - Lazy loading
  - Query optimization
  - Context caching for demo case (pre-warmed)
- Error handling polish
- Loading states and skeleton UIs
- README with setup instructions
- API documentation

**Technical Notes:**
- Demo dataset designed to showcase all WOW features
- Pre-process demo case for faster demo (context cache pre-created)
- Deep Research runs in background while demoing other features
- **Demo flow includes: upload → analysis → hypotheses → map → tasks → chat**
- Rehearse demo flow multiple times

**Exit Criteria:**
- Demo case runs end-to-end smoothly
- All WOW features demonstrated
- **Demo showcases hypotheses with status updates**
- **Demo showcases map view with locations**
- **Demo showcases investigation tasks**
- Deep Research demo shows autonomous research capability (optional)
- No errors during demo flow
- Compelling narrative from demo

---

## Post-MVP: Memory Service

**Goal:** Enable cross-case learning and pattern recognition.

**Requirements:** REQ-MEM-001

**Deliverables:**
- VertexAiMemoryBankService integration
- Memory storage for investigation patterns
- PreloadMemoryTool for relevant memory retrieval
- Cross-case similarity search
- User opt-in controls for memory storage
- Memory isolation per user

**Technical Notes:**
- Requires migration to Agent Engine (managed service)
- Memory bank persists across sessions
- Enables "Have you seen similar patterns?" functionality

**Exit Criteria:**
- Memory service operational
- Past case patterns retrievable
- Privacy controls working

---

## Dependency Graph

```
Phase 1 (Foundation)
    │
    ├── Phase 1.1 (Frontend Design Foundation) ← INSERTED
    │
    └── Phase 2 (Auth & Case)
            │
            └── Phase 3 (File Ingestion)
                    │
                    └── Phase 4 (Core Agent System)
                            │
                            ├── Phase 4.1 (Decision Tree Revamp) ← INSERTED
                            │
                            └── Phase 5 (Agent Flow)
                                    │
                                    └── Phase 6 (Domain Agents)
                                            │
                                            └── Phase 7 (Knowledge Storage & Domain Enrichment)
                                                    │
                                                    └── Phase 7.1 (LLM-Based KG Builder Agent)
                                                            │
                                                            ├── Phase 7.2 (D3.js KG Frontend Enhancement)
                                                            │
                                                            ├── Phase 7.3 (vis-network KG Frontend) ← DEFERRED/OPTIONAL
                                                            │
                                                            └── Phase 8 (Synthesis & Intelligence Layer)
                                                                    │
                                                                    ├── Phase 8.1 (Geospatial & Map View)
                                                                    │
                                                                    └── Phase 9 (Chat Interface)
                                                                            │
                                                                            └── Phase 10 (Source Panel)
                                                                                    │
                                                                                    └── Phase 11 (Corrections)
                                                                                            │
                                                                                            └── Phase 12 (Demo Prep)
```

Note: Phase 7.1 (KG Builder Agent) is a prerequisite for both Phase 7.2 (frontend) and Phase 8 (synthesis) — curated KG data is needed by both. Phase 7.2 and Phase 8 can run in parallel since they're independent (frontend vs backend). Phase 7.3 is deferred/optional — only if D3.js proves insufficient. Phase 8.1 runs after Phase 8 synthesis completes. Phase 9 depends on both Phase 7.1 (KG tables) and Phase 8 (synthesis tables).

---

## Risk Mitigation

| Risk | Mitigation | Phase |
|------|------------|-------|
| ADK production limitations | Fresh instances, state namespacing, test early, document limitations | 4 |
| ADK tool confirmation unavailable | Frontend confirmation dialogs (DatabaseSessionService limitation) | 7 |
| Tools + output_schema conflict | Split into tool-agent → schema-agent pipeline | 5, 6 |
| Thought signatures lost | Let SDK handle; preserve entire response metadata in storage | 4 |
| SSE fails in Cloud Run | Proper headers, heartbeat, polling fallback | 1, 7 |
| LLM hallucination | Multi-agent verification, span-level citations | 5, 6, 11 |
| Rate limiting | Tier upgrade budget, request queuing, context caching | 4, 5, 9 |
| Cloud Run timeout | Async processing, chunked responses | 3, 4, 5 |
| Entity resolution at scale | Incremental ER with blocking | 6 |
| React Flow performance | Memoization, virtualization | 7 |
| Context window exhaustion | Context compaction for long sessions | 9 |
| High Gemini costs | Context caching (4x cheaper), Flash fallbacks | 5, 9 |
| Dense document extraction | media_resolution="high" for legal documents | 5 |
| Video/audio precision | VideoMetadata with start/end offsets | 5 |

---

## Parallel Work Opportunities

For 2 developers working simultaneously:

| Dev A | Dev B |
|-------|-------|
| Phase 1: Backend infra | Phase 1: Frontend infra |
| Phase 2: Backend auth middleware | Phase 2: Frontend auth UI |
| Phase 3: Backend file APIs | Phase 3: Frontend upload/library |
| Phase 4: ADK integration | Phase 4: Agent trace data model |
| Phase 5: Financial + Legal agents | Phase 5: Strategy + Evidence agents |
| Phase 6: Synthesis Agent | Phase 6: KG Agent + visualization |
| Phase 7: SSE streaming | Phase 7: React Flow UI |
| Phase 8: Intelligence logic | Phase 8: Contradictions/Gaps UI |
| Phase 9: Chat backend | Phase 9: Chat frontend |
| Phase 10: Source APIs | Phase 10: Source viewers |

---

*Roadmap Version: 5.0*
*Updated: 2026-02-08 (Phase 7.2 complete: D3.js KG Frontend with 46 commits; source viewer deferred to Phase 10)*
*Phase 1 planned: 2026-01-20*
*Phase 1.1 planned: 2026-01-23*
*Phase 1.1 complete: 2026-01-24*
*Phase 2 planned: 2026-01-24*
*Phase 2 complete: 2026-01-25*
*Frontend work by Yatharth: 2026-02-02 (Phases 3,5,7,9,10 frontend done)*
*Phase 3 planned: 2026-02-02*
*Phase 3 verified: 2026-02-02 (6/6 observable truths)*
*Phase 4 planned: 2026-02-02 (5 plans in 3 waves)*
*Phase 4 verified: 2026-02-03 (6/6 must-haves)*
*Phase 4.1 planned: 2026-02-04 (4 plans in 3 waves)*
*Phase 4.1 complete: 2026-02-04 (all 4 plans done, 18 commits)*
*Phase 5 planned: 2026-02-04 (4 plans in 3 waves)*
*Phase 5 complete: 2026-02-05 (all 4 plans + 15 post-plan fixes, 26 commits total)*
*Phase 6 planned: 2026-02-05 (5 plans in 3 waves)*
*Phase 6 complete: 2026-02-06 (5 plans + 21 post-plan commits = 35 total, 10/10 verified + hardening)*
*Architecture redesign: 2026-02-07 (Phases 7-9 restructured: KG-as-Memory, hybrid storage, programmatic KG Builder, vis-network, tool-based Chat)*
*Phase 7 planned: 2026-02-07 (6 plans in 3 waves — revised from 5 after checker feedback)
*Phase 7 complete: 2026-02-07 (6 plans, 11 commits, 8/8 must-haves verified)
*Phase 7.1 (vis-network) planned: 2026-02-07 (3 plans in 3 waves — SUPERSEDED by architecture revision 2026-02-08)
*Architecture revision: 2026-02-08 (Programmatic KG Builder → LLM-based KG Builder Agent; D3.js retained+enhanced; vis-network deferred to 7.3)
*Phase 7.1 (LLM KG Builder) planned: 2026-02-08 (2 plans in 2 waves)
*Phase 7.1 (LLM KG Builder) complete: 2026-02-08 (2 plans, 6 commits, 8/8 must-haves verified)
*Phase 7.2 (D3.js Enhancement) defined: 2026-02-08
*Phase 7.3 (vis-network, optional) renumbered: 2026-02-08
*Phase 7.2 (D3.js Enhancement) planned: 2026-02-08 (5 plans in 3 waves)
*Phase 7.2 (D3.js Enhancement) complete: 2026-02-08 (5 plans + 28 post-plan polish, 46 total commits; source viewer deferred to Phase 10)
*Phase 10 planned: 2026-02-09 (3 plans in 2 waves -- source viewer wiring + entity resolution)
