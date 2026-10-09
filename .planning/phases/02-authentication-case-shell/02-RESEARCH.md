# Phase 2: Authentication & Case Shell - Research

**Researched:** 2026-01-24
**Domain:** Authentication (Better Auth), Session Management, Case CRUD
**Confidence:** HIGH

## Summary

This phase implements user authentication using Better Auth with Next.js 15 App Router, email/password registration, Google OAuth, and basic case management CRUD operations. Better Auth is a TypeScript-first authentication library that stores sessions in PostgreSQL and uses cookie-based session management by default.

The architecture involves Next.js handling all authentication (signup, login, logout, OAuth) while FastAPI reads from the shared PostgreSQL database to validate sessions. Better Auth provides a JWT plugin that exposes a JWKS endpoint, allowing FastAPI to verify tokens without sharing secrets. Alternatively, FastAPI can query the session table directly for simpler validation.

**Primary recommendation:** Use Better Auth with the `pg` adapter for PostgreSQL, enable the JWT plugin for cross-service verification, and implement session validation in FastAPI by either querying the session table directly or verifying JWTs via the JWKS endpoint.

## Standard Stack

The established libraries/tools for this domain:

### Core (Frontend - Next.js)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | ^1.2.7+ | Authentication library | TypeScript-first, modern, PostgreSQL support, account linking |
| @hookform/resolvers | ^3.x | Form validation resolver | Bridges react-hook-form and zod |
| react-hook-form | ^7.x | Form state management | De facto standard for React forms |
| zod | ^3.x | Schema validation | Type-safe, composable, works with TypeScript |

### Core (Backend - FastAPI)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PyJWT | ^2.10.x | JWT verification | Standard Python JWT library, JWKS support |
| cryptography | ^43.x | Crypto primitives | Required for EdDSA/ES256 verification |
| asyncpg | ^0.30.x | PostgreSQL async driver | Already in stack, required for session queries |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg | ^8.x | Node PostgreSQL driver | Better Auth PostgreSQL adapter |
| sonner | ^1.x | Toast notifications | Logout feedback, error messages |
| lucide-react | ^0.x | Icons | Navigation, UI elements |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-auth | NextAuth/Auth.js | NextAuth has more examples but less TypeScript-first; Better Auth has better PostgreSQL integration |
| pg adapter | Drizzle/Prisma adapter | Direct pg is simpler, no ORM overhead for auth tables |
| Session table query | JWT verification only | Session table is simpler; JWT adds complexity but is more stateless |

**Installation (Frontend):**
```bash
bun install better-auth pg react-hook-form @hookform/resolvers zod sonner lucide-react
```

**Installation (Backend):**
```bash
uv add PyJWT cryptography
```

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── lib/
│   ├── auth.ts              # Better Auth server config
│   └── auth-client.ts       # Better Auth client instance
├── app/
│   ├── api/auth/[...all]/
│   │   └── route.ts         # Better Auth API handler
│   ├── (auth)/
│   │   ├── layout.tsx       # Auth pages layout (no sidebar)
│   │   └── login/
│   │       └── page.tsx     # Login/signup page
│   └── (app)/
│       ├── layout.tsx       # App layout with sidebar
│       ├── cases/
│       │   └── page.tsx     # Case list view
│       └── cases/[id]/
│           └── page.tsx     # Individual case view (shell)
├── components/
│   ├── auth/
│   │   ├── login-form.tsx
│   │   ├── signup-form.tsx
│   │   └── oauth-buttons.tsx
│   └── app/
│       ├── sidebar.tsx
│       ├── case-list.tsx
│       ├── case-card.tsx
│       └── create-case-modal.tsx
└── middleware.ts             # Route protection

backend/app/
├── api/
│   ├── auth.py              # Session validation dependency
│   └── cases.py             # Case CRUD endpoints
├── models/
│   ├── auth.py              # SQLAlchemy models for auth tables (read-only)
│   └── case.py              # Case model
└── schemas/
    └── case.py              # Case Pydantic schemas
