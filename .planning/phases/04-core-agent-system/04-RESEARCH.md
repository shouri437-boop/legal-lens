# Phase 4: Core Agent System - Research

**Researched:** 2026-02-02
**Domain:** Google ADK (Agent Development Kit), Gemini 3 models, agent infrastructure
**Confidence:** MEDIUM-HIGH (verified with official docs, some areas need runtime validation)

## Summary

This research covers establishing Google ADK infrastructure with PostgreSQL session storage, GCS artifact storage, and implementing the Triage and Orchestrator agents. The ADK ecosystem is mature with solid documentation, though some limitations require workarounds.

Key findings:
- **DatabaseSessionService** works with PostgreSQL via asyncpg driver but has schema migration considerations
- **GcsArtifactService** provides built-in versioning ideal for audit trails
- **Gemini 3 Flash/Pro** models use `thinking_level` parameter (not `thinking_budget`)
- **Single parent constraint** requires factory pattern for reusable agent logic
- **Callback system** provides 6 hooks for SSE event mapping
- **State scopes** (`user:`, `app:`, `temp:`) enable proper namespacing

**Primary recommendation:** Use google-adk (>=1.22.0) with PostgreSQL via asyncpg, implement **stage-isolated invocations** (fresh Runner per pipeline stage) for context isolation, use **tiered file handling** (inline ≤100MB, File API >100MB up to 2GB), and map ADK callbacks to SSE events for real-time visualization.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-adk | >=1.22.0 | Agent orchestration framework | Official Google ADK, bi-weekly releases, production-ready |
| google-genai | (bundled) | Gemini API client | Required by ADK for LLM calls |
| asyncpg | latest | PostgreSQL async driver | Required for DatabaseSessionService async operations |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| google-cloud-storage | >=2.19.0 | GCS operations | Already in codebase, used by GcsArtifactService internally |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DatabaseSessionService | InMemorySessionService | In-memory loses data on restart, but supports tool confirmation |
| DatabaseSessionService | VertexAiSessionService | Requires Agent Engine migration, adds complexity |
| PostgreSQL (asyncpg) | SQLite | SQLite doesn't support concurrent writes well at scale |

**Installation:**
```bash
# Add to backend/pyproject.toml dependencies
pip install google-adk>=1.22.0 asyncpg
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── agents/                    # Agent definitions
│   ├── __init__.py
│   ├── base.py               # Base agent configurations, callbacks
│   ├── factory.py            # Agent factory (fresh instances per workflow)
│   ├── triage.py             # Triage Agent implementation
│   └── orchestrator.py       # Orchestrator Agent implementation
├── services/
│   ├── adk_service.py        # ADK Runner, session service initialization
│   ├── agent_events.py       # Callback-to-SSE event mapping
│   └── file_service.py       # (existing)
├── models/
│   ├── agent_execution.py    # SQLAlchemy models for execution logging
│   └── ...
└── api/
    ├── agents.py             # Agent execution endpoints
    └── sse.py                # (existing, extend for agent events)
```

### Pattern 1: Agent Factory Pattern with BuiltInPlanner
**What:** Create fresh agent instances per workflow execution using BuiltInPlanner for thinking config
**When to use:** Always, due to ADK's single parent constraint
**Example:**
```python
# Source: ADK single parent constraint documentation + Gemini 3 thinking docs
from google.adk.agents import LlmAgent
from google.adk.planners import BuiltInPlanner
from google.genai.types import ThinkingConfig
from app.config import get_settings

settings = get_settings()

def create_thinking_planner(level: str = "high") -> BuiltInPlanner:
    """Create a BuiltInPlanner with Gemini 3 thinking configuration.

    Valid levels for Gemini 3:
    - "minimal": Minimizes latency; thinking likely off except complex coding
    - "low": Minimizes latency/cost for simple tasks
    - "medium": Balanced (Flash only)
    - "high": Default; maximizes reasoning (user requested HIGH for all agents)
    """
    return BuiltInPlanner(
        thinking_config=ThinkingConfig(
            thinking_level=level,
            include_thoughts=True,
        )
    )

class AgentFactory:
    """Creates fresh agent instances to avoid single-parent violations."""

    @staticmethod
    def create_triage_agent(case_id: str, file_ids: list[str]) -> LlmAgent:
        """Create a fresh Triage Agent instance."""
        return LlmAgent(
            name=f"triage_{case_id}",
            model=settings.gemini_flash_model,  # Configurable via env
            instruction=TRIAGE_SYSTEM_PROMPT.format(case_id=case_id),
            planner=create_thinking_planner("high"),  # User requested HIGH
            output_key="triage_result",
        )

    @staticmethod
    def create_orchestrator_agent(
        case_id: str,
        triage_results: dict,
        sub_agents: list[LlmAgent]
    ) -> LlmAgent:
        """Create a fresh Orchestrator Agent instance."""
        return LlmAgent(
            name=f"orchestrator_{case_id}",
            model=settings.gemini_pro_model,  # Configurable via env
            instruction=ORCHESTRATOR_SYSTEM_PROMPT,
            planner=create_thinking_planner("high"),  # User requested HIGH
            sub_agents=sub_agents,
            output_key="orchestrator_result",
        )
```

