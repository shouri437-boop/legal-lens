# ABOUTME: Pydantic schemas for knowledge graph API request/response models.
# ABOUTME: Defines entity CRUD, relationship CRUD, and graph data contracts for frontend consumption.

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class EntityResponse(BaseModel):
    """API response model for a single knowledge graph entity."""

    id: UUID = Field(..., description="Entity ID")
    case_id: UUID = Field(..., description="Case this entity belongs to")
    name: str = Field(..., description="Original entity name as extracted")
    name_normalized: str = Field(
        ..., description="Lowercase, stripped name for dedup matching"
    )
    entity_type: str = Field(
        ...,
        description="Domain-specific type (e.g. 'monetary_amount', 'statute', 'alias')",
    )
    domain: str = Field(
        ...,
        description="Source domain agent (financial, legal, evidence, strategy)",
    )
    confidence: float = Field(..., description="Agent-assessed confidence 0-100")
    properties: dict[str, object] | None = Field(
        default=None, description="Domain-specific metadata key-value pairs"
    )
    context: str | None = Field(
        default=None, description="Surrounding context from source document"
    )
    aliases: list[str] | None = Field(
        default=None, description="Alternative names/references"
    )
    description_brief: str | None = Field(
        default=None, description="One-liner summary for tooltips"
    )
    description_detailed: str | None = Field(
        default=None, description="Multi-sentence synthesis from findings"
    )
    domains: list[str] | None = Field(
        default=None, description="All domains this entity appears in"
    )
    source_finding_ids: list[str] | None = Field(
        default=None, description="Finding IDs linking entity to evidence"
    )
    source_execution_id: UUID | None = Field(
        default=None, description="Agent execution that produced this entity"
    )
    source_finding_index: int | None = Field(
        default=None,
        description="Index within the finding's entity list for traceability",
    )
    merged_into_id: UUID | None = Field(
        default=None,
        description="If set, this entity was soft-merged into another entity",
    )
    merge_count: int = Field(
        default=0, description="Number of other entities merged into this one"
    )
    degree: int = Field(
        default=0, description="Connection count for node sizing in graph visualization"
    )
    created_at: datetime = Field(..., description="When the entity was created")

    model_config = ConfigDict(from_attributes=True)


class EntityCreateRequest(BaseModel):
    """Request body for creating a new knowledge graph entity."""

    name: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Entity name",
    )
    entity_type: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Domain-specific entity type",
    )
    domain: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Source domain (financial, legal, evidence, strategy)",
    )
    confidence: float = Field(
        default=50.0,
        ge=0,
        le=100,
        description="Confidence score 0-100",
    )
    metadata: dict[str, object] | None = Field(
        default=None, description="Domain-specific metadata key-value pairs"
    )
    context: str | None = Field(
        default=None, description="Surrounding context from source document"
    )


class EntityUpdateRequest(BaseModel):
    """Request body for updating an existing knowledge graph entity."""

    name: str | None = Field(
        default=None,
        description="Updated entity name",
    )
    entity_type: str | None = Field(
        default=None,
        description="Updated entity type",
    )
    metadata: dict[str, object] | None = Field(
        default=None, description="Updated metadata key-value pairs"
    )
    context: str | None = Field(default=None, description="Updated surrounding context")


class RelationshipResponse(BaseModel):
    """API response model for a single knowledge graph relationship."""

    id: UUID = Field(..., description="Relationship ID")
    case_id: UUID = Field(..., description="Case this relationship belongs to")
    source_entity_id: UUID = Field(..., description="Source entity of the edge")
    target_entity_id: UUID = Field(..., description="Target entity of the edge")
    relationship_type: str = Field(
        ...,
        description="Edge type (e.g. 'associated_with', 'owns', 'sent_to')",
    )
    label: str = Field(..., description="Human-readable edge label for graph display")
    strength: int = Field(
        ...,
        description="Edge weight 0-100, combining co-occurrence and confidence",
    )
    source_execution_id: UUID | None = Field(
        default=None, description="Agent execution that produced this relationship"
    )
    properties: dict[str, object] | None = Field(
        default=None, description="Additional edge metadata"
    )
    evidence_excerpt: str | None = Field(
        default=None,
        description="Exact source quote supporting this relationship",
    )
    source_finding_ids: list[str] | None = Field(
        default=None, description="Finding IDs as evidence chain"
    )
    temporal_context: str | None = Field(
        default=None, description="When relationship existed/occurred"
    )
    corroboration_count: int | None = Field(
        default=None,
        description="How many agents found this relationship",
    )
    confidence: float | None = Field(
        default=None,
        description="LLM-assessed relationship confidence 0-100",
    )
    created_at: datetime = Field(..., description="When the relationship was created")

    model_config = ConfigDict(from_attributes=True)


class RelationshipCreateRequest(BaseModel):
    """Request body for creating a new knowledge graph relationship."""

    source_entity_id: UUID = Field(..., description="Source entity of the edge")
    target_entity_id: UUID = Field(..., description="Target entity of the edge")
    relationship_type: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Edge type",
    )
    label: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Human-readable edge label for graph display",
    )
    strength: int = Field(
        default=50,
        ge=0,
        le=100,
        description="Edge weight 0-100",
    )
    metadata: dict[str, object] | None = Field(
        default=None, description="Additional edge metadata"
    )


class GraphResponse(BaseModel):
    """Full knowledge graph data for a case, containing all entities and relationships."""

    entities: list[EntityResponse] = Field(..., description="All entities in the graph")
    relationships: list[RelationshipResponse] = Field(
        ..., description="All relationships in the graph"
    )
    entity_count: int = Field(..., description="Total number of entities")
    relationship_count: int = Field(..., description="Total number of relationships")


class EntityListResponse(BaseModel):
    """Paginated list of entities."""

    entities: list[EntityResponse] = Field(..., description="List of entities")
    total: int = Field(..., description="Total number of entities matching query")


class RelationshipListResponse(BaseModel):
    """Paginated list of relationships."""

    relationships: list[RelationshipResponse] = Field(
        ..., description="List of relationships"
    )
    total: int = Field(..., description="Total number of relationships matching query")
