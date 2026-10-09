# Legal Lens Legal Intelligence Platform - Technical PRD

## 1. Executive Summary

**Product**: Legal Lens - A legal/investigation intelligence platform that processes multimodal evidence files through domain-specialized AI agents utilising Gemini 3's multimodal capabilities, generating knowledge graphs, timeline visualizations, and enabling contextual chat with full agent decision transparency.

**Scope**: PoC for hackathon - Single user, ~10 cases, ~50 files per case (up to 500MB each), desktop-only.

**Core Differentiators**:

- Domain-based multi-agent orchestration
- Agent Flow - Full AI decision transparency with reasoning and agent heirarchy traces
- Multimodal evidence (documents, video, audio, images) linking, contradiction detection, and gap analysis
- Gemini 3's native multimodal processing within domain context

---

## 2. System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Next.js 16 Frontend]
        AUTH[Better Auth Library API Routes]
    end

    subgraph "API Layer"
        API[FastAPI Server]
        SSE[SSE Event Stream]
    end

    subgraph "Agent Layer - Google ADK"
        ORCH[Orchestrator Agent]
        TRIAGE[Triage Agent]
        
        subgraph "Processing Pipeline"
            subgraph "Domain Agents - ParallelAgent"
                FIN[Financial Domain Agent]
                LEG[Legal Domain Agent]
                STR[Strategy Domain Agent]
            end
            SYNTH[Synthesis Agent]
            KG[Knowledge Graph Agent]
        end
        
        subgraph "Interactive Agents"
            CHAT[Chat Agent]
            VERIFY[Verification Agent]
            MERGE[Merge Agent]
        end
    end

    subgraph "Storage Layer - GCP"
        PG[(Cloud SQL PostgreSQL)]
        GCS[(Cloud Storage)]
    end

    subgraph "AI Layer"
        G3P[Gemini 3 Pro]
        G3F[Gemini 3 Flash]
    end

    UI <-->|REST + SSE| API
    API --> SSE
    API <--> ORCH
    ORCH --> TRIAGE
    ORCH --> FIN & LEG & STR
    FIN & LEG & STR --> SYNTH
    SYNTH --> KG
    
    %% Chat escalation path
    CHAT <-->|escalation| ORCH
    CHAT -->|reads| KG
    
    %% Correction flow
    VERIFY --> MERGE
    MERGE -->|incremental update| KG
    
    TRIAGE --> G3F
    FIN & LEG & STR & SYNTH & KG & CHAT & VERIFY & MERGE --> G3P
    ORCH <--> PG
    API <--> PG
    API <--> GCS
    FIN & LEG & STR <--> GCS
```

---

## 3. Data Flow Architecture

### 3.1 File Upload & Processing Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as FastAPI
    participant GCS as Cloud Storage
    participant DB as PostgreSQL
    participant ADK as ADK Runner
    participant ORCH as Orchestrator
    participant TRI as Triage Agent
    participant PAGT as ParallelAgent
    participant SYNTH as Synthesis Agent
    participant KG as KG Agent

    U->>FE: Upload Files
    FE->>API: POST /cases/{id}/files
    API->>GCS: Store raw files
    API->>DB: Create file records (status: PENDING)
    API-->>FE: 202 Accepted + processing_id
    
    API->>ADK: runner.run_async(new_message)
    ADK->>ORCH: Start processing
    
    Note over ORCH,TRI: Phase 1 - Triage
    par For all files uploaded at once
        ORCH->>TRI: Analyze files
        TRI-->>ORCH: triage_results via output_key
    end
    
    Note over ORCH,PAGT: Phase 2 - Domain Analysis (Parallel)
    ORCH->>PAGT: Spawn ParallelAgent
    par Concurrent Execution
        PAGT->>PAGT: Financial Agent(s)
        PAGT->>PAGT: Legal Agent(s)
        PAGT->>PAGT: Strategy Agent(s)
    end
    PAGT-->>ORCH: domain_findings via output_key
    
    Note over SYNTH,KG: Phase 3 - Synthesis & Graph
    ORCH->>SYNTH: Cross-reference all findings
    SYNTH-->>ORCH: synthesis_results (links, contradictions, gaps)
    ORCH->>KG: Build Knowledge Graph
    KG->>DB: Persist final results
    
    ADK-->>API: SSE events throughout
    API-->>FE: SSE: processing_complete
```

### 3.2 Real-Time Event Flow (SSE)

```mermaid
graph LR
    subgraph "ADK Callbacks"
        A1[before_agent_callback]
        A2[after_agent_callback]
        A3[before_tool_callback]
        A4[after_tool_callback]
    end

    subgraph "SSE Channel"
        CH["SSE: /cases/{id}/events"]
    end

    subgraph "Frontend Handlers"
        H1[Update Agent Node]
        H2[Show Reasoning Trace]
        H3[Show Tool Activity]
        H4[Mark Node Complete]
    end

    A1 & A2 & A3 & A4 --> CH
    CH --> H1 & H2 & H3 & H4
```

### 3.3 Chat & Correction Flow

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant API as FastAPI
    participant CHAT as Chat Agent
    participant ORCH as Orchestrator
    participant DA as Domain Agent(s)
    participant VERIFY as Verification Agent
    participant MERGE as Merge Agent
    participant DB as PostgreSQL

    U->>FE: Type question
    FE->>API: POST /cases/{id}/chat (stream)
    API->>CHAT: Process query
    
    CHAT->>DB: query_knowledge_graph(query)
    DB-->>CHAT: entities, relationships, insights
    
    alt Knowledge sufficient
        CHAT-->>API: Stream response tokens
        API-->>FE: SSE: CHAT_TOKEN (multiple)
        API-->>FE: SSE: CHAT_COMPLETE + citations
    else Novel question (KG insufficient)
        CHAT->>ORCH: escalate_to_domain(question)
        ORCH->>DA: Delegate to relevant domain(s)
        DA-->>ORCH: Fresh findings
        ORCH-->>CHAT: New analysis
        CHAT-->>API: Stream response with new insights
    end
    
    FE->>FE: Render response with citation links
    
    Note over U,DB: User spots an error in findings
    
    U->>FE: Flag correction (original → proposed)
    FE->>API: POST /cases/{id}/correct
    API->>VERIFY: Validate correction
    
    VERIFY->>DB: Load source file context
    VERIFY->>VERIFY: Compare original vs proposed vs source
    
    alt Correction CONFIRMED
        VERIFY->>DB: Create correction record
        VERIFY->>MERGE: Apply to KG
        MERGE->>DB: Update affected nodes/edges
        MERGE->>DB: Mark downstream items STALE
        API-->>FE: SSE: CORRECTION_VERIFIED + STALE_ITEMS_MARKED
    else Correction REJECTED/AMBIGUOUS
        API-->>FE: Return rejection with source evidence
        FE->>U: Show explanation + source citations
    end
```

### 3.4 Incremental File Addition Flow

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant API as FastAPI
    participant TRI as Triage Agent
    participant ORCH as Orchestrator
    participant DA as Domain Agent(s)
    participant MERGE as Merge Agent
    participant DB as PostgreSQL

    U->>FE: Upload new file(s) to existing case
    FE->>API: POST /cases/{id}/files
    API->>DB: Create file records (status: PENDING)
    API-->>FE: 202 Accepted
    
    FE->>API: POST /cases/{id}/process (incremental: true)
    API->>TRI: Process NEW files only
    TRI-->>API: triage_results
    API-->>FE: SSE: TRIAGE_COMPLETE
    
    ORCH->>DA: Route to relevant domain agents
    DA-->>ORCH: new_findings
    API-->>FE: SSE: DOMAIN_COMPLETE
    
    ORCH->>MERGE: Compare with existing KG
    MERGE->>DB: Load existing knowledge_graph
    
    MERGE->>MERGE: Entity resolution
    Note over MERGE: Match new entities to existing
    
    MERGE->>MERGE: Relationship merging
    Note over MERGE: Detect conflicts
    
    alt No conflicts
        MERGE->>DB: Incremental KG update (version++)
        API-->>FE: SSE: GRAPH_UPDATED
    else Conflicts detected
        MERGE->>DB: Store conflicts for user resolution
        API-->>FE: SSE: CONFLICT_DETECTED + conflict details
        FE->>U: Show conflict resolution UI
        U->>FE: Resolve: trust_new | keep_existing | manual
        FE->>API: POST /conflicts/{id}/resolve
        API->>MERGE: Apply resolution
        MERGE->>DB: Update KG with resolution
    end
    
    FE->>FE: Refresh visualizations
```

