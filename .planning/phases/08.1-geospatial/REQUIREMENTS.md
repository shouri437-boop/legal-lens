# Phase 8.1: Geospatial Agent & Map View (On-Demand) — Requirements

## Overview

**Goal:** Provide on-demand geospatial intelligence that extracts, geocodes, and visualizes location-based case evidence with full citation backing.

**Trigger:** User-initiated (button in Geospatial tab), NOT automatic

**Approach:**
- Agent reads all synthesis outputs, domain findings, KG entities, and timeline events from DB
- Extracts location references with context
- Geocodes to coordinates using Google Maps API
- Detects movement patterns and temporal-spatial relationships
- Stores results in `locations` table with citations
- Frontend displays interactive map with intelligence panels

---

## Requirements

### REQ-GEO-001: On-Demand Geospatial Agent
**Priority:** CRITICAL

**Description:** Implement Geospatial Agent that processes case data on user demand.

**Details:**
- Agent type: LlmAgent (Gemini 3 Pro, `thinking_level="medium"`)
- Trigger: User clicks "Generate Geospatial Intelligence" button in Geospatial tab
- Input sources (read from DB):
  - `case_synthesis` — case summary, key findings, cross-domain conclusions
  - `case_findings` — domain agent outputs (text + structured data)
  - `case_hypotheses` — investigative hypotheses with evidence
  - `timeline_events` — chronological events with dates
  - `kg_entities` — entities (people, organizations, locations mentioned)
  - `kg_relationships` — entity connections
- Output: Structured geospatial data (locations, coordinates, types, events, citations)
- Storage: `locations` table (hybrid: persistent but regenerable)

**Agent Capabilities:**
1. **Location Extraction:** Identify all location references (addresses, place names, coordinates) from case data
2. **Contextualization:** Use surrounding text to disambiguate ambiguous place names (e.g., "Springfield" → "Springfield, IL" based on context)
3. **Geocoding:** Convert location names/addresses to coordinates using geocoding service
4. **Type Classification:** Categorize each location:
   - `crime_scene` — where crime/incident occurred
   - `witness_location` — where witnesses were/are located
   - `evidence_location` — where evidence was found/stored
   - `suspect_location` — where suspects were/are located
   - `other` — any other relevant location
5. **Event Association:** Link timeline events to locations (what happened where)
6. **Movement Detection:** Identify movement patterns (person/entity traveled from A to B to C)
7. **Temporal Analysis:** Associate locations with time periods (when was location relevant)
8. **Citation Extraction:** For every location, extract exact source:
   - `file_id` — source file UUID
   - `locator` — page number (PDF) or timestamp (audio/video)
   - `excerpt` — exact text mentioning the location

**Success Criteria:**
- Agent extracts ≥90% of location references from case data
- Geocoding success rate ≥85% (allows for unmappable/ambiguous locations)
- Every location has at least one citation
- Movement patterns detected when temporal sequence exists

---

### REQ-GEO-002: Google Maps Geocoding Service
**Priority:** CRITICAL

**Description:** Implement geocoding service that converts addresses/place names to coordinates.

**Details:**
- Service location: `backend/app/services/geocoding_service.py`
- API: Google Maps Geocoding API (matches frontend Google Maps integration)
- Features:
  - **Forward geocoding:** Address/place name → {lat, lng}
  - **Reverse geocoding:** {lat, lng} → Address (if location is coordinates-only)
  - **Result caching:** Cache geocoding results to avoid redundant API calls (in-memory or Redis)
  - **Error handling:** Graceful fallback for unmappable locations (return None, log warning)
  - **Rate limiting:** Respect Google Maps API rate limits

**API Methods:**
```python
async def geocode_address(address: str) -> dict[str, float] | None:
    """Convert address to coordinates. Returns {lat, lng} or None."""

async def reverse_geocode(lat: float, lng: float) -> str | None:
    """Convert coordinates to address. Returns address string or None."""

async def batch_geocode(addresses: list[str]) -> list[dict[str, float] | None]:
    """Batch geocode multiple addresses. Returns list of coordinate dicts."""
```

**Success Criteria:**
- Forward geocoding success rate ≥85% for valid addresses
- Reverse geocoding success for any valid coordinates
- Caching reduces API calls by ≥60% on subsequent runs
- Rate limiting prevents API quota exhaustion

---

### REQ-GEO-003: Locations API Endpoints
**Priority:** CRITICAL

**Description:** Create REST API endpoints for geospatial data access and generation.