```

### Pattern 1: Better Auth Server Configuration

**What:** Configure Better Auth with PostgreSQL, email/password, and Google OAuth
**When to use:** Server-side auth configuration in `lib/auth.ts`
**Example:**

```typescript
// Source: https://www.better-auth.com/docs/installation
// frontend/src/lib/auth.ts
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";
import { Pool } from "pg";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "email-password"],
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days (no timeout per CONTEXT.md)
    updateAge: 60 * 60 * 24, // Refresh daily
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 min cache to reduce DB hits
    },
  },

  plugins: [
    jwt(), // Enables JWKS endpoint for FastAPI verification
    nextCookies(), // Must be last - enables cookie setting in server actions
  ],
});
```

### Pattern 2: Better Auth Client Configuration

**What:** Client-side auth hooks and functions
**When to use:** React components for auth operations
**Example:**

```typescript
// Source: https://www.better-auth.com/docs/integrations/next
// frontend/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [jwtClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
```

### Pattern 3: API Route Handler

**What:** Mount Better Auth to Next.js API routes
**When to use:** Required catch-all route for auth endpoints
**Example:**

```typescript
// Source: https://www.better-auth.com/docs/integrations/next
// frontend/src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### Pattern 4: Server-Side Session Validation (Next.js)

**What:** Validate sessions in Server Components and Server Actions
**When to use:** Protected pages, data fetching
**Example:**

```typescript
// Source: https://www.better-auth.com/docs/integrations/next
// frontend/src/app/(app)/cases/page.tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function CasesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/"); // Redirect to landing per CONTEXT.md
  }

  return <CaseList userId={session.user.id} />;
}
```

### Pattern 5: Middleware Route Protection

**What:** Check session cookie existence at edge
**When to use:** First-line defense for protected routes
**Example:**

```typescript
// Source: https://www.better-auth.com/docs/integrations/next
// frontend/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  // Protected app routes
  if (request.nextUrl.pathname.startsWith("/cases")) {
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Redirect authenticated users away from auth pages
  if (request.nextUrl.pathname === "/login") {
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/cases", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/cases/:path*", "/login"],
};
```

### Pattern 6: FastAPI Session Validation (Database Query)

**What:** Validate Better Auth sessions by querying PostgreSQL
**When to use:** FastAPI endpoints needing user context
**Example:**

```python
# backend/app/api/auth.py
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.auth import Session, User

async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Validate session and return current user."""
    # Better Auth stores session token in cookie named "better-auth.session_token"
    session_token = request.cookies.get("better-auth.session_token")

    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # Query session table
    result = await db.execute(
        select(Session)
        .where(Session.token == session_token)
        .where(Session.expires_at > datetime.now(timezone.utc))
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    # Get user
    result = await db.execute(
        select(User).where(User.id == session.user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


# Usage in endpoints
CurrentUser = Annotated[User, Depends(get_current_user)]
```

### Pattern 7: FastAPI JWT Verification (Alternative)

**What:** Verify Better Auth JWTs via JWKS endpoint
**When to use:** Stateless verification, microservices
**Example:**

```python
# backend/app/api/auth.py (alternative approach)
import jwt
from jwt import PyJWKClient

# Cache JWKS client
jwks_client = PyJWKClient(
    f"{settings.frontend_url}/api/auth/jwks",
    cache_keys=True,
)

async def get_current_user_jwt(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Validate JWT and return current user."""
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = auth_header.split(" ")[1]

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["EdDSA"],  # Better Auth default
            audience=settings.frontend_url,
            issuer=settings.frontend_url,
        )
    except jwt.exceptions.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=str(e))

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user
```

### Anti-Patterns to Avoid

- **Relying solely on middleware for auth:** Always validate sessions at the data access layer too. CVE-2025-29927 showed middleware can be bypassed.
- **Storing sensitive data in localStorage:** Better Auth uses httpOnly cookies by default. Don't override this.
- **Sharing BETTER_AUTH_SECRET with FastAPI:** Use JWKS or database queries instead.
- **Using HS256 for JWTs:** Better Auth uses EdDSA by default, which is asymmetric and more secure.
- **Calling auth APIs without credentials:** Always set `credentials: 'include'` for cross-origin requests.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt/argon2 | Better Auth built-in (scrypt) | Timing attacks, salt handling |
| Session tokens | UUID generation | Better Auth sessions | Secure random, proper cookie config |
| OAuth flow | Manual redirect handling | Better Auth socialProviders | State validation, CSRF protection |
| Account linking | Manual email matching | Better Auth accountLinking | Edge cases with email verification |
| Cookie security | Manual cookie setting | nextCookies plugin | HttpOnly, Secure, SameSite handling |
| Password validation UI | Manual strength meter | Zod regex + shadcn form | Consistent validation client/server |
| Form state management | useState for forms | react-hook-form | Re-renders, validation timing |

