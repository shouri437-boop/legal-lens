# Technology Stack

**Project:** Legal Lens - Legal Intelligence Platform
**Researched:** 2026-01-20 (Updated: 2026-01-21 with integration features)
**Overall Confidence:** HIGH (verified with official sources and current documentation)

---

## Executive Summary

This stack is optimized for a multimodal AI legal intelligence platform with real-time streaming, agent orchestration, and knowledge graph visualization. The choices prioritize:

1. **GCP-native deployment** (Cloud Run, Cloud SQL, Cloud Storage)
2. **Google ADK for agent orchestration** (hackathon requirement)
3. **Real-time streaming** via SSE for AI response delivery
4. **High performance** async patterns throughout
5. **Type safety** end-to-end (TypeScript + Python type hints)

---

## Frontend Stack

### Core Framework

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **Next.js** | 16.1.x | React meta-framework with App Router | HIGH |
| **React** | 19.2.x | UI library (bundled with Next.js 16) | HIGH |
| **TypeScript** | 5.9+ | Type safety | HIGH |

**Rationale:** Next.js 16.1 (December 2025) provides:
- React 19.2 with View Transitions, `useEffectEvent()`, and Activity components
- Turbopack as stable default bundler (file system caching now stable)
- Cache Components with explicit `"use cache"` directive
- `proxy.ts` replacing `middleware.ts` for explicit network boundaries
- DevTools MCP integration for richer debugging
- ~20MB smaller installs via simplified caching layer
- New `next upgrade` command for easier upgrades