**SSE Event Schema**:

```typescript
interface SSEEvent {
  type: "AGENT_STARTED" | "AGENT_PROGRESS" | "TOOL_INVOKED" | 
        "THINKING_UPDATE" | "AGENT_COMPLETED" | "ERROR";
  agent_id: string;
  agent_type: "ORCHESTRATOR" | "TRIAGE" | "FINANCIAL" | "LEGAL" | 
              "STRATEGY" | "SYNTHESIS" | "KNOWLEDGE_GRAPH";
  timestamp: string;  // ISO8601
  payload: {
    thinking_summary?: string;  // From include_thoughts
    tool_name?: string;
    tool_args?: object;
    progress?: number;
    error?: string;
  };
}
```

---

## 4. Agentic System Architecture

### 4.1 ADK Agent Types Used

The system leverages ADK's specialized agent types for different orchestration patterns:

| ADK Agent Type | Usage in Legal Lens | Purpose |
|---------------|-----------------|---------|
| `LlmAgent` | Orchestrator, Triage, Domain workers, Synthesis, KG | LLM-powered analysis with tools |
| `SequentialAgent` | Inner pipeline (ParallelAgent → Synthesis → KG) | Ordered phase execution after routing |
| `ParallelAgent` | Domain analysis phase | Concurrent multi-domain processing |
| `LoopAgent` | Quality refinement (Post-PoC) | Iterative improvement until threshold |
| `BaseAgent` | Threshold checker (Post-PoC) | Custom escalation logic |

### 4.1.1 Orchestrator Agent - The Decision Maker

The **Orchestrator Agent** is an `LlmAgent` (not just a wrapper) that serves as the intelligent coordinator of the entire pipeline. It:

1. **Invokes Triage**: Delegates to the Triage Agent to quickly classify all uploaded files
2. **Analyzes Triage Results**: Reads `triage_results` containing per-file domain scores and complexity
3. **Routes Files to Domains**: Assigns each file to domain agent(s) based on `domain_scores` threshold (e.g., ≥0.4)
4. **Spawns Domain Configuration**: Determines worker count per domain based on cumulative complexity
5. **Assembles ParallelAgent**: Dynamically constructs the domain analysis phase with routed file assignments
6. **Triggers Downstream Phases**: After domain analysis, invokes Synthesis and KG agents sequentially

**Key Phases**:
- `route_files_to_domains`: Takes triage_results, returns file→domain assignments
- `spawn_domain_agents`: Creates domain agent configuration based on complexity
- `transfer_to_agent`: ADK built-in for delegating to sub-agents

### 4.2 Agent Pipeline Architecture

The Orchestrator Agent controls the entire flow, using tools and agent delegation to route files intelligently:

```mermaid
graph TB
    subgraph "Processing Pipeline"
        direction TB
        
        subgraph "Phase 1: Classification"
            TRI[LlmAgent: Triage<br/>output_key: triage_results<br/>Analyzes ALL files quickly]
        end
        
        subgraph "Phase 1.5: Routing Decision"
            ROUTE[Orchestrator reads triage_results<br/>Calls route_files_to_domains tool<br/>Writes: file_assignments]
        end
        
        subgraph "Phase 2: ParallelAgent - Domain Analysis"
            FIN[LlmAgent: Financial<br/>input: assigned_financial_files<br/>output_key: financial_findings]
            LEG[LlmAgent: Legal<br/>input: assigned_legal_files<br/>output_key: legal_findings]
            STR[LlmAgent: Strategy<br/>input: assigned_strategy_files<br/>output_key: strategy_findings]
        end
        
        subgraph "Phase 3: Cross-Reference"
            SYNTH[LlmAgent: Synthesis<br/>input: all domain findings<br/>output_key: synthesis_results]
        end
        
        subgraph "Phase 4: Graph Construction"
            KG[LlmAgent: KnowledgeGraph<br/>input: synthesis_results<br/>output_key: knowledge_graph]
        end
        
        TRI --> ROUTE
        ROUTE --> FIN & LEG & STR
        FIN & LEG & STR --> SYNTH
        SYNTH --> KG
    end
    
    subgraph "Query Time Agents"
        direction TB
        CHAT[ChatAgent<br/>Gemini 3 Pro<br/>Knowledge-first Q&A]
        VERIFY[VerificationAgent<br/>Validates corrections]
        MERGE[MergeAgent<br/>Incremental KG updates]
    end
    
    KG -->|knowledge_graph| DB[(PostgreSQL)]
    CHAT <-->|query| DB
    CHAT <-->|escalation| ROUTE
    VERIFY --> MERGE
    MERGE -->|incremental update| DB
```

**Critical Distinction**: The Orchestrator is an intelligent `LlmAgent` that makes routing decisions. It uses Gemini to reason about triage results and dynamically configure the domain analysis phase.

### 4.3 State Communication Pattern

Agents communicate via ADK session state using `output_key` and template substitution:

```
Agent A (output_key="results_a") 
    → writes to state["results_a"]
    → Agent B instruction: "Analyze based on: {results_a}"
    → ADK auto-substitutes state value into prompt
```

**Complete State Flow with Routing**:

| Step | Agent | Reads from State | Writes to State | Purpose |
|------|-------|------------------|-----------------|--------|
| 1 | Triage | `uploaded_files` (file list) | `triage_results` | Per-file: domain_scores, complexity, metadata |
| 2 | Orchestrator | `triage_results` | `file_assignments`, `domain_config` | Routes files, determines worker counts |
| 3a | Financial Agent(s) | `file_assignments.financial` | `financial_findings` | Only processes assigned files |
| 3b | Legal Agent(s) | `file_assignments.legal` | `legal_findings` | Only processes assigned files |
| 3c | Strategy Agent(s) | `file_assignments.strategy` | `strategy_findings` | Only processes assigned files |
| 4 | Synthesis | `*_findings` (all domains) | `synthesis_results` | Cross-modal links, contradictions, gaps |
| 5 | Knowledge Graph | `synthesis_results` | `knowledge_graph` | Final graph structure |
| 6 | Orchestrator | `knowledge_graph` | Persists to PostgreSQL | Completes pipeline |
| 7 | Chat | `knowledge_graph`, `*_findings`, `case_context` | `chat_response`, `chat_history` | Answers user queries with citations |
| 8 | Verification | `correction_request`, source files | `verification_result` | Validates corrections against original sources |
| 9 | Merge | `new_findings`, `existing_knowledge_graph` | `merge_plan`, conflicts | Incremental graph updates for new files |

**Triage Results Schema** (drives routing):
```json
{
  "files": [
    {
      "file_id": "uuid",
      "filename": "bank_statements.pdf",
      "domain_scores": {"financial": 0.95, "legal": 0.15, "strategy": 0.10},
      "complexity_score": 0.72,
      "primary_domain": "financial",
      "secondary_domains": []
    },
    {
      "file_id": "uuid",
      "filename": "contract_amendment.pdf",
      "domain_scores": {"financial": 0.40, "legal": 0.85, "strategy": 0.30},
      "complexity_score": 0.55,
      "primary_domain": "legal",
      "secondary_domains": ["financial"]
    }
  ],
  "domain_complexity_totals": {"financial": 2.1, "legal": 1.8, "strategy": 0.6}
}
```

