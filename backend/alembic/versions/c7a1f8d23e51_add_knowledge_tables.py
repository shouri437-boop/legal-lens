"""add_knowledge_tables

Revision ID: c7a1f8d23e51
Revises: b3a1f7c42e90
Create Date: 2026-02-07 18:00:00.000000

NOTE: Creates all 9 knowledge layer tables in a single migration:
kg_entities, kg_relationships, case_findings, case_hypotheses,
case_contradictions, case_gaps, case_synthesis, timeline_events, locations.

Also adds tsvector generated columns + GIN indexes on case_findings and
kg_entities for full-text search (via raw SQL per Alembic Pitfall 6).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7a1f8d23e51"
down_revision: str | None = "b3a1f7c42e90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create all 9 knowledge layer tables with indexes and tsvector search."""

    # ── 1. kg_entities (self-referential FK, must be first) ──────────────
    op.create_table(
        "kg_entities",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "name",
            sa.String(500),
            nullable=False,
            comment="Original entity name as extracted by domain agent",
        ),
        sa.Column(
            "name_normalized",
            sa.String(500),
            nullable=False,
            comment="Lowercase, stripped, punctuation-removed name for dedup matching",
        ),
        sa.Column(
            "entity_type",
            sa.String(100),
            nullable=False,
            comment="Domain-specific type (e.g. 'monetary_amount', 'statute', 'alias')",
        ),
        sa.Column(
            "domain",
            sa.String(50),
            nullable=False,
            comment="Source domain agent (financial, legal, evidence, strategy)",
        ),
        sa.Column(
            "confidence",
            sa.Float(),
            server_default="0.0",
            nullable=False,
        ),
        sa.Column(
            "properties",
            postgresql.JSONB(),
            nullable=True,
            comment="Domain-specific metadata key-value pairs",
        ),
        sa.Column(
            "context",
            sa.Text(),
            nullable=True,
            comment="Surrounding context from source document",
        ),
        sa.Column(
            "source_execution_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "source_finding_index",
            sa.Integer(),
            nullable=True,
            comment="Index within the finding's entity list for traceability",
        ),
        sa.Column(
            "merged_into_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="If set, this entity was soft-merged into the referenced entity",
        ),
        sa.Column(
            "merge_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
            comment="Number of other entities merged into this one",
        ),
        sa.Column(
            "degree",
            sa.Integer(),
            server_default="0",
            nullable=False,
            comment="Connection count for node sizing in graph visualization",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["source_execution_id"],
            ["agent_executions.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["merged_into_id"],
            ["kg_entities.id"],
            ondelete="SET NULL",
        ),
    )

    op.create_index("idx_kg_entities_case_id", "kg_entities", ["case_id"])
    op.create_index(
        "idx_kg_entities_case_type", "kg_entities", ["case_id", "entity_type"]
    )
    op.create_index("idx_kg_entities_merged_into", "kg_entities", ["merged_into_id"])
    op.create_index(
        "idx_kg_entities_name_normalized",
        "kg_entities",
        ["case_id", "name_normalized"],
    )

    # ── 2. kg_relationships (refs kg_entities) ───────────────────────────
    op.create_table(
        "kg_relationships",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "relationship_type",
            sa.String(100),
            nullable=False,
            comment="Edge type (e.g. 'associated_with', 'owns', 'sent_to')",
        ),
        sa.Column(
            "label",
            sa.String(200),
            nullable=False,
            comment="Human-readable edge label for graph display",
        ),
        sa.Column(
            "strength",
            sa.Integer(),
            server_default="0",
            nullable=False,
            comment="Edge weight 0-100, combining co-occurrence and confidence",
        ),
        sa.Column(
            "source_execution_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "properties",
            postgresql.JSONB(),
            nullable=True,
            comment="Additional edge metadata",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["source_entity_id"], ["kg_entities.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["target_entity_id"], ["kg_entities.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["source_execution_id"],
            ["agent_executions.id"],
            ondelete="SET NULL",
        ),
    )

    op.create_index("idx_kg_relationships_case_id", "kg_relationships", ["case_id"])
    op.create_index(
        "idx_kg_relationships_source", "kg_relationships", ["source_entity_id"]
    )
    op.create_index(
        "idx_kg_relationships_target", "kg_relationships", ["target_entity_id"]
    )

    # ── 3. case_findings ─────────────────────────────────────────────────
    op.create_table(
        "case_findings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "workflow_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Analysis workflow this finding was produced in",
        ),
        sa.Column(
            "agent_type",
            sa.String(50),
            nullable=False,
            comment="Source agent (financial, legal, evidence, strategy)",
        ),
        sa.Column(
            "agent_execution_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "file_group_label",
            sa.String(100),
            nullable=True,
            comment="Group label for multi-file agent runs",
        ),
        sa.Column(
            "category",
            sa.String(200),
            nullable=False,
            comment="Finding category (e.g. 'suspicious_transaction', 'contract_clause')",
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column(
            "finding_text",
            sa.Text(),
            nullable=False,
            comment="Full finding description with analysis",
        ),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column(
            "citations",
            postgresql.JSONB(),
            nullable=True,
            comment="List of citation dicts [{file_id, locator, excerpt}]",
        ),
        sa.Column(
            "entity_ids",
            postgresql.JSONB(),
            nullable=True,
            comment="IDs of kg_entities linked to this finding",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["agent_execution_id"],
            ["agent_executions.id"],
            ondelete="SET NULL",
        ),
    )

    op.create_index("idx_case_findings_case_id", "case_findings", ["case_id"])
    op.create_index("idx_case_findings_workflow", "case_findings", ["workflow_id"])
    op.create_index(
        "idx_case_findings_agent", "case_findings", ["case_id", "agent_type"]
    )

    # ── 4. case_hypotheses ───────────────────────────────────────────────
    op.create_table(
        "case_hypotheses",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "claim",
            sa.Text(),
            nullable=False,
            comment="The hypothesis statement",
        ),
        sa.Column(
            "status",
            sa.String(20),
            server_default="PENDING",
            nullable=False,
            comment="PENDING, SUPPORTED, or REFUTED",
        ),
        sa.Column(
            "confidence",
            sa.Float(),
            server_default="0.0",
            nullable=False,
            comment="Confidence score: sum(supporting) / sum(all evidence)",
        ),
        sa.Column(
            "supporting_evidence",
            postgresql.JSONB(),
            nullable=True,
            comment="List of evidence references supporting this hypothesis",
        ),
        sa.Column(
            "contradicting_evidence",
            postgresql.JSONB(),
            nullable=True,
            comment="List of evidence references contradicting this hypothesis",
        ),
        sa.Column(
            "source_agent",
            sa.String(50),
            nullable=True,
            comment="Agent that proposed this hypothesis",
        ),
        sa.Column(
            "reasoning",
            sa.Text(),
            nullable=True,
            comment="Explanation of why this hypothesis was proposed",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
    )

    op.create_index("idx_case_hypotheses_case_id", "case_hypotheses", ["case_id"])

    # ── 5. case_contradictions ───────────────────────────────────────────
    op.create_table(
        "case_contradictions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "claim_a",
            sa.Text(),
            nullable=False,
            comment="First conflicting claim",
        ),
        sa.Column(
            "claim_b",
            sa.Text(),
            nullable=False,
            comment="Second conflicting claim",
        ),
        sa.Column(
            "source_a",
            postgresql.JSONB(),
            nullable=True,
            comment="Source reference for claim_a",
        ),
        sa.Column(
            "source_b",
            postgresql.JSONB(),
            nullable=True,
            comment="Source reference for claim_b",
        ),
        sa.Column(
            "severity",
            sa.String(20),
            server_default="minor",
            nullable=False,
            comment="minor, significant, or critical",
        ),
        sa.Column(
            "domain",
            sa.String(50),
            nullable=True,
            comment="Domain where contradiction was detected",
        ),
        sa.Column(
            "resolution_status",
            sa.String(20),
            server_default="unresolved",
            nullable=False,
            comment="unresolved or resolved",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
    )

    op.create_index(
        "idx_case_contradictions_case_id", "case_contradictions", ["case_id"]
    )

    # ── 6. case_gaps ─────────────────────────────────────────────────────
    op.create_table(
        "case_gaps",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "description",
            sa.Text(),
            nullable=False,
            comment="What information gap was identified",
        ),
        sa.Column(
            "what_is_missing",
            sa.Text(),
            nullable=False,
            comment="Specific description of missing information",
        ),
        sa.Column(
            "why_needed",
            sa.Text(),
            nullable=True,
            comment="Why this information is important for the investigation",
        ),
        sa.Column(
            "priority",
            sa.String(20),
            server_default="medium",
            nullable=False,
            comment="low, medium, high, or critical",
        ),
        sa.Column(
            "related_entity_ids",
            postgresql.JSONB(),
            nullable=True,
            comment="IDs of kg_entities related to this gap",
        ),
        sa.Column(
            "suggested_actions",
            sa.Text(),
            nullable=True,
            comment="Recommended steps to fill the gap",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
    )

    op.create_index("idx_case_gaps_case_id", "case_gaps", ["case_id"])

    # ── 7. case_synthesis ────────────────────────────────────────────────
    op.create_table(
        "case_synthesis",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "case_summary",
            sa.Text(),
            nullable=True,
            comment="Executive summary of the case",
        ),
        sa.Column(
            "case_verdict",
            postgresql.JSONB(),
            nullable=True,
            comment="Structured verdict assessment",
        ),
        sa.Column(
            "cross_modal_links",
            postgresql.JSONB(),
            nullable=True,
            comment="Links connecting findings across different modalities",
        ),
        sa.Column(
            "cross_domain_conclusions",
            postgresql.JSONB(),
            nullable=True,
            comment="Conclusions drawn from cross-domain analysis",
        ),
        sa.Column(
            "key_findings_summary",
            sa.Text(),
            nullable=True,
            comment="Distilled summary of most important findings",
        ),
        sa.Column(
            "risk_assessment",
            sa.Text(),
            nullable=True,
            comment="Overall risk assessment narrative",
        ),
        sa.Column(
            "timeline_event_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
            comment="Number of timeline events produced by this synthesis",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
    )

    op.create_index("idx_case_synthesis_case_id", "case_synthesis", ["case_id"])

    # ── 8. timeline_events ───────────────────────────────────────────────
    op.create_table(
        "timeline_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "event_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Start date/time of the event",
        ),
        sa.Column(
            "event_end_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="End date/time for duration events",
        ),
        sa.Column(
            "event_type",
            sa.String(100),
            nullable=True,
            comment="Category of event (e.g. 'transaction', 'meeting', 'filing')",
        ),
        sa.Column(
            "layer",
            sa.String(50),
            nullable=True,
            comment="Visualization layer grouping",
        ),
        sa.Column(
            "source_entity_ids",
            postgresql.JSONB(),
            nullable=True,
            comment="IDs of kg_entities associated with this event",
        ),
        sa.Column(
            "citations",
            postgresql.JSONB(),
            nullable=True,
            comment="Source citations [{file_id, locator, excerpt}]",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
    )

    op.create_index("idx_timeline_events_case_id", "timeline_events", ["case_id"])

    # ── 9. locations ─────────────────────────────────────────────────────
    op.create_table(
        "locations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "name",
            sa.String(500),
            nullable=False,
            comment="Location name or address",
        ),
        sa.Column(
            "coordinates",
            postgresql.JSONB(),
            nullable=True,
            comment="Geocoded coordinates {lat, lng}",
        ),
        sa.Column(
            "location_type",
            sa.String(100),
            nullable=True,
            comment="Type of location (e.g. 'address', 'city', 'building')",
        ),
        sa.Column(
            "source_entity_ids",
            postgresql.JSONB(),
            nullable=True,
            comment="IDs of kg_entities associated with this location",
        ),
        sa.Column(
            "temporal_associations",
            postgresql.JSONB(),
            nullable=True,
            comment="Timeline event IDs or date ranges linked to this location",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
    )

    op.create_index("idx_locations_case_id", "locations", ["case_id"])

    # ── tsvector generated columns + GIN indexes (raw SQL) ───────────────
    # Per RESEARCH.md Pitfall 6: use raw SQL to avoid Alembic autogenerate
    # phantom diffs on generated columns.

    # Full-text search on case_findings (title + finding_text)
    op.execute(
        """
        ALTER TABLE case_findings ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            to_tsvector('english', coalesce(title, '') || ' ' || coalesce(finding_text, ''))
        ) STORED
        """
    )
    op.execute(
        """
        CREATE INDEX idx_case_findings_search ON case_findings USING gin(search_vector)
        """
    )

    # Full-text search on kg_entities name
    op.execute(
        """
        ALTER TABLE kg_entities ADD COLUMN name_search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, ''))) STORED
        """
    )
    op.execute(
        """
        CREATE INDEX idx_kg_entities_name_search ON kg_entities USING gin(name_search_vector)
        """
    )


