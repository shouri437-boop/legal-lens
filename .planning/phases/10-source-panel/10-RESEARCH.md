# Phase 10: Source Panel & Entity Resolution - Research

**Researched:** 2026-02-09
**Domain:** Citation-to-source data pipeline, entity resolution, cross-view wiring
**Confidence:** HIGH

## Summary

Phase 10 is a **data pipeline wiring** phase, not a UI framework phase. All viewer components (SourceViewerModal, PdfViewer, AudioViewer, VideoViewer, ImageViewer) are already built in Phase 7.2. The geospatial detail panel already has citation UI but does not resolve entity IDs. The verdict detail panels (hypothesis, contradiction, gap) already have evidence/source sections but display raw UUIDs. The KG entity panel shows source finding IDs as truncated UUIDs. The timeline event cards display source counts but have no clickable links.

The work breaks into two parallel tracks: (1) **Citation-to-Source Pipeline** -- wire every view's citation references through the data chain to open SourceViewerModal with the correct file, page/timestamp, and excerpt; and (2) **Entity Name Resolution** -- build a shared hook that batch-resolves entity IDs (both UUIDs and integer-style IDs) into human-readable names with type badges, used across all views.

**Primary recommendation:** Build two shared utilities (`useSourceNavigation` hook for citation clicking, `useEntityResolver` hook for entity name/type resolution) and then integrate them into each view's existing components. No new backend endpoints are needed -- all data is already accessible through existing APIs. The work is frontend-only.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | UI framework | Already in project |
| @react-pdf-viewer/core | 3.x | PDF rendering + search highlighting | Already wired in PdfViewer.tsx |
| @react-pdf-viewer/search | 3.x | Text search/highlight within PDF | Already wired, supports `highlight()` API |
| @react-pdf-viewer/page-navigation | 3.x | Jump to page | Already wired, supports `jumpToPage()` |
| wavesurfer.js | latest | Audio waveform + seek | Already wired in AudioViewer.tsx |
| React Query | latest | Server state management | Already used across the app |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | latest | Icons for entity type badges | Already used everywhere |
| clsx | latest | Conditional class names | Already used |

### No New Dependencies Needed
This phase does not require any new libraries. Everything needed is already installed and working.

## Architecture Patterns

### Data Model Chain: Citation to Source File

The complete chain for resolving a citation to a viewable source file:

```
Step 1: Get citation object
  { file_id: string, locator: string, excerpt: string }
  - Found on: CaseFinding.citations[], TimelineEvent.citations[],
    Location.citations[], CaseHypothesis.supporting_evidence[],
    CaseContradiction.source_a/source_b

Step 2: Parse locator string
  Format examples:
    "page:3"           -> PDF page 3
    "ts:01:23:45"       -> Audio/video at 1h23m45s
    "region:x,y,w,h"   -> Image region (ignored per decisions)

Step 3: Get file metadata
  GET /api/cases/:caseId/files (already loaded in evidence library)
  -> CaseFile.category tells us: DOCUMENT | IMAGE | VIDEO | AUDIO
  -> CaseFile.original_filename for display name
  -> CaseFile.mime_type for type determination

Step 4: Get signed download URL
  GET /api/cases/:caseId/files/:fileId/download?inline=true
  -> Returns { download_url: string, expires_in: number }
  -> Already implemented in files.ts getDownloadUrl()
  -> Already cached via useFileUrlCache hook

Step 5: Build SourceViewerContent
  {
    type: map(category) -> "pdf" | "audio" | "video" | "image"
    url: download_url
    fileName: original_filename
    page: parse(locator).page        // PDF only
    timestamp: parse(locator).time   // audio/video only
    highlightText: excerpt           // PDF only
  }

Step 6: Open SourceViewerModal with this content
```

### Data Model Chain: Entity ID to Name + Type

Two patterns exist in the codebase for entity references:

