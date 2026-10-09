# Project Research Summary

**Project:** Legal Lens - Legal Intelligence Platform
**Domain:** Legal intelligence, e-discovery, investigation support with multi-agent AI
**Researched:** 2026-01-20
**Confidence:** HIGH

## Executive Summary

Legal Lens is a multimodal AI legal intelligence platform that must prioritize **transparency, accuracy, and source attribution** above all else. The research confirms that legal AI has a critical hallucination problem (58-88% for general LLMs, 17-34% even for purpose-built legal RAG), making verification architecture non-negotiable from day one. The platform should use domain-based agents (Financial, Legal, Strategy, Evidence) rather than file-type agents, leveraging Gemini 3's native multimodal capabilities. Google ADK provides the orchestration layer with specific constraints that must be designed around upfront.

The recommended approach is a hierarchical multi-agent architecture with an intelligent Orchestrator coordinating specialized domain agents. The stack centers on Next.js 16 + FastAPI + PostgreSQL + Google ADK, deployed on GCP Cloud Run. Real-time transparency is delivered via SSE streaming, with React Flow powering the "Agent Flow" visualization that differentiates Legal Lens from competitors.

The key risks are: (1) LLM hallucination requiring multi-agent verification and span-level citation, (2) multi-agent system failures (41-86.7% failure rate in research) requiring clear boundaries and orchestrator patterns, (3) ADK production limitations requiring fresh agent instances and state namespacing, and (4) SSE streaming failures in production requiring proper headers and fallback patterns. Mitigation requires building verification, monitoring, and fallback patterns from the foundation phase, not bolting them on later.

**ADK-Specific Optimizations Identified:**
- **Context caching** for 4x cost reduction on repeated evidence queries
- **Thinking mode configuration** per agent type (low/medium/high)
- **Media resolution** set to "high" for dense legal documents
- **Video/audio metadata** for precise timestamp analysis
- **Resilient agent wrapper** pattern for graceful degradation
- **Artifact service** for versioned evidence and report storage
- **Context compaction** for long investigation sessions
- **Deep Research agent** for autonomous background research

## Key Findings

### Recommended Stack

The stack optimizes for GCP-native deployment, async patterns, and real-time streaming. All choices are verified with official 2025/2026 documentation.

**Core technologies:**
- **Next.js 16.1 + React 19.2**: Frontend with Turbopack, streaming SSR, View Transitions
- **FastAPI 0.128.x + Python 3.12**: Async-first API with Pydantic v2 validation
- **PostgreSQL 17 + SQLAlchemy 2.0.45**: Async ORM with JSONB for flexible schemas
- **Google ADK 1.22.1 + Gemini 3**: Agent orchestration (hackathon requirement)
- **React Flow 12.10 + D3.js**: Agent trace and knowledge graph visualization
- **Tailwind CSS v4 + shadcn/ui**: Styling with 5x faster builds
- **SSE (sse-starlette 3.2)**: Real-time streaming (simpler than WebSockets, auto-reconnect)
- **Zustand + TanStack Query v5**: Client and server state management
- **Better Auth 1.4.15+**: Authentication (successor to NextAuth)

**Critical version constraints:**
- FastAPI 0.128+ (Pydantic v1 deprecated, Python 3.9+ required)
- React Flow renamed to @xyflow/react
- Tailwind v4 uses CSS-first config (no tailwind.config.js)
- ADK 1.22+ requires Python ≥3.10 (3.11+ strongly recommended)

### Expected Features

**Must have (table stakes):**
- File storage and ingestion (PDF, DOCX, images, video, audio)
- Gemini-native multimodal processing (no separate OCR/extraction pipelines needed)
- Full-text search across evidence corpus
- Source citations for every AI claim
- Metadata extraction and preservation
- Basic security (auth, access controls, audit logging)

**Key Simplification — Gemini Native Multimodal:**
Gemini 3 directly processes PDFs, scanned documents, video, and audio without separate pipelines. This eliminates:
- ❌ OCR libraries (Tesseract, etc.)
- ❌ Text extraction (PyPDF, python-docx)
- ❌ Audio transcription (Whisper, Cloud Speech)
- ❌ Video frame extraction