**File Assignments Schema** (written by Orchestrator):
```json
{
  "financial": ["file_id_1", "file_id_2"],
  "legal": ["file_id_2", "file_id_3"],
  "strategy": ["file_id_4"]
}
```
Note: A file can be assigned to multiple domains if it has high scores (≥0.4) in multiple areas.

### 4.3.1 Intermediate Persistence Strategy

To ensure robustness against failures, key intermediate results are persisted to PostgreSQL at phase boundaries:

| Phase Complete | Data Persisted | Table | Purpose |
|---------------|----------------|-------|--------|
| Triage | `triage_results` | `files.triage_metadata` | Resume from triage if domain agents fail |
| Domain Analysis | `*_findings` | `findings` (status: `interim`) | Preserve domain work if synthesis fails |
| Synthesis | `synthesis_results` | `findings` (status: `synthesized`) | Preserve cross-references if KG fails |
| Knowledge Graph | `knowledge_graph` | `knowledge_graphs` | Final output, enables chat |

**Recovery Flow**:
```
IF processing fails at Phase N:
  1. Load last successful phase output from PostgreSQL
  2. Resume from Phase N (not from beginning)
  3. Mark `processing_jobs.errors` with failure context
  4. Emit SSE: PARTIAL_COMPLETE with completed phases
```

### 4.4 Agent Definitions

| Agent | Model | Thinking Level | Role | Output Key |
|-------|-------|---------------|------|------------|
| **Orchestrator** | Gemini 3 Pro | `medium` | Pipeline control, file routing, agent spawning | `file_assignments`, `domain_config` |
| **Triage** | Gemini 3 Flash | `low` | Quick classification, domain scoring per file | `triage_results` |
| **Financial Domain** | Gemini 3 Pro | `high` | Financial pattern analysis on assigned files | `financial_findings` |
| **Legal Domain** | Gemini 3 Pro | `high` | Statute/precedent analysis on assigned files | `legal_findings` |
| **Strategy Domain** | Gemini 3 Pro | `high` | Tactical analysis on assigned files | `strategy_findings` |
| **Synthesis** | Gemini 3 Pro | `high` | Cross-modal linking, contradiction detection, gap analysis | `synthesis_results` |
| **Knowledge Graph** | Gemini 3 Pro | `medium` | Entity resolution, graph construction | `knowledge_graph` |
| **Chat** | Gemini 3 Pro | `medium` | Knowledge-first Q&A with escalation | `chat_response` |
| **Verification** | Gemini 3 Pro | `high` | Validates user corrections against sources | `verification_result` |
| **Merge** | Gemini 3 Pro | `high` | Incremental KG updates, conflict detection | `merge_plan` |

### 4.5 Thinking Mode Configuration

All agents requiring complex reasoning use thinking mode with `include_thoughts=True` for Trace Theater:

| Agent Type | thinking_level | include_thoughts | Rationale |
|-----------|---------------|------------------|----------|
| Orchestrator | `medium` | `true` | Routing decisions visible in Trace Theater |
| Triage | `low` | `false` | Speed over depth |
| Domain Agents | `high` | `true` | Deep analysis, capture reasoning |
| Synthesis | `high` | `true` | Complex cross-referencing |
| Knowledge Graph | `medium` | `true` | Entity resolution reasoning |

### 4.6 Synthesis Agent - WOW Features

The Synthesis Agent is responsible for the platform's key differentiators. Its instruction template includes:

**Cross-Modal Evidence Linking**: 
- Compare timestamps across all findings (video timestamps, document dates, transaction times)
- Flag temporal correlations within configurable windows (e.g., events within 30 minutes)
- Output linked evidence pairs with correlation type and implication

**Contradiction Detection**:
- Extract claims/statements from testimony, depositions, declarations
- Cross-reference against factual evidence (locations, transactions, timestamps)
- Flag contradictions with: claim source, contradicting evidence, severity

**Gap Analysis**:
- Given case context and classification, identify elements needed to prove case
- Compare against available evidence
- Output: what's proven (strong/weak), what's missing, recommended next steps

Output schema for `synthesis_results`:
```
{
  cross_modal_links: [{source_a, source_b, correlation_type, time_delta, implication}],
  contradictions: [{claim, claim_source, evidence_against: [], severity}],
  evidence_gaps: [{element_needed, current_strength, recommendation}]
}
```

### 4.7 Orchestrator Routing & Spawning Logic

The Orchestrator Agent executes this logic after receiving triage results:

```
FUNCTION orchestrator_route_and_spawn(triage_results, case_context):
    // Step 1: Route files to domains based on domain_scores
    file_assignments = {}
    FOR each file IN triage_results.files:
        FOR each domain IN ["financial", "legal", "strategy"]:
            IF file.domain_scores[domain] >= 0.4:  // Threshold for assignment
                file_assignments[domain].append(file.file_id)
    
    // Step 2: Calculate complexity per domain
    domain_complexity = {}
    FOR each domain IN file_assignments:
        domain_complexity[domain] = SUM(
            file.complexity_score FOR file IN domain_files
        )
    
    // Step 3: Determine agent configuration per domain
    domain_config = {}
    FOR each domain IN domain_complexity:
        IF domain_complexity[domain] < 2.0:
            domain_config[domain] = {type: "single", workers: 1}
        ELSE:
            worker_count = CEIL(domain_complexity[domain] / 1.5)
            domain_config[domain] = {
                type: "parallel_with_synthesis",
                workers: worker_count
            }
    
    // Step 4: Write to state for downstream agents
    state["file_assignments"] = file_assignments
    state["domain_config"] = domain_config
    
    // Step 5: Spawn ParallelAgent with configured domain agents
    RETURN build_parallel_agent(domain_config, file_assignments)
```

**Domain Agent Spawning Detail**:
```
FUNCTION build_domain_agent(domain, config, assigned_files):
    IF config.type == "single":
        RETURN LlmAgent(
            name=f"{domain}_agent",
            instruction=DOMAIN_PROMPTS[domain].format(files=assigned_files),
            output_key=f"{domain}_findings"
        )
    ELSE:  // parallel_with_synthesis
        workers = [
            LlmAgent(f"{domain}_worker_{i}", files=chunk)
            FOR i, chunk IN enumerate(split_files(assigned_files, config.workers))
        ]
        RETURN SequentialAgent([
            ParallelAgent(workers),
            LlmAgent(f"{domain}_synthesis", output_key=f"{domain}_findings")
        ])
```

### 4.8 Quality Refinement Loop (Post-PoC Architecture)

The architecture supports adding a `LoopAgent` wrapper around Synthesis for iterative refinement:

```mermaid
graph TB
    subgraph "Future: LoopAgent wrapper"
        SYNTH[Synthesis Agent]
        EVAL[Quality Evaluator<br/>output_schema: QualityAssessment]
        CHECK[BaseAgent: ThresholdChecker<br/>escalate if confidence >= 0.85]
        REFINE[Gap Filler Agent]
        
        SYNTH --> EVAL --> CHECK
        CHECK -->|below threshold| REFINE --> SYNTH
        CHECK -->|above threshold| EXIT[Continue to KG]
    end
```

Max iterations: 2-3 for PoC extension.

### 4.9 Tool Registry

| Tool | Used By | Purpose |
|------|---------|---------|
| `load_file` | All Domain Agents | Load file content from GCS via ToolContext |
| `extract_pdf_tables` | All Domain Agents | Tabular data extraction |
| `extract_video_frames` | All Domain Agents | Key frames with timestamps |
| `transcribe_audio` | All Domain Agents | Speaker-diarized transcription |
| `highlight_image_region` | All Domain Agents | Bounding box annotations |
| `analyze_statistics` | Financial Agent | Anomaly detection in numerical data |
| `search_legal_sources` | Legal Agent | Case law and statute search |
| `query_knowledge_graph` | Chat Agent | Search KG entities, relationships, insights by query |
| `search_findings` | Chat Agent | Search raw domain findings for detailed facts |
| `get_source_context` | Chat, Verification | Retrieve source content at location for citation |
| `escalate_to_domain` | Chat Agent | Transfer to Orchestrator for fresh domain analysis |
| `compare_values` | Verification Agent | Compare original vs. proposed vs. source values |

