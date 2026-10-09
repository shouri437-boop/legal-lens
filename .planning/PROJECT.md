# Legal Lens

## What This Is

Legal Lens is a legal intelligence platform that processes multimodal evidence (documents, video, audio, images) through domain-specialized AI agents powered by Gemini 3. It generates knowledge graphs, timeline visualizations, and enables contextual chat — all with full transparency into AI decision-making via "Agent Flow." Built for the Gemini 3 Global Hackathon, targeting legal professionals and investigators who spend 60%+ of their time on manual evidence review.

## Core Value

**Transparent multimodal intelligence**: The system must process any combination of evidence types (PDF, video, audio, image) and surface connections, contradictions, and gaps — while showing exactly how it reached those conclusions. If users can't trust the AI's reasoning, nothing else matters.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Infrastructure & Auth**
- [ ] CI/CD pipeline deploys every push to main to Cloud Run
- [ ] User can sign up with email/password
- [ ] User can sign in with Google OAuth
- [ ] User session persists across browser refresh
- [ ] Each user sees only their own cases

**Case Management**
- [ ] User can create a new case with name and context description
- [ ] User can view list of their cases with status indicators
- [ ] User can delete a case (cascades to all associated data)
- [ ] User can upload multiple files to a case (PDF, DOCX, MP4, MP3, JPG, PNG)
- [ ] User can view and manage files within a case (Case Library)

**Agentic Processing Pipeline**
- [ ] Triage Agent classifies files by domain relevance (Financial, Legal, Strategy) and complexity
- [ ] Orchestrator routes files to appropriate Domain Agents based on triage scores
- [ ] Domain Agents process assigned files with native multimodal analysis
- [ ] Synthesis Agent cross-references findings for links, contradictions, gaps
- [ ] Knowledge Graph Agent builds entity-relationship graph from synthesis results
- [ ] Pipeline handles incremental file additions without full reprocessing
- [ ] Research Agent discovers external sources via Gemini web search
- [ ] Discovery Agent synthesizes external research into case context
- [ ] Geospatial Agent analyzes location intelligence post-synthesis

**Agent Flow**
- [ ] Real-time visualization shows agent execution flow during processing
- [ ] User can click any agent node to see: model used, input context, tools called, output findings
- [ ] Thinking traces captured and displayed for transparency
- [ ] SSE events stream agent progress to frontend

**Knowledge Graph & Visualizations**
- [ ] Force-directed graph displays entities and relationships
- [ ] Five toggleable layers: Evidence (red), Legal (blue), Strategy (green), Temporal (amber), Hypothesis (pink)
- [ ] Timeline view shows events chronologically with source links
- [ ] Cross-modal links visible (e.g., video timestamp matches receipt)
- [ ] Contradictions panel shows detected inconsistencies with evidence
- [ ] Evidence gaps panel shows what's missing to prove the case
- [ ] Map View displays geospatial intelligence with movement patterns
- [ ] Hypothesis View tracks investigation hypotheses with evidence support

**Hypothesis-Driven Investigation**
- [ ] Agents propose hypotheses from case analysis
- [ ] Users can accept, reject, modify, or add hypotheses
- [ ] Evidence linked to hypotheses with supporting/contradicting weights
- [ ] Simple 3-state lifecycle: PENDING → SUPPORTED/REFUTED (user can mark RESOLVED)
- [ ] Real-time hypothesis status updates via SSE

**Research & Discovery**
- [ ] Research Agent discovers where evidence might exist (Gemini web search)
- [ ] Orchestrator can trigger Research when evidence gaps detected (with user confirmation)
- [ ] Deep Research Agent integration for autonomous background research
- [ ] Discovery Agent synthesizes external research findings
- [ ] Binary access classification (ACCESSIBLE vs REQUIRES_ACTION)
- [ ] Suggest-then-confirm flow for source retrieval

**Investigation Task System**
- [ ] Agents generate actionable investigation tasks
- [ ] Task types: resolve_contradiction, obtain_evidence, verify_hypothesis, etc.
- [ ] Task list injected into agent context to avoid duplicates (simple approach)
- [ ] Tasks displayed in bottom drawer panel with priority indicators
- [ ] SSE streaming for task events (TASK_CREATED, TASK_UPDATED, etc.)

**Geospatial Intelligence**
- [ ] Geospatial Agent as post-synthesis utility agent
- [ ] Google Earth Engine integration for historical imagery and verification
- [ ] Location extraction and geocoding from evidence
- [ ] Movement pattern detection across timeline
- [ ] Side-by-side change detection comparison

