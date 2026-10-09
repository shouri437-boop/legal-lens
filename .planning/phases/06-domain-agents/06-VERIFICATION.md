---
phase: 06-domain-agents
verified: 2026-02-06T01:30:00Z
status: passed
score: 10/10 must-haves verified
must_haves:
  truths:
    - "All four domain agents (Financial, Legal, Evidence, Strategy) can process files"
    - "Domain agents run in parallel via asyncio.gather"
    - "Thinking traces captured for all agents (include_thoughts=True)"
    - "Video/audio forced through File API for reliable processing"
    - "Graceful degradation works: Pro-to-Flash inline fallback"
    - "Structured findings with span-level citations output via Pydantic schemas"
    - "Hypothesis evaluations included in all domain agent output schemas and prompts"
    - "Domain-specific entity taxonomy extracted per agent"
    - "Outputs aggregated for next phase via build_strategy_context and domain_results dict"
    - "HITL confirmation flow wired E2E: low-confidence findings trigger request_confirmation -> SSE -> modal -> REST resolve -> pipeline continues"
  artifacts:
    - path: "backend/app/agents/financial.py"
      provides: "Financial domain agent with run_financial, parse, content prep, Pro-to-Flash fallback"
    - path: "backend/app/agents/legal.py"
      provides: "Legal domain agent with run_legal, parse, content prep, Pro-to-Flash fallback"
    - path: "backend/app/agents/evidence.py"
      provides: "Evidence domain agent with run_evidence, parse, content prep, Pro-to-Flash fallback"
    - path: "backend/app/agents/strategy.py"
      provides: "Strategy domain agent with run_strategy, dual-input (files + summaries), Pro-to-Flash fallback"
    - path: "backend/app/agents/domain_runner.py"
      provides: "compute_agent_tasks, run_domain_agents_parallel, build_strategy_context"
    - path: "backend/app/schemas/agent.py"
      provides: "Citation, DomainEntity, Finding, HypothesisEvaluation, FinancialOutput, LegalOutput, EvidenceOutput, StrategyOutput, EvidenceQualityAssessment"
    - path: "backend/app/agents/factory.py"
      provides: "create_financial_agent, create_legal_agent, create_evidence_agent, create_strategy_agent with media_resolution config"
    - path: "backend/app/agents/prompts/financial.py"
      provides: "FINANCIAL_SYSTEM_PROMPT with entity taxonomy and hypothesis evaluation"
    - path: "backend/app/agents/prompts/legal.py"
      provides: "LEGAL_SYSTEM_PROMPT with entity taxonomy and hypothesis evaluation"
    - path: "backend/app/agents/prompts/evidence.py"
      provides: "EVIDENCE_SYSTEM_PROMPT with entity taxonomy, quality assessment, and hypothesis evaluation"
    - path: "backend/app/agents/prompts/strategy.py"
      provides: "STRATEGY_SYSTEM_PROMPT with entity taxonomy, dual-input, and hypothesis evaluation"
    - path: "backend/app/api/agents.py"
      provides: "Pipeline wiring: Triage -> Orchestrator -> Domain Agents -> Strategy -> HITL -> Complete"
    - path: "backend/app/services/agent_events.py"
      provides: "emit_agent_fallback helper for fallback warning SSE events"
  key_links:
    - from: "agents.py pipeline"
      to: "domain_runner.py"
      via: "compute_agent_tasks + run_domain_agents_parallel import and call"
    - from: "agents.py pipeline"
      to: "strategy.py"
      via: "run_strategy import and call with build_strategy_context output"
    - from: "agents.py pipeline"
      to: "confirmation.py"
      via: "request_confirmation for low-confidence findings (CONFIDENCE_THRESHOLD check)"
    - from: "domain agents"
      to: "factory.py"
      via: "AgentFactory.create_X_agent methods with model param"
    - from: "factory.py"
      to: "prompts/*.py"
      via: "lazy imports of SYSTEM_PROMPT constants"
    - from: "confirmation.py"
      to: "agent_events.py"
      via: "emit_confirmation_required + emit_confirmation_resolved"
    - from: "frontend ConfirmationModal"
      to: "backend confirmations API"
      via: "REST resolve endpoint"
gaps: []
---

