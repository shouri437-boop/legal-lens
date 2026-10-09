---
phase: 02-authentication-case-shell
plan: 05
subsystem: ui
tags: [next.js, better-auth, sidebar, broadcast-channel, sonner, lucide-react]

# Dependency graph
requires:
  - phase: 02-03
    provides: Better Auth server configuration and auth client
  - phase: 02-04
    provides: Auth UI components for login/signup flow
provides:
  - App shell layout with collapsible sidebar
  - Logout hook with multi-tab sync via BroadcastChannel
  - UserMenu component with avatar, name, and dropdown
  - Sidebar navigation with hover-to-expand behavior
  - AuthListener for cross-tab session sync
affects: [02-06, 02-07, phase-3]

# Tech tracking
tech-stack:
  added: []
  patterns: [BroadcastChannel for cross-tab sync, server-side session validation in layout, hover-expand sidebar]

key-files:
  created:
    - frontend/src/hooks/use-logout.ts
    - frontend/src/components/app/auth-listener.tsx
    - frontend/src/components/app/sidebar.tsx
    - frontend/src/components/app/user-menu.tsx
    - frontend/src/app/(app)/layout.tsx
  modified:
    - frontend/src/hooks/index.ts

key-decisions:
  - "BroadcastChannel for multi-tab logout sync - native browser API, no external dependency"
  - "Server-side session validation in layout as defense-in-depth (middleware is first line)"
  - "User object normalization in layout to ensure consistent prop types"

patterns-established:
  - "Multi-tab sync pattern: BroadcastChannel for auth events across tabs"
  - "App shell pattern: Sidebar with hover-expand, user menu at bottom"
  - "Server layout pattern: Session validation with redirect, normalized user props"

# Metrics
duration: 8min
completed: 2026-01-25
---

# Phase 2 Plan 05: App Shell Summary

**Collapsible sidebar with hover-expand behavior, user menu with logout, and multi-tab session sync via BroadcastChannel**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-25T01:00:00Z
- **Completed:** 2026-01-25T01:08:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Logout hook with toast feedback and BroadcastChannel for multi-tab sync
- AuthListener component that responds to logout events across browser tabs
- Collapsible sidebar navigation (64px collapsed, 240px expanded) with hover-to-expand
- UserMenu with avatar (image or initials fallback), name display, and logout dropdown
- App layout with server-side session validation and defense-in-depth redirect

## Task Commits

Each task was committed atomically:

1. **Task 1: Create logout hook and auth listener** - `b4c6827` (feat)
2. **Task 2: Create sidebar and user menu components** - `32afad2` (feat)
3. **Task 3: Create app layout with server-side auth** - `ccd69e7` (feat)

## Files Created/Modified

- `frontend/src/hooks/use-logout.ts` - Logout hook with signOut, toast, and BroadcastChannel sync
- `frontend/src/hooks/index.ts` - Added useLogout export
- `frontend/src/components/app/auth-listener.tsx` - Client component for cross-tab logout sync
- `frontend/src/components/app/sidebar.tsx` - Collapsible sidebar with navigation and user menu
- `frontend/src/components/app/user-menu.tsx` - Avatar dropdown with logout option
- `frontend/src/app/(app)/layout.tsx` - Server component layout with session validation

## Decisions Made

- **BroadcastChannel for sync:** Used native browser API for cross-tab logout rather than external library - works in all modern browsers, no dependencies
- **Server-side validation in layout:** Added session check in (app) layout as defense-in-depth beyond middleware protection
- **User object normalization:** Layout normalizes session.user to ensure image property is always present (null fallback) for consistent TypeScript types

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all components created and integrated successfully.

## User Setup Required

None - no additional external service configuration required.

## Next Phase Readiness

- App shell complete with authenticated layout at (app) route group
- Ready for Plan 06 (Case Detail Shell) to build individual case pages
- Sidebar navigation already links to /cases (Plan 07 Case List provides the page)
- Multi-tab sync ensures consistent session state across browser tabs

---
*Phase: 02-authentication-case-shell*
*Completed: 2026-01-25*
