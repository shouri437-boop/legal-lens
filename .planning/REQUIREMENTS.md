# Legal Lens Requirements Specification

**Version:** 1.0
**Date:** 2026-01-18
**Status:** DRAFT - Awaiting approval

## Requirements Overview

This document defines formal requirements for Legal Lens v1. Requirements are derived from PROJECT.md, stakeholder scoping sessions, and research findings.

---

## REQ-INF: Infrastructure & Deployment

### REQ-INF-001: CI/CD Pipeline
**Priority:** CRITICAL
**Description:** Automated deployment pipeline that deploys every push to main branch.
**Acceptance Criteria:**
- GitHub Actions workflow triggers on push to main
- Builds and deploys backend to Cloud Run
- Builds and deploys frontend to Cloud Run (or Vercel)
- Deployment completes within 10 minutes
- Failed deployments do not affect production
**Dependencies:** None (first phase)

### REQ-INF-002: PostgreSQL Database
**Priority:** CRITICAL
**Description:** Cloud SQL PostgreSQL instance for all persistent data.
**Acceptance Criteria:**
- PostgreSQL 17 on Cloud SQL
- Hybrid schema: relational tables + JSONB for flexible data
- Async SQLAlchemy 2.0 for backend access
- Connection pooling configured
- Database migrations via Alembic
**Dependencies:** REQ-INF-001

### REQ-INF-003: Cloud Storage
**Priority:** CRITICAL
**Description:** GCS bucket for evidence file storage.
**Acceptance Criteria:**
- Dedicated bucket per environment (dev, prod)
- Files organized by case_id
- Signed URLs for secure access
- Maximum file size: 500MB
- Supported types: PDF, DOCX, MP4, MP3, JPG, PNG, WAV
- **Tiered agent delivery:**
  - ≤100MB files: Downloaded from GCS, encoded as inline_data for Gemini
  - >100MB files: Downloaded from GCS, uploaded to Gemini File API (2GB max, 48hr retention, free)
  - File API URIs reusable across all pipeline stages
**Dependencies:** REQ-INF-001

### REQ-INF-004: SSE Streaming Infrastructure
**Priority:** HIGH
**Description:** Server-Sent Events for real-time agent progress updates.
**Acceptance Criteria:**
- FastAPI SSE endpoints via sse-starlette
- Proper headers for Cloud Run (X-Accel-Buffering: no)
- Heartbeat every 15 seconds to prevent timeout
- Polling fallback for SSE failures
- Frontend EventSource with auto-reconnect
**Dependencies:** REQ-INF-002

---

## REQ-AUTH: Authentication & Authorization

### REQ-AUTH-001: Email/Password Registration
**Priority:** HIGH
**Description:** Users can create accounts with email and password.
**Acceptance Criteria:**
- Email validation
- Password strength requirements (8+ chars, mixed case, number)
- Email verification flow
- Secure password hashing (bcrypt)
**Dependencies:** REQ-INF-002

### REQ-AUTH-002: Google OAuth
**Priority:** HIGH
**Description:** Users can sign in with Google accounts.
**Acceptance Criteria:**
- Google OAuth 2.0 integration
- Automatic account linking if email exists
- Profile picture imported
**Dependencies:** REQ-AUTH-001

### REQ-AUTH-003: Session Management
**Priority:** HIGH
**Description:** Persistent sessions across browser refresh.
**Acceptance Criteria:**
- JWT-based sessions
- Session persists in localStorage/cookies
- Automatic refresh before expiry
- Backend validates session on every request
**Dependencies:** REQ-AUTH-001

### REQ-AUTH-004: Case Access Control
**Priority:** HIGH
**Description:** Users see only their own cases.
**Acceptance Criteria:**
- Cases linked to user_id
- All case queries filtered by authenticated user
- No cross-user data leakage
**Dependencies:** REQ-AUTH-001, REQ-CASE-001

---

## REQ-CASE: Case Management

### REQ-CASE-001: Case Creation
**Priority:** HIGH
**Description:** Users can create new investigation cases.
**Acceptance Criteria:**
- Case name (required, 3-100 chars)
- Case description/context (optional, up to 5000 chars)
- Case type selection (Fraud, Corporate, Civil, Criminal, Other)
- Case created with DRAFT status
- Unique case ID generated
**Dependencies:** REQ-AUTH-001, REQ-INF-002

### REQ-CASE-002: Case List View
**Priority:** HIGH
**Description:** Users can view all their cases with status indicators.
**Acceptance Criteria:**
- Paginated list (20 per page)
- Shows: name, type, status, file count, created date, last modified
- Status indicators: DRAFT, PROCESSING, READY, ERROR
- Sort by date, name, status
- Search by name
**Dependencies:** REQ-CASE-001

### REQ-CASE-003: Case Deletion
**Priority:** MEDIUM
**Description:** Users can delete cases with all associated data.
**Acceptance Criteria:**
- Confirmation dialog required
- Cascades to: files, analysis results, knowledge graph, chat history
- GCS files deleted
- Soft delete with 30-day recovery window
**Dependencies:** REQ-CASE-001

### REQ-CASE-004: Evidence Upload
**Priority:** CRITICAL
**Description:** Users can upload multiple evidence files to a case.
**Acceptance Criteria:**
- Drag-and-drop upload UI
- Multiple file selection
- Progress indicator per file
- Automatic file type detection
- Supported: PDF, DOCX, MP4, MP3, WAV, JPG, PNG
- Max 500MB per file
- Files stored in GCS with metadata in PostgreSQL
**Dependencies:** REQ-CASE-001, REQ-INF-003

### REQ-CASE-005: Case Library View
**Priority:** HIGH
**Description:** Users can view and manage files within a case.
**Acceptance Criteria:**
- Grid or list view toggle
- File thumbnails for images/PDFs
- File metadata: name, type, size, upload date, processing status
- Filter by type, status
- Select files for batch operations
- Delete individual files
**Dependencies:** REQ-CASE-004

---

## REQ-AGENT: Agentic Processing Pipeline

### REQ-AGENT-001: Triage Agent
**Priority:** CRITICAL
**Description:** Initial agent that classifies files by domain relevance.
**Acceptance Criteria:**
- Receives files via tiered handling: inline (≤100MB) or File API (>100MB, up to 2GB)
- Uses Gemini 3 Flash for speed
- Runs in a **fresh stage-isolated ADK session** (no shared context with other stages)
- Outputs domain scores: Financial (0-100), Legal (0-100), Strategy (0-100), Evidence (0-100)
- Outputs complexity tier (Low/Medium/High)
- Outputs file summary: short (1-2 sentences) and detailed (paragraph)
- Outputs detected entities (people, orgs, dates, locations, amounts, legal terms)
- `media_resolution: "medium"` for speed (classification, not forensic)
- Stores TriageOutput in `agent_executions` table for downstream stages
- Handles multimodal evidence: PDF, video (MP4), audio (MP3/WAV), images (JPG/PNG)
**Dependencies:** REQ-INF-003, REQ-AGENT-007

### REQ-AGENT-002: Orchestrator Agent
**Priority:** CRITICAL
**Description:** Intelligent coordinator that routes files to domain agents.
**Acceptance Criteria:**
- LlmAgent with Gemini 3 Pro
- Receives triage results
- Routes to 1+ domain agents based on scores (threshold: 0.4)
- Manages parallel execution of domain agents
- Aggregates domain outputs for Synthesis Agent
- Handles agent failures gracefully
**Dependencies:** REQ-AGENT-001

### REQ-AGENT-003: Financial Analysis Agent
**Priority:** HIGH
**Description:** Domain agent specialized in financial document analysis.
**Acceptance Criteria:**
- Processes financial records, invoices, statements, receipts
- Extracts: transactions, amounts, dates, parties, account numbers
- Identifies: anomalies, patterns, discrepancies
- Links to other evidence (temporal, entity-based)
- Outputs structured findings with span-level citations
- Gemini 3 Pro for deep analysis
- Rich markdown `findings_text` output: detailed analysis paragraphs per finding with inline source references
- Exhaustive span-level citations: EVERY factual statement must reference exact file_id + page/timestamp + verbatim excerpt
- Dual output: structured entities (for KG tables) + rich text findings (for display, vector search, and synthesis input)
**Dependencies:** REQ-AGENT-002

### REQ-AGENT-004: Legal Analysis Agent
**Priority:** HIGH
**Description:** Domain agent specialized in legal document analysis.
**Acceptance Criteria:**
- Processes contracts, legal filings, correspondence, regulations
- Extracts: parties, obligations, dates, clauses, citations
- Identifies: risks, violations, precedents
- Links to statutes/regulations mentioned
- Outputs structured findings with span-level citations
- Gemini 3 Pro for nuanced legal interpretation
- Rich markdown `findings_text` output: detailed analysis paragraphs per finding with inline source references
- Exhaustive span-level citations: EVERY factual statement must reference exact file_id + page/timestamp + verbatim excerpt
- Dual output: structured entities (for KG tables) + rich text findings (for display, vector search, and synthesis input)
**Dependencies:** REQ-AGENT-002

### REQ-AGENT-005: Strategy Analysis Agent
**Priority:** HIGH
**Description:** Domain agent specialized in strategic implications.
**Acceptance Criteria:**
- Synthesizes across financial and legal findings
- Identifies: case strengths, weaknesses, risks, opportunities
- Suggests investigation directions
- Prioritizes evidence by strategic value
- Outputs strategic recommendations with citations
- Gemini 3 Pro for complex reasoning
- Rich markdown `findings_text` output: detailed analysis paragraphs per finding with inline source references
- Exhaustive span-level citations: EVERY factual statement must reference exact file_id + page/timestamp + verbatim excerpt
- Dual output: structured entities (for KG tables) + rich text findings (for display, vector search, and synthesis input)
**Dependencies:** REQ-AGENT-002

### REQ-AGENT-006: Evidence Analysis Agent
**Priority:** HIGH
**Description:** Domain agent specialized in critical evidence evaluation, authenticity verification, and forensic analysis.
**Acceptance Criteria:**

**Core Capabilities:**
- Processes ALL evidence types natively via Gemini 3 multimodal:
  - Documents: PDFs, scanned images, contracts, correspondence
  - Images: Photos, screenshots, diagrams, scanned receipts
  - Video: Surveillance footage, depositions, recordings
  - Audio: Phone calls, meetings, voicemails

**Authenticity Analysis:**
- Evaluates visual authenticity indicators:
  - Image manipulation detection (splicing, cloning, retouching)
  - Document alteration signs (font inconsistencies, alignment issues)
  - Video editing artifacts (jump cuts, frame manipulation)
- Metadata consistency checking:
  - Creation/modification timestamps vs claimed dates
  - Device/software fingerprints
  - GPS/location data validation
  - Author/creator information

**Chain of Custody:**
- Documents evidence provenance trail
- Identifies gaps in custody documentation
- Flags evidence with unclear origin
- Assesses handling and storage conditions

**Corroboration Analysis:**
- Cross-references evidence against other case materials
- Identifies supporting evidence for key claims
- Detects evidence that contradicts other sources
- Calculates corroboration scores per claim

