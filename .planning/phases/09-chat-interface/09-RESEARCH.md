# Phase 9: Chat Interface - Research

**Researched:** 2026-02-09
**Domain:** Chat Agent (ADK LlmAgent with tools), SSE streaming, Frontend chat UI enhancement
**Confidence:** HIGH

## Summary

This phase builds an evidence-backed case Q&A Chat Agent that queries all analysis tables (findings, KG, synthesis, timeline, locations, tasks) and responds with grounded, citation-backed answers. The frontend chat UI already exists (floating draggable window with message history, typing indicator, drag/resize) but currently uses mock responses. The backend has no chat agent or endpoint yet.

The chat agent is a **standalone LlmAgent** (not part of the analysis pipeline) that runs on-demand when users send messages. It gets 4 consolidated tools for DB queries, full synthesis context injected into the system prompt on first message, and streams responses token-by-token via SSE. The existing codebase provides all necessary patterns: agent factory in `factory.py`, SSE infrastructure in `sse.py`/`agent_events.py`, ADK Runner/Session management in `adk_service.py`, and full DB models for every table the agent needs to query.

**Primary recommendation:** Build a chat-specific agent factory method, 4 tool functions with direct DB queries (bypassing the HTTP API layer), a new SSE-based POST endpoint at `/api/cases/:caseId/chat`, and upgrade the frontend hook from fetch-JSON to EventSource streaming with citation chip rendering.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-adk | 1.23.0 | Agent framework (LlmAgent, Runner, Session) | Already powering all agents |
| google-genai types | (bundled) | Gemini API types (Content, Part, ThinkingConfig) | Used everywhere |
| FastAPI | (installed) | HTTP endpoints + SSE | Current backend framework |
| sse-starlette | (installed) | EventSourceResponse for SSE | Already used in `sse.py` |
| SQLAlchemy async | (installed) | DB queries for tools | Current ORM layer |
| react-markdown | (check) | Markdown rendering for assistant messages | Standard for chat UIs |

### Frontend (May Need Adding)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-markdown | latest | Render assistant markdown responses | All assistant messages |
| remark-gfm | latest | GitHub-Flavored Markdown tables/strikethrough | If needed for GFM features |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct DB queries in tools | Call existing HTTP API endpoints | DB queries are simpler, no auth overhead, no HTTP round-trip; tools run server-side anyway |
| ADK Runner for chat | Direct google-genai client | ADK Runner provides session management, tool dispatch, event streaming; much less custom code |
| Custom SSE endpoint | ADK's built-in streaming | ADK streaming is for Live API (voice/video); text chat needs custom SSE with our event format |

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── agents/
│   ├── chat_agent.py            # Chat agent factory + system prompt builder
│   └── prompts/
│       └── chat.py              # Chat system prompt template
├── agents/chat_tools.py         # 4 tool functions (query_knowledge_graph, get_findings, get_synthesis, search_findings)
├── api/
│   └── chat.py                  # POST /api/cases/{case_id}/chat endpoint (SSE streaming)
├── services/
│   └── chat_service.py          # Chat session management, context loading, agent execution

frontend/src/
├── hooks/
│   └── useChatbot.ts            # REWRITE: SSE streaming, citation parsing, stop/cancel
├── components/app/
│   └── chatbot.tsx              # ENHANCE: markdown rendering, citation chips, tool activity, stop button, clear, disabled state
├── types/
│   └── chatbot.ts               # UPDATE: streaming types, citation types, tool activity types
```

### Pattern 1: Chat Agent as Standalone LlmAgent with Function Tools

**What:** Create a fresh `LlmAgent` per chat session with 4 Python function tools registered via the `tools=[]` parameter. ADK auto-wraps plain functions as `FunctionTool`.

**When to use:** Every chat interaction.

**Key insight from codebase:** All existing agents use `output_schema` for structured JSON output. The chat agent does NOT need `output_schema` -- it should produce free-form text with inline citations. This is a different pattern from the pipeline agents.

**Example:**
```python
# Source: ADK docs + existing factory.py pattern
from google.adk.agents import LlmAgent

