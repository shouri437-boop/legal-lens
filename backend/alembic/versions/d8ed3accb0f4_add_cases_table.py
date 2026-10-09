"""add cases table

Revision ID: d8ed3accb0f4
Revises:
Create Date: 2026-01-25 00:03:54.424017

NOTE: This migration creates ONLY the cases table.
Better Auth automatically manages its own tables (user, session, account, etc.)
when the frontend initializes. Run the frontend first before this migration.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d8ed3accb0f4"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create cases table and related enums."""
    # Create enum types
    case_status = postgresql.ENUM(
        "DRAFT", "PROCESSING", "READY", "ERROR", name="casestatus", create_type=False
    )
    case_type = postgresql.ENUM(
        "FRAUD",
        "CORPORATE",
        "CIVIL",
        "CRIMINAL",
        "OTHER",
        name="casetype",
        create_type=False,
    )

    # Create enums if they don't exist
    case_status.create(op.get_bind(), checkfirst=True)
    case_type.create(op.get_bind(), checkfirst=True)

    # Create cases table
    # NOTE: This assumes Better Auth has already created the 'user' table.
    # Run frontend first to initialize Better Auth tables before running this migration.
    op.create_table(
        "cases",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", case_type, server_default="OTHER", nullable=False),
        sa.Column("status", case_status, server_default="DRAFT", nullable=False),
        sa.Column("file_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["user.id"], ondelete="CASCADE"),
    )

    # Create indexes
    op.create_index("idx_cases_user_id", "cases", ["user_id"])
    op.create_index(
        "idx_cases_active",
        "cases",
        ["deleted_at"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    """Drop cases table and related enums."""
    op.drop_index("idx_cases_active", table_name="cases")
    op.drop_index("idx_cases_user_id", table_name="cases")
    op.drop_table("cases")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS casestatus")
    op.execute("DROP TYPE IF EXISTS casetype")
