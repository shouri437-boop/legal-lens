# Command Center Pipeline: Refactor & Bug Fix Status

**Plan**: `.claude/plans/parsed-weaving-fairy.md`
**Branch**: `ftr/ui-improvements`
**Date**: 2026-02-06
**Commits**: 6 (`70b3fc3..a143cb1`)

---

## Overall Scope Status

| Scope Item | Status | Notes |
|---|---|---|
| Bug fixes (6 bugs) | 5/6 done | Bug 1 (stuck PROCESSING) partially addressed via safety net; root cause (single long-lived session) deferred |
| Pipeline split | Done | `api/agents.py` -> `services/pipeline.py` |
| Session-per-stage | Partially done | Error handler + safety net + case status use fresh sessions; triage/orchestrator/strategy still share one session |
| Timeouts | Config added, enforcement deferred | Settings exist in `config.py` but `asyncio.wait_for` not wired |
| Config-driven domain agents | Done | `DomainAgentConfig` + concrete `DomainAgentRunner` |
| Shared serializer | Partially done | `build_execution_metadata` shared; `build_agent_result` used by snapshot only, not live events |
| Frontend fixes | Done | Authoritative snapshot + processing-complete cleanup |

---

## Phase 1: Config-driven domain agents

**Commit**: `70b3fc3 refactor: config-driven domain agents`
**Status**: Done

### 1a. `DomainAgentConfig` dataclass - DONE

Added to `domain_agent_runner.py` with fields: `agent_name`, `output_type`, `domain_prompt`, `create_agent`.

Deviation from plan: added `AgentFactoryFn` type alias (`Callable[[str, str, PublishFn | None], LlmAgent]`) because the factory methods use keyword-only args (`model=`, `publish_fn=`). The config's `create_agent` field uses lambda wrappers to bridge the positional-to-keyword signature gap (e.g., `lambda case_id, model, publish_fn: AgentFactory.create_financial_agent(case_id, model=model, publish_fn=publish_fn)`).

### 1b. Make `DomainAgentRunner` concrete - DONE

- Removed `ABC` import and all `@abstractmethod` decorators.
- Added `__init__(self, config: DomainAgentConfig | None = None)` — `None` default allows Strategy to subclass without config.
- Hook methods (`get_agent_name`, `_get_output_type`, `_create_agent_instance`, `_prepare_content`) read from `self._config` when present, or raise `NotImplementedError` for subclasses.
- `_prepare_content` for config-driven agents delegates to `_build_standard_content` with the config's `domain_prompt`.

### 1c. Simplify `financial.py`, `legal.py`, `evidence.py` - DONE

Each file reduced from ~111 lines to ~55 lines. Contains:
- A `*_CONFIG` constant (`DomainAgentConfig` instance)
- A `run_*` public function that delegates to `DomainAgentRunner(CONFIG).run(...)`
- Removed wrapper Agent classes (`FinancialAgent`, `LegalAgent`, `EvidenceAgent`)

`strategy.py` also updated: still subclasses `DomainAgentRunner` (overrides `_prepare_content` for domain-summary-aware content), but no longer uses `ABC`/`@abstractmethod`.

---

## Phase 2: Extract pipeline from agents.py

**Commit**: `d4b8e8e refactor: extract pipeline from agents.py to services/pipeline.py`
**Status**: Done

### 2a. Create `services/pipeline.py` - DONE

Moved `_build_execution_metadata()` and `run_analysis_workflow()` with all their imports. Dynamic imports (circular dependency avoidance) kept inside the function body.

### 2b. Update `api/agents.py` - DONE

- Removed pipeline function and helper
- Added `from app.services.pipeline import run_analysis_workflow`
- Kept: `AnalysisStartResponse`, `AnalysisStatusResponse`, `_get_user_case()`, `start_analysis`, `get_analysis_status`
- `background_tasks.add_task(run_analysis_workflow, ...)` call unchanged

Agents.py went from ~1324 lines to ~415 lines. Pipeline.py is ~940 lines.

---