**Details:**
- API location: `backend/app/api/locations.py`

**Endpoints:**

#### 1. `POST /api/cases/{case_id}/geospatial/generate`
- **Purpose:** Trigger on-demand geospatial analysis
- **Auth:** Requires case access
- **Body:** `{ workflow_id: UUID }` (optional, defaults to latest workflow)
- **Response:** `{ status: "generating", job_id: UUID }`
- **Side effects:**
  - Spawns Geospatial Agent async task
  - Emits SSE: `GEOSPATIAL_GENERATING`
  - On completion: emits `GEOSPATIAL_COMPLETE`
- **Idempotency:** If analysis already exists for this workflow, returns existing data (or allows force regeneration with `?force=true`)

#### 2. `GET /api/cases/{case_id}/geospatial/status`
- **Purpose:** Check if geospatial analysis exists and its status
- **Response:**
  ```json
  {
    "exists": true,
    "status": "complete" | "generating" | "not_started",
    "location_count": 12,
    "last_generated": "2026-02-09T10:30:00Z",
    "workflow_id": "uuid"
  }
  ```

#### 3. `GET /api/cases/{case_id}/locations`
- **Purpose:** Get all locations with coordinates for map visualization
- **Query params:**
  - `location_type` (optional filter: crime_scene | witness_location | ...)
  - `start_date`, `end_date` (optional temporal filter)
- **Response:**
  ```json
  {
    "locations": [
      {
        "id": "uuid",
        "name": "123 Main St, Springfield, IL",
        "coordinates": { "lat": 39.7817, "lng": -89.6501 },
        "location_type": "crime_scene",
        "event_count": 3,
        "citation_count": 5
      }
    ]
  }
  ```

#### 4. `GET /api/cases/{case_id}/locations/{location_id}`
- **Purpose:** Get detailed location data with events and citations
- **Response:**
  ```json
  {
    "id": "uuid",
    "name": "123 Main St, Springfield, IL",
    "coordinates": { "lat": 39.7817, "lng": -89.6501 },
    "location_type": "crime_scene",
    "events": [
      {
        "id": "uuid",
        "title": "Robbery occurred",
        "description": "Armed robbery at convenience store",
        "timestamp": "2024-06-15T22:30:00Z",
        "layer": "evidence",
        "confidence": 0.95,
        "source_documents": ["file_uuid_1"]
      }
    ],
    "citations": [
      {
        "file_id": "uuid",
        "file_name": "police_report.pdf",
        "locator": "page 3",
        "excerpt": "The incident occurred at 123 Main Street at approximately 10:30 PM."
      }
    ],
    "temporal_associations": [
      { "event_id": "uuid", "date": "2024-06-15" }
    ],
    "source_entity_ids": ["uuid1", "uuid2"]
  }
  ```

#### 5. `GET /api/cases/{case_id}/paths`
- **Purpose:** Get movement paths for visualization
- **Response:**
  ```json
  {
    "paths": [
      {
        "id": "uuid",
        "from": "location_uuid_1",
        "to": "location_uuid_2",
        "label": "Suspect movement",
        "color": "#7B68EE",
        "route_type": "confirmed" | "inferred",
        "confidence": 0.8
      }
    ]
  }
  ```

#### 6. `DELETE /api/cases/{case_id}/geospatial`
- **Purpose:** Clear geospatial data for regeneration
- **Response:** `{ deleted: true, location_count: 12 }`

**Success Criteria:**
- All endpoints respond within 500ms (except POST generate, which is async)
- POST generate spawns agent task and returns immediately
- Filtering and pagination work correctly
- Citation data includes exact source references

---

### REQ-GEO-004: Movement Pattern Detection
**Priority:** HIGH

**Description:** Detect and visualize movement patterns from temporal-spatial data.

**Details:**
- Agent analyzes timeline events + location references to identify movement sequences
- Pattern types:
  - **Linear movement:** A → B → C (chronological sequence)
  - **Return movement:** A → B → A (round trip)
  - **Convergence:** Multiple entities → single location (meeting point)
  - **Divergence:** Single location → multiple locations (dispersal)
- Confidence scoring:
  - **Confirmed:** Explicit statement "traveled from A to B" → confidence 0.9+
  - **Inferred:** Temporal sequence + location mentions → confidence 0.5-0.8
  - **Speculative:** Hypothesis-based connection → confidence 0.3-0.5
- Storage: `GeospatialPath` records with from/to location_ids, route_type, confidence

