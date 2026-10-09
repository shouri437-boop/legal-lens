---
phase: 10-source-panel
plan: 01
subsystem: ui
tags: [react, hooks, citation, entity-resolution, source-viewer]

# Dependency graph
requires:
  - phase: 07.2-kg-frontend-d3-enhancement
    provides: SourceViewerModal, PdfViewer, AudioViewer, VideoViewer, ImageViewer
  - phase: 08-synthesis-intelligence
    provides: Synthesis data models with citation/evidence references
provides:
  - "parseLocator utility for page/timestamp/region locator parsing"
  - "categoryToViewerType utility for file category to viewer type mapping"
  - "useSourceNavigation hook for citation-to-SourceViewerContent resolution"
  - "useEntityResolver hook for entity UUID to name/type/color resolution"
  - "CitationLink reusable UI component for clickable citations"
  - "EntityBadge reusable UI component for entity name + type badges"
affects: [10-02, 10-03, 10-04, 10-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared hook pattern for cross-view citation resolution (useSourceNavigation)"
    - "Shared hook pattern for cross-view entity resolution (useEntityResolver)"
    - "useMemo-based file lookup map derived from React Query data (avoids ref-during-render lint violation)"
    - "Request counter ref for race condition prevention in async callbacks"
    - "Two-hop resolution pattern: finding_id -> CaseFinding.citations -> file"

key-files:
  created:
    - "frontend/src/lib/citation-utils.ts"
    - "frontend/src/hooks/useSourceNavigation.ts"
    - "frontend/src/hooks/useEntityResolver.ts"
    - "frontend/src/components/ui/citation-link.tsx"
    - "frontend/src/components/ui/entity-badge.tsx"
  modified: []

key-decisions:
  - "useMemo for file lookup map instead of ref mutation during render (React Compiler lint compliance)"
  - "React Query with 5-minute stale time for both file list and graph entity caching"
  - "Fallback entity with name='Unknown Entity' and type='other' for unresolved UUIDs"
  - "PDF highlight text truncated to first 100 characters for search reliability"

patterns-established:
  - "Citation interface: { file_id, locator, excerpt? } used consistently across all views"
  - "ResolvedEntity interface: { id, name, entity_type, color } for entity display"
  - "formatLocatorDisplay for human-readable locator strings (Page 3, 01:23:45)"

# Metrics
duration: 6min
completed: 2026-02-09
---

# Phase 10 Plan 01: Shared Citation & Entity Resolution Foundation Summary

**parseLocator/categoryToViewerType utilities, useSourceNavigation hook with two-hop finding resolution and race condition prevention, useEntityResolver hook with cached KG graph lookup, CitationLink and EntityBadge reusable UI components**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-09T14:01:37Z
- **Completed:** 2026-02-09T14:07:19Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- Citation-to-source data pipeline hook resolving file_id + locator + excerpt into SourceViewerContent objects with signed URL caching
- Two-hop finding resolution (finding_id -> CaseFinding.citations -> file) for hypothesis/contradiction evidence items
- Entity UUID to human-readable name + type + color resolution using cached KG graph data
- Reusable CitationLink and EntityBadge components matching existing design system (GapDetailPanel entity row styling)

## Task Commits

Each task was committed atomically:

1. **Task 1: Citation utilities and useSourceNavigation hook** - `82a2b96` (feat)
2. **Task 2: useEntityResolver hook and reusable UI components** - `431dd39` (feat)

## Files Created/Modified
- `frontend/src/lib/citation-utils.ts` - Locator parser (page/timestamp/region), category-to-viewer-type mapper, Citation/FindingCitation interfaces, formatLocatorDisplay
- `frontend/src/hooks/useSourceNavigation.ts` - Citation-to-SourceViewerContent resolution hook with signed URL caching, two-hop finding resolution, race condition prevention
- `frontend/src/hooks/useEntityResolver.ts` - Entity UUID to name/type/color resolution hook using cached KG graph data
- `frontend/src/components/ui/citation-link.tsx` - Clickable citation link with file name, locator badge, excerpt snippet
- `frontend/src/components/ui/entity-badge.tsx` - Color-coded entity name + type label badge matching GapDetailPanel styling

## Decisions Made
- Used `useMemo` for file lookup map instead of ref mutation during render to comply with React Compiler's `react-hooks/refs` lint rule
- React Query with 5-minute stale time for both file list and graph entity caching (matching existing patterns)
- Fallback entity with `name="Unknown Entity"` and `type="other"` for unresolved UUIDs (graceful degradation)
- PDF highlight text truncated to first 100 characters for search reliability (per RESEARCH.md Pitfall 6)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ref mutation during render**
- **Found during:** Task 1 (useSourceNavigation hook)
- **Issue:** `fileMapRef.current = newMap` triggered React Compiler lint error `react-hooks/refs` (cannot update ref during render)
- **Fix:** Replaced ref-based file map with `useMemo` derived from React Query data, added `fileMap` to useCallback dependency array
- **Files modified:** `frontend/src/hooks/useSourceNavigation.ts`
- **Verification:** ESLint passes, typecheck passes, build succeeds
- **Committed in:** 82a2b96 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for React Compiler compliance. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared utilities and hooks are ready for view-level integration in Plans 02-05
- useSourceNavigation can be consumed by any view component with `const { openSource, sourceContent, closeSource } = useSourceNavigation(caseId)`
- useEntityResolver can be consumed with `const { resolveEntities, getEntity } = useEntityResolver(caseId)`
- CitationLink and EntityBadge are ready for drop-in use across KG, Verdict, Geospatial, and Timeline views

---
*Phase: 10-source-panel*
*Completed: 2026-02-09*
