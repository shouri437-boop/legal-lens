# Phase 6: Domain Agents - Research

**Researched:** 2026-02-05
**Domain:** Google ADK multi-agent orchestration, Gemini multimodal processing, domain-specific NLP extraction
**Confidence:** HIGH

## Summary

This research covers the implementation of four domain analysis agents (Financial, Legal, Legal Strategy, Evidence) within the existing Legal Lens ADK infrastructure. The codebase already has a well-established pattern: `AgentFactory` creates fresh `LlmAgent` instances with `output_schema` + `BuiltInPlanner` + `create_agent_callbacks`, then `run_triage`/`run_orchestrator` functions execute them via `create_stage_runner` with stage-isolated sessions.

The primary technical challenges are: (1) wiring ADK `ParallelAgent` for concurrent Financial/Legal/Evidence execution, (2) implementing `ResilientAgentWrapper` as a custom `BaseAgent` for Pro-to-Flash fallback, (3) designing Pydantic output schemas per domain with entity taxonomies, (4) configuring `generate_content_config` with `media_resolution` for multimodal processing, and (5) aggregating parallel agent outputs for the downstream Legal Strategy agent and eventually Synthesis.

**Primary recommendation:** Follow the existing `run_triage`/`run_orchestrator` pattern exactly. Each domain agent gets its own `run_{domain}` function, own prompt module, own output schema. The ParallelAgent approach is NOT used at the ADK level (explained below) -- instead, use Python `asyncio.gather` to run domain agents concurrently with independent stage-isolated sessions.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| google-adk | 1.23.0 | Agent framework | Already installed; LlmAgent, BaseAgent, Runner |
| google-genai | 1.61.0 | Gemini API types | Already installed; types.GenerateContentConfig, MediaResolution |
| pydantic | 2.x | Output schemas | Already used for TriageOutput, OrchestratorOutput |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| asyncio (stdlib) | N/A | Parallel execution | `asyncio.gather` for concurrent domain agents |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| asyncio.gather | ADK ParallelAgent | ParallelAgent runs sub-agents within a single Runner/session; our stage-isolated pattern needs separate sessions per agent |
| Custom BaseAgent wrapper | Sequential try/except | BaseAgent gives proper ADK event yielding; raw try/except loses SSE integration |

**Installation:**
No new dependencies required. Everything exists in the current stack.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/agents/
  base.py                  # Existing: callbacks, planner factory, MODEL_* constants
  factory.py               # Extend: add create_financial_agent, create_legal_agent, etc.
  parsing.py               # Existing: shared JSON extraction, token/thinking helpers
  triage.py                # Existing: TriageAgent class + run_triage
  orchestrator.py          # Existing: OrchestratorAgent class + run_orchestrator
  financial.py             # NEW: FinancialAgent class + run_financial
  legal.py                 # NEW: LegalAgent class + run_legal
  evidence.py              # NEW: EvidenceAgent class + run_evidence
  strategy.py              # NEW: StrategyAgent class + run_strategy (Legal Strategy)
  resilient_wrapper.py     # NEW: ResilientAgentWrapper (BaseAgent subclass)
  domain_runner.py         # NEW: Parallel execution orchestrator + aggregation
  prompts/
    triage.py              # Existing
    orchestrator.py        # Existing
    financial.py           # NEW
    legal.py               # NEW
    evidence.py            # NEW
    strategy.py            # NEW

backend/app/schemas/
  agent.py                 # Extend: add domain output schemas

backend/app/api/
  agents.py                # Extend: wire domain agents into pipeline