def downgrade() -> None:
    """Drop all 9 knowledge layer tables in reverse dependency order."""

    # Drop tsvector indexes first
    op.execute("DROP INDEX IF EXISTS idx_kg_entities_name_search")
    op.execute("DROP INDEX IF EXISTS idx_case_findings_search")

    # Drop tables in reverse dependency order
    op.drop_index("idx_locations_case_id", table_name="locations")
    op.drop_table("locations")

    op.drop_index("idx_timeline_events_case_id", table_name="timeline_events")
    op.drop_table("timeline_events")

    op.drop_index("idx_case_synthesis_case_id", table_name="case_synthesis")
    op.drop_table("case_synthesis")

    op.drop_index("idx_case_gaps_case_id", table_name="case_gaps")
    op.drop_table("case_gaps")

    op.drop_index("idx_case_contradictions_case_id", table_name="case_contradictions")
    op.drop_table("case_contradictions")

    op.drop_index("idx_case_hypotheses_case_id", table_name="case_hypotheses")
    op.drop_table("case_hypotheses")

    op.drop_index("idx_case_findings_agent", table_name="case_findings")
    op.drop_index("idx_case_findings_workflow", table_name="case_findings")
    op.drop_index("idx_case_findings_case_id", table_name="case_findings")
    op.drop_table("case_findings")

    op.drop_index("idx_kg_relationships_target", table_name="kg_relationships")
    op.drop_index("idx_kg_relationships_source", table_name="kg_relationships")
    op.drop_index("idx_kg_relationships_case_id", table_name="kg_relationships")
    op.drop_table("kg_relationships")

    op.drop_index("idx_kg_entities_name_normalized", table_name="kg_entities")
    op.drop_index("idx_kg_entities_merged_into", table_name="kg_entities")
    op.drop_index("idx_kg_entities_case_type", table_name="kg_entities")
    op.drop_index("idx_kg_entities_case_id", table_name="kg_entities")
    op.drop_table("kg_entities")
