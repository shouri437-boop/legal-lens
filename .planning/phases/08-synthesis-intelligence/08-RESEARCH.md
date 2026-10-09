# Phase 8: Synthesis Agent & Intelligence Layer - Research

**Researched:** 2026-02-08
**Domain:** LLM agent pipeline integration, cross-referencing domain analysis, full-stack data wiring
**Confidence:** HIGH

## Summary

Phase 8 adds the Synthesis Agent as pipeline Stage 8, producing hypotheses, contradictions, gaps, timeline events, investigation tasks, case summary/verdict, and key findings. The backend follows the established KG Builder pattern (DomainAgentRunner subclass, text-only input assembled from DB, structured output written to existing tables). The frontend adds a tab toggle to Command Center ("Agent Flow" vs "Verdict"), wires the Timeline page to real API data, and adds new DetailSidebar content types for synthesis items.

The codebase has very strong patterns to follow. Every component needed -- DB tables (CaseHypothesis, CaseContradiction, CaseGap, CaseSynthesis, TimelineEvent), the DomainAgentRunner template method, the AgentFactory, the SSE event system, the DetailSidebar discriminated union -- already exists. The new `investigation_tasks` table is the only schema addition requiring an Alembic migration. The Synthesis Agent is architecturally identical to the KG Builder: receives text-only input assembled from `case_findings` + `kg_entities`/`kg_relationships`, produces structured JSON output written to dedicated tables.

**Primary recommendation:** Follow the KG Builder agent pattern exactly (subclass DomainAgentRunner, add to AgentFactory, assemble input from DB, write output to tables, wire into pipeline.py Stage 8). Frontend adds new SidebarContentDescriptor union members and a tab toggle in CommandCenter.

## Standard Stack

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google.adk | Current | Agent execution framework | All agents use LlmAgent + DomainAgentRunner |
| google.genai | Current | Gemini API types | Content/Part construction |
| SQLAlchemy 2.0 | Async | DB models and queries | All tables use mapped_column pattern |
| Pydantic | v2 | Structured output schemas | All agent outputs are Pydantic BaseModel |
| FastAPI | Current | API endpoints | Router pattern with auth + ownership checks |
| Alembic | Current | DB migrations | For the new investigation_tasks table |
| React/Next.js | Current | Frontend | App router with (app) group |
| @tanstack/react-query | Current | Data fetching | Used by useTimelineData, all API hooks |
| @xyflow/react | Current | Agent flow canvas | Command Center visualization |
| Zod | Current | Frontend schema validation | Timeline types validated with Zod |
| sse-starlette | Current | SSE streaming | EventSourceResponse pattern |

### Supporting (No new libraries needed)
This phase requires no new library installations. Everything builds on existing dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DomainAgentRunner subclass | Direct LlmAgent instantiation | Would duplicate 200+ lines of retry/fallback logic |
| Text-only input assembly | Passing raw domain_results | DB-sourced input is more reliable (committed, consistent) |

**Installation:** No new packages needed.

## Architecture Patterns

### Backend: Synthesis Agent Runner (follows KG Builder exactly)

```
backend/app/
├── agents/
│   ├── synthesis.py           # SynthesisAgentRunner + assemble_synthesis_input + write_synthesis_output
│   └── prompts/
│       └── synthesis.py       # SYNTHESIS_SYSTEM_PROMPT
├── schemas/
│   └── synthesis.py           # SynthesisOutput Pydantic schema (new file -- not the DB model schemas/synthesis.py currently doesn't exist; the DB model is models/synthesis.py)
├── models/
│   ├── synthesis.py           # EXISTS: CaseHypothesis, CaseContradiction, CaseGap, CaseSynthesis, TimelineEvent, Location
│   └── investigation_task.py  # NEW: InvestigationTask model
├── api/
│   ├── synthesis.py           # NEW: API endpoints for synthesis data
│   └── timeline.py            # NEW: API endpoints for timeline events
└── services/
    └── pipeline.py            # MODIFY: Add Stage 8 after Stage 7b
```

### Backend Pattern: SynthesisAgentRunner (KG Builder clone pattern)

The KG Builder established the exact pattern for post-domain-agent LLM stages:

