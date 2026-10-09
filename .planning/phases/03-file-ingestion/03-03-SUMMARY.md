---
phase: 03-file-ingestion
plan: 03
subsystem: api
tags: [fastapi, gcs, signed-url, sse, react, file-management]

# Dependency graph
requires:
  - phase: 03-file-ingestion
    plan: 02
    provides: File upload endpoint, GCS upload service, CaseFile model
provides:
  - File list endpoint at GET /api/cases/{case_id}/files
  - File download via signed URL at GET /api/cases/{case_id}/files/{file_id}/download
  - File delete endpoint at DELETE /api/cases/{case_id}/files/{file_id}
  - SSE endpoint for real-time file status at /sse/cases/{case_id}/files
  - Frontend API client for file operations
  - CaseLibrary connected to real backend APIs
affects: [phase-4-agents, frontend-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "V4 signed URLs for secure file downloads (24h expiration)"
    - "In-memory pubsub for SSE file events (single instance)"
    - "RFC 5987 filename encoding for Content-Disposition"

key-files:
  created:
    - frontend/src/lib/api/files.ts
    - frontend/src/hooks/useFileUpload.ts
  modified:
    - backend/app/api/files.py
    - backend/app/api/sse.py
    - backend/app/services/file_service.py
    - backend/app/services/__init__.py
    - frontend/src/components/library/CaseLibrary.tsx

key-decisions:
  - "24-hour signed URL expiration for downloads"
  - "In-memory pubsub for SSE (suitable for single instance hackathon deployment)"
  - "Map all backend categories to 'evidence' in frontend (category metadata can be added later)"

patterns-established:
  - "get_user_file() helper for file ownership validation with case join"
  - "SSE event structure: {event: type, data: json_string}"
  - "Frontend API client pattern with getToken() for auth headers"

# Metrics
duration: 8min
completed: 2026-02-02
---

# Phase 3 Plan 3: File Management APIs Summary

**Complete file CRUD APIs with signed URL downloads, real-time SSE status updates, and frontend CaseLibrary integration**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-02T05:25:47Z
- **Completed:** 2026-02-02T05:33:42Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- GET /api/cases/{case_id}/files - paginated file listing with status/category filters
- GET /api/cases/{case_id}/files/{file_id}/download - V4 signed URL with 24h expiration
- DELETE /api/cases/{case_id}/files/{file_id} - hard delete from GCS and database
- SSE endpoint at /sse/cases/{case_id}/files for real-time file events
- Frontend CaseLibrary now fetches real files and handles upload/download/delete

## Task Commits

Each task was committed atomically:

1. **Task 1: Add list, download, delete endpoints** - `edb519c` (feat)
2. **Task 2: Add file status SSE endpoint** - `b31b97a` (feat)
3. **Task 3: Create frontend API client and integrate CaseLibrary** - `dc1a3c7` (feat)

## Files Created/Modified
- `backend/app/api/files.py` - Added list, download, delete endpoints with ownership validation
- `backend/app/api/sse.py` - Added file status SSE with pubsub
- `backend/app/services/file_service.py` - Added generate_signed_url function
- `backend/app/services/__init__.py` - Exported generate_signed_url
- `frontend/src/lib/api/files.ts` - API client for file operations
- `frontend/src/hooks/useFileUpload.ts` - Upload hook with state management
- `frontend/src/components/library/CaseLibrary.tsx` - Connected to real APIs

## Decisions Made
- 24-hour signed URL expiration for downloads (balance between security and usability)
- In-memory pubsub for SSE events (sufficient for single-instance hackathon deployment)
- RFC 5987 encoding for Content-Disposition filename (handles non-ASCII filenames)
- Map all backend categories to "evidence" in frontend (simplification for MVP)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Ruff flagged asyncio.TimeoutError as deprecated, auto-fixed to builtin TimeoutError
- Prettier formatting needed for frontend files before commit

## User Setup Required

None - GCS bucket and authentication already configured from previous phases.

## Next Phase Readiness
- File ingestion backend complete (upload, list, download, delete, SSE)
- Frontend CaseLibrary fully functional with real API
- Ready for Phase 4: Core Agent System (ADK, Triage, Orchestrator)
- Agents can now access uploaded files for processing

---
*Phase: 03-file-ingestion*
*Completed: 2026-02-02*
