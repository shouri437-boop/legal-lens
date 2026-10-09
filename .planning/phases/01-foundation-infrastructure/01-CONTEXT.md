# Phase 1: Foundation Infrastructure - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish CI/CD pipeline, database, storage, and skeleton services that all other phases depend on. Includes GitHub Actions deploying to Cloud Run, PostgreSQL on Cloud SQL, Cloud Storage bucket, FastAPI skeleton, Next.js skeleton, SSE endpoint skeleton, and monorepo structure.

</domain>

<decisions>
## Implementation Decisions

### Deployment Strategy
- Two environments: local development + production only (no staging)
- Auto-deploy on push to main branch
- Branching: `development` for work, merge to `main` triggers deploy (no PRs, hackathon mode)
- Separate Cloud Run services for frontend and backend (independent scaling)
- Use Cloud Run default URLs (*.run.app) — no custom domain needed initially
- Cloud Run config: min instances 0, response streaming enabled, `PYTHONUNBUFFERED=1`
- Docker base: `python:3.12-slim`

### Monorepo Structure
- Bun as package manager with plain workspaces (no Turborepo)
- Structure: `/frontend` (Next.js), `/backend` (FastAPI), `/packages` (generated TS types)
- **API contract as source of truth:** FastAPI OpenAPI (derived from Pydantic models + route annotations) defines the HTTP contract and shared schemas
- **Type generation:** CI runs `make generate-types` to generate TypeScript from the backend OpenAPI schema
- **Generation flow:** FastAPI `app.openapi()` → `openapi-typescript` → packages/types/src/generated/api.ts
- **Validation:** Pydantic handles validation in backend; frontend uses generated types for type-safety only
- No hand-written shared types — all derived from Python models
- Convenience alias scripts in root package.json (e.g., `bun dev:frontend`)
- Python backend lives inside monorepo at `/backend`
- Python dependency management via uv
- Python version: 3.12
- Python linting/formatting: Ruff (lint + format in one tool)
- TypeScript linting: ESLint + Prettier
- Makefile at root for cross-language orchestration
- Git hooks via Lefthook (lint/format on commit)
- TypeScript strict mode with relaxation: allow unused variables during development

### Type Generation Pipeline
- FastAPI OpenAPI (built from `/backend/app/schemas/` + route annotations) is the single source of truth for generated TypeScript
- CI job runs after backend changes: generates TS types before frontend build
- Generated types output to `/packages/types/src/generated/`
- Frontend imports from `@legal-lens/types` workspace package
- Makefile target: `make generate-types` for local development
- Generation tool: `openapi-typescript` (OpenAPI → TypeScript)
- Generated files are committed to repo (not gitignored) — ensures frontend can build without running generation

### Backend Stack
- FastAPI 0.128.x with Uvicorn 0.34.x
- Alembic 1.14+ for migrations

### Frontend Stack
- Next.js 16.1.x with App Router
- Tailwind CSS 4.x (CSS-first config)
- shadcn/ui for components
- Zustand 5.x for client state
- TanStack Query 5.x for server state

### SSE Configuration
- Library: sse-starlette 3.2.x
- Required headers: `X-Accel-Buffering: no`, `Cache-Control: no-cache, no-transform`
- Disable GZipMiddleware (incompatible with SSE)
- Heartbeat comments to prevent Cloud Run idle timeout

### Database Setup
- Local development: Docker Compose PostgreSQL
- Initial schema includes auth tables (users, sessions, accounts) + cases skeleton
- UUID for all primary keys
- Migrations via Alembic, auto-run in CI before deploy
- ORM: SQLAlchemy 2.0.45+
- Async database access with asyncpg 0.30.x
- Pydantic 2.12+ for data validation
- snake_case naming convention throughout
- JSONB strategy: hybrid schema (columns for stable fields, JSONB for variable data, keep under 2KB)
- PostgreSQL 17 on Cloud SQL
- Cloud SQL tier: db-g1-small (safest, ~$50/mo)
- No automatic backups (cost savings for hackathon)

### Environment Management
- Production secrets: Cloud Run environment variables (simpler approach)
- Local env: .env files (gitignored) with .env.example template
- Local GCP auth: gcloud auth application-default login
- CI GCP auth: Workload Identity Federation (keyless OIDC)
- GCP project: new project to be created
- GCP region: europe-west3
- Infrastructure as code: Terraform with local state

### Claude's Discretion
- Connection pool configuration for Cloud Run
- Specific Terraform module organization
- CI workflow job structure
- Health endpoint implementation details
- SSE heartbeat interval

</decisions>

<specifics>
## Specific Ideas

- Makefile should orchestrate both Python (uv) and JS (bun) commands cleanly
- Lefthook should run both Ruff (Python) and ESLint/Prettier (TS) on relevant files
- Docker Compose should mirror Cloud SQL PostgreSQL version for parity

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-01-20*
