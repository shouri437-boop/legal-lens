# Legal Lens

**AI-powered legal-evidence intelligence.** Create a case, upload evidence (PDF, image, audio, video), and a multi-agent pipeline turns it into findings, a knowledge graph, a timeline, contradictions, gaps, hypotheses, a verdict, a geospatial map, and a chat that cites its sources. Every claim links back to the exact page or timestamp it came from.

Built for the Hacknex hackathon.

**Live frontend:** <https://legal-lens-seven-iota.vercel.app>

> The Vercel deployment hosts the **frontend only**. The backend (FastAPI, Postgres, in-memory SSE state) is not deployed there, so analysis, uploads and chat will not work on the live site. To use the full app, run it locally ([Quick start](#quick-start)) or deploy the backend with [Terraform](#deployment) and set `NEXT_PUBLIC_API_URL` in Vercel.

> **Status: hackathon prototype.** It runs end to end on a laptop, but it is single-instance, has no automated tests, and runs with authentication switched off locally. See [Known limitations](#known-limitations) before deploying it anywhere shared.

---

## Why

Investigators and lawyers spend most of their time cross-referencing scattered evidence by hand. General-purpose AI tools hallucinate and cannot show where an answer came from, which makes them unusable for legal work. Legal Lens is built around three rules:

1. **Everything is cited.** Each finding carries a `file_id`, a `locator` (page or timestamp) and a verbatim `excerpt`. The fast RAG path goes further and *verifies every quote against the page text*, dropping any citation it cannot confirm.
2. **The reasoning is visible.** Pipeline progress, agent status and thinking traces stream to the UI in real time.
3. **Humans stay in the loop.** Low-confidence routing decisions and findings pause the pipeline until a person confirms them.

## Features

| Feature | What it does |
|---|---|
| **Multi-agent analysis pipeline** | Triage, orchestrator, parallel domain agents (Legal, Evidence), knowledge-graph builder and synthesis, each stage in its own isolated session |
| **Live pipeline view** | Server-Sent Events drive a progress view; the UI rebuilds its state from a database snapshot after a refresh |
| **Human-in-the-loop review** | Per-agent confidence thresholds trigger confirmation modals (single and batch) |
| **Knowledge graph** | D3 force-directed graph of entities and relationships, with filters and a detail sidebar |
| **Timeline** | Chronological events with layer filters and source links |
| **Contradictions, gaps, hypotheses** | Synthesis stage flags conflicting evidence, missing evidence and testable hypotheses, plus follow-up tasks and a verdict |
| **Fast RAG analysis and Q&A** | BM25 over page chunks and one LLM call; quotes are verified against the source text |
| **Cited chat** | Streaming chat agent with four retrieval tools; citations render as links that open the source |
| **Geospatial map** | On-demand location extraction, geocoded and plotted on Google Maps |
| **Source viewers** | PDF, image, audio waveform and video viewers that jump to the cited page or timestamp |
| **Multimodal ingestion** | Everything is converted to text first: PDF text with vision-OCR for scanned pages, image description and EXIF, Whisper transcription for audio and video |

## Architecture

```mermaid
flowchart LR
    U([Browser]) --> FE

    subgraph FE["Frontend: Next.js 16 (:3000)"]
        PG["Pages: analysis, review, library,<br/>timeline, map, knowledge graph"]
    end

    subgraph BE["Backend: FastAPI (:8080)"]
        API["api/ routers"] --> SVC["services/"] --> AG["agents/ (Google ADK)"]
    end

    FE -->|REST + SSE| API
    SVC --> DB[("PostgreSQL 17")]
    AG --> DB
    SVC --> ST[("Evidence storage<br/>local disk or GCS")]
    AG -->|LiteLLM| GROQ["Groq<br/>chat, vision, Whisper"]
    SVC --> GM["Google Maps<br/>Geocoding"]
```

The analysis pipeline (`POST /api/cases/{id}/analyze`) runs as a background task:

1. **Triage** classifies files and extracts entities.
2. **Orchestrator** decides which domain agents get which file groups.
3. **Routing HITL** pauses for confirmation when confidence is below the threshold.
4. **Domain agents** (Legal, Evidence) run in parallel, one task per agent and file group.
5. **Finding HITL** pauses on low-confidence findings, then findings are saved.
6. **Knowledge-graph builder** writes entities and relationships.
7. **Synthesis** produces hypotheses, contradictions, gaps, tasks, timeline and verdict.

For the full picture (data model, API surface, SSE design, extension recipes) read [DOCS/architecture.md](DOCS/architecture.md).

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, TanStack Query, D3, `@xyflow/react`, `@vis.gl/react-google-maps`, react-pdf-viewer, wavesurfer.js |
| Backend | Python 3.12+, FastAPI, SQLAlchemy 2 (async) + asyncpg, Alembic, Pydantic v2, `sse-starlette` |
| Agents | Google ADK (`LlmAgent`) with models served by Groq through LiteLLM |
| Evidence to text | PyMuPDF, Groq vision, Groq Whisper, `pydub` + `ffmpeg` |
| Data | PostgreSQL 17 (JSONB), local disk or Google Cloud Storage |
| Infra | Docker, Terraform (GCP: Cloud Run, Cloud SQL, GCS, Secret Manager) |
| Tooling | uv, bun workspaces, ruff, mypy, eslint, prettier, lefthook |

## Repository layout

```
.
├── backend/                 FastAPI + Google ADK service
│   ├── app/
│   │   ├── api/             HTTP routers
│   │   ├── services/        pipeline, chat, RAG, files, SSE events, HITL
│   │   ├── agents/          ADK agents, runners, prompts, Groq adapter
│   │   ├── models/          SQLAlchemy models
│   │   └── schemas/         Pydantic request/response and agent output schemas
│   ├── alembic/versions/    database migrations
│   └── redaction_modal/     placeholder for a future redaction agent (empty)
├── frontend/                Next.js app (src/app, components, hooks, lib)
├── packages/types/          TypeScript types generated from the FastAPI OpenAPI schema
├── terraform/               GCP infrastructure
├── DOCS/                    architecture, UI design system, original PRD
├── samples/                 sample court-judgment PDFs for trying the app
├── .planning/               phase plans and summaries from development
├── docker-compose.yml       local Postgres 17 (+ Adminer)
└── Makefile, lefthook.yml   dev commands and git hooks
```

## Quick start

### Prerequisites

- [bun](https://bun.sh), [uv](https://docs.astral.sh/uv/) and Docker
- A [Groq API key](https://console.groq.com/keys) (required for all LLM work)
- A Google Maps API key (optional; only the map and geospatial generation need it)
- `ffmpeg` on your `PATH` (optional; only needed to transcribe video audio)

### 1. Install

```bash
bun install
cd backend && uv sync --dev
```

### 2. Configure

```bash
cp backend/.env.example backend/.env       # then fill in GROQ_API_KEY
cp frontend/.env.example frontend/.env.local
```

Set `DATABASE_URL` in `backend/.env` to match the port Docker publishes (`5432` by default):

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/legal_lens
```

### 3. Start the database and migrate

```bash
docker compose up -d postgres
cd backend && uv run alembic upgrade head
```

### 4. Run

In two terminals:

```bash
# backend  -> http://localhost:8080  (Swagger UI at /docs)
cd backend && uv run uvicorn app.main:app --reload --port 8080

# frontend -> http://localhost:3000
bun --cwd frontend dev
```

Open <http://localhost:3000>, create a case, upload the PDFs from [`samples/`](samples/), and run the analysis.

> Locally the backend runs with `DEBUG=true` and `AUTH_DISABLED=true`, which makes every request act as a fixed dev user. Never enable that on a shared deployment.

On Windows without `make`, run the commands above directly. On macOS and Linux, `make install`, `make dev-db`, `make migrate`, `make dev-backend` and `make dev-frontend` do the same.

## Configuration

All backend settings live in [`backend/app/config.py`](backend/app/config.py) (pydantic-settings). Real environment variables win over `backend/.env`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Must use the `postgresql+asyncpg://` scheme |
| `GROQ_API_KEY` / `GROQ_API_KEYS` | One key, or a comma-separated pool with per-agent affinity and failover |
| `GOOGLE_MAPS_API_KEY` | Geocoding for the geospatial map |
| `CORS_ORIGINS` | Allowed browser origins, e.g. `http://localhost:3000` |
| `DEBUG`, `AUTH_DISABLED` | Local dev mode (see warning above) |
| `GCS_BUCKET` | Unset: evidence is stored in `backend/storage/`. Set: Google Cloud Storage |
| `FLASH_MODEL`, `PRO_MODEL`, `RAG_MODEL` | Override the default Groq models |
| `VISION_MODEL`, `STT_MODEL` | OCR / image description and speech-to-text models |

The pipeline splits work across two models ("Flash" and "Pro") because Groq's free tier meters tokens per model, so using two roughly doubles throughput. Groq's free tier also rejects requests over about 8k tokens, so agents receive text excerpts (`AGENT_TEXT_BUDGET_CHARS`, default 6000).

## Development

```bash
cd backend && uv run ruff check . && uv run ruff format .   # backend lint and format
bun --cwd frontend lint                                      # frontend lint
bun --cwd frontend typecheck                                 # frontend types
make generate-types                                          # regenerate packages/types from the OpenAPI schema
```

- After changing any Pydantic response schema or route, run `make generate-types`. The pre-push hook fails if it leaves a diff in `packages/types/`.
- Install the git hooks with `make hooks` (needs [lefthook](https://github.com/evilmartians/lefthook)): pre-commit runs ruff, eslint and prettier.
- Health checks: `/health`, `/health/db`, `/health/storage`.
- Conventions (agent factory rules, per-route ownership checks, no GZip because it breaks SSE, theming) are documented in [DOCS/architecture.md](DOCS/architecture.md) and [frontend/GUIDE.md](frontend/GUIDE.md).

## Deployment

[`terraform/`](terraform/) provisions two Cloud Run services (backend and frontend), Cloud SQL (Postgres 17), GCS buckets, Artifact Registry, Secret Manager and Workload Identity Federation for CI. Gotchas are recorded in [`.planning/LESSONS-LEARNED.md`](.planning/LESSONS-LEARNED.md).

Before relying on the cloud setup, know that:

- The backend must run as **one instance** (set Cloud Run `max_instance_count = 1`); SSE and HITL state live in process memory.
- The backend Dockerfile does not run migrations and does not install `ffmpeg`.
- No CI workflow is included in this repository.

## Known limitations

- **Single instance only.** SSE subscribers, replay buffers and pending confirmations are in memory; a restart loses them.
- **SSE endpoints are unauthenticated.** Anyone who knows a case UUID can stream its events.
- **Pipeline timeouts are configured but not enforced.**
- **Rejected findings are still saved** (HITL rejection is currently advisory).
- **Agents see excerpts**, not whole documents, with the default token budget. Video contributes its audio track only.
- **Not built yet:** timeline write endpoints, case-notes endpoints, correction/regeneration flow, the redaction agent, and the Strategy agent (the code exists but is not invoked).
- **No automated tests.**

The full list, with analysis, is in [DOCS/architecture.md](DOCS/architecture.md#16-known-limitations-and-risks).

## Documentation

| Doc | Contents |
|---|---|
| [DOCS/architecture.md](DOCS/architecture.md) | System architecture as the code behaves today |
| [DOCS/FULLSTACK/REQUEST_FLOW.md](DOCS/FULLSTACK/REQUEST_FLOW.md) | Upload-to-display request flow (pre-rework) |
| [DOCS/UI/DESIGN-SYSTEM.md](DOCS/UI/DESIGN-SYSTEM.md) | Theme tokens and UI conventions |
| [DOCS/ideation/PRD.md](DOCS/ideation/PRD.md) | Original product requirements |
| [`.planning/`](.planning/) | Roadmap, requirements and per-phase plans |

`.planning/` and some of `DOCS/` describe the original Gemini-based design. Where they disagree with the code, trust the code and `DOCS/architecture.md`.

## Acknowledgements and license

Legal Lens is derived from the open-source **Holmes** project (Apache License 2.0), reworked to use Groq models, local evidence storage and a Review-page workflow.

Licensed under the [Apache License 2.0](LICENSE).
