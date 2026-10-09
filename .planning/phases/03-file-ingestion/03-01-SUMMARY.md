---
phase: 03-file-ingestion
plan: 01
subsystem: database
tags: [sqlalchemy, pydantic, alembic, postgresql, file-storage]

# Dependency graph
requires:
  - phase: 02-auth-case-shell
    provides: Case model and cases table for foreign key relationship
provides:
  - CaseFile SQLAlchemy model with FileStatus and FileCategory enums
  - Alembic migration for case_files table
  - Pydantic schemas for file upload/download API
affects: [03-02, 03-03, phase-4-agents]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "File status enum with 6-state lifecycle (UPLOADING -> ANALYZED)"
    - "Composite index for duplicate detection (case_id, content_hash)"
    - "FileResponse.from_orm_with_name() for mapping original_filename to name"

key-files:
  created:
    - backend/app/models/file.py
    - backend/app/schemas/file.py
    - backend/alembic/versions/461979103c5a_add_case_files_table.py
  modified:
    - backend/app/models/__init__.py
    - backend/app/models/case.py
    - backend/app/schemas/__init__.py

key-decisions:
  - "SHA-256 content hash stored as 64-char hex string for duplicate detection"
  - "Geolocation fields (latitude/longitude) for mobile upload metadata"
  - "BigInteger for size_bytes to support files up to 500MB+"

patterns-established:
  - "File status lifecycle: UPLOADING -> UPLOADED -> QUEUED -> PROCESSING -> ANALYZED | ERROR"
  - "GCS path convention: cases/{case_id}/files/{file_uuid}.{ext}"
  - "Duplicate detection via (case_id, content_hash) composite index"

# Metrics
duration: 12min
completed: 2026-02-02
---

# Phase 3 Plan 1: File Model & Schemas Summary

**CaseFile SQLAlchemy model with 6-state status lifecycle, Alembic migration for case_files table, and Pydantic schemas for file upload/list/download APIs**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-02T06:10:00Z
- **Completed:** 2026-02-02T06:22:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- CaseFile model with all fields from CONTEXT.md (filename, storage path, MIME type, size, hash, geolocation, page count, duration)
- FileStatus enum with 6 states for tracking file processing lifecycle
- FileCategory enum for auto-categorization (DOCUMENT, IMAGE, VIDEO, AUDIO)
- Alembic migration with proper indexes and CASCADE delete constraint
- Pydantic schemas ready for file upload API (FileCreate, FileResponse, FileListResponse, DownloadUrlResponse, FileStatusUpdate)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CaseFile model with enums** - `0ac6785` (feat)
2. **Task 2: Create Alembic migration for case_files table** - `3a1bf90` (feat)
3. **Task 3: Create Pydantic schemas for file API** - `8e7d77f` (feat)

## Files Created/Modified
- `backend/app/models/file.py` - CaseFile SQLAlchemy model with FileStatus and FileCategory enums
- `backend/app/schemas/file.py` - Pydantic schemas for file API requests/responses
- `backend/alembic/versions/461979103c5a_add_case_files_table.py` - Migration creating case_files table
- `backend/app/models/__init__.py` - Export CaseFile, FileStatus, FileCategory
- `backend/app/models/case.py` - Add files relationship to Case model
- `backend/app/schemas/__init__.py` - Export file schemas

## Decisions Made
- Used SHA-256 for content hashing (64-char hex string) per CONTEXT.md recommendation
- Added latitude/longitude Float fields for mobile geolocation metadata
- Used BigInteger for size_bytes to support large files (500MB limit per CONTEXT.md)
- FileResponse includes duplicate_of field for warning users about duplicate content
- Added from_orm_with_name classmethod for clean mapping of original_filename to display name

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Ruff pre-commit hook caught unsorted imports in file.py on first commit attempt - auto-fixed with `ruff check --fix`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Database model and schemas ready for Plan 02 (GCS storage service)
- Migration can be applied when ready: `alembic upgrade head`
- File upload API endpoints can now be built using these schemas

---
*Phase: 03-file-ingestion*
*Completed: 2026-02-02*