**Should have (differentiators):**
- AI Reasoning Traces / Agent Flow (Legal Lens core differentiator)
- Knowledge Graph / Entity Relationships (5 layers: Evidence, Legal, Strategy, Temporal, Hypothesis)
- Hypothesis-Driven Investigation (3-state: PENDING → SUPPORTED/REFUTED, agents propose, users curate)
- Geospatial Intelligence (location extraction, movement patterns, Earth Engine verification)
- Natural Language Querying (RAG)
- Document Summarization
- Entity Extraction
- Investigation Task System (agent-generated actionable tasks)
- Research & Discovery System (Gemini web search, Deep Research integration)

**Defer (v2+):**
- Judge Simulation (requires verdict history data)
- Custom Workflow Builder
- Third-party integrations (Slack, M365)
- Multi-language support
- Legal Hold Management
- Production/Export with Bates numbering

**Included in v1 (simplified by Gemini native multimodal):**
- Cross-Modal Evidence Linking — Gemini sees all modalities together, no post-hoc stitching
- Contradiction Detection — Natural output of Synthesis Agent cross-referencing
- Evidence Gap Identification — Synthesis Agent can identify what's missing

**Anti-features (never build):**
- Autonomous filing without attorney review
- Definitive legal conclusions
- Hidden AI reasoning (black box)
- Training on client data by default
- Auto-resolving contradictions (require human judgment)

### Architecture Approach

Legal Lens uses a hierarchical multi-agent architecture with an intelligent Orchestrator (LlmAgent with Gemini 3 Pro) that routes to specialized domain agents. The key insight: domain-based agents (Financial, Legal, Strategy, Evidence) handle all file types within their domain, leveraging Gemini 3's native multimodal capabilities rather than artificial file-type boundaries. The Evidence Agent evaluates authenticity, chain of custody, and provenance — critical for legal work.

**Major components:**
1. **Frontend Layer**: Next.js 16 with React Flow for Agent Flow, D3.js/vis-network for Knowledge Graph, Map View for geospatial, Hypothesis View
2. **API Layer**: FastAPI with SSE streaming for real-time progress updates
3. **Agent Layer**: ADK Runner with Orchestrator, Triage, Domain Agents (parallel), Synthesis, KG Agent
4. **Query-Time Agents**: Chat Agent (knowledge-first with escalation), Verification Agent, Merge Agent
5. **Research Agents**: Research Agent (web search), Discovery Agent (synthesize external research)
6. **Utility Agents**: Geospatial Agent (post-synthesis, location intelligence)
7. **Storage Layer**: PostgreSQL (all persistent data + sessions + hypotheses + tasks + locations), GcsArtifactService (evidence files with versioning)

**Key patterns:**
- Sequential Pipeline: Triage → Domain → Synthesis → KG
- Parallel Fan-Out: Financial, Legal, Strategy, Evidence agents run concurrently
- Knowledge-First Chat: Query existing knowledge, escalate only for novel questions
- Generator-Critic Loop: Quality refinement for synthesis
- Resilient Wrapper: Primary agent with fallback for graceful degradation

### ADK-Specific Configurations

**Thinking Mode per Agent:**

| Agent | Thinking Level | Rationale |
|-------|----------------|-----------|
| Triage | low | Speed priority, simple classification |
| Orchestrator | high | Complex routing decisions |
| Financial | medium | Balanced numerical analysis |
| Legal | high | Nuanced legal interpretation |
| Strategy | medium | Balanced synthesis |
| Evidence | high | Forensic-level authenticity analysis |
| Synthesis | high | Complex cross-referencing |
| Chat | medium | Responsive Q&A |
| Verification | high | Critical accuracy |
| Research | medium | Source discovery |
| Discovery | medium | External synthesis |
| Geospatial | medium | Location analysis |

**Media Resolution:** Set to `"high"` for Financial, Legal, Evidence agents processing dense documents with signatures, fine print, and tables.

**ADK Limitations Requiring Mitigation:**

| Limitation | Mitigation |
|------------|------------|
| Tool confirmation only with InMemorySessionService | Implement confirmation dialogs in frontend |
| Cannot use tools + output_schema together | Split into tool-agent → schema-agent pipeline |
| Single parent rule for agents | Factory pattern creates fresh instances per workflow |
| State updates commit after Event yield | Use unique output_keys per parallel agent |
| Temperature must stay at 1.0 | Never override (causes looping) |

**Cost Optimization:**
- **Context caching:** Create cache when user opens case; queries against cached evidence are 4x cheaper
- **Context compaction:** Summarize every 5 invocations for long investigations to prevent context exhaustion