Tools receive `ToolContext` providing access to:
- `tool_context.state` - Read/write session state
- `tool_context.save_artifact()` - Store processed outputs
- `tool_context.load_artifact()` - Retrieve artifacts
- `tool_context.actions.transfer_to_agent` - Optional agent handoff

### 4.10 ADK Integration with FastAPI

The FastAPI server integrates with ADK Runner for processing:

```mermaid
sequenceDiagram
    participant EP as FastAPI Endpoint
    participant Q as Background Queue
    participant R as ADK Runner
    participant CB as SSE Callback
    participant CL as SSE Client

    EP->>Q: Enqueue processing job
    EP-->>CL: Return 202 + job_id
    Q->>R: runner.run_async()
    
    loop For each agent event
        R->>CB: Callback triggered
        CB->>CL: Emit SSE event
    end
    
    R->>Q: Processing complete
    Q->>EP: Persist results to DB
```

**Key Integration Points**:
1. `Runner` initialized with `DatabaseSessionService` (PostgreSQL) and `GcsArtifactService`
2. Callbacks (`before_agent_callback`, `after_tool_callback`) emit SSE events
3. Processing runs in background task; results persisted on completion
4. Chat uses same Runner with existing session for context continuity

### 4.11 Session and Storage Services

| Service | ADK Component | Purpose |
|---------|--------------|---------|
| Session State | `DatabaseSessionService` | Agent communication during processing (PostgreSQL) |
| Artifacts | `GcsArtifactService` | Processed file outputs, intermediate results |
| Application Data | PostgreSQL (direct) | Cases, files metadata, final graphs, chat history |
| Raw Files | Cloud Storage | Uploaded evidence files |

**Why PostgreSQL over Firestore**: 
- `DatabaseSessionService` requires PostgreSQL - single DB simplifies infrastructure
- JSONB columns handle flexible schemas (findings, graphs)
- Transactional consistency for multi-table updates

### 4.12 Chat Agent Architecture

The Chat Agent provides contextual Q&A over case knowledge using a **knowledge-first with escalation** pattern:

**Design Principles**:
- Primary: Query persisted Knowledge Graph and Findings Store (fast, consistent)
- Secondary: Escalate novel questions to domain agents via Orchestrator (expensive, fresh analysis)
- All responses include source citations linking to Source Panel
- **Streaming responses**: Tokens stream via SSE as they're generated for responsive UX

**Session Sharing**: Chat Agent reuses the same ADK session (`case_{id}`) as processing pipeline, giving it access to all state keys (`knowledge_graph`, `*_findings`, `synthesis_results`).

**Chat History Persistence**:
- Messages stored in PostgreSQL `messages` table (not just ADK session state)
- Each message includes: `role`, `content`, `citations` (JSONB), `thinking_trace` (JSONB)
- Enables chat history retrieval across browser sessions
- ADK session provides runtime context; PostgreSQL provides durable history

**Chat Agent Tools**:

| Tool | Purpose |
|------|--------|
| `query_knowledge_graph` | Search entities, relationships, contradictions, gaps by semantic query + filters (layer, entity type) |
| `search_findings` | Search raw domain findings for detailed facts not fully in graph |
| `get_source_context` | Retrieve exact source content (page, timestamp, bbox) for citation verification |
| `escalate_to_domain` | Triggers `transfer_to_agent` → Orchestrator for questions requiring fresh analysis |

**Escalation Flow**:
```
User asks novel question → Chat Agent determines KG insufficient →
  calls escalate_to_domain(question, domain) →
  transfer_to_agent("Orchestrator") →
  Orchestrator routes to Domain Agent(s) →
  new findings returned → Chat Agent formulates response
```

**Thinking Mode**: `medium` with `include_thoughts=True` for complex queries (visible in Trace Theater).

### 4.13 Verification Agent

Handles user-initiated corrections before they're applied to the knowledge graph:

**Workflow**:
1. User flags error (e.g., "Amount is $3.2M, not $2.34M")
2. Verification Agent receives: `{target_id, original_value, proposed_correction, user_justification}`
3. Agent loads original source file(s) via `get_source_context` tool
4. Agent compares source content against both original and proposed values
5. Outputs: `CONFIRMED` | `REJECTED` | `AMBIGUOUS` with evidence citations

**On CONFIRMED**:
- Creates correction record in `corrections` table
- Triggers Merge Agent for incremental KG update
- Marks affected downstream items as STALE

**On REJECTED/AMBIGUOUS**:
- Returns explanation with source citations to user
- User can provide additional context and retry

### 4.14 Merge Agent

Handles incremental knowledge graph updates for both corrections and new file uploads:

**Responsibilities**:

1. **Entity Resolution**: Match new entities to existing graph nodes
   - Same entity, different mentions → merge with alias
   - Similar but distinct → keep separate, note similarity score

2. **Relationship Merging**: Combine edges from new findings
   - Compatible values → aggregate confidence
   - Conflicting values → **FLAG FOR USER** (never auto-resolve)

3. **Conflict Detection**: Surface contradictions between new and existing
   - Create `contradiction` record with both sources
   - User resolves via: Trust New | Keep Existing | Manual Merge

4. **Incremental Update**: Modify graph surgically
   - Update affected nodes/edges only
   - Mark dependents as STALE (user decides regeneration)

**Output Schema** (`merge_plan`):
```
{
  entities_to_merge: [{new_id, existing_id, merge_confidence}],
  new_entities: [...],
  relationships_to_add: [...],
  conflicts: [{type, existing_source, new_source, severity}],
  stale_items: [item_ids affected by changes]
}
```

### 4.15 New File Processing (Incremental)

When files are added to an existing case:

```
1. Triage Agent → processes NEW files only
2. Orchestrator → routes to Domain Agent(s)
3. Domain Agent(s) → outputs new_findings
4. Merge Agent → compares with existing KG:
   IF no conflicts → incremental KG update
   IF conflicts → surface to user for resolution
5. User resolves conflicts → Merge Agent applies
6. Downstream items marked STALE → user prompted to regenerate
```

**Key Principle**: Conflicts are NEVER auto-resolved. User maintains control over case truth.

---

## 5. Directory Structure