### Pattern 2: ADK Runner Initialization
**What:** Initialize ADK with DatabaseSessionService and GcsArtifactService
**When to use:** At application startup / per-request
**Example:**
```python
# Source: ADK documentation
from google.adk import Runner
from google.adk.sessions import DatabaseSessionService
from google.adk.artifacts import GcsArtifactService

# PostgreSQL connection (asyncpg driver)
DATABASE_URL = "postgresql+asyncpg://user:pass@host:5432/dbname"

# Initialize services
session_service = DatabaseSessionService(db_url=DATABASE_URL)
artifact_service = GcsArtifactService(bucket_name="legal-lens-artifacts")

# Create runner with services
runner = Runner(
    agent=root_agent,
    session_service=session_service,
    artifact_service=artifact_service,
    app_name="legal-lens",
)
```

### Pattern 3: Callback-to-SSE Event Mapping
**What:** Convert ADK callbacks to SSE events for real-time visualization
**When to use:** For Agent Flow UI updates
**Example:**
```python
# Source: ADK callbacks documentation
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmRequest, LlmResponse
from typing import Optional
import json

async def publish_agent_event(case_id: str, event_type: str, data: dict):
    """Publish agent event to SSE subscribers."""
    # Reuse existing SSE pubsub pattern from sse.py
    await publish_agent_sse_event(case_id, event_type, data)

def create_before_agent_callback(case_id: str):
    """Factory for before_agent callback with case context."""
    def before_agent(ctx: CallbackContext) -> Optional[Content]:
        asyncio.create_task(publish_agent_event(
            case_id,
            "AGENT_SPAWNED",
            {
                "agent_name": ctx.agent_name,
                "timestamp": datetime.utcnow().isoformat(),
                "model": getattr(ctx, 'model', 'unknown'),
            }
        ))
        return None  # Continue execution
    return before_agent

def create_after_agent_callback(case_id: str):
    """Factory for after_agent callback with case context."""
    def after_agent(ctx: CallbackContext) -> Optional[Content]:
        asyncio.create_task(publish_agent_event(
            case_id,
            "AGENT_COMPLETED",
            {
                "agent_name": ctx.agent_name,
                "timestamp": datetime.utcnow().isoformat(),
                "output_preview": str(ctx.session_state.get(f"{ctx.agent_name}_result", ""))[:500],
            }
        ))
        return None
    return after_agent

def create_before_model_callback(case_id: str):
    """Factory for before_model callback - captures thinking."""
    def before_model(ctx: CallbackContext, request: LlmRequest) -> Optional[LlmResponse]:
        asyncio.create_task(publish_agent_event(
            case_id,
            "THINKING_UPDATE",
            {
                "agent_name": ctx.agent_name,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "reasoning",
            }
        ))
        return None
    return before_model
```

### Pattern 4: Stage-Isolated Session Architecture
**What:** Create a fresh ADK session per pipeline stage to prevent context window bloat
**When to use:** Always for Legal Lens analysis pipeline (Triage → Orchestrator → Domain → Synthesis)
**Why:** In ADK, agents within a SequentialAgent share session events/history. A 500MB video
processed by Triage (consuming ~500K tokens) would remain in session history and bloat the
Orchestrator's context. Stage isolation gives each agent a fresh 1M token context window.

**Source:** [Google Developers Blog: Architecting efficient context-aware multi-agent framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)

**Example:**
```python
# Source: ADK sessions + context engineering blog
import hashlib
from uuid import UUID
from google.adk.sessions import DatabaseSessionService, Session

def create_session_id(case_id: UUID, workflow_id: UUID, stage: str) -> str:
    """Create a deterministic session ID per pipeline stage.

    Each stage gets a FRESH session to prevent context window bloat.
    The stage parameter isolates Triage, Orchestrator, Domain, Synthesis.
    """
    composite = f"{case_id}:{workflow_id}:{stage}"
    return hashlib.sha256(composite.encode()).hexdigest()[:64]

async def get_or_create_stage_session(
    session_service: DatabaseSessionService,
    app_name: str,
    user_id: str,
    case_id: UUID,
    workflow_id: UUID,
    stage: str,
    initial_state: dict | None = None,
) -> Session:
    """Idempotent session creation for a pipeline stage.

    Each stage gets a clean session with only the data it needs.
    Inter-stage data flows via database, not session state.
    """
    session_id = create_session_id(case_id, workflow_id, stage)

    existing = await session_service.get_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session_id
    )
    if existing:
        return existing

    return await session_service.create_session(
        app_name=app_name,
        user_id=user_id,
        session_id=session_id,
        state={
            "case_id": str(case_id),
            "workflow_id": str(workflow_id),
            "stage": stage,
            **(initial_state or {}),
        }
    )
```

**Stage-Isolated Session Architecture for Legal Lens:**
```
┌──────────────────────────────────────────────────────────────────┐
│                  WORKFLOW CONTROLLER (Python code)                │
│         Inter-stage data flows via DATABASE, not session          │
│                                                                  │
│  Stage 1: TRIAGE          → Session A (fresh, ephemeral)         │
│    Input:  File API URIs (multimodal Parts)                      │
│    Output: TriageOutput JSON → stored in agent_executions table  │
│    Context: ONLY files + prompt (full 1M window available)       │
│                                                                  │
│  Stage 2: ORCHESTRATOR    → Session B (fresh, ephemeral)         │
│    Input:  TriageOutput JSON from DB (text only, ~10-50K tokens) │
│    Output: RoutingDecisions → stored in agent_executions table   │
│    Context: Lightweight, NO file content                         │
│                                                                  │
│  Stage 3: DOMAIN AGENTS   → Sessions C1..Cn (fresh, parallel)   │
│    Input:  Assigned file URIs + triage context per agent         │
│    Output: DomainAnalysis → stored in agent_executions table     │
│    Context: Each gets full 1M window with ONLY its files         │
│                                                                  │
│  Stage 4: SYNTHESIS       → Session D (fresh, ephemeral)         │
│    Input:  All domain outputs from DB (JSON, no files)           │
│    Output: Final Report → stored in agent_executions table       │
│    Context: Structured results only, compact                     │
└──────────────────────────────────────────────────────────────────┘
```

