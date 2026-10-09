# Phase 1: Foundation Infrastructure - Research

**Researched:** 2026-01-20
**Domain:** CI/CD, Cloud Infrastructure, Monorepo, Database, SSE
**Confidence:** HIGH

## Summary

Phase 1 establishes the deployment pipeline and core infrastructure that all subsequent phases depend on. The research covers GitHub Actions with Workload Identity Federation for keyless GCP authentication, Terraform configuration for Cloud Run, Cloud SQL, and GCS, monorepo setup with Bun workspaces, async database patterns with SQLAlchemy 2.0 and asyncpg, SSE streaming configuration for Cloud Run, and type generation from Pydantic to TypeScript.

The standard approach uses GitHub Actions with `google-github-actions/auth@v3` for OIDC-based authentication to GCP, eliminating the need for long-lived service account keys. Infrastructure is provisioned via Terraform using the v2 Cloud Run API (`google_cloud_run_v2_service`). The monorepo uses Bun workspaces with `uv` for Python dependency management and Lefthook for cross-language git hooks.

**Primary recommendation:** Start with Workload Identity Federation setup first, as it unblocks all subsequent CI/CD work. Use the Terraform google provider v6.x with Cloud Run v2 resources for modern features like response streaming.

## Standard Stack

The established libraries/tools for this domain:

### Core Infrastructure

| Library/Tool | Version | Purpose | Why Standard |
|--------------|---------|---------|--------------|
| Terraform | 1.9+ | Infrastructure as Code | Google Cloud provider v6.x has Cloud Run v2 support |
| google provider | 6.x | Terraform GCP provider | Stable Cloud Run v2 resources |
| GitHub Actions | N/A | CI/CD pipeline | Native OIDC support for WIF |
| google-github-actions/auth | v3 | GCP authentication | Official action, WIF support |
| google-github-actions/deploy-cloudrun | v3 | Cloud Run deployment | Official action |

### Backend

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.128.x | API framework | Async-first, Pydantic v2 native |
| Uvicorn | 0.34.x | ASGI server | Production-ready, workers support |
| SQLAlchemy | 2.0.45+ | Async ORM | Best async support, mature |
| asyncpg | 0.30.x | PostgreSQL driver | High performance async driver |
| Alembic | 1.14+ | Database migrations | Native async template support |
| sse-starlette | 3.2.x | SSE implementation | W3C compliant, disconnect detection |
| Pydantic | 2.12+ | Validation | Rust core, 5x faster |
| pydantic-settings | 2.x | Settings management | Environment variable parsing |

### Frontend

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.x | React framework | Turbopack stable, streaming SSR |
| TypeScript | 5.9+ | Type safety | Required for strict typing |
| Bun | latest | Package manager | Fast, workspace support |

### Development Tools

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| uv | latest | Python package manager | 10-100x faster than pip |
| Ruff | 0.14+ | Python lint + format | Replaces Black, Flake8, isort |
| Lefthook | latest | Git hooks | Fast, polyglot, monorepo support |
| ESLint | 9.x | TypeScript linting | Standard for TS projects |
| Prettier | 3.x | Code formatting | Standard for JS/TS |

### Type Generation

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| openapi-typescript | latest | OpenAPI -> TS | Matches the HTTP contract; robust, widely used |
| datamodel-codegen | latest | Alternative generator | More flexible, CI/CD ready |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Terraform | Pulumi | Pulumi better for complex logic but Terraform has more GCP examples |
| Bun | pnpm | pnpm more mature but Bun faster |
| uv | pip/poetry | pip universal but uv 10-100x faster |
| Lefthook | Husky | Husky Node-only, Lefthook polyglot |
| sse-starlette | starlette built-in | sse-starlette has better disconnect handling |

**Installation:**

```bash
# Backend (in /backend)
uv init
uv add fastapi uvicorn pydantic pydantic-settings
uv add sqlalchemy asyncpg alembic
uv add sse-starlette google-cloud-storage
uv add --dev ruff mypy

# Frontend (in /frontend)
bun create next-app . --typescript --tailwind --eslint --app --src-dir
bun add -d @types/node

# Root
bun add -D lefthook
bunx lefthook install
```

## Architecture Patterns

### Recommended Project Structure