**Advanced Features:**
- **Video/Audio metadata:** Use `VideoMetadata(start_offset, end_offset)` for precise segment analysis
- **Deep Research agent:** Background autonomous research via `deep-research-pro-preview` for case subjects
- **Artifact service:** `GcsArtifactService` provides versioning for correction/regeneration audit trails

### Critical Pitfalls

1. **LLM Hallucination** (CRITICAL) — Implement multi-agent verification and span-level citation from day one. Never trust LLM to return exact quotes. Dedicated Verifier Agent reduces critical errors by 82%.

2. **Multi-Agent System Failures** (CRITICAL) — Define clear agent boundaries, use Orchestrator pattern, implement deterministic workflows (SequentialAgent), namespace all state keys to prevent race conditions.

3. **ADK Production Limitations** (CRITICAL) — Create fresh agent instances for each workflow (single parent rule), avoid built-in tools in sub-agents, implement per-user agent factory, test outside ADK Web UI.

4. **Citation/Source Attribution Failures** (CRITICAL) — Only 74% citation accuracy in RAG systems. Extract exact text from sources rather than asking LLM to quote. Post-processing citation correction required.

5. **SSE Streaming Failures** (HIGH) — Works locally, fails in production. Require HTTP/2, set proper headers (X-Accel-Buffering: no), implement heartbeats, build polling fallback.

6. **ADK Tool Confirmation Limitation** (HIGH) — `require_confirmation` only works with InMemorySessionService, not DatabaseSessionService. Must implement confirmation dialogs in frontend instead.

7. **Thought Signatures** (HIGH) — Required for multi-turn function calling in Gemini 3. SDK handles automatically, but manual history manipulation must preserve entire response metadata including `thoughtSignature` field.

8. **Tools + Output Schema Conflict** (HIGH) — ADK does not support agents with both `tools` and `output_schema`. Split into two-agent pipeline: tool-using agent → schema-constrained agent.

9. **Context Window Exhaustion** (MEDIUM) — Long investigations can exhaust context. Implement context compaction with `EventsCompactionConfig` for sessions exceeding 5 invocations.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation Infrastructure
**Rationale:** All other components depend on database, storage, API skeleton, and auth. SSE streaming and async patterns must be correct from the start to avoid rewrite.
**Delivers:** PostgreSQL schema, Cloud Storage, FastAPI skeleton with SSE, Next.js skeleton with auth
**Addresses:** Security/Auth (table stakes), Audit Trail foundation
**Avoids:** JSONB performance cliffs (hybrid schema), SSE production failures (proper config)

### Phase 2: File Ingestion & Search
**Rationale:** Evidence ingestion is prerequisite for all AI features. Search is table stakes.
**Delivers:** File upload to GCS, Gemini-powered metadata extraction, full-text search indexing
**Simplification:** No separate OCR/text extraction pipelines — Gemini processes files natively
**Addresses:** File Storage, Full-Text Search (table stakes)
**Uses:** Cloud Storage, PostgreSQL with hybrid schema
**Avoids:** Cloud Run timeouts (async processing architecture)

### Phase 3: Core Agent System
**Rationale:** ADK integration is the riskiest technical component. Start with Triage Agent (simplest) to validate setup, then add domain agents.
**Delivers:** ADK Runner, Triage Agent, single Domain Agent (Financial), Orchestrator
**Implements:** Hierarchical orchestration, Sequential pipeline
**Avoids:** ADK production limitations (fresh instances, state namespacing), multi-agent failures (clear boundaries)

### Phase 4: Parallel Domain Analysis
**Rationale:** Once single agent works, add remaining domain agents with parallel execution.
**Delivers:** Legal Agent, Strategy Agent, Evidence Agent, ParallelAgent wrapper, full pipeline
**Addresses:** Domain-Specialized Agents (differentiator)
**Avoids:** Race conditions (unique output_keys)

### Phase 5: Intelligence Layer
**Rationale:** Synthesis and Knowledge Graph depend on domain agent outputs.
**Delivers:** Synthesis Agent (cross-referencing), KG Agent (entity resolution), basic knowledge graph
**Addresses:** Knowledge Graph, Entity Extraction (differentiators)
**Avoids:** Entity resolution scaling issues (incremental ER with blocking)

### Phase 6: Verification and Citations
**Rationale:** Hallucination mitigation is critical for legal domain. Must be built before user-facing features.
**Delivers:** Verification Agent, span-level citation system, source linking
**Addresses:** Source Citations (table stakes), AI Transparency (differentiator)
**Avoids:** LLM hallucination (multi-agent verification), citation failures (span-level extraction)