def create_chat_agent(
    case_id: str,
    system_prompt: str,
) -> LlmAgent:
    """Create a standalone chat agent with DB query tools."""
    from app.agents.chat_tools import (
        query_knowledge_graph,
        get_findings,
        get_synthesis,
        search_findings,
    )

    return LlmAgent(
        name=_safe_name("chat", case_id),
        model=MODEL_FLASH,  # Flash for speed in chat
        instruction=system_prompt,
        tools=[
            query_knowledge_graph,
            get_findings,
            get_synthesis,
            search_findings,
        ],
        # NO output_schema -- free-form text with citations
        # NO planner -- chat doesn't need thinking budget overhead
        generate_content_config=types.GenerateContentConfig(
            temperature=0.3,  # Low for factual grounding
        ),
    )
```

### Pattern 2: Tool Functions with Database Access via ToolContext

**What:** ADK function tools receive typed parameters from the LLM. For DB access, the tools need the `case_id` to scope queries. Two approaches: (a) closure-based tools that capture `case_id` and a DB session factory, or (b) use ADK's `ToolContext` to pass state.

**Recommended approach:** Closure-based factories that return functions. This matches the project's existing pattern of creating fresh agents per invocation.

**Example:**
```python
# Tool factory pattern -- returns a function with case_id baked in
def make_get_findings_tool(case_id: str, db_factory):
    async def get_findings(
        agent_type: str | None = None,
        category: str | None = None,
        min_confidence: float = 0.0,
    ) -> dict:
        """Retrieve domain analysis findings for this case.

        Args:
            agent_type: Filter by agent (financial, legal, evidence, strategy).
            category: Filter by finding category.
            min_confidence: Minimum confidence score (0-100).

        Returns:
            dict with findings list and count.
        """
        async with db_factory() as db:
            # Direct SQLAlchemy query, no HTTP
            ...
        return {"findings": [...], "count": N}
    return get_findings
