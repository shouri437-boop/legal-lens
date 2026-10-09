# Phase 8.1: Geospatial Agent & Map View — Context

## Project Architecture Context

### Current State (After Phase 8)

**Backend:**
- ✅ Synthesis Agent produces: hypotheses, contradictions, gaps, timeline events, case summary
- ✅ Domain Agents (evidence, financial, legal, strategy) produce case findings
- ✅ KG Builder produces: kg_entities, kg_relationships (curated knowledge graph)
- ✅ Database tables exist: `locations`, `case_synthesis`, `case_hypotheses`, `case_contradictions`, `case_gaps`, `timeline_events`, `kg_entities`, `kg_relationships`, `case_findings`
- ✅ Agent pattern: `DomainAgentRunner` base class, specialized runners (e.g., `SynthesisAgentRunner`)
- ✅ SSE event system for real-time updates

**Frontend:**
- ✅ Geospatial tab exists: `/cases/[id]/geospatial`
- ✅ `GeospatialMap` component with Google Maps integration
- ✅ Mock data currently displayed (`mockGeospatialData`)
- ✅ Types defined: `Landmark`, `LandmarkEvent`, `GeospatialPath`, `MapView`
- ✅ Interactive features: 2D/Satellite view, Street View, location detail panel

### What Phase 8.1 Adds

**Backend:**
- 🆕 Geospatial Agent (on-demand, reads all case data)
- 🆕 Geocoding Service (Google Maps API wrapper)
- 🆕 Locations API endpoints (generate, status, get, delete)
- 🆕 Movement pattern detection logic
- 🆕 GeospatialOutput Pydantic schema

**Frontend:**
- 🆕 Trigger UI (Generate button, status banner, refresh button)
- 🆕 Real data fetching (`useGeospatialData` hook)
- 🆕 Enhanced location detail panel (citations, temporal analysis, related entities)
- 🔄 Replace mock data with API data

---

## Design Decisions

### 1. On-Demand vs Auto-Trigger

**Decision:** On-demand (user-triggered)

**Rationale:**
- Geospatial analysis is expensive (geocoding API costs, LLM processing)
- Not all cases have meaningful location data
- User knows best when geospatial view is needed
- Allows user to regenerate after adding new evidence

**Implementation:**
- Button in Geospatial tab: "Generate Geospatial Intelligence"
- API: `POST /api/cases/{caseId}/geospatial/generate`
- Status check: `GET /api/cases/{caseId}/geospatial/status`

---

### 2. Hybrid Storage (Persistent + Regenerable)

**Decision:** Store results in DB but allow regeneration

**Rationale:**
- **Persistent:** Avoid re-geocoding same locations (cost savings)
- **Regenerable:** New evidence may reveal new locations or change interpretations
- **Fast load:** Don't recompute on every page visit

**Implementation:**
- `locations` table stores results
- DELETE endpoint clears data: `DELETE /api/cases/{caseId}/geospatial`
- Refresh button: calls DELETE then POST generate

---

### 3. Citation-First Approach

**Decision:** Every location must have citations (file_id + page/timestamp + excerpt)

**Rationale:**
- Maintains Legal Lens' evidence-based philosophy
- Users can verify location claims
- Prepares for Source Panel integration (Phase 10)
- Distinguishes reliable vs speculative locations

**Implementation:**
- Agent prompt: "For every location, extract exact source citation"
- `locations` table: JSON field for citations array
- Detail panel: Citations section with excerpts

---

### 4. Google Maps for Geocoding

**Decision:** Use Google Maps Geocoding API (not Mapbox or OSM)

**Rationale:**
- Frontend already uses Google Maps (`@vis.gl/react-google-maps`)
- Consistent API ecosystem (Maps + Geocoding from same provider)
- High accuracy and coverage
- API key already configured

**Trade-offs:**
- Cost: Google Maps charges per request (but caching mitigates)
- Vendor lock-in: Could add OSM fallback later if needed

**Implementation:**
- `geocoding_service.py` wraps Google Maps Geocoding API
- Caching layer (in-memory or Redis) reduces redundant calls
- Rate limiting respects API quotas

---

### 5. Movement Pattern Complexity

**Decision:** Start with simple temporal-sequential patterns (A→B→C)

