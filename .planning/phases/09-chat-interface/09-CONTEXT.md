# Phase 9: Chat Interface - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Evidence-backed case Q&A via a Chat Agent with full DB access. The agent receives complete synthesis context on initialization and queries analysis tables (findings, KG, synthesis, timeline, locations) for every response. Every factual statement must be grounded in exact source citations from prior agent runs. Frontend chat UI already exists (floating window, draggable, message history) — this phase builds the backend agent + API and wires the frontend to real streaming responses with citations.

</domain>

<decisions>
## Implementation Decisions

### Response & citation formatting
- Citations render as **inline source chips** (small clickable badges within the text, e.g., `[Financial Report, p.12]`) — not numbered footnotes
- Hover over a citation chip shows a **tooltip with the exact excerpt text** and file name
- Click on a citation chip **opens SourceViewerModal** at the exact page/timestamp (reuses Phase 10 `useSourceNavigation` hook)
- Assistant responses render **full markdown** — headers, bullet lists, bold, italic, code blocks all supported

### Streaming UX
- Text streams **token-by-token** as it arrives from the model (classic ChatGPT feel)
- Tool calls (DB queries) show as an **expandable "Agent is working..." section** — collapsed by default, expandable to see tool names
- When expanded, show **tool name only** (e.g., "Searching knowledge graph...", "Querying findings...") — no parameters or result counts
- **Stop button** appears while streaming; clicking cancels the response and keeps what was generated so far

### PDF export
- Generated **client-side** using a browser PDF library (no backend endpoint needed)
- Includes: case header (name, date), all messages with timestamps, citations listed per message — **professional report** styling with proper fonts and formatted citation sections
- **Priority: nice-to-have** — implement if time allows after core chat functionality is working; not a blocker for phase completion

### Chat session behavior
- Chat is **disabled with a message** when analysis hasn't been run yet — chat button grayed out or window shows "Run analysis first to enable chat"
- **No conversation starters** — empty chat, user types their own question
- **Clear button with no confirmation** — single click clears immediately (session-only data, low stakes)
- Backend/network errors appear as **inline error messages** — red-tinted message bubble in the chat ("Something went wrong. Try again.") with a retry button

### Backend data fetching
- **4 consolidated tools** (not 7 individual tools) — agent must see the full picture with fewer calls:
  1. `query_knowledge_graph` — entities + relationships from `kg_entities` and `kg_relationships` tables
  2. `get_findings` — all domain findings from `case_findings` table (filterable by agent_type, category, min_confidence; supports single-finding drill-down by ID for full text retrieval)
  3. `get_synthesis` — consolidated view of hypotheses + contradictions + gaps + timeline events + locations from synthesis tables
  4. `search_findings` — full-text search over `case_findings` via PostgreSQL tsvector
- **Full context injection on first message** — load entire case_synthesis (verdict, summary, key findings, risk assessment, cross-domain conclusions) + counts from all tables into system prompt when chat starts. Agent has full investigative context from message #1.
- **Context caching DEFERRED** — Context caching (REQ-AGENT-007f / Gemini cached_content with 2hr TTL) is deferred from this phase. It is a cost optimization, not a functional requirement. The chat agent works correctly without caching. Implementing it requires wrapping the agent in an ADK `App` object with `ContextCacheConfig`, which needs experimentation. Can be added as a follow-up optimization.

### Claude's Discretion
- Exact system prompt wording and tool-table mapping instructions
- SSE event format and chunk boundaries
- PDF library choice (jspdf, @react-pdf/renderer, or alternative)
- Tool response format and truncation strategy for large result sets
- How citation chips are parsed from the model's text output (regex, special tokens, structured output)

</decisions>

<specifics>
## Specific Ideas

- The agent must be a **standalone LlmAgent** (not part of the pipeline) — it runs on-demand when users chat
- Tool consolidation rationale: the user emphasized "the agent must be able to see the full picture" — fewer tools that return richer data, rather than many narrow tools
- The `get_synthesis` tool is the key consolidation: instead of separate hypotheses/contradictions/gaps/timeline/locations tools, one tool returns the synthesis view with optional filters
- Reuse Phase 10 `useSourceNavigation` hook for citation click behavior — no new source viewer infrastructure needed
- Chat API path must be `POST /api/cases/:caseId/chat` (case-scoped, not global `/api/chat`)
- Frontend currently calls `POST /api/chat` — must update to case-scoped path
- **Gemini model config:** Do NOT override temperature. Gemini 3 models require temperature=1.0 (the default). Setting a lower temperature causes errors or unexpected behavior per ADK limitations.

</specifics>

<deferred>
## Deferred Ideas

- Agent escalation (REQ-CHAT-003) — user requesting re-analysis or new domain agent runs from chat
- DB-persisted chat history (REQ-CHAT-005) — currently session-only in React state
- Context compaction for long sessions (REQ-AGENT-007g) — handle when conversation exceeds context window
- Context caching (REQ-AGENT-007f) — Gemini cached_content with 2hr TTL for cost reduction. Requires ADK `App` wrapping with `ContextCacheConfig`. Deferred as cost optimization.
- Research/Discovery system (REQ-RESEARCH-001 through 009) — web research agent triggered from chat
- Conversation starters / suggested questions — decided against for v1, could add later

</deferred>

---

*Phase: 09-chat-interface*
*Context gathered: 2026-02-09*