```

### Pattern 1: Stage-Isolated Domain Agent Execution
**What:** Each domain agent gets a fresh ADK session, independent Runner invocation, and its own execution record in `agent_executions`. This is the SAME pattern used by triage and orchestrator.
**When to use:** Every domain agent execution.
**Why:** Prevents context window bloat from multimodal file content across agents. Each agent processes raw files independently.

```python
# Source: Existing pattern from backend/app/agents/triage.py
async def run_financial(
    case_id: str,
    workflow_id: str,
    user_id: str,
    files: list[CaseFile],
    hypotheses: list[dict],  # Existing hypotheses to evaluate
    db_session: AsyncSession,
    publish_event: PublishFn | None = None,
    parent_execution_id: UUID | None = None,
) -> FinancialOutput | None:
    """Run financial analysis on routed files.

    Creates a FRESH ADK session (stage-isolated).
    Files are sent as multimodal content directly to the agent.
    """
    settings = get_settings()

    # Create execution record
    execution = AgentExecution(
        case_id=UUID(case_id),
        workflow_id=UUID(workflow_id),
        agent_name="financial",
        agent_type="LlmAgent",
        model_name=settings.gemini_pro_model,
        status=AgentExecutionStatus.PENDING,
        input_data={"file_ids": [str(f.id) for f in files]},
        parent_execution_id=parent_execution_id,
    )
    db_session.add(execution)
    await db_session.flush()

    # ... same pattern as run_triage ...
```

### Pattern 2: Parallel Execution via asyncio.gather (NOT ADK ParallelAgent)
**What:** Run Financial, Legal, and Evidence agents concurrently using `asyncio.gather`, each with their own session, runner, and execution record.
**When to use:** After orchestrator routes files to domain agents.
**Why ADK ParallelAgent is NOT suitable here:**

The ADK `ParallelAgent` operates within a single Runner/session context. It runs sub-agents concurrently but shares the same session. Our architecture requires stage-isolated sessions (fresh context per agent, no inherited multimodal content). Using `asyncio.gather` with separate `run_{domain}` calls achieves true parallel execution with session isolation.

```python
# Source: Recommended pattern based on existing pipeline in agents.py
async def run_domain_agents_parallel(
    case_id: str,
    workflow_id: str,
    user_id: str,
    routing: OrchestratorOutput,
    files: list[CaseFile],
    hypotheses: list[dict],
    db_session: AsyncSession,
    publish_event: PublishFn | None = None,
    orchestrator_execution_id: UUID | None = None,
) -> dict[str, BaseModel | None]:
    """Run domain agents in parallel based on orchestrator routing.

    Financial, Legal, and Evidence agents run concurrently.
    Legal Strategy runs AFTER them (separate stage).
    """
    # Build file-to-agent mapping from routing decisions
    agent_files: dict[str, list[CaseFile]] = {
        "financial": [], "legal": [], "evidence": []
    }
    file_lookup = {str(f.id): f for f in files}

    for decision in routing.routing_decisions:
        for agent_name in decision.target_agents:
            if agent_name in agent_files:
                file = file_lookup.get(decision.file_id)
                if file:
                    agent_files[agent_name].append(file)

    # Launch parallel tasks (only for agents that have files)
    tasks = {}
    if agent_files["financial"]:
        tasks["financial"] = run_financial(...)
    if agent_files["legal"]:
        tasks["legal"] = run_legal(...)
    if agent_files["evidence"]:
        tasks["evidence"] = run_evidence(...)

    # Execute concurrently, continue on partial failure
    results = await asyncio.gather(
        *tasks.values(),
        return_exceptions=True,
    )

    # Map results back to agent names
    output: dict[str, BaseModel | None] = {}
    for agent_name, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            logger.error("Domain agent %s failed: %s", agent_name, result)
            output[agent_name] = None
        else:
            output[agent_name] = result

    return output
```

### Pattern 3: ResilientAgentWrapper as Custom BaseAgent
**What:** A `BaseAgent` subclass that wraps a primary (Pro) and fallback (Flash) LlmAgent. On primary failure, it catches the exception and retries with the fallback agent.
**When to use:** Every domain agent invocation.
**Why:** Pro model provides higher quality analysis; Flash provides a degraded-but-functional fallback. Visible in Command Center via SSE events.

```python
# Source: ADK custom agents docs (https://google.github.io/adk-docs/agents/custom-agents/)
from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from collections.abc import AsyncGenerator