**Rationale:**
- Phase 8.1 goal: get geospatial working end-to-end
- Complex patterns (convergence, divergence, loops) can be Phase 8.2
- Timeline events already provide temporal ordering
- Simple patterns cover 80% of use cases

**Implementation:**
- Agent analyzes timeline_events + location mentions
- Detects sequences: "Entity was at A (June 1), then B (June 2), then C (June 3)"
- Creates GeospatialPath: from=A, to=B (June 1→2), then from=B, to=C (June 2→3)
- Route type: "confirmed" (explicit statement) vs "inferred" (temporal sequence)

**Future Enhancement (Phase 8.2 if needed):**
- Convergence detection (multiple entities → single location)
- Divergence detection (single location → multiple entities)
- Loop detection (A→B→A)
- Anomaly detection (unusual patterns)

---

### 6. SSE Events for Real-Time Progress

**Decision:** Emit SSE events during generation for live progress updates

**Rationale:**
- Geospatial analysis can take 1-2 minutes
- User needs feedback that system is working
- Progress indicator improves UX
- Follows existing pattern (other agents use SSE)

**Events:**
- `GEOSPATIAL_GENERATING` — Analysis started
- `LOCATION_ENRICHED` — Per-location progress (optional, may be too noisy)
- `GEOSPATIAL_COMPLETE` — Analysis finished

**Implementation:**
- Agent emits events via `publish_fn`
- Frontend subscribes to SSE stream
- Status banner updates in real-time

---

### 7. Location Type Classification

**Decision:** Use 5 categories (crime_scene, witness_location, evidence_location, suspect_location, other)

**Rationale:**
- Covers common legal/investigative scenarios
- Color-coded markers improve map readability
- Extensible (can add more types later)
- Matches existing frontend design (LANDMARK_COLORS)

**Implementation:**
- Agent classifies based on context (e.g., "incident occurred at" → crime_scene)
- `locations.location_type` field stores classification
- Frontend maps types to colors

---

## Agent Design

### Geospatial Agent Architecture

**Pattern:** Follows `SynthesisAgentRunner` pattern (text-only input from DB)

**Input Assembly:**
```python
async def assemble_geospatial_input(case_id: UUID, workflow_id: UUID) -> str:
    """
    Assemble text prompt from DB data:
    1. Case metadata (name, description)
    2. Case synthesis (summary, key findings)
    3. Hypotheses (claims with evidence)
    4. Timeline events (chronological)
    5. KG entities (people, orgs, locations)
    6. Domain findings (relevant excerpts)

    Returns: Multi-section markdown text
    """
```

**Agent Prompt Structure:**
```markdown
# ROLE
You are a Geospatial Intelligence Analyst for the Legal Lens investigation platform.

# TASK
Extract all location references from the case data, geocode them, categorize by type, and detect movement patterns.

# INSTRUCTIONS
1. Location Extraction:
   - Identify addresses, place names, coordinates, landmarks
   - Use context to disambiguate (e.g., "Springfield" + "Illinois" → "Springfield, IL")

2. Geocoding:
   - Use the geocode_location tool to convert names/addresses to coordinates
   - If geocoding fails, mark location as "unmappable" but still include it

3. Type Classification:
   - crime_scene: where crime/incident occurred
   - witness_location: where witnesses were/are located
   - evidence_location: where evidence was found/stored
   - suspect_location: where suspects were/are located
   - other: any other relevant location

4. Citation Extraction:
   - For EVERY location, extract exact source citation:
     - file_id (from case data)
     - locator (page number or timestamp)
     - excerpt (exact text mentioning the location)

5. Event Association:
   - Link timeline events to locations (what happened where)
   - Include event title, description, timestamp, confidence

6. Movement Detection:
   - Identify temporal sequences (A at time T1, B at time T2, C at time T3)
   - Create paths between locations when movement is implied or stated
   - Mark route_type as "confirmed" (explicit) or "inferred" (temporal)

# OUTPUT SCHEMA
Return structured JSON matching GeospatialOutput schema.

# CASE DATA
[Assembled case data here...]
```

**Tools:**
- `geocode_location(location_name: str) -> dict | None` — Calls geocoding service
- `reverse_geocode(lat: float, lng: float) -> str | None` — Coordinates to address

