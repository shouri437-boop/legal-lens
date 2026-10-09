# ABOUTME: Pydantic schemas for the LLM-based KG Builder agent's structured output.
# ABOUTME: Defines KgBuilderOutput (entities + relationships) used as structured-output target.

from pydantic import BaseModel, Field

from app.schemas.agent import MetadataEntry


class KgBuilderEntity(BaseModel):
    """A curated entity for the knowledge graph, produced by the LLM KG Builder agent.

    The LLM assigns sequential integer IDs (1, 2, 3...) for cross-referencing
    in relationships. During DB write, these are mapped to database UUIDs.
    """

    id: int = Field(
        ...,
        description="Sequential integer ID assigned by you for cross-referencing "
        "in relationships. Start at 1 and increment.",
    )
    name: str = Field(
        ...,
        description="Primary canonical name for this entity",
    )
    entity_type: str = Field(
        ...,
        description="One of: PERSON, ORGANIZATION, LOCATION, EVENT, ASSET, "
        "FINANCIAL_ENTITY, COMMUNICATION, DOCUMENT, OTHER",
    )
    aliases: list[str] = Field(
        default_factory=list,
        description="Alternative names, abbreviations, or references found "
        "across all domain agents",
    )
    description_brief: str = Field(
        ...,
        max_length=200,
        description="One-liner summary for graph tooltips and cards",
    )
    description_detailed: str = Field(
        ...,
        max_length=2000,
        description="2-4 sentence paragraph synthesized from all findings "
        "mentioning this entity",
    )
    domains: list[str] = Field(
        ...,
        description="All domains this entity appears in, e.g. ['financial', 'legal']",
    )
    confidence: float = Field(
        ...,
        ge=0,
        le=100,
        description="0-100: how confident the entity exists and is correctly "
        "identified",
    )
    source_finding_ids: list[str] = Field(
        default_factory=list,
        description="UUIDs of case_findings that mention this entity",
    )
    properties: list[MetadataEntry] = Field(
        default_factory=list,
        description="Additional metadata such as timestamps, amounts, roles",
    )
    other_type_explanation: str = Field(
        default="",
        description="Required explanation when entity_type is OTHER -- "
        "why no core type fits",
    )


class KgBuilderRelationship(BaseModel):
    """A semantic relationship between two entities in the knowledge graph.

    References entities by their integer ID (assigned by the LLM in the
    entities list) to avoid name-matching inconsistencies.
    """

    source_entity_id: int = Field(
        ...,
        description="ID of the source entity from the entities list above",
    )
    target_entity_id: int = Field(
        ...,
        description="ID of the target entity from the entities list above",
    )
    relationship_type: str = Field(
        ...,
        description="Semantic verb phrase: 'employed_by', "
        "'transferred_funds_to', 'co-signed lease'",
    )
    label: str = Field(
        ...,
        max_length=200,
        description="Human-readable edge label for graph display, "
        "e.g. 'CEO of', 'Wire transfer to'",
    )
    evidence_excerpt: str = Field(
        ...,
        max_length=500,
        description="Exact verbatim quote from source material supporting "
        "this relationship",
    )
    source_finding_ids: list[str] = Field(
        default_factory=list,
        description="UUIDs of case_findings that evidence this relationship",
    )
    temporal_context: str = Field(
        default="",
        description="When this relationship existed or occurred, "
        "e.g. '2023-Q3', 'January 2024'. Empty if truly unknown.",
    )
    confidence: float = Field(
        ...,
        ge=0,
        le=100,
        description="0-100: confidence in this relationship's accuracy",
    )
    strength: int = Field(
        default=50,
        ge=0,
        le=100,
        description="Edge weight for graph visualization",
    )


class KgBuilderOutput(BaseModel):
    """Complete knowledge graph output from the LLM KG Builder agent.

    Contains a curated, deduplicated list of entities and semantic
    relationships extracted holistically from all domain agent outputs.
    """

    entities: list[KgBuilderEntity] = Field(
        ...,
        description="Curated, deduplicated list of investigation-relevant entities",
    )
    relationships: list[KgBuilderRelationship] = Field(
        ...,
        description="Semantic relationships between entities with evidence citations",
    )