```

### Pattern 3: SSE Streaming for Chat Responses

**What:** The chat endpoint returns an `EventSourceResponse` that streams events as the agent produces them. This is different from the existing Command Center SSE (which is GET + pubsub). Chat SSE is POST + direct generator.

**Key events to stream:**
- `chat-token`: Incremental text token (for token-by-token display)
- `chat-tool-start`: Tool invocation started (name only)
- `chat-tool-end`: Tool invocation completed
- `chat-done`: Response complete, includes full message + citations
- `chat-error`: Error occurred

**Example:**
```python
@router.post("/api/cases/{case_id}/chat")
async def chat_endpoint(
    case_id: UUID,
    body: ChatRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Validate ownership, load context, create agent
    ...
    async def event_generator():
        async for event in runner.run_async(...):
            # Extract text parts, tool calls, etc.
            for sse_event in transform_adk_event(event):
                yield sse_event
        yield {"event": "chat-done", "data": json.dumps(final_message)}

    return EventSourceResponse(
        event_generator(),
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )
```

### Pattern 4: Context Injection via System Prompt

**What:** On first message (or session creation), load the full `case_synthesis` record and inject it into the agent's instruction/system prompt. This gives the agent complete investigative context from message #1.

**Data to inject:**
- `CaseSynthesis.case_summary` -- executive summary
- `CaseSynthesis.case_verdict` -- verdict assessment (JSONB)
- `CaseSynthesis.key_findings_summary` -- distilled key findings
- `CaseSynthesis.risk_assessment` -- risk narrative
- `CaseSynthesis.cross_domain_conclusions` -- cross-domain links
- Counts: hypotheses, contradictions, gaps, timeline events, locations, findings, entities

### Pattern 5: Frontend SSE Consumption with EventSource

**What:** Replace the current fetch-JSON pattern in `useChatbot.ts` with EventSource (or fetch + ReadableStream for POST). Standard `EventSource` only supports GET; for POST with body, use the `fetch` API with `response.body.getReader()` and parse SSE manually, or use a library like `@microsoft/fetch-event-source`.

**Recommended:** Use `@microsoft/fetch-event-source` (or the newer `eventsource-parser`) since the chat endpoint is POST.

### Anti-Patterns to Avoid

- **Reusing the pipeline's DomainAgentRunner for chat:** The runner is designed for batch analysis with execution tracking, retries, and Pro-to-Flash fallback. Chat needs to be lightweight and fast.
- **Using output_schema on the chat agent:** This forces JSON output and prevents natural language responses with inline citations.
- **Calling existing HTTP API endpoints from tools:** Adds auth overhead, HTTP round-trip, and serialization. Tools run server-side -- query the DB directly.
- **Storing full chat history in the session state:** ADK sessions use `contents` (conversation history) natively. Don't duplicate in session state.
- **Creating a new DB connection per tool call:** Use a shared async session or session factory passed via closure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE streaming from POST endpoint | Custom SSE parser | `@microsoft/fetch-event-source` or `eventsource-parser` | Handles reconnection, parsing, error handling |
| Markdown rendering in chat | Custom HTML parser | `react-markdown` + `remark-gfm` | Battle-tested, XSS-safe, extensible with custom renderers |
| Agent session management | Custom session tracking | ADK `DatabaseSessionService` + `Runner` | Already manages conversation history, tool dispatch |
| Citation extraction from text | Regex-only parser | Regex + structured post-processing | Model outputs need robust extraction |
| PDF export of chat | Backend PDF generation | `jspdf` or `html2pdf.js` client-side | No backend endpoint needed, runs in browser |

## Common Pitfalls

### Pitfall 1: ADK LlmAgent with tools + output_schema is incompatible

**What goes wrong:** When `output_schema` is set, the LLM is forced to produce JSON conforming to the schema. This prevents natural language responses with inline citations and also conflicts with tool calling in some ADK versions.

**Why it happens:** The existing pipeline agents all use `output_schema` because they need structured output. The chat agent needs free-form text.

**How to avoid:** Do NOT set `output_schema` on the chat agent. Let it produce natural text. Citations should be inline in the text using a convention the model is instructed to follow (e.g., `[Source: filename, page:N]`).

**Warning signs:** Agent returns JSON instead of natural language, or tool calls fail.

### Pitfall 2: EventSource doesn't support POST requests

**What goes wrong:** The browser's native `EventSource` API only supports GET requests. The chat endpoint needs POST to send the message body and conversation history.

**Why it happens:** SSE specification only defines GET. The project's existing SSE endpoints are all GET (file-status, command-center).

**How to avoid:** Use `@microsoft/fetch-event-source` which wraps `fetch()` with SSE parsing, supporting any HTTP method. Or use raw `fetch()` + `TextDecoderStream` + manual SSE line parsing.

**Warning signs:** 405 Method Not Allowed, or inability to send request body.

### Pitfall 3: ADK Runner.run_async yields events including tool calls, not just text

**What goes wrong:** Naively extracting text from every event misses tool call events and may duplicate text. Some events contain thinking parts (marked with `thought=True`), function calls, or function responses.

**Why it happens:** ADK events include the full agent execution trace: model responses, tool invocations, tool results, and final responses.

**How to avoid:** Filter events by type:
- `event.content.parts` with `part.text` and NOT `part.thought` = streamable text
- `event.content.parts` with `part.function_call` = tool invocation (show "Searching...")
- `event.content.parts` with `part.function_response` = tool result (hide from user)
- `event.is_final_response()` = last event

**Warning signs:** Tool call JSON appearing in chat, thinking traces visible to user, duplicate text.

### Pitfall 4: DB session lifetime in async tool functions

**What goes wrong:** If tools share a single DB session and one tool's query fails or the session is committed mid-turn, subsequent tools may see stale data or errors.

**Why it happens:** Tool functions run within the same agent turn. ADK may call multiple tools in parallel.

**How to avoid:** Each tool function should create its own DB session via a session factory (async context manager). Keep tool DB interactions read-only (no commits needed -- tools only query, never write).

**Warning signs:** `sqlalchemy.exc.InvalidRequestError`, stale data, "session is closed" errors.

### Pitfall 5: Chat disabled state when analysis hasn't run

**What goes wrong:** User opens chat before running analysis. Agent has no data to query, returns empty/useless responses.

**Why it happens:** Chat relies on findings, synthesis, KG data that only exist after pipeline runs.

**How to avoid:** Check `Case.latest_workflow_id IS NOT NULL` AND `Case.status != 'PROCESSING'` before allowing chat. Frontend shows disabled state with "Run analysis first" message. Backend returns 400 if no synthesis data exists.

**Warning signs:** Empty tool results, agent hallucinating without evidence.

### Pitfall 6: Large tool responses exceeding context window

**What goes wrong:** A case with hundreds of findings returns too much data from `get_findings`, blowing the context window.

**Why it happens:** Tools return full finding text + citations for every finding.

**How to avoid:** Truncation strategy per tool:
- `get_findings`: Default limit of 50 findings, return title + first 200 chars of finding_text + citations. Let agent use `search_findings` for deeper queries.
- `query_knowledge_graph`: Limit entities to 100, relationships to 200.
- `get_synthesis`: Always return full synthesis (it's one record).
- `search_findings`: Already limited by PostgreSQL full-text search ranking.

**Warning signs:** 400/413 errors from Gemini, slow responses, context window exceeded errors.

### Pitfall 7: Citation format consistency between model output and frontend parser

**What goes wrong:** The model produces citations in varying formats that the frontend regex parser can't reliably extract.

**Why it happens:** LLMs don't follow citation format instructions perfectly every time.

**How to avoid:** Use a strict citation format in the system prompt (e.g., `[[file_id|locator|short_label]]`) and provide examples. Parse with a lenient regex that handles common variations. Fall back to showing the citation text as-is if parsing fails. The `chat-done` event should include structured citations as a separate field alongside the raw text.

**Warning signs:** Broken citation chips, missing citations, citation text showing as raw markup.

## Code Examples

### Tool Function: query_knowledge_graph

```python
# Source: Based on existing knowledge_graph.py API + KgEntity/KgRelationship models
async def query_knowledge_graph(
    entity_type: str | None = None,
    entity_name_search: str | None = None,
    limit: int = 50,
) -> dict:
    """Query the knowledge graph for entities and their relationships.

    Args:
        entity_type: Filter entities by type (e.g., 'person', 'organization', 'monetary_amount').
        entity_name_search: Search entities by name (case-insensitive substring match).
        limit: Maximum number of entities to return (default 50, max 100).

    Returns:
        dict with entities (name, type, description, connections) and relationships.
    """
    from app.database import _get_sessionmaker
    from app.models.knowledge_graph import KgEntity, KgRelationship

    limit = min(limit, 100)
    session_factory = _get_sessionmaker()

    async with session_factory() as db:
        query = select(KgEntity).where(
            KgEntity.case_id == _case_id,  # captured via closure
            KgEntity.merged_into_id.is_(None),
        )
        if entity_type:
            query = query.where(KgEntity.entity_type == entity_type)
        if entity_name_search:
            query = query.where(KgEntity.name.ilike(f"%{entity_name_search}%"))

        query = query.order_by(KgEntity.degree.desc()).limit(limit)
        result = await db.execute(query)
        entities = list(result.scalars().all())

        entity_ids = [e.id for e in entities]

        # Fetch relationships involving these entities
        rel_query = select(KgRelationship).where(
            KgRelationship.case_id == _case_id,
            (KgRelationship.source_entity_id.in_(entity_ids))
            | (KgRelationship.target_entity_id.in_(entity_ids)),
        ).limit(200)
        rel_result = await db.execute(rel_query)
        relationships = list(rel_result.scalars().all())

    return {
        "entities": [
            {
                "name": e.name,
                "type": e.entity_type,
                "description": e.description_brief or "",
                "domain": e.domain,
                "confidence": e.confidence,
                "connections": e.degree,
                "source_finding_ids": e.source_finding_ids or [],
            }
            for e in entities
        ],
        "relationships": [
            {
                "source": r.source_entity.name if r.source_entity else str(r.source_entity_id),
                "target": r.target_entity.name if r.target_entity else str(r.target_entity_id),
                "type": r.relationship_type,
                "label": r.label,
                "evidence": r.evidence_excerpt or "",
            }
            for r in relationships
        ],
        "entity_count": len(entities),
        "relationship_count": len(relationships),
    }
```

### SSE Event Parsing in Frontend

```typescript
// Source: @microsoft/fetch-event-source pattern
import { fetchEventSource } from '@microsoft/fetch-event-source';

async function sendMessageStreaming(
  caseId: string,
  message: string,
  history: ChatMessage[],
  onToken: (text: string) => void,
  onToolStart: (toolName: string) => void,
  onToolEnd: (toolName: string) => void,
  onDone: (message: ChatMessage) => void,
  onError: (error: string) => void,
  abortController: AbortController,
) {
  const token = await getAuthToken();
  await fetchEventSource(`${API_URL}/api/cases/${caseId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message, history }),
    signal: abortController.signal,
    onmessage(event) {
      switch (event.event) {
        case 'chat-token':
          onToken(JSON.parse(event.data).text);
          break;
        case 'chat-tool-start':
          onToolStart(JSON.parse(event.data).tool_name);
          break;
        case 'chat-tool-end':
          onToolEnd(JSON.parse(event.data).tool_name);
          break;
        case 'chat-done':
          onDone(JSON.parse(event.data));
          break;
        case 'chat-error':
          onError(JSON.parse(event.data).error);
          break;
      }
    },
    onerror(err) {
      onError('Connection lost. Try again.');
      throw err; // Stop retrying
    },
  });
}
```

### Citation Chip Pattern in Message Rendering

```typescript
// Parse citation markers from model output and render as chips
// Expected format from model: [[file_id|locator|label]]
const CITATION_REGEX = /\[\[([a-f0-9-]+)\|([^|]*)\|([^\]]+)\]\]/g;

function renderMessageWithCitations(
  text: string,
  onCitationClick: (citation: Citation) => void,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CITATION_REGEX.exec(text)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add citation chip
    const [, fileId, locator, label] = match;
    parts.push(
      <CitationChip
        key={match.index}
        fileId={fileId}
        locator={locator}
        label={label}
        onClick={() => onCitationClick({ file_id: fileId, locator, excerpt: '' })}
      />
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}
```

## Existing Code Inventory (What Already Exists)

### Frontend (Phase 1 - REQ-CHAT-001 Done)

| File | What It Does | What Needs Changing |
|------|-------------|---------------------|
| `frontend/src/components/app/chatbot.tsx` | Floating chat window, dragging, resizing, message list, input, typing indicator | Add: markdown rendering, citation chips, tool activity section, stop button, clear button, disabled state |
| `frontend/src/hooks/useChatbot.ts` | Fetch-JSON to `/api/chat`, mock fallback, message state | REWRITE: SSE streaming to `/api/cases/:caseId/chat`, token accumulation, abort support, tool activity tracking |
| `frontend/src/types/chatbot.ts` | ChatMessage, ChatbotContext, ChatApiRequest/Response types | UPDATE: Add streaming event types, citation types, tool activity types |
| `frontend/src/hooks/useSourceNavigation.ts` | Resolves Citation -> SourceViewerContent, handles signed URLs | REUSE as-is for citation chip clicks |
| `frontend/src/lib/citation-utils.ts` | parseLocator, categoryToViewerType, formatLocatorDisplay | REUSE as-is |
| `frontend/src/lib/api-client.ts` | JWT-authenticated fetch wrapper | REUSE for token retrieval, but SSE uses direct fetch |
| Case layout (`layout.tsx`) | Renders `<Chatbot>` on all case pages | Update: pass `caseStatus`, check if analysis has run |

### Backend (Nothing exists yet for chat)

| File | What It Does | Relevance |
|------|-------------|-----------|
| `backend/app/agents/factory.py` | Agent factory (LlmAgent creation) | Pattern to follow for `create_chat_agent` |
| `backend/app/agents/base.py` | MODEL_FLASH/PRO constants, callback factories, PublishFn | Reuse model constants |
| `backend/app/services/adk_service.py` | Runner creation, session management, file preparation | Reuse `create_stage_runner`, `get_or_create_stage_session` |
| `backend/app/api/sse.py` | SSE endpoints, EventSourceResponse, heartbeat | Pattern for chat SSE endpoint |
| `backend/app/services/agent_events.py` | Event publishing, subscriber management | NOT needed for chat (chat is 1:1, not pubsub) |
| `backend/app/models/findings.py` | CaseFinding model (tsvector search) | Tool: get_findings, search_findings |
| `backend/app/models/knowledge_graph.py` | KgEntity, KgRelationship models | Tool: query_knowledge_graph |
| `backend/app/models/synthesis.py` | CaseSynthesis, CaseHypothesis, CaseContradiction, CaseGap, TimelineEvent, Location | Tool: get_synthesis + context injection |
| `backend/app/models/investigation_task.py` | InvestigationTask model | Tool: get_synthesis (includes tasks) |
| `backend/app/services/findings_service.py` | search_findings (tsvector), list_findings | Reuse functions in search_findings tool |
| `backend/app/api/synthesis.py` | Synthesis API endpoints | Pattern for DB queries in tools |
| `backend/app/api/knowledge_graph.py` | KG API endpoints | Pattern for DB queries in tools |

## ADK-Specific Findings

### ADK Version: 1.23.0

**Tools registration:** Pass plain Python functions in the `tools=[]` list. ADK auto-wraps them as `FunctionTool`. Function signature, docstring, and type hints become the tool schema that the LLM sees.

**Session management:** Use `DatabaseSessionService` (already initialized as singleton in `adk_service.py`). Chat sessions should use a deterministic session ID based on `case_id + user_id` so conversation history persists across page refreshes within the same session.

**Runner.run_async:** Returns an `AsyncIterator[Event]`. Each event may contain:
- Model response parts (text, thinking, function_call)
- Function response parts (tool results fed back to model)
- Final response (is_final_response() == True)

**Context Caching (ContextCacheConfig):** Available in ADK v1.15.0+. Configured at `App` level, not `Agent` level. Requires wrapping the agent in an `App` object. Config: `min_tokens=2048`, `ttl_seconds=7200` (2 hours per CONTEXT.md), `cache_intervals=10`. This caches the system prompt + initial context so repeated chat messages don't re-send the full synthesis.

**Important:** Context caching works at the App level. The chat agent needs to be wrapped in `google.adk.apps.app.App` with a `ContextCacheConfig` to enable it.

### No output_schema for chat

All existing pipeline agents use `output_schema` to force structured JSON. The chat agent MUST NOT use `output_schema` because:
1. It needs to produce natural language responses
2. `output_schema` + `tools` can conflict (model tries to output schema-conforming JSON AND call tools)
3. Citations should be inline in text, not in a separate JSON field

### Agent naming

Use `_safe_name("chat", case_id)` from `factory.py` to create valid ADK agent names.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| EventSource (GET only) | fetch-event-source (POST SSE) | 2023+ | Enables POST with body for chat |
| numbered footnotes | Inline citation chips | Project decision | Better UX, clickable source navigation |
| Separate tools per table | 4 consolidated tools | Project decision | Agent sees full picture with fewer calls |
| Per-message context loading | System prompt injection + caching | ADK v1.15+ | Faster responses, lower token cost |

## Open Questions

1. **Citation format agreement between model and frontend parser**
   - What we know: Model needs to produce parseable citation markers; frontend needs to extract them reliably
   - What's unclear: Exact format string that works best with Gemini models. Options: `[[file_id|locator|label]]`, `[Source: label, locator](file_id)`, or structured `<cite>` tags
   - Recommendation: Use `[[file_id|locator|label]]` with clear examples in the system prompt. Include a fallback in `chat-done` event with structured citations array extracted server-side.

2. **How to handle tool context (case_id, db_session) in ADK tool functions**
   - What we know: ADK auto-wraps plain functions. Functions can't easily access external state unless via closures or module-level variables.
   - What's unclear: Whether ADK's `ToolContext` parameter injection works well for passing case_id
   - Recommendation: Use closure-based tool factories: a function that takes `case_id` and returns the tool function with case_id captured. Create fresh tool functions per chat request.

3. **Conversation history management for multi-turn chat**
   - What we know: ADK `DatabaseSessionService` stores session history in PG. `Runner.run_async` sends `new_message` and automatically includes prior turns from the session.
   - What's unclear: Whether the frontend should track history or rely entirely on ADK sessions
   - Recommendation: Let ADK manage history server-side. Frontend sends only the latest message. Session ID = deterministic hash of `case_id + user_id + "chat"`. Clear button creates a new session (new ID).

## Sources

### Primary (HIGH confidence)
- ADK docs (local): `.claude/skills/google-adk/adk-docs/` -- tools, agents, caching, streaming
- Existing codebase: `factory.py`, `adk_service.py`, `base.py`, `domain_agent_runner.py`
- Existing DB models: `findings.py`, `knowledge_graph.py`, `synthesis.py`, `investigation_task.py`
- Existing frontend: `chatbot.tsx`, `useChatbot.ts`, `chatbot.ts`, `useSourceNavigation.ts`
- ADK version verified: 1.23.0 (`google.adk.__version__`)

### Secondary (MEDIUM confidence)
- ADK context caching docs: Supported since v1.15.0, uses App-level config
- `@microsoft/fetch-event-source`: Standard library for POST+SSE, widely used
- `react-markdown`: Standard library for chat markdown rendering

### Tertiary (LOW confidence)
- Gemini cached_content API direct usage (if ADK's ContextCacheConfig doesn't fit the standalone agent pattern, may need to use the genai client directly)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, patterns established in codebase
- Architecture: HIGH - patterns directly derived from existing agent/SSE/API code
- Pitfalls: HIGH - identified from hands-on codebase analysis and ADK docs
- Tool implementation: HIGH - DB models and query patterns already exist in API endpoints
- Frontend enhancement: HIGH - existing chatbot.tsx and useChatbot.ts fully understood
- Context caching: MEDIUM - ADK docs confirm support but App-level config may need adaptation

**Research date:** 2026-02-09
**Valid until:** 30 days (stable codebase, ADK version pinned)