**Output Schema:**
```python
class LocationOutput(BaseModel):
    name: str
    coordinates: dict[str, float] | None  # {lat, lng}
    location_type: Literal["crime_scene", "witness_location", "evidence_location", "suspect_location", "other"]
    citations: list[Citation]  # file_id, locator, excerpt
    events: list[EventAtLocation]
    temporal_associations: list[dict]  # event_ids, date ranges
    source_entity_ids: list[UUID]  # KG entity IDs

class PathOutput(BaseModel):
    from_location_name: str
    to_location_name: str
    route_type: Literal["confirmed", "inferred"]
    confidence: float
    label: str | None
    temporal_info: str | None  # "June 1 → June 2"

class GeospatialOutput(BaseModel):
    locations: list[LocationOutput]
    paths: list[PathOutput]
    unmappable_locations: list[str]  # Locations that couldn't be geocoded
    summary: str  # Brief narrative summary
```

---

## Data Transformation

### API Response → Frontend Types

**Backend Location → Frontend Landmark:**
```typescript
// API Response
{
  "id": "uuid",
  "name": "123 Main St",
  "coordinates": { "lat": 39.78, "lng": -89.65 },
  "location_type": "crime_scene",
  "events": [...],
  "citations": [...]
}

// Transform to Landmark
{
  id: "uuid",
  name: "123 Main St",
  location: { lat: 39.78, lng: -89.65 },
  type: "crime_scene",
  events: [
    {
      id: "event_uuid",
      title: "Robbery occurred",
      description: "...",
      timestamp: new Date("2024-06-15T22:30:00Z"),
      layer: "evidence",
      confidence: 0.95,
      sourceDocuments: ["file_uuid"]
    }
  ]
}
```

**Key Transformations:**
- `coordinates` → `location` (rename field)
- `location_type` → `type` (consistent with frontend enum)
- API timestamps (ISO strings) → `Date` objects
- Flatten nested structures for map rendering

---

## Integration Points

### Phase 7 Integration (KG Builder)
- **Provides:** `kg_entities` with location mentions
- **Usage:** Geospatial agent reads entities to find location references
- **Example:** Entity "John Doe" has attribute "last_known_address": "456 Oak Ave"

### Phase 8 Integration (Synthesis)
- **Provides:** `case_synthesis`, `timeline_events`, `case_hypotheses`
- **Usage:** Geospatial agent extracts locations from synthesis outputs
- **Example:** Timeline event "Meeting occurred" → extract location from description

### Phase 10 Integration (Source Panel)
- **Provides:** Citation navigation
- **Usage:** Click citation in location detail → opens Source Panel at exact page/timestamp
- **Preparation:** Store citation metadata in format compatible with Source Panel

### Phase 9 Integration (Chat)
- **Provides:** Geospatial queries via chat
- **Usage:** Chat agent can query locations: "Where did the suspect go?"
- **Preparation:** Locations API must be chat-accessible

---

## File Structure

### Backend (New Files)
```
backend/app/
├── agents/
│   ├── geospatial.py                 # GeospatialAgentRunner class
│   └── prompts/
│       └── geospatial.py             # System prompt for agent
├── services/
│   └── geocoding_service.py          # Google Maps API wrapper
├── api/
│   └── locations.py                  # REST endpoints
└── schemas/
    └── geospatial.py                 # Pydantic output schemas
```

### Frontend (Modified Files)
```
frontend/src/
├── app/(app)/cases/[id]/geospatial/
│   └── page.tsx                      # Add trigger UI, replace mock data
├── components/Geospatial/
│   └── GeospatialMap.tsx             # Enhance detail panel (minimal changes)
├── hooks/
│   └── useGeospatialData.ts          # NEW: Data fetching hook
└── types/
    └── geospatial.types.ts           # Update types if needed (citations, etc.)
```

---

## Testing Data

### Mock Case for Testing

**Case:** "Springfield Robbery Investigation"

**Locations:**
1. **Crime Scene:** "Quick Mart, 123 Main St, Springfield, IL"
   - Type: crime_scene
   - Events: "Robbery occurred" (June 15, 10:30 PM)
   - Citations: police_report.pdf, page 3

