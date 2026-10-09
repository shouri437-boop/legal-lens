---
phase: 08-synthesis-intelligence
plan: 07
subsystem: ui, api
tags: [timeline, verdict, synthesis, react-query, pydantic, zod]

# Dependency graph
requires:
  - phase: 08-03
    provides: Timeline and synthesis API endpoints (GET /timeline, GET /synthesis)
  - phase: 08-05
    provides: Verdict frontend components (VerdictView, VerdictSummary)
provides:
  - Timeline page wired to real synthesis-generated API data (mock fallback removed)
  - "financial" layer fully supported in timeline filters and display
  - Verdict badge in case header (Conclusive/Substantial/Inconclusive)
  - Verdict badge in case list cards (grid + list modes)
  - Backend CaseResponse schema includes verdict_label and verdict_summary
affects: [phase-10-source-panel, phase-12-demo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backend-to-frontend field transformation in API client (event_date->date, layer->layer)"
    - "Verdict badge priority pattern: verdict_label > Pending Analysis > status badge"
    - "resolveBadge() helper for unified badge logic across card modes"

key-files:
  created: []
  modified:
    - frontend/src/types/timeline.types.ts
    - frontend/src/constants/timeline.constants.ts
    - frontend/src/lib/api/timelineApi.ts
    - frontend/src/hooks/useTimelineData.ts
    - frontend/src/hooks/useTimelineFilters.ts
    - frontend/src/components/Timeline/TimelineEventCard.tsx
    - frontend/src/lib/utils/eventProcessors.ts
    - backend/app/schemas/case.py
    - frontend/src/types/case.ts
    - frontend/src/app/(app)/cases/[id]/layout.tsx
    - frontend/src/components/app/case-card.tsx
    - packages/types/src/generated/api.ts

key-decisions:
  - "Backend event_date field mapped to frontend date field via transformBackendEvent()"
  - "TimelineLayer enum expanded to 4 values (evidence, legal, strategy, financial)"
  - "Verdict badge replaces status badge when verdict_label is present"
  - "Pending Analysis badge shown when case is READY but no verdict yet"
  - "Zod datetime() relaxed to string() for backend ISO dates without timezone offset"

patterns-established:
  - "transformBackendEvent: centralized field mapping between backend snake_case and frontend camelCase"
  - "resolveBadge: unified badge resolution prioritizing verdict over status"

# Metrics
duration: 10min
completed: 2026-02-09
---

# Phase 8 Plan 07: Timeline Wiring + Verdict Badge Summary

**Timeline wired to real synthesis API data with JWT auth, financial layer support, and verdict badges in case header and list cards**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-09T00:17:05Z
- **Completed:** 2026-02-09T00:26:49Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Timeline page fetches real synthesis-generated events from backend API with JWT auth (mock data fallback removed)
- "financial" layer fully integrated: TimelineLayer enum, LAYER_CONFIG colors, filter defaults, eventProcessors stats, DollarSign icon
- Backend CaseResponse schema now serializes verdict_label and verdict_summary in all case API responses
- Case header shows verdict badge (Conclusive=green, Substantial=amber, Inconclusive=gray) with one-line summary subtitle
- Case list cards show verdict badge replacing status badge when verdict is available

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire Timeline to real API data** - `9f2dbdd` (feat)
2. **Task 2: Backend CaseResponse schema + verdict badge** - `dd70f93` (feat)

## Files Created/Modified
- `frontend/src/types/timeline.types.ts` - Added "financial" to TimelineLayer, added eventType field, relaxed datetime validators
- `frontend/src/constants/timeline.constants.ts` - Added financial layer config (teal color, DollarSign icon)
- `frontend/src/lib/api/timelineApi.ts` - Added JWT auth headers, transformBackendEvent() field mapping
- `frontend/src/hooks/useTimelineData.ts` - Removed mock data import and fallback
- `frontend/src/hooks/useTimelineFilters.ts` - Added "financial" to default selected layers
- `frontend/src/components/Timeline/TimelineEventCard.tsx` - Added DollarSign icon, event type category badge
- `frontend/src/lib/utils/eventProcessors.ts` - Added "financial" to layerCounts
- `backend/app/schemas/case.py` - Added verdict_label and verdict_summary fields to CaseResponse
- `frontend/src/types/case.ts` - Added VerdictLabel type and verdict fields to Case interface
- `frontend/src/app/(app)/cases/[id]/layout.tsx` - Verdict badge in case header with summary subtitle
- `frontend/src/components/app/case-card.tsx` - resolveBadge() for verdict-aware badge in grid+list modes
- `packages/types/src/generated/api.ts` - Regenerated OpenAPI types with verdict fields

## Decisions Made
- **Zod datetime relaxation:** Backend sends ISO dates that may lack timezone offset (e.g., "2025-03-15T10:00:00" without "Z"). Relaxed from `z.string().datetime()` to `z.string()` for compatibility.
- **Verdict badge priority:** When verdict_label exists, it replaces the status badge entirely. When case is READY but no verdict, shows "Pending Analysis". Otherwise shows regular status badge.
- **Financial layer color:** Used teal (#45B5AA) consistent with the asset entity color in knowledge-graph-config.ts, matching the financial domain's visual identity.
- **Event type display:** Shown as a secondary muted badge next to the domain badge, with underscores replaced by spaces for readability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added financial to eventProcessors layerCounts**
- **Found during:** Task 1 (typecheck after adding financial to TimelineLayer)
- **Issue:** `getEventStatistics()` in `eventProcessors.ts` had a Record<TimelineLayer, number> literal missing the new "financial" key
- **Fix:** Added `financial: 0` to the layerCounts initializer
- **Files modified:** `frontend/src/lib/utils/eventProcessors.ts`
- **Verification:** `bun run typecheck` passes
- **Committed in:** `9f2dbdd` (Task 1 commit)

**2. [Rule 3 - Blocking] Updated useTimelineFilters default layers and active filter check**
- **Found during:** Task 1 (ensuring financial layer is selected by default)
- **Issue:** Default selectedLayers and resetFilters only had 3 layers; hasActiveFilters checked `< 3` instead of `< 4`
- **Fix:** Added "financial" to both defaults, updated threshold to 4
- **Files modified:** `frontend/src/hooks/useTimelineFilters.ts`
- **Verification:** `bun run typecheck` passes
- **Committed in:** `9f2dbdd` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for type safety after adding financial layer. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 8 (Synthesis Agent & Intelligence Layer) is now COMPLETE (7/7 plans)
- All synthesis frontend components wired: Verdict view, detail panels, CC tab toggle, timeline wiring, verdict badges
- Ready for Phase 8.1 (Geospatial Agent) or Phase 9 (Chat Interface backend)
- Phase 10 must wire KG Source Viewer: source_finding_ids -> case_findings -> agent_executions -> case_files -> signed download URL

---
*Phase: 08-synthesis-intelligence*
*Completed: 2026-02-09*
