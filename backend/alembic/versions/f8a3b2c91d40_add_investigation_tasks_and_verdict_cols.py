"""add_investigation_tasks_and_verdict_cols

Revision ID: f8a3b2c91d40
Revises: e4b2c1a37f90
Create Date: 2026-02-08 23:00:00.000000

NOTE: Creates the investigation_tasks table for synthesis-generated tasks
and adds verdict_label + verdict_summary columns to the cases table.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f8a3b2c91d40"
down_revision: str | None = "e4b2c1a37f90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # -- investigation_tasks table --
    op.create_table(
        "investigation_tasks",
        sa.Column(
            "id",
            PG_UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "case_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("cases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("workflow_id", PG_UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("task_type", sa.String(50), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "source_hypothesis_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("case_hypotheses.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "source_contradiction_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("case_contradictions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "source_gap_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("case_gaps.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "idx_investigation_tasks_case_id",
        "investigation_tasks",
        ["case_id"],
    )

    # -- verdict columns on cases table --
    op.add_column("cases", sa.Column("verdict_label", sa.String(30), nullable=True))
    op.add_column("cases", sa.Column("verdict_summary", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("cases", "verdict_summary")
    op.drop_column("cases", "verdict_label")
    op.drop_index("idx_investigation_tasks_case_id")
    op.drop_table("investigation_tasks")