class ResilientAgentWrapper(BaseAgent):
    """Wraps a primary agent with a fallback for resilient execution.

    On primary agent failure, catches the exception and runs the
    fallback agent. Emits SSE events to indicate fallback was used.
    """
    primary_agent: LlmAgent
    fallback_agent: LlmAgent

    model_config = {"arbitrary_types_allowed": True}

    def __init__(
        self,
        name: str,
        primary_agent: LlmAgent,
        fallback_agent: LlmAgent,
    ):
        super().__init__(
            name=name,
            primary_agent=primary_agent,
            fallback_agent=fallback_agent,
            sub_agents=[primary_agent, fallback_agent],
        )

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        try:
            async for event in self.primary_agent.run_async(ctx):
                yield event
        except Exception as exc:
            # Log fallback, emit SSE warning
            logger.warning(
                "Primary agent %s failed, falling back: %s",
                self.primary_agent.name, exc,
            )
            # Mark fallback in session state for downstream visibility
            ctx.session.state["_fallback_used"] = True
            ctx.session.state["_fallback_reason"] = str(exc)[:500]

            async for event in self.fallback_agent.run_async(ctx):
                yield event
```

**IMPORTANT NOTE:** The ResilientAgentWrapper approach using BaseAgent within a single Runner session may have complications. Since our pattern uses stage-isolated sessions with separate Runners per agent, a simpler approach is a Python-level try/except in the `run_{domain}` function:

```python
async def run_financial(...) -> FinancialOutput | None:
    """Run financial analysis with Pro -> Flash fallback."""
    fallback_used = False

    # Attempt 1: Pro model
    try:
        result = await _execute_financial_agent(
            model=MODEL_PRO, ...
        )
        if result is not None:
            return result
    except Exception as exc:
        logger.warning("Financial Pro failed: %s", exc)

    # Attempt 2: Flash fallback
    fallback_used = True
    try:
        result = await _execute_financial_agent(
            model=MODEL_FLASH, ...
        )
        # Emit SSE event indicating fallback was used
        if publish_event:
            await emit_agent_fallback(case_id, "financial", "Flash")
        return result
    except Exception as exc:
        logger.error("Financial Flash also failed: %s", exc)
        return None
```

**Recommendation:** Use the Python-level try/except approach (Pattern 3b) rather than the BaseAgent wrapper. It is simpler, fits the existing stage-isolated pattern, and avoids complications with ADK's internal session/runner mechanics. The BaseAgent wrapper is elegant but introduces unnecessary complexity given our architecture.

### Pattern 4: Domain-Specific Output Schemas with Entity Taxonomy
**What:** Each domain agent has its own Pydantic output schema with domain-specific finding categories, entity types, and structured citations.
**When to use:** Defining agent output_schema parameter.

```python
# Source: Extending existing TriageOutput pattern from backend/app/schemas/agent.py
class Citation(BaseModel):
    """Span-level citation for a finding."""
    file_id: str = Field(..., description="ID of the source file")
    locator: str = Field(
        ...,
        description="Exact location: page number, timestamp, or region. "
        "Format: page:3, ts:01:23:45, region:x,y,w,h"
    )
    excerpt: str | None = Field(
        default=None, max_length=500,
        description="Relevant text excerpt from the source"
    )

class Finding(BaseModel):
    """A single domain-specific finding with citations."""
    category: str = Field(..., description="Domain-specific category")
    title: str = Field(..., max_length=200)
    description: str = Field(..., max_length=2000)
    confidence: float = Field(..., ge=0, le=100)
    citations: list[Citation] = Field(default_factory=list)
    entities: list[DomainEntity] = Field(default_factory=list)

class HypothesisEvaluation(BaseModel):
    """Agent's evaluation of an existing hypothesis."""
    hypothesis_id: str = Field(...)
    stance: Literal["supports", "contradicts", "neutral"] = Field(...)
    confidence: float = Field(..., ge=0, le=100)
    reasoning: str = Field(...)
    citations: list[Citation] = Field(default_factory=list)

class FinancialOutput(BaseModel):
    """Complete output from the Financial Analysis Agent."""
    findings: list[Finding] = Field(default_factory=list)
    hypothesis_evaluations: list[HypothesisEvaluation] = Field(default_factory=list)
    no_findings_explanation: str | None = Field(default=None)
    extraction_mode: Literal["dense", "curated"] = Field(default="curated")
```

### Pattern 5: generate_content_config for media_resolution
**What:** Set `media_resolution` via LlmAgent's `generate_content_config` parameter.
**When to use:** Domain agents processing documents and dense scanned content.

```python
# Source: Verified via LlmAgent model_fields inspection (generate_content_config exists)
# and Gemini media_resolution docs (https://ai.google.dev/gemini-api/docs/media-resolution)
from google.genai import types