```
legal-lens/
├── .github/
│   └── workflows/
│       └── deploy.yml           # CI/CD pipeline
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Settings with pydantic-settings
│   │   ├── database.py          # Async engine setup
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── health.py        # Health endpoint
│   │   │   └── sse.py           # SSE endpoint skeleton
│   │   ├── models/
│   │   │   └── __init__.py      # SQLAlchemy models
│   │   └── schemas/
│   │       └── __init__.py      # Pydantic schemas
│   ├── alembic/
│   │   ├── env.py               # Async migration env
│   │   └── versions/
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── src/
│   │   └── app/
│   │       ├── layout.tsx
│   │       └── page.tsx
│   ├── Dockerfile
│   ├── next.config.js
│   └── package.json
├── packages/
│   └── types/
│       ├── src/
│       │   └── generated/       # Generated TS types
│       └── package.json
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── cloud-run.tf
│   ├── cloud-sql.tf
│   ├── gcs.tf
│   └── iam.tf
├── docker-compose.yml           # Local PostgreSQL
├── Makefile
├── lefthook.yml
├── package.json                 # Root workspace config
└── bun.lockb
```

### Pattern 1: Workload Identity Federation Authentication

**What:** Keyless authentication from GitHub Actions to GCP using OIDC tokens
**When to use:** All CI/CD deployments to GCP

```yaml
# Source: https://github.com/google-github-actions/auth
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Required for OIDC

    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v3
        with:
          project_id: ${{ vars.GCP_PROJECT_ID }}
          workload_identity_provider: projects/${{ vars.GCP_PROJECT_NUMBER }}/locations/global/workloadIdentityPools/github/providers/github-actions

      - uses: google-github-actions/deploy-cloudrun@v3
        with:
          service: legal-lens-backend
          region: europe-west3
          image: ${{ vars.ARTIFACT_REGISTRY }}/${{ vars.GCP_PROJECT_ID }}/legal-lens/backend:${{ github.sha }}
```

### Pattern 2: Async SQLAlchemy Engine Setup

**What:** Connection pooling with asyncpg for Cloud Run
**When to use:** All database connections

```python
# Source: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
# backend/app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings

# Cloud Run specific: smaller pool due to instance scaling
engine = create_async_engine(
    settings.database_url,  # postgresql+asyncpg://...
    pool_size=5,            # Small for Cloud Run cold starts
    max_overflow=10,        # Allow bursting
    pool_pre_ping=True,     # Verify connections before use
    pool_recycle=1800,      # Recycle connections every 30 min
    echo=settings.debug,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

### Pattern 3: SSE Endpoint with Heartbeat

**What:** SSE streaming with proper headers for Cloud Run
**When to use:** All real-time streaming endpoints

```python
# Source: https://pypi.org/project/sse-starlette/
# backend/app/api/sse.py
import asyncio
from fastapi import APIRouter
from sse_starlette import EventSourceResponse
from starlette.responses import Response

router = APIRouter()

async def heartbeat_generator():
    """Generate heartbeat events to keep connection alive."""
    while True:
        yield {"event": "heartbeat", "data": "ping"}
        await asyncio.sleep(15)  # 15 second heartbeat per REQ-INF-004

@router.get("/sse/heartbeat")
async def sse_heartbeat():
    """SSE endpoint skeleton with heartbeat only."""
    return EventSourceResponse(
        heartbeat_generator(),
        headers={
            "X-Accel-Buffering": "no",       # Disable nginx buffering
            "Cache-Control": "no-cache, no-transform",
        }
    )
```

### Pattern 4: FastAPI App Configuration for SSE

**What:** Proper middleware configuration for SSE compatibility
**When to use:** FastAPI app initialization

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# DO NOT import GZipMiddleware - incompatible with SSE

from app.api import health, sse
from app.config import settings

app = FastAPI(title="Legal Lens API")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# NOTE: Do NOT add GZipMiddleware - breaks SSE streaming

app.include_router(health.router, tags=["health"])
app.include_router(sse.router, tags=["sse"])
```

### Pattern 5: Alembic Async Configuration

**What:** Async migration environment setup
**When to use:** Database migrations with asyncpg