**Why not a single SequentialAgent for the whole pipeline?**
- ADK SequentialAgent shares session events across sub-agents
- File content (video, audio, images) in Triage events would bloat Orchestrator context
- A single 500MB video = ~473K tokens, consuming half the context window
- Multiple large files would easily exceed 1M tokens
- Stage isolation guarantees each agent gets a fresh 1M context window

**Where ADK SequentialAgent/ParallelAgent IS used:**
- WITHIN a stage (e.g., ParallelAgent for concurrent domain agents in Stage 3)
- NOT across stages (our Python code orchestrates stage transitions)

### Pattern 5: State Namespacing
**What:** Use state scope prefixes for proper data isolation
**When to use:** Always when storing data in session state
**Example:**
```python
# Source: ADK state documentation
# Session state keys follow: {user_id}_{case_id}_{workflow_id} namespace

# No prefix: Current session only (case-specific)
session.state["triage_result"] = triage_output
session.state["domain_scores"] = {"financial": 0.8, "legal": 0.6}

# user: prefix: Persists across all sessions for this user
session.state["user:investigator_preferences"] = {"default_model": "pro"}

# app: prefix: Global application state
session.state["app:system_config"] = {"max_parallel_agents": 5}

# temp: prefix: Current invocation only (discarded after)
session.state["temp:intermediate_analysis"] = partial_result
```

### Anti-Patterns to Avoid
- **Reusing agent instances:** Each workflow needs fresh instances (single parent rule)
- **Using tools + output_schema together:** Split into tool-agent then schema-agent pipeline
- **Lowering temperature:** Gemini 3 requires temperature=1.0 (causes looping otherwise)
- **Using `thinking_budget` with Gemini 3:** Use `thinking_level` instead (`thinking_budget` is valid for Gemini 2.5 only)
- **Using generate_content_config for thinking:** Prefer `BuiltInPlanner` with `ThinkingConfig` for proper ADK integration
- **Synchronous database operations:** ADK is async-first, use asyncpg not psycopg2
- **Using gs:// URIs with AI Studio:** Only works with Vertex AI; use inline data (≤100MB) or File API (>100MB) instead
- **Using GEMINI_API_KEY:** ADK expects `GOOGLE_API_KEY` environment variable
- **Sharing one session across pipeline stages:** File content in Triage events bloats Orchestrator's context; use stage-isolated sessions
- **Using SequentialAgent for the entire pipeline:** Context window bloat from multimodal files; orchestrate stages via Python code instead
- **Using compaction for pipeline workflows:** Compaction is for iterative chat agents; pipeline agents don't need it (each stage is a single invocation)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session persistence | Custom session DB | ADK DatabaseSessionService | Handles schema, migrations, state scoping |
| Artifact versioning | Custom versioning | ADK GcsArtifactService | Auto-versioning, proper path structure |
| Agent orchestration | Custom workflow engine | ADK SequentialAgent/ParallelAgent | Deterministic, tested, handles state |
| Model thinking traces | Custom thinking parser | `include_thoughts=True` | ADK extracts and provides in response |
| Token counting | Manual token estimation | ADK `usage_metadata` on events | Accurate counts per turn |
| State scoping | Custom key prefixes | ADK `user:`/`app:`/`temp:` prefixes | Built-in persistence semantics |

**Key insight:** ADK provides battle-tested infrastructure for agent systems. Custom solutions will inevitably miss edge cases around state persistence, parent-child relationships, and async execution.

## Common Pitfalls

### Pitfall 1: Single Parent Violation
**What goes wrong:** `ValueError` when adding same agent instance to multiple parents
**Why it happens:** ADK enforces single parent rule to prevent ambiguous hierarchies
**How to avoid:** Use factory pattern to create fresh instances per workflow
**Warning signs:** "Agent already has a parent" error messages

### Pitfall 2: Tool Confirmation with DatabaseSessionService
**What goes wrong:** `require_confirmation` on tools silently fails
**Why it happens:** Tool confirmation only works with InMemorySessionService
**How to avoid:** Implement confirmation dialogs in frontend instead (already in CONTEXT.md as user-decided autonomous operation)
**Warning signs:** Tools execute without expected confirmation pause

### Pitfall 3: Schema Migration on ADK Upgrade
**What goes wrong:** Database errors after upgrading google-adk version
**Why it happens:** ADK 1.14.0, 1.17.0, 1.22.0 had schema changes
**How to avoid:** Run `adk migrate session` after upgrades (use sync driver for migration), or manually apply ALTER statements
**Warning signs:** Column not found errors, foreign key violations

### Pitfall 4: Gemini 3 Temperature Setting
**What goes wrong:** Model enters infinite loops
**Why it happens:** Gemini 3 requires temperature=1.0; lower values cause unexpected behavior
**How to avoid:** Don't override temperature in generate_content_config
**Warning signs:** Agent produces repetitive output, hangs

### Pitfall 5: after_agent_callback Not Called
**What goes wrong:** Callback never fires even though agent completed
**Why it happens:** Breaking loop after `event.is_final_response()` prevents callback
**How to avoid:** Use `adk run` patterns or ensure full event processing
**Warning signs:** "AGENT_COMPLETED" SSE events never sent