2. **Witness Location:** "Sarah's Apartment, 456 Oak Ave, Springfield, IL"
   - Type: witness_location
   - Events: "Witness interview conducted" (June 16, 2:00 PM)
   - Citations: witness_statement.pdf, page 1

3. **Suspect Location:** "Motel 6, 789 Highway 55, Springfield, IL"
   - Type: suspect_location
   - Events: "Suspect located" (June 17, 8:00 AM)
   - Citations: surveillance_log.pdf, page 5

**Paths:**
- Suspect movement: Quick Mart → Motel 6 (June 15 10:30 PM → June 15 11:00 PM)
  - Route type: inferred (temporal sequence from footage)
  - Confidence: 0.7

---

## Performance Considerations

### Geocoding Optimization
- **Caching:** Cache geocoded results (in-memory or Redis)
- **Batch requests:** Geocode multiple locations in parallel (Google Maps allows batch requests)
- **Rate limiting:** Respect API quotas (e.g., 50 requests/second)

### Agent Performance
- **Streaming output:** Agent streams locations as they're found (SSE events)
- **Timeout:** Set reasonable timeout (5 minutes max)
- **Fallback:** If agent fails, allow partial results (geocode what's available)

### Frontend Performance
- **Lazy loading:** Map component heavy, load on tab navigation
- **Pagination:** If >100 locations, paginate or cluster markers
- **Debouncing:** Filter changes debounced (300ms)

---

## Error Handling

### Geocoding Failures
- **Scenario:** Address unmappable (e.g., "somewhere in downtown")
- **Handling:** Store location with `coordinates: null`, mark as "unmappable"
- **UI:** Show in list but not on map (or as text annotation)

### Agent Failures
- **Scenario:** Agent crashes mid-execution
- **Handling:** Rollback transaction, return error to frontend
- **UI:** Show error message, allow retry

### API Quota Exceeded
- **Scenario:** Google Maps quota exhausted
- **Handling:** Log warning, return partial results
- **UI:** Show message: "Some locations could not be geocoded (API quota exceeded)"

---

## Security Considerations

### API Key Protection
- Google Maps API key in backend environment variable (NOT exposed to frontend for geocoding)
- Frontend uses public API key (restricted to domain) for map rendering only

### Authorization
- All endpoints require case access authorization
- User must have permission to view case to trigger geospatial analysis

### Rate Limiting
- Prevent abuse: limit geospatial generation to 1 request per case per hour (unless forced)

---

## Future Enhancements (Post-8.1)

### Phase 8.2 (If Needed)
- Advanced movement patterns (convergence, divergence, loops)
- Anomaly detection (unusual travel patterns)
- Historical imagery integration (Google Earth Engine)
- Geofencing (alert if entity enters/exits area)

### Phase 9 (Chat Integration)
- Chat queries: "Where did the suspect go after the robbery?"
- Chat tool: `query_geospatial(case_id, query) -> locations + paths`

### Phase 10 (Source Panel Integration)
- Click citation → opens Source Panel at exact page/timestamp
- Bidirectional: Source Panel can highlight locations on map

### Phase 11 (Corrections)
- User can manually correct geocoding errors
- User can adjust location types
- User can add missing locations

---

## Success Checklist

Before marking Phase 8.1 complete:

**Backend:**
- [ ] Geospatial Agent implemented and tested
- [ ] Geocoding service works with caching
- [ ] Locations API endpoints functional
- [ ] Movement pattern detection working
- [ ] SSE events emitted correctly
- [ ] Citations extracted for all locations
- [ ] Database populated correctly

**Frontend:**
- [ ] Trigger button generates analysis
- [ ] Status banner updates in real-time
- [ ] Mock data removed, real data displayed
- [ ] Location markers render correctly
- [ ] Detail panel shows events, citations, temporal data
- [ ] Movement paths visualized
- [ ] Refresh capability works

**Integration:**
- [ ] Agent reads from synthesis, KG, findings tables
- [ ] API responses match frontend types
- [ ] SSE events trigger UI updates
- [ ] Errors handled gracefully

**Documentation:**
- [ ] API endpoints documented (OpenAPI/Swagger)
- [ ] Agent prompts version-controlled
- [ ] Frontend hook usage documented
- [ ] Testing data available for QA
