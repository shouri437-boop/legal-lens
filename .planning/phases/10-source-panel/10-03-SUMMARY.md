---
phase: 10-source-panel
plan: 03
subsystem: ui
tags: [source-navigation, verdict, timeline, citation, entity-badge, portal, source-viewer]

# Dependency graph
requires:
  - phase: 10-01
    provides: useSourceNavigation hook, CitationLink, EntityBadge, citation-utils
  - phase: 10-02
    provides: KG and Geospatial view-level source navigation patterns
  - phase: 8
    provides: Verdict detail panels (HypothesisDetailPanel, ContradictionDetailPanel, GapDetailPanel), VerdictView, synthesis API hooks
provides:
  - Clickable evidence items in hypothesis detail panel triggering source navigation
  - Clickable source excerpts in contradiction detail panel triggering source navigation
  - Color-coded EntityBadge rendering in gap detail panel
  - Expandable citation list in timeline event cards with source viewer integration
  - SourceViewerModal portals from both Command Center (verdict) and Timeline views
affects: [10-04, 10-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "onViewFinding callback threading: page -> VerdictView -> sidebar descriptor -> detail panel"
    - "Citation expansion pattern: toggle expandable list within cards using stopPropagation isolation"
    - "SourceViewerModal portal pattern: z-[60] portal to document.body from each view"

key-files:
  created: []
  modified:
    - frontend/src/types/detail-sidebar.ts
    - frontend/src/components/app/detail-sidebar.tsx
    - frontend/src/components/verdict/HypothesisDetailPanel.tsx
    - frontend/src/components/verdict/ContradictionDetailPanel.tsx
    - frontend/src/components/verdict/GapDetailPanel.tsx
    - frontend/src/components/verdict/VerdictView.tsx
    - frontend/src/app/(app)/cases/[id]/command-center/page.tsx
    - frontend/src/components/Timeline/TimelineEventCard.tsx
    - frontend/src/components/Timeline/TimelineCore.tsx
    - frontend/src/components/Timeline/Timeline.tsx

key-decisions:
  - "onViewFinding callback threaded through sidebar descriptors rather than direct hook call in panels (panels render inside DetailSidebar context without caseId access)"
  - "Timeline citations use event.metadata.citations (actual file refs) not event.sourceIds (misnamed entity UUIDs)"
  - "Citation expansion in timeline cards uses local state toggle with stopPropagation to prevent card onClick interference"

patterns-established:
  - "Verdict source navigation: page.tsx owns useSourceNavigation -> passes openFromFinding through VerdictView -> sidebar descriptor props -> detail panel onViewFinding"
  - "Timeline source navigation: TimelineCore owns useSourceNavigation -> passes onViewCitation to TimelineEventCard -> expandable citation list"

# Metrics
duration: 10min
completed: 2026-02-09
---

# Phase 10 Plan 03: Verdict & Timeline Source Navigation Summary

**Clickable evidence citations in verdict detail panels and expandable timeline citation list with SourceViewerModal integration via portal pattern**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-09T14:23:56Z
- **Completed:** 2026-02-09T14:34:16Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Every evidence item in hypothesis detail panel is clickable with hover "View source" indicator, triggering source navigation via finding ID resolution
- Every source excerpt in contradiction detail panel is clickable with the same pattern
- Gap detail panel entity badges replaced with shared EntityBadge component for consistent color-coding via getEntityColor
- Timeline event card source count derived from metadata.citations (real file citations) instead of sourceIds (entity UUIDs)
- Timeline citations expand to show clickable rows with file ID, locator display, and excerpt preview
- SourceViewerModal opens from both Verdict (via Command Center page portal) and Timeline (via TimelineCore portal)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire Verdict detail panels with source navigation callbacks** - `9deea4e` (feat)
2. **Task 2: Wire Timeline event cards with source citation details** - `5a957f3` (feat)

## Files Created/Modified
- `frontend/src/types/detail-sidebar.ts` - Added onViewFinding to VerdictHypothesisContent and VerdictContradictionContent props
- `frontend/src/components/app/detail-sidebar.tsx` - Passes onViewFinding through to verdict detail panels
- `frontend/src/components/verdict/HypothesisDetailPanel.tsx` - EvidenceRow clickable with group-hover "View source" text, keyboard accessible
- `frontend/src/components/verdict/ContradictionDetailPanel.tsx` - SourceExcerpt clickable with group-hover "View source" text, keyboard accessible
- `frontend/src/components/verdict/GapDetailPanel.tsx` - Replaced inline entity rendering with EntityBadge component
- `frontend/src/components/verdict/VerdictView.tsx` - Accepts and threads onViewFinding through sidebar descriptors
- `frontend/src/app/(app)/cases/[id]/command-center/page.tsx` - useSourceNavigation + SourceViewerModal portal for verdict citations
- `frontend/src/components/Timeline/TimelineEventCard.tsx` - Citation extraction from metadata, expandable citation list, onViewCitation callback
- `frontend/src/components/Timeline/TimelineCore.tsx` - caseId prop, useSourceNavigation hook, SourceViewerModal portal
- `frontend/src/components/Timeline/Timeline.tsx` - Passes caseId to TimelineCore

## Decisions Made
- **onViewFinding callback threading via sidebar descriptors**: Verdict detail panels render inside the app-wide DetailSidebar which has no caseId context. The callback is threaded from command-center/page.tsx (which has caseId and useSourceNavigation) through VerdictView -> sidebar descriptor props -> detail panels. This avoids adding caseId/hook dependencies to the sidebar system.
- **Timeline uses metadata.citations, not sourceIds**: The `sourceIds` field in timeline events is misnamed -- it contains entity UUIDs from `source_entity_ids`, not finding/file IDs. The actual file citations are in `metadata.citations` (mapped from `backendEvent.citations` by `transformBackendEvent`).
- **Expandable citation list pattern**: Rather than opening a modal with all citations, clicking the source count toggles an expandable list within the card. Each individual citation row then opens SourceViewerModal. This provides progressive disclosure without modal nesting.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Verdict (hypothesis, contradiction, gap) and Timeline views are fully wired for source navigation
- Combined with Plans 01-02 (shared foundation + KG + Geospatial), 4 of 5 target views now have source citation support
- Remaining: Plan 04 (Evidence Library source panel) and Plan 05 (Command Center agent output citations) if planned
- Chat message citations explicitly deferred to Phase 9+ (backend does not yet produce structured citations)

---
*Phase: 10-source-panel*
*Completed: 2026-02-09*
