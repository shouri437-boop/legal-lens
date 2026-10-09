---
phase: 10-source-panel
plan: 02
subsystem: ui
tags: [react, hooks, source-viewer, entity-resolution, knowledge-graph, geospatial, citation]

# Dependency graph
requires:
  - phase: 10-source-panel
    plan: 01
    provides: useSourceNavigation, useEntityResolver, CitationLink, EntityBadge, citation-utils
  - phase: 07.2-kg-frontend-d3-enhancement
    provides: KnowledgeGraphCanvas, KnowledgeGraphEntityPanel, EntityTimelineEntry, SourceViewerModal
  - phase: 08.1-geospatial
    provides: GeospatialMap, LocationDetailResponse, fetchLocationDetail
provides:
  - "KG entity panel source documents are clickable (trigger openFromFinding two-hop resolution)"
  - "EntityTimelineEntry 'View source evidence' link replaces 'Source not yet available'"
  - "Geospatial citations open SourceViewerModal via portaled overlay"
  - "Geospatial Related Entities shows resolved names with EntityBadge components"
  - "Geospatial citation file names resolved from file metadata cache"
affects: [10-03, 10-04, 10-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stable ref pattern for sidebar callbacks to prevent useEffect re-triggering"
    - "Combined source content (navSourceContent ?? sourceViewerContent) for merged source viewer state"
    - "Record<string, string> instead of Map for file lookup when Map import conflicts with React component names"
    - "Self-contained source navigation in components via useSourceNavigation (no prop drilling)"
    - "z-[60] portal layering for SourceViewerModal above detail dialog (z-50)"

key-files:
  created: []
  modified:
    - "frontend/src/types/detail-sidebar.ts"
    - "frontend/src/components/app/detail-sidebar.tsx"
    - "frontend/src/components/knowledge-graph/KnowledgeGraphEntityPanel.tsx"
    - "frontend/src/components/knowledge-graph/EntityTimelineEntry.tsx"
    - "frontend/src/components/knowledge-graph/KnowledgeGraphCanvas.tsx"
    - "frontend/src/app/(app)/cases/[id]/knowledge-graph/page.tsx"
    - "frontend/src/components/Geospatial/GeospatialMap.tsx"
    - "frontend/src/app/(app)/cases/[id]/geospatial/page.tsx"

key-decisions:
  - "caseId added as prop to KnowledgeGraphCanvas (needed by useSourceNavigation hook)"
  - "Stable ref pattern for openFromFinding callback (prevents sidebar content effect re-triggers)"
  - "Record<string, string> for geospatial file name lookup (avoids Map import conflict with Google Maps Map component)"
  - "Self-contained source navigation in GeospatialMap (removed onViewSource prop)"
  - "z-[60] for SourceViewerModal portal in geospatial (above z-50 detail dialog)"

patterns-established:
  - "View-level source navigation: component calls useSourceNavigation(caseId) + renders SourceViewerModal"
  - "View-level entity resolution: component calls useEntityResolver(caseId) + renders EntityBadge"

# Metrics
duration: 9min
completed: 2026-02-09
---

# Phase 10 Plan 02: KG and Geospatial View-Level Source Navigation & Entity Resolution Summary

**KG entity panel source documents clickable with two-hop finding resolution, EntityTimelineEntry "View source evidence" link, geospatial citations open SourceViewerModal via portal, geospatial entities resolved to names with EntityBadge**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-09T14:11:03Z
- **Completed:** 2026-02-09T14:19:46Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- KG entity panel source finding IDs are clickable buttons triggering openFromFinding two-hop resolution to SourceViewerModal
- EntityTimelineEntry "Source not yet available" replaced with functional "View source evidence" link when source_finding_ids exist
- Geospatial citations "View" button opens SourceViewerModal at correct file via self-contained useSourceNavigation hook
- Geospatial Related Entities section shows resolved entity names with color-coded EntityBadge components instead of raw UUID strings
- Geospatial citation file names resolved from cached file list instead of static "Source Document" text

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire KG Entity Panel and EntityTimelineEntry to source navigation** - `096b670` (feat)
2. **Task 2: Wire Geospatial detail panel with source navigation and entity resolution** - `77b3039` (feat)

## Files Created/Modified
- `frontend/src/types/detail-sidebar.ts` - Added onViewFinding callback to KnowledgeGraphEntityContent.props
- `frontend/src/components/app/detail-sidebar.tsx` - Passes onViewFinding through to KnowledgeGraphEntityPanel
- `frontend/src/components/knowledge-graph/KnowledgeGraphEntityPanel.tsx` - Source documents clickable, onViewSource forwarded to EntityTimelineEntry
- `frontend/src/components/knowledge-graph/EntityTimelineEntry.tsx` - onViewSource prop, "View source evidence" replaces placeholder
- `frontend/src/components/knowledge-graph/KnowledgeGraphCanvas.tsx` - useSourceNavigation wired, merged source content, caseId prop
- `frontend/src/app/(app)/cases/[id]/knowledge-graph/page.tsx` - Passes caseId to KnowledgeGraphCanvas
- `frontend/src/components/Geospatial/GeospatialMap.tsx` - Self-contained source navigation + entity resolution + SourceViewerModal portal
- `frontend/src/app/(app)/cases/[id]/geospatial/page.tsx` - Removed onViewSource prop (now self-contained)

## Decisions Made
- Added caseId as prop to KnowledgeGraphCanvas rather than using useParams internally (keeps component decoupled from routing)
- Used stable ref pattern (openFromFindingRef) for sidebar content effect to avoid re-triggering on every openFromFinding recreation
- Used Record<string, string> instead of Map<string, string> in GeospatialMap because the Map import from @vis.gl/react-google-maps shadows the global Map constructor
- Made GeospatialMap self-contained for source navigation (removed onViewSource prop) since the component now manages its own SourceViewerModal portal

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Map constructor shadowed by Google Maps import**
- **Found during:** Task 2 (GeospatialMap file name lookup)
- **Issue:** `new Map<string, string>()` caused TypeScript error TS7009/TS2558 because the `Map` import from `@vis.gl/react-google-maps` shadows the global `Map` constructor
- **Fix:** Used `Record<string, string>` plain object instead of `Map<string, string>` for the file name lookup
- **Files modified:** `frontend/src/components/Geospatial/GeospatialMap.tsx`
- **Verification:** TypeScript passes, build succeeds
- **Committed in:** 77b3039 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- KG and Geospatial views are fully wired to source navigation
- Plans 03-05 can wire remaining views (Verdict, Timeline, Command Center) following the same pattern
- useSourceNavigation + SourceViewerModal portal pattern is proven and documented

---
*Phase: 10-source-panel*
*Completed: 2026-02-09*