```
legal-lens/
├── README.md
├── pyproject.toml                    # UV workspace root
├── uv.lock                           # Single lockfile
└── Makefile                          # Common commands
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml                # Deploy on main merge
│
├── infrastructure/
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── cloud-sql.tf          # PostgreSQL instance
│   │   ├── cloud-storage.tf
│   │   └── cloud-run.tf
│   └── Dockerfile
│
├── shared/
│   ├── pyproject.toml                # UV workspace member (common lib)
│   └── src/
│       └── legal_lens_shared/
│           ├── __init__.py
│           ├── constants.py          # Shared constants
│           ├── exceptions.py         # Custom exceptions
│           └── types.py              # Shared type definitions
│
├── backend/
│   ├── pyproject.toml                # UV workspace member
│   ├── uv.lock
│   │
│   ├── src/
│   │   └── legal_lens_backend/
│   │       ├── __init__.py
│   │       ├── main.py               # FastAPI entrypoint
│   │       ├── config.py             # Settings & environment
│   │       │
│   │       ├── api/
│   │       │   ├── __init__.py
│   │       │   ├── routes/
│   │       │   │   ├── auth.py           # Auth endpoints (signup, login, OAuth)
│   │       │   │   ├── cases.py          # Case endpoints
│   │       │   │   ├── files.py          # File endpoints
│   │       │   │   ├── chat.py           # Chat endpoints
│   │       │   │   ├── graphs.py         # Knowledge graph endpoints
│   │       │   │   ├── corrections.py    # Correction & conflict endpoints
│   │       │   │   └── events.py     # SSE streaming endpoint
│   │       │   ├── deps.py
│   │       │   └── middleware.py
│   │       │
│   │       ├── agents/
│   │       │   ├── __init__.py
│   │       │   ├── pipeline.py       # SequentialAgent pipeline builder
│   │       │   ├── orchestrator/
│   │       │   │   ├── __init__.py
│   │       │   │   ├── agent.py          # OrchestratorAgent
│   │       │   │   ├── router.py         # File routing logic
│   │       │   │   └── spawner.py        # Dynamic agent spawning
│   │       │   ├── triage/
│   │       │   │   ├── __init__.py
│   │       │   │   └── agent.py          # TriageAgent
│   │       │   ├── domains/
│   │       │   │   ├── __init__.py
│   │       │   │   ├── base.py
│   │       │   │   ├── financial.py
│   │       │   │   ├── legal.py
│   │       │   │   └── strategy.py
│   │       │   ├── synthesis/
│   │       │   │   ├── __init__.py
│   │       │   │   └── agent.py          # SynthesisAgent - Cross-modal, contradictions, gaps
│   │       │   ├── knowledge_graph/
│   │       │   │   ├── __init__.py
│   │       │   │   └── agent.py          # KnowledgeGraphAgent
│   │       │   ├── chat/
│   │       │   │   ├── __init__.py
│   │       │   │   ├── agent.py          # ChatAgent - Knowledge-first Q&A
│   │       │   │   └── tools.py          # query_knowledge_graph, search_findings, etc.
│   │       │   ├── verification/
│   │       │   │   ├── __init__.py
│   │       │   │   └── agent.py          # VerificationAgent - Validates corrections
│   │       │   ├── merge/
│   │       │   │   ├── __init__.py
│   │       │   │   └── agent.py          # MergeAgent - Incremental KG updates
│   │       │   ├── callbacks.py      # SSE emitter callbacks
│   │       │   └── runner.py         # Runner factory with services
│   │       │
│   │       ├── tools/
│   │       │   ├── __init__.py
│   │       │   ├── file_tools.py
│   │       │   ├── analysis_tools.py
│   │       │   └── search_tools.py
│   │       │
│   │       ├── services/
│   │       │   ├── __init__.py
│   │       │   ├── case_service.py
│   │       │   ├── file_service.py
│   │       │   ├── processing_service.py  # Triggers ADK runner
│   │       │   ├── graph_service.py
│   │       │   ├── chat_service.py
│   │       │   └── correction_service.py  # Verification & merge orchestration
│   │       │
│   │       ├── repositories/
│   │       │   ├── __init__.py
│   │       │   ├── base.py
│   │       │   ├── case_repository.py
│   │       │   ├── file_repository.py
│   │       │   ├── correction_repository.py
│   │       │   ├── finding_repository.py
│   │       │   └── graph_repository.py
│   │       │
│   │       ├── models/
│   │       │   ├── __init__.py
│   │       │   ├── case.py
│   │       │   ├── file.py
│   │       │   ├── finding.py
│   │       │   ├── graph.py
│   │       │   └── events.py
│   │       │
│   │       └── db/
│   │           ├── __init__.py
│   │           └── database.py       # SQLAlchemy async setup
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── cases/
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [caseId]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── layout.tsx
│   │   │   └── api/
│   │   │
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── cases/
│   │   │   ├── files/
│   │   │   ├── visualizations/
│   │   │   │   ├── agent-flow/           # Essentially the Agent decision graph
│   │   │   │   │   ├── AgentFlow.tsx
│   │   │   │   │   ├── AgentNode.tsx    # Shows thinking trace on expand
│   │   │   │   │   └── AgentEdge.tsx
│   │   │   │   ├── knowledge-graph/
│   │   │   │   │   ├── GraphView.tsx
│   │   │   │   │   ├── GraphNode.tsx
│   │   │   │   │   ├── GraphControls.tsx
│   │   │   │   │   └── InsightPanel.tsx  # Contradictions, gaps, links
│   │   │   │   ├── timeline/
│   │   │   │   └── source-panel/
│   │   │   │       ├── PDFViewer.tsx
│   │   │   │       ├── VideoPlayer.tsx
│   │   │   │       ├── AudioPlayer.tsx
│   │   │   │       └── ImageViewer.tsx
│   │   │   └── chat/
│   │   │       ├── ChatPanel.tsx
│   │   │       ├── ChatMessage.tsx
│   │   │       └── CitationLink.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useSSE.ts             # SSE subscription hook
│   │   │   ├── useCase.ts
│   │   │   ├── useChat.ts
│   │   │   └── useKnowledgeGraph.ts
│   │   │
│   │   ├── stores/
│   │   │   ├── caseStore.ts          # Zustand store
│   │   │   ├── fileStore.ts
│   │   │   ├── graphStore.ts
│   │   │   ├── chatStore.ts
│   │   │   ├── agentStore.ts
│   │   │   └── streamStore.ts        # SSE event store
│   │   │
│   │   ├── lib/
│   │   │   ├── apiClient.ts                # API client (generated)
│   │   │   ├── sseClient.ts
│   │   │   └── utils.ts
│   │   │
│   │   └── types/
│   │       ├── api.ts
│   │       ├── graph.ts
│   │       └── events.ts
│   │
│   └── public/
│
└── scripts/
    ├── setup-gcp.sh
    ├── deploy.sh
    └── generate-types.sh
```

---

## 6. Data Schema (PostgreSQL)

### 6.1 Entity Relationship Diagram

> **NOTE 1**: **Auth Tables**: Managed by Better Auth (TypeScript). Python backend reads these tables but does not write to them. Tables: `user`, `session`, `account`, `verification`.
> - The `user` table schema is managed by Better Auth. 
> - Custom field `username` added via Better Auth's `additionalFields` config.

```mermaid
erDiagram
    users ||--o{ cases : owns
    cases ||--o{ files : contains
    cases ||--o{ findings : has
    cases ||--|| knowledge_graphs : has
    cases ||--o{ chat_sessions : has
    cases ||--o{ processing_jobs : tracks
    files ||--o{ findings : generates
    chat_sessions ||--o{ messages : contains

    cases {
        uuid id PK
        uuid user_id FK
        varchar name
        text description
        varchar status
        timestamp created_at
        timestamp updated_at
    }

    files {
        uuid id PK
        uuid case_id FK
        varchar gcs_path
        varchar filename
        varchar mime_type
        bigint size_bytes
        varchar status
        jsonb triage_metadata
        timestamp created_at
    }

    findings {
        uuid id PK
        uuid case_id FK
        uuid file_id FK
        varchar agent_id
        varchar domain
        jsonb entities
        jsonb relationships
        jsonb source_location
        float confidence
        jsonb cross_modal_links
        timestamp created_at
    }

    knowledge_graphs {
        uuid id PK
        uuid case_id FK
        jsonb nodes
        jsonb edges
        jsonb contradictions
        jsonb evidence_gaps
        jsonb cross_modal_links
        timestamp updated_at
    }

    chat_sessions {
        uuid id PK
        uuid case_id FK
        varchar adk_session_id
        timestamp created_at
    }

    messages {
        uuid id PK
        uuid session_id FK
        varchar role
        text content
        jsonb citations
        jsonb thinking_trace
        timestamp created_at
    }

    processing_jobs {
        uuid id PK
        uuid case_id FK
        varchar status
        jsonb agent_states
        jsonb errors
        timestamp started_at
        timestamp completed_at
    }

    corrections {
        uuid id PK
        uuid case_id FK
        varchar target_type
        uuid target_id
        jsonb original_value
        jsonb corrected_value
        text user_justification
        varchar verification_status
        jsonb verification_evidence
        timestamp created_at
        timestamp applied_at
    }

    findings ||--o{ corrections : receives
    knowledge_graphs ||--o{ corrections : receives
```

**findings table additions**:
```sql
-- Add versioning support to findings
version INT DEFAULT 1
superseded_by UUID REFERENCES findings(id)
status VARCHAR DEFAULT 'active'  -- 'active' | 'superseded' | 'stale'
```