1. **Runner class**: Subclass `DomainAgentRunner[SynthesisOutput]`
   - Override `get_agent_name()` -> `"synthesis"`
   - Override `_get_output_type()` -> `SynthesisOutput`
   - Override `_create_agent_instance()` -> `AgentFactory.create_synthesis_agent()`
   - Override `_prepare_content()` -> text-only Content from assembled DB data

2. **Input assembly function**: `assemble_synthesis_input(case_id, db)` (like `assemble_kg_builder_input`)
   - Query `case_findings` grouped by agent_type with `[FINDING:uuid]` prefixes
   - Query `kg_entities` with names, types, descriptions, aliases
   - Query `kg_relationships` with labels, types, evidence excerpts
   - Query `Case` for name, description, type
   - Query `CaseFile` for filenames and types
   - Return assembled text string

3. **Output write function**: `write_synthesis_output(case_id, output, workflow_id, db)`
   - Clear existing synthesis data for the case (delete + insert pattern like KG Builder)
   - Write hypotheses to `case_hypotheses`
   - Write contradictions to `case_contradictions`
   - Write gaps to `case_gaps`
   - Write timeline events to `timeline_events`
   - Write investigation tasks to `investigation_tasks` (NEW table)
   - Write case synthesis (summary, verdict, cross-domain, etc.) to `case_synthesis`

4. **Top-level runner**: `run_synthesis(case_id, workflow_id, user_id, db_session, publish_event)`

### Backend Pattern: Pipeline Integration (Stage 8)

Add after Stage 7b (entity backfill) in `pipeline.py`:

```python
# ---- Stage 8: Synthesis Agent ----
from app.agents.synthesis import run_synthesis

synthesis_task_id = str(uuid4())
await emit_agent_started(case_id=case_id, agent_type="synthesis", ...)

try:
    synthesis_result = await run_synthesis(
        case_id=case_id,
        workflow_id=workflow_id,
        user_id=user_id,
        db_session=db,
        publish_event=publish_fn,
    )
    await emit_agent_complete(case_id=case_id, agent_type="synthesis", ...)
except Exception as exc:
    await db.rollback()
    await emit_agent_error(case_id=case_id, agent_type="synthesis", ...)

await db.commit()
```

### Backend Pattern: API Endpoints

Follow the KG API (`knowledge_graph.py`) and Findings API (`findings.py`) patterns:

```python
# synthesis.py API
router = APIRouter(prefix="/api/cases/{case_id}", tags=["synthesis"])

GET  /synthesis          -> CaseSynthesis (summary, verdict, key findings)
GET  /hypotheses         -> list[CaseHypothesis] with filtering
GET  /hypotheses/{id}    -> single CaseHypothesis
GET  /contradictions     -> list[CaseContradiction] with filtering
GET  /contradictions/{id}-> single CaseContradiction
GET  /gaps               -> list[CaseGap] with filtering
GET  /gaps/{id}          -> single CaseGap
GET  /tasks              -> list[InvestigationTask] with filtering
GET  /tasks/{id}         -> single InvestigationTask

# timeline.py API
GET  /timeline           -> list[TimelineEvent] with filtering
GET  /timeline/{id}      -> single TimelineEvent
```

### Frontend: Command Center Tab Toggle

```
frontend/src/
├── app/(app)/cases/[id]/command-center/
│   └── page.tsx              # MODIFY: Add tab state, conditionally render AgentFlow vs Verdict
├── components/
│   ├── CommandCenter/
│   │   └── CommandCenter.tsx  # MODIFY: Accept activeTab prop, render tab toggle in header
│   └── verdict/              # NEW directory
│       ├── VerdictView.tsx    # Scrollable synthesis results page
│       ├── VerdictSummary.tsx # Summary + verdict + evidence strength
│       ├── HypothesisCard.tsx # Card with confidence dot + percentage
│       ├── ContradictionCard.tsx # Side-by-side claim comparison
│       ├── GapCard.tsx        # Gap with priority and suggestions
│       └── TaskCard.tsx       # Investigation task card
├── types/
│   └── detail-sidebar.ts     # MODIFY: Add verdict-hypothesis, verdict-contradiction, etc.
└── hooks/
    ├── useSynthesisData.ts    # NEW: React Query hook for synthesis API
    └── useTimelineData.ts     # MODIFY: Remove mock fallback, wire to real API
```

