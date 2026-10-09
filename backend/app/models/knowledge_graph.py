# ABOUTME: SQLAlchemy models for the knowledge graph layer.
# ABOUTME: KgEntity stores extracted entities; KgRelationship stores typed edges between entities.

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class KgEntity(Base):
    """
    A knowledge graph entity produced by the LLM-based KG Builder agent.

    Entities represent named things (people, organizations, amounts, locations,
    etc.) discovered during case analysis. The KG Builder agent reads ALL domain
    agent outputs holistically and produces curated, deduplicated entities with
    semantic descriptions and multi-domain tagging. Soft-merge via merged_into_id
    preserves audit trail for deduplication.
    """

    __tablename__ = "kg_entities"
    __table_args__ = (
        Index("idx_kg_entities_case_id", "case_id"),
        Index("idx_kg_entities_case_type", "case_id", "entity_type"),
        Index("idx_kg_entities_merged_into", "merged_into_id"),
        Index("idx_kg_entities_name_normalized", "case_id", "name_normalized"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    case_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Original entity name as extracted by domain agent",
    )
    name_normalized: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Lowercase, stripped, punctuation-removed name for dedup matching",
    )
    entity_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Domain-specific type (e.g. 'monetary_amount', 'statute', 'alias')",
    )
    domain: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Source domain agent (financial, legal, evidence, strategy)",
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        server_default="0.0",
    )
    properties: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Domain-specific metadata key-value pairs",
    )
    context: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Surrounding context from source document",
    )
    aliases: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="List of alternative names, abbreviations, or references",
    )
    description_brief: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="One-liner summary for graph tooltips and cards",
    )
    description_detailed: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="2-4 sentence synthesis from all findings mentioning this entity",
    )
    domains: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="List of source domains (e.g. ['financial', 'legal']); authoritative multi-domain list",
    )
    source_finding_ids: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="UUIDs of case_findings linking entity to evidence",
    )
    source_execution_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("agent_executions.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_finding_index: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Index within the finding's entity list for traceability",
    )
    merged_into_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("kg_entities.id", ondelete="SET NULL"),
        nullable=True,
        comment="If set, this entity was soft-merged into the referenced entity",
    )
    merge_count: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False,
        comment="Number of other entities merged into this one",
    )
    degree: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False,
        comment="Connection count for node sizing in graph visualization",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    # Relationships
    case = relationship("Case")
    source_execution = relationship("AgentExecution")
    merged_into = relationship("KgEntity", remote_side="KgEntity.id")


class KgRelationship(Base):
    """
    A typed, weighted edge between two KgEntity nodes in the knowledge graph.

    Relationships are created by the LLM-based KG Builder agent via semantic
    relationship extraction from domain agent outputs. Each relationship
    carries an evidence excerpt, temporal context, and confidence score.
    Strength (0-100) represents the edge weight for graph visualization.
    """

    __tablename__ = "kg_relationships"
    __table_args__ = (
        Index("idx_kg_relationships_case_id", "case_id"),
        Index("idx_kg_relationships_source", "source_entity_id"),
        Index("idx_kg_relationships_target", "target_entity_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    case_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_entity_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("kg_entities.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_entity_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("kg_entities.id", ondelete="CASCADE"),
        nullable=False,
    )
    relationship_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Edge type (e.g. 'associated_with', 'owns', 'sent_to')",
    )
    label: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Human-readable edge label for graph display",
    )
    strength: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False,
        comment="Edge weight 0-100, combining co-occurrence and confidence",
    )
    source_execution_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("agent_executions.id", ondelete="SET NULL"),
        nullable=True,
    )
    properties: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Additional edge metadata",
    )
    evidence_excerpt: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Exact verbatim quote from source material supporting this relationship",
    )
    source_finding_ids: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="UUIDs of case_findings as evidence chain for this relationship",
    )
    temporal_context: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="When this relationship existed or occurred (e.g. '2023-Q3')",
    )
    corroboration_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        server_default="1",
        comment="How many agents independently found this relationship",
    )
    confidence: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        server_default="0.0",
        comment="LLM-assessed relationship confidence 0-100",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    # Relationships
    case = relationship("Case")
    source_entity = relationship("KgEntity", foreign_keys=[source_entity_id])
    target_entity = relationship("KgEntity", foreign_keys=[target_entity_id])
    source_execution = relationship("AgentExecution")