**Chat persistence notes**:
- `chat_sessions` links a case to its ADK session ID for runtime context continuity
- `messages` stores conversation history for retrieval across browser sessions
- `messages.citations` JSONB: `[{file_id, location, excerpt}]` for source linking
- `messages.thinking_trace` JSONB: agent reasoning captured for Trace Theater (optional)

### 6.2 Key JSONB Schemas

**files.triage_metadata**:
```json
{
  "classification": "Evidence|Legal/Statute|Legal/Precedent|Strategy/Playbook|Reference",
  "domain_scores": {"financial": 0.95, "legal": 0.40, "strategy": 0.20},
  "complexity_score": 0.72,
  "page_count": 156,
  "duration_seconds": null,
  "entities_preview": ["John Doe", "Shell Corp LLC"],
  "key_dates": ["2023-03-15", "2023-04-03"]
}
```

**knowledge_graphs.contradictions**:
```json
[
  {
    "id": "contradiction_001",
    "claim": "I was in New York on March 15th",
    "claim_source": {"file_id": "...", "timestamp": "14:32", "speaker": "John Doe"},
    "evidence_against": [
      {"file_id": "...", "description": "Video showing subject in LA at 02:34"},
      {"file_id": "...", "description": "Receipt in LA at 02:41"}
    ],
    "severity": "HIGH"
  }
]
```

**knowledge_graphs.evidence_gaps**:
```json
[
  {
    "element": "Destination of funds after Cayman transfer",
    "current_strength": "MISSING",
    "recommendation": "Subpoena Cayman Islands account records"
  }
]
```

**knowledge_graphs.cross_modal_links**:
```json
[
  {
    "source_a": {"file_id": "...", "type": "video", "timestamp": "02:34:17"},
    "source_b": {"file_id": "...", "type": "image", "location": "receipt timestamp"},
    "correlation_type": "TEMPORAL_PROXIMITY",
    "time_delta_seconds": 420,
    "implication": "Subject made purchase within 7 minutes of warehouse entry"
  }
]
```

---

## 7. API Design

### 7.1 REST Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| **Cases** | | |
| GET | `/api/cases` | List all cases |
| POST | `/api/cases` | Create new case |
| GET | `/api/cases/{id}` | Get case details |
| DELETE | `/api/cases/{id}` | Delete case (cascades) |
| **Files** | | |
| POST | `/api/cases/{id}/files` | Upload files (multipart) |
| GET | `/api/cases/{id}/files` | List case files |
| GET | `/api/files/{id}` | Get file metadata |
| GET | `/api/files/{id}/content` | Get file content (signed URL) |
| DELETE | `/api/files/{id}` | Delete file |
| **Processing** | | |
| POST | `/api/cases/{id}/process` | Trigger processing |
| GET | `/api/cases/{id}/process/status` | Get processing status |
| **Knowledge Graph** | | |
| GET | `/api/cases/{id}/graph` | Get knowledge graph with insights |
| PATCH | `/api/cases/{id}/graph` | Update graph (user corrections) |
| GET | `/api/cases/{id}/timeline` | Get timeline events |
| GET | `/api/cases/{id}/insights` | Get contradictions, gaps, links |
| **Chat** | | |
| POST | `/api/cases/{id}/chat` | Send message, get streaming response (SSE: token chunks + final citations) |
| GET | `/api/cases/{id}/chat/history` | Get persisted chat history from PostgreSQL |
| **Corrections** | | |
| POST | `/api/cases/{id}/correct` | Submit correction for verification |
| GET | `/api/cases/{id}/corrections` | List pending/applied corrections |
| POST | `/api/corrections/{id}/apply` | Apply verified correction |
| DELETE | `/api/corrections/{id}` | Reject/cancel correction |
| **Conflicts** | | |
| GET | `/api/cases/{id}/conflicts` | List unresolved conflicts |
| POST | `/api/conflicts/{id}/resolve` | Resolve conflict (trust_new, keep_existing, manual) |
| **Events** | | |
| GET | `/api/cases/{id}/events` | SSE stream for case |
| **Authentication** | | |
| POST | `/api/auth/signup` | Create account (email/password) |
| POST | `/api/auth/login` | Authenticate, return JWT |
| POST | `/api/auth/google` | Exchange Google OAuth code for JWT |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/me` | Get current user profile |

### 7.2 SSE Event Types

```typescript
type SSEEventType = 
  | "PROCESSING_STARTED"
  | "AGENT_SPAWNED"
  | "AGENT_PROGRESS"
  | "THINKING_UPDATE"      // Agent reasoning trace
  | "TOOL_INVOKED"
  | "AGENT_COMPLETED"
  | "AGENT_ERROR"
  | "INSIGHT_DETECTED"     // Contradiction, gap, or link found
  | "GRAPH_UPDATED"
  | "CHAT_TOKEN"            // Streaming token from Chat Agent
  | "CHAT_COMPLETE"         // Final response with citations
  | "CORRECTION_VERIFIED"   // Verification agent confirmed/rejected
  | "CONFLICT_DETECTED"     // New file conflicts with existing KG
  | "STALE_ITEMS_MARKED"    // Items need regeneration after correction
  | "PROCESSING_COMPLETED"
  | "PROCESSING_FAILED";
```

---

## 8. Error Handling Strategy

### 8.1 Retry Policy

| Component | Retry Count | Backoff | Fallback |
|-----------|-------------|---------|----------|
| Gemini API calls | 3 | Exponential (1s, 2s, 4s) | Mark agent as FAILED, continue others |
| GCS operations | 3 | Linear (500ms) | Fail file, log error |
| PostgreSQL writes | 3 | Exponential | Queue for retry, continue |
| Tool executions | 2 | None | Return partial result, log |

### 8.1.1 Retry Handling Pseudocode

```
RETRY_CONFIG:
  max_attempts: 3
  backoff: exponential (1s, 2s, 4s)

ON_AGENT_FAILURE(agent, error):
  1. Log error with full context (agent_id, input, traceback)
  2. FOR attempt IN 1..max_attempts:
       result = retry_agent(agent)
       IF success: RETURN result
       WAIT backoff[attempt]
  3. IF still failing:
       - Mark files processed by agent as PARTIAL
       - Persist any partial findings to PostgreSQL
       - Emit SSE: AGENT_ERROR with details
       - Continue with remaining agents in pipeline
  4. User can manually retry failed items via UI

ON_LLM_TIMEOUT(agent, timeout_seconds):
  - Default timeout: 120s for domain agents, 30s for triage
  - On timeout: Retry once with reduced context window if possible
  - If still fails: Mark PARTIAL, emit SSE: AGENT_TIMEOUT

ON_RATE_LIMIT(error):
  - Queue pending requests
  - Apply exponential backoff (30s, 60s, 120s)
  - Prioritize: Chat queries > Active processing > Background tasks
  - Emit SSE: PROCESSING_DELAYED with estimated resume time
```

### 8.2 Error Propagation

```
Agent Error → Orchestrator notified → 
  IF critical (Orchestrator/KG): Mark job FAILED, notify user
  IF non-critical (Domain worker): 
    Mark specific files as PARTIAL
    Continue with remaining agents
    Notify user of partial results
