---
phase: 09-chat-interface
plan: 02
subsystem: ui
tags: [react, sse, streaming, markdown, citations, fetch-event-source, react-markdown]

# Dependency graph
requires:
  - phase: 09-01
    provides: "POST /api/cases/{case_id}/chat SSE streaming endpoint with 5 event types"
  - phase: 10
    provides: "useSourceNavigation hook, SourceViewerModal, citation-utils"
provides:
  - "SSE streaming chat hook (useChatbot) with fetchEventSource"
  - "Markdown rendering in assistant messages via react-markdown + remark-gfm"
  - "Inline citation chips parsed from [[file_id|locator|label]] markers"
  - "Tool activity expandable indicator during agent DB queries"
  - "Stop/Clear buttons for stream cancellation and history reset"
  - "Disabled state when analysis has not run"
  - "Error messages as red-tinted bubbles with retry"
affects: ["11 (corrections/refinement)", "12 (demo preparation)"]

# Tech tracking
tech-stack:
  added:
    - "@microsoft/fetch-event-source@2.0.1"
  patterns:
    - "SSE POST streaming via fetchEventSource with AbortController cancellation"
    - "Functional state updates in streaming callbacks to avoid stale closures"
    - "Citation regex parsing with local RegExp creation (React Compiler immutability)"
    - "Module-level regex pattern string + local new RegExp() for lint safety"

key-files:
  created: []
  modified:
    - "frontend/src/types/chatbot.ts"
    - "frontend/src/hooks/useChatbot.ts"
    - "frontend/src/components/app/chatbot.tsx"
    - "frontend/src/app/(app)/cases/[id]/layout.tsx"
    - "frontend/package.json"

key-decisions:
  - "getToken from auth-client.ts for SSE auth (matches existing api-client.ts pattern)"
  - "Session ID persisted via useRef for ADK conversation continuity across messages"
  - "Local RegExp creation inside useMemo instead of module-level global regex (React Compiler immutability rule)"
  - "Citation chips open SourceViewerModal via useSourceNavigation hook (Phase 10 infrastructure)"
  - "analysisAvailable prop derived from latest_workflow_id + status in layout"

patterns-established:
  - "SSE streaming hook pattern: fetchEventSource + AbortController ref + functional state updates"
  - "Citation chip inline rendering: regex split + ReactMarkdown segments + clickable button pills"
  - "Tool activity UX: collapsible section with humanized tool names and running/complete status"

# Metrics
duration: 9min
completed: 2026-02-09
---

# Phase 9 Plan 02: Chat Frontend Summary

**SSE streaming chat hook with markdown rendering, inline citation chips, tool activity indicators, and stop/clear/disabled UX**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-09T18:51:18Z
- **Completed:** 2026-02-09T19:00:08Z
- **Tasks:** 2
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- Rewrote useChatbot hook from fetch-JSON mock to SSE streaming via @microsoft/fetch-event-source with 5 event types (chat-token, chat-tool-start, chat-tool-end, chat-done, chat-error)
- Enhanced chatbot component with full markdown rendering (headers, lists, code, tables, blockquotes) via react-markdown + remark-gfm
- Citation markers [[file_id|locator|label]] parsed into inline clickable chips that open SourceViewerModal at the correct page/timestamp
- Tool activity expandable section showing humanized tool names (e.g., "Searching knowledge graph...") with running/complete status icons
- Stop button cancels SSE stream via AbortController, Clear button resets history and ADK session, disabled state when analysis has not run

## Task Commits

Each task was committed atomically:

1. **Task 1: Install fetch-event-source, update types, rewrite useChatbot hook** - `2d8b26e` (feat)
2. **Task 2: Enhance chatbot with markdown, citations, tool activity, stop/clear** - `48a251d` (feat)

## Files Created/Modified

- `frontend/package.json` - Added @microsoft/fetch-event-source dependency
- `frontend/src/types/chatbot.ts` - Rewritten with ChatCitation, ToolActivity, ChatStreamEvent, UseChatbotReturn
- `frontend/src/hooks/useChatbot.ts` - Rewritten with SSE streaming, AbortController, session ID persistence
- `frontend/src/components/app/chatbot.tsx` - Enhanced with markdown, citation chips, tool activity, stop/clear, disabled state, error bubbles
- `frontend/src/app/(app)/cases/[id]/layout.tsx` - Added analysisAvailable prop to Chatbot

## Decisions Made

- **getToken from auth-client.ts:** Reused the existing Better Auth JWT token retrieval pattern rather than duplicating the api-client.ts approach, since fetchEventSource needs explicit header management.
- **Session ID via useRef:** ADK sessions persist conversation history server-side. The hook stores the session_id returned by chat-done events and sends it with subsequent messages.
- **Local RegExp for citations:** React Compiler's immutability rule prevents mutating module-level regex lastIndex. Solution: store the pattern as a string constant and create a new RegExp inside useMemo.
- **analysisAvailable derivation:** `hasAnalysisRun && caseData.status !== "PROCESSING"` -- chat requires completed analysis, not in-progress.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] React Compiler immutability violation on module-level regex**
- **Found during:** Task 2 (chatbot component commit)
- **Issue:** `CITATION_REGEX.lastIndex = 0` mutates a module-level global, violating react-hooks/immutability eslint rule
- **Fix:** Changed to `const CITATION_PATTERN` string constant + `new RegExp(CITATION_PATTERN, "g")` inside useMemo
- **Files modified:** frontend/src/components/app/chatbot.tsx
- **Verification:** eslint pre-commit hook passes, typecheck passes
- **Committed in:** 48a251d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- pattern change for React Compiler lint compliance. No scope creep.

## Issues Encountered

None beyond the lint fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 9 (Chat Interface) is now COMPLETE: backend agent + API (Plan 01) and frontend wiring (Plan 02)
- Full user flow: type message -> SSE stream tokens -> see markdown + citations -> click citation -> SourceViewerModal -> stop/clear/retry
- Phase 11 (Corrections & Refinement) can polish chat UX, test with real cases
- Phase 12 (Demo Preparation) can showcase chat as a key feature

---
*Phase: 09-chat-interface*
*Completed: 2026-02-09*
