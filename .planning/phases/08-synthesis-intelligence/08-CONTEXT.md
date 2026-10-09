# Phase 8: Synthesis Agent & Intelligence Layer - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Cross-reference all domain findings + curated knowledge graph to produce hypotheses, contradictions, evidence gaps, timeline events, investigation tasks, case summary/verdict, and key findings. Connect existing frontend components (Timeline, Command Center) to real API data. The Synthesis Agent reads from `case_findings` and `kg_entities`/`kg_relationships` (populated by earlier pipeline stages) and writes to dedicated synthesis tables. Frontend integration adds a "Verdict" tab to the Command Center and wires the Timeline page to real synthesis-generated events.

</domain>

<decisions>
## Implementation Decisions

### Synthesis output scope
- ALL outputs equally important: hypotheses, contradictions, gaps, timeline events, verdict, key findings, investigation tasks
- No output is secondary or deferred — the agent MUST produce holistic, well-formatted results across all categories
- Key findings list: ranked top 5-10 most impactful discoveries (executive briefing), in addition to the full structured analysis

### Confidence & scoring
- Hypothesis confidence: LLM-assigned (0-100), user can override later
- Contradiction severity: 3-tier (minor / significant / critical)
  - Minor = phrasing differences or minor discrepancies
  - Significant = factual disagreement between sources
  - Critical = fundamentally opposing claims that cannot both be true
- Verdict evidence strength: qualitative labels — Conclusive / Substantial / Inconclusive (no numeric score)

### Evidence linking
- Hypotheses use flat evidence list with labels: each evidence item tagged as supporting / contradicting / neutral
- NOT separate supporting_evidence[] and contradicting_evidence[] arrays

### Cross-domain conclusions
- Integrated narrative style: conclusions read as unified prose
- Domain origins mentioned naturally within the text but not formulaically ("Financial analysis shows X, Legal confirms Y" is fine if it reads naturally, but no rigid template)

### Evidence gaps
- Actionable suggestions: each gap includes what's missing, why it matters, and a specific action to obtain it (e.g., "Request bank statements from X for period Y")
- Priority ranking for gaps

### Investigation task generation
- Generate tasks in Phase 8 (not deferred): tasks from contradictions (resolve_contradiction), gaps (obtain_evidence), hypotheses (verify_hypothesis)
- Requires `investigation_tasks` table (new model + Alembic migration)
- Task deduplication via existing task list injection into synthesis prompt

### Command Center "Verdict" tab
- Command Center page gets a header tab toggle: "Agent Flow" (existing canvas) vs "Verdict" (new view)
- Tab name: "Verdict" (not "Synthesis" — something conclusive)
- Verdict tab: disabled/greyed out with "Analysis in progress..." state before synthesis completes; activates when data is ready
- Verdict view: single scrollable page with sections in order:
  1. Summary + verdict + reasoning at top (with evidence strength label)
  2. Key Findings (ranked list)
  3. Hypotheses (cards with confidence dot + percentage)
  4. Contradictions (cards with side-by-side comparison)
  5. Evidence Gaps (cards with priority and actionable suggestions)
  6. Investigation Tasks

### Detail interaction pattern
- Clicking any hypothesis/contradiction/gap/task opens the app-wide DetailSidebar (same pattern as KG entity detail)
- From DetailSidebar, citations link to SourceViewerModal (same one from Knowledge Graph view)
- Full chain: click item in Verdict view → DetailSidebar with evidence/citations → click citation → SourceViewerModal

### Hypothesis cards
- Confidence display: colored dot (red/yellow/green) + numeric percentage (e.g., "73%") — compact

### Contradiction cards
- Side-by-side comparison layout: Claim A on left, Claim B on right, severity badge in center

### Timeline integration
- Synthesis-only events for now: Timeline page shows only synthesis-generated events, no manual event creation
- Compact event cards: title, date, brief description, domain tag. Full detail on click in DetailSidebar.
- Filter dimensions: both domain (financial/legal/evidence/strategy) AND category (transaction, meeting, filing, communication, etc.)
- KG entity timeline shares synthesis events: Entity timeline in KG view shows the same synthesis events filtered to that entity

### Case header & list integration
- Verdict badge replaces current status badge in case header
- One-line summary always visible next to verdict badge in case header
- Pre-verdict state: show "Pending Analysis" badge until synthesis completes
- Cases list page: verdict badge only (Conclusive/Substantial/Inconclusive), no summary snippet — user clicks into case for details

### Claude's Discretion
- Exact scrollable section spacing and card design within Verdict view
- Loading/skeleton states for synthesis-in-progress
- Exact tab toggle design (pills, underline, etc.) in Command Center header
- Investigation tasks card design and status indicators
- Error state handling if synthesis fails
- SSE event granularity during synthesis processing

</decisions>

<specifics>
## Specific Ideas

- "I want the complete synthesis output — conclusions, hypotheses, contradictions, gaps, verdict — all in the same center area as the current command center agent tree graph view, with a tab at the header to switch between Agent Flow and Verdict"
- "For the various claims, if the user clicks something, they can immediately see in the sidebar more details and then click on source/citations to open the source view modal — the same one from Knowledge Graph view"
- Verdict tab should feel conclusive — this is the payoff after the pipeline runs
- The disabled/greyed Verdict tab during processing builds anticipation
- Side-by-side contradiction display creates a visual "face-off" between conflicting claims

</specifics>

<deferred>
## Deferred Ideas

- Manual timeline event creation (user-added events) — future phase
- User-editable hypothesis status (manually marking supported/refuted) — Phase 11 Corrections
- Source viewer wiring for KG entity timeline entries — Phase 10

</deferred>

---

*Phase: 08-synthesis-intelligence*
*Context gathered: 2026-02-08*
