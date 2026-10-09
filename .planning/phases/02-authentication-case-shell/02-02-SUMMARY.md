---
phase: 02-authentication-case-shell
plan: 02
subsystem: api
tags: [fastapi, pydantic, crud, cases, ownership, soft-delete]

# Dependency graph
requires:
  - phase: 02-01
    provides: Case model, auth CurrentUser dependency
provides:
  - Case CRUD API endpoints (POST, GET, GET by ID, PATCH, DELETE)
  - Pydantic schemas for case operations (CaseCreate, CaseResponse, CaseUpdate)
  - User ownership enforcement on all case endpoints
  - Soft delete pattern for case deletion
affects:
  - 02-04 (UI needs API for case management)
  - 03-file-ingestion (file upload tied to cases)
  - Phase 4+ (agents operate on cases)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "User ownership enforcement via CurrentUser + user_id filter"
    - "Soft delete via deleted_at timestamp"
    - "Pydantic model_validate for SQLAlchemy to Pydantic conversion"
    - "404 for both not-found and forbidden (prevents enumeration)"

key-files:
  created:
    - backend/app/schemas/case.py
    - backend/app/api/cases.py
  modified:
    - backend/app/main.py

key-decisions:
  - "404 for all access denials (prevents case ID enumeration by other users)"
  - "Only name/description are user-editable (type is set at creation, status is system-managed)"
  - "Empty update rejection (at least one field required)"

patterns-established:
  - "CRUD endpoint pattern: filter by user_id + deleted_at.is_(None)"
  - "Pagination with total count using subquery"
  - "Partial update via model_dump(exclude_unset=True)"

# Metrics
duration: ~15min
completed: 2026-01-25
---

# Phase 2 Plan 02: Case CRUD API Summary

**Full case CRUD API with Pydantic validation, paginated listing, partial updates, and user ownership enforcement returning 404 for all access denials**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-01-25
- **Completed:** 2026-01-25
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Complete case CRUD API (create, list, get, update, delete)
- Pydantic schemas with validation (3-100 char name, 5000 char description limit)
- User ownership enforcement on all endpoints
- Paginated case listing with sorting
- Partial update support for name/description
- Soft delete implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Pydantic schemas** - `ba1f227` (feat)
2. **Task 2: Implement case CRUD endpoints** - `acbdb2a` (feat)
3. **Task 3: Add case update endpoint** - `d948d99` (feat)

## Files Created/Modified

- `backend/app/schemas/case.py` - Pydantic schemas (CaseCreate, CaseResponse, CaseListResponse, CaseListQuery, CaseUpdate)
- `backend/app/api/cases.py` - Case CRUD endpoints with ownership enforcement
- `backend/app/main.py` - Cases router registration

## Decisions Made

- **404 for access denied:** Returns 404 instead of 403 for cases not owned by user to prevent case ID enumeration attacks
- **Limited update fields:** Only name and description are user-editable; type is immutable after creation, status is system-managed (changes via processing pipeline)
- **Empty update rejection:** PATCH requires at least one field to prevent no-op requests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Case CRUD API ready for frontend integration
- Endpoints protected via CurrentUser dependency (requires valid JWT)
- Ready for file upload integration in Phase 3

---
*Phase: 02-authentication-case-shell*
*Completed: 2026-01-25*