**Success Criteria:**
- Movement patterns detected when ≥2 locations have temporal ordering
- Confidence scores accurately reflect evidence strength
- Paths stored with citation references (which evidence supports the movement)

---

### REQ-GEO-005: Frontend Trigger UI
**Priority:** CRITICAL

**Description:** Add geospatial analysis trigger UI to Geospatial tab.

**Details:**
- File: `frontend/src/app/(app)/cases/[id]/geospatial/page.tsx`
- UI Components:
  1. **Status Banner** (shown at top of page):
     - **Not Generated:** "Geospatial intelligence not yet generated for this case."
       - Shows "Generate Geospatial Intelligence" button
     - **Generating:** "Analyzing locations and movement patterns..." (with loading spinner)
     - **Complete:** "Geospatial analysis complete. {location_count} locations found. Last updated: {timestamp}"
       - Shows "Refresh" button
  2. **Generate Button:**
     - Primary action button
     - Calls `POST /api/cases/{caseId}/geospatial/generate`
     - Disables during generation
     - Shows loading state
  3. **Refresh Button:**
     - Secondary action button (appears when analysis exists)
     - Calls `DELETE` then `POST` (regenerate)
     - Confirmation dialog: "This will regenerate the geospatial analysis. Continue?"

**Success Criteria:**
- User can trigger analysis with single button click
- Status updates in real-time via SSE
- Refresh capability works without page reload
- Loading states prevent duplicate requests

---

### REQ-GEO-006: Replace Mock Data with Real API Data
**Priority:** CRITICAL

**Description:** Replace mock geospatial data with real API calls.

**Details:**
- Files to modify:
  - `frontend/src/app/(app)/cases/[id]/geospatial/page.tsx`
  - `frontend/src/components/Geospatial/GeospatialMap.tsx` (minimal changes, mostly prop updates)
- Implementation:
  1. Create API hook: `frontend/src/hooks/useGeospatialData.ts`
     ```typescript
     export function useGeospatialData(caseId: string) {
       const [status, setStatus] = useState<GeospatialStatus | null>(null);
       const [locations, setLocations] = useState<Landmark[]>([]);
       const [paths, setPaths] = useState<GeospatialPath[]>([]);
       const [loading, setLoading] = useState(true);
       const [error, setError] = useState<string | null>(null);

       // Fetch status, locations, paths from API
       // Transform API response to match Landmark/GeospatialPath types
       // Handle SSE events for real-time updates

       return { status, locations, paths, loading, error, refetch };
     }
     ```
  2. Update page.tsx to use real data:
     ```typescript
     const { status, locations, paths, loading, error, refetch } = useGeospatialData(caseId);
     ```
  3. Transform API response to match frontend types:
     - API Location → Landmark (with nested events)
     - API Path → GeospatialPath
  4. Remove `mockGeospatialData` import and usage

**Success Criteria:**
- Mock data removed entirely
- Real API data displayed on map
- Location markers show correct coordinates
- Events associated with locations correctly
- Paths visualized between locations

---

### REQ-GEO-007: Location Detail Panel Enhancement
**Priority:** HIGH

**Description:** Enhance location detail panel to show events, citations, and temporal data.

**Details:**
- Component: `GeospatialMap.tsx` (existing modal dialog)
- Current features: location name, type, Google Places info, Street View
- Enhancements needed:
  1. **Events Section** (already exists, but needs real data):
     - Show all events at this location
     - Each event: title, description, timestamp, layer, confidence
     - Source documents count
  2. **Citations Section** (NEW):
     - List all source documents mentioning this location
     - Each citation: file name, page/timestamp, excerpt
     - Click citation → opens Source Panel (future phase)
  3. **Temporal Analysis Section** (NEW):
     - "Location was relevant during: June 15-17, 2024"
     - Timeline of events at this location (mini-timeline)
     - Show associated timeline_events
  4. **Related Entities Section** (NEW):
     - List KG entities associated with this location
     - Entity type icons (person, organization, etc.)
     - Click entity → navigates to Knowledge Graph (filtered)

**UI Layout:**
```
+----------------------------------+
| [Location Icon] Location Name    |
| Type: Crime Scene                |
| [Street View Button]             |
+----------------------------------+
| 📍 Coordinates                   |
| Lat: 39.7817, Lng: -89.6501      |
+----------------------------------+
| 📅 Events at this Location (3)   |
| - Event 1 (timestamp, layer)     |
| - Event 2 (timestamp, layer)     |
+----------------------------------+
| 📄 Citations (5)                 |
| - police_report.pdf, page 3      |
|   "The incident occurred at..."  |
| - witness_statement.pdf, page 1  |
+----------------------------------+
| ⏱️ Temporal Analysis             |
| Active: June 15-17, 2024         |
| [Mini Timeline Visualization]    |
+----------------------------------+
| 🔗 Related Entities (2)          |
| - [Person] John Doe              |
| - [Organization] ABC Corp        |
+----------------------------------+
```