```
Pattern A: UUID entity references (most common)
  - KgEntity.source_finding_ids -> finding UUIDs, not entity UUIDs
  - CaseGap.related_entity_ids -> entity UUIDs (JSONB array of strings)
  - Location.source_entity_ids -> entity UUIDs (JSONB array of strings)
  - TimelineEvent.source_entity_ids -> entity UUIDs (JSONB array of strings)

Pattern B: Already resolved
  - GapResponse.related_entities -> [{id, name, entity_type}]
    (Backend _resolve_entity_ids() already does this for gaps)
  - All entities in KG view -> EntityResponse with name/entity_type
```

**Resolution strategy:** On the frontend, the KG graph data (fetchGraph) returns ALL entities for a case. This is already fetched and cached by the KG page. A shared hook can use this same data (or fetch it independently) as the entity lookup map.

### Recommended Shared Hook Architecture

```
src/hooks/
  useSourceNavigation.ts   -- Citation click -> SourceViewerModal
  useEntityResolver.ts     -- Entity UUID -> { name, type, color }
```

### Pattern 1: useSourceNavigation Hook

**What:** Shared hook that takes a citation object and case context, resolves the file metadata and signed URL, and returns a SourceViewerContent ready for the modal.

**When to use:** Every view that has clickable citations.

```typescript
// Hook API
function useSourceNavigation(caseId: string) {
  return {
    openSource: (citation: Citation) => void,
    sourceContent: SourceViewerContent | null,
    isLoading: boolean,
    closeSource: () => void,
  };
}

// Citation type (matches FindingCitation from backend)
interface Citation {
  file_id: string;
  locator: string;
  excerpt?: string;
}
```

**Implementation approach:**
1. Accept a citation `{ file_id, locator, excerpt }`
2. Fetch file metadata from a case files cache (or listFiles if not cached)
3. Get signed URL via `getDownloadUrl(caseId, fileId, true)` (with useFileUrlCache)
4. Parse locator: `"page:3"` -> page=3, `"ts:01:23:45"` -> timestamp=5025
5. Map file category to SourceViewerContent type
6. Set state that triggers the SourceViewerModal

### Pattern 2: useEntityResolver Hook

**What:** Shared hook that batch-resolves entity UUIDs to display names + types using the KG entities endpoint.

**When to use:** Geospatial detail panel (source_entity_ids), timeline event cards (entityIds), any future view showing entity references.

```typescript
// Hook API
function useEntityResolver(caseId: string) {
  return {
    resolveEntities: (ids: string[]) => ResolvedEntity[],
    getEntity: (id: string) => ResolvedEntity | null,
    isLoading: boolean,
  };
}

interface ResolvedEntity {
  id: string;
  name: string;
  entity_type: string;
  color: string; // From getEntityColor()
}
```

**Implementation approach:**
1. Fetch all entities for the case via `fetchGraph(caseId)` (or a lighter endpoint)
2. Build a Map<string, ResolvedEntity> keyed by entity ID
3. Expose lookup functions that return resolved names + types
4. Cache aggressively -- entities don't change during a viewing session
5. Handle missing entities gracefully (return "Unknown Entity" with default styling)

### Pattern 3: Citation Locator Parser

**What:** Pure utility function that parses the locator string format from FindingCitation.

```typescript
// src/lib/citation-utils.ts

interface ParsedLocator {
  type: "page" | "timestamp" | "region" | "unknown";
  page?: number;           // 1-indexed page number
  timestamp?: number;      // seconds
  region?: { x: number; y: number; w: number; h: number };
}

function parseLocator(locator: string): ParsedLocator {
  if (locator.startsWith("page:")) {
    return { type: "page", page: parseInt(locator.slice(5), 10) };
  }
  if (locator.startsWith("ts:")) {
    // "ts:01:23:45" -> seconds
    const parts = locator.slice(3).split(":").map(Number);
    const seconds = parts.reduce((acc, p) => acc * 60 + p, 0);
    return { type: "timestamp", timestamp: seconds };
  }
  if (locator.startsWith("region:")) {
    const [x, y, w, h] = locator.slice(7).split(",").map(Number);
    return { type: "region", region: { x, y, w, h } };
  }
  return { type: "unknown" };
}
```

