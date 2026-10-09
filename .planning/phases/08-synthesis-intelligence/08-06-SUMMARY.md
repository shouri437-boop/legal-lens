---
phase: 08-synthesis-intelligence
plan: 06
subsystem: ui
tags: [react, sse, tabs, verdict, detail-sidebar, command-center, synthesis]

# Dependency graph
requires:
  - phase: 08-04
    provides: TypeScript types and React Query hooks for synthesis API
  - phase: 08-05
    provides: Verdict card components and VerdictView layout
provides:
  - 3 verdict detail panels (hypothesis, contradiction, gap) wired into DetailSidebar
  - Command Center Agent Flow / Verdict tab toggle with URL persistence
  - SSE synthesis-data-ready event handling with React Query cache invalidation
  - "synthesis" AgentType registered across validation, config, and color systems
affects: [08-07, 10-source-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tab toggle via URL search params for deep-linking and persistence"
    - "SSE-driven feature activation (disabled -> enabled on event)"
    - "Dual readiness detection: SSE event + API fallback for reconnection resilience"

key-files:
  created:
    - frontend/src/components/verdict/HypothesisDetailPanel.tsx
    - frontend/src/components/verdict/ContradictionDetailPanel.tsx
    - frontend/src/components/verdict/GapDetailPanel.tsx
  modified:
    - frontend/src/types/detail-sidebar.ts
    - frontend/src/components/app/detail-sidebar.tsx
    - frontend/src/app/(app)/cases/[id]/command-center/page.tsx
    - frontend/src/hooks/useAgentStates.ts
    - frontend/src/hooks/useCommandCenterSSE.ts
    - frontend/src/types/command-center.ts
    - frontend/src/lib/command-center-validation.ts
    - frontend/src/lib/command-center-config.ts
    - frontend/src/app/globals.css
    - frontend/src/lib/mock-command-center-data.ts

key-decisions:
  - "Added synthesis to AgentType union rather than string comparison for type safety"
  - "Dual readiness detection: SSE event for live sessions + useSynthesis API fallback for page reload"
  - "React Query cache invalidation triggered by SSE event, not polling"

patterns-established:
  - "SSE-driven tab activation: disabled tab with pulse indicator until backend event fires"
  - "Dual readiness: SSE synthesisReady boolean + API data existence check"

# Metrics
duration: 18min
completed: 2026-02-09
---

# Phase 8 Plan 06: Command Center Integration Summary

**Verdict detail panels wired into DetailSidebar, CC page tab toggle (Agent Flow / Verdict) with SSE-driven activation and URL persistence**

## Performance

- **Duration:** 18 min
- **Started:** 2026-02-09T00:00:00Z
- **Completed:** 2026-02-09T00:18:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- 3 verdict detail panels (HypothesisDetailPanel, ContradictionDetailPanel, GapDetailPanel) render full item details in the app-wide DetailSidebar
- Command Center page has Agent Flow / Verdict tab toggle with disabled state + pulse indicator before synthesis completes
- SSE synthesis-data-ready event wired through validation -> hook -> useAgentStates -> synthesisReady flag -> tab activation
- State snapshot reconnection detects synthesis completion for page reload resilience
- React Query caches (synthesis, hypotheses, contradictions, gaps, tasks) invalidated on synthesis-data-ready

## Task Commits

Each task was committed atomically:

1. **Task 1: DetailSidebar types + verdict detail panels** - `eaa5dc1` (feat)
2. **Task 2: Command Center tab toggle + SSE synthesis readiness** - `d7f4a48` (feat)

## Files Created/Modified
- `frontend/src/components/verdict/HypothesisDetailPanel.tsx` - Full hypothesis detail with confidence bar, evidence list (supporting/contradicting/neutral)
- `frontend/src/components/verdict/ContradictionDetailPanel.tsx` - Contradiction detail with claim pair, severity badge, source excerpts
- `frontend/src/components/verdict/GapDetailPanel.tsx` - Gap detail with priority badge, suggested actions, related entities
- `frontend/src/types/detail-sidebar.ts` - 3 new SidebarContentDescriptor union members (verdict-hypothesis, verdict-contradiction, verdict-gap)
- `frontend/src/components/app/detail-sidebar.tsx` - Render cases for all 3 verdict panel types
- `frontend/src/app/(app)/cases/[id]/command-center/page.tsx` - Tab toggle (Agent Flow / Verdict), SSE-driven activation, URL param persistence
- `frontend/src/hooks/useAgentStates.ts` - synthesisReady state, SynthesisDataReadyEvent handler, snapshot detection
- `frontend/src/hooks/useCommandCenterSSE.ts` - onSynthesisDataReady callback in SSE event handlers
- `frontend/src/types/command-center.ts` - "synthesis" in AgentType union, SynthesisDataReadyEvent interface
- `frontend/src/lib/command-center-validation.ts` - "synthesis" in VALID_AGENT_TYPES, synthesis-data-ready validator
- `frontend/src/lib/command-center-config.ts` - Synthesis agent config, connection (KG -> synthesis), color vars
- `frontend/src/app/globals.css` - --cc-synthesis-tint and --cc-synthesis-accent CSS variables
- `frontend/src/lib/mock-command-center-data.ts` - Synthesis entry in mock tools record

## Decisions Made
- **Added "synthesis" to AgentType union** rather than using string comparisons. Backend sends `agentType: "synthesis"` for SSE events; adding it to the union ensures type-safe handling across validation, config, and color systems.
- **Dual readiness detection pattern**: SSE `synthesisReady` flag for live sessions + `useSynthesis` API hook as fallback for page reload after analysis completes. Either source enables the Verdict tab.
- **React Query invalidation on SSE event**: When synthesis-data-ready fires, all 5 synthesis query keys are invalidated so VerdictView refetches fresh data immediately.
- **Verdict tab disabled state with pulse indicator**: Shows a subtle pulsing dot next to "Verdict" label when disabled, conveying "analysis in progress" without a tooltip (tooltip provided via title attribute for accessibility).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added "synthesis" to mock data Record**
- **Found during:** Task 2 (typecheck)
- **Issue:** `mock-command-center-data.ts` has a `Record<AgentType, string[]>` for mock tools; adding "synthesis" to AgentType made the record incomplete (TS2741)
- **Fix:** Added synthesis entry with mock tool names
- **Files modified:** frontend/src/lib/mock-command-center-data.ts
- **Verification:** `bun run typecheck` passes
- **Committed in:** d7f4a48 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary type-safety fix from extending AgentType. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All synthesis frontend components are wired: types, API hooks, card components, detail panels, CC integration
- Phase 8 Plan 07 (timeline wiring) can proceed if applicable
- Phase 10 source panel wiring remains deferred (source_finding_ids -> file URL chain)

---
*Phase: 08-synthesis-intelligence*
*Completed: 2026-02-09*