agent = LlmAgent(
    name="financial_agent",
    model=MODEL_PRO,
    instruction=FINANCIAL_SYSTEM_PROMPT,
    planner=create_thinking_planner("high"),
    output_schema=FinancialOutput,
    output_key="financial_result",
    generate_content_config=types.GenerateContentConfig(
        media_resolution=types.MediaResolution.MEDIA_RESOLUTION_HIGH,
    ),
    **callbacks,
)
```

### Anti-Patterns to Avoid
- **Sharing session across domain agents:** Each agent MUST get a fresh session. Sharing causes context window bloat from multimodal file content.
- **Using ADK ParallelAgent for stage-isolated agents:** ParallelAgent shares a session; we need separate sessions per agent.
- **Combining tools + output_schema on a single agent:** ADK disables tools when output_schema is set. Domain agents use output_schema only (no tools needed for analysis).
- **Passing triage summary to domain agents:** Per CONTEXT.md decision: raw files only. Domain agents analyze independently.
- **Reusing agent instances:** ADK enforces single-parent constraint. Always create fresh instances via AgentFactory.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON extraction from model response | Custom regex parser | `extract_json_from_text` from `parsing.py` | Already handles code fences, bare JSON, missing closing fences |
| Token usage accumulation | Manual counting | `extract_token_usage` from `parsing.py` | Handles all event metadata edge cases |
| Thinking trace extraction | Manual event scanning | `extract_thinking_traces` from `parsing.py` | Capped at 2000 chars, handles missing content |
| SSE event publishing | Direct queue manipulation | `emit_agent_started/complete/error` from `agent_events.py` | Proper event typing, field formatting for frontend |
| Agent execution logging | Custom DB writes | `AgentExecution` model + existing pattern | Parent-child tracking, JSONB output, all fields |
| Stage session creation | Manual session IDs | `get_or_create_stage_session` from `adk_service.py` | Deterministic IDs, idempotent, state seeding |
| File content preparation | Manual GCS download | `build_agent_content` from `adk_service.py` | Handles inline vs File API, size-based routing |
| HITL confirmation | Custom event system | `request_confirmation` from `confirmation.py` | asyncio.Event blocking, SSE emission, timeout handling |
| Agent name sanitization | Manual regex | `_safe_name` from `factory.py` | ADK-compliant Python identifiers from UUIDs |

**Key insight:** The existing codebase has excellent shared utilities. The domain agents are fundamentally the same pattern as triage/orchestrator with different prompts, schemas, and multimodal input handling.

## Common Pitfalls

### Pitfall 1: ADK ParallelAgent vs asyncio.gather Confusion
**What goes wrong:** Using ParallelAgent thinking it gives session isolation, but it shares a single session.
**Why it happens:** ParallelAgent docs focus on concurrent sub-agent execution but don't emphasize session sharing.
**How to avoid:** Use `asyncio.gather` with separate `run_{domain}` calls, each creating their own Runner and session.
**Warning signs:** Agents receiving each other's multimodal content in their context.

### Pitfall 2: output_schema + tools Incompatibility
**What goes wrong:** Adding tools to a domain agent that also has output_schema causes tools to be silently disabled.
**Why it happens:** ADK v1.23 disables tool use when output_schema is set (controlled generation constraint).
**How to avoid:** Domain agents use output_schema for structured output; they do NOT need tools (they analyze file content via prompts). If tools are needed in the future, use a two-agent sequential pattern.
**Warning signs:** ADK logs warning about `output_schema cannot co-exist with agent transfer configurations`.

### Pitfall 3: Database Session Sharing in asyncio.gather
**What goes wrong:** Multiple concurrent agents sharing the same SQLAlchemy AsyncSession causes race conditions.
**Why it happens:** AsyncSession is not thread-safe and not designed for concurrent coroutine access.
**How to avoid:** Each parallel domain agent function must create its own database session from the session factory (same pattern as `run_analysis_workflow` which creates `session_factory()`).
**Warning signs:** `InterfaceError: cannot perform operation: another operation is in progress`, deadlocks.

### Pitfall 4: Multimodal Content Bloat in Strategy Agent
**What goes wrong:** Legal Strategy agent receives raw files AND domain agent outputs, exceeding context window.
**Why it happens:** Strategy agent runs after domain agents and may be given all files.
**How to avoid:** Strategy agent receives only strategy-relevant files (firm playbooks, internal docs) plus TEXT summaries of domain agent findings. Not the raw multimodal content from other agents.
**Warning signs:** Token counts exceeding 1M, slow response times, model errors.

### Pitfall 5: Forgetting "No Findings" Records
**What goes wrong:** An agent finds nothing relevant in a file, returns empty output, and there's no record it even ran.
**Why it happens:** Natural to skip empty results.
**How to avoid:** Per CONTEXT.md decision: always log that the agent ran and found nothing. Include `no_findings_explanation` in schema. Create AgentExecution record even for empty results.
**Warning signs:** Missing execution records, users unsure if analysis is complete.

### Pitfall 6: VideoMetadata with Inline Data
**What goes wrong:** Using `video_metadata` (start_offset/end_offset) with inline video data may cause 500 errors.
**Why it happens:** Known Gemini API issue (2025). VideoMetadata is more reliable with File API (URI references).
**How to avoid:** For video files, always use `prepare_file_via_api` (File API upload) rather than inline data, regardless of file size. The existing `prepare_file_for_agent` routes by size; override for video.
**Warning signs:** HTTP 500 from Gemini API on video processing.

### Pitfall 7: Confidence Threshold for HITL Not Wired
**What goes wrong:** Building domain agents without wiring the low-confidence findings to the confirmation service.
**Why it happens:** Easy to focus on analysis output and forget the HITL integration.
**How to avoid:** After parsing agent output, scan findings for confidence < 40 (configurable threshold) and call `request_confirmation` for each.
**Warning signs:** Low-confidence findings going straight to KG without human review.

## Code Examples

### Example 1: Domain Agent Factory Extension
```python
# Source: Extending existing factory.py pattern
# In backend/app/agents/factory.py

