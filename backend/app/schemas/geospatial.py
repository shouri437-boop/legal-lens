# ABOUTME: Pydantic schemas for the Geospatial Agent structured output and API responses.
# ABOUTME: Category A = structured output target; simple types only to keep schemas easy for the model.

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Category A: Structured Output Schemas
# ---------------------------------------------------------------------------


class Citation(BaseModel):
    """Source citation for a location mention."""

    file_id: str = Field(description="UUID of source file")
    locator: str = Field(description="Page number or timestamp")
    excerpt: str = Field(description="Exact text mentioning the location")


class EventAtLocation(BaseModel):
    """Timeline event occurring at a location."""

    event_title: str = Field(description="Short event title")
    event_description: str = Field(description="Event description")
    timestamp: str = Field(
        description="ISO 8601 string (plain string, not a datetime type)"
    )
    layer: str = Field(
        description="Event layer: evidence, financial, legal, or strategy"
    )
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score 0.0-1.0")


class LocationOutput(BaseModel):
    """A single location extracted from case data."""

    name: str = Field(description="Location name or address")
    geocodable_address: str = Field(
        default="",
        description="Real-world address or place name that Google Maps can resolve (e.g., 'Claymore, Sydney, NSW, Australia')",
    )
    latitude: float | None = Field(
        default=None, description="Geocoded latitude (-90 to 90)"
    )
    longitude: float | None = Field(
        default=None, description="Geocoded longitude (-180 to 180)"
    )
    location_type: str = Field(
        description="crime_scene | witness_location | evidence_location | suspect_location | other"
    )
    citations: list[Citation] = Field(
        description="Source citations for this location (REQUIRED)"
    )
    events: list[EventAtLocation] = Field(
        default_factory=list, description="Events at this location"
    )
    temporal_start: str | None = Field(
        default=None, description="ISO date when location became relevant (YYYY-MM-DD)"
    )
    temporal_end: str | None = Field(
        default=None,
        description="ISO date when location stopped being relevant (YYYY-MM-DD)",
    )
    source_entity_ids: list[int] = Field(
        default_factory=list,
        description="KG entity integer IDs (1-based, mapped to UUIDs during DB write)",
    )


class PathOutput(BaseModel):
    """Movement path between two locations."""

    from_location_index: int = Field(
        ge=0, description="Index in locations list (0-based)"
    )
    to_location_index: int = Field(
        ge=0, description="Index in locations list (0-based)"
    )
    route_type: str = Field(description="confirmed | inferred")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score 0.0-1.0")
    label: str | None = Field(
        default=None, description="Optional label like 'Suspect movement'"
    )
    temporal_info: str | None = Field(
        default=None, description="Optional time period like 'June 1 → June 2'"
    )


class GeospatialOutput(BaseModel):
    """Complete geospatial analysis output."""

    locations: list[LocationOutput] = Field(
        description="All locations found in case data with citations"
    )
    paths: list[PathOutput] = Field(
        default_factory=list, description="Movement paths between locations"
    )
    unmappable_locations: list[str] = Field(
        default_factory=list,
        description="Location names that could not be geocoded",
    )
    analysis_summary: str = Field(
        description="Brief narrative summary of geospatial intelligence (2-3 sentences)"
    )