```

### 8.3 Error Categories

| Category | Handling | User Impact |
|----------|----------|-------------|
| `TRANSIENT` | Auto-retry with backoff | None if resolved |
| `FILE_CORRUPT` | Mark file ERROR, skip | User notified, can re-upload |
| `AGENT_TIMEOUT` | Retry once, then PARTIAL | Partial results shown |
| `QUOTA_EXCEEDED` | Pause, notify user | Processing delayed |
| `SYSTEM_ERROR` | Log, alert, fail gracefully | User sees error state |

### 8.4 Error Response Format

All API errors return a consistent JSON structure:

```json
{
  "error": {
    "code": "PROCESSING_FAILED",
    "message": "Failed to process file after 3 attempts",
    "details": {
      "file_id": "abc-123-def",
      "agent_id": "financial_agent",
      "last_error": "LLM timeout after 120s",
      "attempts": 3
    },
    "recoverable": true,
    "suggested_action": "retry"
  }
}
```

**Error codes**: `VALIDATION_ERROR`, `FILE_CORRUPT`, `PROCESSING_FAILED`, `AGENT_TIMEOUT`, `QUOTA_EXCEEDED`, `CONFLICT_DETECTED`, `SYSTEM_ERROR`

### 8.5 Graceful Degradation

| Scenario | Degradation Strategy |
|----------|---------------------|
| Partial file processing | Show results for successful files; clearly mark failed files with retry button |
| Model unavailable | Attempt fallback: Gemini 3 Pro → Gemini 3 Flash for simpler analysis |
| SSE disconnection | Frontend shows "Reconnecting..." with auto-retry (exponential backoff) |
| Stale data | Display last-known-good state with timestamp; show refresh prompt |
| KG build fails | Preserve domain findings; allow access to raw findings without graph visualization |

---

## 9. User Journey Flow

### 9.1 Complete User Journey

```mermaid
flowchart TD
    subgraph Entry["1. Entry"]
        A[Land on Case List] --> B{Has Cases?}
        B -->|No| C[Show Empty State with Create CTA]
        B -->|Yes| D[Display Case Cards with Status]
    end

    subgraph Create["2. Case Creation"]
        C --> E[Click 'New Case']
        D --> E
        E --> F[Enter Case Name + Context]
        F --> G[Upload Evidence Files]
        G --> H[Click 'Process']
    end

    subgraph Processing["3. Processing"]
        H --> I[Agent Flow View Activates]
        I --> J[Watch Triage Phase]
        J --> K[Watch Domain Analysis - Parallel]
        K --> L[Watch Synthesis + KG Building]
        L --> M{Processing Complete?}
        M -->|Error| N[Show Error State + Retry Option]
        M -->|Partial| O[Show Partial Results + Warnings]
        M -->|Success| P[All Views Unlock]
    end

    subgraph Explore["4. Exploration"]
        P --> Q[Knowledge Graph View]
        Q --> R[Click Entity → Expand Details]
        Q --> S[Click Relationship → See Evidence]
        Q --> T[View Contradictions Panel]
        Q --> U[View Evidence Gaps Panel]
        Q --> V[Switch to Timeline View]
        V --> W[Click Event → Source Panel]
        R & S --> X[Source Panel Opens]
        X --> Y[View PDF/Video/Audio at Citation]
    end

    subgraph Chat["5. Chat Interaction"]
        P --> Z[Open Chat Panel]
        Z --> AA[Ask Question]
        AA --> AB[Stream Response with Citations]
        AB --> AC[Click Citation → Source Panel]
        AB --> AD{Spot Error?}
        AD -->|Yes| AE[Flag Correction]
        AE --> AF[Verification Agent Checks]
        AF -->|Confirmed| AG[KG Updated + Stale Items Marked]
        AF -->|Rejected| AH[Show Rejection Reason]
    end

    subgraph Incremental["6. Add More Evidence"]
        P --> AI[Click 'Add Files']
        AI --> AJ[Upload New Files]
        AJ --> AK[Incremental Processing]
        AK --> AL{Conflicts?}
        AL -->|No| AM[Graph Merged Automatically]
        AL -->|Yes| AN[Show Conflict Resolution UI]
        AN --> AO[User Resolves Conflicts]
        AO --> AM
    end

    N --> H
    AG --> Q
    AM --> Q
```

### 9.2 State Diagram

```mermaid
stateDiagram-v2
    [*] --> CaseList: Open App
    
    CaseList --> CreateCase: Click "New Case"
    CaseList --> CommandCenter: Click Existing Case
    
    CreateCase --> UploadFiles: Enter Name + Context
    UploadFiles --> CommandCenter: Start Processing
    
    state CommandCenter {
        [*] --> AgentFlow: Processing Active
        AgentFlow --> KnowledgeGraph: Processing Complete
        KnowledgeGraph --> Timeline: Toggle View
        KnowledgeGraph --> SourcePanel: Click Citation
        KnowledgeGraph --> InsightPanel: View Contradictions/Gaps
        Timeline --> SourcePanel: Click Event
        SourcePanel --> KnowledgeGraph: Close Panel
        
        state ChatPanel {
            [*] --> WaitingForProcessing
            WaitingForProcessing --> ChatReady: Processing Complete
            ChatReady --> Chatting: User Sends Message
            Chatting --> SourcePanel: Click Citation
        }
    }
    
    CommandCenter --> FileLibrary: Click "Files"
    FileLibrary --> CommandCenter: Close Modal
    FileLibrary --> CommandCenter: Upload New Files (triggers re-process)
    
    CommandCenter --> CaseList: Back to Cases
```

### 9.1 View State Matrix

| Processing State | Agent Flow | Knowledge Graph | Timeline | Source Panel | Chat | Insights Panel |
|-----------------|------------|-----------------|----------|--------------|------|----------------|
| PENDING | Disabled | Disabled | Disabled | Disabled | Disabled | Disabled |
| PROCESSING | **Active** | Disabled | Disabled | Disabled | Disabled | Disabled |
| READY | Enabled | **Default** | Enabled | Enabled | **Enabled** | **Enabled** |
| PARTIAL | Enabled | Enabled (warnings) | Enabled | Enabled | Enabled | Enabled |
| ERROR | Enabled (shows errors) | Disabled | Disabled | Disabled | Disabled | Disabled |

---

## 10. Deployment Architecture

### 10.1 GCP Resource Layout

```mermaid
graph TB
    subgraph "GitHub"
        GH[GitHub Repo]
        GA[GitHub Actions<br/>CI/CD Workflows]
    end

    subgraph "GCP Project: legal-lens-prod"
        subgraph "Cloud Run"
            CR[legal-lens-api<br/>Min: 0, Max: 10]
        end
        
        subgraph "Cloud SQL"
            PG[(PostgreSQL 17<br/>db-g1-small)]
        end
        
        subgraph "Cloud Storage"
            GCS[legal-lens-evidence-bucket<br/>Regional: europe-west3]
        end
        
        subgraph "Secret Manager"
            SEC[API Keys<br/>DB Credentials]
        end
    end
    
    GH -->|Push to main| GA
    GA -->|gcloud deploy| CR
    CR --> PG
    CR --> GCS
    CR --> SEC
```

**Why GitHub Actions over Cloud Build**:
- Faster setup - no GCP API enabling or IAM role binding needed
- Better debugging - logs inline in GitHub PR/commit view
- Simpler iteration on workflow files
- Sufficient GCP integration via `google-github-actions/deploy-cloudrun`

### 10.2 Deployment Workflow (Hackathon-Optimized)

Simplified CI/CD prioritizing rapid iteration over ceremony:

```mermaid
flowchart LR
    subgraph Dev["Development"]
        A[Work on features] --> B[Push to development]
        B --> C[Run Linters - ruff, eslint]
        C --> D[Type Check - pyright, tsc]
        D --> E[Build Check]
        E --> A
    end

    subgraph Deploy["Production Deploy"]
        F[Merge development → main] --> G[GitHub Actions triggered]
        G --> H[Deploy to Cloud Run]
        H --> I[Health Check]
        I --> J{Healthy?}
        J -->|Yes| K[Traffic Switch 100%]
        J -->|No| K[Rollback to Previous]
        K --> L[Service live]
    end

    E -->|Ready for prod| F
```

**Branching Strategy**:
- `development` - All feature work happens here, no CI gates
- `main` - Protected, merge triggers production deploy
- No feature branches or PR reviews required (hackathon mode)

**`.github/workflows/deploy.yml`**:
```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      # Source deploy - no Artifact Registry needed
      # Cloud Run builds from source directly
      - uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: legal-lens-api
          region: europe-west3
          source: ./backend
          env_vars: |
            GCS_BUCKET=legal-lens-prod-evidence
            LOG_LEVEL=INFO
          secrets: |
            DATABASE_URL=DATABASE_URL:latest
            GEMINI_API_KEY=GEMINI_API_KEY:latest