@staticmethod
def create_financial_agent(
    case_id: str,
    *,
    model: str = MODEL_PRO,
    publish_fn: PublishFn | None = None,
) -> LlmAgent:
    """Create a fresh Financial Analysis Agent."""
    callbacks: AgentCallbacks | None = (
        create_agent_callbacks(case_id, publish_fn) if publish_fn else None
    )
    return _create_llm_agent(
        name=_safe_name("financial", case_id),
        model=model,
        instruction=FINANCIAL_SYSTEM_PROMPT,
        planner=create_thinking_planner("high"),
        output_schema=FinancialOutput,
        output_key="financial_result",
        callbacks=callbacks,
        generate_content_config=types.GenerateContentConfig(
            media_resolution=types.MediaResolution.MEDIA_RESOLUTION_HIGH,
        ),
    )
```

Note: The existing `_create_llm_agent` helper must be updated to accept `generate_content_config` as an optional parameter and pass it through to `LlmAgent`.

### Example 2: HITL Integration for Low-Confidence Findings
```python
# Source: Extending existing confirmation.py pattern
CONFIDENCE_THRESHOLD = 40  # Configurable in settings

async def check_findings_for_confirmation(
    findings: list[Finding],
    case_id: str,
    agent_type: str,
) -> list[Finding]:
    """Check findings against confidence threshold and request HITL if needed."""
    confirmed_findings: list[Finding] = []

    for finding in findings:
        if finding.confidence < CONFIDENCE_THRESHOLD:
            result = await request_confirmation(
                case_id=case_id,
                agent_type=agent_type,
                action_description=(
                    f"Low-confidence finding ({finding.confidence}/100): "
                    f"{finding.title}"
                ),
                affected_items=[c.file_id for c in finding.citations],
                context={
                    "finding": finding.model_dump(mode="json"),
                    "confidence": finding.confidence,
                    "category": finding.category,
                },
            )
            if result.approved:
                confirmed_findings.append(finding)
            # Rejected findings kept as audit trail (per CONTEXT.md)
        else:
            confirmed_findings.append(finding)

    return confirmed_findings
