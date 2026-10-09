---
phase: 01-foundation-infrastructure
plan: 02
subsystem: infra
tags: [terraform, gcp, cloud-run, cloud-sql, gcs, wif, github-actions]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure/01
    provides: Project structure and monorepo setup
provides:
  - Complete Terraform configuration for GCP infrastructure
  - Cloud Run services for backend and frontend
  - Cloud SQL PostgreSQL 17 database instance
  - GCS bucket for evidence storage
  - Workload Identity Federation for GitHub Actions CI/CD
  - Artifact Registry for Docker images
affects:
  - 01-foundation-infrastructure/03 (CI/CD pipelines will use WIF and Artifact Registry)
  - All phases (Cloud Run URLs, database connection, GCS bucket)

# Tech tracking
tech-stack:
  added:
    - terraform >= 1.9
    - google provider v6.x
    - google-beta provider v6.x
    - random provider (for password generation)
  patterns:
    - Hackathon mode (deletion_protection: false, no backups)
    - Placeholder images for chicken-and-egg Cloud Run deployment
    - Workload Identity Federation for keyless GitHub Actions auth

key-files:
  created:
    - terraform/main.tf
    - terraform/variables.tf
    - terraform/outputs.tf
    - terraform/cloud-sql.tf
    - terraform/gcs.tf
    - terraform/iam.tf
    - terraform/artifact-registry.tf
    - terraform/cloud-run.tf

key-decisions:
  - "Used db-g1-small tier for Cloud SQL (cost/performance sweet spot)"
  - "Placeholder image strategy for Cloud Run (us-docker.pkg.dev/cloudrun/container/hello)"
  - "Public IP for Cloud SQL for hackathon simplicity"
  - "No backups enabled (hackathon mode)"
  - "WIF restricts to specific GitHub org/repo"

patterns-established:
  - "Terraform local state (no remote backend for hackathon)"
  - "Environment-suffixed resource names (legal-lens-db-${var.environment})"
  - "Separate service accounts per Cloud Run service"

# Metrics
duration: 45min
completed: 2026-01-21
---

# Phase 01 Plan 02: Terraform Infrastructure Summary

**Complete GCP infrastructure via Terraform: Cloud Run (backend/frontend), Cloud SQL PostgreSQL 17, GCS evidence bucket, Artifact Registry, and Workload Identity Federation for GitHub Actions CI/CD**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-01-21T09:00:00Z
- **Completed:** 2026-01-21T09:45:00Z
- **Tasks:** 3
- **Files created:** 8

## Accomplishments

- Terraform configuration for complete GCP infrastructure
- Cloud SQL PostgreSQL 17 instance provisioned (db-g1-small tier)
- GCS bucket for evidence storage with CORS and 30-day lifecycle
- Cloud Run services for backend (port 8080) and frontend (port 3000)
- Artifact Registry repository for Docker images
- Workload Identity Federation pool for keyless GitHub Actions authentication
- Service accounts with appropriate IAM bindings

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Terraform base configuration** - `11e3ddb` (feat)
2. **Task 2: Create Cloud SQL and GCS resources** - `af2fe0a` (feat)
3. **Task 3: Create IAM, Artifact Registry, and Cloud Run resources** - `5d5ed08` (feat)

## Files Created

- `terraform/main.tf` - Provider configuration, API enablement
- `terraform/variables.tf` - Input variables (project_id, region, github_org, etc.)
- `terraform/outputs.tf` - Output values (URLs, connection strings, WIF provider)
- `terraform/cloud-sql.tf` - PostgreSQL 17 instance, database, user
- `terraform/gcs.tf` - Evidence storage bucket with CORS
- `terraform/iam.tf` - WIF pool, service accounts, IAM bindings
- `terraform/artifact-registry.tf` - Docker repository
- `terraform/cloud-run.tf` - Backend and frontend service definitions

## Decisions Made

1. **Database tier: db-g1-small** - User changed from db-f1-micro during provisioning. This tier provides 1 shared vCPU and 1.7GB RAM, better suited for the workload.

2. **Placeholder image strategy** - Used `us-docker.pkg.dev/cloudrun/container/hello` for both Cloud Run services to bypass the chicken-and-egg problem (can't deploy actual images until CI/CD is set up, can't set up CI/CD outputs until Cloud Run exists). Real images will be deployed by CI/CD pipeline in plan 01-03.

3. **Public Cloud SQL IP** - Enabled for hackathon simplicity. Production would use private networking.

4. **SSE timeout: 300s** - Backend Cloud Run timeout set to 5 minutes for Server-Sent Events streaming.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Infrastructure Provisioned

After `terraform apply`, the following resources exist in GCP:

| Resource | Name | Details |
|----------|------|---------|
| Cloud SQL | legal-lens-db-prod | PostgreSQL 17, db-g1-small, europe-west3 |
| GCS Bucket | {project_id}-evidence | 30-day lifecycle, CORS enabled |
| Cloud Run | legal-lens-backend | Placeholder image, port 8080 |
| Cloud Run | legal-lens-frontend | Placeholder image, port 3000 |
| Artifact Registry | legal-lens | Docker format, europe-west3 |
| WIF Pool | github-pool | GitHub Actions OIDC provider |
| Service Accounts | github-actions, backend, frontend | Appropriate IAM bindings |

## Next Phase Readiness

- Infrastructure is provisioned and ready
- CI/CD pipeline (01-03) can use WIF provider for keyless auth
- Cloud Run URLs are available for environment configuration
- Database connection string available for backend configuration
- GCS bucket ready for evidence uploads

**Blockers:** None

**Note:** Cloud Run services show placeholder "Hello" page until CI/CD deploys actual application images.

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-01-21*