## Phase 3: Session-per-stage + bug fixes + timeouts

**Commit**: `51bcd6a fix: session-scoped error handling, safety net, and bug fixes`
**Status**: Partially done — bug fixes and safety infrastructure landed; full stage decomposition and timeout enforcement deferred

### 3a. Add timeout settings to `config.py` - DONE

All 5 settings added:
```
pipeline_timeout_triage: int = 600
pipeline_timeout_orchestrator: int = 300
pipeline_timeout_domain_agents: int = 900
pipeline_timeout_strategy: int = 300
pipeline_timeout_overall: int = 1800
```

### 3b. Restructure into `_stage_*` functions with `asyncio.wait_for` - DEFERRED

**What landed**: The main function uses `session_factory` and the three fresh-session helpers (`_update_case_status`, `_ensure_case_not_stuck`, `_handle_pipeline_error`). The coordinator structure with `try/except/finally` matches the plan.

**What did NOT land**: The plan called for extracting each pipeline stage into its own `_stage_*` coroutine, each opening its own `async with session_factory() as db:` session, and wrapping each in `asyncio.wait_for(timeout=...)`. This was not done because:

1. Triage, orchestrator, and strategy agents all pass `db` (the session) to their `run_*` functions, which create `AgentExecution` records, flush them, and rely on the same session for subsequent queries (e.g., querying the execution record for metadata right after the agent completes). Splitting each into a separate session scope would require significant refactoring of how execution records are queried post-run.
2. Domain agents already use session-per-task via `db_session_factory` (each parallel agent creates its own session). So the parallel stage already has proper session isolation.
3. The timeout values are stored in config but `asyncio.wait_for` wrapping would require each stage to be a standalone coroutine that can be cancelled.

**Current architecture**: One long-lived session for triage/orchestrator/strategy stages (same as before), but error recovery and case status updates use fresh sessions to prevent the "session corrupted after exception" bug.

**Remaining work for full session-per-stage**:
- Extract `_stage_triage()`, `_stage_orchestrator()`, `_stage_strategy()` as standalone coroutines
- Each opens its own `session_factory()` scope
- Return outputs + execution records to the coordinator
- Wrap each in `asyncio.wait_for` with the config timeouts
- Handle `asyncio.TimeoutError` with proper cleanup per stage

### 3c. `_update_case_status` with fresh session - DONE

Exact implementation as planned. Used for final READY transition.

### 3d. `_ensure_case_not_stuck` safety net - DONE

Exact implementation as planned. Called from `finally` block. Checks if case is still PROCESSING and forces to ERROR.

### 3e. SSE for missing agents (Bug 2 fix) - DONE

After the domain results loop, checks `domain_task_ids` for compound IDs not present in `covered_compound_ids` (built from `domain_results`), emits `agent-error` for each.

### 3f. Fix `BaseException` in `domain_runner.py` (Bug 3) - DONE

Changed `isinstance(item, Exception)` to `isinstance(item, BaseException)` at what was line 258 (now line 262 after earlier edits). This catches `asyncio.CancelledError`, `KeyboardInterrupt`, etc. that `asyncio.gather(return_exceptions=True)` can return.

### 3g. `_handle_pipeline_error` with fresh session - DONE

Exact implementation as planned. Opens a fresh session for ERROR status updates, then emits the `agent-error` SSE event. Called from the `except` block.

---

## Phase 4: Shared AgentResult serializer + snapshot fix

**Commit**: `d55f220 refactor: shared AgentResult serializer + snapshot workflow_id fix`
**Status**: Partially done — snapshot side fully done, live event side not migrated

### 4a. Extract shared `build_agent_result` function - PARTIALLY DONE

Two functions moved to `services/agent_events.py`:
- `build_execution_metadata(execution, model_name)` — single source of truth for token/timing/thinking metadata. Used by both pipeline (live events) and sse.py (snapshot).
- `build_agent_result(execution, metadata_dict)` — constructs frontend-compatible AgentResult dict from an AgentExecution record. Currently used ONLY by `sse.py:build_state_snapshot`.