**Source:** [Next.js 16 Release](https://nextjs.org/blog/next-16), [Next.js 16.1 Release](https://nextjs.org/blog/next-16-1)

### Styling

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **Tailwind CSS** | 4.x | Utility-first CSS | HIGH |
| **shadcn/ui** | latest | Component foundation | HIGH |

**Rationale:** Tailwind CSS v4 (released January 2025) brings:
- CSS-first configuration (no `tailwind.config.js` needed)
- 5x faster full builds, 100x faster incremental rebuilds
- Built on cascade layers, `@property`, `color-mix()`
- Automatic content detection

shadcn/ui provides accessible, customizable components built on Radix UI primitives. Components live in your codebase for full control.

**Installation:**
```bash
npm install tailwindcss @tailwindcss/postcss postcss
npx shadcn@latest init
```

**Sources:**
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4)
- [shadcn/ui Introduction](https://ui.shadcn.com/docs)

### State Management

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **Zustand** | 5.x | Client state management | HIGH |
| **TanStack Query** | 5.x | Server state management | HIGH |

**Rationale:**

**Zustand** (recommended for 90% of projects in 2025):
- ~3KB bundle size, minimal boilerplate
- Hook-based API, no providers needed
- Define state and actions in one place
- Best middle ground between simplicity and power

**TanStack Query v5:**
- Single object parameter API (more consistent)
- `useSuspenseQuery` for SSR streaming
- 20% smaller than v4
- React 18+ required (we have React 19)

**Do NOT use:**
- Redux/Redux Toolkit - overkill for this project, more boilerplate
- Jotai - better for complex interdependencies we don't have
- React Context alone - performance issues with frequent updates

**Sources:**
- [State Management in 2025](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k)
- [TanStack Query v5](https://tanstack.com/query/latest)

### Visualization

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **@xyflow/react** | 12.10.x | Agent trace visualization, workflow UIs | HIGH |
| **D3.js** | 7.x | Knowledge graph force layouts | MEDIUM |

**Rationale:**

**React Flow (@xyflow/react v12):**
- Renamed from `reactflow` to `@xyflow/react`
- SSR/SSG support (define width, height, handles)
- Built-in dark mode with `colorMode` prop
- CSS variables for theming
- Nodes are React components (full customization)
- Perfect for "Agent Flow" visualization

**D3.js** for knowledge graphs:
- Force-directed layouts for entity relationships
- Can combine with React Flow for hybrid approach
- Better for large datasets (<10k elements use D3/SVG)

**Alternative: vis-network** (evaluate during Phase 7 implementation):
- ForceAtlas2 physics engine (better clustering)
- Built-in hierarchical layouts
- Canvas-based (better performance for large graphs)
- Decision: Choose between D3.js and vis-network during Phase 7

**Installation:**
```bash
npm install @xyflow/react d3 @types/d3
```

**Import pattern:**
```typescript
import { ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
```

**Sources:**
- [React Flow 12 Release](https://xyflow.com/blog/react-flow-12-release)
- [D3.js](https://d3js.org/)

### Authentication (Frontend)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **Better Auth** | 1.4.15+ | Authentication framework | HIGH |

**Rationale:** Better Auth is the most comprehensive authentication framework for TypeScript:
- Framework-agnostic design
- Plugin ecosystem (2FA, magic links, admin tools)
- Stateless sessions option
- JWT plugin for backend verification
- Cookie chunking (no size errors)
- TypeScript-first

**Backend Integration Pattern:**
1. Use Better Auth JWT plugin on frontend
2. Verify JWTs on FastAPI using public key from JWKS endpoint
3. OR use reverse proxy with ForwardAuth pattern

**Do NOT use:**
- NextAuth/Auth.js - Better Auth is the successor
- Firebase Auth - adds unnecessary GCP complexity
- Clerk/Auth0 - external dependencies for hackathon

**Source:** [Better Auth](https://www.better-auth.com/)

### Additional Frontend Libraries

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `lucide-react` | latest | Icons | Consistent with shadcn |
| `zod` | 3.x | Schema validation | Shared with backend models |
| `date-fns` | 4.x | Date manipulation | Tree-shakeable |
| `nuqs` | latest | URL state management | Type-safe query params |

---

## Backend Stack

### Core Framework

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **FastAPI** | 0.128.x | Async API framework | HIGH |
| **Uvicorn** | 0.34.x | ASGI server | HIGH |
| **Python** | 3.12+ | Runtime | HIGH |

**Rationale:** FastAPI 0.128.x (latest stable):
- Async-first design perfect for AI workloads
- Automatic OpenAPI documentation
- Pydantic v2 integration (5x faster validation)
- `StreamingResponse` for SSE
- Type hints throughout
- Starlette 0.45.x compatibility

**Key 0.128+ changes:**
- Python 3.9+ required (dropped 3.8)
- Pydantic v1 fully deprecated
- Dependencies with yield run exit code after response sent (good for streaming)
- python-multipart >=0.0.18, jinja2 >=3.1.5

**Source:** [FastAPI Releases](https://github.com/fastapi/fastapi/releases), [FastAPI PyPI](https://pypi.org/project/fastapi/)

### Data Validation

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **Pydantic** | 2.12+ | Data validation | HIGH |
| **pydantic-settings** | 2.x | Settings management | HIGH |

**Rationale:** Pydantic v2:
- Rust core = 5x faster validation
- `model_validate_json()` for direct JSON parsing
- `field_validator()` and `model_validator()` (not deprecated `validator`/`root_validator`)
- TypeAdapter for non-model validation

**Best practices:**
- Use specific types over generic (`list` not `Sequence`)
- Express constraints declaratively (let Rust handle them)
- Reuse TypeAdapter instances

**Source:** [Pydantic Performance](https://docs.pydantic.dev/latest/concepts/performance/)

### Database

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **PostgreSQL** | 17 | Primary database | HIGH |
| **SQLAlchemy** | 2.0.45+ | Async ORM | HIGH |
| **asyncpg** | 0.30.x | Async PostgreSQL driver | HIGH |
| **Alembic** | 1.14+ | Database migrations | HIGH |

**Rationale:**

**PostgreSQL 17** on Cloud SQL:
- JSONB for flexible evidence metadata
- Full-text search for document content
- pgvector extension for embeddings (if needed)

**SQLAlchemy 2.0 async patterns:**
```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@host/db",
    pool_size=10,
    max_overflow=20,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
```

**JSONB best practices:**
- Hybrid approach: columns for stable fields, JSONB for variable data
- Generated columns for hot filters
- GIN indexes with `jsonb_path_ops` for containment queries
- Avoid large arrays/deeply nested structures in JSONB

**Installation:**
```bash
pip install sqlalchemy[asyncio] asyncpg alembic
```

**Sources:**
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [PostgreSQL JSONB Patterns](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/)

### Real-Time Streaming

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **sse-starlette** | 3.2.x | SSE implementation | HIGH |

**Rationale:** SSE over WebSockets because:
- Unidirectional (server to client) fits AI response streaming
- Simpler than WebSockets, easier to scale
- Built-in automatic reconnection
- Works over standard HTTP

**sse-starlette** features:
- W3C SSE specification compliant
- Automatic client disconnect detection
- Thread safety for multi-loop support

**Usage:**
```python
from sse_starlette import EventSourceResponse

async def stream_agent_response():
    async for chunk in agent.stream():
        yield {"data": chunk, "event": "chunk"}
    yield {"data": "done", "event": "complete"}

return EventSourceResponse(stream_agent_response())
```

**Important:**
- Disable GZipMiddleware (incompatible with SSE)
- Add `X-Accel-Buffering: no` header for nginx

**Source:** [sse-starlette PyPI](https://pypi.org/project/sse-starlette/)

---

## AI/Agent Stack

### Agent Orchestration

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| **google-adk** | 1.22.1+ | Agent Development Kit | HIGH |
| **Gemini 3 Pro/Flash** | latest | LLM models | HIGH |

**Rationale:** Google ADK (hackathon requirement) provides:
- Code-first agent development
- Model-agnostic but optimized for Gemini
- Production-ready (v1.0+ stable)
- Multi-agent orchestration patterns
- Human-in-the-loop tool confirmation flows (⚠️ InMemorySessionService only)
- Rewind capability (rewind session to before a previous invocation)
- GcsArtifactService for versioned file storage
- Context caching for cost optimization
- Context compaction for long sessions

**Requirements:** Python >=3.10 (3.11+ strongly recommended)

**ADK Agent Types:**
1. **LLM Agents** - reasoning with Gemini
2. **Workflow Agents** - orchestration (Sequential, Parallel, Loop)
3. **Custom Agents** - inherit from BaseAgent

**Key Patterns for Legal Lens:**

1. **Sequential Pipeline** for evidence processing:
   - Triage Agent → Domain Agents → Synthesis Agent → KG Agent

2. **Parallel Execution** for domain analysis:
   - Financial Agent + Legal Agent + Strategy Agent + Evidence Agent running concurrently
   - Each agent receives multimodal files directly (Gemini processes all file types natively)

3. **Hierarchical Delegation** for specialized processing:
   - Orchestrator routes files to domain specialists based on triage scores

4. **Resilient Wrapper Pattern** for graceful degradation:
   - Primary agent (Pro) with fallback agent (Flash)

**Critical Insight — Domain-Based, Not File-Type Based:**
Gemini 3 is natively multimodal. We use domain-based agents (Financial, Legal, Strategy, Evidence) rather than file-type agents. A Financial Agent analyzes PDFs, video depositions, and audio recordings together — understanding the full financial context across modalities without separate extraction pipelines.

**ADK Limitations to Design Around:**

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Tool confirmation only with InMemorySessionService | Can't use `require_confirmation` with DatabaseSessionService | Implement confirmation in frontend |
| Cannot use tools + output_schema together | Agents can't have both | Split into tool-agent → schema-agent |
| Single parent rule | Agent instance can only have one parent | Factory pattern creates fresh instances |
| State updates commit after Event yield | Potential race conditions | Use unique output_keys per agent |
| Temperature must stay at 1.0 | Lower values cause looping | Never override |
| LoopAgent needs explicit escalate | Won't exit early without it | Add QualityThresholdChecker BaseAgent |

**Thinking Mode Configuration:**

| Agent | Model | Thinking Level | Media Resolution |
|-------|-------|----------------|------------------|
| Triage | Flash | low | default |
| Orchestrator | Pro | high | default |
| Financial | Pro | medium | high |
| Legal | Pro | high | high |
| Strategy | Pro | medium | default |
| Evidence | Pro | high | high |
| Synthesis | Pro | high | default |
| KG Agent | Pro | medium | default |
| Chat | Pro | medium | default |
| Verification | Pro | high | high |

**Essential Configuration:**
```python
from google.genai import types
from google.adk.agents import LlmAgent
from google.adk.artifacts import GcsArtifactService
from google.adk.sessions import DatabaseSessionService
from google.adk.runners import Runner

# Session service with PostgreSQL
session_service = DatabaseSessionService(
    db_url="postgresql+asyncpg://user:pass@host/legal_lens_db"
)

# Artifact service for versioned storage
artifact_service = GcsArtifactService(bucket_name="legal-lens-evidence-bucket")

# Agent with proper configuration
evidence_agent = LlmAgent(
    name="EvidenceAgent",
    model="gemini-3-pro-preview",
    instruction="Analyze evidence for authenticity...",
    output_key="evidence_findings",
    generate_content_config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_level="high",
            include_thoughts=True  # Required for Agent Flow
        ),
        generation_config={"media_resolution": "high"}  # Dense documents
    )
)

# Runner with all services
runner = Runner(
    agent=root_agent,
    app_name="legal-lens",
    session_service=session_service,
    artifact_service=artifact_service
)
```

**Video/Audio Processing:**
```python
from google.genai.types import VideoMetadata

# Process specific video segment
response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents=[
        types.Part(
            file_data=types.FileData(file_uri=video_file.uri),
            video_metadata=VideoMetadata(
                start_offset="00:15:00",
                end_offset="00:45:00"
            )
        ),
        "Analyze this deposition segment..."
    ]
)
```

**Context Caching (4x cost reduction):**
```python
# Create cache when user opens case
cache = client.caches.create(
    model="gemini-3-pro-preview",
    contents=[*case_evidence_files],
    ttl="7200s"  # 2 hours
)

# Query against cache
response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents="What does the evidence show about...",
    cached_content=cache.name
)
```

**Context Compaction (long sessions):**
```python
from google.adk.apps.app import App, EventsCompactionConfig
from google.adk.apps.llm_event_summarizer import LlmEventSummarizer

app = App(
    name='legal-lens-investigation',
    root_agent=investigation_agent,
    events_compaction_config=EventsCompactionConfig(
        compaction_interval=5,
        overlap_size=2,
        summarizer=LlmEventSummarizer(llm=Gemini(model="gemini-3-flash-preview"))
    )
)
```

**Deep Research Agent (autonomous research):**
```python
# Start background research
interaction = client.interactions.create(
    input="Research publicly available information about [subject]",
    agent='deep-research-pro-preview-12-2025',
    background=True,
    stream=True,
    agent_config={"type": "deep-research", "thinking_summaries": "auto"}
)
```

**New in 1.22.x:**
- AgentEngineSandboxCodeExecutor for Vertex AI Code Execution Sandbox
- Session rewind capability
- Improved MCP tool integration

**Best Practice:** Avoid monolithic agents. Build specialized micro-agents that do one thing well.

**Installation:**
```bash
pip install google-adk>=1.22.1
```

**Sources:**
- [ADK Documentation](https://google.github.io/adk-docs/)
- [Multi-Agent Patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)
- [ADK Releases](https://github.com/google/adk-python/releases)
- [ADK PyPI](https://pypi.org/project/google-adk/)

### Multimodal Processing

| Technology | Purpose | Notes |
|------------|---------|-------|
| **Gemini 3 Pro** | Complex reasoning, legal analysis, native multimodal | Handles PDF, images, video, audio directly |
| **Gemini 3 Flash** | Fast processing, triage, simple extraction | Lower latency, cost |
| **google-cloud-storage** | Evidence file storage | GCP native |
| **Gemini Web Search** | Research Agent source discovery | Dynamic source discovery via API |
| **Google Earth Engine** | Satellite imagery for geospatial verification | Approval may take days/weeks; historical imagery, change detection |

**Multimodal Strategy — Gemini-Native Approach:**

Gemini 3 is natively multimodal. It directly processes:
- **PDFs**: Reads text, tables, images, layouts without OCR pipelines
- **Images**: Analyzes photos, scanned documents, diagrams directly
- **Video**: Processes video content, extracts key moments, understands visual context
- **Audio**: Transcribes and analyzes audio without separate speech-to-text

**What we DON'T need:**
- ❌ Tesseract or other OCR libraries — Gemini reads images/scans directly
- ❌ PyPDF/python-docx for text extraction — Gemini reads PDFs directly
- ❌ Whisper/Cloud Speech for transcription — Gemini transcribes audio natively
- ❌ Video frame extraction pipelines — Gemini processes video natively

**Architecture simplification:**
```
Traditional: File → OCR/Extract → Text → Store → LLM queries text
Gemini 3:    File → Store in GCS → Gemini directly analyzes file
```

This dramatically simplifies the pipeline and leverages Gemini's native capabilities.

---

## Infrastructure Stack

### GCP Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Cloud Run** | Container hosting | 1 vCPU, 512MiB starting |
| **Cloud SQL** | PostgreSQL | PostgreSQL 17, smallest tier |
| **Cloud Storage** | Evidence files | Standard class |
| **Artifact Registry** | Container images | Docker format |
| **Secret Manager** | API keys, credentials | Required |
| **Earth Engine** | Satellite imagery verification | Requires approval (days/weeks) |
| **Mapbox** (tentative) | Map display, geocoding | Evaluate alternatives during implementation |

### Cloud Run Configuration

**Best Practices:**

1. **Cold Start Mitigation:**
   - Set minimum instances for user-facing services
   - Use smaller container images
   - Lazy load heavy dependencies

2. **Resource Sizing:**
   - Start with 1 vCPU, 512MiB
   - Monitor and adjust based on actual usage
   - AI workloads may need more CPU

3. **Async Libraries Required:**
   - `asyncpg` (not `psycopg2`)
   - `httpx` (not `requests`)
   - `aiohttp` for external APIs

4. **Logging:**
   - Set `PYTHONUNBUFFERED=1` in Dockerfile
   - Write to stdout/stderr for Cloud Logging

**Dockerfile pattern:**
```dockerfile
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Source:** [Cloud Run FastAPI Guide](https://docs.cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-python-fastapi-service)

### CI/CD

| Technology | Purpose |
|------------|---------|
| **Cloud Build** | Build and deploy pipeline |
| **GitHub Actions** | Alternative CI/CD |

---

## Development Tools

### Python

| Tool | Purpose |
|------|---------|
| `uv` or `pip` | Package management |
| `ruff` | Linting + formatting (replaces black, isort, flake8) |
| `mypy` | Type checking |
| `pytest` + `pytest-asyncio` | Testing |

### JavaScript/TypeScript

| Tool | Purpose |
|------|---------|
| `pnpm` | Package management (faster than npm) |
| `eslint` | Linting |
| `prettier` | Formatting |
| `vitest` | Testing |

### Development Environment

```bash
# Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
pnpm install
pnpm dev
```

---

## Complete Installation Commands

### Frontend
```bash
# Create Next.js 16 app
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir

# Install dependencies
cd frontend
pnpm add @xyflow/react d3 @types/d3 zustand @tanstack/react-query better-auth zod lucide-react date-fns nuqs
pnpm add -D @tailwindcss/postcss
```

### Backend
```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install fastapi uvicorn pydantic pydantic-settings
pip install sqlalchemy[asyncio] asyncpg alembic
pip install google-adk>=1.22.1 sse-starlette>=3.2.0
pip install google-cloud-storage google-cloud-secret-manager
pip install httpx python-multipart
pip install ee  # Google Earth Engine

# Dev dependencies
pip install ruff mypy pytest pytest-asyncio
```

### Database Tables (Integration Features)
```sql
-- Hypothesis system (simplified 3-state)
CREATE TABLE case_hypotheses (
    id UUID PRIMARY KEY,
    case_id UUID REFERENCES cases(id),
    claim TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,  -- PENDING, SUPPORTED, REFUTED
    resolved BOOLEAN DEFAULT FALSE,  -- user marks when investigation complete
    confidence FLOAT,
    source_agent VARCHAR(50),
    reasoning JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE hypothesis_evidence (
    id UUID PRIMARY KEY,
    hypothesis_id UUID REFERENCES case_hypotheses(id),
    finding_id UUID REFERENCES findings(id),
    evidence_type VARCHAR(20) NOT NULL,  -- SUPPORTING, CONTRADICTING
    weight FLOAT NOT NULL,
    excerpt TEXT,
    location JSONB,
    reasoning TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Investigation tasks
CREATE TABLE investigation_tasks (
    id UUID PRIMARY KEY,
    case_id UUID REFERENCES cases(id),
    task_type VARCHAR(30) NOT NULL,  -- resolve_contradiction, obtain_evidence, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(10),
    status VARCHAR(20) DEFAULT 'pending',
    source_agent VARCHAR(50),
    related_entities JSONB,
    completion_notes JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Locations for geospatial
CREATE TABLE locations (
    id UUID PRIMARY KEY,
    case_id UUID REFERENCES cases(id),
    finding_id UUID REFERENCES findings(id),
    place_name VARCHAR(255),
    latitude FLOAT,
    longitude FLOAT,
    location_type VARCHAR(50),
    metadata JSONB,
    associated_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Alternatives Considered

| Category | Chosen | Alternative | Why Not |
|----------|--------|-------------|---------|
| Frontend Framework | Next.js 16 | Remix, Vite+React | Next.js is default for this scale, better RSC support |
| State Management | Zustand | Redux, Jotai | Zustand is simpler, Redux overkill, Jotai for different use case |
| CSS | Tailwind v4 | CSS Modules, styled-components | Tailwind v4 is fastest, best DX |
| Components | shadcn/ui | MUI, Chakra | Full control, no vendor lock-in |
| Backend Framework | FastAPI | Django, Flask | FastAPI async-first, better for AI workloads |
| ORM | SQLAlchemy 2.0 | Django ORM, Tortoise | Best async support, mature |
| Graph Viz | React Flow | Cytoscape.js, vis.js | React components, best DX for React apps |
| Auth | Better Auth | NextAuth, Clerk | Better Auth is successor, self-hosted |
| Streaming | SSE | WebSockets | SSE simpler for server→client, auto-reconnect |

---

## Version Pinning Recommendations

**requirements.txt (Backend):**
```
fastapi>=0.128.0,<0.129.0
uvicorn>=0.34.0
pydantic>=2.12.0
sqlalchemy[asyncio]>=2.0.45
asyncpg>=0.30.0
alembic>=1.14.0
google-adk>=1.22.1
sse-starlette>=3.2.0
```

**package.json (Frontend):**
```json
{
  "dependencies": {
    "next": "^16.1.0",
    "react": "^19.2.0",
    "@xyflow/react": "^12.10.0",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",
    "better-auth": "^1.4.15"
  }
}
```

---

## Sources

### Official Documentation
- [Next.js 16 Release](https://nextjs.org/blog/next-16)
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Google ADK](https://google.github.io/adk-docs/)
- [SQLAlchemy 2.0 Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [React Flow 12](https://xyflow.com/blog/react-flow-12-release)
- [Better Auth](https://www.better-auth.com/)
- [TanStack Query v5](https://tanstack.com/query/latest)
- [Pydantic v2](https://docs.pydantic.dev/latest/)
- [Cloud Run FastAPI](https://docs.cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-python-fastapi-service)

### Best Practices Guides
- [State Management 2025](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k)
- [PostgreSQL JSONB Patterns](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/)
- [Multi-Agent Patterns in ADK](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)
- [FastAPI SSE Streaming](https://medium.com/@nandagopal05/server-sent-events-with-python-fastapi-1c8c54746eb7)
