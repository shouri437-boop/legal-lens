---
phase: 02-authentication-case-shell
plan: 03
subsystem: auth
tags: [better-auth, jwt, next.js, middleware, oauth, google]

# Dependency graph
requires:
  - phase: 02-01
    provides: Backend auth infrastructure with JWKS validation
provides:
  - Better Auth server configuration with JWT plugin
  - Client-side auth hooks and token retrieval
  - API client with automatic JWT Authorization header
  - Route protection middleware for /cases/* routes
  - JWKS endpoint at /api/auth/jwks
affects: [02-04, 02-05, 02-06]

# Tech tracking
tech-stack:
  added: [better-auth, pg, sonner, lucide-react, react-hook-form, @hookform/resolvers, zod, @types/pg]
  patterns: [JWT plugin for cross-origin auth, Edge middleware route protection, API client with auth header injection]

key-files:
  created:
    - frontend/src/lib/auth.ts
    - frontend/src/lib/auth-client.ts
    - frontend/src/lib/api-client.ts
    - frontend/src/app/api/auth/[...all]/route.ts
    - frontend/src/middleware.ts
  modified:
    - frontend/package.json
    - frontend/.env.example

key-decisions:
  - "Better Auth JWT plugin configured with issueTokensOnSignIn: true for backend verification"
  - "Session cookie cache enabled (5 min) to reduce database hits"
  - "30-day session expiry with daily refresh per CONTEXT.md requirements"
  - "API client fetches token via jwtClient plugin for Authorization header"

patterns-established:
  - "Auth client pattern: Export named functions (signIn, signUp, signOut, useSession) from auth-client.ts"
  - "API client pattern: Automatic JWT injection via getAuthToken helper"
  - "Middleware pattern: Cookie-based session check for route protection"

# Metrics
duration: 8min
completed: 2026-01-25
---

# Phase 2 Plan 03: Frontend Authentication Setup Summary

**Better Auth with JWT plugin for email/password and Google OAuth, JWKS endpoint for backend verification, and Edge middleware for route protection**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-25T00:08:00Z
- **Completed:** 2026-01-25T00:16:08Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Better Auth server configured with email/password and Google OAuth providers
- JWT plugin enabled with issueTokensOnSignIn for cross-origin backend authentication
- JWKS endpoint exposed at /api/auth/jwks for FastAPI token verification
- API client automatically injects JWT token in Authorization header for backend calls
- Edge middleware protects /cases/* routes and redirects unauthenticated users
- Form libraries installed for upcoming auth UI components

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Better Auth dependencies** - `e6f3174` (chore)
2. **Task 2: Create Better Auth server and client configuration with JWT plugin** - `00129c4` (feat)
3. **Task 3: Create middleware for route protection** - `9d207f4` (feat)

## Files Created/Modified

- `frontend/src/lib/auth.ts` - Better Auth server config with JWT plugin, email/password, Google OAuth
- `frontend/src/lib/auth-client.ts` - Client-side hooks (signIn, signUp, signOut, useSession) with jwtClient
- `frontend/src/lib/api-client.ts` - API client with automatic JWT Authorization header injection
- `frontend/src/app/api/auth/[...all]/route.ts` - Catch-all route handler for Better Auth endpoints
- `frontend/src/middleware.ts` - Edge middleware for /cases/* route protection
- `frontend/package.json` - Added better-auth, pg, sonner, lucide-react, react-hook-form, @hookform/resolvers, zod
- `frontend/.env.example` - Updated with Better Auth and Google OAuth environment variables

## Decisions Made

- **JWT plugin configuration:** Set `issueTokensOnSignIn: true` to ensure JWT tokens are actually issued on login (required for backend verification)
- **Session settings:** 30-day expiry with daily refresh, matching CONTEXT.md "no timeout" requirement
- **Cookie cache:** Enabled 5-minute cookie cache to reduce database hits for session validation
- **Token retrieval:** Used jwtClient plugin with `authClient.$fetch("/token")` pattern for API client

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all dependencies installed correctly and TypeScript compilation passed.

## User Setup Required

**External services require manual configuration.** Users must:

1. Copy `frontend/.env.example` to `frontend/.env.local`
2. Set `BETTER_AUTH_SECRET` to a secure random string
3. Set `DATABASE_URL` to PostgreSQL connection string
4. For Google OAuth:
   - Create OAuth 2.0 Client ID in Google Cloud Console
   - Add redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

## Next Phase Readiness

- Better Auth endpoints ready at /api/auth/* (signup, signin, signout, jwks, token)
- JWT plugin configured - backend can verify tokens via JWKS endpoint
- API client ready for authenticated backend calls
- Ready for Plan 04 (Auth UI Components) to build login/signup forms
- Ready for Plan 02 (Case CRUD Endpoints) to use JWT validation

---
*Phase: 02-authentication-case-shell*
*Completed: 2026-01-25*