### Pattern 4: File Category to Viewer Type Mapping

```typescript
function categoryToViewerType(
  category: FileCategory
): SourceViewerContent["type"] {
  switch (category) {
    case "DOCUMENT": return "pdf";
    case "AUDIO": return "audio";
    case "VIDEO": return "video";
    case "IMAGE": return "image";
    default: return "pdf"; // fallback
  }
}
```

### Recommended Project Structure

```
src/
  hooks/
    useSourceNavigation.ts       # Citation click -> modal content
    useEntityResolver.ts         # Entity UUID -> name + type
  lib/
    citation-utils.ts            # Locator parser, category mapper
  components/
    source-viewer/               # Already built (Phase 7.2)
      SourceViewerModal.tsx      # Already built - main modal shell
      PdfViewer.tsx              # Already built - page nav + highlight
      AudioViewer.tsx            # Already built - wavesurfer seek
      VideoViewer.tsx            # Already built - timestamp seek
      ImageViewer.tsx            # Already built - zoom/pan
    ui/
      citation-link.tsx          # Reusable citation link component
      entity-badge.tsx           # Reusable entity name + type badge
```

### Anti-Patterns to Avoid
- **Per-view citation logic duplication:** Do NOT copy citation resolution logic into each view. Use the shared hook.
- **Fetching file metadata per-citation:** Do NOT make N API calls for N citations. Batch fetch all case files once and cache.
- **Blocking on signed URL generation:** Do NOT pre-generate signed URLs for all citations. Generate on demand when user clicks.
- **Re-fetching KG data for entity resolution:** The KG graph fetch returns ALL entities. Cache this once per case session.
- **Hardcoding entity colors in each view:** Use `getEntityColor()` from `knowledge-graph-config.ts` which already exists.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text highlighting | Custom text overlay | @react-pdf-viewer/search `highlight()` | Already integrated in PdfViewer, handles multi-page search |
| Audio timestamp seek | Custom audio element | wavesurfer.js `seekTo(ratio)` | Already integrated in AudioViewer with waveform |
| Video timestamp seek | Custom seek logic | HTML5 `video.currentTime = seconds` | Already integrated in VideoViewer |
| Signed URL caching | Custom cache | `useFileUrlCache` hook | Already built, handles 1-hour cache with 24-hour URLs |
| Entity type colors | Color mapping per-view | `getEntityColor()` from knowledge-graph-config.ts | Already centralized, consistent across KG |
| Modal overlay pattern | Custom portal | SourceViewerModal component | Already built with proper z-indexing and backdrop |

**Key insight:** Every viewer component already supports the exact features needed (page jump, text highlight, timestamp seek, zoom/pan). The gap is purely in the data pipeline: getting the right data from citations to the viewer props.

## Common Pitfalls

### Pitfall 1: Citation Locator Format Inconsistency
**What goes wrong:** The locator format in citations may vary depending on which domain agent produced them (financial, legal, evidence, strategy).
**Why it happens:** Four different agent types produce citations independently, and the format spec is in the agent prompts, not enforced at the schema level.
**How to avoid:** Build the locator parser defensively -- handle all known formats (`page:N`, `ts:HH:MM:SS`, `region:x,y,w,h`) and gracefully degrade for unknown formats (open file at beginning).
**Warning signs:** Source viewer opens but shows wrong page or doesn't highlight text.

### Pitfall 2: Signed URL Expiration During Long Sessions
**What goes wrong:** User opens source viewer after their cached URL has expired (1 hour).
**Why it happens:** The `useFileUrlCache` hook caches for 1 hour, but signed URLs are valid for 24 hours.
**How to avoid:** The existing cache is fine (1h << 24h). But add error handling: if the viewer fails to load, clear the cache entry and retry with a fresh URL.
**Warning signs:** "Failed to load PDF" or 403 errors in the viewer.