**Key insight:** Authentication has countless edge cases (timing attacks, CSRF, session fixation, etc.). Better Auth handles these; rolling your own invites security vulnerabilities.

## Common Pitfalls

### Pitfall 1: RSC Cookie Limitation

**What goes wrong:** Cookies set in Server Actions don't update the client immediately
**Why it happens:** React Server Components cannot set cookies; Next.js caches routes
**How to avoid:** Use `router.refresh()` in `onSessionChange` callback, or use the `nextCookies()` plugin
**Warning signs:** User appears logged out after successful login until page refresh

### Pitfall 2: Middleware Cookie-Only Check

**What goes wrong:** Attacker bypasses middleware using CVE-2025-29927 or cookie manipulation
**Why it happens:** `getSessionCookie()` only checks existence, not validity
**How to avoid:** Always validate sessions in page/API handlers, not just middleware
**Warning signs:** Relying on middleware as sole auth check

### Pitfall 3: Google OAuth Refresh Token

**What goes wrong:** Refresh token only issued on first consent
**Why it happens:** Google only sends refresh_token once per app authorization
**How to avoid:** Set `accessType: "offline"` and `prompt: "select_account consent"` in Google provider config
**Warning signs:** Token refresh fails for returning users

### Pitfall 4: Cross-Origin Cookie Issues

**What goes wrong:** Sessions don't persist across frontend/backend domains
**Why it happens:** Cookies require proper CORS and SameSite configuration
**How to avoid:** Configure `trustedOrigins` in Better Auth, ensure cookies are set with correct domain
**Warning signs:** Session works in dev but fails in production with different domains

### Pitfall 5: Multi-Tab Logout Sync

**What goes wrong:** Logout in one tab doesn't affect other tabs
**Why it happens:** Each tab has its own React state
**How to avoid:** Use `useSession()` hook which listens for storage events, or implement BroadcastChannel
**Warning signs:** User logged out in one tab but still appears logged in another

### Pitfall 6: Case Ownership Leakage

**What goes wrong:** Users can access other users' cases
**Why it happens:** Missing user_id filter in database queries
**How to avoid:** Always include `WHERE user_id = :current_user_id` in case queries
**Warning signs:** Case list shows all cases regardless of user

## Code Examples

Verified patterns from official sources:

### Email/Password Sign Up

```typescript
// Source: https://www.better-auth.com/docs/authentication/email-password
import { signUp } from "@/lib/auth-client";

async function handleSignUp(data: SignUpFormData) {
  const result = await signUp.email({
    email: data.email,
    password: data.password,
    name: data.name,
    callbackURL: "/cases", // Redirect after signup
  });

  if (result.error) {
    // Handle error
    return { error: result.error.message };
  }

  // Success - user is now logged in
}
```

### Google OAuth Sign In

```typescript
// Source: https://www.better-auth.com/docs/authentication/google
import { signIn } from "@/lib/auth-client";

async function handleGoogleSignIn() {
  await signIn.social({
    provider: "google",
    callbackURL: "/cases",
  });
}
```

### Sign Out with Multi-Tab Sync

```typescript
// Source: https://www.better-auth.com/docs/basic-usage
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

async function handleSignOut() {
  await signOut({
    fetchOptions: {
      onSuccess: () => {
        toast.success("Logged out successfully");
        // BroadcastChannel for multi-tab sync
        const bc = new BroadcastChannel("auth");
        bc.postMessage({ type: "logout" });
        router.push("/");
      },
    },
  });
}
```

### Zod Schema for Password Validation

```typescript
// Source: https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/
import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
```

### Case Creation Form with react-hook-form

```typescript
// Source: https://ui.shadcn.com/docs/components/form
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const caseSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(5000).optional(),
  type: z.enum(["FRAUD", "CORPORATE", "CIVIL", "CRIMINAL", "OTHER"]),
});

function CreateCaseModal() {
  const form = useForm<z.infer<typeof caseSchema>>({
    resolver: zodResolver(caseSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "OTHER",
    },
  });

  async function onSubmit(data: z.infer<typeof caseSchema>) {
    const response = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // Important for cookies
      body: JSON.stringify(data),
    });
    // Handle response
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
    </Form>
  );
}
```

## Database Schema

### Better Auth Tables (Auto-Generated)

```sql
-- Run: npx @better-auth/cli generate --config ./src/lib/auth.ts
-- Source: https://www.better-auth.com/docs/concepts/database

CREATE TABLE "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  image TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE account (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  scope TEXT,
  id_token TEXT,
  password TEXT, -- For email/password auth (hashed)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- JWT plugin adds this table
CREATE TABLE jwks (
  id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL, -- Encrypted
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Case Table (Custom)

```sql
-- Add to Alembic migration