### Frontend Pattern: DetailSidebar Integration

The DetailSidebar uses a discriminated union pattern. Add new content types:

```typescript
// In detail-sidebar.ts, add to SidebarContentDescriptor union:
export interface VerdictHypothesisContent {
  type: "verdict-hypothesis";
  props: { hypothesis: HypothesisResponse; caseId: string; };
}
export interface VerdictContradictionContent {
  type: "verdict-contradiction";
  props: { contradiction: ContradictionResponse; caseId: string; };
}
export interface VerdictGapContent {
  type: "verdict-gap";
  props: { gap: GapResponse; caseId: string; };
}
export interface VerdictTaskContent {
  type: "verdict-task";
  props: { task: TaskResponse; caseId: string; };
}
```

Then add cases in `detail-sidebar.tsx`'s `renderContent` switch.

### Frontend Pattern: Timeline Wiring

The Timeline components exist with mock data fallback in `useTimelineData.ts`. The timeline API client (`timelineApi.ts`) already has `getTimelineEvents` calling `/{caseId}/timeline`. Wire by:
1. Creating the backend `GET /api/cases/{case_id}/timeline` endpoint that reads `timeline_events` table
2. Updating `TimelineEvent` type to match backend response format (add domain/category fields per CONTEXT.md)
3. Removing the mock data fallback in `useTimelineData.ts`

### Anti-Patterns to Avoid

- **Separate synthesis agent session file**: Do NOT create a new `services/synthesis.py`. Put the agent runner in `agents/synthesis.py` following the KG Builder split (`agents/kg_builder.py` for runner + assembly + write, `services/kg_builder.py` for helper utilities like normalize).
- **Hardcoding pipeline status strings**: Use existing `AgentEventType` enum, not string literals.
- **Creating a new SSE endpoint**: Synthesis events flow through the existing command-center SSE stream. Add new `AgentEventType` enum values if needed (e.g., `SYNTHESIS_COMPLETE`), but do NOT create a separate SSE endpoint.
- **Rewriting the pipeline**: Add Stage 8 after Stage 7b's commit. Do NOT restructure earlier stages.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent execution with retries/fallback | Custom run loop | `DomainAgentRunner` subclass | 467 lines of battle-tested retry, fallback, execution tracking |
| Structured JSON parsing from LLM | Manual JSON extraction | `extract_structured_json()` from `agents/parsing.py` | Handles edge cases, malformed JSON |
| SSE event publication | Custom pub/sub | `emit_agent_started/complete/error()` from `services/agent_events.py` | Consistent with all other agents |
| Execution record management | Manual INSERT/UPDATE | `AgentExecution` model + DomainAgentRunner | Audit trail, token tracking, thinking traces |
| Frontend data fetching | Custom fetch | `@tanstack/react-query` with typed query keys | Caching, invalidation, optimistic updates |
| Frontend sidebar content | Custom panel | DetailSidebar discriminated union pattern | App-wide sidebar with resize, collapse |
| ADK session isolation | Reuse sessions | `get_or_create_stage_session()` with unique stage name | Prevents context window bloat |

## Common Pitfalls