### Phase 7: Chat and Query Interface
**Rationale:** Chat depends on populated knowledge graph and verification infrastructure.
**Delivers:** Chat Agent with knowledge-first pattern, escalation to Orchestrator, citations in responses
**Addresses:** Natural Language Querying (differentiator), Document Summarization
**Avoids:** Re-analysis costs (knowledge-first pattern)

### Phase 8: Visualization and UI
**Rationale:** Agent Flow and Knowledge Graph view are Legal Lens differentiators. Depend on working agent system.
**Delivers:** React Flow agent trace, D3.js knowledge graph view, source panel, chat panel
**Addresses:** AI Transparency / Agent Flow (core differentiator)
**Avoids:** React Flow performance issues (memoization, virtualization from start)

### Phase Ordering Rationale

- **Dependencies flow downward:** Database -> Document Processing -> Agents -> Intelligence -> Verification -> Chat -> UI
- **Risk mitigation first:** ADK integration (Phase 3) comes before feature expansion to validate approach
- **Verification before features:** Citation system (Phase 6) before Chat (Phase 7) ensures all outputs are grounded
- **Table stakes before differentiators:** Search and processing before AI features
- **Performance patterns from start:** Hybrid schema, SSE config, React Flow memoization built in initially, not retrofitted

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Core Agent System):** ADK integration patterns are new, may need exploration of specific tool implementations
- **Phase 5 (Intelligence Layer):** Entity resolution algorithms, knowledge graph schema design
- **Phase 6 (Verification):** Span-level citation extraction algorithms, confidence scoring approaches

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Well-documented FastAPI/Next.js patterns
- **Phase 2 (Document Processing):** Standard text extraction, search patterns
- **Phase 8 (Visualization):** React Flow and D3.js have excellent documentation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified with official 2025/2026 documentation |
| Features | HIGH | Cross-referenced multiple legal AI platforms and industry reports |
| Architecture | HIGH | Based on official ADK docs and proven multi-agent patterns |
| Pitfalls | HIGH | Academic research, production case studies, official limitations docs |

**Overall confidence:** HIGH

### Gaps to Address

- **Better Auth integration with FastAPI:** Documentation is frontend-focused; need to verify JWT verification pattern in FastAPI during Phase 1
- **ADK DatabaseSessionService performance:** Limited production benchmarks; monitor during Phase 3
- **Gemini 3 rate limits for multi-agent:** May need tier upgrade earlier than expected; budget for Tier 1 ($250 threshold)
- **Video/audio processing limits:** May need Cloud Run Jobs for long files; validate chunk size during Phase 2
- **Context cache invalidation:** Need strategy for invalidating caches when new evidence added to case
- **Memory service migration:** VertexAiMemoryBankService requires Agent Engine; plan post-hackathon migration path
- **Frontend confirmation UX:** Design confirmation dialog patterns for sensitive operations (ADK limitation workaround)
- **Callback performance:** Monitor async queue performance for real-time visualization at scale
- **Earth Engine API approval:** Submit approval request immediately in Phase 1; may take days/weeks
- **Map display library:** Mapbox tentative; evaluate alternatives during implementation
- **Graph library evaluation:** vis-network vs D3.js decision during Phase 7 implementation

## Sources

### Primary (HIGH confidence)
- [Next.js 16 Release](https://nextjs.org/blog/next-16)
- [Google ADK Documentation](https://google.github.io/adk-docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.0 Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [React Flow 12](https://xyflow.com/blog/react-flow-12-release)
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Cloud Run Documentation](https://cloud.google.com/run/docs/)

### Secondary (MEDIUM confidence)
- [Stanford Legal RAG Hallucinations Study](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf)
- [Multi-Agent Failure Research](https://arxiv.org/abs/2503.13657)
- [ADK Production Challenges](https://dlabs.ai/blog/google-adk-production-challenges-and-how-to-solve-them/)
- [PostgreSQL JSONB Performance](https://pganalyze.com/blog/5mins-postgres-jsonb-toast)

### Tertiary (LOW confidence)
- SSE production issues from industry blog posts (validate with own testing)
- React Flow performance optimizations from community guides (validate at scale)

---
*Research completed: 2026-01-18*
*Updated: 2026-01-20*
*ADK optimization pass: 2026-01-20*
*Integration features added: 2026-01-21*
*Ready for roadmap: yes*