**Source Panel**
- [ ] PDF viewer with highlighted excerpts and page navigation
- [ ] Video player with timestamp-linked key moments
- [ ] Audio player with waveform and transcript highlights
- [ ] Image viewer with bounding box annotations from agents
- [ ] Clicking any citation opens source at exact location

**Contextual Chat**
- [ ] User can ask questions about the case
- [ ] Chat queries Knowledge Graph first (fast path)
- [ ] Novel questions escalate to Domain Agents via Orchestrator
- [ ] Responses stream with inline citations linking to Source Panel
- [ ] Chat history persists across sessions

**Correction & Regeneration**
- [ ] User can flag errors in findings or graph
- [ ] Verification Agent validates corrections against original sources
- [ ] Confirmed corrections update Knowledge Graph incrementally
- [ ] Affected downstream items marked as STALE
- [ ] User can trigger regeneration of stale items

**WOW Capabilities (Pipeline Outputs)**
- [ ] Cross-modal evidence linking surfaces temporal correlations automatically
- [ ] Contradiction detection finds inconsistencies between claims and evidence
- [ ] Gap analysis identifies missing evidence needed to prove case elements
- [ ] One-click narrative generation produces briefs with embedded citations
- [ ] Video analysis mode provides real-time insights as video is processed

### Out of Scope

- **Judge Simulation** — Deferred to v2; requires verdict history data and adds complexity without strengthening core pipeline
- **Real-time collaborative editing** — Single-user PoC; multi-user collaboration adds sync complexity
- **Mobile app** — Web-first; mobile can come after core platform is proven
- **Third-party integrations (Gmail, Google Drive)** — Focus on direct upload; import features are v2+
- **Offline mode** — Cloud-dependent architecture; offline adds significant complexity
- **Custom domain agents** — Fixed three domains (Financial, Legal, Strategy) for v1; extensibility designed in AND exposed via APIs
- **FOIA Request Generation** — Deferred to v2; complex legal templates and agency-specific requirements
- **Curated Source Configuration** — Replaced by dynamic source discovery via Gemini web search

## Context

**Hackathon Context:**
- Gemini 3 Global Hackathon submission
- Demonstrating Gemini 3's native multimodal capabilities and Google ADK for agent orchestration
- Demo case: Fraud investigation with financial records, video depositions, images, audio files, contradicting alibis, legal reference documents

**Technical Environment:**
- Frontend: Next.js 16, React 19, TailwindCSS 4, Zustand, React Flow, D3.js
- Backend: Python 3.13, FastAPI, Google ADK, SQLAlchemy 2.x (async)
- AI: Gemini 3 Pro (complex reasoning), Gemini 3 Flash (triage)
- Infrastructure: GCP Cloud Run, Cloud SQL (PostgreSQL 17), Cloud Storage
- Auth: Better Auth (runs in Next.js API routes, shared PostgreSQL)
- CI/CD: GitHub Actions with Workload Identity Federation

**Key Architectural Decisions:**
- Domain-based agents (not file-type based) to leverage Gemini 3's native multimodal processing
- PostgreSQL for all storage (simplifies infrastructure, JSONB for flexible schemas)
- SSE for real-time updates (simpler than WebSocket, sufficient for use case)
- Intermediate persistence at phase boundaries for fault tolerance

## Constraints

- **Tech Stack**: Google ADK for agent orchestration — required for hackathon alignment with Google ecosystem
- **AI Models**: Gemini 3 Pro/Flash only — hackathon requirement to showcase Gemini 3 capabilities
- **Deployment**: GCP Cloud Run — must be deployed and demo-able from day 1
- **File Size**: Up to 500MB per file — Cloud Run timeout and memory constraints
- **Context Window**: 1M tokens — assumed sufficient for largest expected files

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Domain-based agents over file-type agents | Gemini 3 is natively multimodal; forcing single-modality wastes capability | — Pending |
| PostgreSQL over Firestore | DatabaseSessionService requires PostgreSQL; single DB simplifies ops | — Pending |
| SSE over WebSocket | Unidirectional streaming sufficient; simpler implementation | — Pending |
| Better Auth in Next.js | TypeScript library with good DX; Python backend reads auth tables | — Pending |
| GitHub Actions over Cloud Build | Faster setup, better debugging, sufficient GCP integration | — Pending |

---
*Last updated: 2026-01-21 after INTEGRATION.md feature incorporation*