**Quality Assessment Output:**
```json
{
  "authenticity_score": 0.0-1.0,
  "authenticity_concerns": ["list of specific concerns"],
  "custody_chain_complete": true/false,
  "custody_gaps": ["list of gaps"],
  "corroboration_status": "strong|moderate|weak|uncorroborated",
  "corroborating_evidence": ["file_id#location references"],
  "contradicting_evidence": ["file_id#location references"],
  "recommendation": "ADMIT|VERIFY|CHALLENGE|EXCLUDE",
  "confidence": 0.0-1.0
}
```

**Technical Configuration:**
- Model: Gemini 3 Pro with `thinking_level="high"`
- Media resolution: `"high"` for document forensics
- `include_thoughts=True` for audit trail
- Outputs structured findings with span-level citations
- Rich markdown `findings_text` output: detailed analysis paragraphs per finding with inline source references
- Exhaustive span-level citations: EVERY factual statement must reference exact file_id + page/timestamp + verbatim excerpt
- Dual output: structured entities (for KG tables) + rich text findings (for display, vector search, and synthesis input)

**Dependencies:** REQ-AGENT-002, REQ-AGENT-007c

### REQ-AGENT-007: ADK Runner Infrastructure
**Priority:** CRITICAL
**Description:** Google ADK integration for agent orchestration.
**Acceptance Criteria:**
- ADK >=1.22.0 integrated with FastAPI
- DatabaseSessionService with PostgreSQL (asyncpg)
- **Stage-isolated sessions**: Each pipeline stage (Triage, Orchestrator, Domain, Synthesis) gets a FRESH ADK session to prevent multimodal file content from bloating downstream contexts
- Session ID: SHA-256 hash of `case_id:workflow_id:stage` (deterministic, idempotent)
- Inter-stage data flows via database (`agent_executions` table), not session state
- Intra-stage data uses ADK `output_key` and `{key}` template injection
- Fresh agent instances per stage (ADK constraint: single parent rule)
- State namespacing per user/case with scope prefixes:
  - No prefix: Current session (case-specific data)
  - `user:` prefix: All user sessions (investigator preferences)
  - `app:` prefix: Global application (system configuration)
  - `temp:` prefix: Current invocation only (intermediate processing)
- **Tiered file handling**: inline (≤100MB) or File API (>100MB, up to 2GB)
- File API references reusable across pipeline stages (48hr retention)
- Tool registration and execution
- Error handling and retry logic
- GcsArtifactService for evidence and report storage with versioning
- Thought signature handling for multi-turn function calling (SDK handles automatically)
- Pipeline orchestration via Python code (NOT a single ADK SequentialAgent across stages)
- ParallelAgent used WITHIN Stage 3 for concurrent domain agents
**Dependencies:** REQ-INF-002

### REQ-AGENT-007a: ADK Limitations Documentation
**Priority:** HIGH
**Description:** Document and design around known ADK limitations.
**Acceptance Criteria:**
- Tool confirmation (`require_confirmation`) only works with InMemorySessionService, NOT DatabaseSessionService
  - **Mitigation:** Implement confirmation dialogs in frontend instead
- Cannot use `tools` and `output_schema` together on same agent
  - **Mitigation:** Split into tool-using agent → schema-constrained agent pipeline
- Single parent rule: An agent can only be a sub-agent of one parent
  - **Mitigation:** Agent factory pattern creates fresh instances per workflow
- State updates only commit after Event is yielded and processed
  - **Mitigation:** Ensure tool results returned before yielding next event
- Temperature must stay at 1.0 for Gemini 3 (lower values cause looping)
  - **Mitigation:** Do not override temperature setting
- LoopAgent requires explicit `EventActions(escalate=True)` to exit early
  - **Mitigation:** Add explicit QualityThresholdChecker BaseAgent in loops
**Dependencies:** REQ-AGENT-007

