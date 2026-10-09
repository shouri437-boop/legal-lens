---
phase: 02-authentication-case-shell
plan: 06
subsystem: ui
tags: [react, next.js, zod, react-hook-form, case-management, modal]

# Dependency graph
requires:
  - phase: 02-02
    provides: API client with JWT authentication
  - phase: 02-03
    provides: Backend case CRUD endpoints
  - phase: 02-05
    provides: App shell layout with sidebar
provides:
  - Case list page with grid/list view toggle
  - Case creation modal with form validation
  - Individual case page shell
  - Case card component with status badges
  - Empty state component
affects: [03-file-ingestion, 09-chat-interface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - API data fetching with JWT via api client
    - Modal dialog with backdrop blur
    - Skeleton loading states
    - Relative time formatting

key-files:
  created:
    - frontend/src/types/case.ts
    - frontend/src/lib/validations/case.ts
    - frontend/src/components/app/case-card.tsx
    - frontend/src/components/app/case-list.tsx
    - frontend/src/components/app/empty-state.tsx
    - frontend/src/components/app/create-case-modal.tsx
    - frontend/src/app/(app)/cases/page.tsx
    - frontend/src/app/(app)/cases/[id]/page.tsx
  modified: []

key-decisions:
  - "Used native window.confirm for delete confirmation (simple, can enhance later)"
  - "Grid/list view state stored in component (could persist to localStorage later)"
  - "Pagination uses simple prev/next rather than page numbers"

patterns-established:
  - "Empty state component: reusable for cases, files, and other empty collections"
  - "Case card: dual-mode component supporting both grid and list layouts"
  - "Modal dialog: backdrop blur with click-outside-to-close behavior"
  - "Relative time: formatRelativeTime helper for human-readable timestamps"

# Metrics
duration: ~15min
completed: 2026-01-25
---

# Phase 02 Plan 06: Case List & Creation UI Summary

**Case management UI with grid/list toggle, creation modal using react-hook-form + Zod, and individual case page shell**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-01-25
- **Completed:** 2026-01-25
- **Tasks:** 3
- **Files created:** 8

## Accomplishments

- Case types and Zod validation schemas matching backend API
- CaseList component with grid/list view toggle, sort dropdown, and pagination
- CaseCard component with status badges (Draft/Processing/Ready/Error) and delete functionality
- CreateCaseModal with react-hook-form validation and API integration
- EmptyState component for reusable empty collection displays
- /cases page displaying user's cases with create/delete actions
- /cases/[id] page shell with back navigation and file upload placeholder

## Task Commits

Each task was committed atomically:

1. **Task 1: Create case types and validation schemas** - `15f66f6` (feat)
2. **Task 2: Create case list components** - `f39e2f0` (feat)
3. **Task 3: Create case creation modal and pages** - `0635d76` (feat)

## Files Created/Modified

- `frontend/src/types/case.ts` - Case, CaseListResponse, CaseCreateInput types
- `frontend/src/lib/validations/case.ts` - Zod schema for case creation form
- `frontend/src/components/app/case-card.tsx` - Dual-mode (grid/list) case display card
- `frontend/src/components/app/case-list.tsx` - Case list with view toggle, sort, pagination
- `frontend/src/components/app/empty-state.tsx` - Generic empty collection component
- `frontend/src/components/app/create-case-modal.tsx` - Modal dialog for creating cases
- `frontend/src/app/(app)/cases/page.tsx` - Cases list page route
- `frontend/src/app/(app)/cases/[id]/page.tsx` - Individual case page shell

## Decisions Made

- Used native `window.confirm` for delete confirmation - simple and functional, can be enhanced with custom modal later if needed
- Grid/list view preference stored in component state only - could be persisted to localStorage in future iteration
- Pagination uses simple prev/next buttons rather than numbered pages - appropriate for expected case volumes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Case management UI complete and integrated with backend API
- Individual case page shell ready for Phase 3 file upload integration
- Empty state component available for reuse in file lists

---
*Phase: 02-authentication-case-shell*
*Completed: 2026-01-25*
