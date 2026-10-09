# ABOUTME: SQLAlchemy models for synthesis-layer tables (Phase 8 populates, Phase 7 creates).
# ABOUTME: Covers hypotheses, contradictions, gaps, case synthesis, timeline events, and locations.

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CaseHypothesis(Base):
    """
    An investigative hypothesis proposed by the synthesis agent.

    Hypotheses have a 3-state lifecycle (PENDING/SUPPORTED/REFUTED) and
    carry supporting and contradicting evidence references. Agents propose
    hypotheses; users curate and resolve them.
    """

    __tablename__ = "case_hypotheses"
    __table_args__ = (Index("idx_case_hypotheses_case_id", "case_id"),)

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
    workflow_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=False,
    )
    claim: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="The hypothesis statement",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="PENDING",
        comment="PENDING, SUPPORTED, or REFUTED",
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        server_default="0.0",
        comment="Confidence score: sum(supporting) / sum(all evidence)",
    )
    supporting_evidence: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="List of evidence references supporting this hypothesis",
    )
    contradicting_evidence: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="List of evidence references contradicting this hypothesis",
    )
    source_agent: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Agent that proposed this hypothesis",
    )
    reasoning: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Explanation of why this hypothesis was proposed",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    # Relationships
    case = relationship("Case")


class CaseContradiction(Base):
    """
    A detected contradiction between two claims from case analysis.

    Contradictions are identified by the synthesis agent when domain agents
    produce conflicting conclusions. Severity ranges from minor to critical.
    """

    __tablename__ = "case_contradictions"
    __table_args__ = (Index("idx_case_contradictions_case_id", "case_id"),)

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
    workflow_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=False,
    )
    claim_a: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="First conflicting claim",
    )
    claim_b: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Second conflicting claim",
    )
    source_a: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Source reference for claim_a",
    )
    source_b: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Source reference for claim_b",
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="minor",
        comment="minor, significant, or critical",
    )
    domain: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Domain where contradiction was detected",
    )
    resolution_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="unresolved",
        comment="unresolved or resolved",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    # Relationships
    case = relationship("Case")


class CaseGap(Base):
    """
    An identified gap in case analysis where information is missing.

    Gaps are flagged by the synthesis agent when critical information is
    absent. Priority indicates urgency of filling the gap.
    """

    __tablename__ = "case_gaps"
    __table_args__ = (Index("idx_case_gaps_case_id", "case_id"),)

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
    workflow_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="What information gap was identified",
    )
    what_is_missing: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Specific description of missing information",
    )
    why_needed: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Why this information is important for the investigation",
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="medium",
        comment="low, medium, high, or critical",
    )
    related_entity_ids: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="IDs of kg_entities related to this gap",
    )
    suggested_actions: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Recommended steps to fill the gap",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    # Relationships
    case = relationship("Case")


class CaseSynthesis(Base):
    """
    High-level synthesis output for a case analysis workflow.

    Produced by the synthesis agent, this aggregates cross-domain conclusions,
    case summary, verdict assessment, and risk analysis. One row per workflow.
    """

    __tablename__ = "case_synthesis"
    __table_args__ = (Index("idx_case_synthesis_case_id", "case_id"),)

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
    workflow_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=False,
    )
    case_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Executive summary of the case",
    )
    case_verdict: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Structured verdict assessment",
    )
    cross_modal_links: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Links connecting findings across different modalities",
    )
    cross_domain_conclusions: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Conclusions drawn from cross-domain analysis",
    )
    key_findings_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Distilled summary of most important findings",
    )
    risk_assessment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Overall risk assessment narrative",
    )
    timeline_event_count: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False,
        comment="Number of timeline events produced by this synthesis",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    # Relationships
    case = relationship("Case")


class TimelineEvent(Base):
    """
    A chronological event extracted during case synthesis.

    Timeline events are byproducts of the synthesis agent that place findings
    and entities on a temporal axis. Optional end_date supports duration events.
    """

    __tablename__ = "timeline_events"
    __table_args__ = (Index("idx_timeline_events_case_id", "case_id"),)

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
    workflow_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    event_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Start date/time of the event",
    )
    event_end_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="End date/time for duration events",
    )
    event_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Category of event (e.g. 'transaction', 'meeting', 'filing')",
    )
    layer: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Visualization layer grouping",
    )
    source_entity_ids: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="IDs of kg_entities associated with this event",
    )
    citations: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Source citations [{file_id, locator, excerpt}]",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    # Relationships
    case = relationship("Case")


class Location(Base):
    """
    A geographic location extracted during case synthesis.

    Locations are identified by the geospatial agent when synthesis detects
    location references. Coordinates and temporal associations enable
    map-based visualization.
    """

    __tablename__ = "locations"
    __table_args__ = (Index("idx_locations_case_id", "case_id"),)

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
    workflow_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Location name or address",
    )
    coordinates: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Geocoded coordinates {lat, lng}",
    )
    location_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Type of location (e.g. 'address', 'city', 'building')",
    )
    citations: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Source citations [{file_id, locator, excerpt}]",
    )
    source_entity_ids: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="IDs of kg_entities associated with this location",
    )
    temporal_associations: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Timeline event IDs or date ranges linked to this location",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    # Relationships
    case = relationship("Case")