```

### Example 3: Multimodal Content for Domain Agent (with media_resolution override)
```python
# Source: Extending existing build_agent_content from adk_service.py
async def build_domain_agent_content(
    files: list[CaseFile],
    gcs_bucket: str,
    prompt: str,
    force_file_api_for_video: bool = True,
) -> types.Content:
    """Build multimodal content for a domain agent.

    Unlike triage which uses size-based routing, domain agents force
    video/audio through the File API for VideoMetadata compatibility.
    """
    parts: list[types.Part] = [types.Part(text=prompt)]

    for f in files:
        parts.append(
            types.Part(text=f"\n\n--- File: {f.original_filename} (ID: {f.id}) ---")
        )
        # Force File API for video/audio regardless of size
        if force_file_api_for_video and f.mime_type.startswith(("video/", "audio/")):
            file_part = await prepare_file_via_api(
                gcs_bucket, f.storage_path, f.mime_type, f.original_filename
            )
        else:
            file_part = await prepare_file_for_agent(f, gcs_bucket)
        parts.append(file_part)

    return types.Content(role="user", parts=parts)
```

### Example 4: Pipeline Extension in agents.py
```python
# Source: Extending existing run_analysis_workflow in agents.py
# After orchestrator completes successfully:

# ---- Stage 3: Domain Agents (Parallel) ----
from app.agents.domain_runner import run_domain_agents_parallel

domain_results = await run_domain_agents_parallel(
    case_id=case_id,
    workflow_id=workflow_id,
    user_id=user_id,
    routing=orchestrator_output,
    files=files,
    hypotheses=[],  # Empty until hypothesis system exists
    db_session_factory=session_factory,  # NOT the db session itself
    publish_event=publish_fn,
    orchestrator_execution_id=orch_execution.id if orch_execution else None,
)

# ---- Stage 4: Legal Strategy (Sequential, after domain agents) ----
strategy_files = [
    file_lookup[d.file_id] for d in orchestrator_output.routing_decisions
    if "strategy" in d.target_agents and d.file_id in file_lookup
]
if strategy_files:
    strategy_result = await run_strategy(
        case_id=case_id,
        workflow_id=workflow_id,
        user_id=user_id,
        files=strategy_files,
        domain_results=domain_results,  # Text summaries from other agents
        hypotheses=[],
        db_session=db,
        publish_event=publish_fn,
    )
    domain_results["strategy"] = strategy_result
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VideoMetadata with inline data | VideoMetadata with File API URIs only | 2025 (Gemini API bug) | Must route video through File API |
| media_resolution global only | Per-part media_resolution (Gemini 3) | Gemini 3 (2025) | Can mix HIGH/LOW in same request |
| thinking_budget (Gemini 2.5) | thinking_level enum (Gemini 3) | Gemini 3 (2025) | Already handled by create_thinking_planner |
| output_schema blocks all tools | ADK v1.11+ partial fix, but still unreliable | Ongoing | Keep output_schema-only agents, no tools |
| ParallelAgent for all concurrency | asyncio.gather for stage-isolated agents | Architecture decision | Better session isolation, simpler debugging |

**Deprecated/outdated:**
- `thinking_budget`: Gemini 2.5 only. Use `thinking_level` via `ThinkingLevel` enum for Gemini 3.
- `THINKING_CONFIG_HIGH` dict in base.py: Legacy, kept for backward compatibility. Use `create_thinking_planner()`.

## Open Questions

Things that could not be fully resolved:

1. **Per-part media_resolution in ADK LlmAgent**
   - What we know: `generate_content_config` is a field on LlmAgent (verified). It accepts `types.GenerateContentConfig` which has `media_resolution`. Per-part resolution is a Gemini 3 feature.
   - What's unclear: Whether ADK passes `generate_content_config.media_resolution` through to the actual API call correctly, or if it gets overridden by the planner/runner. Per-part resolution (on individual `types.Part` objects) may not be supported via ADK's LlmAgent -- it likely only supports the global config-level resolution.
   - Recommendation: Set `media_resolution=MEDIA_RESOLUTION_HIGH` at the `generate_content_config` level (global for the agent). Verify during implementation that it actually takes effect by checking token counts. If not, apply it via `before_model_callback` by modifying the `LlmRequest`.