### Pitfall 3: Missing File References in Citations
**What goes wrong:** A citation's `file_id` references a file that has been deleted, or the file_id is invalid.
**Why it happens:** Files can be deleted after analysis; agent output may have invalid references.
**How to avoid:** When resolving a citation, handle 404 from the download URL endpoint gracefully. Show "Source file not available" instead of crashing.
**Warning signs:** Clicking a citation shows a blank modal or crashes.

### Pitfall 4: Entity IDs in Geospatial Are Integers Not UUIDs
**What goes wrong:** The geospatial detail panel's `source_entity_ids` from LocationDetailResponse are strings but may be integer IDs (from the geospatial agent) rather than UUID strings.
**Why it happens:** The geospatial agent may produce entity references in a different format than the KG builder.
**How to avoid:** Check the actual data in the Location.source_entity_ids column. The DB schema says JSONB array of strings, and the geospatial agent stores UUID strings from the KG. But verify by checking the geospatial agent code.
**Warning signs:** Entity resolver returns "Unknown Entity" for all geospatial entities.

### Pitfall 5: Hypothesis Evidence Items Reference Findings Not Files
**What goes wrong:** Trying to directly open a source viewer from a hypothesis evidence item.
**Why it happens:** `SynthesisEvidenceItem` has `finding_id` (UUID of case_finding), NOT `file_id`. The chain is: evidence.finding_id -> CaseFinding -> CaseFinding.citations[] -> citation.file_id.
**How to avoid:** For hypothesis/contradiction evidence, the resolution chain is two hops: first resolve the finding_id to get the CaseFinding, then use the finding's citations to get file references. The `useSourceNavigation` hook needs a `openFromFinding(findingId)` method that does this two-hop resolution.
**Warning signs:** Evidence items in hypothesis detail panel are not clickable.

### Pitfall 6: PDF Highlight Matching Depends on Exact Excerpt Text
**What goes wrong:** PDF text highlighting shows no results even though the excerpt text exists in the PDF.
**Why it happens:** The @react-pdf-viewer search plugin does substring matching. If the excerpt has different whitespace, newlines, or encoding than the rendered PDF text, matching fails.
**How to avoid:** The highlight uses `matchCase: false` and `wholeWords: false` already (good). For long excerpts, consider using only the first ~100 characters. The search plugin already handles this reasonably well.
**Warning signs:** PDF opens to correct page but no text is highlighted.

### Pitfall 7: Race Conditions When Opening Multiple Citations Quickly
**What goes wrong:** User clicks citations rapidly, and multiple signed URL requests overlap, resulting in wrong file displaying.
**Why it happens:** Async URL fetching can resolve out of order.
**How to avoid:** Use a request sequence counter or abort controller in the hook. Only apply the result if it matches the most recent request.
**Warning signs:** Clicking citation A then immediately B shows file A content.

## Code Examples

### Existing: SourceViewerContent Interface (already built)
```typescript
// Source: frontend/src/components/source-viewer/SourceViewerModal.tsx
export interface SourceViewerContent {
  type: "pdf" | "audio" | "video" | "image";
  url: string;           // Signed URL from file download API
  fileName: string;
  page?: number;          // PDF: 1-indexed page to jump to
  timestamp?: number;     // Audio/video: seconds to seek to
  highlightText?: string; // PDF: text to highlight
}
```

### Existing: PdfViewer Highlight API (already built)
```typescript
// Source: frontend/src/components/source-viewer/PdfViewer.tsx
// Jump to page (1-indexed, converted to 0-indexed internally)
pageNavInstance.jumpToPage(initialPage - 1);

// Highlight keyword (already styled amber/yellow)
searchInstance.highlight({
  keyword: highlightKeyword,
  matchCase: false,
  wholeWords: false,
});
// CSS: .rpv-search__highlight { background-color: rgba(212, 168, 67, 0.35); }
```

### Existing: AudioViewer Seek API (already built)
```typescript
// Source: frontend/src/components/source-viewer/AudioViewer.tsx
// Seek to timestamp (via ratio)
const ratio = Math.min(initialTimestamp / duration, 1);
wavesurferRef.current.seekTo(ratio);
```