**What did NOT land**: The plan called for pipeline's live event emission to also use `build_agent_result`. Currently, the pipeline still builds result dicts inline (separate code paths for triage, orchestrator, domain agents, strategy — each with hand-built dicts). This means the live event dicts and the snapshot dicts are built by different code paths, which is a DRY violation. The two are kept in sync by convention, not by shared code.

**Remaining work**: Refactor pipeline's `emit_agent_complete(result={...})` calls to use `build_agent_result` from `agent_events.py`. This requires:
- For triage/orchestrator/strategy: the pipeline would need to query the execution record and pass it to `build_agent_result`, rather than building the dict from the output model directly.
- For domain agents: similar — currently the pipeline builds dicts from the output model, not from the execution record.
- This is a medium-effort refactor that would eliminate the duplicate serialization logic.

### 4b. State snapshot uses `Case.latest_workflow_id` (Bug 6) - DONE

`sse.py:build_state_snapshot` replaced the two-step query (find latest AgentExecution, extract workflow_id) with a direct `select(Case.latest_workflow_id).where(Case.id == case_id)`. This is authoritative because `latest_workflow_id` is set atomically in `start_analysis` before the background task launches.

Also removed `_build_snapshot_last_result` from `sse.py` (replaced by shared `build_agent_result`), and removed `_build_execution_metadata` from `pipeline.py` (replaced by shared `build_execution_metadata`).

---

## Phase 5: Frontend fixes

**Commit**: `c8a4642 fix: authoritative state snapshot + processing-complete cleanup`
**Status**: Done

### 5a. Authoritative state snapshot (Bug 4) - DONE

Changed `const next = new Map(prev)` to `const next = createInitialStates()` in `handleStateSnapshot`. This means agents NOT present in the server snapshot revert to idle, preventing stale "processing" state from persisting after a refresh.

Preserved `processingHistory` and `lastResult` from `prev` state when merging (via `const prevState = prev.get(baseType)`).

### 5b. Processing-complete cleans up stuck agents (Bug 5) - DONE

Added to `handleProcessingComplete`:
1. `activeCompoundAgentsRef.current.clear()` — clears compound agent tracking
2. Iterates all agent states, transitions any with `status === "processing"` to `status: "idle"` with `currentTask: undefined`

---

## Additional Work (not in original plan)

**Commit**: `a143cb1 fix: resolve all mypy type errors across pipeline and domain runner`

Fixed 8 mypy errors that surfaced across modified files:

**`domain_runner.py` (2 pre-existing errors, surfaced by our changes)**:
- `task_summary = {}` needed `dict[str, list[str]]` annotation
- `RUN_FNS` type changed from `dict[str, Callable[..., object]]` to `dict[str, DomainRunFn]` where `DomainRunFn = Callable[..., Awaitable[BaseModel | None]]` — fixes "object is not awaitable" error

**`pipeline.py` (6 errors from variable shadowing)**:
- `result` used for both DB query results and domain agent outputs — renamed DB usage to `file_query`
- `agent_type` used for both `Literal` routing target agents and `str` dict keys from `domain_results.items()` — renamed to `domain_agent` in domain result iteration
- `result` and `group_label` in tuple unpacking — renamed to `domain_output` and `grp_label`
- Applied across all 3 iteration sites (SSE emission, HITL, final counting)

---

## Bug Fix Tracker

| Bug | Description | Status | Fix Location |
|---|---|---|---|
| Bug 1 | Case status stuck as PROCESSING | Mitigated | `_ensure_case_not_stuck` safety net in finally block; root cause (session corruption) partially addressed |
| Bug 2 | Missing agent-error SSE for dropped tasks | Fixed | `pipeline.py`: covered_compound_ids check after domain results loop |
| Bug 3 | `isinstance(item, Exception)` misses BaseException | Fixed | `domain_runner.py:262`: changed to `isinstance(item, BaseException)` |
| Bug 4 | State snapshot merges with stale prev state | Fixed | `useAgentStates.ts`: `createInitialStates()` instead of `new Map(prev)` |
| Bug 5 | Processing-complete doesn't clean up stuck agents | Fixed | `useAgentStates.ts`: iterate agents, transition processing -> idle |
| Bug 6 | Snapshot queries wrong workflow_id | Fixed | `sse.py`: use `Case.latest_workflow_id` instead of latest AgentExecution |