### REQ-AGENT-007b: Thinking Mode Configuration
**Priority:** HIGH
**Description:** Configure thinking levels using `BuiltInPlanner` with `ThinkingConfig` (ADK best practice).
**Acceptance Criteria:**
- All agents use `BuiltInPlanner(thinking_config=ThinkingConfig(thinking_level=..., include_thoughts=True))`
- **NOT** using `generate_content_config` directly (use `BuiltInPlanner` instead)
- **NOT** using `thinking_budget` (that's for Gemini 2.5, not Gemini 3)
- Thinking level assignments — **ALL agents use HIGH per user preference**:
  - **Triage Agent:** `thinking_level="high"` (user requested HIGH for all)
  - **Orchestrator Agent:** `thinking_level="high"` (complex routing decisions)
  - **Financial Agent:** `thinking_level="high"`
  - **Legal Agent:** `thinking_level="high"`
  - **Strategy Agent:** `thinking_level="high"`
  - **Evidence Agent:** `thinking_level="high"` (forensic-level authenticity analysis)
  - **Synthesis Agent:** `thinking_level="high"` (complex cross-referencing)
  - **KG Agent:** `thinking_level="high"`
  - **Chat Agent:** `thinking_level="high"`
  - **Verification Agent:** `thinking_level="high"` (critical accuracy)
- All agents set `include_thoughts=True` for Agent Flow transparency
- Thinking traces captured and stored for display in visualization
- Factory helper: `create_thinking_planner(level="high") -> BuiltInPlanner`
**Dependencies:** REQ-AGENT-007

### REQ-AGENT-007c: Media Resolution Configuration
**Priority:** HIGH
**Description:** Configure media resolution per agent type for optimal quality/cost balance.
**Acceptance Criteria:**
- Gemini 3 `media_resolution` parameter controls tokens per image/video frame:
  - `low`: 280 tokens/image, 70 tokens/video frame (fast, cheap)
  - `medium`: 560 tokens/image, 70 tokens/video frame (balanced)
  - `high`: 1,120 tokens/image, 280 tokens/video frame (detailed, expensive)
- Per-agent configuration:
  - **Triage Agent:** `media_resolution="medium"` (classification speed)
  - **Financial Agent:** `media_resolution="high"` (dense tables, fine figures)
  - **Legal Agent:** `media_resolution="high"` (fine print, signatures)
  - **Strategy Agent:** `media_resolution="medium"` (general content)
  - **Evidence Agent:** `media_resolution="high"` (forensic detail, OCR, manipulation detection)
  - **Research/Discovery:** `media_resolution="low"` (web content, not evidence)
- Enables accurate extraction of: small text, signatures, dense tables, watermarks, annotations
- Config applied via `generation_config={"media_resolution": "high"}` or equivalent
- Multimodal token rates: Video 263 tok/sec, Audio 32 tok/sec, PDF ~258 tok/page (image)
- Gemini 3 native PDF text extraction is FREE (only image tokens charged)
**Dependencies:** REQ-AGENT-007

### REQ-AGENT-007d: Video/Audio Processing with Metadata
**Priority:** HIGH
**Description:** Support precise segment analysis for video and audio evidence.
**Acceptance Criteria:**
- Video evidence processed with `VideoMetadata` for timestamp offsets
- Support for analyzing specific segments: `start_offset`, `end_offset`
- Audio evidence includes speaker diarization requests
- Key moments extracted with precise timestamps (MM:SS or HH:MM:SS)
- Transcripts aligned with timestamps for citation linking
- Example usage:
  ```python
  types.Part(
      file_data=types.FileData(file_uri=video_file.uri),
      video_metadata=VideoMetadata(
          start_offset="00:15:00",
          end_offset="00:45:00"
      )
  )
  ```
**Dependencies:** REQ-AGENT-007, REQ-INF-003

### REQ-AGENT-007e: ADK Artifact Service
**Priority:** HIGH
**Description:** Use ADK's GcsArtifactService for evidence and report storage with versioning.
**Acceptance Criteria:**
- Configure `GcsArtifactService` with dedicated bucket
- Runner initialized with artifact_service parameter
- Tools use `tool_context.save_artifact()` for storing:
  - Generated reports (PDF, DOCX)
  - Structured findings (JSON)
  - Extracted evidence snapshots
- Tools use `tool_context.load_artifact()` for retrieval
- Versioning enabled for correction/regeneration audit trail
- Artifact references stored in state for downstream access
**Dependencies:** REQ-INF-003, REQ-AGENT-007

### REQ-AGENT-007f: Context Caching for Evidence
**Priority:** MEDIUM
**Description:** Implement context caching for cost-effective repeated queries against same evidence.
**Acceptance Criteria:**
- Create context cache when user opens a case for chat
- Cache includes all case evidence files
- TTL set to session duration (default 2 hours)
- Chat queries use `cached_content` parameter
- Cost reduction: 4x cheaper for cached queries
- Cache invalidated when new evidence added
- Implementation pattern:
  ```python
  cache = client.caches.create(
      model="gemini-3-pro-preview",
      contents=[*case_evidence_files],
      ttl="7200s"
  )
  ```
**Dependencies:** REQ-AGENT-007, REQ-CHAT-001

### REQ-AGENT-007g: Context Compaction for Chat Sessions Only
**Priority:** MEDIUM
**Description:** Implement context compaction for the Chat Agent's iterative conversation sessions.
**Acceptance Criteria:**
- **NOT used for the analysis pipeline** — pipeline uses stage-isolated sessions (no history to compact)
- **Only for Chat Agent** (REQ-CHAT) which has iterative multi-turn conversations
- Configure `EventsCompactionConfig` for Chat Agent sessions
- Compaction interval: every 5 invocations
- Overlap size: 2 events preserved in summary
- Use `LlmEventSummarizer` with Gemini Flash for cost efficiency
- Implementation:
  ```python
  # ONLY for Chat Agent's App configuration
  events_compaction_config=EventsCompactionConfig(
      compaction_interval=5,
      overlap_size=2,
      summarizer=LlmEventSummarizer(llm=Gemini(model="gemini-3-flash-preview"))
  )
  ```
- **Why not for pipeline?** Each pipeline stage (Triage→Orchestrator→Domain→Synthesis) runs in a fresh session. There's no conversation history to compact. Stage isolation is the primary context management strategy.
**Dependencies:** REQ-AGENT-007, REQ-CHAT-005

### REQ-AGENT-007h: Resilient Agent Wrapper
**Priority:** HIGH
**Description:** Implement graceful degradation with fallback agents.
**Acceptance Criteria:**
- Custom `ResilientAgentWrapper` BaseAgent for each domain agent
- Primary agent: Gemini 3 Pro for full analysis
- Fallback agent: Gemini 3 Flash for degraded but functional analysis
- Error logging to state for debugging
- Graceful error message when both fail
- Pattern:
  ```python
  class ResilientAgentWrapper(BaseAgent):
      def __init__(self, primary_agent, fallback_agent=None):
          self.primary_agent = primary_agent
          self.fallback_agent = fallback_agent
  ```
**Dependencies:** REQ-AGENT-007, REQ-ERR-005

### REQ-AGENT-007i: Deep Research Agent Integration
**Priority:** LOW
**Description:** Integrate Gemini Deep Research agent for autonomous case background research.
**Acceptance Criteria:**
- Use `client.interactions.create()` with `deep-research-pro-preview` agent
- Run as background task (`background=True`)
- Stream progress via thinking summaries
- Research outputs: corporate filings, news articles, legal records
- Results integrated into case context for domain agents
- User can trigger: "Research background on [subject]"
- Implementation:
  ```python
  interaction = client.interactions.create(
      input="Research publicly available information about [subject]",
      agent='deep-research-pro-preview-12-2025',
      background=True,
      stream=True,
      agent_config={"type": "deep-research", "thinking_summaries": "auto"}
  )
  ```
**Dependencies:** REQ-AGENT-007, REQ-CHAT-003

### REQ-AGENT-008: Synthesis Agent
**Priority:** HIGH
**Description:** Agent that cross-references all domain findings to produce hypotheses, contradictions, gaps, timeline events, cross-domain conclusions, and case-level summary/verdict.
**Acceptance Criteria:**
- **Two-source DB input assembly:**
  - Source 1: ALL `case_findings` rows for the case workflow — rich markdown `finding_text` with inline citations, `citations` JSONB (file_id + locator + exact_excerpt), `agent_type` (financial/legal/evidence/strategy), `category`, `confidence`. These are the persisted outputs from all domain agents + strategy agent (pipeline Stage 6).
  - Source 2: Curated knowledge graph from `kg_entities` (name, entity_type, description_brief, description_detailed, aliases, domains, source_finding_ids) + `kg_relationships` (label, relationship_type, evidence_excerpt, temporal_context, source_finding_ids, confidence). These are the outputs from the LLM KG Builder Agent (pipeline Stage 7).
  - Additional context: case metadata (name, description, case_type) + file metadata (filenames, types) from `cases` and `case_files` tables.
- Gemini 3 Pro with `thinking_level="high"` and 1M context window
- Runs in fresh stage-isolated ADK session (consistent with pipeline pattern)
- Pipeline position: Stage 8, after LLM KG Builder (Stage 7) + Entity Backfill (Stage 7b) complete
- Produces structured SynthesisOutput:
  - `hypotheses`: Case hypotheses with initial confidence + supporting/contradicting evidence references
  - `contradictions`: Detected contradictions with exact source pairs from both sides, severity classification (minor/significant/critical)
  - `gaps`: Missing evidence with priority ranking, description of what's needed and why
  - `cross_modal_links`: Temporal correlations across modalities (video timestamp ↔ document date, audio mention ↔ text entity)
  - `cross_domain_conclusions`: Insights from combining financial + legal + evidence + strategy findings
  - `timeline_events`: Chronological events extracted from findings with date/time, type, layer assignment
  - `case_summary`: Executive summary of the entire case
  - `case_verdict`: Overall assessment with confidence, key strengths, key weaknesses
  - `risk_assessment`: Risk factors and mitigation suggestions
  - `has_location_data`: Boolean trigger flag for Geospatial Agent
- Timeline events are a byproduct of chronological cross-referencing (no separate timeline agent)
- Investigation tasks generated from contradictions (resolve_contradiction), gaps (obtain_evidence), pending hypotheses (verify_hypothesis)
- All outputs stored in dedicated synthesis tables with SSE events signaling data readiness
- Every statement in synthesis output must reference source case_finding IDs and/or kg_entity IDs
- Uses `include_thoughts=True` for transparency
**Dependencies:** REQ-STORE-001, REQ-AGENT-003, REQ-AGENT-004, REQ-AGENT-005, REQ-AGENT-006

### REQ-AGENT-009: Knowledge Graph Builder Agent (LLM-Based)
**Priority:** HIGH
**Description:** LLM-based agent (Gemini Pro) that reads ALL domain agent findings and entities holistically, then produces a curated knowledge graph with deduplicated high-level entities and semantic relationships. Replaces the previous programmatic co-occurrence approach.
**Acceptance Criteria:**
- Receives ALL case_findings (rich markdown with citations) + all raw DomainEntity lists from agent_executions.output_data + case description
- Gemini 3 Pro with `thinking_level="high"` and 1M context window
- Runs in fresh stage-isolated ADK session after ALL domain agents complete
- Produces curated entity list with investigation-focused taxonomy:
  - **PERSON** — Named individuals (suspects, witnesses, victims, officers)
  - **ORGANIZATION** — Companies, agencies, groups, shell entities
  - **LOCATION** — Physical places, addresses, jurisdictions
  - **EVENT** — Specific occurrences with dates (transactions, meetings, communications)
  - **ASSET** — Properties, vehicles, investments, digital wallets
  - **FINANCIAL_ENTITY** — Bank accounts, transactions, instruments
  - **COMMUNICATION** — Phone calls, emails, messages, documents exchanged
  - **DOCUMENT** — Key evidence items referenced across findings
- Timestamps, monetary amounts, physical objects → metadata on entities/relationships, NOT standalone graph nodes
- Produces semantic relationships with typed labels (e.g., "employed_by", "transferred_funds_to", "owns") — NOT co-occurrence
- Entity deduplication handled naturally by LLM seeing all findings together (cross-agent alias resolution)
- Cross-domain relationship inference (financial finding ↔ legal finding connected when semantically related)
- Every entity includes aliases array (all known name variants from different agents)
- Every relationship includes evidence_excerpt (exact source text) and source_finding_ids for traceability
- Stores curated output in existing kg_entities and kg_relationships tables (clears old data for workflow, writes curated data)
- Degree computation (connection counts) for frontend node sizing
- Inline Pro-to-Flash fallback for resilience
- Raw entities from domain agents preserved in agent_executions.output_data for audit trail
**Dependencies:** REQ-STORE-001, REQ-AGENT-003, REQ-AGENT-004, REQ-AGENT-005, REQ-AGENT-006

### REQ-AGENT-010: Incremental Processing
**Priority:** MEDIUM
**Description:** Pipeline handles new files without full reprocessing.
**Acceptance Criteria:**
- New files processed through full pipeline
- Existing knowledge graph updated incrementally
- Synthesis Agent re-evaluates with new context
- Affected entities marked for review
- No reprocessing of unchanged files
**Dependencies:** REQ-AGENT-008, REQ-AGENT-009

---

## REQ-STORE: Knowledge Storage Infrastructure

### REQ-STORE-001: Structured Knowledge Tables
**Priority:** CRITICAL
**Description:** PostgreSQL tables for storing extracted knowledge from domain agents and synthesis.
**Acceptance Criteria:**
- `kg_entities` table: id, case_id, name, entity_type, domain, metadata (JSONB), source_execution_id, source_finding_index, merged_into_id, created_at
- `kg_relationships` table: id, case_id, source_entity_id, target_entity_id, type, label, strength, source_execution_id, metadata (JSONB), created_at
- `case_findings` table: id, case_id, workflow_id, agent_type, agent_execution_id, file_group_label, category, title, finding_text (markdown with inline citations), confidence, citations (JSONB array of {file_id, locator, exact_excerpt, context}), entity_ids (JSONB), created_at
- `case_hypotheses` table: id, case_id, workflow_id, claim, status (PENDING/SUPPORTED/REFUTED), confidence, supporting_evidence (JSONB), contradicting_evidence (JSONB), source_agent, reasoning, created_at
- `case_contradictions` table: id, case_id, workflow_id, claim_a, claim_b, source_a (JSONB with file_id + excerpt), source_b (JSONB with file_id + excerpt), severity (minor/significant/critical), domain, resolution_status, created_at
- `case_gaps` table: id, case_id, workflow_id, description, what_is_missing, why_needed, priority (low/medium/high/critical), related_entity_ids (JSONB), suggested_actions, created_at
- `case_synthesis` table: id, case_id, workflow_id, case_summary, case_verdict (JSONB), cross_modal_links (JSONB), cross_domain_conclusions (JSONB), key_findings_summary, risk_assessment, created_at
- `timeline_events` table: id, case_id, workflow_id, title, description, event_date, event_end_date, event_type, layer, source_entity_ids (JSONB), citations (JSONB), created_at
- `locations` table: id, case_id, workflow_id, name, coordinates (JSONB), location_type, source_entity_ids (JSONB), temporal_associations (JSONB), created_at
- All tables indexed on case_id; kg_entities also indexed on name, entity_type
- Foreign keys: entity→execution, relationship→entities, finding→execution
- Alembic migrations for all tables
**Dependencies:** REQ-INF-002

### REQ-STORE-002: Semantic Search Index
**Priority:** HIGH
**Description:** Full-text or vector search capability over case findings for Chat Agent queries.
**Acceptance Criteria:**
- V1: PostgreSQL full-text search via tsvector/tsquery on case_findings.finding_text
- V2 (optional upgrade): Vertex AI RAG Engine corpus for vector-based semantic search
- Search returns ranked results with relevance scores
- Supports natural language queries ("find evidence about money laundering")
- Results include finding_id, agent_type, category, relevance_score, excerpt
- Index updated automatically when findings are committed
**Dependencies:** REQ-STORE-001

### REQ-STORE-003: Citation Integrity
**Priority:** CRITICAL
**Description:** Every factual statement in findings and synthesis outputs must have exact source grounding.
**Acceptance Criteria:**
- All citations include: file_id, locator (page number OR timestamp OR region), exact_excerpt (verbatim source text), context (surrounding text for disambiguation)
- Domain agent prompts reinforced: "Every factual claim must reference the exact source excerpt from the analyzed files"
- Synthesis outputs reference back to case_finding IDs and kg_entity IDs
- Citation validation: all file_ids in citations must exist in case_files table
- No orphaned citations (citations without valid source references)
- UI displays citations as clickable links to exact source locations
**Dependencies:** REQ-STORE-001, REQ-CASE-004

---

## REQ-VIS: Visualization & UI

### REQ-VIS-001: Agent Flow
**Priority:** CRITICAL
**Description:** Real-time visualization of agent execution flow.
**Acceptance Criteria:**
- React Flow canvas showing agent nodes
- Animated edges during data flow
- Color-coded by agent type
- Click node to expand details panel
- Shows: model, input summary, tools called, output summary, duration, thinking traces
- Updates in real-time via SSE
- ADK callback-to-SSE mapping:
  - `before_agent_callback` → `AGENT_SPAWNED` event (node appears)
  - `after_agent_callback` → `AGENT_COMPLETED` event (node completes)
  - `before_tool_callback` → `TOOL_INVOKED` event (tool indicator)
  - `before_model_callback` → `THINKING_UPDATE` event (reasoning trace)
  - `after_model_callback` → `MODEL_RESPONSE` event (partial output)
**Dependencies:** REQ-INF-004, REQ-AGENT-002, REQ-AGENT-007b

### REQ-VIS-001a: Human-in-the-Loop Confirmation (Frontend)
**Priority:** HIGH
**Description:** Implement confirmation dialogs in frontend for sensitive operations.
**Acceptance Criteria:**
- **Note:** ADK's `require_confirmation` only works with InMemorySessionService, not DatabaseSessionService. Therefore, confirmation is implemented in frontend.
- Confirmation dialog UI component with:
  - Action description
  - Affected items preview
  - Confirm/Cancel buttons
  - Optional reason input
- Operations requiring confirmation:
  - Delete evidence file
  - Apply correction to knowledge graph
  - Regenerate stale items (batch)
  - Clear chat history
  - Delete case
- Confirmation state tracked in Zustand store
- API calls blocked until confirmation received
- Timeout with auto-cancel (2 minutes)
- Audit log entry for confirmed actions
**Dependencies:** REQ-VIS-001

### REQ-VIS-002: Agent Detail View
**Priority:** HIGH
**Description:** Detailed view of individual agent execution.
**Acceptance Criteria:**
- Full thinking trace (if available)
- Complete input context
- Tool calls with inputs/outputs
- Complete output findings
- Token usage statistics
- Execution timeline
**Dependencies:** REQ-VIS-001

### REQ-VIS-003: Knowledge Graph View
**Priority:** HIGH
**Description:** Premium knowledge graph visualization using D3.js force simulation with Epstein Doc Explorer-inspired layout, physics, filtering panels, entity timeline, and multi-media source viewer — adapted to Legal Lens's Liquid Glass design system. Filter/control and timeline panels are local to the KG canvas, not in the app-wide sidebar.
**Acceptance Criteria:**
- **D3.js** force simulation with 5 forces (link, charge, center, collision, radial) inside React `useRef`/`useEffect`
- Radial force: high-connection entities near center, low-connection pushed outward (connection-count-based gravity well)
- Sqrt-scaled node radius (connection count → 5-100px range via `d3.scalePow().exponent(0.5)`)
- Collision detection using actual circle radius + padding
- Link distance: constant base (50px) or relationship-type-based
- Charge repulsion: -400 (tunable)
- Domain-colored SVG circle nodes (person=orange, org=green, location=blue, event=amber — consistent with Legal Lens palette)
- Node labels below circles, entity type indicated by color
- Click node → highlight node + all connected edges (white), dim unconnected edges; open right sidebar timeline
- Drag individual nodes (fix position during drag, release on drop)
- Zoom/pan with `d3.zoom()` (scale extent [0.01, 10])
- **Left panel — Filters & Controls** (local to KG canvas, NOT in the app-wide sidebar):
  - Positioned on the left side of the knowledge graph canvas area
  - Selected entity display with Clear button
  - Graph stats: entity count, relationship count, domain breakdown
  - Entity search (debounced text input, highlights matching nodes)
  - Keyword filter (comma-separated fuzzy match against relationship labels/entity names)
  - Domain layer toggles (Financial, Legal, Evidence, Strategy) with select/deselect all
  - Density threshold slider (prune low-connection nodes by percentage of average)
- **Right panel — Entity Timeline** (local to KG canvas):
  - Appears when entity is selected
  - Chronological list of relationships involving selected entity
  - Each entry: year/date, relationship description (actor → action → target), source citation reference
  - Source citations list acts as navigation for the source viewer panel (click a citation → jump to that excerpt/timestamp)
  - Scrollable timeline with entity names highlighted in accent colors
  - Stays visible when source viewer is open (does not get hidden)
- **Source viewer panel** (replaces simple "document excerpt modal" — details to be refined during phase discussions):
  - Multi-media: renders content based on source type (document text, video player, audio player, image viewer)
  - For documents: full text excerpt with entity names highlighted (selected entity = yellow, related = orange)
  - For audio/video: playback with timestamp navigation from right panel citations
  - For images: viewer with annotation overlay capability
  - Opens alongside (not replacing) the right panel — right panel citations serve as a navigable index
  - Source metadata header (summary, category, date range)
  - Close button (X)
  - NOTE: This component is reusable beyond the KG view (Evidence Library, Timeline, etc.) — full specification during phase discussions
- Edge deduplication: multiple relationships between same entity pair → single edge with count
- Edge hover tooltip: relationship label, temporal context, source document
- Fullscreen capability with maximize button
- Basic analytics: node count, edge count, most connected entities
- Bottom instruction bar: "Click nodes to explore relationships · Scroll to zoom · Drag to pan"
- Responsive layout within KG canvas: left panel (320px) | center graph | right panel (384px, appears on select) — all local to the KG page content area, not the app-wide sidebar
- Intuitive at first glance: a user can understand entity relationships without instruction
- **Reference:** `DOCS/reference/epstein-network-ui/` for layout, physics, and interaction patterns
**Dependencies:** REQ-AGENT-009, REQ-STORE-001

### REQ-VIS-004: Timeline View
**Priority:** MEDIUM
**Description:** Chronological view of case events.
**Acceptance Criteria:**
- Horizontal timeline with zoom
- Events plotted by date/time
- Events linked to source evidence
- Filter by entity, event type
- Gaps highlighted visually
- Click event for details
**Dependencies:** REQ-AGENT-009

### REQ-VIS-005: Contradictions Panel
**Priority:** HIGH
**Description:** Panel showing detected inconsistencies.
**Acceptance Criteria:**
- List of contradiction pairs
- Each shows: claim A, claim B, sources, severity
- Click to navigate to sources
- Filter by severity, entity
- Resolution status tracking
**Dependencies:** REQ-AGENT-008

### REQ-VIS-006: Evidence Gaps Panel
**Priority:** HIGH
**Description:** Panel showing missing evidence.
**Acceptance Criteria:**
- List of identified gaps
- Each shows: what's missing, why needed, related entities
- Priority ranking
- Suggestions for finding evidence
- Resolution status tracking
**Dependencies:** REQ-AGENT-008

---

## REQ-SOURCE: Source Panel

### REQ-SOURCE-001: PDF Viewer
**Priority:** HIGH
**Description:** View PDFs with highlighted excerpts.
**Acceptance Criteria:**
- Full PDF rendering (pdf.js or react-pdf)
- Page navigation
- Zoom controls
- Text selection
- Highlighted excerpts (from citations)
- Jump to specific page/excerpt
**Dependencies:** REQ-CASE-004

### REQ-SOURCE-002: Video Player
**Priority:** HIGH
**Description:** Video playback with timestamp linking.
**Acceptance Criteria:**
- Standard video controls
- Timestamp markers for key moments
- Click marker to jump to timestamp
- Transcript overlay option
- Frame-level navigation
**Dependencies:** REQ-CASE-004

### REQ-SOURCE-003: Audio Player
**Priority:** HIGH
**Description:** Audio playback with waveform visualization.
**Acceptance Criteria:**
- Waveform display (wavesurfer.js)
- Standard playback controls
- Transcript sync (highlight current segment)
- Click waveform to seek
- Timestamp markers for key moments
**Dependencies:** REQ-CASE-004

### REQ-SOURCE-004: Image Viewer
**Priority:** MEDIUM
**Description:** Image viewing with annotation overlays.
**Acceptance Criteria:**
- Zoom and pan controls
- Bounding box overlays (from agent analysis)
- Click bounding box for entity details
- Side-by-side comparison mode
**Dependencies:** REQ-CASE-004

### REQ-SOURCE-005: Citation Navigation
**Priority:** CRITICAL
**Description:** Click any citation to view source at exact location.
**Acceptance Criteria:**
- All agent citations are clickable
- Opens Source Panel with correct viewer
- Navigates to exact location (page, timestamp, region)
- Highlights relevant excerpt
- Source panel remembers last position
**Dependencies:** REQ-SOURCE-001, REQ-SOURCE-002, REQ-SOURCE-003, REQ-SOURCE-004

---

## REQ-CHAT: Contextual Chat

### REQ-CHAT-001: Chat Interface
**Priority:** HIGH
**Description:** Chat UI for asking questions about the case.
**Acceptance Criteria:**
- Message input with send button
- Message history display
- Streaming response with typing indicator
- Markdown rendering in responses
- Code block formatting
- Mobile-responsive
**Dependencies:** REQ-VIS-001

### REQ-CHAT-002: Multi-Source Tool-Based Query
**Priority:** HIGH
**Description:** Chat Agent uses tiered tools to query multiple data stores, with fast path for simple questions and escalation for complex analysis.
**Acceptance Criteria:**
- **Fast path tools (SQL, <100ms):**
  - `query_knowledge_graph`: Entity/relationship lookups from KG tables
  - `get_case_hypotheses`: Hypothesis status and evidence from case_hypotheses
  - `get_contradictions`: Pre-computed contradictions from case_contradictions
  - `get_evidence_gaps`: Evidence gaps from case_gaps
  - `get_case_synthesis`: Case summary, verdict, conclusions from case_synthesis
  - `get_finding_details`: Specific finding by ID from case_findings
- **Semantic search tool (~500ms):**
  - `search_findings`: Full-text/vector search over case_findings
- **Deep analysis tool (10-60s, on-demand):**
  - `run_domain_analysis`: Spawns domain agent for novel questions requiring raw file examination
- Chat Agent's system prompt includes case_synthesis.case_summary for immediate context (~500-1000 tokens)
- Prompt includes explicit tool usage strategy: "Try fast lookups first, then search, then escalate"
- Simple questions answered from KG/synthesis in <2 seconds
- Indicates data source in response (e.g., "Based on the financial analysis...")
**Dependencies:** REQ-STORE-001, REQ-STORE-002, REQ-AGENT-008, REQ-CHAT-001

### REQ-CHAT-003: Agent Escalation
**Priority:** HIGH
**Description:** Chat Agent self-routes to domain agents for novel analysis when existing knowledge is insufficient.
**Acceptance Criteria:**
- Chat Agent decides when to escalate based on tool retrieval confidence (no separate router agent)
- Escalation triggered when: (1) fast lookup tools return insufficient results, AND (2) user asks for novel analysis or deeper investigation
- Uses `run_domain_analysis` tool to spawn targeted domain agent
- User sees "Analyzing with agents..." indicator during escalation
- Full agent trace available in Command Center during processing
- Results from escalation added to case findings and KG for future queries
- Chat Agent prompt includes escalation rules and decision criteria
**Dependencies:** REQ-AGENT-002, REQ-CHAT-002

### REQ-CHAT-004: Inline Citations
**Priority:** CRITICAL
**Description:** Responses include clickable citations to sources.
**Acceptance Criteria:**
- Every factual claim has citation
- Citations formatted as [1], [2], etc.
- Hover shows source preview
- Click opens Source Panel
- Citation list at response end
**Dependencies:** REQ-SOURCE-005, REQ-CHAT-001

### REQ-CHAT-005: Chat History
**Priority:** MEDIUM
**Description:** Chat history persists across sessions.
**Acceptance Criteria:**
- History stored in PostgreSQL
- Loads on case open
- Searchable history
- Export chat as document
**Dependencies:** REQ-CHAT-001, REQ-INF-002

---

## REQ-CORR: Correction & Regeneration

### REQ-CORR-001: Error Flagging
**Priority:** MEDIUM
**Description:** Users can flag errors in findings or graph.
**Acceptance Criteria:**
- Flag button on any finding/node
- Error description input
- Suggested correction (optional)
- Flags stored for review
**Dependencies:** REQ-VIS-003, REQ-VIS-005

### REQ-CORR-002: Verification Agent
**Priority:** MEDIUM
**Description:** Agent validates corrections against original sources.
**Acceptance Criteria:**
- Receives flagged item and correction
- Re-analyzes relevant sources
- Confirms or refutes correction
- Provides reasoning for decision
- Gemini 3 Pro for verification accuracy
**Dependencies:** REQ-CORR-001, REQ-AGENT-007

### REQ-CORR-003: Knowledge Graph Updates
**Priority:** MEDIUM
**Description:** Confirmed corrections update the graph.
**Acceptance Criteria:**
- Verified corrections applied to KG
- Affected nodes/edges updated
- Provenance updated with correction info
- Downstream items marked STALE
**Dependencies:** REQ-CORR-002, REQ-AGENT-009

### REQ-CORR-004: Stale Item Management
**Priority:** LOW
**Description:** Track and regenerate stale items.
**Acceptance Criteria:**
- Stale items visually indicated
- List of stale items in UI
- One-click regeneration
- Batch regeneration option
**Dependencies:** REQ-CORR-003

---

## REQ-RESEARCH: Research & Discovery System

### REQ-RESEARCH-001: Research Agent
**Priority:** HIGH
**Description:** Research Agent discovers where relevant evidence might exist using Gemini web search.
**Acceptance Criteria:**
- Analyzes query intent and determines research domain (corporate, litigation, criminal, regulatory)
- Executes web search via Gemini to discover potential sources
- Scores and classifies each source by relevance
- Outputs structured source map with access metadata
- Gemini 3 Pro with `thinking_level="medium"`
**Dependencies:** REQ-AGENT-007

### REQ-RESEARCH-002: Binary Access Classification
**Priority:** MEDIUM
**Description:** Sources classified with simplified binary access levels.
**Acceptance Criteria:**
- `ACCESSIBLE` — Can be retrieved and processed automatically
- `REQUIRES_ACTION` — User action needed (subscription, physical visit, FOIA, etc.)
- Access instructions provided for REQUIRES_ACTION sources
**Dependencies:** REQ-RESEARCH-001

### REQ-RESEARCH-003: Automatic Research Domain Detection
**Priority:** MEDIUM
**Description:** Research Agent automatically detects appropriate research domain from query.
**Acceptance Criteria:**
- Detects domain: corporate, litigation, criminal, regulatory
- Adjusts search strategy based on domain
- No manual domain selection required
**Dependencies:** REQ-RESEARCH-001

### REQ-RESEARCH-004: Deep Research Agent Integration
**Priority:** LOW
**Description:** Integration with Gemini Deep Research Agent for autonomous background research.
**Acceptance Criteria:**
- Uses `deep-research-pro-preview` agent for comprehensive research
- Runs as background task (`background=True`)
- Streams progress via thinking summaries
- Results integrated into case context for domain agents
**Dependencies:** REQ-AGENT-007i

### REQ-RESEARCH-005: Discovery Agent
**Priority:** HIGH
**Description:** Discovery Agent synthesizes external research into actionable intelligence.
**Acceptance Criteria:**
- Consumes Research Agent output (source map)
- Prioritizes sources by relevance and accessibility
- Processes ACCESSIBLE sources first
- Generates hypotheses from findings
- Links findings to supporting evidence
- Gemini 3 Pro with `thinking_level="medium"`
**Dependencies:** REQ-RESEARCH-001

### REQ-RESEARCH-006: Discovery-Synthesis Integration
**Priority:** HIGH
**Description:** Discovery Agent findings feed into Synthesis Agent pipeline.
**Acceptance Criteria:**
- Discovery output stored in session state with unique output_key
- Synthesis Agent consumes discovery findings alongside domain findings
- External research incorporated into knowledge graph
**Dependencies:** REQ-RESEARCH-005, REQ-AGENT-008

### REQ-RESEARCH-007: Source Retrieval Flow
**Priority:** MEDIUM
**Description:** Suggest-then-confirm flow for source retrieval.
**Acceptance Criteria:**
- Research Agent suggests sources with relevance scores
- User confirms which sources to retrieve
- Discovery Agent processes only confirmed sources
- User can add/remove sources before retrieval
**Dependencies:** REQ-RESEARCH-001, REQ-VIS-001a

### REQ-RESEARCH-008: Resilient Research Wrapper
**Priority:** HIGH
**Description:** Apply resilient wrapper pattern to Research and Discovery agents.
**Acceptance Criteria:**
- Primary: Gemini 3 Pro for full analysis
- Fallback: Gemini 3 Flash for degraded but functional analysis
- Error logging to state for debugging
- Graceful error message when both fail
**Dependencies:** REQ-AGENT-007h

### REQ-RESEARCH-009: Orchestrator-Triggered Research
**Priority:** HIGH
**Description:** Orchestrator can trigger Research Agent when evidence gaps detected.
**Acceptance Criteria:**
- Orchestrator detects research need when:
  - Triage shows low confidence (<0.5) for key domains
  - Synthesis reports critical evidence gaps
  - Hypothesis stuck at PENDING with no new evidence
- Orchestrator proposes research via SSE event (RESEARCH_SUGGESTED)
- User must confirm before Research Agent invoked (frontend dialog)
- Research results feed back into Discovery → Synthesis pipeline
- User can decline research suggestion
**Dependencies:** REQ-AGENT-002, REQ-RESEARCH-001, REQ-VIS-001a

---

## REQ-HYPO: Hypothesis System

### REQ-HYPO-001: Hypothesis Lifecycle
**Priority:** HIGH
**Description:** Hypotheses follow simplified 3-state lifecycle.
**Acceptance Criteria:**
- Status values: PENDING, SUPPORTED, REFUTED
- Lifecycle: PENDING → SUPPORTED/REFUTED → (optionally marked RESOLVED by user)
- SUPPORTED: Evidence weight favors hypothesis (confidence >0.6)
- REFUTED: Evidence weight contradicts hypothesis (confidence <0.4)
- PENDING: Insufficient evidence to determine (0.4-0.6 confidence)
- Status stored in `case_hypotheses` table
**Dependencies:** REQ-INF-002

### REQ-HYPO-002: Hypothesis Creation
**Priority:** HIGH
**Description:** Agents propose hypotheses, users can modify.
**Acceptance Criteria:**
- Domain agents suggest new hypotheses from findings
- Synthesis Agent generates hypotheses from cross-domain patterns
- Users can accept, reject, modify, or add hypotheses
- Initial hypotheses fully agent-driven (no pre-seeding)
**Dependencies:** REQ-AGENT-003, REQ-AGENT-004, REQ-AGENT-005, REQ-AGENT-006

### REQ-HYPO-003: Hypothesis Evaluation
**Priority:** HIGH
**Description:** Domain agents evaluate findings against all hypotheses.
**Acceptance Criteria:**
- Each finding evaluated against existing hypotheses
- Evidence type assigned: SUPPORTING or CONTRADICTING
- Weight assigned (0.0-1.0) based on evidence strength
- Reasoning provided for evaluation
- Stored in `hypothesis_evidence` table
**Dependencies:** REQ-HYPO-001, REQ-AGENT-003, REQ-AGENT-004, REQ-AGENT-005, REQ-AGENT-006

### REQ-HYPO-004: Confidence Calculation
**Priority:** MEDIUM
**Description:** Simple deterministic confidence with optional user override.
**Acceptance Criteria:**
- Calculation: sum(supporting_weights) / sum(all_weights)
- Result maps to status: >0.6 = SUPPORTED, <0.4 = REFUTED, else PENDING
- User can manually override status with reason
- Override stored in hypothesis record
**Dependencies:** REQ-HYPO-003, REQ-AGENT-008

### REQ-HYPO-005: Hypothesis Evidence Linking
**Priority:** HIGH
**Description:** Evidence linked to hypotheses with weights.
**Acceptance Criteria:**
- Each evidence link has: evidence_type, weight, excerpt, location, reasoning
- Supporting evidence displayed in green
- Contradicting evidence displayed in red
- Evidence links clickable to Source Panel
**Dependencies:** REQ-HYPO-001, REQ-SOURCE-005

### REQ-HYPO-006: SSE Hypothesis Updates
**Priority:** HIGH
**Description:** Real-time updates for hypothesis status changes.
**Acceptance Criteria:**
- SSE event types: HYPOTHESIS_CREATED, HYPOTHESIS_UPDATED, HYPOTHESIS_EVALUATED
- Events include: hypothesis_id, new_status, confidence, change_reason
- Frontend updates hypothesis cards in real-time
**Dependencies:** REQ-INF-004, REQ-HYPO-001

### REQ-HYPO-007: Hypothesis View
**Priority:** HIGH
**Description:** Dedicated Hypothesis View separate from Knowledge Graph.
**Acceptance Criteria:**
- Hypothesis cards in list view
- Shows: claim, status badge, confidence meter, evidence counts
- Click to expand detailed view
- Not integrated into Knowledge Graph visualization
**Dependencies:** REQ-HYPO-001

### REQ-HYPO-008: Hypothesis Fullscreen
**Priority:** MEDIUM
**Description:** Fullscreen capability for Hypothesis View.
**Acceptance Criteria:**
- Maximize button in corner
- Full-window hypothesis display
- All controls remain accessible
- ESC or button to exit
**Dependencies:** REQ-HYPO-007

### REQ-HYPO-009: Hypothesis-Gap Relationship
**Priority:** MEDIUM
**Description:** Hypothesis system complements (not replaces) contradiction/gap detection.
**Acceptance Criteria:**
- Contradictions remain as separate feature
- Evidence gaps remain as separate feature
- Hypothesis status can trigger gap/contradiction creation
- All three features linked but independent
**Dependencies:** REQ-HYPO-001, REQ-WOW-002, REQ-WOW-003

---

## REQ-GEO: Geospatial Intelligence

### REQ-GEO-001: Geospatial Agent
**Priority:** HIGH
**Description:** Dedicated Geospatial Agent for location intelligence.
**Acceptance Criteria:**
- Extracts and enriches location entities from case findings
- Disambiguates ambiguous place names
- Geocodes locations to coordinates
- Identifies movement patterns and spatial relationships
- Flags locations needing satellite imagery analysis
- Gemini 3 Pro with `thinking_level="medium"`
**Dependencies:** REQ-AGENT-007

### REQ-GEO-002: Geospatial Agent Invocation
**Priority:** HIGH
**Description:** Geospatial Agent operates as post-synthesis utility.
**Acceptance Criteria:**
- Autonomous invocation when location data exists in synthesis results
- On-demand invocation via Chat interface
- Triggered by Orchestrator after Synthesis completes
**Dependencies:** REQ-GEO-001, REQ-AGENT-002, REQ-AGENT-008

### REQ-GEO-003: Dual Location Extraction
**Priority:** MEDIUM
**Description:** Both Domain Agents and Geospatial Agent extract locations.
**Acceptance Criteria:**
- Domain Agents: baseline location extraction during analysis
- Geospatial Agent: deeper location analysis post-synthesis
- Locations merged and deduplicated
- Geospatial Agent enriches with coordinates and context
**Dependencies:** REQ-GEO-001

### REQ-GEO-004: Location Verification Coordination
**Priority:** MEDIUM
**Description:** Evidence Agent coordinates location verification.
**Acceptance Criteria:**
- Evidence Agent identifies location claims needing verification
- Evidence Agent invokes Geospatial Agent for verification
- Verification results feed back to Evidence Agent assessment
**Dependencies:** REQ-AGENT-006, REQ-GEO-001

### REQ-GEO-005: Google Earth Engine Integration
**Priority:** HIGH
**Description:** Integration with Google Earth Engine for satellite imagery.
**Acceptance Criteria:**
- GCP project with Earth Engine API enabled
- Historical imagery retrieval for verification
- Change detection between two dates
- Thumbnail generation with metadata
- Note: Approval process may take days/weeks
**Dependencies:** External API setup

### REQ-GEO-006: Map Display API
**Priority:** HIGH
**Description:** Map display using mapping library.
**Acceptance Criteria:**
- Interactive map component (Mapbox tentative, evaluate alternatives)
- Location markers styled by type
- Route visualization for movement patterns
- Heatmaps for activity concentration
- Click interactions for location details
**Dependencies:** REQ-GEO-001

### REQ-GEO-007: Movement Pattern Detection
**Priority:** HIGH
**Description:** Core capability to detect movement patterns.
**Acceptance Criteria:**
- Connects locations showing movement over time
- Temporal associations on each location
- Route visualization (dashed for inferred, solid for confirmed)
- Anomaly detection for unusual patterns
**Dependencies:** REQ-GEO-001, REQ-GEO-006

### REQ-GEO-008: Change Detection Comparison
**Priority:** MEDIUM
**Description:** Side-by-side satellite imagery comparison.
**Acceptance Criteria:**
- Before/after imagery display
- Change indicators highlighted
- Metadata for each image (date, cloud cover, satellite)
- Significant changes flagged
**Dependencies:** REQ-GEO-005

### REQ-GEO-009: Map View Tab
**Priority:** HIGH
**Description:** Map View as separate tab with fullscreen.
**Acceptance Criteria:**
- Map View as dedicated tab alongside Knowledge Graph
- Not integrated into Knowledge Graph visualization
- Fullscreen capability with maximize button
- All controls remain accessible in fullscreen
**Dependencies:** REQ-GEO-006

### REQ-GEO-010: Optional Temporal Sync
**Priority:** LOW
**Description:** Optional synchronization with other temporal views.
**Acceptance Criteria:**
- Map filter syncs with Timeline view when enabled
- Sync is opt-in, not default
- Date range slider available
- Quick presets: All time, Last year, Case period
**Dependencies:** REQ-GEO-009, REQ-VIS-004

### REQ-GEO-011: Resilient Geospatial Wrapper
**Priority:** HIGH
**Description:** Apply resilient wrapper pattern to Geospatial Agent.
**Acceptance Criteria:**
- Primary: Gemini 3 Pro for full analysis
- Fallback: Gemini 3 Flash for degraded but functional analysis
- Error logging to state for debugging
**Dependencies:** REQ-AGENT-007h

---

## REQ-TASK: Investigation Task System

### REQ-TASK-001: Multi-Agent Task Generation
**Priority:** HIGH
**Description:** Multiple agents generate investigation tasks.
**Acceptance Criteria:**
- Synthesis Agent: tasks from contradictions, gaps
- Discovery Agent: tasks from external research needs
- Hypothesis system: tasks from pending/insufficient hypotheses
- Tasks stored in `investigation_tasks` table
**Dependencies:** REQ-INF-002

### REQ-TASK-002: Task Types
**Priority:** HIGH
**Description:** Standardized task type categorization.
**Acceptance Criteria:**
- `resolve_contradiction` — Two pieces of evidence conflict
- `obtain_evidence` — Missing evidence identified
- `verify_hypothesis` — Hypothesis needs more evidence
- `follow_up_interview` — Person identified for questioning
- `document_retrieval` — Specific document needed
- `external_research` — Research beyond current evidence
- `cross_reference` — Need to compare multiple sources
- `expert_consultation` — Domain expertise needed
**Dependencies:** REQ-TASK-001

### REQ-TASK-003: Bottom Drawer UI
**Priority:** HIGH
**Description:** Task panel located in bottom drawer.
**Acceptance Criteria:**
- Collapsible bottom drawer
- Pending count badge in header
- Filter/sort controls
- Task grouping by priority, agent, or type
**Dependencies:** REQ-TASK-001

### REQ-TASK-004: Task-Type Completion Rules
**Priority:** MEDIUM
**Description:** Completion rules depend on task type.
**Acceptance Criteria:**
- `resolve_contradiction`: Resolved when one source chosen or manual merge
- `obtain_evidence`: Resolved when file uploaded or marked unobtainable
- `verify_hypothesis`: Resolved when evidence added or hypothesis status updated
- Completion notes required
**Dependencies:** REQ-TASK-002

### REQ-TASK-005: Task Awareness via Shared Context
**Priority:** MEDIUM
**Description:** Agents receive existing task list in context to avoid duplicates.
**Acceptance Criteria:**
- Current task list loaded into agent context at invocation start
- Task list format: `[{type, title, related_entities, status}]` (compact JSON)
- Agents instructed in prompt: "Review existing tasks before proposing new ones"
- Simple string matching on title + related_entities for deduplication
- No complex coordination protocol - just context injection
**Dependencies:** REQ-TASK-001

### REQ-TASK-006: SSE Task Streaming
**Priority:** HIGH
**Description:** Real-time task events via SSE.
**Acceptance Criteria:**
- Event types: TASK_CREATED, TASK_UPDATED, TASK_COMPLETED
- Events include: task_id, title, type, priority, source_agent
- Frontend updates task panel in real-time
**Dependencies:** REQ-INF-004, REQ-TASK-001

### REQ-TASK-007: Task Fullscreen
**Priority:** LOW
**Description:** Fullscreen capability for task panel.
**Acceptance Criteria:**
- Maximize button in corner
- Full-window task display
- All controls remain accessible
- ESC or button to exit
**Dependencies:** REQ-TASK-003

---

## REQ-MEM: Memory Service (Post-MVP)

### REQ-MEM-001: Cross-Case Memory Service
**Priority:** LOW (Post-MVP)
**Description:** Long-term memory across cases for pattern recognition and learning.
**Acceptance Criteria:**
- Integrate `VertexAiMemoryBankService` for persistent memory
- Memory bank stores:
  - Entity patterns (common fraud indicators, legal precedents)
  - Investigation patterns (successful approaches)
  - User preferences and custom rules
- `PreloadMemoryTool` auto-loads relevant memory at agent start
- Search past cases: `memory_service.search_memory(query)`
- Memory isolation per user (no cross-user data leakage)
- Opt-in: User explicitly enables memory storage per case
- Implementation:
  ```python
  memory_service = VertexAiMemoryBankService(
      project="your-project-id",
      location="us-central1",
      agent_engine_id="legal-lens-memory"
  )

  # After investigation completes
  await memory_service.add_session_to_memory(session)

  # In Chat Agent
  tools=[PreloadMemoryTool()]  # Auto-loads relevant memory
  ```
**Dependencies:** REQ-AGENT-007 (MVP complete first)
**Migration Path:** Enable after moving to Agent Engine post-hackathon

---

## REQ-WOW: WOW Capabilities

### REQ-WOW-001: Cross-Modal Evidence Linking
**Priority:** HIGH
**Description:** Automatically surface temporal correlations across modalities.
**Acceptance Criteria:**
- Links video timestamps to document dates
- Links audio mentions to document entities
- Links image content to textual descriptions
- Displays cross-modal links in KG view
- Confidence scores for each link
**Dependencies:** REQ-AGENT-008, REQ-VIS-003

### REQ-WOW-002: Contradiction Detection
**Priority:** HIGH
**Description:** Find inconsistencies between claims and evidence.
**Acceptance Criteria:**
- Detects factual contradictions (dates, amounts, statements)
- Detects testimony inconsistencies
- Severity classification (minor, significant, critical)
- Source citations for both sides
- Displayed in Contradictions Panel
**Dependencies:** REQ-AGENT-008, REQ-VIS-005

### REQ-WOW-003: Gap Analysis
**Priority:** HIGH
**Description:** Identify missing evidence needed to prove case elements.
**Acceptance Criteria:**
- Identifies unaddressed case elements
- Identifies missing time periods
- Identifies uncorroborated claims
- Suggests what evidence would fill gap
- Priority ranking by case impact
**Dependencies:** REQ-AGENT-008, REQ-VIS-006

### REQ-WOW-004: Narrative Generation
**Priority:** MEDIUM
**Description:** One-click generation of case briefs with citations.
**Acceptance Criteria:**
- Generate executive summary
- Generate detailed narrative
- Generate timeline narrative
- Inline citations throughout
- Export as PDF or DOCX
- Customizable sections
**Dependencies:** REQ-AGENT-008, REQ-SOURCE-005

---

## REQ-ERR: Error Handling Strategy

### REQ-ERR-001: Retry Policy
**Priority:** HIGH
**Description:** Automatic retry for transient failures.
**Acceptance Criteria:**
- Gemini API calls: 3 retries, exponential backoff (1s, 2s, 4s)
- GCS operations: 3 retries, linear backoff (500ms)
- PostgreSQL writes: 3 retries, exponential backoff
- Tool executions: 2 retries, no backoff
- Mark agent as FAILED and continue others on exhausted retries
**Dependencies:** REQ-AGENT-007

### REQ-ERR-002: Error Propagation
**Priority:** HIGH
**Description:** Graceful error handling that preserves partial results.
**Acceptance Criteria:**
- Critical errors (Orchestrator/KG): Mark job FAILED, notify user immediately
- Non-critical errors (Domain worker): Mark specific files as PARTIAL, continue with remaining agents
- Partial results shown with clear warnings
- User can manually retry failed items via UI
**Dependencies:** REQ-ERR-001

### REQ-ERR-003: Error Categories
**Priority:** HIGH
**Description:** Structured error classification for appropriate handling.
**Acceptance Criteria:**
- `TRANSIENT`: Auto-retry with backoff, no user impact if resolved
- `FILE_CORRUPT`: Mark file ERROR, skip processing, user notified
- `AGENT_TIMEOUT`: Retry once with reduced context, then PARTIAL
- `QUOTA_EXCEEDED`: Pause processing, notify user, processing delayed
- `SYSTEM_ERROR`: Log, alert, fail gracefully, user sees error state
**Dependencies:** REQ-ERR-001

### REQ-ERR-004: Error Response Format
**Priority:** MEDIUM
**Description:** Consistent JSON error response structure.
**Acceptance Criteria:**
- All API errors return consistent JSON structure
- Fields: code, message, details (file_id, agent_id, last_error, attempts)
- Fields: recoverable (boolean), suggested_action
- Standard codes: VALIDATION_ERROR, FILE_CORRUPT, PROCESSING_FAILED, AGENT_TIMEOUT, QUOTA_EXCEEDED, CONFLICT_DETECTED, SYSTEM_ERROR
**Dependencies:** REQ-INF-001

### REQ-ERR-005: Graceful Degradation
**Priority:** HIGH
**Description:** System remains usable when components fail.
**Acceptance Criteria:**
- Partial file processing: Show results for successful files, mark failed with retry button
- Model unavailable: Attempt fallback Gemini 3 Pro → Gemini 3 Flash for simpler analysis
- SSE disconnection: Show "Reconnecting..." with auto-retry (exponential backoff)
- Stale data: Display last-known-good state with timestamp, show refresh prompt
- KG build fails: Preserve domain findings, allow access to raw findings without graph
**Dependencies:** REQ-INF-004, REQ-AGENT-007

---

## Traceability Matrix

| Requirement ID | PROJECT.md Reference | Research Source |
|---------------|---------------------|-----------------|
| REQ-INF-* | Infrastructure & Auth | STACK.md, PITFALLS.md |
| REQ-AUTH-* | Infrastructure & Auth | STACK.md (Better Auth) |
| REQ-CASE-* | Case Management | FEATURES.md |
| REQ-AGENT-* | Agentic Processing Pipeline | ARCHITECTURE.md |
| REQ-VIS-* | Agent Flow, Knowledge Graph | FEATURES.md |
| REQ-SOURCE-* | Source Panel | FEATURES.md |
| REQ-CHAT-* | Contextual Chat | ARCHITECTURE.md |
| REQ-CORR-* | Correction & Regeneration | FEATURES.md |
| REQ-WOW-* | WOW Capabilities | FEATURES.md, SUMMARY.md |
| REQ-ERR-* | Error Handling | PRD Section 8, PITFALLS.md |
| REQ-RESEARCH-* | Research & Discovery | INTEGRATION.md |
| REQ-HYPO-* | Hypothesis-Driven Investigation | INTEGRATION.md |
| REQ-GEO-* | Geospatial Intelligence | INTEGRATION.md |
| REQ-TASK-* | Investigation Task System | INTEGRATION.md |

---

## Requirement Statistics

| Category | Count | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| Infrastructure | 4 | 3 | 1 | 0 | 0 |
| Authentication | 4 | 0 | 4 | 0 | 0 |
| Case Management | 5 | 1 | 3 | 1 | 0 |
| Agents (Core) | 10 | 3 | 6 | 1 | 0 |
| Knowledge Storage | 3 | 2 | 1 | 0 | 0 |
| Agents (ADK Config) | 10 | 0 | 6 | 3 | 1 |
| Visualization | 7 | 1 | 4 | 1 | 1 |
| Source Panel | 5 | 1 | 3 | 1 | 0 |
| Chat | 5 | 1 | 3 | 1 | 0 |
| Corrections | 4 | 0 | 0 | 3 | 1 |
| WOW | 4 | 0 | 3 | 1 | 0 |
| Error Handling | 5 | 0 | 4 | 1 | 0 |
| Research & Discovery | 9 | 0 | 6 | 2 | 1 |
| Hypothesis System | 9 | 0 | 5 | 4 | 0 |
| Geospatial Intelligence | 11 | 0 | 6 | 4 | 1 |
| Investigation Tasks | 7 | 0 | 4 | 2 | 1 |
| Memory (Post-MVP) | 1 | 0 | 0 | 0 | 1 |
| **TOTAL** | **103** | **12** | **59** | **24** | **6** |

---

## ADK-Specific Requirements Summary

| Requirement | Priority | Purpose |
|-------------|----------|---------|
| REQ-AGENT-007 | CRITICAL | Core ADK infrastructure: stage-isolated sessions, tiered file handling, pipeline orchestration |
| REQ-AGENT-007a | HIGH | Document and mitigate ADK limitations |
| REQ-AGENT-007b | HIGH | Thinking mode: BuiltInPlanner with ThinkingConfig, ALL agents HIGH |
| REQ-AGENT-007c | HIGH | Media resolution per agent: medium (Triage), high (Domain/Evidence) |
| REQ-AGENT-007d | HIGH | Video/audio metadata for precise timestamps |
| REQ-AGENT-007e | HIGH | ADK artifact service with versioning |
| REQ-AGENT-007f | MEDIUM | Context caching for File API URIs shared across agents |
| REQ-AGENT-007g | MEDIUM | Context compaction for Chat Agent ONLY (not pipeline) |
| REQ-AGENT-007h | HIGH | Resilient agent wrapper for graceful degradation |
| REQ-AGENT-007i | LOW | Deep Research agent for background research |
| REQ-VIS-001a | HIGH | Frontend HITL confirmation (ADK limitation workaround) |
| REQ-MEM-001 | LOW | Memory service (post-MVP) |

## New Agent Configuration Summary

| Agent | Thinking Level | Model | Notes |
|-------|----------------|-------|-------|
| Research Agent | medium | Gemini 3 Pro | Source discovery via web search |
| Discovery Agent | medium | Gemini 3 Pro | Synthesizes external research |
| Geospatial Agent | medium | Gemini 3 Pro | Location intelligence, post-synthesis |
| All new agents | — | Pro + Flash fallback | Resilient wrapper pattern applied |

---

## Implementation Status

> **Note:** This section tracks implementation progress. Updated 2026-02-02 after Yatharth's frontend work.
> See `DEVELOPMENT_DOCS/YATHARTH_WORK_SUMMARY.md` for detailed file paths and TODOs.

### Status Legend
- ✅ **COMPLETE** — Fully implemented
- 🟡 **FRONTEND_COMPLETE** — UI done, backend integration pending
- 🟠 **PARTIAL** — Some sub-criteria met
- ⏳ **NOT_STARTED** — No implementation yet

---

### REQ-VIS: Visualization & UI

#### REQ-VIS-001: Agent Flow — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| React Flow canvas showing agent nodes | ✅ | @xyflow/react + dagre in `CommandCenter/AgentFlowCanvas.tsx` (Phase 4.1 revamp) |
| Animated edges during data flow | ✅ | FileRoutingEdge with gray tier system |
| Color-coded by agent type | ✅ | 7 agent types (incl. evidence, kg_builder) with muted color palette |
| Click node to expand details panel | ✅ | `NodeDetailsSidebar.tsx` page-level 30% panel with spring animation |
| Shows model, input, tools, output, duration | ✅ | Real backend data via SSE state-snapshot + agent-complete events |
| Shows thinking traces | ✅ | Full untruncated text from after_model_callback, JSON normalized |
| Updates in real-time via SSE | ✅ | `useCommandCenterSSE.ts` with state-snapshot on reconnect |
| ADK callback-to-SSE mapping | ✅ | THINKING_UPDATE, TOOL_CALLED, agent lifecycle events |

**Backend APIs:** All complete
- `SSE GET /sse/cases/:caseId/command-center/stream` — Agent lifecycle events
- `POST /api/cases/:caseId/confirmations/:requestId` — HITL confirmation
- `GET /api/cases/:caseId/confirmations/pending` — Pending confirmations

**Files:** `frontend/src/components/CommandCenter/`, `frontend/src/hooks/useCommandCenterSSE.ts`, `frontend/src/hooks/useAgentStates.ts`, `frontend/src/hooks/useAgentFlowGraph.ts`

---

#### REQ-VIS-001a: Human-in-the-Loop Confirmation — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| Confirmation dialog UI | ✅ | `ConfirmationModal.tsx` with approve/reject + reason input |
| Routing HITL (batch) | ✅ | Per-agent-type confidence thresholds, batch confirmation modal |
| Low-confidence finding HITL | ✅ | Findings below threshold trigger confirmation |
| Strategy standalone HITL | ✅ | User prompted when domain agents fail but strategy has files |

**Files:** `frontend/src/components/CommandCenter/ConfirmationModal.tsx`, `backend/app/services/confirmation.py`

---

#### REQ-VIS-002: Agent Detail View — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| Full thinking trace | ✅ | JSON-normalized thinking traces from all agents |
| Complete input context | ✅ | Input data visible in sidebar |
| Tool calls with inputs/outputs | ✅ | Tool-called events displayed |
| Complete output findings | ✅ | Finding counts, entity counts in sidebar |
| Token usage statistics | ✅ | CollapsibleSection with input/output tokens, model name |
| Execution timeline | ✅ | Gantt chart showing agent timing overlap |

**Files:** `frontend/src/components/CommandCenter/NodeDetailsSidebar.tsx`, `frontend/src/components/CommandCenter/ExecutionTimeline.tsx`

---

#### REQ-VIS-003: Knowledge Graph View — ✅ COMPLETE (Source viewer wiring deferred to Phase 10)

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| D3.js force simulation (5 forces) | ✅ | useGraphSimulation: link, charge, center, collision, radial (Phase 7.2) |
| Nodes sized by connection count | ✅ | Sqrt-scaled node radius via d3.scalePow().exponent(0.5) |
| Edges labeled with relationship type | ✅ | Always-horizontal edge labels with disclosure |
| Domain layer toggles | ✅ | 4 domain toggles (Financial, Legal, Evidence, Strategy) in FilterPanel |
| Zoom and pan controls | ✅ | d3.zoom() with scale extent [0.01, 10], zoom/pan/reset buttons |
| Node search and highlight | ✅ | Debounced search with coral (#E87461) highlight, distinct from selection (white) |
| Click node for details | ✅ | Opens DetailSidebar with entity panel + EntityTimeline |
| Left panel (filters/controls, local to KG canvas) | ✅ | FilterPanel: stats, search, keyword filter, domain/type toggles |
| Right panel (entity timeline, local to KG canvas) | ✅ | EntityTimeline in DetailSidebar: chronological relationships, date range, filter-by-entity |
| Source viewer panel (multi-media) | 🟡 | Components built (PdfViewer, AudioViewer, VideoViewer, ImageViewer) but NOT wired — deferred to Phase 10 |
| Density threshold slider | ⏳ | Not implemented |
| Fullscreen capability | ⏳ | Not implemented |
| Basic analytics | ✅ | Entity count, relationship count, domain breakdown in FilterPanel |

**Backend APIs:** All complete
- `GET /api/cases/:caseId/graph` — Full graph visualization data
- `GET /api/cases/:caseId/entities` — List entities with filters
- `POST /api/cases/:caseId/entities` — Create entity
- `PATCH /api/cases/:caseId/entities/:entityId` — Update entity
- `DELETE /api/cases/:caseId/entities/:entityId` — Delete entity
- `GET /api/cases/:caseId/relationships` — List relationships with filters
- `POST /api/cases/:caseId/relationships` — Create relationship

**Files:** `frontend/src/components/knowledge-graph/KnowledgeGraphCanvas.tsx`, `frontend/src/components/knowledge-graph/GraphSvg.tsx`, `frontend/src/components/knowledge-graph/FilterPanel.tsx`, `frontend/src/components/knowledge-graph/EntityTimeline.tsx`, `frontend/src/hooks/useGraphSimulation.ts`, `frontend/src/hooks/useGraphSelection.ts`, `frontend/src/hooks/useGraphFilters.ts`, `frontend/src/hooks/use-case-graph.ts`, `frontend/src/types/knowledge-graph.ts`

---

#### REQ-VIS-004: Timeline View — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| Horizontal timeline with zoom | ✅ | Day/week/month/year zoom levels |
| Events plotted by date/time | ✅ | Grouped by zoom level, real synthesis data |
| Events linked to source evidence | ✅ | Domain tags, finding references |
| Filter by entity, event type | ✅ | Layer filtering (evidence/legal/strategy/financial) |
| Gaps highlighted visually | ✅ | Via synthesis gap detection |
| Click event for details | ✅ | Opens detail modal |

**Backend APIs:**
- `GET /api/cases/:caseId/timeline` — Fetch events with filters + aggregation
- `GET /api/cases/:caseId/timeline/:eventId` — Get single event

**Files:** `frontend/src/components/Timeline/`, `frontend/src/hooks/useTimelineData.ts`, `frontend/src/hooks/useTimelineFilters.ts`, `backend/app/api/timeline.py`

---

#### REQ-VIS-005: Contradictions Panel — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| List of contradiction pairs | ✅ | ContradictionCard with side-by-side claims in VerdictView |
| Each shows claim A, claim B, sources, severity | ✅ | Severity badge, domain tag, excerpts |
| Click to navigate to sources | ✅ | Opens ContradictionDetailPanel in DetailSidebar |
| Filter by severity, entity | ✅ | API supports severity filtering |
| Resolution status tracking | ✅ | Status field on contradiction records |

**Backend APIs:**
- `GET /api/cases/:caseId/contradictions` — List with severity filtering

**Files:** `frontend/src/components/verdict/ContradictionCard.tsx`, `frontend/src/components/verdict/ContradictionDetailPanel.tsx`, `backend/app/api/synthesis.py`

---

#### REQ-VIS-006: Evidence Gaps Panel — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| List of evidence gaps | ✅ | GapCard in VerdictView with priority badge |
| Priority and description | ✅ | Priority badge (critical/high/medium/low), suggested actions |
| Click for full details | ✅ | Opens GapDetailPanel in DetailSidebar |
| Filter by priority | ✅ | API supports priority filtering |

**Backend APIs:**
- `GET /api/cases/:caseId/gaps` — List with priority filtering

**Files:** `frontend/src/components/verdict/GapCard.tsx`, `frontend/src/components/verdict/GapDetailPanel.tsx`, `backend/app/api/synthesis.py`

---

### REQ-CASE: Case Management

#### REQ-CASE-004: Evidence Upload — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| Drag-and-drop upload UI | ✅ | Implemented in CaseLibrary.tsx |
| Multiple file selection | ✅ | Supported via handleDrop |
| Progress indicator per file | ✅ | Upload progress tracking via useFileUpload hook |
| Automatic file type detection | ✅ | MIME type validation in backend |
| Supported file types | ✅ | PDF, DOCX, MP4, MP3, WAV, JPG, PNG |
| Max 500MB per file | ✅ | MAX_FILE_SIZE enforced in file_service.py |
| Files stored in GCS with metadata | ✅ | GCS chunked upload + PostgreSQL metadata |

**Backend APIs:**
- `POST /api/cases/:caseId/files` — Upload file (multipart, chunked GCS streaming)

**Files:** `backend/app/api/files.py`, `backend/app/services/file_service.py`, `frontend/src/hooks/useFileUpload.ts`

---

#### REQ-CASE-005: Case Library View — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| Grid or list view toggle | ✅ | List view implemented |
| File thumbnails | ✅ | Icons implemented (thumbnails deferred) |
| File metadata display | ✅ | Name, type, size, status shown |
| Filter by type, status | ✅ | Category filters (all/evidence/legal/strategy/reference) |
| Select files for batch operations | ✅ | UI connected to real APIs |
| Delete individual files | ✅ | DELETE endpoint with GCS cleanup |

**Backend APIs:**
- `GET /api/cases/:caseId/files` — List files with pagination/filters
- `POST /api/cases/:caseId/files` — Upload file (multipart)
- `DELETE /api/cases/:caseId/files/:fileId` — Delete file
- `GET /api/cases/:caseId/files/:fileId/download` — Download via signed URL
- `SSE /sse/cases/:caseId/files` — Real-time file status updates

**Files:** `frontend/src/components/library/CaseLibrary.tsx`, `frontend/src/lib/api/files.ts`

---

### REQ-CHAT: Contextual Chat

#### REQ-CHAT-001: Chat Interface — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| Message input with send button | ✅ | Full input with keyboard support |
| Message history display | ✅ | Scrollable history with SSE streaming |
| Streaming response with typing indicator | ✅ | Real-time SSE token streaming via fetchEventSource |
| Markdown rendering | ✅ | ReactMarkdown + remark-gfm with styled components |
| Code block formatting | ✅ | Custom pre/code styling in dark theme |
| Mobile-responsive | ✅ | Responsive design |
| Inline citation chips | ✅ | [[file_id\|locator\|label]] parsed to clickable chips |
| Tool activity indicators | ✅ | Expandable "Agent is working..." section |
| Stop/Clear buttons | ✅ | AbortController cancellation, session reset |
| Disabled state (no analysis) | ✅ | Overlay message when analysis not run |
| Error bubbles with retry | ✅ | Red-tinted inline error messages |

**Backend API:** `POST /api/cases/:caseId/chat` (SSE streaming) — DONE

**Files:** `frontend/src/components/app/chatbot.tsx`, `frontend/src/hooks/useChatbot.ts`, `frontend/src/types/chatbot.ts`, `backend/app/api/chat.py`, `backend/app/services/chat_service.py`, `backend/app/agents/chat_tools.py`, `backend/app/agents/prompts/chat.py`

---

### REQ-SOURCE: Source Panel

#### REQ-SOURCE-005: Citation Navigation — ✅ COMPLETE

Citation-to-source navigation wired across all 4 views (KG, Geospatial, Verdict, Timeline). Shared hooks: `useSourceNavigation` (citation -> SourceViewerModal), `useEntityResolver` (UUID -> name/type/color). Reusable components: `CitationLink`, `EntityBadge`.

**Files:** `frontend/src/lib/citation-utils.ts`, `frontend/src/hooks/useSourceNavigation.ts`, `frontend/src/hooks/useEntityResolver.ts`, `frontend/src/components/ui/citation-link.tsx`, `frontend/src/components/ui/entity-badge.tsx`

---

### REQ-AGENT: Agentic Processing Pipeline

#### REQ-AGENT-001: Triage Agent — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| Receives files via tiered handling | ✅ | `build_agent_content()` in `adk_service.py` |
| Uses Gemini 3 Flash | ✅ | `MODEL_FLASH` in factory |
| Stage-isolated ADK session | ✅ | `create_stage_runner()` per stage |
| Domain scores (Financial, Legal, Strategy, Evidence) | ✅ | `DomainScore` schema, 0-100 range |
| Complexity tier output | ✅ | `ComplexityAssessment` schema |
| File summary (short + detailed) | ✅ | `FileSummary` schema |
| Entity extraction | ✅ | `ExtractedEntity` with 6 types |
| Stores TriageOutput in agent_executions | ✅ | JSONB output_data column |

**Files:** `backend/app/agents/triage.py`, `backend/app/agents/prompts/triage.py`, `backend/app/schemas/agent.py`

---

#### REQ-AGENT-002: Orchestrator Agent — 🟠 PARTIAL

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| LlmAgent with Gemini 3 Pro | ✅ | `MODEL_PRO` in factory |
| Receives triage results | ✅ | `run_orchestrator(triage_output=...)` |
| Routes to domain agents | ✅ | `RoutingDecision` schema with reasoning |
| Manages parallel execution | ⏳ | Stub; domain agents not yet implemented (Phase 6) |
| Aggregates domain outputs | ⏳ | Not yet; depends on domain agents |
| Handles agent failures | ⏳ | Not yet; depends on domain agents |

**Files:** `backend/app/agents/orchestrator.py`, `backend/app/agents/prompts/orchestrator.py`

---

#### REQ-AGENT-007: ADK Runner Infrastructure — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| ADK integrated with FastAPI | ✅ | `google-adk>=1.2.0` in pyproject.toml |
| DatabaseSessionService with PostgreSQL | ✅ | `get_session_service()` in adk_service.py |
| Stage-isolated sessions | ✅ | `create_stage_runner()` per stage |
| Session ID deterministic | ✅ | SHA-256 of case_id:workflow_id:stage |
| Fresh agent instances per stage | ✅ | `AgentFactory` pattern |
| Tiered file handling | ✅ | `build_agent_content()` inline + File API |
| GcsArtifactService | ✅ | `get_artifact_service()` configured |
| Pipeline orchestration via Python | ✅ | `run_analysis_workflow()` in agents.py |

**Files:** `backend/app/services/adk_service.py`, `backend/app/agents/factory.py`

---

#### REQ-AGENT-007a: ADK Limitations Documentation — ✅ COMPLETE

Limitations documented in code comments and mitigated:
- Tool confirmation → frontend dialogs (noted in factory.py)
- Single parent rule → AgentFactory fresh instances
- Temperature at 1.0 → not overridden

---

#### REQ-AGENT-007b: Thinking Mode Configuration — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| BuiltInPlanner with ThinkingConfig | ✅ | `create_thinking_planner()` in base.py |
| All agents HIGH thinking | ✅ | Factory passes `"high"` for all |
| include_thoughts=True | ✅ | Set in ThinkingConfig |
| Thinking traces captured | ✅ | `_extract_thinking_traces()` in triage.py/orchestrator.py |
| Factory helper function | ✅ | `create_thinking_planner(level)` |

**Files:** `backend/app/agents/base.py`

---

#### REQ-AGENT-007e: ADK Artifact Service — ✅ COMPLETE

| Sub-Criterion | Status | Notes |
|---------------|--------|-------|
| GcsArtifactService configured | ✅ | `get_artifact_service()` with dedicated bucket |
| Runner initialized with artifact_service | ✅ | `create_stage_runner()` includes it |

**Files:** `backend/app/services/adk_service.py`

---

### Summary: Implementation Coverage

| Category | Requirements | Complete | Frontend Done | Partial | Not Started |
|----------|-------------|----------|---------------|---------|-------------|
| Visualization (VIS) | 6 | 4 | 1 | 0 | 1 |
| Case Management (CASE) | 5 | 5 | 0 | 0 | 0 |
| Chat (CHAT) | 5 | 0 | 1 | 0 | 4 |
| Source Panel (SOURCE) | 5 | 0 | 0 | 0 | 5 |
| Agents (Core) | 4 | 3 | 0 | 0 | 1 |
| Agents (ADK Config) | 4 | 4 | 0 | 0 | 0 |
| Knowledge Storage (STORE) | 3 | 2 | 0 | 0 | 1 |

*Phase 2 requirements (REQ-CASE-001, 002, 003) completed. Phase 3 requirements (REQ-CASE-004, 005) completed 2026-02-02. Phase 4 requirements (REQ-AGENT-001, 007, 007a, 007b, 007e) completed 2026-02-03. Phase 5 (REQ-VIS-001, 001a, 002) completed 2026-02-05. Phase 6 (REQ-AGENT-002/003/004/005/006) completed 2026-02-06. Phase 7/7.1 (REQ-STORE-001/002, REQ-AGENT-009) completed 2026-02-08. Phase 7.2 (REQ-VIS-003) completed 2026-02-08. Phase 8 (REQ-AGENT-008, REQ-HYPO-001/002/003/004/005/006, REQ-WOW-001/002/003/004, REQ-VIS-004/005/006, REQ-TASK-001/002) completed 2026-02-09.*

---

*Generated: 2026-01-18*
*Updated: 2026-02-08*
*Architecture redesign: 2026-02-07 (REQ-STORE added, REQ-AGENT-008/009 rewritten, REQ-CHAT-002/003 updated for tool-based architecture)*
*Architecture revision: 2026-02-08 (REQ-AGENT-009 revised for LLM-based KG Builder; REQ-VIS-003 updated for D3.js with Epstein-inspired patterns; vis-network deferred)*
*Status: Complete - Integration features added (REQ-RESEARCH, REQ-HYPO, REQ-GEO, REQ-TASK)*
*Frontend Status: Partial implementation by Yatharth (see DEVELOPMENT_DOCS/YATHARTH_WORK_SUMMARY.md)*
*Phase 4 Agent requirements tracked: 2026-02-03*