### Pitfall 6: State Updates Not Visible Immediately
**What goes wrong:** State changes made in tool not visible to subsequent code
**Why it happens:** State updates only commit after Event is yielded and processed
**How to avoid:** Return tool results before yielding next event
**Warning signs:** State appears empty even after setting values

### Pitfall 7: PostgreSQL AsyncPG Migration
**What goes wrong:** `adk migrate session` fails with greenlet error
**Why it happens:** Migration command uses sync SQLAlchemy but asyncpg is async-only
**How to avoid:** Use `postgresql+psycopg2://` for migrations, `postgresql+asyncpg://` for runtime
**Warning signs:** "greenlet_spawn has not been called" error

## Code Examples

Verified patterns from official sources:

### DatabaseSessionService with PostgreSQL
```python
# Source: ADK documentation + github issues
from google.adk.sessions import DatabaseSessionService

# For runtime (async operations)
session_service = DatabaseSessionService(
    db_url="postgresql+asyncpg://user:password@localhost:5432/legal_lens"
)

# For migrations (run separately with sync driver)
# adk migrate session --db-url="postgresql+psycopg2://user:password@localhost:5432/legal_lens"
```

### GcsArtifactService Setup
```python
# Source: ADK artifacts documentation
from google.adk.artifacts import GcsArtifactService

artifact_service = GcsArtifactService(
    bucket_name="legal-lens-artifacts",
    # bucket_name must exist, ADK doesn't create it
)

# Usage in tools via context
async def save_analysis_result(context: ToolContext, data: dict):
    """Save analysis result as artifact."""
    artifact = types.Part.from_bytes(
        data=json.dumps(data).encode(),
        mime_type="application/json"
    )
    version = await context.save_artifact("analysis_result.json", artifact)
    return {"saved_version": version}
```

### Thinking Configuration for Gemini 3 (Using BuiltInPlanner)
```python
# Source: Gemini 3 Developer Guide + ADK docs
# IMPORTANT: Gemini 3 uses `thinking_level`, NOT `thinking_budget` (which is for Gemini 2.5)
from google.adk.agents import LlmAgent
from google.adk.planners import BuiltInPlanner
from google.genai.types import ThinkingConfig

# Per user request: Using HIGH thinking level for all agents
# The BuiltInPlanner approach is the ADK best practice for thinking config

# Triage: Uses Flash for speed, but with HIGH thinking per user request
triage_agent = LlmAgent(
    name="triage",
    model="gemini-3-flash-preview",  # Flash for speed
    instruction="...",
    planner=BuiltInPlanner(
        thinking_config=ThinkingConfig(
            thinking_level="high",  # User requested HIGH for all
            include_thoughts=True,  # Capture for UI
        )
    ),
)

# Orchestrator: Complex routing decisions with Pro model
orchestrator_agent = LlmAgent(
    name="orchestrator",
    model="gemini-3-pro-preview",  # Pro for reasoning
    instruction="...",
    planner=BuiltInPlanner(
        thinking_config=ThinkingConfig(
            thinking_level="high",  # Maximum reasoning
            include_thoughts=True,
        )
    ),
)
```

### Valid thinking_level Values for Gemini 3:
| Level | Description | Use Case |
|-------|-------------|----------|
| `"minimal"` | Minimizes latency; thinking likely off except complex coding | Very simple tasks |
| `"low"` | Minimizes latency/cost for simple tasks | Quick classification |
| `"medium"` | Balanced (Flash only) | Medium complexity |
| `"high"` | Default; maximizes reasoning | Complex analysis (recommended) |

### ParallelAgent for Domain Agents
```python
# Source: ADK parallel agents documentation
from google.adk.agents import ParallelAgent, LlmAgent

# Each sub-agent writes to unique output_key to avoid race conditions
financial_agent = LlmAgent(
    name="financial",
    model="gemini-3-pro-preview",
    output_key="financial_analysis",
    # ...
)

legal_agent = LlmAgent(
    name="legal",
    model="gemini-3-pro-preview",
    output_key="legal_analysis",
    # ...
)

# ParallelAgent executes concurrently
parallel_domain_agents = ParallelAgent(
    name="domain_analysis",
    sub_agents=[financial_agent, legal_agent],
)

# Results accessible via session.state["financial_analysis"], session.state["legal_analysis"]
```

### Token Usage from Events
```python
# Source: ADK token tracking discussions
async for event in runner.run_async(session_id, user_message):
    # Token usage available per event
    if hasattr(event, 'usage_metadata') and event.usage_metadata:
        input_tokens = event.usage_metadata.prompt_token_count
        output_tokens = event.usage_metadata.candidates_token_count
        total_tokens = event.usage_metadata.total_token_count

        # Publish to SSE for UI
        await publish_agent_event(case_id, "TOKEN_USAGE", {
            "agent_name": event.agent_name,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        })
```

### Full Callback Setup on Agent
```python
# Source: ADK callbacks documentation
from google.adk.agents import LlmAgent

agent = LlmAgent(
    name="triage",
    model="gemini-3-flash-preview",
    instruction="...",
    # All 6 callback types
    before_agent_callback=create_before_agent_callback(case_id),
    after_agent_callback=create_after_agent_callback(case_id),
    before_model_callback=create_before_model_callback(case_id),
    after_model_callback=create_after_model_callback(case_id),
    before_tool_callback=create_before_tool_callback(case_id),
    after_tool_callback=create_after_tool_callback(case_id),
)
```

### Multimodal File Processing (Tiered Approach)