```python
# Source: https://alembic.sqlalchemy.org/en/latest/cookbook.html
# backend/alembic/env.py
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

from app.models import Base  # Import all models
from app.config import settings

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### Pattern 6: Terraform Cloud Run with Cloud SQL

**What:** Cloud Run v2 service with Cloud SQL connection
**When to use:** Backend service deployment

```hcl
# Source: https://docs.cloud.google.com/run/docs/samples/cloudrun-connect-cloud-sql-parent-tag
# terraform/cloud-run.tf
resource "google_cloud_run_v2_service" "backend" {
  name                = "legal-lens-backend"
  location            = var.region
  deletion_protection = false  # Set true in production

  template {
    service_account = google_service_account.backend.email

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image = "${var.artifact_registry}/${var.project_id}/legal-lens/backend:latest"

      ports {
        container_port = 8080
      }

      env {
        name  = "PYTHONUNBUFFERED"
        value = "1"
      }

      env {
        name  = "DATABASE_URL"
        value = "postgresql+asyncpg://${google_sql_user.backend.name}:${google_sql_user.backend.password}@/${google_sql_database.legal-lens.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    # Enable response streaming for SSE
    timeout = "300s"
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
    google_project_service.sqladmin,
  ]
}
```

### Pattern 7: Bun Workspaces Configuration

**What:** Monorepo workspace setup
**When to use:** Root package.json

```json
{
  "name": "legal-lens",
  "private": true,
  "workspaces": [
    "frontend",
    "packages/*"
  ],
  "scripts": {
    "dev:frontend": "bun --cwd frontend dev",
    "build:frontend": "bun --cwd frontend build",
    "generate-types": "make generate-types",
    "lint": "bun run lint:frontend && bun run lint:backend",
    "lint:frontend": "bun --cwd frontend lint",
    "lint:backend": "cd backend && uv run ruff check .",
    "format": "bun run format:frontend && bun run format:backend",
    "format:frontend": "bun --cwd frontend prettier --write .",
    "format:backend": "cd backend && uv run ruff format ."
  }
}
```

### Anti-Patterns to Avoid

- **GZipMiddleware with SSE:** Never add GZipMiddleware when using sse-starlette - it buffers responses and breaks streaming
- **Large connection pools on Cloud Run:** Don't use pool_size > 10 - instances scale horizontally
- **Sync database calls:** Never use synchronous psycopg2 - always asyncpg
- **Service account keys in CI:** Never export long-lived JSON keys - use Workload Identity Federation
- **Shared Terraform state in repo:** Don't commit .tfstate - use GCS backend (or local for hackathon)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub → GCP auth | Custom OIDC handling | google-github-actions/auth | Handles token refresh, attribute mapping |
| Cloud Run deployment | gcloud CLI scripts | google-github-actions/deploy-cloudrun | Handles image tags, traffic splitting |
| SSE streaming | Custom StreamingResponse | sse-starlette | W3C compliant, disconnect detection |
| Database migrations | Manual SQL scripts | Alembic with async template | Autogenerate, rollback support |
| Connection pooling | asyncpg.Pool directly | SQLAlchemy async engine | ORM integration, connection recycling |
| Python env management | pip + venv | uv | 10-100x faster, lockfile support |
| Git hooks | shell scripts | Lefthook | Parallel execution, staged file filtering |
| Type generation | Manual TS interfaces | openapi-typescript (from FastAPI OpenAPI) | Keeps types aligned with the API contract |

**Key insight:** Infrastructure code has many edge cases (retries, timeouts, cleanup). The standard tools handle these; custom solutions will rediscover them painfully.

## Common Pitfalls

### Pitfall 1: Workload Identity Federation Propagation Delay

**What goes wrong:** WIF configuration appears to fail immediately after creation
**Why it happens:** IAM permissions take up to 5 minutes to propagate
**How to avoid:** Wait 5 minutes after Terraform apply before first GitHub Actions run
**Warning signs:** "Permission denied" errors on first deployment only

### Pitfall 2: SSE Buffering in Production

**What goes wrong:** SSE works locally but events arrive in batches in production
**Why it happens:** Nginx/proxies buffer responses by default
**How to avoid:** Set `X-Accel-Buffering: no` header, `Cache-Control: no-cache, no-transform`
**Warning signs:** Events arrive in bursts after delays, works in dev but not prod

### Pitfall 3: Cloud Run Connection Limits

**What goes wrong:** Database connection errors under load
**Why it happens:** Each Cloud Run instance limited to 100 connections to Cloud SQL
**How to avoid:** Use small pool_size (5), enable pool_pre_ping, set pool_recycle
**Warning signs:** "too many connections" errors, intermittent failures

### Pitfall 4: Async Migration Event Loop Conflict

**What goes wrong:** Alembic migrations fail with "event loop already running"
**Why it happens:** Running async migrations inside an existing event loop
**How to avoid:** Initialize Alembic with `alembic init -t async migrations`
**Warning signs:** RuntimeError about event loops in migration scripts

### Pitfall 5: Cloud Run Request Timeout for SSE

**What goes wrong:** SSE connections drop after 5 minutes
**Why it happens:** Default Cloud Run timeout is 300 seconds
**How to avoid:** Set timeout in Terraform (up to 3600s), implement 15s heartbeat
**Warning signs:** Consistent disconnects at exactly 5 minutes

### Pitfall 6: Next.js Standalone Mode File Copying

**What goes wrong:** Next.js Docker image missing public/static files
**Why it happens:** Standalone output doesn't include public folder
**How to avoid:** Copy public and .next/static to standalone folder in Dockerfile
**Warning signs:** 404 errors for static assets in production

## Code Examples

### Backend Dockerfile (Production)

```dockerfile
# Source: https://fastapi.tiangolo.com/deployment/docker/
# backend/Dockerfile
FROM python:3.12-slim AS base

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install uv for dependency management
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Copy application code
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

# Run with uvicorn
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Frontend Dockerfile (Production)

```dockerfile
# Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
# frontend/Dockerfile
FROM oven/bun:latest AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

FROM oven/bun:latest AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
```

### Next.js Config for Standalone

```javascript
// frontend/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Other config...
}

module.exports = nextConfig
```

### Terraform WIF Setup

```hcl
# terraform/iam.tf
# Source: https://cloud.google.com/blog/products/identity-security/enabling-keyless-authentication-from-github-actions

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions Pool"
}

resource "google_iam_workload_identity_pool_provider" "github_actions" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions"

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.actor"            = "assertion.actor"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
  }

  # CRITICAL: Restrict to your org/repo only
  attribute_condition = "assertion.repository_owner == '${var.github_org}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github_actions" {
  project      = var.project_id
  account_id   = "github-actions"
  display_name = "GitHub Actions Service Account"
}

resource "google_service_account_iam_binding" "github_actions_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_org}/${var.github_repo}"
  ]
}

# Grant necessary permissions to the service account
resource "google_project_iam_member" "github_actions_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_artifact_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}
```

### Cloud SQL PostgreSQL Instance

```hcl
# terraform/cloud-sql.tf
resource "google_sql_database_instance" "main" {
  name             = "legal-lens-db"
  database_version = "POSTGRES_17"  # PostgreSQL 18 not yet available
  region           = var.region
  project          = var.project_id

  settings {
    tier = "db-g1-small"  # Safest tier per CONTEXT.md

    ip_configuration {
      ipv4_enabled = false
      # Private IP via default VPC
      private_network = "projects/${var.project_id}/global/networks/default"
    }

    backup_configuration {
      enabled = false  # No backups per CONTEXT.md (hackathon)
    }
  }

  deletion_protection = false  # Set true in production
}

resource "google_sql_database" "legal-lens" {
  name     = "legal-lens"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "backend" {
  name     = "backend"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}
```

### GCS Bucket with CORS

```hcl
# terraform/gcs.tf
resource "google_storage_bucket" "evidence" {
  name          = "${var.project_id}-evidence"
  location      = var.region
  force_destroy = true  # Allow deletion with objects for hackathon

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]  # Restrict in production
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    condition {
      age = 30  # Clean up old files after 30 days
    }
    action {
      type = "Delete"
    }
  }
}

# Service account for backend to access bucket
resource "google_storage_bucket_iam_member" "backend_access" {
  bucket = google_storage_bucket.evidence.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend.email}"
}
```

### Lefthook Configuration

```yaml
# lefthook.yml
# Source: https://github.com/evilmartians/lefthook
pre-commit:
  parallel: true
  commands:
    ruff-check:
      glob: "backend/**/*.py"
      run: cd backend && uv run ruff check {staged_files}
    ruff-format:
      glob: "backend/**/*.py"
      run: cd backend && uv run ruff format --check {staged_files}
    eslint:
      glob: "frontend/**/*.{js,ts,tsx}"
      run: bun --cwd frontend eslint {staged_files}
    prettier:
      glob: "frontend/**/*.{js,ts,tsx,json,css,md}"
      run: bun --cwd frontend prettier --check {staged_files}
```

### Ruff Configuration

```toml
# backend/pyproject.toml
[project]
name = "legal-lens-backend"
version = "0.1.0"
requires-python = ">=3.12"

[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = [
    "E",   # pycodestyle errors
    "F",   # pyflakes
    "I",   # isort
    "B",   # flake8-bugbear
    "UP",  # pyupgrade
]
ignore = [
    "E501",  # line too long (handled by formatter)
]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

### Health Endpoint

```python
# backend/app/api/health.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db

router = APIRouter()

@router.get("/health")
async def health():
    """Basic health check."""
    return {"status": "healthy"}

@router.get("/health/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    """Health check with database verification."""
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Service account key JSON | Workload Identity Federation | 2023 | No long-lived secrets in CI |
| Cloud Run v1 API | Cloud Run v2 API (google_cloud_run_v2_service) | 2024 | Better streaming support |
| Gunicorn + Uvicorn | Uvicorn with --workers | 2024 | Simpler, Uvicorn handles workers now |
| tiangolo/uvicorn-gunicorn-fastapi | Build from scratch | 2024 | Official image deprecated |
| pip + requirements.txt | uv + pyproject.toml | 2024 | 10-100x faster, better lockfiles |
| Black + isort + Flake8 | Ruff | 2024 | Single tool, 10-100x faster |
| Husky (Node.js) | Lefthook | 2024 | Polyglot support, faster |
| SQLAlchemy 1.4 async | SQLAlchemy 2.0 async | 2023 | Better typing, cleaner API |
| psycopg2 | asyncpg | 2023 | Async-native, better performance |

**Deprecated/outdated:**
- `tiangolo/uvicorn-gunicorn-fastapi` Docker image - deprecated, build from scratch
- `google_cloud_run_service` Terraform resource - use `google_cloud_run_v2_service`
- Pydantic v1 validators - use `field_validator` and `model_validator`
- Service account key authentication - use Workload Identity Federation

## Open Questions

Things that couldn't be fully resolved:

1. **PostgreSQL 18 on Cloud SQL**
   - What we know: CONTEXT.md specifies PostgreSQL 18
   - What's unclear: Cloud SQL may not have 18 available yet (17 is latest confirmed)
   - Recommendation: Use PostgreSQL 17, upgrade when 18 available

2. **Exact sse-starlette behavior with Cloud Run v2**
   - What we know: SSE generally works with proper headers
   - What's unclear: Some reports of buffering issues in ADK forum discussions
   - Recommendation: Test early, implement 15s heartbeat, have polling fallback ready

3. **Next.js 16.1 Docker standalone specifics**
   - What we know: Standalone mode works with proper file copying
   - What's unclear: Any 16.1-specific changes to standalone output
   - Recommendation: Follow standard pattern, adjust if needed during implementation

## Sources

### Primary (HIGH confidence)
- [GitHub Actions Auth Action](https://github.com/google-github-actions/auth) - WIF setup instructions
- [GitHub Actions Deploy Cloud Run](https://github.com/google-github-actions/deploy-cloudrun) - Deployment patterns
- [SQLAlchemy 2.0 Async Documentation](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) - Async engine patterns
- [FastAPI Docker Deployment](https://fastapi.tiangolo.com/deployment/docker/) - Official Dockerfile guidance
- [Next.js Standalone Output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) - Standalone configuration
- [sse-starlette PyPI](https://pypi.org/project/sse-starlette/) - SSE implementation
- [Alembic Cookbook](https://alembic.sqlalchemy.org/en/latest/cookbook.html) - Async migrations
- [Cloud Run Request Timeout](https://docs.cloud.google.com/run/docs/configuring/request-timeout) - Timeout configuration
- [Terraform google_cloud_run_v2_service](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_v2_service) - Cloud Run v2 resources
- [Ruff Configuration](https://docs.astral.sh/ruff/configuration/) - Linter/formatter setup
- [uv Projects](https://docs.astral.sh/uv/guides/projects/) - Python package management
- [Bun Workspaces](https://bun.com/docs/guides/install/workspaces) - Monorepo setup

### Secondary (MEDIUM confidence)
- [Cloud Run Streaming Blog](https://cloud.google.com/blog/products/serverless/cloud-run-now-supports-http-grpc-server-streaming) - SSE support announcement
- [Lefthook GitHub](https://github.com/evilmartians/lefthook) - Git hooks documentation
- [openapi-typescript](https://github.com/openapi-ts/openapi-typescript) - Type generation tool
- [Deploy Next.js to Cloud Run Guide](https://dev.to/rushi-patel/deploy-next-js-app-to-google-cloud-run-with-github-actions-cicd-a-complete-guide-l29) - CI/CD patterns

### Tertiary (LOW confidence)
- [SSE Production Issues Discussion](https://discuss.google.dev/t/sse-on-cloud-run-is-it-working-for-anyone/151803) - Community reports on SSE issues
- Forum discussions about ADK + SSE on Cloud Run

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation verified
- Architecture: HIGH - Standard patterns from official sources
- CI/CD patterns: HIGH - Official GitHub Actions verified
- SSE configuration: MEDIUM - Some community reports of issues, needs testing
- Terraform patterns: HIGH - Official provider documentation
- Pitfalls: HIGH - Verified from official docs and PITFALLS.md

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - stable infrastructure tooling)
