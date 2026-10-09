---
phase: 04-core-agent-system
plan: 01
subsystem: agents
tags: [google-adk, gemini-3, agents, sessions, artifacts, gcs, postgresql]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: PostgreSQL database, GCS bucket, pydantic-settings config
  - phase: 03-file-ingestion
    provides: CaseFile model, file_service patterns, GCS storage
provides:
  - ADK Runner factory for stage-isolated pipeline execution
  - DatabaseSessionService singleton with PostgreSQL
  - GcsArtifactService singleton for artifact storage
  - AgentFactory creating fresh LlmAgent instances (triage, orchestrator)
  - Callback-to-SSE mapping for all 6 ADK callback hooks
  - Tiered file preparation (inline <=100MB, File API >100MB)
  - BuiltInPlanner factory with configurable thinking levels
affects:
  - 04-core-agent-system (plans 02, 03 build on this foundation)
  - 05-agent-flow (SSE events from callbacks feed Command Center UI)
  - 06-domain-agents (use AgentFactory pattern and stage runners)
  - 07-synthesis (uses stage-isolated sessions and artifact service)

# Tech tracking
tech-stack:
  added: [google-adk>=1.22.0]
  patterns:
    - "Stage-isolated sessions: fresh session per pipeline stage via SHA-256 IDs"
    - "Agent factory: fresh LlmAgent instances per workflow to avoid single-parent violations"
    - "Singleton services: lazy initialization of DatabaseSessionService and GcsArtifactService"
    - "Callback-to-SSE: all 6 ADK callbacks mapped to publish function for real-time UI"
    - "Tiered file prep: inline data <=100MB, Gemini File API >100MB"

key-files:
  created:
    - backend/app/services/adk_service.py
    - backend/app/agents/__init__.py
    - backend/app/agents/base.py
    - backend/app/agents/factory.py
  modified:
    - backend/pyproject.toml
    - backend/app/config.py
    - backend/app/services/__init__.py

key-decisions:
  - "ADK agent names must be valid Python identifiers; UUIDs sanitized via regex"
  - "BuiltInPlanner used for thinking config (ADK best practice over generate_content_config)"
  - "Model IDs configurable via env vars for smooth preview-to-GA migration"
  - "Callbacks use asyncio.create_task for non-blocking SSE publishing"

patterns-established:
  - "AgentFactory static methods: always create fresh instances, never reuse"
  - "create_stage_runner(agent): wraps Runner with shared session/artifact services"
  - "create_session_id(case_id, workflow_id, stage): deterministic SHA-256 session IDs"
  - "get_or_create_stage_session: idempotent session creation per pipeline stage"
  - "_safe_name(prefix, case_id): sanitize case IDs for ADK identifier requirements"

# Metrics
duration: 5min
completed: 2026-02-03
---

# Phase 4 Plan 1: ADK Infrastructure Summary

**Google ADK service layer with PostgreSQL session persistence, GCS artifact storage, stage-isolated sessions, and agent factory pattern for triage/orchestrator agents**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-03T05:22:54Z
- **Completed:** 2026-02-03T05:28:13Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- ADK dependency added and verified (google-adk 1.23.0 installed)
- Configuration fields for Gemini API key, model IDs, artifacts bucket, and File API threshold
- ADK service layer with lazy singleton session/artifact services and stage-isolated Runner factory
- Agent factory producing fresh LlmAgent instances with BuiltInPlanner (HIGH thinking) and SSE callbacks
- Tiered file preparation for multimodal evidence (inline <=100MB, File API >100MB)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ADK dependencies and configuration** - `bcd9080` (feat)
2. **Task 2: Create ADK service layer with session and artifact services** - `6e37506` (feat)
3. **Task 3: Create agent base configurations and factory pattern** - `b1b84e8` (feat)

## Files Created/Modified
- `backend/pyproject.toml` - Added google-adk>=1.22.0 dependency
- `backend/app/config.py` - ADK settings: API key, model IDs, artifacts bucket, threshold
- `backend/app/services/adk_service.py` - Runner factory, session/artifact services, file prep
- `backend/app/services/__init__.py` - Export ADK service functions
- `backend/app/agents/__init__.py` - Package exports for factory, configs, constants
- `backend/app/agents/base.py` - Thinking planner, model constants, callback factory
- `backend/app/agents/factory.py` - AgentFactory with triage and orchestrator creation

## Decisions Made
- ADK agent names require valid Python identifiers; added `_safe_name()` to strip non-alphanumeric characters from UUIDs
- Used `BuiltInPlanner` with `ThinkingConfig` for thinking configuration (ADK best practice over raw `generate_content_config`)
- Model IDs made configurable via `GEMINI_FLASH_MODEL` and `GEMINI_PRO_MODEL` environment variables for smooth preview-to-GA migration
- Callbacks use `asyncio.create_task` for non-blocking SSE publishing with graceful fallback when no event loop is running

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid agent name with hyphens**
- **Found during:** Task 3 (Agent factory creation)
- **Issue:** ADK requires agent names to be valid Python identifiers; UUID-based case IDs contain hyphens which cause `ValidationError`
- **Fix:** Added `_safe_name()` utility using `re.sub(r"[^a-zA-Z0-9]", "", ...)` to sanitize case IDs
- **Files modified:** backend/app/agents/factory.py
- **Verification:** Factory creates agents with sanitized names successfully
- **Committed in:** b1b84e8 (Task 3 commit)

**2. [Rule 3 - Blocking] Fixed ruff lint violations (UP007, UP017, UP045)**
- **Found during:** Task 3 (Post-implementation lint)
- **Issue:** Used `Optional[X]` instead of `X | None`, `Union[X, Y]` instead of `X | Y`, `timezone.utc` instead of `UTC`
- **Fix:** Ran `ruff check --fix` to auto-convert to modern Python 3.12 type annotation syntax
- **Files modified:** backend/app/agents/base.py
- **Verification:** `ruff check app/` passes with zero errors
- **Committed in:** b1b84e8 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes essential for correctness and code quality. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. ADK settings use environment variables that are already part of the deployment configuration pattern.

## Next Phase Readiness
- ADK infrastructure ready for Triage Agent implementation (04-02)
- Agent factory pattern established for all future agents
- Session/artifact services ready for runtime use with proper env vars
- Callback-to-SSE mapping ready for Command Center integration

---
*Phase: 04-core-agent-system*
*Completed: 2026-02-03*
