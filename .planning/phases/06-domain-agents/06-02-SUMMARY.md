---
phase: 06-domain-agents
plan: 02
subsystem: agents
tags: [prompts, gemini, domain-agents, financial, legal, evidence, strategy]

# Dependency graph
requires:
  - phase: 06-domain-agents-plan-01
    provides: Domain output schemas (FinancialOutput, LegalOutput, EvidenceOutput, StrategyOutput), shared types (Citation, DomainEntity, Finding, HypothesisEvaluation)
  - phase: 04-core-agent-system
    provides: Triage and orchestrator prompt patterns (ABOUTME headers, single constant, triple-quoted)
provides:
  - FINANCIAL_SYSTEM_PROMPT constant guiding financial transaction and anomaly analysis
  - LEGAL_SYSTEM_PROMPT constant guiding contract, compliance, and risk analysis
  - EVIDENCE_SYSTEM_PROMPT constant guiding forensic authenticity and custody analysis
  - STRATEGY_SYSTEM_PROMPT constant guiding legal strategy with domain agent summaries input
  - Updated prompts/__init__.py re-exporting all 6 system prompts
affects: [06-03 (domain runner pipeline consumes prompts via factory), 06-04 (HITL references confidence thresholds in prompts), 06-05 (end-to-end verification)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Domain prompt pattern: role, context injection note, responsibilities table, entity taxonomy, finding categories, confidence scoring, hypothesis evaluation, extraction mode, output JSON example"
    - "Strategy agent dual-input pattern: own routed files + text summaries from other domain agents"

key-files:
  created:
    - backend/app/agents/prompts/financial.py
    - backend/app/agents/prompts/legal.py
    - backend/app/agents/prompts/evidence.py
    - backend/app/agents/prompts/strategy.py
  modified:
    - backend/app/agents/prompts/__init__.py

key-decisions:
  - "All prompts follow identical structure: role, context injection note, responsibilities, entity taxonomy, findings, confidence, citations, hypothesis evaluation, extraction mode, no-findings handling, constraints, JSON output"
  - "Strategy prompt explicitly documents dual-input (own files + domain agent summaries) and domain_agent_summaries_received field"
  - "Evidence prompt mandates quality_assessment output with ADMIT/VERIFY/CHALLENGE/EXCLUDE recommendation"
  - "All prompts include speaker diarization guidance for audio/video as best-effort"

patterns-established:
  - "Domain prompt structure: 12 sections (role, context injection, analysis areas, entity taxonomy, finding categories, confidence scoring, citations, hypothesis evaluation, extraction mode, no-findings, constraints, output format)"
  - "Each prompt includes a complete JSON output example with realistic domain-specific data"

# Metrics
duration: 4min
completed: 2026-02-06
---

# Phase 6 Plan 02: Domain Agent System Prompts Summary

**4 domain agent system prompts (Financial/Legal/Evidence/Strategy) with entity taxonomies, finding categories, hypothesis evaluation, confidence scoring, context injection awareness, and structured JSON output examples**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-05T23:43:46Z
- **Completed:** 2026-02-05T23:47:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created Financial prompt (8,238 chars): transaction analysis, account mapping, anomaly detection, cash flow patterns, valuation assessment
- Created Legal prompt (9,154 chars): contract obligations, regulatory compliance, legal risks, precedent analysis, violation detection with jurisdiction awareness
- Created Evidence prompt (11,251 chars): authenticity analysis, chain of custody, corroboration, digital forensics, quality_assessment with ADMIT/VERIFY/CHALLENGE/EXCLUDE recommendation
- Created Strategy prompt (10,466 chars): case strengths/weaknesses, investigation priorities, strategic recommendations, risk assessment with domain agent summaries as text input
- Updated prompts/__init__.py to re-export all 6 system prompt constants

## Task Commits

Each task was committed atomically:

1. **Task 1: Financial and Legal agent prompts** - `78961a8` (feat)
2. **Task 2: Evidence and Strategy agent prompts** - `8648e32` (feat)
3. **Prompts package init update** - `efd8960` (chore)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `backend/app/agents/prompts/financial.py` - FINANCIAL_SYSTEM_PROMPT: transaction analysis, account relationships, anomalies, valuations, cash flow patterns
- `backend/app/agents/prompts/legal.py` - LEGAL_SYSTEM_PROMPT: contract obligations, regulatory compliance, legal risks, precedents, violations
- `backend/app/agents/prompts/evidence.py` - EVIDENCE_SYSTEM_PROMPT: authenticity, chain of custody, corroboration, digital forensics, quality assessment
- `backend/app/agents/prompts/strategy.py` - STRATEGY_SYSTEM_PROMPT: case strengths/weaknesses, investigation priorities, strategic recommendations, risk assessment
- `backend/app/agents/prompts/__init__.py` - Re-exports all 6 system prompt constants alphabetically

## Decisions Made
- All 4 prompts follow an identical 12-section structure for consistency (role, context injection, analysis areas, entity taxonomy, findings, confidence, citations, hypothesis evaluation, extraction mode, no-findings handling, constraints, JSON output)
- Strategy prompt explicitly documents its unique dual-input nature (own files + domain agent text summaries) and the `domain_agent_summaries_received` field
- Evidence prompt mandates always producing `quality_assessment` with overall_score, authenticity_concerns, custody analysis, corroboration_status, and recommendation
- All prompts include speaker diarization guidance for audio/video content as best-effort
- All prompts include HITL threshold mention ("findings below 40 confidence flagged for human review")
- Each prompt includes a realistic domain-specific JSON output example to guide the model

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 4 domain prompts ready for Plan 03 (domain runner pipeline) to import via factory lazy loading
- Factory methods from Plan 01 can now import prompts successfully (lazy imports resolve)
- Context injection awareness built into all prompts for orchestrator-driven case framing
- Hypothesis evaluation section ready for when hypothesis system is active
- HITL confidence threshold (below 40) referenced in all prompts, aligned with CONFIDENCE_THRESHOLD = 40 from Plan 01

---
*Phase: 06-domain-agents*
*Completed: 2026-02-06*
