# Minor Issues

Deferred issues that are non-blocking but should be addressed in future work.

---

## MI-001: Triage/Orchestrator execution lookups use vulnerable re-query pattern

- **Files**: `backend/app/services/pipeline.py` lines ~260-269 (triage), ~342-351 (orchestrator)
- **Pattern**: `WHERE workflow_id = X AND agent_name = 'triage' ORDER BY created_at DESC LIMIT 1`
- **Risk**: Same antipattern that caused the domain agent execution ID misattribution bug. Safe today because triage and orchestrator each run exactly once per workflow. Breaks if retries are ever added.
- **Fix**: Update `run_triage` and `run_orchestrator` to return `tuple[OutputT | None, UUID | None]` (same pattern applied to domain agents in commits `176ce91`..`a5fef73`), then use the returned `execution_id` directly instead of re-querying.
- **Priority**: Low (no current bug, future-proofing only)
- **Added**: 2025-02-07, QC review of Phase 7 execution ID fix

## MI-002: DomainRunFn type alias covariance under strict pyright

- **File**: `backend/app/agents/domain_runner.py` line 24
- **Detail**: `DomainRunFn` is typed as `Callable[..., Awaitable[tuple[DomainAgentOutput | None, UUID | None]]]`. Concrete functions (`run_financial`, `run_legal`, `run_evidence`) return `tuple[FinancialOutput | None, UUID | None]` etc. Works at runtime via structural subtyping but could flag under pyright strict mode due to `Callable` return type covariance rules.
- **Fix**: Either annotate concrete functions to return `tuple[DomainAgentOutput | None, UUID | None]`, or use a generic `TypeVar` on the return type.
- **Priority**: Low (no runtime impact, passes pyright default mode)
- **Added**: 2025-02-07, QC review of Phase 7 execution ID fix

## ~~MI-003: Fuzzy entity matching produces false positives on numeric/temporal values~~ — RESOLVED

- **Status**: RESOLVED by Phase 7.1 (2026-02-08)
- **Resolution**: The programmatic KG Builder with fuzzy dedup (`backend/app/services/kg_builder.py`) was entirely replaced by the LLM-based KG Builder Agent. The LLM uses a clear-and-rebuild strategy and handles deduplication naturally by seeing all findings holistically. No fuzzy string matching exists in the current pipeline.
- **Original file**: `backend/app/services/kg_builder.py` — programmatic service is now dead code (superseded by `backend/app/agents/kg_builder.py`)
- **Added**: 2026-02-07, live pipeline testing
- **Resolved**: 2026-02-08, Phase 7.1 LLM KG Builder

## MI-004: Pipeline summary log mixes two different entity count semantics

- **File**: `backend/app/services/pipeline.py` line ~1089
- **Log**: `entities=40 kg_entities=61` — confusing because both sound like entity counts but measure different things.
- **Detail**: `entities` = triage file-level entities (line 1048: `sum(len(fr.entities) for fr in triage_output.file_results)`) + domain agent top-level `output.entities` (line 1043). `kg_entities` = KG Builder total (includes both top-level AND per-finding entities). The KG count is always >= domain entity count because KG Builder also extracts from `finding.entities` lists. The naming makes them appear comparable when they are not.
- **Fix**: Rename `entities` to `triage_entities` and `total_domain_entities` to `domain_output_entities` in the log, or remove the triage entity count from this summary (it's already logged in the triage stage). The `processing-complete` SSE event (line 1065) also sums these two, which is sent to the frontend — verify frontend doesn't display this misleadingly.
- **Priority**: Low (cosmetic log clarity, no data impact)
- **Phase**: Fix opportunistically during Phase 8 pipeline extension
- **Added**: 2026-02-07, live pipeline testing
