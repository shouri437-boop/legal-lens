---
phase: 09-chat-interface
plan: 01
subsystem: api
tags: [gemini, adk, sse, chat, llm-agent, sqlalchemy, fastapi]

# Dependency graph
requires:
  - phase: 08-synthesis-agent
    provides: "Synthesis tables (hypotheses, contradictions, gaps, timeline, locations, tasks) and CaseSynthesis model"
  - phase: 07-knowledge-storage
    provides: "KgEntity, KgRelationship models and findings service with tsvector search"
provides:
  - "POST /api/cases/{case_id}/chat SSE streaming endpoint"
  - "4 closure-based chat tool factories for DB queries"
  - "Chat system prompt builder with full case context injection"
  - "Chat service layer with ADK session management"
affects: ["09-02 (frontend chat wiring)", "11 (corrections/refinement)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closure-based tool factories for case-scoped DB queries"
    - "SSE POST endpoint with async generator for chat streaming"
    - "Independent DB sessions per tool call via _get_sessionmaker()"
    - "ADK session_service directly (not get_or_create_stage_session) for chat sessions"

key-files:
  created:
    - "backend/app/agents/chat_tools.py"
    - "backend/app/agents/prompts/chat.py"
    - "backend/app/services/chat_service.py"
    - "backend/app/api/chat.py"
  modified:
    - "backend/app/main.py"
    - "packages/types/src/generated/api.ts"

key-decisions:
  - "Flash model for chat speed (no Pro needed for tool-calling Q&A)"
  - "No planner/thinking on chat agent (speed matters more than deep reasoning)"
  - "No temperature override (Gemini 3 requires default 1.0)"
  - "No output_schema (free-form text with inline citations)"
  - "Deterministic session ID from case_id:user_id:chat hash for persistent conversations"
  - "Citation format: [[file_id|locator|label]] with server-side extraction regex"
  - "400 response when analysis hasn't been run (synthesis data required)"

patterns-established:
  - "Closure tool factory: make_*_tool(case_id) returns async function with baked-in scope"
  - "Chat SSE events: chat-token, chat-tool-start, chat-tool-end, chat-done, chat-error"
  - "Context injection via system prompt (not session state) for case synthesis data"

# Metrics
duration: 5min
completed: 2026-02-09
---

# Phase 9 Plan 01: Chat Backend Summary

**Chat agent with 4 DB-query tools, SSE streaming POST endpoint, and full case synthesis context injection**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-09T18:42:49Z
- **Completed:** 2026-02-09T18:48:22Z
- **Tasks:** 2
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- 4 closure-based tool factories (query_knowledge_graph, get_findings with detail/list modes, get_synthesis with 6 optional sections, search_findings via tsvector) each creating independent DB sessions per call
- System prompt builder injecting full case context: synthesis summary, verdict, risk assessment, cross-domain conclusions, and 8 data type counts
- Chat service layer with context loading (8 COUNT queries + synthesis + case metadata) and ADK session management (deterministic session IDs, conversation history persistence)
- SSE streaming POST endpoint at /api/cases/{case_id}/chat with auth, case ownership, 400 on missing analysis, 5 event types, and citation extraction regex

## Task Commits

Each task was committed atomically:

1. **Task 1: Chat tools and system prompt** - `9743333` (feat)
2. **Task 2: Chat service, API endpoint, and router registration** - `79de681` (feat)

## Files Created/Modified

- `backend/app/agents/chat_tools.py` - 4 tool factory functions for case-scoped DB queries
- `backend/app/agents/prompts/chat.py` - System prompt builder with case context injection
- `backend/app/services/chat_service.py` - Context loading and agent/runner/session creation
- `backend/app/api/chat.py` - SSE streaming POST endpoint with ChatRequest model
- `backend/app/main.py` - Chat router registration
- `packages/types/src/generated/api.ts` - Updated OpenAPI types with chat endpoint

## Decisions Made

- **Flash model for chat:** Chat is latency-sensitive Q&A, not deep analysis. Flash provides faster responses with tool-calling capability sufficient for DB queries.
- **No planner/thinking budget:** Chat agent doesn't need thinking overhead. Speed matters more than deep reasoning for interactive Q&A.
- **Default temperature (1.0):** Gemini 3 models require temperature=1.0 per ADK limitations. No override set.
- **Inline agent naming:** `_safe_name` logic inlined in chat_service.py (2 lines) rather than importing from factory.py, per plan specification.
- **Deterministic session ID:** SHA-256 of `case_id:user_id:chat` provides persistent conversation history across page refreshes without requiring frontend session tracking.
- **Citation regex server-side:** `[[file_id|locator|label]]` format extracted on server in chat-done event, providing structured citations alongside raw text.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Chat backend is complete and ready for frontend wiring (Phase 9 Plan 02)
- Frontend needs to update useChatbot.ts from fetch-JSON to SSE streaming
- Frontend needs to update chat endpoint path from `/api/chat` to `/api/cases/{caseId}/chat`
- Citation chip rendering and tool activity UX are frontend-only work

---
*Phase: 09-chat-interface*
*Completed: 2026-02-09*
