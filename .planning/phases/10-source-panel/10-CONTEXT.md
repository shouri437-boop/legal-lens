# Phase 10: Source Panel & Entity Resolution - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire source viewer components (built in Phase 7.2) to real evidence data so that citations across all views open the actual source file at the correct location. Resolve all entity integer IDs and UUIDs to human-readable names with type badges across every view. No new UI frameworks or agent logic — this phase is about completing the data pipeline from citations/entities to displayable content.

</domain>

<decisions>
## Implementation Decisions

### Source viewer presentation
- Modal overlay (existing SourceViewerModal from Phase 7.2), not a side panel
- Use existing sidebar citation sections across screens — they currently show UUIDs/integer IDs; resolve to file names + excerpts, make clickable to open source viewer modal
- For screens that don't have citation sidebars yet, wire them up the same way as screens that already have citation UI

### PDF viewer behavior
- Jump to cited page AND highlight the exact excerpt text (page + text highlight)
- Highlight style: amber/yellow overlay on the cited passage

### Audio/video viewer behavior
- Auto-seek to the cited timestamp but remain paused — user clicks play when ready
- No transcript sync highlighting for v1 — just timestamp seeking

### Image viewer behavior
- No bounding box overlays or region navigation — open the full image at default zoom
- User finds the relevant area themselves

### Citation coverage
- Citations must be clickable from ALL views: KG entity panel, Verdict detail panels (hypothesis/contradiction/gap), Timeline event cards, Geospatial detail panel, Chat messages
- No subset prioritization — comprehensive wiring across every view

### Entity name resolution
- ALL entity integer IDs (from geospatial agent) and UUIDs must be resolved to human-readable names + entity type badges
- Applies across all views: KG, Geospatial detail panel, Gap detail panel, Verdict cards, Timeline events — everywhere entity references appear
- Geospatial detail panel currently shows integer numbers (not even UUIDs) — must display actual entity names

### Claude's Discretion
- Backend API design for the source resolution chain (finding_id → file URL)
- Caching strategy for resolved entity names
- Exact highlight color/opacity for PDF text highlighting
- How to handle missing/deleted source files gracefully

</decisions>

<specifics>
## Specific Ideas

- The data pipeline for source viewing: `source_finding_ids` → `case_findings` → `agent_executions` → `case_files` → signed download URL. Components already built; only the data pipeline needs wiring.
- Existing sidebar citation UI across views already shows some UUID/ID references — upgrade these in-place rather than rebuilding. Make them show file name + excerpt text, and clicking opens the modal.
- For the Verdict tab specifically: the sidebar detail panels for hypotheses, contradictions, and gaps have citation/evidence sections that aren't displaying source references. Wire these to show real evidence with clickable source links.
- Entity resolution should be a shared utility/hook so all views use the same pattern — not per-view duplicate logic.

</specifics>

<deferred>
## Deferred Ideas

- **Agent Flow refinements** (thinking overlay, task badges, time-scrubbing, playback controls, pause/resume, fullscreen) — defer to a future phase
- **Investigation Task Panel** — defer to a future phase
- **Narrative generation** (executive summary, detailed report) — defer to a future phase
- **PDF/DOCX export** — defer to a future phase
- **Image bounding box annotations** — defer (agents don't produce coordinate data)
- **Audio transcript sync highlighting** — defer (just timestamp seek for v1)
- **Verdict visual polish** — not needed; current layout is fine once citations work

</deferred>

---

*Phase: 10-source-panel*
*Context gathered: 2026-02-09*