---

## Deferred Work (for future sessions)

### High Priority

1. **Full session-per-stage decomposition**: Extract `_stage_triage()`, `_stage_orchestrator()`, `_stage_strategy()` as standalone coroutines each with their own `session_factory()` scope. This eliminates the remaining shared-session risk where a failure in one stage corrupts the session for subsequent stages.

2. **Timeout enforcement**: Wire `asyncio.wait_for` around each `_stage_*` coroutine using the config values already in `config.py`. Handle `asyncio.TimeoutError` gracefully per stage (emit agent-error, update statuses, continue to safety net).

3. **Pipeline live events use `build_agent_result`**: Refactor the inline result dict construction in `run_analysis_workflow` to use the shared `build_agent_result` from `agent_events.py`. This eliminates the DRY violation where live events and snapshots build the same data through separate code paths.

### Medium Priority

4. **Domain agent run function typing**: The `DomainRunFn = Callable[..., Awaitable[BaseModel | None]]` type alias uses `Callable[...]` which erases the parameter types. A `Protocol` class with the exact signature would provide full type safety for the dispatch table.

---

## Verification Results

All checks pass as of final commit `a143cb1`:

| Check | Command | Result |
|---|---|---|
| mypy (10 files) | `python -m mypy ... --ignore-missing-imports` | `Success: no issues found in 10 source files` |
| ruff lint | `ruff check app/services/pipeline.py app/api/agents.py app/agents/ app/api/sse.py app/services/agent_events.py` | `All checks passed!` |
| Import check | `python -c "from app.services.pipeline import run_analysis_workflow; print('OK')"` | `OK` |
| Frontend typecheck | `npm run typecheck` (tsc --noEmit) | Clean |
| Frontend lint | `npm run lint` (eslint) | Clean |
| Pre-commit hooks | lefthook (eslint + prettier + ruff-check + ruff-format) | All pass |
| Manual test | Not yet performed | Pending |

---

## Commit Log

```
a143cb1 fix: resolve all mypy type errors across pipeline and domain runner
c8a4642 fix: authoritative state snapshot + processing-complete cleanup
d55f220 refactor: shared AgentResult serializer + snapshot workflow_id fix
51bcd6a fix: session-scoped error handling, safety net, and bug fixes
d4b8e8e refactor: extract pipeline from agents.py to services/pipeline.py
70b3fc3 refactor: config-driven domain agents
```

## Files Modified/Created

| File | Planned Action | Actual Status |
|---|---|---|
| `backend/app/services/pipeline.py` | **NEW** — Pipeline orchestrator | Done (~940 lines) |
| `backend/app/api/agents.py` | Remove pipeline function, add import | Done (~415 lines) |
| `backend/app/agents/domain_agent_runner.py` | Add DomainAgentConfig, make concrete | Done |
| `backend/app/agents/financial.py` | Simplify to config + run function | Done (~55 lines) |
| `backend/app/agents/legal.py` | Simplify to config + run function | Done (~55 lines) |
| `backend/app/agents/evidence.py` | Simplify to config + run function | Done (~55 lines) |
| `backend/app/agents/strategy.py` | Keep subclass (not in plan explicitly) | Updated to work with concrete base |
| `backend/app/agents/domain_runner.py` | BaseException fix | Done + DomainRunFn type alias |
| `backend/app/api/sse.py` | Use latest_workflow_id, use shared serializer | Done |
| `backend/app/services/agent_events.py` | Add shared `build_agent_result` | Done (+ `build_execution_metadata`) |
| `backend/app/config.py` | Add pipeline timeout settings | Done (settings added, enforcement deferred) |
| `frontend/src/hooks/useAgentStates.ts` | Authoritative snapshot, processing-complete cleanup | Done |