### Existing: VideoViewer Seek API (already built)
```typescript
// Source: frontend/src/components/source-viewer/VideoViewer.tsx
// Direct timestamp seek
videoRef.current.currentTime = initialTimestamp;
```

### Existing: File Download URL API (already built)
```typescript
// Source: frontend/src/lib/api/files.ts
export async function getDownloadUrl(
  caseId: string,
  fileId: string,
  inline: boolean = false,
): Promise<DownloadUrlResponse> {
  // Returns { download_url: string, expires_in: number }
}
```

### Existing: Signed URL Cache Hook (already built)
```typescript
// Source: frontend/src/hooks/useFileUrlCache.ts
export function useFileUrlCache() {
  return {
    getCachedUrl,   // (caseId, fileId) => string | null
    setCachedUrl,   // (caseId, fileId, url, expiresIn) => void
    clearCache,
    clearCacheForFile,
  };
}
```

### Existing: Entity Color Lookup (already built)
```typescript
// Source: frontend/src/lib/knowledge-graph-config.ts
export function getEntityColor(entityType: string): string;
// Returns hex color for entity type badges
```

### Existing: Backend Entity Batch Resolution (already built for gaps)
```typescript
// Source: backend/app/api/synthesis.py
async def _resolve_entity_ids(db, gaps) -> dict[str, RelatedEntity]:
    // Collects all UUIDs, single DB query, returns lookup dict
    // Pattern to mirror in frontend hook
```

### Finding Citation Schema (canonical format)
```typescript
// Source: backend/app/schemas/findings.py
// This is the JSONB format stored in case_findings.citations[]
interface FindingCitation {
  file_id: string;     // UUID of case_file
  locator: string;     // "page:3" | "ts:01:23:45" | "region:x,y,w,h"
  excerpt: string;     // Exact character-for-character text from source
}
```

### Where Citations Live in Each Data Model

```
1. CaseFinding.citations[]
   -> Array of { file_id, locator, excerpt }
   -> Accessed via: GET /api/cases/:caseId/findings/:findingId

2. TimelineEvent.citations[]
   -> Array of { file_id, locator, excerpt }
   -> Already in frontend TimelineEvent.metadata.citations

3. Location.citations[]
   -> Array of { file_id, locator, excerpt }
   -> Already returned by GET /api/cases/:caseId/locations/:locationId

4. CaseHypothesis.supporting_evidence[] / contradicting_evidence[]
   -> Array of { finding_id, role, excerpt }
   -> NOTE: finding_id is a CaseFinding UUID, NOT a file_id
   -> Need two-hop resolution: finding_id -> CaseFinding.citations -> file

5. CaseContradiction.source_a / source_b
   -> JSONB dict: { finding_id, excerpt }
   -> Same two-hop pattern as hypotheses

6. KgEntity.source_finding_ids[]
   -> Array of CaseFinding UUIDs
   -> Same two-hop pattern

7. KgRelationship.source_finding_ids[]
   -> Array of CaseFinding UUIDs
   -> Same two-hop pattern
```

## Views Requiring Changes

### 1. KG Entity Panel (KnowledgeGraphEntityPanel.tsx)
**Current state:** Source Documents section shows truncated UUIDs (finding IDs)
**Needed:** Resolve finding UUIDs -> fetch finding citations -> make clickable -> open SourceViewerModal
**Entity resolution:** Not needed here (entities already have names in the KG data)

### 2. KG Entity Timeline Entry (EntityTimelineEntry.tsx)
**Current state:** Shows "Source not yet available" with cursor-not-allowed
**Needed:** Wire source_finding_ids from relationship -> resolve to citations -> make clickable

### 3. Hypothesis Detail Panel (HypothesisDetailPanel.tsx)
**Current state:** EvidenceRow shows truncated finding_id, excerpt text, but not clickable
**Needed:** finding_id -> fetch CaseFinding -> use its citations -> make clickable
**Note:** The finding_id is a CaseFinding UUID, need the extra hop