# Phase 6: Domain Agents Verification Report

**Phase Goal:** Implement all four domain analysis agents with proper thinking configuration.
**Verified:** 2026-02-06T01:30:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | All four domain agents process files | VERIFIED | `financial.py` (410 lines), `legal.py` (410 lines), `evidence.py` (410 lines), `strategy.py` (459 lines) each have full `run_X` functions with ADK session creation, content preparation, event collection, output parsing, and execution record logging |
| 2  | Parallel execution via asyncio.gather | VERIFIED | `domain_runner.py:226-227`: `coros = [_run_agent_with_session(t) for t in tasks]` followed by `results = await asyncio.gather(*coros, return_exceptions=True)`. Strategy agent runs sequentially after (line 568 in agents.py) |
| 3  | Thinking traces captured for all agents | VERIFIED | All factory methods use `create_thinking_planner("high")` which sets `include_thoughts=True` in ThinkingConfig. All domain agent modules call `extract_thinking_traces(attempt_events)` and store them on execution records |
| 4  | Video/audio processed with File API routing | VERIFIED | `adk_service.py:build_domain_agent_content` lines 331-336: `if f.mime_type.startswith(("video/", "audio/")): file_part = await prepare_file_via_api(...)` forces File API for video/audio regardless of size |
| 5  | Graceful degradation (Pro-to-Flash fallback) | VERIFIED | All four domain agents implement inline Pro-to-Flash fallback: try Pro with MAX_PARSE_RETRIES, then Flash with MAX_PARSE_RETRIES. Fallback metadata stored in `_metadata.fallback_used` and `_metadata.fallback_model` in output_data. SSE fallback warning emitted |
| 6  | Structured findings with citations output | VERIFIED | `Finding` schema (agent.py:318-348) has `citations: list[Citation]` with span-level locators (page, timestamp, region). All four domain output models (`FinancialOutput`, `LegalOutput`, `EvidenceOutput`, `StrategyOutput`) have `findings: list[Finding]` |
| 7  | Hypothesis evaluations in agent output | VERIFIED | `HypothesisEvaluation` schema (agent.py:351-377) with stance (supports/contradicts/neutral), confidence, reasoning, citations. All four output models include `hypothesis_evaluations: list[HypothesisEvaluation]`. All four prompts have Section 6: Hypothesis Evaluation with instructions and JSON examples |
| 8  | Domain-specific entity taxonomy extracted | VERIFIED | Financial: monetary_amount, account, transaction, asset, financial_instrument, tax_record. Legal: statute, case_citation, contract, legal_term, court, obligation, party, clause. Evidence: communication, alias, vehicle, property, timestamp, physical_evidence, digital_artifact, witness. Strategy: strategic_decision, organizational_unit, stakeholder, objective, risk_factor. All defined in both schema docstrings and prompt tables |
| 9  | Outputs aggregated for next phase | VERIFIED | `domain_runner.py:build_strategy_context` aggregates findings into text summaries for Strategy agent. Pipeline collects `domain_results: dict[str, list[tuple[BaseModel, str]]]` and passes to Strategy. `domain_results_summary` field added to `AnalysisStatusResponse` for status endpoint |
| 10 | HITL confirmation flow verified E2E | VERIFIED | Pipeline (agents.py:626-706) iterates domain and strategy results, checks `finding.confidence < CONFIDENCE_THRESHOLD`, calls `request_confirmation()` which emits `confirmation-required` SSE, blocks via `asyncio.Event.wait()`, user responds via REST `/api/cases/{id}/confirmations/{request_id}` (confirmations.py:66), `resolve_confirmation` unblocks pipeline, emits `confirmation-resolved` SSE. Frontend `ConfirmationModal.tsx` (287 lines) imported and rendered in command-center page.tsx |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/agents/financial.py` | Financial agent module | VERIFIED | 410 lines, FinancialAgent class, parse_financial_output, _prepare_financial_content, run_financial with Pro-to-Flash fallback |
| `backend/app/agents/legal.py` | Legal agent module | VERIFIED | 410 lines, LegalAgent class, parse_legal_output, _prepare_legal_content, run_legal with Pro-to-Flash fallback |
| `backend/app/agents/evidence.py` | Evidence agent module | VERIFIED | 410 lines, EvidenceAgent class, parse_evidence_output, _prepare_evidence_content, run_evidence with Pro-to-Flash fallback |
| `backend/app/agents/strategy.py` | Strategy agent module | VERIFIED | 459 lines, StrategyAgent class with dual-input (files + domain summaries), run_strategy with early-return for no-input edge case |
| `backend/app/agents/domain_runner.py` | Parallel execution orchestrator | VERIFIED | 341 lines, AgentTask dataclass, compute_agent_tasks (single source of truth), run_domain_agents_parallel (asyncio.gather), build_strategy_context |
| `backend/app/schemas/agent.py` | Domain output schemas | VERIFIED | 652 lines total. Shared types: Citation, DomainEntity, Finding, HypothesisEvaluation. Domain outputs: FinancialOutput, LegalOutput, EvidenceOutput (with EvidenceQualityAssessment), StrategyOutput. context_injection on RoutingDecision |
| `backend/app/agents/factory.py` | Domain agent factory methods | VERIFIED | 313 lines. create_financial_agent, create_legal_agent, create_evidence_agent, create_strategy_agent. All use create_thinking_planner("high"), model parameter for fallback, and generate_content_config with media_resolution |
| `backend/app/agents/prompts/financial.py` | Financial system prompt | VERIFIED | 191 lines, entity taxonomy table, finding categories, confidence scoring, hypothesis evaluation section, citation format, extraction mode toggle, JSON output example |
| `backend/app/agents/prompts/legal.py` | Legal system prompt | VERIFIED | 200 lines, entity taxonomy (statute, case_citation, contract, legal_term, court, obligation, party, clause), hypothesis evaluation, JSON example |
| `backend/app/agents/prompts/evidence.py` | Evidence system prompt | VERIFIED | 235 lines, authenticity analysis, chain of custody, corroboration, digital forensics, quality_assessment output, entity taxonomy (communication, alias, vehicle, property, timestamp), hypothesis evaluation |
| `backend/app/agents/prompts/strategy.py` | Strategy system prompt | VERIFIED | 222 lines, dual-input documentation, entity taxonomy (strategic_decision, organizational_unit, stakeholder, objective, risk_factor), hypothesis evaluation, inter-agent communication deferred note |
| `backend/app/agents/prompts/__init__.py` | Package re-exports | VERIFIED | 19 lines, exports all 6 system prompts (EVIDENCE, FINANCIAL, LEGAL, ORCHESTRATOR, STRATEGY, TRIAGE) |
| `backend/app/api/agents.py` | Pipeline wiring | VERIFIED | 1069 lines. Full pipeline: Triage -> Orchestrator -> Domain Agents (file-group parallel) -> Strategy (sequential) -> HITL (confidence check) -> File status update -> processing-complete SSE. Status endpoint with domain_results_summary |
| `backend/app/services/agent_events.py` | emit_agent_fallback | VERIFIED | 394 lines. emit_agent_fallback function (lines 291-325) emits thinking-update event with isFallback flag and fallbackModel for Command Center warning badge |
| `backend/app/agents/base.py` | CONFIDENCE_THRESHOLD | VERIFIED | Line 45: `CONFIDENCE_THRESHOLD: int = 40` |
| `backend/app/services/adk_service.py` | build_domain_agent_content | VERIFIED | Lines 303-339. Forces video/audio through File API. Prepends prompt with file parts |
| `backend/app/services/confirmation.py` | HITL confirmation service | VERIFIED | 312 lines. request_confirmation (asyncio.Event block), resolve_confirmation (REST-triggered unblock), get_pending_confirmations, cleanup_stale_confirmations. Timeout-based auto-rejection |
| `backend/app/api/confirmations.py` | Confirmation REST endpoints | VERIFIED | 121 lines. POST /api/cases/{id}/confirmations/{request_id} for resolve, GET /api/cases/{id}/confirmations/pending for listing |
| `frontend/.../ConfirmationModal.tsx` | Frontend HITL modal | VERIFIED | 287 lines. Imported and rendered in command-center page.tsx |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| agents.py pipeline (line 183) | domain_runner.py | `from app.agents.domain_runner import compute_agent_tasks, run_domain_agents_parallel, build_strategy_context` | WIRED | compute_agent_tasks called at line 427, run_domain_agents_parallel at line 446, build_strategy_context at line 542 |
| agents.py pipeline (line 187) | strategy.py | `from app.agents.strategy import run_strategy` | WIRED | run_strategy called at line 568 with domain_summaries, strategy_files, and context_injection |
| agents.py pipeline (line 190) | confirmation.py | `from app.services.confirmation import request_confirmation` | WIRED | request_confirmation called at lines 641 and 684 inside HITL iteration loops |
| agents.py pipeline (line 180) | base.py | `from app.agents.base import CONFIDENCE_THRESHOLD` | WIRED | CONFIDENCE_THRESHOLD used at lines 632 and 677 for finding confidence check |
| domain agents | factory.py | AgentFactory.create_X_agent | WIRED | FinancialAgent (financial.py:51), LegalAgent (legal.py:51), EvidenceAgent (evidence.py:51), StrategyAgent (strategy.py:55) all call their factory methods |
| factory.py | prompts/*.py | Lazy imports (lines 182, 219, 256, 297) | WIRED | FINANCIAL_SYSTEM_PROMPT, LEGAL_SYSTEM_PROMPT, EVIDENCE_SYSTEM_PROMPT, STRATEGY_SYSTEM_PROMPT imported inside factory methods |
| domain agents | adk_service.py | build_domain_agent_content | WIRED | All four content preparation functions call build_domain_agent_content for multimodal content |
| confirmation.py | agent_events.py | emit_confirmation_required (line 133), emit_confirmation_resolved (line 232) | WIRED | SSE events emitted for both request and resolution |
| confirmations router | main.py | `app.include_router(confirmations.router)` | WIRED | Registered at main.py line 168 |
| ConfirmationModal | command-center page.tsx | Import (line 6) + render (line 90) | WIRED | Modal component imported and rendered in the command center page |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| REQ-AGENT-003 (Financial Agent) | SATISFIED | Full implementation with findings, entities, transactions, anomalies, citations |
| REQ-AGENT-004 (Legal Agent) | SATISFIED | Full implementation with obligations, risks, precedents, violations, citations |
| REQ-AGENT-005 (Strategy Agent) | SATISFIED | Full implementation as Legal Strategy agent, dual-input, runs after domain agents |
| REQ-AGENT-006 (Evidence Agent) | SATISFIED | Full implementation with authenticity, custody, corroboration, quality_assessment, media_resolution="high" |
| REQ-AGENT-007b (Thinking Config) | SATISFIED | All agents use create_thinking_planner("high") with include_thoughts=True via BuiltInPlanner |
| REQ-AGENT-007c (Media Resolution) | SATISFIED | Financial/Legal/Evidence: MEDIA_RESOLUTION_HIGH. Strategy: MEDIA_RESOLUTION_MEDIUM. Configured via generate_content_config in factory methods |
| REQ-AGENT-007d (Video/Audio) | SATISFIED | build_domain_agent_content forces video/audio through File API. Prompts include timestamp citation format "ts:HH:MM:SS" and speaker diarization guidance |
| REQ-AGENT-007h (Resilient Wrapper) | SATISFIED | Implemented as inline Pro-to-Flash fallback pattern (functionally equivalent to separate wrapper class, less indirection). Fallback metadata tracked in output_data |
| REQ-AGENT-002 (Orchestrator - complete) | SATISFIED | Orchestrator routing fully consumed by pipeline; domain agents execute based on routing decisions and file groups |
| REQ-HYPO-002 (Hypothesis evaluation) | SATISFIED | All four domain agent schemas include hypothesis_evaluations field. All four prompts include Section 6: Hypothesis Evaluation with stance/confidence/reasoning. Hypotheses passed to agents via content preparation |
| REQ-HYPO-003 (Hypothesis in output) | SATISFIED | HypothesisEvaluation Pydantic model with stance (supports/contradicts/neutral), confidence, reasoning, citations. Included in all domain output schemas |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| backend/app/agents/orchestrator.py | 195 | "Placeholder for domain agent invocation. Implemented in Phase 6." | Info | Pre-existing Phase 4 comment. Domain agent invocation is correctly implemented in agents.py pipeline, not inside orchestrator.py. Comment is stale but harmless |

### Human Verification Required

### 1. End-to-End Pipeline Execution

**Test:** Upload files to a case, start analysis, observe all four domain agents producing findings
**Expected:** Triage -> Orchestrator -> Financial/Legal/Evidence (parallel) -> Strategy (sequential) -> HITL (if low confidence) -> Complete
**Why human:** Requires live Gemini API calls, real file processing, and SSE streaming verification

### 2. HITL Confirmation Flow

**Test:** Upload files that produce low-confidence findings (confidence < 40), observe confirmation modal appearing, approve/reject, observe pipeline continuation
**Expected:** Modal appears in Command Center with finding details, user can approve/reject, pipeline continues after response
**Why human:** Requires live pipeline execution producing low-confidence findings AND human interaction with the modal

### 3. Pro-to-Flash Fallback

**Test:** Trigger a scenario where Pro model fails (e.g., rate limit), observe fallback to Flash with warning badge in Command Center
**Expected:** Agent completes with Flash model, fallback warning appears as thinking-update SSE event
**Why human:** Requires intentional Pro model failure, which is difficult to trigger deterministically

### 4. Domain Agent SSE Events in Command Center

**Test:** Start analysis and watch Command Center visualization during domain agent execution
**Expected:** Multiple agent nodes appear for file-group-based instances (compound identifiers like "financial_grp_0"), thinking traces stream in real-time, completion events show finding/entity counts
**Why human:** Visual verification of real-time SSE rendering in the Command Center UI

### Gaps Summary

No gaps found. All 10 observable truths verified against the actual codebase. All required artifacts exist, are substantive (no stubs), and are properly wired into the pipeline. The implementation follows the architecture specified in CONTEXT.md:

- **File-group-based spawning** with compute_agent_tasks as single source of truth
- **Context injection** per routing decision prepended to agent prompts
- **Strategy runs sequentially** after parallel domain agents, consuming text summaries
- **Inline Pro-to-Flash fallback** instead of separate ResilientAgentWrapper class
- **HITL confirmation** for low-confidence findings using asyncio.Event pause/resume
- **Domain-specific entity taxonomies** defined in both Pydantic schema docstrings and prompt tables
- **Hypothesis evaluation** in all agent schemas and prompts

Four items flagged for human verification as they require live API calls and visual confirmation.

---

## Post-Verification Addendum (21 additional commits)

After the initial 10/10 verification, significant post-plan work was done: refactoring, new capabilities, production hardening, and live-testing bugfixes (21 commits, c21343e → bce0258).

### Architecture Changes

| Change | Commits | Impact |
|--------|---------|--------|
| **DomainAgentRunner Template Method** | 5ed4d52, 4520f69, 9daa3e9 | Extracted base class; all 4 domain agents are now thin subclasses. Eliminated ~800 lines of duplication. Subclasses override `agent_type`, `output_type`, `_create_agent`. Content prep via `_build_standard_content()`. |
| **extract_structured_json generic parser** | e75146e, 918d301 | Single parser replaces 4 per-agent `parse_X_output` functions. Filters `part.thought=True` via `extract_response_texts()` to prevent thinking-text from being parsed as JSON. Triage parser consolidated (DRY). |
| **format_thinking_traces normalization** | bce0258 | Gemini multimodal thinking produces JSON-structured deliberation. New `format_thinking_traces()` recursively extracts readable text from JSON blobs. Shared by both `agents.py` and `sse.py` (replaces duplicated inline joining). |
| **Settings config consolidation** | c21343e | Magic numbers (retry counts, token caps) moved to Settings dataclass. |

### New Capabilities

| Capability | Commits | Details |
|------------|---------|---------|
| **Per-agent routing HITL** | 37dca4b, 82e30cf, e2b55b0, a66198d | Routing confidence scoring with per-agent-type thresholds (financial=50, legal=50, evidence=40, strategy=60). User can reject routing to individual agents while keeping others. |
| **Batch confirmation modal** | 84282f1, c591422, ebe27b2, 3c173f0 | Frontend batch confirmation infrastructure. Per-agent HITL confirmations batched via asyncio.gather. Atomic batch confirmation for parallel requests. |
| **Strategy standalone execution** | 1375b04, eb66971 | Strategy agent can run standalone (summary-only, no files). Distinguishes deliberate strategy-only routing from domain failure. |
| **Strategy gating** | 1971c7c | Strategy only runs when explicitly requested by orchestrator (in parallel_agents, sequential_agents, or routing_decisions). Prevents unconditional strategy execution. |
| **Compound SSE identifiers** | 77c649e | Frontend support for compound agent types (e.g., "financial_grp_0", "evidence_ungrouped_0"). Resolves to base AgentType for node matching. |

### Production Hardening

| Fix | Commits | Details |
|-----|---------|---------|
| **Orchestrator execution commit timing** | fc107f7, d223150 | Orchestrator execution committed to DB before domain agent launch to avoid FK constraint issues. |
| **Domain runner exception handling** | ee3cb03 | Exceptions caught in domain agent runner so SSE error events are emitted for failed agents. |
| **State snapshot refresh resilience** | cd0212a, 5b98aaa, 299b3d4 | lastResult included in state snapshots; handleAgentComplete and handleStateSnapshot merge lastResult to preserve accumulated traces and data across page refreshes. |
| **DomainEntity.metadata schema** | 0f9ea6d, c305cd7 | Changed from dict[str, str] to list[MetadataEntry] for Gemini structured output compliance. MetadataEntry has key+value string fields. |
| **Thinking traces UI** | 603875a | Dedicated thinking traces section in AgentDetailsPanel (frontend). |

### Pipeline Bugfixes (Live Testing)

| Bug | Commit | Root Cause → Fix |
|-----|--------|------------------|
| **Legal agent not dispatched** | b4d8160 | `compute_agent_tasks` used `grouped_file_ids: set[str]` which skipped all grouped files in ungrouped loop. Changed to `covered_pairs: set[tuple[str, str]]` tracking (file_id, agent_type) coverage, so per-file routing to additional agents (e.g., legal for case-report.pdf) is no longer silently dropped. |
| **Strategy runs unconditionally** | 1971c7c | Strategy ran whenever any domain agent succeeded, ignoring orchestrator routing. Added `strategy_requested` gate checking routing_decisions, parallel_agents, and sequential_agents. |
| **Triage parse warnings** | 918d301 | `extract_structured_json` iterated all event parts including thinking parts. Added `extract_response_texts()` which filters `part.thought=True`. Also consolidated triage's duplicate parser. |
| **Routing decisions show first agent only** | fa594ef | `agents.py` and `sse.py` both used `rd.target_agents[0]` which dropped additional agents. Flattened to double loop: one card per (file, agent) pair with domain-specific scores. |
| **JSON thinking traces unreadable** | bce0258 | Gemini multimodal thinking produces JSON blobs instead of natural language. Added `format_thinking_traces()` with `_normalize_thought_text()` and `_flatten_json_to_text()` for recursive JSON→text conversion. |

### Updated Artifact List (post-plan additions)

| Artifact | Provides |
|----------|----------|
| `backend/app/agents/domain_agent_runner.py` | DomainAgentRunner Template Method base class with run(), _attempt_model_loop(), _build_standard_content() |
| `backend/app/agents/parsing.py` | extract_response_texts, extract_structured_json (refactored), format_thinking_traces, _normalize_thought_text, _flatten_json_to_text |
| `backend/app/schemas/agent.py` | MetadataEntry model; DomainEntity.metadata changed to list[MetadataEntry] |

### Updated Key Decisions (post-plan)

| Decision | Chosen | Rationale |
|----------|--------|-----------|
| Domain agent architecture | DomainAgentRunner Template Method | Eliminates duplication; subclasses are ~30 lines each |
| Routing HITL granularity | Per-agent-type rejection | User control over individual agent routing |
| Strategy dispatch | Gated on orchestrator decision | Prevents wasted tokens when orchestrator doesn't request strategy |
| compute_agent_tasks dedup | covered_pairs set[tuple] | Allows per-file routing to agents not covered by file groups |
| Thinking trace display | JSON normalization | Gemini multimodal thinking often produces JSON; normalize for readability |

---

_Verified: 2026-02-06T01:30:00Z (initial)_
_Post-verification addendum: 2026-02-06 (21 additional commits)_
_Verifier: Claude (gsd-verifier)_