```

**Why Source Deploy**:
- No Artifact Registry setup required, although use dockerfiles as required efficiently
- Cloud Run auto-detects Python/Node.js or dockerfile and builds
- Faster iteration: push → deploy in ~2 minutes
- Trade-off: Slightly slower cold starts (acceptable for PoC)

**Local Development**:
```bash
# Backend with hot reload
uv run uvicorn legal_lens_backend.main:app --reload

# Frontend
cd frontend && npm run dev

# ADK agent playground
adk web --agent ./backend/src/legal-lens/agents
```

**GitHub Secrets Required**:
| Secret | Purpose |
|--------|--------|
| `WIF_PROVIDER` | Workload Identity Federation provider |
| `WIF_SERVICE_ACCOUNT` | GCP service account for deployment |
| `GCP_PROJECT_ID` | Project ID for gcloud commands |

**Rollback Strategy**: If production breaks, revert the merge commit on `main` and push - triggers redeploy of previous working state.

### 10.3 Environment Configuration

| Variable | Dev (Local) | Prod (Cloud Run) |
|----------|-------------|------------------|
| `DATABASE_URL` | `postgresql+asyncpg://localhost/legal_lens` | From Secret Manager |
| `GCS_BUCKET` | `legal-lens-dev-evidence` | `legal-lens-prod-evidence` |
| `GEMINI_API_KEY` | From .env | From Secret Manager |
| `ADK_SESSION_DB` | Same as DATABASE_URL | Same as DATABASE_URL |
| `ALLOWED_ORIGINS` | `localhost:3000` | `https://legal-lens.app` |
| `LOG_LEVEL` | `DEBUG` | `INFO` |

---

## 11. Future Extensibility Points

### 11.1 Quality Refinement Loop (Post-PoC Priority)

Add `LoopAgent` wrapper around Synthesis phase:
- Quality evaluator scores confidence (0-1)
- Threshold checker escalates if confidence ≥ 0.85
- Gap filler addresses low-confidence areas
- Max 2-3 iterations

### 11.2 Judge Simulation (Planned)

**Integration Points**:
- New agent: `JudgeSimulationAgent` in `agents/`
- New table: `judge_profiles` with verdict history
- New API endpoint: `/api/cases/{id}/simulate/judge`
- Knowledge graph gains "SIMULATION" layer

### 11.3 External Integrations (Future)

| Integration | Extension Point | Notes |
|-------------|----------------|-------|
| Gmail Import | `services/import_service.py` | OAuth flow, email parsing |
| Google Drive | `services/import_service.py` | File picker, sync |
| Export (DOCX/PDF) | `services/export_service.py` | Template-based generation |
| Multi-user | Add `users` table, modify queries | Auth layer needed |

### 11.4 Modular Agent System

New domain agents added by:
1. Create agent in `agents/domains/new_domain.py` with `output_key`
2. Add to `ParallelAgent` in `pipeline.py`
3. Update Synthesis agent instruction to include `{new_domain_findings}`

---

## 12. Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| File Upload | < 30s for 500MB | P95 latency |
| Triage (per file) | < 10s | P95 latency |
| Full Processing | < 5min for 50 files | P95 latency |
| Chat Response | < 3s (streaming start) | P95 latency |
| SSE Latency | < 500ms | P95 latency |
| Availability | 99% | Uptime monitoring |
| Data Durability | 99.99% | GCS + Cloud SQL SLA |

---

## 13. Security Considerations (PoC Scope)

| Aspect | PoC Approach | Production Note |
|--------|--------------|-----------------|
| Authentication | Email/password + Google OAuth + JWT | Production-ready |
| Authorization | None | Add RBAC |
| Data Encryption | GCP default (at rest + transit) | Sufficient |
| File Validation | MIME type + size check | Add virus scanning |
| API Rate Limiting | None | Add Cloud Armor |
| Secrets | Secret Manager | ✓ Production-ready |
| SQL Injection | SQLAlchemy ORM | ✓ Protected |

---

## 14. Open Decisions / Assumptions

1. **Assumed**: Gemini 3 Pro/Flash preview APIs are stable enough for PoC
2. **Assumed**: 1M token context sufficient for largest expected files
3. **Decided**: PostgreSQL for all persistent storage (simplifies infrastructure)
4. **Decided**: SSE over WebSocket for real-time updates (simpler, sufficient for use case)
5. **Decided**: `DatabaseSessionService` for ADK sessions (PostgreSQL-backed)
6. **Assumed**: Single Cloud Run instance handles concurrent processing (scale if needed)

---

## 15. Appendix A: Technology Versions

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| **Frontend** | | | |
| Framework | Next.js | 16.x | App Router |
| UI Library | React | 19.x | Server Components |
| Styling | TailwindCSS | 4.x | |
| State Management | Zustand | 5.x | |
| Graph Visualization | D3.js | 7.9.x | Knowledge graph |
| Flow Visualization | React Flow | Latest | Agent Flow |
| Type Generation | Hey API | Latest | OpenAPI → TypeScript |
| **Backend** | | | |
| Framework | FastAPI | 0.121+ | Async, OpenAPI |
| Agent Orchestration | Google ADK | Latest | LlmAgent, ParallelAgent, etc. |
| ORM | SQLAlchemy | 2.x | Async support |
| Validation | Pydantic | 2.x | |
| Auth | Better Auth | Latest | Runs in Next.js API routes, shared PostgreSQL |
| **AI Models** | | | |
| Primary | Gemini 3 Pro | Preview | Complex reasoning |
| Fast | Gemini 3 Flash | Preview | Triage, simple tasks |
| **Infrastructure** | | | |
| Database | Cloud SQL PostgreSQL | 15 | JSONB for flexible schemas |
| File Storage | Cloud Storage | - | Regional: europe-west3 |
| Compute | Cloud Run | Gen 2 | 300s timeout |
| Secrets | Secret Manager | - | API keys, DB credentials |
| CI/CD | GitHub Actions | - | Workload Identity Federation |
| **Languages** | | | |
| Backend | Python | 3.13.x | UV for package management |
| Frontend | TypeScript | 5.9.x | Strict mode |
| Monorepo | UV Workspaces | Latest | Single lockfile |

---

## 16. Appendix B: Glossary

| Term | Definition |
|------|------------|
| **ADK** | Agent Development Kit - Google's framework for building AI agents |
| **Agent Flow** | UI visualization showing agent execution flow, reasoning, and decision transparency |
| **Contradiction** | Conflicting information detected across evidence sources (e.g., alibi vs. location proof) |
| **Domain Agent** | Specialized agent for a specific analysis domain (Financial, Legal, Strategy) |
| **Evidence Gap** | Missing information needed to prove/disprove a case element |
| **Finding** | Structured output from a domain agent's analysis of evidence |
| **Knowledge Graph** | Entity-relationship graph synthesized from all processed evidence |
| **Merge Agent** | Agent responsible for incremental KG updates and conflict detection |
| **Orchestrator** | Central LlmAgent that routes files, spawns domain agents, and coordinates pipeline |
| **output_key** | ADK mechanism for agents to write results to shared session state |
| **ParallelAgent** | ADK agent type that runs sub-agents concurrently |
| **SequentialAgent** | ADK agent type that runs sub-agents in order |
| **Source Panel** | UI component displaying original evidence (PDF, video, audio) at cited location |
| **SSE** | Server-Sent Events - unidirectional streaming from server to client |
| **STALE** | Status indicating data may be outdated due to corrections or new evidence |
| **Synthesis** | Cross-referencing findings across domains to find links, contradictions, gaps |
| **Triage** | Initial fast classification of files by domain relevance and complexity |
| **Verification Agent** | Agent that validates user corrections against original source material |

---

*Document Version: 2.0*  
*Last Updated: January 2026*  
*Status: Ready for Development*