2. **Speaker diarization reliability**
   - What we know: Gemini can identify speakers in audio/video via prompt engineering. Best-effort; quality varies.
   - What's unclear: How reliable diarization is with Gemini 3 models specifically. Whether structured diarization output (speaker labels + timestamps) is consistent enough for the Evidence agent's structured schema.
   - Recommendation: Request diarization in the prompt as best-effort. Include it in findings but do not rely on it for structured entity extraction. Mark diarization findings with lower confidence.

3. **ResilientAgentWrapper event propagation**
   - What we know: Custom BaseAgent `_run_async_impl` yields events from sub-agents. Fallback agent events would also be yielded.
   - What's unclear: Whether ADK's Runner correctly handles the switch from primary to fallback agent within the same invocation context, especially regarding session state and thinking traces.
   - Recommendation: Use the simpler Python try/except approach in `run_{domain}` (Pattern 3b) rather than BaseAgent wrapper. This avoids any ADK internal state issues and fits the existing pattern perfectly.

4. **asyncio.gather exception handling with database sessions**
   - What we know: `return_exceptions=True` prevents one failure from canceling others.
   - What's unclear: Whether partial database commits from a failed agent corrupt the session factory's connection pool.
   - Recommendation: Each parallel agent creates its own `async with session_factory() as db:` context. Failures are fully contained within their own DB session. The orchestrating function only reads final results.

## Sources

### Primary (HIGH confidence)
- ADK LlmAgent model_fields inspection (local, v1.23.0) -- Verified generate_content_config, output_schema, output_key, planner, all callbacks
- ADK ParallelAgent model_fields inspection (local, v1.23.0) -- Verified sub_agents, before/after callbacks only
- ADK BaseAgent._run_async_impl signature inspection (local) -- `(self, ctx: InvocationContext) -> AsyncGenerator[Event, None]`
- Existing codebase: `base.py`, `factory.py`, `triage.py`, `orchestrator.py`, `agents.py`, `adk_service.py`, `confirmation.py`, `agent_events.py`
- [ADK Parallel Agents docs](https://google.github.io/adk-docs/agents/workflow-agents/parallel-agents/) -- ParallelAgent constructor, execution model, code examples
- [ADK Custom Agents docs](https://google.github.io/adk-docs/agents/custom-agents/) -- BaseAgent subclassing, _run_async_impl, event yielding
- [ADK State docs](https://google.github.io/adk-docs/sessions/state/) -- output_key mechanics, state sharing
- [Gemini Media Resolution docs](https://ai.google.dev/gemini-api/docs/media-resolution) -- Resolution levels, token counts, per-part resolution

### Secondary (MEDIUM confidence)
- [ADK output_schema + tools issue #701](https://github.com/google/adk-python/issues/701) -- Confirmed limitation, workarounds
- [ADK ParallelAgent gathering issue #280](https://github.com/google/adk-python/issues/280) -- output_key aggregation pattern
- [Gemini Video Understanding docs](https://ai.google.dev/gemini-api/docs/video-understanding) -- VideoMetadata usage
- [ADK LLM Agents docs](https://google.github.io/adk-docs/agents/llm-agents/) -- output_key, output_schema, generate_content_config
- [ADK Multi-Agent Systems docs](https://google.github.io/adk-docs/agents/multi-agents/) -- Fan-out/gather pattern

### Tertiary (LOW confidence)
- [VideoMetadata 500 error issue](https://github.com/googleapis/python-genai/issues/854) -- Known bug with inline data + video_metadata
- Speaker diarization capabilities -- Based on community blog posts, not official benchmarks

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed and verified locally
- Architecture: HIGH -- Patterns directly extend existing triage/orchestrator codebase
- ParallelAgent decision: HIGH -- Verified via field inspection that it shares session; asyncio.gather is the right approach
- output_schema + tools limitation: HIGH -- Confirmed in ADK issue tracker and docs
- media_resolution in ADK: MEDIUM -- Config field exists on LlmAgent, but actual passthrough behavior needs runtime verification
- Speaker diarization: LOW -- Community-reported quality, no official benchmarks
- Pitfalls: HIGH -- Most are derived from existing codebase patterns and verified ADK behavior

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (ADK and Gemini API evolving rapidly; re-verify before major changes)
