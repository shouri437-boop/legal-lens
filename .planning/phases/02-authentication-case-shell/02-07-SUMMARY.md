---
phase: 02-authentication-case-shell
plan: 07
subsystem: infra
tags: [terraform, secret-manager, cloud-run, cloud-sql, github-actions, alembic, ci-cd]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure
    provides: Base terraform with Cloud Run services, Cloud SQL, IAM roles
provides:
  - Secret Manager resources for Better Auth secrets (BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  - Frontend Cloud Run with Cloud SQL access and secret references
  - Backend Cloud Run with FRONTEND_URL for JWKS verification
  - Frontend IAM Cloud SQL client role
  - CI/CD with Alembic migrations via Cloud SQL Proxy
  - CI/CD with post-deploy env var updates
affects: [03-file-ingestion, production-deployment]

# Tech tracking
tech-stack:
  added: [cloud-sql-proxy]
  patterns:
    - Secret Manager secret references in Cloud Run env vars
    - Cloud SQL Proxy for CI/CD database access
    - Post-deploy service URL updates

key-files:
  created:
    - terraform/secrets.tf
  modified:
    - terraform/cloud-run.tf
    - terraform/iam.tf
    - .github/workflows/deploy.yml

key-decisions:
  - "Cloud SQL Proxy for CI/CD migrations instead of Cloud Run jobs"
  - "Secret Manager references (not values) in terraform"
  - "Post-deploy job to update cross-service URLs"

patterns-established:
  - "Secret references: use secret_key_ref with latest version in Cloud Run"
  - "CI/CD migrations: Cloud SQL Proxy with ephemeral connection"
  - "Service URLs: update-env job after both services deploy"

# Metrics
duration: 3min
completed: 2026-01-24
---

# Phase 2 Plan 7: Auth Deployment Infrastructure Summary

**Secret Manager resources for Better Auth, frontend Cloud SQL access with secret injection, and CI/CD Alembic migrations via Cloud SQL Proxy**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-01-24T22:55:00Z
- **Completed:** 2026-01-24T22:58:41Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Created Secret Manager secrets for BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET with frontend service account access
- Updated frontend Cloud Run with Cloud SQL volume mount, DATABASE_URL, BETTER_AUTH_URL, and secret references
- Added FRONTEND_URL env var to backend for JWKS endpoint verification
- Replaced Cloud Run job migration approach with Cloud SQL Proxy for CI/CD
- Added update-env job to set cross-service URLs after deployment

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Secret Manager resources for auth secrets** - `e81d3dd` (feat)
2. **Task 2: Update Cloud Run services with database, secrets, and cross-service URLs** - `ed30c02` (feat)
3. **Task 3: Update CI/CD with migrations and auth env vars** - `42aa096` (feat)

## Files Created/Modified
- `terraform/secrets.tf` - Secret Manager resources for auth secrets with IAM bindings
- `terraform/cloud-run.tf` - Updated frontend with Cloud SQL mount and secrets, backend with FRONTEND_URL
- `terraform/iam.tf` - Added frontend Cloud SQL client IAM role
- `.github/workflows/deploy.yml` - Alembic migrations via Cloud SQL Proxy, update-env job

## Decisions Made
- **Cloud SQL Proxy for migrations:** Replaced Cloud Run job approach with Cloud SQL Proxy in CI/CD - more reliable and doesn't require separate job infrastructure
- **Secret references only:** Terraform creates secret containers; actual values added manually via GCP Console (security best practice)
- **Post-deploy URL updates:** Added update-env job to set FRONTEND_URL (backend) and BETTER_AUTH_URL (frontend) after both services deploy, solving chicken-and-egg URL problem

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** Before production deployment:

1. **Create secret values in Secret Manager:**
   - `better-auth-secret`: Generate with `openssl rand -base64 32`
   - `google-client-id`: From Google Cloud Console -> APIs & Services -> Credentials
   - `google-client-secret`: From Google Cloud Console -> APIs & Services -> Credentials

2. **Add GitHub repository secret:**
   - `DB_PASSWORD`: Database password for migration job

3. **Configure OAuth redirect URI:**
   - Add production Cloud Run URL to OAuth 2.0 Client ID authorized redirect URIs

## Next Phase Readiness
- Deployment infrastructure ready for Better Auth
- Secrets must be populated before auth will work in production
- Frontend can now access PostgreSQL for session storage
- Backend can verify JWTs via frontend JWKS endpoint

---
*Phase: 02-authentication-case-shell*
*Plan: 07*
*Completed: 2026-01-24*