Legal Lens handles evidence files up to 500MB across all modalities (PDF, video, audio, images).
A tiered approach handles files based on size:

| Method | File Size | Mechanism | Latency |
|--------|-----------|-----------|---------|
| **Inline data** | ≤100MB | Download from GCS, base64 encode | Fast |
| **File API** | 100MB–2GB | Upload to Gemini File API, get URI | Moderate (upload step) |
| **Chunked** | >context window | Split file, process chunks, merge | Slow (multi-pass) |

**Source:** [Gemini API Files API](https://ai.google.dev/gemini-api/docs/files), [Gemini API File Limits Update (Jan 2026)](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-api-new-file-limits/)

#### Multimodal Token Budget (per 1M Context Window)

| Modality | Token Rate | 500MB Example | Tokens | % of 1M |
|----------|-----------|---------------|--------|---------|
| **Video** | 263 tok/sec | 30-min footage | ~473K | 47% |
| **Audio** | 32 tok/sec | 4-hour recording | ~461K | 46% |
| **Images (high)** | 1,120 tok/img | 450 photos | ~504K | 50% |
| **Images (low)** | 280 tok/img | 1,800 photos | ~504K | 50% |
| **PDF (medium)** | 560 tok/page | 1,800 pages | ~1.0M | 100% |
| **PDF page** | 258 tok/page (image) | Native text: FREE on Gemini 3 | | |

**Gemini 3 `media_resolution` parameter** controls token usage per image/frame:

| Setting | Image tokens | Video frame tokens | Best for |
|---------|-------------|-------------------|----------|
| `low` | 280 | 70 | Quick classification (Triage) |
| `medium` | 560 | 70 | PDFs, general content |
| `high` | 1,120 | 280 | Forensic detail, OCR, fine text (Evidence Agent) |

**Source:** [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)

#### Tier 1: Inline Data (≤100MB)

```python
# Source: Gemini API docs
from google.genai import types
from google.cloud import storage

async def prepare_file_inline(
    gcs_bucket: str,
    storage_path: str,
    mime_type: str
) -> types.Part:
    """Download file from GCS and encode as inline_data.

    Works with both AI Studio (API key) and Vertex AI backends.
    Supports files up to 100MB (increased from 20MB in Jan 2026).
    """
    client = storage.Client()
    bucket = client.bucket(gcs_bucket)
    blob = bucket.blob(storage_path)
    file_bytes = blob.download_as_bytes()

    return types.Part(
        inline_data=types.Blob(
            data=file_bytes,
            mime_type=mime_type
        )
    )
```

#### Tier 2: File API (100MB–2GB)

```python
# Source: Gemini API Files API docs
from google import genai

async def prepare_file_via_api(
    gcs_bucket: str,
    storage_path: str,
    mime_type: str,
    original_filename: str,
) -> types.Part:
    """Upload file to Gemini File API and return reference.

    File API supports up to 2GB per file, 20GB per project.
    Files retained for 48 hours — reusable across multiple agent calls.
    Free to use in all regions where Gemini API is available.
    """
    # Download from GCS to temp file
    client_gcs = storage.Client()
    bucket = client_gcs.bucket(gcs_bucket)
    blob = bucket.blob(storage_path)

    import tempfile, os
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(original_filename)[1]) as tmp:
        blob.download_to_filename(tmp.name)
        tmp_path = tmp.name

    try:
        # Upload to Gemini File API
        genai_client = genai.Client()
        uploaded = genai_client.files.upload(
            file=tmp_path,
            config={"mime_type": mime_type, "display_name": original_filename}
        )

        # Wait for processing (needed for video/audio)
        import asyncio
        while uploaded.state.name == "PROCESSING":
            await asyncio.sleep(2)
            uploaded = genai_client.files.get(name=uploaded.name)

        if uploaded.state.name == "FAILED":
            raise RuntimeError(f"File API processing failed: {uploaded.name}")

        return types.Part(
            file_data=types.FileData(
                file_uri=uploaded.uri,
                mime_type=uploaded.mime_type,
            )
        )
    finally:
        os.unlink(tmp_path)
```

#### Unified File Preparation

```python
# Size threshold for switching from inline to File API
FILE_API_THRESHOLD = 100_000_000  # 100MB

async def prepare_file_for_agent(
    file: CaseFile,
    gcs_bucket: str,
) -> types.Part:
    """Prepare file for Gemini using appropriate method based on size."""
    if file.file_size <= FILE_API_THRESHOLD:
        return await prepare_file_inline(gcs_bucket, file.storage_path, file.mime_type)
    else:
        return await prepare_file_via_api(
            gcs_bucket, file.storage_path, file.mime_type, file.original_filename
        )

async def build_agent_content(
    files: list[CaseFile],
    gcs_bucket: str,
    prompt: str,
) -> types.Content:
    """Build multimodal content for any agent."""
    parts = [types.Part(text=prompt)]

    for f in files:
        parts.append(types.Part(text=f"\n\n--- File: {f.original_filename} (ID: {f.id}) ---"))
        file_part = await prepare_file_for_agent(f, gcs_bucket)
        parts.append(file_part)

    return types.Content(role="user", parts=parts)
```

#### Heavy File Strategy (Approaching Context Window Limits)

For files that approach or exceed the 1M context window:

| File Type | Threshold | Strategy |
|-----------|----------|----------|
| Video | >60 min (~950K tokens) | Segment into 30-min chunks, process sequentially, merge |
| Audio | >8 hours (~920K tokens) | Segment into 4-hr chunks, process sequentially, merge |
| PDF | >1,700 pages (~950K tokens) | Split by page ranges, process in batches, merge |
| Images | >800 high-res (~896K tokens) | Batch into groups, process separately, merge |

The "Heavy File Agent" pattern:
1. Receives ONE file per invocation via File API reference
2. Full 1M context window dedicated to that single file
3. `media_resolution` tuned per modality (high for forensics)
4. For files exceeding context: automatic chunking → parallel chunk processing → merge

#### Video/Audio with Timestamp Metadata

```python
# Source: Gemini API video understanding docs
# For analyzing specific segments of long videos
from google.genai.types import VideoMetadata

video_part = types.Part(
    file_data=types.FileData(file_uri=video_file.uri, mime_type="video/mp4"),
    video_metadata=VideoMetadata(
        start_offset="00:15:00",  # Start at 15 minutes
        end_offset="00:45:00",    # End at 45 minutes
    )
)
```

**Why not gs:// URIs?**
- `gs://` URIs require Vertex AI backend (`GOOGLE_GENAI_USE_VERTEXAI=TRUE`)
- Gemini 3 preview models not available in all Vertex AI regions (europe-west3 has stable but not preview)
- File API is free, works everywhere, supports up to 2GB
- Download + inline/File API works universally with API key auth

**File API Key Facts:**
- Max 2GB per file, 20GB per project
- Files retained 48 hours — reusable across all pipeline stages
- Free in all regions where Gemini API is available
- Returns a URI reference that can be used in multiple `generateContent` calls
- Gemini 3 PDF native text extraction is FREE (only image tokens are charged)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `thinking_budget` | `thinking_level` | Gemini 3 (Dec 2025) | Gemini 3 requires level-based config |
| Manual session storage | DatabaseSessionService | ADK 1.0+ | Built-in persistence, scoping |
| Custom artifact versioning | GcsArtifactService | ADK 1.10+ | Auto-versioning in GCS paths |
| psycopg2 (sync) | asyncpg (async) | ADK 1.10+ | Full async support in ADK |

**Deprecated/outdated:**
- `thinking_budget`: Use `thinking_level` for Gemini 3 models
- `gemini-2.5-*` models: Still work but Gemini 3 is current
- Sync database drivers: ADK is async-first, sync causes issues

## Open Questions

Things that couldn't be fully resolved:

1. **Exact DatabaseSessionService table schemas**
   - What we know: Tables are `sessions`, `events`, `app_states`, `user_states`, `metadata`
   - What's unclear: Exact column definitions (SQLAlchemy generates dynamically)
   - Recommendation: Let ADK create tables, then inspect with `\d tablename` in psql

2. **Token usage in after_agent_callback**
   - What we know: `usage_metadata` available on events
   - What's unclear: Whether total token count is accessible in callback context
   - Recommendation: Accumulate token counts during event iteration, not in callbacks

3. **ADK + existing SQLAlchemy session coexistence**
   - What we know: ADK uses its own SQLAlchemy engine
   - What's unclear: Whether we can share engine/session with existing app
   - Recommendation: Use separate connection pool for ADK to avoid conflicts

4. **Gemini 3 model ID stability**
   - What we know: Current IDs are `gemini-3-flash-preview`, `gemini-3-pro-preview`
   - What's unclear: When `-preview` suffix will be removed
   - Recommendation: Use current IDs, plan for migration when GA

## Gemini 3 Thought Signatures (Important for Function Calls)

From https://ai.google.dev/gemini-api/docs/thought-signatures:

**Gemini 3 requires thought signatures for function calls:**
- First function call in each step MUST include signature
- Signatures must be passed back "exactly as received"
- Official SDKs handle this automatically via chat features

**Impact:** When using tools with Gemini 3, ensure thought signatures are preserved in conversation history. The ADK handles this automatically, but it's worth understanding for debugging purposes.

## Reference Architecture: Stage-Isolated Pipeline with Context Engineering

Based on:
- https://github.com/google/adk-samples/tree/main/python/agents/hierarchical-workflow-automation
- https://github.com/merdandt/SalesShortcut
- [Google: Architecting efficient context-aware multi-agent framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)
- [Google: Sub-agents vs Agent-as-Tools](https://cloud.google.com/blog/topics/developers-practitioners/where-to-use-sub-agents-versus-agents-as-tools)
- [Google: Developer's guide to multi-agent patterns in ADK](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)

### Why Stage-Isolated (Not a Single SequentialAgent)

The adk-samples "cookie delivery" pattern uses a single SequentialAgent because its
sub-agents pass small text data. Legal Lens handles 500MB multimodal evidence files — a
fundamentally different workload. From Google's context engineering blog:

> "Context is a compiled view over a richer stateful system."
> "A context window flooded with irrelevant logs can distract the model."

ADK provides **five mechanisms** for managing context:
1. **Stage-isolated invocations** — fresh session per stage (our primary approach)
2. **Artifacts pattern** — handle-based references, not embedded in context
3. **AgentTool** — sub-agent sees NO prior history, returns result only
4. **Filtering** — deterministic rules to drop/trim context before model call
5. **Compaction** — LLM summarization of older events (last resort, for chat only)

**Compaction is NOT needed for Legal Lens' pipeline** because each stage is a single invocation
with no iterative conversation history to compact.

### ADK Pattern Usage in Legal Lens

| ADK Pattern | Where Used | Why |
|-------------|-----------|-----|
| **Separate Runner invocations** | Between stages (Triage→Orchestrator→Domain→Synthesis) | Full context isolation |
| **ParallelAgent** | Within Stage 3 (concurrent domain agents) | ADK manages parallelism, branch isolation |
| **AgentTool** | Orchestrator calling Research/Discovery (optional) | Stateless, isolated context |
| **output_key + state** | Within a stage (intra-stage communication) | ADK native data passing |
| **SequentialAgent** | Within a domain agent (multi-step analysis) | Ordered sub-steps within one stage |
| **Context Caching** | Same files analyzed by multiple agents | Cost reduction via `ContextCacheConfig` |
| **Artifacts** | Intermediate results, file references | Handle-based, not embedded in context |

### AgentTool for Context-Isolated Sub-Tasks

From [Google Cloud blog](https://cloud.google.com/blog/topics/developers-practitioners/where-to-use-sub-agents-versus-agents-as-tools):

> "An agent as a tool is a self-contained expert agent. The tool runs in its own session
> and cannot access the calling agent's conversation history or state."

This is ideal when the Orchestrator needs to invoke Research/Discovery agents without
sharing its entire context:

```python
from google.adk.tools.agent_tool import AgentTool

# Research agent wrapped as tool — gets isolated context
research_tool = AgentTool(
    agent=research_agent,
    # Orchestrator calls this with focused query,
    # research_agent sees NO prior conversation history
)

orchestrator = LlmAgent(
    name="orchestrator",
    model=settings.gemini_pro_model,
    instruction=ORCHESTRATOR_PROMPT,
    tools=[research_tool],  # Isolated invocation
)
```

### Stage Execution Pattern

```python
# Source: Legal Lens workflow controller (our Python code, not ADK SequentialAgent)

async def run_analysis_pipeline(
    case_id: UUID,
    workflow_id: UUID,
    user_id: str,
    files: list[CaseFile],
):
    """Run the full analysis pipeline with stage-isolated sessions."""

    # --- Stage 1: TRIAGE ---
    triage_session = await get_or_create_stage_session(
        session_service, "legal-lens", user_id, case_id, workflow_id, "triage"
    )
    triage_agent = AgentFactory.create_triage_agent(case_id, [f.id for f in files])
    triage_runner = Runner(
        agent=triage_agent,
        session_service=session_service,
        artifact_service=artifact_service,
        app_name="legal-lens",
    )

    # Build multimodal content (File API for large files, inline for small)
    content = await build_agent_content(files, settings.gcs_bucket, "Analyze these files:")

    triage_output = None
    async for event in triage_runner.run_async(
        user_id=user_id,
        session_id=triage_session.id,
        new_message=content,
    ):
        if event.is_final_response():
            triage_output = parse_triage_output(event)

    # Store in database for next stage
    await save_execution_output(workflow_id, "triage", triage_output)

    # --- Stage 2: ORCHESTRATOR ---
    orch_session = await get_or_create_stage_session(
        session_service, "legal-lens", user_id, case_id, workflow_id, "orchestrator",
        initial_state={"triage_result": triage_output.model_dump()},
    )
    # Orchestrator gets ONLY text (TriageOutput JSON), NO file content!
    orch_agent = AgentFactory.create_orchestrator_agent(case_id, triage_output)
    orch_runner = Runner(agent=orch_agent, ...)

    routing = None
    async for event in orch_runner.run_async(...):
        if event.is_final_response():
            routing = parse_orchestrator_output(event)

    await save_execution_output(workflow_id, "orchestrator", routing)

    # --- Stage 3: DOMAIN AGENTS (parallel, each with fresh session) ---
    domain_tasks = []
    for decision in routing.routing_decisions:
        for agent_type in decision.target_agents:
            task = run_domain_agent(
                case_id, workflow_id, user_id,
                agent_type=agent_type,
                file_ids=decision.file_ids,
                triage_context=triage_output,
            )
            domain_tasks.append(task)

    domain_results = await asyncio.gather(*domain_tasks, return_exceptions=True)
    # Each domain agent ran with its own session and full 1M context window

    # --- Stage 4: SYNTHESIS ---
    # Gets only structured JSON outputs, NO file content
    ...
```

### Context Caching for Cost Optimization

When multiple agents process the same files (e.g., Financial and Legal both analyze
the same PDF), context caching prevents redundant processing:

```python
from google.adk.apps.app import App
from google.adk.agents.context_cache_config import ContextCacheConfig

app = App(
    name="legal-lens",
    root_agent=agent,
    context_cache_config=ContextCacheConfig(
        min_tokens=2048,     # Cache when content exceeds this
        ttl_seconds=600,     # 10-minute cache TTL
        cache_intervals=5,   # Max reuses before expiry
    ),
)
```

**File API references are inherently reusable** — uploaded once, the URI works for
48 hours across any number of `generateContent` calls.

## Sources

### Primary (HIGH confidence)
- [ADK Documentation](https://google.github.io/adk-docs/) - Sessions, callbacks, artifacts, agents
- [ADK Python GitHub](https://github.com/google/adk-python) - Source code, issues
- [ADK Samples Repository](https://github.com/google/adk-samples/tree/main/python/agents/hierarchical-workflow-automation) - Hierarchical workflow pattern
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3) - Model IDs, thinking_level, media_resolution
- [Gemini 3 Thinking Docs](https://ai.google.dev/gemini-api/docs/thinking) - thinking_level vs thinking_budget
- [Gemini 3 Thought Signatures](https://ai.google.dev/gemini-api/docs/thought-signatures) - Function call signatures
- [Gemini API Files API](https://ai.google.dev/gemini-api/docs/files) - File API (2GB), 48hr retention
- [Gemini API Document Processing](https://ai.google.dev/gemini-api/docs/document-processing) - PDF tokenization, page costs
- [Gemini API Token Counting](https://ai.google.dev/gemini-api/docs/tokens) - Multimodal token rates
- [Gemini API Long Context](https://ai.google.dev/gemini-api/docs/long-context) - Context caching, optimization

### Secondary (MEDIUM confidence)
- [Google: Architecting Context-Aware Multi-Agent Framework](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/) - Context engineering, 5 mechanisms
- [Google: Sub-agents vs Agent-as-Tools](https://cloud.google.com/blog/topics/developers-practitioners/where-to-use-sub-agents-versus-agents-as-tools) - AgentTool context isolation
- [Google: Multi-Agent Patterns in ADK](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) - 8 patterns, dispatcher, AgentTool
- [ADK Blog Posts](https://cloud.google.com/blog/topics/developers-practitioners/remember-this-agent-state-and-memory-with-adk) - State management patterns
- [ADK Codelabs](https://codelabs.developers.google.com/deploy-manage-observe-adk-cloud-run) - PostgreSQL deployment
- [SalesShortcut](https://github.com/merdandt/SalesShortcut) - Multi-agent ADK project reference
- [Vertex AI Locations](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations) - europe-west3 availability

### Tertiary (LOW confidence)
- [GitHub Issues](https://github.com/google/adk-python/issues) - Schema migration issues, known bugs
- [Dev.to articles](https://dev.to/greyisheepai/mastering-google-adk-databasesessionservice-and-events-complete-guide-to-event-injection-and-pdm) - Community patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official ADK documentation, stable releases
- Architecture: MEDIUM-HIGH - Based on official patterns, some integration details TBD
- Pitfalls: HIGH - Documented in issues and official docs
- Token tracking: MEDIUM - Community patterns, needs runtime validation

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - ADK releases bi-weekly, Gemini 3 in preview)

---

## Appendix: Callback Signatures Reference

| Callback | Parameters | Return Type | Effect |
|----------|------------|-------------|--------|
| `before_agent_callback` | `CallbackContext` | `Optional[Content]` | Return Content to skip agent, None to continue |
| `after_agent_callback` | `CallbackContext` | `Optional[Content]` | Return Content to replace output, None to keep |
| `before_model_callback` | `CallbackContext`, `LlmRequest` | `Optional[LlmResponse]` | Return response to skip LLM call |
| `after_model_callback` | `CallbackContext`, `LlmResponse` | `Optional[LlmResponse]` | Return response to replace LLM output |
| `before_tool_callback` | `CallbackContext`, tool args | `Optional[dict]` | Return dict to skip tool, None to execute |
| `after_tool_callback` | `CallbackContext`, tool result | `Optional[dict]` | Return dict to replace tool output |

## Appendix: State Scope Persistence

| Prefix | Scope | DatabaseSessionService | InMemorySessionService |
|--------|-------|------------------------|------------------------|
| (none) | Current session | Persistent | Lost on restart |
| `user:` | All sessions for user | Persistent | Stored, lost on restart |
| `app:` | All users, all sessions | Persistent | Stored, lost on restart |
| `temp:` | Current invocation only | Discarded after | Discarded after |

## Appendix: Gemini 3 Model Comparison

| Aspect | gemini-3-pro-preview | gemini-3-flash-preview |
|--------|---------------------|------------------------|
| Best for | Complex reasoning, deep analysis | Speed, simple tasks, agentic workflows |
| Thinking levels | low, high | minimal, low, medium, high |
| Context window | 1M input / 64k output | 1M input / 64k output |
| Pricing (≤200K) | $2/$12 per 1M tokens | $0.50/$3 per 1M tokens |
| Pricing (>200K) | $4/$18 per 1M tokens | N/A |
| Audio input | $1/1M tokens | $1/1M tokens |
| Image output | $30/1M tokens | $30/1M tokens |
| Use in Legal Lens | Orchestrator, domain agents | Triage, fallback |

## Appendix: Multimodal Token Rates

| Modality | Token Rate | Notes |
|----------|-----------|-------|
| Video | 263 tokens/second | Includes visual frames + audio |
| Audio | 32 tokens/second | Standalone audio files |
| Image (low) | 280 tokens/image | `media_resolution="low"` |
| Image (medium) | 560 tokens/image | `media_resolution="medium"` |
| Image (high) | 1,120 tokens/image | `media_resolution="high"` |
| Image (1024x1024) | 1,290 tokens | Default for high-res |
| PDF page | 258 tokens (image) | Native text extraction FREE on Gemini 3 |
| Text | ~4 chars/token | 100 tokens ≈ 60-80 English words |

## Appendix: File Size Limits

| Method | Max Per File | Max Per Project | Retention | Cost |
|--------|-------------|----------------|-----------|------|
| Inline data | 100MB | N/A | N/A | N/A |
| File API | 2GB | 20GB | 48 hours | Free |
| Vertex AI GCS | Unlimited | N/A | Permanent | GCS rates |

## Appendix: Vertex AI europe-west3 Model Availability

| Model | europe-west3 | Notes |
|-------|-------------|-------|
| `gemini-3-pro` (stable) | ✅ Available | GA |
| `gemini-3-pro-image-preview` | ✅ Available | Preview |
| `gemini-3-flash-preview` | ❌ Not listed | Use Google AI Studio (API key) |
| `gemini-3-pro-preview` | ❌ Not listed | Use Google AI Studio (API key) |

Google AI Studio (API key) works in **Germany** by country availability (195+ countries).
For preview models, API key approach is recommended over Vertex AI.
