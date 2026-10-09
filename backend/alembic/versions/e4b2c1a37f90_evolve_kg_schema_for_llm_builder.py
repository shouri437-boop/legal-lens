"""evolve_kg_schema_for_llm_builder

Revision ID: e4b2c1a37f90
Revises: c7a1f8d23e51
Create Date: 2026-02-08 12:00:00.000000

NOTE: Adds nullable columns to kg_entities and kg_relationships tables
for the LLM-based KG Builder agent. All columns are nullable with sensible
defaults so existing data is unaffected.

KgEntity additions: aliases, description_brief, description_detailed, domains, source_finding_ids
KgRelationship additions: evidence_excerpt, source_finding_ids, temporal_context, corroboration_count, confidence
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4b2c1a37f90"
down_revision: str | None = "c7a1f8d23e51"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add new columns to kg_entities and kg_relationships for LLM KG Builder."""

    # ── kg_entities: 5 new columns ────────────────────────────────────────

    op.add_column(
        "kg_entities",
        sa.Column(
            "aliases",
            postgresql.JSONB(),
            nullable=True,
            comment="List of alternative names, abbreviations, or references",
        ),
    )

    op.add_column(
        "kg_entities",
        sa.Column(
            "description_brief",
            sa.String(200),
            nullable=True,
            comment="One-liner summary for graph tooltips and cards",
        ),
    )

    op.add_column(
        "kg_entities",
        sa.Column(
            "description_detailed",
            sa.Text(),
            nullable=True,
            comment="2-4 sentence synthesis from all findings mentioning this entity",
        ),
    )

    op.add_column(
        "kg_entities",
        sa.Column(
            "domains",
            postgresql.JSONB(),
            nullable=True,
            comment="List of source domains (e.g. ['financial', 'legal']); authoritative multi-domain list",
        ),
    )

    op.add_column(
        "kg_entities",
        sa.Column(
            "source_finding_ids",
            postgresql.JSONB(),
            nullable=True,
            comment="UUIDs of case_findings linking entity to evidence",
        ),
    )

    # ── kg_relationships: 5 new columns ───────────────────────────────────

    op.add_column(
        "kg_relationships",
        sa.Column(
            "evidence_excerpt",
            sa.Text(),
            nullable=True,
            comment="Exact verbatim quote from source material supporting this relationship",
        ),
    )

    op.add_column(
        "kg_relationships",
        sa.Column(
            "source_finding_ids",
            postgresql.JSONB(),
            nullable=True,
            comment="UUIDs of case_findings as evidence chain for this relationship",
        ),
    )

    op.add_column(
        "kg_relationships",
        sa.Column(
            "temporal_context",
            sa.String(200),
            nullable=True,
            comment="When this relationship existed or occurred (e.g. '2023-Q3')",
        ),
    )

    op.add_column(
        "kg_relationships",
        sa.Column(
            "corroboration_count",
            sa.Integer(),
            nullable=True,
            server_default="1",
            comment="How many agents independently found this relationship",
        ),
    )

    op.add_column(
        "kg_relationships",
        sa.Column(
            "confidence",
            sa.Float(),
            nullable=True,
            server_default="0.0",
            comment="LLM-assessed relationship confidence 0-100",
        ),
    )


def downgrade() -> None:
    """Drop all columns added for LLM KG Builder."""

    # ── kg_relationships: drop in reverse order ──────────────────────────
    op.drop_column("kg_relationships", "confidence")
    op.drop_column("kg_relationships", "corroboration_count")
    op.drop_column("kg_relationships", "temporal_context")
    op.drop_column("kg_relationships", "source_finding_ids")
    op.drop_column("kg_relationships", "evidence_excerpt")

    # ── kg_entities: drop in reverse order ───────────────────────────────
    op.drop_column("kg_entities", "source_finding_ids")
    op.drop_column("kg_entities", "domains")
    op.drop_column("kg_entities", "description_detailed")
    op.drop_column("kg_entities", "description_brief")
    op.drop_column("kg_entities", "aliases")