### Pitfall 1: CaseHypothesis Schema Mismatch (Evidence Flat List)
**What goes wrong:** The existing `CaseHypothesis` model has separate `supporting_evidence` and `contradicting_evidence` JSONB columns, but CONTEXT.md says "Hypotheses use flat evidence list with labels: each evidence item tagged as supporting / contradicting / neutral."
**Why it happens:** The DB model was created in Phase 7 before the Phase 8 discussion finalized the flat list decision.
**How to avoid:** The SynthesisOutput schema should produce a flat `evidence` list with `role: "supporting" | "contradicting" | "neutral"`. The DB write function should split this into the existing `supporting_evidence` and `contradicting_evidence` columns, OR migrate the columns. Since the columns are JSONB, we can store a flat list in `supporting_evidence` and leave `contradicting_evidence` null, OR add a new `evidence` JSONB column via migration. Recommended: store the flat list in `supporting_evidence` as-is (it's JSONB, no schema enforcement) and keep `contradicting_evidence` null. The frontend reads the flat list from `supporting_evidence`.
**Warning signs:** Frontend shows empty evidence on hypothesis cards.

### Pitfall 2: Pipeline Session Reuse After KG Builder
**What goes wrong:** The synthesis agent runs after KG Builder in the same `async with session_factory() as db` block. If KG Builder had a `db.rollback()`, the session may be in an inconsistent state.
**Why it happens:** Pipeline error handling after KG Builder failure uses `await db.rollback()`.
**How to avoid:** Wrap Stage 8 in its own try/except with explicit rollback on failure, following the exact pattern used for the KG Builder stage in pipeline.py (lines 994-1033).
**Warning signs:** `PendingRollbackError` on synthesis DB writes.

### Pitfall 3: Timeline Event Date Format
**What goes wrong:** Frontend `TimelineEvent` type expects `date: z.string().datetime()` (ISO 8601), but backend `TimelineEvent.event_date` is `DateTime(timezone=True)`. The LLM may produce dates in various formats.
**Why it happens:** LLM output dates are unpredictable (e.g., "January 2024", "2024-Q3", "March 15").
**How to avoid:** The synthesis output schema should require ISO 8601 format in the Pydantic model (`datetime` field). For fuzzy dates, store as a best-guess datetime with a `date_precision` field (e.g., "day", "month", "year"). The write function should parse and validate before DB insert.
**Warning signs:** Frontend Timeline shows "Invalid Date" or events clustered at epoch.

### Pitfall 4: Frontend Tab State Lost on Navigation
**What goes wrong:** User selects "Verdict" tab, navigates to Timeline, comes back, and tab resets to "Agent Flow".
**Why it happens:** Tab state is local component state in the page.tsx.
**How to avoid:** Use URL search params (`?tab=verdict`) or a lightweight context. URL params are preferred because they survive page refreshes and enable direct linking.
**Warning signs:** User constantly has to re-select the Verdict tab.

### Pitfall 5: Synthesis Output Too Large for Structured Output
**What goes wrong:** The synthesis output contains hypotheses + contradictions + gaps + timeline_events + tasks + summary + verdict + key_findings + cross-domain conclusions. If the LLM output exceeds the structured output token limit, parsing fails.
**Why it happens:** Gemini structured output has token limits. A complex case could produce 50+ timeline events, 20 hypotheses, etc.
**How to avoid:** Set reasonable max counts in the prompt (e.g., "top 10 hypotheses", "up to 30 timeline events", "top 5 key findings"). The DomainAgentRunner already handles parse failures with retries and Flash fallback.
**Warning signs:** `extract_structured_json` returns None on all retries.

### Pitfall 6: Case Header Verdict Badge Without New DB Columns
**What goes wrong:** CONTEXT.md says "Verdict badge replaces current status badge" and "one-line summary always visible next to verdict badge." The `Case` model has no `verdict` or `verdict_summary` column.
**Why it happens:** Verdict data lives in `case_synthesis.case_verdict` (JSONB), not on the Case model.
**How to avoid:** Two options: (a) Add `verdict_label` and `verdict_summary` columns to Case model via migration, populated when synthesis completes. (b) Fetch from `case_synthesis` table via a separate API call. Option (a) is better for the cases list page which needs verdict without a join. Recommended: add columns to Case + Alembic migration.
**Warning signs:** Cases list shows no verdict badge; case header requires extra API call.

### Pitfall 7: Investigation Tasks Table Missing
**What goes wrong:** The synthesis agent tries to write investigation tasks but the table doesn't exist.
**Why it happens:** The Phase 7 migration (`c7a1f8d23e51`) created synthesis tables but NOT `investigation_tasks`.
**How to avoid:** Create a new Alembic migration for `investigation_tasks` as the first task in Phase 8. Run migration before testing the synthesis agent.
**Warning signs:** `ProgrammingError: relation "investigation_tasks" does not exist`.

### Pitfall 8: Verdict Tab Activation Timing
**What goes wrong:** Verdict tab activates before synthesis data is fully committed to DB.
**Why it happens:** SSE events emit before the DB commit completes.
**How to avoid:** Emit a specific `synthesis-complete` SSE event AFTER the `db.commit()` that persists all synthesis data. Frontend enables the Verdict tab only upon receiving this event (not upon `agent-complete` for the synthesis agent).
**Warning signs:** Verdict tab activates but API calls return 404 or empty data.

## Code Examples

### Pattern 1: SynthesisAgentRunner (mirrors KgBuilderAgentRunner)

```python
# Source: backend/app/agents/kg_builder.py (lines 30-105)
class SynthesisAgentRunner(DomainAgentRunner[SynthesisOutput]):
    """Synthesis agent runner that assembles text-only input from case findings + KG."""

    def get_agent_name(self) -> str:
        return "synthesis"

    def _get_output_type(self) -> type[SynthesisOutput]:
        return SynthesisOutput

    def _create_agent_instance(
        self, case_id: str, model: str, publish_fn: PublishFn | None,
    ) -> LlmAgent:
        return AgentFactory.create_synthesis_agent(
            case_id, model=model, publish_fn=publish_fn
        )

    async def _prepare_content(
        self, files: list[CaseFile], gcs_bucket: str,
        hypotheses: list[dict[str, object]],
        context_injection: str | None = None, **kwargs: object,
    ) -> types.Content:
        """Build text-only Content from pre-assembled synthesis input."""
        synthesis_input = str(kwargs.get("synthesis_input", ""))
        return types.Content(
            role="user",
            parts=[types.Part(text=synthesis_input)],
        )
```

### Pattern 2: Input Assembly (mirrors assemble_kg_builder_input)

```python
# Source: backend/app/agents/kg_builder.py (lines 113-199)
async def assemble_synthesis_input(case_id: str, db: AsyncSession) -> str:
    """Assemble text-only input for the Synthesis Agent.

    Queries case_findings, kg_entities, kg_relationships, case metadata.
    Returns a single formatted string.
    """
    # 1. Case metadata
    case = await db.execute(select(Case).where(Case.id == UUID(case_id)))
    # 2. Findings grouped by agent_type with [FINDING:uuid] prefixes
    findings = await db.execute(select(CaseFinding).where(...).order_by(...))
    # 3. KG entities with descriptions
    entities = await db.execute(select(KgEntity).where(...))
    # 4. KG relationships with evidence
    relationships = await db.execute(select(KgRelationship).where(...))
    # 5. File metadata
    files = await db.execute(select(CaseFile).where(...))

    # Format sections
    parts = [
        "--- CASE METADATA ---",
        f"Name: {case.name}\nDescription: {case.description}\nType: {case.type}",
        "--- DOMAIN AGENT FINDINGS ---",
        formatted_findings,
        "--- KNOWLEDGE GRAPH ENTITIES ---",
        formatted_entities,
        "--- KNOWLEDGE GRAPH RELATIONSHIPS ---",
        formatted_relationships,
    ]
    return "\n\n".join(parts)
```

### Pattern 3: Pipeline Stage 8 Integration

```python
# Source: backend/app/services/pipeline.py (lines 968-1035 -- KG Builder stage pattern)
# ---- Stage 8: Synthesis Agent ----
logger.info("Pipeline starting stage=synthesis case=%s workflow=%s", case_id, workflow_id)
synthesis_task_id = str(uuid4())
await emit_agent_started(
    case_id=case_id, agent_type="synthesis",
    task_id=synthesis_task_id, file_id="", file_name="synthesis-agent",
)
try:
    synthesis_counts = await run_synthesis(
        case_id=case_id, workflow_id=workflow_id, user_id=user_id,
        db_session=db, publish_event=publish_fn,
    )
    await emit_agent_complete(case_id=case_id, agent_type="synthesis", ...)
except Exception as exc:
    logger.exception("Synthesis failed for case=%s: %s", case_id, exc)
    await db.rollback()
    await emit_agent_error(case_id=case_id, agent_type="synthesis", ...)
await db.commit()
```

### Pattern 4: API Endpoint (mirrors knowledge_graph.py)

```python
# Source: backend/app/api/knowledge_graph.py (lines 66-102)
@router.get("/synthesis", response_model=SynthesisResponse)
async def get_synthesis(
    case_id: UUID, current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SynthesisResponse:
    await _get_user_case(db, case_id, current_user.id)
    result = await db.execute(
        select(CaseSynthesis).where(CaseSynthesis.case_id == case_id)
        .order_by(CaseSynthesis.created_at.desc()).limit(1)
    )
    synthesis = result.scalar_one_or_none()
    if not synthesis:
        raise HTTPException(status_code=404, detail="Synthesis not found")
    return SynthesisResponse.model_validate(synthesis)
```

### Pattern 5: DetailSidebar Content Type (mirrors existing pattern)

```typescript
// Source: frontend/src/types/detail-sidebar.ts (lines 12-46)
// Add to SidebarContentDescriptor union:
export interface VerdictHypothesisContent {
  type: "verdict-hypothesis";
  props: {
    hypothesis: HypothesisResponse;
    caseId: string;
  };
}

// In detail-sidebar.tsx renderContent switch:
case "verdict-hypothesis":
  return <HypothesisDetailPanel hypothesis={descriptor.props.hypothesis} caseId={descriptor.props.caseId} />;
```

### Pattern 6: AgentFactory Method (mirrors create_kg_builder_agent)

```python
# Source: backend/app/agents/factory.py (lines 314-347)
@staticmethod
def create_synthesis_agent(
    case_id: str, *, model: str = MODEL_PRO,
    publish_fn: PublishFn | None = None,
) -> LlmAgent:
    from app.agents.prompts.synthesis import SYNTHESIS_SYSTEM_PROMPT
    from app.schemas.synthesis_output import SynthesisOutput
    callbacks = create_agent_callbacks(case_id, publish_fn) if publish_fn else None
    return _create_llm_agent(
        name=_safe_name("synthesis", case_id),
        model=model,
        instruction=SYNTHESIS_SYSTEM_PROMPT,
        planner=create_thinking_planner("high"),
        output_schema=SynthesisOutput,
        output_key="synthesis_result",
        callbacks=callbacks,
    )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate supporting/contradicting evidence arrays | Flat evidence list with role labels | Phase 8 CONTEXT.md decision | Simpler schema, easier to display |
| Timeline events from manual creation | Synthesis-generated events only | Phase 8 CONTEXT.md decision | No manual event creation UI needed |
| Status badge from CaseStatus enum | Verdict badge from case_synthesis | Phase 8 CONTEXT.md decision | Need to add verdict_label to Case model or fetch from case_synthesis |

**Deprecated/outdated:**
- Mock timeline data in `useTimelineData.ts`: Will be replaced with real API data
- EventDetailModal for timeline: Will be replaced with DetailSidebar pattern (click event -> sidebar, not modal)

## DB Schema Analysis

### Tables That Already Exist (from Phase 7 migration)
| Table | Model | Status | Notes |
|-------|-------|--------|-------|
| case_hypotheses | CaseHypothesis | EXISTS | Has supporting_evidence + contradicting_evidence columns (may need flat list adaptation) |
| case_contradictions | CaseContradiction | EXISTS | Has claim_a, claim_b, source_a, source_b, severity |
| case_gaps | CaseGap | EXISTS | Has what_is_missing, why_needed, suggested_actions, priority |
| case_synthesis | CaseSynthesis | EXISTS | Has case_summary, case_verdict (JSONB), cross_modal_links, cross_domain_conclusions, key_findings_summary, risk_assessment |
| timeline_events | TimelineEvent | EXISTS | Has title, description, event_date, event_type, layer, citations (JSONB) |
| locations | Location | EXISTS | Phase 8.1 (geospatial) -- not needed yet |

### Tables That Need Creation
| Table | Model | Fields | Migration Required |
|-------|-------|--------|-------------------|
| investigation_tasks | InvestigationTask | id, case_id, workflow_id, title, description, task_type (resolve_contradiction/obtain_evidence/verify_hypothesis/etc.), priority, status, source_hypothesis_id, source_contradiction_id, source_gap_id, created_at | YES - new Alembic migration |

### Column Additions Needed
| Table | Column | Type | Purpose | Migration Required |
|-------|--------|------|---------|-------------------|
| cases | verdict_label | String(30) nullable | "Conclusive"/"Substantial"/"Inconclusive" for case list/header badge | YES |
| cases | verdict_summary | Text nullable | One-line summary for case header | YES |

### CaseHypothesis Evidence Storage Decision
The existing model has `supporting_evidence: JSONB` and `contradicting_evidence: JSONB`. CONTEXT.md says flat list with role labels. Options:
1. **Store flat list in `supporting_evidence`, leave `contradicting_evidence` null** -- JSONB has no schema enforcement, so this works. Frontend reads from `supporting_evidence` and treats each item's `role` field.
2. **Add an `evidence` column, deprecate the two existing ones** -- cleaner but requires migration.
3. **Continue using both columns, split by role in the write function** -- matches existing schema intent.

**Recommendation:** Option 3 (use both columns, split by role in write). This preserves the original schema intent, requires no migration, and the frontend can merge them back with role labels from position. The flat-list UX is a frontend concern -- the backend can store by role and the API response serializer can merge them into a flat list with labels.

## SynthesisOutput Schema Design

The Pydantic schema for Gemini's structured output should mirror the Verdict view sections:

```python
class SynthesisHypothesis(BaseModel):
    claim: str
    confidence: float  # 0-100, LLM-assigned
    reasoning: str
    evidence: list[SynthesisEvidence]  # Flat list with role

class SynthesisEvidence(BaseModel):
    finding_id: str  # UUID from [FINDING:uuid]
    role: str  # "supporting" | "contradicting" | "neutral"
    excerpt: str

class SynthesisContradiction(BaseModel):
    claim_a: str
    claim_b: str
    source_a_finding_id: str
    source_a_excerpt: str
    source_b_finding_id: str
    source_b_excerpt: str
    severity: str  # "minor" | "significant" | "critical"
    domain: str

class SynthesisGap(BaseModel):
    description: str
    what_is_missing: str
    why_needed: str
    priority: str  # "low" | "medium" | "high" | "critical"
    suggested_actions: str
    related_entity_ids: list[int]  # KG entity integer IDs from input

class SynthesisTimelineEvent(BaseModel):
    title: str
    description: str
    event_date: str  # ISO 8601
    event_end_date: str | None  # For duration events
    event_type: str  # "transaction", "meeting", "filing", "communication", etc.
    domain: str  # "financial", "legal", "evidence", "strategy"
    source_finding_ids: list[str]
    source_entity_ids: list[int]  # KG entity integer IDs from input

class SynthesisTask(BaseModel):
    title: str
    description: str
    task_type: str  # "resolve_contradiction" | "obtain_evidence" | "verify_hypothesis" | ...
    priority: str
    source_hypothesis_index: int | None  # Index into hypotheses list
    source_contradiction_index: int | None
    source_gap_index: int | None

class SynthesisKeyFinding(BaseModel):
    title: str
    description: str
    importance_rank: int  # 1 = most important
    source_finding_ids: list[str]

class SynthesisVerdict(BaseModel):
    verdict: str  # Free text verdict statement
    evidence_strength: str  # "Conclusive" | "Substantial" | "Inconclusive"
    key_strengths: list[str]
    key_weaknesses: list[str]

class SynthesisOutput(BaseModel):
    case_summary: str
    case_verdict: SynthesisVerdict
    key_findings: list[SynthesisKeyFinding]
    hypotheses: list[SynthesisHypothesis]
    contradictions: list[SynthesisContradiction]
    gaps: list[SynthesisGap]
    timeline_events: list[SynthesisTimelineEvent]
    investigation_tasks: list[SynthesisTask]
    cross_modal_links: list[dict]  # Flexible structure
    cross_domain_conclusions: str  # Integrated narrative prose
    risk_assessment: str
    has_location_data: bool
```

## SSE Event Design

### Existing Events Used by Synthesis
- `agent-started` with `agentType="synthesis"` -- when synthesis begins
- `agent-complete` with result summary -- when synthesis LLM call completes
- `agent-error` -- if synthesis fails
- `thinking-update` -- real-time thinking traces during synthesis

### New Event Needed
- `synthesis-data-ready` -- emitted AFTER all synthesis data is committed to DB. This is the signal for the frontend to enable the Verdict tab and fetch data. Different from `agent-complete` because `agent-complete` fires after the LLM call but before DB write.

Add to `AgentEventType` enum:
```python
SYNTHESIS_DATA_READY = "synthesis-data-ready"
```

### Frontend SSE Handling
The `useAgentStates` hook already handles `agent-started`, `agent-complete`, etc. Add handling for `synthesis-data-ready` to trigger a state change that enables the Verdict tab.

## Frontend Integration Points

### 1. Command Center Page (`command-center/page.tsx`)
- Add `activeTab` state: `"agent-flow" | "verdict"`
- Track synthesis readiness via SSE `synthesis-data-ready` event or `processing-complete`
- Conditionally render `<CommandCenter>` (existing) or `<VerdictView>` (new)

### 2. CommandCenter Component
- Add tab toggle in the CanvasShell header (alongside connection badge)
- Tab design: pills or underline tabs (Claude's discretion per CONTEXT.md)

### 3. VerdictView Component
- Single scrollable page with sections in CONTEXT.md order
- Each section fetches from its respective API endpoint
- Items are clickable -> DetailSidebar

### 4. Timeline Page
- Remove mock data fallback from `useTimelineData.ts`
- Create backend `GET /api/cases/{case_id}/timeline` endpoint
- Add domain + category filter dimensions (CONTEXT.md requirement)
- Update `TimelineEvent` type to include domain-based categorization

### 5. Case Header Integration
- Read verdict from `case_synthesis` or new Case columns
- Replace status badge with verdict badge when synthesis complete
- Show one-line summary next to verdict badge

## Open Questions

1. **Entity ID Resolution in Synthesis Output**
   - KG Builder uses integer IDs (1, 2, 3...) mapped to DB UUIDs during write. Synthesis needs to reference KG entities by their DB UUIDs (since it reads from the DB). The synthesis input should include entity UUIDs, and the output should reference them as strings.
   - **Recommendation:** Include `[ENTITY:uuid:name]` prefixes in the synthesis input text so the LLM can reference them by UUID in output.

2. **Timeline Event `layer` Field Mapping**
   - The frontend TimelineEvent type uses `layer: "evidence" | "legal" | "strategy"`. CONTEXT.md says filter by "domain (financial/legal/evidence/strategy) AND category". The existing DB model has both `layer` and `event_type` columns.
   - **Recommendation:** Map synthesis `domain` to `layer` (adding "financial" to the layer enum). Map synthesis `event_type` to `event_type` column. Update frontend types to support 4 domains.

3. **Verdict Tab Disabled State Detection**
   - How does the frontend know whether synthesis has completed? Options: (a) Check if `case_synthesis` exists via API, (b) SSE event, (c) Case status field.
   - **Recommendation:** Use SSE `synthesis-data-ready` event for real-time activation, and API check on page load for refresh resilience.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/app/agents/kg_builder.py` (agent runner pattern)
- Codebase analysis: `backend/app/services/pipeline.py` (pipeline stage integration)
- Codebase analysis: `backend/app/services/agent_events.py` (SSE event system)
- Codebase analysis: `backend/app/agents/domain_agent_runner.py` (DomainAgentRunner base class)
- Codebase analysis: `backend/app/agents/factory.py` (AgentFactory pattern)
- Codebase analysis: `backend/app/models/synthesis.py` (existing DB models)
- Codebase analysis: `backend/app/api/knowledge_graph.py` (API endpoint pattern)
- Codebase analysis: `frontend/src/types/detail-sidebar.ts` (discriminated union pattern)
- Codebase analysis: `frontend/src/components/CommandCenter/CommandCenter.tsx` (CanvasShell pattern)
- Codebase analysis: `frontend/src/hooks/useTimelineData.ts` (React Query + mock fallback)
- Phase 8 CONTEXT.md (user decisions)

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` (REQ-AGENT-008, REQ-HYPO-*, REQ-TASK-*, REQ-WOW-*, REQ-VIS-004/005/006)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- direct extension of existing KG Builder and pipeline patterns
- Pitfalls: HIGH -- identified from codebase analysis and schema comparison
- DB Schema: HIGH -- existing models read directly from source files
- Frontend patterns: HIGH -- DetailSidebar, CommandCenter, Timeline all examined

**Research date:** 2026-02-08
**Valid until:** Indefinite (patterns are codebase-specific, not library-version dependent)