CREATE TYPE case_status AS ENUM ('DRAFT', 'PROCESSING', 'READY', 'ERROR');
CREATE TYPE case_type AS ENUM ('FRAUD', 'CORPORATE', 'CIVIL', 'CRIMINAL', 'OTHER');

CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type case_type NOT NULL DEFAULT 'OTHER',
  status case_status NOT NULL DEFAULT 'DRAFT',
  file_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete for 30-day recovery
);

CREATE INDEX idx_cases_user_id ON cases(user_id);
CREATE INDEX idx_cases_deleted_at ON cases(deleted_at) WHERE deleted_at IS NULL;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth v4 | Better Auth / Auth.js v5 | 2024 | Better TypeScript, simpler config |
| Middleware-only auth | Defense-in-depth | 2025 (CVE-2025-29927) | Must verify at data layer |
| localStorage tokens | httpOnly cookies | Standard practice | XSS protection |
| Symmetric JWT (HS256) | Asymmetric (EdDSA/RS256) | Best practice | Separate signing/verification keys |
| pages/ router auth | App Router + RSC | Next.js 13+ | Server-side session access |

**Deprecated/outdated:**
- NextAuth `getSession()` on client: Use `useSession()` hook instead
- `next-auth/react` SessionProvider: Better Auth uses different patterns
- Middleware-only protection: Always add server-side checks too

## Open Questions

Things that couldn't be fully resolved:

1. **Email Verification Flow Complexity**
   - What we know: Better Auth supports email verification with `requireEmailVerification: true`
   - What's unclear: Requirements mention "Email verification flow" but CONTEXT.md doesn't specify UX
   - Recommendation: Implement optional verification email on signup, but don't require it for MVP. Can enable `requireEmailVerification` later.

2. **Cookie Name with Shared Backend**
   - What we know: Better Auth uses `better-auth.session_token` by default
   - What's unclear: Whether FastAPI CORS will handle this correctly in production
   - Recommendation: Test cross-origin cookie handling early in development. May need `crossSubDomainCookies` config.

3. **Session Table Query vs JWT Verification**
   - What we know: Both approaches work; session query is simpler, JWT is more stateless
   - What's unclear: Performance implications at scale
   - Recommendation: Start with session table query (simpler). Add JWT verification later if needed for horizontal scaling.

## Sources

### Primary (HIGH confidence)
- [Better Auth Installation](https://www.better-auth.com/docs/installation) - Setup, configuration
- [Better Auth Next.js Integration](https://www.better-auth.com/docs/integrations/next) - App Router patterns
- [Better Auth Email/Password](https://www.better-auth.com/docs/authentication/email-password) - Auth flow
- [Better Auth Google OAuth](https://www.better-auth.com/docs/authentication/google) - Social login
- [Better Auth Database](https://www.better-auth.com/docs/concepts/database) - Table schemas
- [Better Auth Session Management](https://www.better-auth.com/docs/concepts/session-management) - Session config
- [Better Auth JWT Plugin](https://www.better-auth.com/docs/plugins/jwt) - JWKS endpoint
- [Better Auth PostgreSQL](https://www.better-auth.com/docs/adapters/postgresql) - Database adapter
- [shadcn/ui Form](https://ui.shadcn.com/docs/components/form) - Form patterns
- [PyJWT Documentation](https://pyjwt.readthedocs.io/en/latest/usage.html) - JWT verification

### Secondary (MEDIUM confidence)
- [Next.js Middleware Authentication 2025](https://www.hashbuilds.com/articles/next-js-middleware-authentication-protecting-routes-in-2025) - CVE info, best practices
- [Clerk Complete Auth Guide](https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router) - Defense-in-depth patterns
- [FreeCodeCamp Zod + RHF](https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/) - Password validation patterns

### Tertiary (LOW confidence)
- Various Medium articles on FastAPI JWT - General patterns verified against PyJWT docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs verified all libraries
- Architecture: HIGH - Better Auth docs + Next.js patterns well documented
- Pitfalls: HIGH - CVE-2025-29927 widely documented, Better Auth docs cover gotchas
- FastAPI integration: MEDIUM - Patterns derived from multiple sources, not official Better Auth docs

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - Better Auth is stable, patterns well established)