**Success Criteria:**
- All sections display real data from API
- Citations show exact source references with excerpts
- Temporal analysis shows date ranges accurately
- Related entities clickable (future: navigate to KG)

---

### REQ-GEO-008: Location Type Color Coding
**Priority:** MEDIUM

**Description:** Color-code location markers by type for quick visual identification.

**Details:**
- Already implemented in `GeospatialMap.tsx` (LANDMARK_COLORS constant)
- Colors:
  - `crime_scene` → Red (#FF6B6B)
  - `witness_location` → Blue (#4A90E2)
  - `evidence_location` → Orange (#F5A623)
  - `suspect_location` → Purple (#7B68EE)
  - `other` → Gray (#8A8A82)
- Ensure colors are accessible (sufficient contrast on map)
- Add legend (already exists, verify it works with real data)

**Success Criteria:**
- Each location type has distinct color
- Legend shows all types with correct colors
- Colors consistent across map and detail panels

---

### REQ-GEO-009: Movement Path Visualization
**Priority:** MEDIUM

**Description:** Visualize movement paths between locations with route types.

**Details:**
- Component: `PathsOverlay` in `GeospatialMap.tsx` (already implemented)
- Path types:
  - **Confirmed:** Solid line, higher opacity (explicit evidence of movement)
  - **Inferred:** Dashed line, lower opacity (temporal sequence suggests movement)
- Paths have directional arrows (already implemented)
- Path colors match location type or are neutral gray
- Hover shows path details (entity, time period, confidence)

**Success Criteria:**
- Paths rendered as polylines between locations
- Confirmed vs inferred visually distinct
- Arrows show direction of movement
- Hover tooltip shows path metadata

---

### REQ-GEO-010: Filtering Capabilities
**Priority:** LOW (Phase 8.1), HIGH (Phase 9 Chat enhancement)

**Description:** Allow users to filter locations and paths by criteria.

**Details:**
- Filter UI (sidebar or dropdown):
  - **Location Type:** Checkboxes for crime_scene, witness_location, etc.
  - **Date Range:** Start date - End date (filters by temporal_associations)
  - **Confidence Threshold:** Slider (0.0 - 1.0, filters events by confidence)
- Filtering is client-side (filter already-loaded data)
- Filtered locations still shown on map but dimmed/hidden
- Reset filters button

**Success Criteria:**
- Users can filter by location type (show only crime scenes)
- Date range filters show only locations active in that period
- Confidence threshold filters low-confidence events
- Filters applied without re-fetching data

---

### REQ-GEO-011: SSE Event Integration
**Priority:** MEDIUM

**Description:** Emit SSE events during geospatial analysis for real-time UI updates.

**Events:**
- `GEOSPATIAL_GENERATING` — Analysis started
  - Payload: `{ case_id, workflow_id, status: "generating" }`
- `LOCATION_ENRICHED` — Individual location geocoded and stored
  - Payload: `{ case_id, location_id, name, coordinates }`
  - UI can show progress: "12 / 15 locations processed"
- `GEOSPATIAL_COMPLETE` — Analysis finished
  - Payload: `{ case_id, workflow_id, location_count, path_count, status: "complete" }`

**Success Criteria:**
- SSE events emitted at correct lifecycle points
- Frontend receives and handles events
- UI updates in real-time (progress indicator during generation)
- No page reload required to see new data

---

## Data Flow

```
User clicks "Generate Geospatial Intelligence"
  ↓
POST /api/cases/{caseId}/geospatial/generate
  ↓
Spawn Geospatial Agent (async task)
  ↓ SSE: GEOSPATIAL_GENERATING
Agent reads from DB:
  - case_synthesis (summary, findings)
  - case_findings (domain agent outputs)
  - timeline_events (temporal data)
  - kg_entities (people, orgs, locations)
  - kg_relationships (connections)
  ↓
Agent extracts locations with context
  ↓
For each location:
  - Geocode via Google Maps API → coordinates
  - Classify type (crime_scene, witness_location, etc.)
  - Extract citations (file_id, locator, excerpt)
  - Associate events from timeline
  ↓ SSE: LOCATION_ENRICHED (per location)
Store in locations table
  ↓
Detect movement patterns (temporal sequences)
  ↓
Store paths (from → to locations)
  ↓ SSE: GEOSPATIAL_COMPLETE
Frontend auto-refreshes:
  - GET /api/cases/{caseId}/locations → Landmarks
  - GET /api/cases/{caseId}/paths → GeospatialPaths
  ↓
Render map with real data
```

---

## Technical Architecture

### Backend
- **Agent:** `backend/app/agents/geospatial.py` (follows `synthesis.py` pattern)
  - Runner: `GeospatialAgentRunner(DomainAgentRunner[GeospatialOutput])`
  - Prompt: `backend/app/agents/prompts/geospatial.py`
  - Output schema: `backend/app/schemas/geospatial.py`
- **Service:** `backend/app/services/geocoding_service.py`
  - Google Maps API integration
  - Caching layer (in-memory or Redis)
- **API:** `backend/app/api/locations.py`
  - REST endpoints (GET/POST/DELETE)
  - SSE event emission
- **Database:** `locations` table (already exists from Phase 7)

### Frontend
- **Page:** `frontend/src/app/(app)/cases/[id]/geospatial/page.tsx`
  - Trigger UI (button, status banner)
  - Data fetching hook
- **Component:** `frontend/src/components/Geospatial/GeospatialMap.tsx`
  - Minimal changes (props updated)
  - Enhanced detail panel
- **Hook:** `frontend/src/hooks/useGeospatialData.ts` (NEW)
  - Fetches status, locations, paths
  - Handles SSE events
  - Transforms API data to frontend types
- **Types:** `frontend/src/types/geospatial.types.ts` (already exists)
  - May need minor updates for citations, temporal data

---

## Dependencies

- **Phase 8 (Synthesis):** MUST be complete (provides case_synthesis, hypotheses, gaps, timeline_events)
- **Phase 7 (KG Builder):** MUST be complete (provides kg_entities, kg_relationships)
- **Phase 6 (Domain Agents):** MUST be complete (provides case_findings)
- **Google Maps API:** API key required (already configured in frontend)

---

## Testing Strategy

### Backend Tests
1. **Geocoding Service:**
   - Test forward geocoding (address → coordinates)
   - Test reverse geocoding (coordinates → address)
   - Test caching (second call faster)
   - Test error handling (invalid address)

2. **Geospatial Agent:**
   - Test location extraction from case data
   - Test type classification accuracy
   - Test citation extraction (every location has source)
   - Test movement pattern detection

3. **Locations API:**
   - Test POST generate (spawns agent, returns immediately)
   - Test GET status (reflects current state)
   - Test GET locations (returns all, applies filters)
   - Test GET location detail (includes events, citations)

### Frontend Tests
1. **Trigger UI:**
   - Test button click triggers API call
   - Test status updates via SSE
   - Test loading states prevent duplicate clicks

2. **Map Visualization:**
   - Test real data renders on map
   - Test location markers clickable
   - Test detail panel shows correct data
   - Test paths render between locations

---

## Open Questions

1. **Earth Engine Integration:** Original plan included Google Earth Engine for satellite imagery. Deferred for Phase 8.1 (requires separate API approval). Add in future phase if needed.

2. **Geocoding Quota:** Google Maps Geocoding API has usage limits. Need to monitor quota and implement rate limiting. Consider fallback to OpenStreetMap Nominatim if quota exceeded.

3. **Movement Pattern Complexity:** How complex should movement detection be? Start simple (A→B→C chronological), add advanced patterns (convergence, divergence) if needed.

4. **Citation Click Behavior:** When user clicks citation in detail panel, should it:
   - Open Source Panel (Phase 10 feature)?
   - Download/open file directly?
   - Show excerpt in modal?
   Decision: **Phase 10 will add Source Panel, so prepare structure but defer behavior.**

---

## Success Metrics

- ✅ User can trigger geospatial analysis on demand
- ✅ Analysis completes within 2 minutes for typical case (50-100 locations)
- ✅ ≥85% geocoding success rate
- ✅ Every location has ≥1 citation
- ✅ Movement patterns detected when temporal data exists
- ✅ Map displays real data (no mock data)
- ✅ Location detail panel shows events, citations, temporal analysis
- ✅ Refresh capability allows regeneration after new evidence
- ✅ SSE events provide real-time progress updates
- ✅ No auto-triggering (purely user-initiated)
