---
phase: 02-authentication-case-shell
plan: 01
subsystem: auth
tags: [jwt, jwks, pyjwt, cryptography, sqlalchemy, alembic, postgresql, fastapi]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: FastAPI backend structure, SQLAlchemy Base, database connection
  - phase: 02-07
    provides: Cloud Run auth infrastructure, Secret Manager for Better Auth secrets
provides:
  - Read-only SQLAlchemy models for Better Auth tables (User, Session, Account, Verification, Jwks)
  - Case model with CaseStatus and CaseType enums
  - get_current_user dependency for JWT validation via JWKS
  - /api/auth/me endpoint for testing authenticated requests
  - Alembic migration for cases table
affects:
  - 02-02: Case management endpoints will use Case model
  - 02-03: Auth pages need to issue JWTs that backend validates
  - 02-04: App shell requires user context from authenticated requests

# Tech tracking
tech-stack:
  added: [PyJWT>=2.10.0, cryptography>=43.0.0]
  patterns:
    - "JWKS-based JWT validation for cross-origin auth"
    - "Read-only models for externally-managed tables (Better Auth)"
    - "Manual Alembic migrations to exclude externally-managed tables"

key-files:
  created:
    - backend/app/models/auth.py
    - backend/app/models/case.py
    - backend/app/api/auth.py
    - backend/alembic/versions/d8ed3accb0f4_add_cases_table.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/config.py
    - backend/app/main.py
    - backend/pyproject.toml
    - backend/uv.lock

key-decisions:
  - "Use PyJWKClient for cached JWKS fetching from frontend"
  - "Support multiple JWT algorithms (EdDSA, ES256, RS256) for Better Auth flexibility"
  - "Manual migration for cases table to avoid including auth tables"
  - "extend_existing=True on auth models to prevent conflicts with Better Auth"

patterns-established:
  - "CurrentUser: Annotated type alias for dependency injection"
  - "Soft delete pattern with deleted_at column and partial index"
  - "Read-only model pattern with extend_existing=True"

# Metrics
duration: 3min
completed: 2026-01-25
---

# Phase 2 Plan 01: Backend Auth Infrastructure Summary

**JWKS-based JWT validation for Better Auth with PyJWT, read-only auth models, and Case model with soft delete**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-25T00:03:01Z
- **Completed:** 2026-01-25T00:06:07Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Read-only SQLAlchemy models for all Better Auth tables (User, Session, Account, Verification, Jwks)
- get_current_user dependency validating JWTs via PyJWKClient against frontend JWKS endpoint
- Case model with CaseStatus/CaseType enums, user relationship, and soft delete support
- /api/auth/me endpoint for testing authenticated backend requests
- Alembic migration creating only the cases table (Better Auth manages its own)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth models and JWT validation dependency** - `3619c3a` (feat)
2. **Task 2: Create Case model and database migration** - `fea8149` (feat)
3. **Task 3: Register auth router and add settings** - `c5d2ca6` (feat)

## Files Created/Modified

- `backend/app/models/auth.py` - Read-only SQLAlchemy models for Better Auth tables
- `backend/app/models/case.py` - Case model with status/type enums and user relationship
- `backend/app/api/auth.py` - JWT validation dependency with JWKS client and /api/auth/me endpoint
- `backend/alembic/versions/d8ed3accb0f4_add_cases_table.py` - Migration for cases table only
- `backend/app/models/__init__.py` - Export all models including Case
- `backend/app/config.py` - Added frontend_url setting for JWKS endpoint
- `backend/app/main.py` - Include auth router
- `backend/pyproject.toml` - Added PyJWT and cryptography dependencies
- `backend/uv.lock` - Updated lock file

## Decisions Made

- **PyJWKClient for JWKS:** Used PyJWT's built-in JWKS client with caching for efficient key fetching
- **Multiple algorithms:** Support EdDSA, ES256, RS256 to match Better Auth's algorithm flexibility
- **Manual migration:** Created migration manually (not autogenerate) to prevent including auth tables
- **Soft delete with partial index:** Case.deleted_at column with idx_cases_active partial index for efficient active-case queries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend auth infrastructure ready for case management endpoints (Plan 02)
- JWT validation will work once Better Auth is configured in frontend (Plan 03)
- Migration must run after Better Auth creates user table (Better Auth runs first on frontend start)

---
*Phase: 02-authentication-case-shell*
*Completed: 2026-01-25*
