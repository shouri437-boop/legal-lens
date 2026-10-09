---
phase: 01-foundation-infrastructure
plan: 03
subsystem: types
tags: [pydantic, openapi, typescript, codegen]

requires:
  - phase: 01-01
    provides: monorepo structure with packages/types workspace

provides:
  - FastAPI OpenAPI contract as source of truth for API types
  - TypeScript type generation via openapi-typescript
  - @legal-lens/types package for frontend type imports

affects: [02-auth, 03-ingestion, 04-agents, frontend]

tech-stack:
  added: [openapi-typescript]
  patterns: [python-first-types, generated-typescript]

key-files:
  created:
    - backend/app/schemas/__init__.py
    - backend/app/schemas/common.py
    - backend/app/schemas/health.py
    - packages/types/src/index.ts
  modified:
    - packages/types/src/generated/api.ts
    - packages/types/package.json
    - Makefile
    - package.json

key-decisions:
  - "FastAPI OpenAPI contract (derived from Pydantic schemas + route annotations) is the source of truth for generated types"
  - "TypeScript generated from FastAPI OpenAPI via openapi-typescript, committed to repo (not gitignored)"
  - "Types exported via @legal-lens/types workspace package"

patterns-established:
  - "Schema location: backend/app/schemas/{domain}.py"
  - "Type generation: make generate-types regenerates all TypeScript"
  - "Frontend import: import { Type } from '@legal-lens/types'"

duration: 14min
completed: 2026-01-21
---

# Plan 01-03: Type Generation Pipeline Summary

**OpenAPI-to-TypeScript pipeline with HealthResponse, ErrorResponse, and TimestampMixin types**

## Performance

- **Duration:** 14 min
- **Started:** 2026-01-21T05:51:22Z
- **Completed:** 2026-01-21T06:05:22Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Pydantic schemas created and included in the OpenAPI contract used for type generation
- OpenAPI → TypeScript pipeline working with `make generate-types`
- @legal-lens/types package properly configured with exports
- Frontend can import types with full type safety

## Task Commits

1. **Task 1: Create Pydantic schemas** - `3f8a3ee` (feat)
2. **Task 2: Configure type generation pipeline** - `433d329` (feat)

## Files Created/Modified

- `backend/app/schemas/__init__.py` - Central export for all Pydantic schemas
- `backend/app/schemas/common.py` - ErrorResponse, TimestampMixin
- `backend/app/schemas/health.py` - HealthResponse for health endpoints
- `packages/types/src/generated/api.ts` - Generated TypeScript interfaces
- `packages/types/src/index.ts` - Re-exports generated types
- `packages/types/package.json` - Proper ESM/CJS exports configuration
- `Makefile` - Generates types from FastAPI OpenAPI via openapi-typescript
- `package.json` - Adds `openapi-typescript` and wires `generate-types` to Makefile

## Decisions Made

- Used openapi-typescript for type generation (OpenAPI → TypeScript)
- Generated types committed to repo for better DX (no build step needed)
- Types re-exported through index.ts for cleaner imports

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

- None specific to the OpenAPI-based pipeline; type generation is driven by the backend OpenAPI schema.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Type generation pipeline ready for all future schemas
- Frontend can immediately use generated types
- Pattern established: add Pydantic schema → run `make generate-types` → TypeScript available

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-01-21*
