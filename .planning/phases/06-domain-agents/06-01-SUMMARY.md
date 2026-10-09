---
phase: 06-domain-agents
plan: 01
subsystem: agents
tags: [pydantic, schemas, gemini, adk, domain-agents, factory-pattern]

# Dependency graph
requires:
  - phase: 04-core-agent-system
    provides: Agent factory pattern, _create_llm_agent helper, base.py constants
  - phase: 05-agent-flow
    provides: SSE callbacks, PublishFn type, agent_events pub/sub
provides:
  - Citation, DomainEntity, Finding, HypothesisEvaluation shared types
  - FinancialOutput, LegalOutput, EvidenceOutput, StrategyOutput domain schemas
  - EvidenceQualityAssessment nested model
  - RoutingDecision.context_injection field for case-specific framing
  - 4 domain agent factory methods (create_financial_agent, etc.)
  - CONFIDENCE_THRESHOLD constant for HITL triggers
  - build_domain_agent_content for video-aware file preparation
  - Orchestrator prompt with context_injection guidance
affects: [06-02 (domain prompts), 06-03 (domain runner pipeline), 06-04 (HITL integration), 07 (synthesis)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy imports in factory methods for parallel plan execution"
    - "generate_content_config on _create_llm_agent for media_resolution control"
    - "Video/audio forced through File API in build_domain_agent_content"

key-files:
  created: []
  modified:
    - backend/app/schemas/agent.py
    - backend/app/agents/factory.py
    - backend/app/agents/base.py
    - backend/app/services/adk_service.py
    - backend/app/agents/prompts/orchestrator.py

key-decisions:
  - "Domain entity type is free-form str (not Literal) to support per-domain taxonomies + 'other' overflow"
  - "Strategy agent uses MEDIUM media_resolution (playbooks/docs, not dense scans)"
  - "All domain agents default to MODEL_PRO with HIGH thinking level"
  - "Lazy imports in factory methods handle Plan 02 creating prompt modules in parallel"

patterns-established:
  - "Domain output schema pattern: findings + hypothesis_evaluations + entities + no_findings_explanation + extraction_mode"
  - "Factory method pattern: lazy import of prompt + schema, create callbacks, _create_llm_agent with generate_content_config"

# Metrics
duration: 4min
completed: 2026-02-06
---

# Phase 6 Plan 01: Domain Output Schemas Summary

**Pydantic domain output schemas (Financial/Legal/Evidence/Strategy) with shared Citation/Finding/Entity types, context_injection on RoutingDecision, and 4 factory methods with media_resolution config**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-05T23:37:19Z
- **Completed:** 2026-02-05T23:41:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Defined 4 domain output schemas with domain-specific entity taxonomies and finding categories
- Added shared types (Citation, DomainEntity, Finding, HypothesisEvaluation, EvidenceQualityAssessment) used across all domain agents
- Extended RoutingDecision with backward-compatible `context_injection: str | None = None` field
- Added 4 factory methods with lazy imports, generate_content_config media_resolution, and HIGH thinking
- Added build_domain_agent_content that forces video/audio through Gemini File API
- Updated orchestrator prompt with context_injection guidance, examples, and shared_context relationship

## Task Commits

Each task was committed atomically:

1. **Task 1: Domain output schemas, shared types, and context_injection field** - `f0f9c45` (feat)
2. **Task 2: Factory extension, infrastructure updates, and orchestrator prompt** - `9ac777f` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `backend/app/schemas/agent.py` - Added 8 new Pydantic models (shared types + 4 domain outputs) and context_injection field on RoutingDecision
- `backend/app/agents/factory.py` - Added generate_content_config to _create_llm_agent, 4 domain factory methods with lazy imports
- `backend/app/agents/base.py` - Added CONFIDENCE_THRESHOLD = 40 constant for HITL triggers
- `backend/app/services/adk_service.py` - Added build_domain_agent_content function with video/audio File API routing
- `backend/app/agents/prompts/orchestrator.py` - Added context_injection guidance section, JSON example update, shared_context note

## Decisions Made
- Domain entity `type` field uses free-form `str` instead of `Literal` to accommodate per-domain taxonomies with 'other' overflow
- Strategy agent uses `MEDIA_RESOLUTION_MEDIUM` while financial/legal/evidence use `MEDIA_RESOLUTION_HIGH`
- All domain agents default to `MODEL_PRO` with `thinking_level="high"` for maximum reasoning quality
- Factory methods use lazy imports to avoid import-time failures when prompt modules (Plan 02) don't exist yet

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All domain output schemas ready for Plans 02-05 to consume
- Factory methods importable; will work end-to-end once Plan 02 creates prompt modules
- RoutingDecision.context_injection backward-compatible with existing orchestrator flows
- CONFIDENCE_THRESHOLD ready for Plan 04 HITL integration
- build_domain_agent_content ready for Plan 03 domain runner pipeline

---
*Phase: 06-domain-agents*
*Completed: 2026-02-06*