### 4. Contradiction Detail Panel (ContradictionDetailPanel.tsx)
**Current state:** SourceExcerpt shows finding_id and excerpt, but not clickable
**Needed:** Same two-hop pattern as hypotheses

### 5. Gap Detail Panel (GapDetailPanel.tsx)
**Current state:** Related entities already resolved via backend batch resolution (name + type shown)
**Entity resolution:** Already done by backend (_resolve_entity_ids in synthesis.py)
**Needed:** No citation work here (gaps don't have citations), but entity badges could be improved

### 6. Geospatial Detail Panel (GeospatialMap.tsx)
**Current state:** Citations section shows file_id and locator but "View" button uses onViewSource callback that is not connected
**Entity resolution:** source_entity_ids section shows raw entity UUID strings with no names
**Needed:** Wire citations to open SourceViewerModal; resolve entity UUIDs to names + type badges

### 7. Timeline Event Cards (TimelineEventCard.tsx)
**Current state:** Shows source count and entity count but nothing is clickable
**Needed:** Add click handler or detail view that shows citations and makes them clickable
**Entity resolution:** entityIds shown as count only -- could show names in expanded view

### 8. Chat Messages
**Current state:** ChatMessage type is simple { role, content } with no citation structure
**Needed:** If chat agent returns citations in message content, parse and make clickable
**Note:** Chat agent is Phase 9 scope -- check if it returns structured citations

## Backend API Inventory

### Existing APIs (sufficient for Phase 10)

| Endpoint | Method | Returns | Used For |
|----------|--------|---------|----------|
| `/api/cases/:caseId/files` | GET | File list with metadata | File lookup cache (category, filename) |
| `/api/cases/:caseId/files/:fileId/download` | GET | Signed URL | Source viewer URL |
| `/api/cases/:caseId/graph` | GET | All entities + relationships | Entity name resolution |
| `/api/cases/:caseId/findings/:findingId` | GET | Single finding with citations | Two-hop citation resolution |
| `/api/cases/:caseId/findings` | GET | Finding list | Batch finding lookup |
| `/api/cases/:caseId/hypotheses` | GET | Hypotheses with evidence | Already used by verdict |
| `/api/cases/:caseId/contradictions` | GET | Contradictions with sources | Already used by verdict |
| `/api/cases/:caseId/gaps` | GET | Gaps with resolved entities | Already used by verdict |
| `/api/cases/:caseId/locations/:locId` | GET | Location with citations + entity IDs | Already used by geospatial |

### New Endpoint: Batch Finding Resolution (RECOMMENDED)

For efficiency, a batch endpoint to resolve multiple finding IDs to their citations in one call:

```
POST /api/cases/:caseId/findings/batch
Body: { finding_ids: string[] }
Response: { findings: FindingResponse[] }
```

**Why:** The two-hop pattern (finding_id -> citations) currently requires N individual GET requests for N finding IDs. A batch endpoint eliminates the N+1 problem. This is particularly important for hypothesis detail panels that may reference 5-10+ findings.

**Alternative:** Use the existing `GET /api/cases/:caseId/findings?limit=200` to fetch all findings for the case and cache on the frontend. This avoids a new endpoint but may fetch more data than needed for cases with many findings.

**Recommendation:** Start with the frontend cache approach (fetch all findings once per case). If performance is an issue, add the batch endpoint later.

### New Endpoint: Batch Entity Resolution (OPTIONAL)

A dedicated endpoint for entity name resolution:

```
POST /api/cases/:caseId/entities/batch
Body: { entity_ids: string[] }
Response: { entities: { id: string, name: string, entity_type: string }[] }
```

**Why:** The graph endpoint returns ALL entities which may be large. A batch endpoint would be lighter.

**Recommendation:** NOT needed for v1. The graph endpoint already returns all entities (typically <500 per case). Cache the entity map from the graph response.

## File Category to Viewer Type Mapping

| CaseFile.category | CaseFile.mime_type examples | SourceViewerContent.type |
|----|-----|----|
| DOCUMENT | application/pdf | "pdf" |
| IMAGE | image/jpeg, image/png, image/gif, image/webp | "image" |
| VIDEO | video/mp4, video/quicktime, video/webm | "video" |
| AUDIO | audio/mpeg, audio/wav, audio/x-m4a | "audio" |

**Edge case:** DOCUMENT category could be DOCX/XLSX/PPTX, which the PDF viewer cannot render. These would need to be handled as a special case (show download link instead of viewer). However, all domain agents produce citations with `page:N` locators which implies PDF sources. Non-PDF documents may not have agent-generated citations.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| UUIDs displayed as truncated strings | Resolved to human-readable names + type badges | Phase 10 | Major UX improvement for all views |
| "Source not yet available" placeholder | Clickable citation links that open source viewer | Phase 10 | Core feature completion |
| Per-view citation handling | Shared hooks (useSourceNavigation, useEntityResolver) | Phase 10 | Consistency and maintainability |

**Already current:**
- PdfViewer uses @react-pdf-viewer/search plugin for text highlighting (amber overlay already styled)
- AudioViewer uses wavesurfer.js with seek-to-timestamp
- VideoViewer uses HTML5 video with direct currentTime setting
- File URL caching already built (useFileUrlCache)
- Entity color mapping already centralized (getEntityColor)

## Open Questions

1. **Chat message citation format**
   - What we know: ChatMessage type is simple `{ role, content }` with no structured citations
   - What's unclear: Does the chat agent (Phase 9) embed citations in message text? If so, what format?
   - Recommendation: Check chat agent output format. If citations are embedded as markdown or structured text, parse them. If not, chat citations may need Phase 9 enhancements first. Defer chat citation wiring if the agent doesn't produce structured citations.

2. **Non-PDF document handling**
   - What we know: The PdfViewer only handles PDFs. DOCX/XLSX/PPTX files are DOCUMENT category.
   - What's unclear: Do agents produce citations with `page:N` locators for non-PDF documents?
   - Recommendation: If a citation references a non-PDF document, show a "Download source" link instead of opening the viewer. This is an edge case that can be handled gracefully.

3. **Integer entity IDs in geospatial data**
   - What we know: The context mentions geospatial shows "integer numbers (not even UUIDs)"
   - What's unclear: This may refer to the UI display, not the actual data format. Location.source_entity_ids in the DB is JSONB strings.
   - Recommendation: Verify actual data in a real case. If they are UUID strings, the entity resolver handles them. If they are integers, a different resolution strategy is needed.

## Sources

### Primary (HIGH confidence)
- `backend/app/models/findings.py` - CaseFinding model with citations JSONB
- `backend/app/models/file.py` - CaseFile model with category, storage_path
- `backend/app/models/synthesis.py` - All synthesis models (hypotheses, contradictions, gaps, timeline, locations)
- `backend/app/models/knowledge_graph.py` - KgEntity with source_finding_ids
- `backend/app/schemas/findings.py` - FindingCitation schema (file_id, locator, excerpt)
- `frontend/src/components/source-viewer/*.tsx` - All 5 viewer components examined
- `frontend/src/lib/api/files.ts` - getDownloadUrl API
- `frontend/src/hooks/useFileUrlCache.ts` - Signed URL caching hook
- `frontend/src/types/detail-sidebar.ts` - DetailSidebar content descriptors
- `backend/app/api/synthesis.py` - _resolve_entity_ids batch resolution pattern
- All view components examined: KG entity panel, verdict detail panels, geospatial map, timeline cards

### Secondary (MEDIUM confidence)
- `backend/app/api/files.py` - Download endpoint implementation (24h signed URLs)
- `backend/app/api/locations.py` - Location detail endpoint returning citations + entity IDs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and working in the project
- Architecture: HIGH - All data models examined, complete chain traced through code
- Pitfalls: HIGH - Based on direct code examination of citation formats and viewer APIs
- Entity resolution: HIGH - Backend pattern already exists for gaps, frontend mirrors it

**Research date:** 2026-02-09
**Valid until:** 60 days (stable codebase, no external dependencies changing)
