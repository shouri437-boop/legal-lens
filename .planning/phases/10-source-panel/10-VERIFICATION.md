---
phase: 10-source-panel
verified: 2026-02-09T16:00:00Z
status: passed
score: 9/9 must-haves verified
---

# Phase 10: Source Panel & Entity Resolution Verification Report

**Phase Goal:** Wire citation-to-source navigation and entity resolution across all views (KG, Geospatial, Verdict, Timeline). Replace all "source not yet available" placeholders and raw UUID displays with functional clickable citations and resolved entity names.
**Verified:** 2026-02-09T16:00:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | parseLocator correctly parses page:N, ts:HH:MM:SS, and region:x,y,w,h formats | VERIFIED | `citation-utils.ts` lines 48-89: handles all 4 types with proper null/edge case handling |
| 2 | useSourceNavigation resolves a citation {file_id, locator, excerpt} into a SourceViewerContent object | VERIFIED | `useSourceNavigation.ts` lines 98-174: full pipeline (file lookup -> signed URL -> parse locator -> build content), race condition prevention |
| 3 | useEntityResolver returns resolved {name, entity_type, color} for any entity UUID | VERIFIED | `useEntityResolver.ts` lines 62-106: React Query + useMemo map + fallback entity for unknowns |
| 4 | CitationLink renders a clickable link showing file name + excerpt snippet | VERIFIED | `citation-link.tsx` lines 28-62: button with FileText icon, file name, locator badge, optional excerpt |
| 5 | EntityBadge renders a color-coded entity name with type label | VERIFIED | `entity-badge.tsx` lines 27-64: colored dot, name, type label, button variant with onClick |
| 6 | Clicking a source finding ID in KG entity panel triggers source navigation | VERIFIED | `KnowledgeGraphEntityPanel.tsx` lines 358-392: buttons call `onViewFinding?.(id)`, wired via `KnowledgeGraphCanvas.tsx` line 149 passing `stableOpenFromFinding` |
| 7 | Geospatial "View" button opens SourceViewerModal; entities show as names with EntityBadge | VERIFIED | `GeospatialMap.tsx` lines 549-554: `openSource()` call; lines 643-653: `resolveEntities()` + `EntityBadge`; lines 668-687: SourceViewerModal portal |
| 8 | Verdict hypothesis/contradiction evidence items are clickable, triggering source navigation | VERIFIED | `HypothesisDetailPanel.tsx` lines 86-139: EvidenceRow with `onViewFinding` + group-hover "View source"; `ContradictionDetailPanel.tsx` lines 60-122: SourceExcerpt with same pattern; command-center page lines 74-78 + 262-276 wires SourceViewerModal |
| 9 | Timeline event cards show expandable citation list from metadata.citations; clicking opens SourceViewerModal | VERIFIED | `TimelineEventCard.tsx` lines 52-54 extracts from metadata, lines 155-228 expandable citation list; `TimelineCore.tsx` lines 43-47 + 209-223 wires SourceViewerModal via portal |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/citation-utils.ts` | Locator parser and file category mapper | VERIFIED | 155 lines, exports parseLocator, categoryToViewerType, formatLocatorDisplay, Citation, FindingCitation, ParsedLocator |
| `frontend/src/hooks/useSourceNavigation.ts` | Citation-to-SourceViewerModal data pipeline hook | VERIFIED | 233 lines, exports useSourceNavigation with openSource, openFromFinding, closeSource, sourceContent, isLoading, error |
| `frontend/src/hooks/useEntityResolver.ts` | Entity UUID to name+type resolution hook | VERIFIED | 107 lines, exports useEntityResolver with resolveEntities, getEntity, isLoading, entityMap; ResolvedEntity interface |
| `frontend/src/components/ui/citation-link.tsx` | Reusable clickable citation link component | VERIFIED | 63 lines, exports CitationLink (not yet used by any view -- views use inline patterns) |
| `frontend/src/components/ui/entity-badge.tsx` | Reusable entity name + type badge component | VERIFIED | 65 lines, exports EntityBadge, used by GeospatialMap and GapDetailPanel |
| `frontend/src/components/knowledge-graph/KnowledgeGraphEntityPanel.tsx` | Source Documents section with clickable entries | VERIFIED | 407 lines, onViewFinding prop, clickable source finding buttons with ExternalLink icon |
| `frontend/src/components/knowledge-graph/EntityTimelineEntry.tsx` | View source evidence link | VERIFIED | 204 lines, onViewSource prop, "View source evidence" button replaces placeholder when sources exist; graceful degradation preserved |
| `frontend/src/components/knowledge-graph/KnowledgeGraphCanvas.tsx` | useSourceNavigation wired, merged source content | VERIFIED | 281 lines, useSourceNavigation(caseId), stableOpenFromFinding, navSourceContent ?? sourceViewerContent merge, SourceViewerModal rendered |
| `frontend/src/components/Geospatial/GeospatialMap.tsx` | Self-contained source navigation + entity resolution | VERIFIED | 884 lines, useSourceNavigation + useEntityResolver + EntityBadge + SourceViewerModal portal (z-[60]) + file name resolution |
| `frontend/src/components/verdict/HypothesisDetailPanel.tsx` | EvidenceRow clickable with onViewFinding | VERIFIED | 320 lines, onViewFinding prop, group-hover "View source" text, keyboard accessible |
| `frontend/src/components/verdict/ContradictionDetailPanel.tsx` | SourceExcerpt clickable with onViewFinding | VERIFIED | 250 lines, onViewFinding prop, group-hover "View source" text, keyboard accessible |
| `frontend/src/components/verdict/GapDetailPanel.tsx` | EntityBadge for consistent entity styling | VERIFIED | 171 lines, imports and uses EntityBadge component for related entities |
| `frontend/src/components/verdict/VerdictView.tsx` | Passes onViewFinding through sidebar descriptors | VERIFIED | 270 lines, accepts onViewFinding prop, threads through handleHypothesisClick and handleContradictionClick |
| `frontend/src/app/(app)/cases/[id]/command-center/page.tsx` | useSourceNavigation + SourceViewerModal for verdict | VERIFIED | 280 lines, useSourceNavigation(caseId), passes verdictOpenFromFinding to VerdictView, SourceViewerModal portal |
| `frontend/src/components/Timeline/TimelineEventCard.tsx` | Citation extraction + expandable list + onViewCitation | VERIFIED | 235 lines, extracts from metadata.citations, expandable toggle, individual citation click rows with formatLocatorDisplay |
| `frontend/src/components/Timeline/TimelineCore.tsx` | caseId prop + useSourceNavigation + SourceViewerModal portal | VERIFIED | 227 lines, caseId prop, useSourceNavigation, passes onViewCitation to each card, SourceViewerModal in portal |
| `frontend/src/components/Timeline/Timeline.tsx` | Passes caseId to TimelineCore | VERIFIED | 134 lines, line 119 passes caseId={caseId} |
| `frontend/src/types/detail-sidebar.ts` | onViewFinding callbacks in descriptor types | VERIFIED | 108 lines, onViewFinding in KnowledgeGraphEntityContent, VerdictHypothesisContent, VerdictContradictionContent |
| `frontend/src/components/app/detail-sidebar.tsx` | Passes onViewFinding through to all panels | VERIFIED | 160 lines, renderContent passes onViewFinding for KG entity, hypothesis, contradiction cases |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| useSourceNavigation | files API | listFiles + getDownloadUrl | WIRED | Lines 78-83 (React Query), lines 116-130 (signed URL with cache) |
| useSourceNavigation | citation-utils | parseLocator + categoryToViewerType | WIRED | Lines 9, 133, 136 |
| useEntityResolver | graph API | fetchGraph | WIRED | Line 65: useQuery with fetchGraph(caseId) |
| EntityBadge | knowledge-graph-config | getEntityColor | WIRED | Line 33: `const dotColor = color ?? getEntityColor(entityType)` |
| KnowledgeGraphCanvas | useSourceNavigation | openFromFinding via stableRef | WIRED | Lines 67-71: hook call, line 149: stableOpenFromFinding in sidebar descriptor |
| EntityTimelineEntry | useSourceNavigation | onViewSource callback from parent | WIRED | Lines 295-304: KnowledgeGraphEntityPanel passes onViewFinding via onViewSource prop |
| GeospatialMap | useSourceNavigation | openSource(citation) | WIRED | Lines 80-85: hook call, lines 549-554: openSource call in View button |
| GeospatialMap | useEntityResolver | resolveEntities | WIRED | Lines 88-89: hook call, lines 643-653: resolveEntities + EntityBadge rendering |
| HypothesisDetailPanel | useSourceNavigation | onViewFinding callback via sidebar | WIRED | Full chain: command-center/page.tsx -> VerdictView -> sidebar descriptor -> detail-sidebar.tsx -> HypothesisDetailPanel |
| ContradictionDetailPanel | useSourceNavigation | onViewFinding callback via sidebar | WIRED | Same chain as hypothesis, verified in detail-sidebar.tsx lines 59-63 |
| TimelineCore | useSourceNavigation | openSource(citation) | WIRED | Lines 43-47: hook call, line 174-176: passes onViewCitation -> timelineOpenSource |
| command-center/page.tsx | SourceViewerModal | portal rendering | WIRED | Lines 262-276: createPortal with z-[60] overlay |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| REQ-SOURCE-001 (PDF Viewer) | SATISFIED (via Phase 7.2 component + Phase 10 wiring) | None |
| REQ-SOURCE-002 (Video Player) | SATISFIED (via Phase 7.2 component + Phase 10 wiring) | None |
| REQ-SOURCE-003 (Audio Player) | SATISFIED (via Phase 7.2 component + Phase 10 wiring) | None |
| REQ-SOURCE-004 (Image Viewer) | SATISFIED (via Phase 7.2 component + Phase 10 wiring) | None |
| REQ-SOURCE-005 (Citation Navigation) | SATISFIED | Citations clickable across KG, Geospatial, Verdict, Timeline; navigates to exact page/timestamp |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| EntityTimelineEntry.tsx | 194 | "Source not yet available" text | Info | Expected graceful degradation when no source_finding_ids exist; this is the designed fallback, not a placeholder |
| CitationLink.tsx | -- | Not imported by any view | Info | Views use inline citation rendering instead; component available for future use but no blocker |

### Human Verification Required

### 1. Source Viewer Opens from KG Entity Panel

**Test:** Open a case with KG data, click an entity, expand Source Documents, click a source finding entry.
**Expected:** SourceViewerModal opens with the correct file at the relevant page/timestamp. The source finding button shows an ExternalLink icon.
**Why human:** Requires real case data with source_finding_ids that map to actual uploaded files; API round-trip + signed URL needed.

### 2. Geospatial Entity Names and Citation View

**Test:** Open geospatial view, click a landmark marker, check Related Entities section and Citations section.
**Expected:** Related Entities shows resolved names (e.g., "John Smith" with "person" badge) instead of UUID strings. Clicking "View" on a citation opens SourceViewerModal above the detail dialog.
**Why human:** Requires Google Maps API key + geocoded locations + actual entity data.

### 3. Verdict Evidence Click-to-Source

**Test:** Open Command Center, switch to Verdict tab, click a hypothesis card, then click an evidence item in the sidebar.
**Expected:** Evidence row highlights on hover with "View source" text appearing; clicking opens SourceViewerModal with the source document.
**Why human:** Requires synthesis data with finding_ids that have citations referencing real files.

### 4. Timeline Citation Expansion

**Test:** Open Timeline view, find an event with sources, click the "N sources" link in the event card footer.
**Expected:** Citation list expands below, showing file IDs and locator labels. Clicking a citation row opens SourceViewerModal.
**Why human:** Requires timeline events with metadata.citations populated from the backend.

### Gaps Summary

No gaps found. All 9 observable truths are verified at all three levels (existence, substantive, wired). The phase goal of wiring citation-to-source navigation across KG, Geospatial, Verdict, and Timeline views is structurally achieved. The shared foundation (citation-utils, useSourceNavigation, useEntityResolver, CitationLink, EntityBadge) is in place, and all four target views are wired with functional click handlers, SourceViewerModal portals, and entity resolution.

The only remaining "Source not yet available" text in EntityTimelineEntry.tsx is the designed graceful degradation fallback for relationships that lack source_finding_ids -- it is conditional and properly replaced with "View source evidence" when data exists.

TypeScript compilation passes cleanly with zero errors.

---

_Verified: 2026-02-09T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
