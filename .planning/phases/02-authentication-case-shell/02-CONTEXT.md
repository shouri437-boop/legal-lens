# Phase 2: Authentication & Case Shell - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement Better Auth integration with email/password and Google OAuth, session management, protected routes, and case CRUD operations (create, list, delete). File upload UI is Phase 3. The case page shell exists but is empty until files are uploaded.

</domain>

<decisions>
## Implementation Decisions

### Login/Signup UI
- Single page with tabs (Login / Sign Up tabs, switch without navigation)
- Email form first, then "Or continue with Google" below with divider
- Inline validation errors directly below problematic fields
- Minimal/clean aesthetic — simple centered form, dark background, less visual complexity than landing page

### Case List Experience
- Both grid and list views available with toggle switch
- Minimal card/row content: name, status badge, file count, last updated
- Empty state: illustration/icon + message + prominent "Create Case" CTA
- Sort dropdown only (by name, date, status) — no filtering in Phase 2

### Case Creation Flow
- Modal dialog triggered by "New Case" button
- Phase 2 scope: Create step only (name + description fields)
- Case name is required
- Description field is optional with nudge hint ("This context helps the AI understand your case better")
- On success: navigate directly into the new case page (empty state ready for file upload)
- Full 3-step wizard (Create → Upload → Finish) deferred to Phase 3 integration

### Session Behavior
- No session timeout — persists until explicit logout
- Logout with feedback: brief toast "Logged out successfully" then redirect
- Unauthorized access: redirect to landing page (not login)
- Multi-tab sync: logout in one tab logs out all tabs

### App Shell / Navigation
- Collapsible left sidebar, minimized by default, expands on hover
- Minimized state: product logo at top, page icons below with active indicators
- Expanded state: full navigation labels visible
- Profile section at bottom of sidebar
- Profile display: avatar + name only (no email)
- Profile click: dropdown menu with Logout option (Settings page deferred)

### Claude's Discretion
- Exact sidebar width when collapsed/expanded
- Icon choices for navigation items
- Toast duration and positioning
- Loading states and skeleton patterns
- Transition animations for sidebar expand/collapse
- Exact empty state illustration style

</decisions>

<specifics>
## Specific Ideas

- Make sure to use the design guide in DOCS/UI/DESIGN-SYSTEM.md to align yourself for the UI.

- Auth page should be minimal/clean compared to the Liquid Glass landing page — functional, not decorative
- Sidebar pattern: minimized by default with hover-to-expand behavior (like Linear, Notion)
- Case cards should feel clean and scannable — not information-dense
- The multi-step wizard design shared will inform Phase 3's file upload integration

### Reference Design (for Phase 3 integration)
User provided detailed ASCII mockup for 3-step case creation wizard:
1. Create Case (name + description)
2. Upload Files (drag-and-drop with queue)
3. Finish & Process (triggers analysis, redirects to Command Center)

This design will guide Phase 3 file ingestion UI.

</specifics>

<deferred>
## Deferred Ideas

- **Case Library with file categorization** (Evidence, Legal, Strategy, Reference filters) — Phase 3
- **Quick Analysis modal for files** — Phase 3/4
- **Conflict detection on file upload** — Phase 3 or later
- **Settings/profile page** — future phase
- **Case status filtering** — future enhancement

</deferred>

---

*Phase: 02-authentication-case-shell*
*Context gathered: 2026-01-24*
