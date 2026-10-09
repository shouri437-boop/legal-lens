---
phase: 07-knowledge-storage-and-domain-agent-enrichment
plan: 04
subsystem: agents
tags: [prompts, citations, findings-text, domain-agents, knowledge-graph]

# Dependency graph
requires:
  - phase: 07-02
    provides: "Pydantic schemas with findings_text field on all 4 domain output models"
provides:
  - "All 4 domain agent prompts instruct exhaustive exact-source citations"
  - "All 4 domain agent prompts instruct findings_text rich markdown narrative"
  - "Citation locator formats standardized: page:N, ts:MM:SS, region:description"
affects: [07-05, 07-06, 08-synthesis, 09-chat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Citation enrichment section injected before OUTPUT FORMAT in all domain prompts"
    - "Domain-specific citation guidance (financial: cell-level, legal: statute exactness, evidence: metadata timestamps, strategy: dual-source)"

key-files:
  created: []
  modified:
    - backend/app/agents/prompts/financial.py
    - backend/app/agents/prompts/legal.py
    - backend/app/agents/prompts/evidence.py
    - backend/app/agents/prompts/strategy.py

key-decisions:
  - "Additive-only changes: new section inserted before OUTPUT FORMAT, no existing sections altered"
  - "findings_text added to JSON output examples so model sees the field in the expected output shape"

patterns-established:
  - "Citation enrichment section pattern: domain-specific guidance block before output format"

# Metrics
duration: 3min
completed: 2026-02-07
---

# Phase 7 Plan 04: Domain Agent Prompt Enrichment Summary

**Exhaustive citation rules (character-for-character excerpts, ts:MM:SS timestamps) and findings_text narrative field added to all 4 domain agent prompts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-07T18:20:26Z
- **Completed:** 2026-02-07T18:23:28Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Added "CITATION AND FINDINGS TEXT REQUIREMENTS" section to financial, legal, evidence, and strategy prompts
- Each prompt now requires character-for-character exact excerpts (no paraphrasing) for PDF viewer highlighting
- Standardized locator formats: page:N for documents, ts:MM:SS for video/audio, region:description for images
- Domain-specific citation guidance: financial (cell-level table precision, exact dollar amounts), legal (statute/clause exactness), evidence (metadata timestamps, custody details, second-level timestamps), strategy (dual-source citation for original files + domain summaries)
- findings_text field instructions with rich markdown narrative, inline [Source: ...] notation, minimum 500 words
- findings_text added to JSON output examples so the model sees the field in context

## Task Commits

Each task was committed atomically:

1. **Task 1: Add citation enrichment instructions to all 4 domain agent prompts** - `ea657f4` (feat)

## Files Created/Modified
- `backend/app/agents/prompts/financial.py` - Added citation enrichment section with financial-specific guidance (cell-level table precision, exact dollar amounts)
- `backend/app/agents/prompts/legal.py` - Added citation enrichment section with legal-specific guidance (statute/clause exactness, jurisdiction-specific language)
- `backend/app/agents/prompts/evidence.py` - Added citation enrichment section with evidence-specific guidance (metadata timestamps, custody chain details, second-level timestamps for audio/video)
- `backend/app/agents/prompts/strategy.py` - Added citation enrichment section with strategy-specific guidance (dual-source citation for original files and domain agent summaries)

## Decisions Made
None - followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 domain agent prompts are enriched with citation and findings_text requirements
- The Pydantic schemas (from Plan 02) already support findings_text as Optional[str]
- KG Builder and Findings Service (from Plan 03) are ready to consume the enriched output
- Ready for Plan 05 (API endpoints) and Plan 06 (pipeline wiring)

---
*Phase: 07-knowledge-storage-and-domain-agent-enrichment*
*Completed: 2026-02-07*
