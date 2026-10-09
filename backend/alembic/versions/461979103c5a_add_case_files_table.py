"""add_case_files_table

Revision ID: 461979103c5a
Revises: d8ed3accb0f4
Create Date: 2026-02-02 06:16:27.510941

NOTE: This migration creates the case_files table for storing evidence file metadata.
Files are stored in GCS; this table tracks metadata, status, and relationships to cases.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "461979103c5a"
down_revision: str | Sequence[str] | None = "d8ed3accb0f4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create case_files table and related enums."""
    # Create enum types
    file_status = postgresql.ENUM(
        "UPLOADING",
        "UPLOADED",
        "QUEUED",
        "PROCESSING",
        "ANALYZED",
        "ERROR",
        name="filestatus",
        create_type=False,
    )
    file_category = postgresql.ENUM(
        "DOCUMENT",
        "IMAGE",
        "VIDEO",
        "AUDIO",
        name="filecategory",
        create_type=False,
    )

    # Create enums if they don't exist
    file_status.create(op.get_bind(), checkfirst=True)
    file_category.create(op.get_bind(), checkfirst=True)

    # Create case_files table
    op.create_table(
        "case_files",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("category", file_category, nullable=False),
        sa.Column("status", file_status, server_default="UPLOADED", nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
    )

    # Create indexes
    op.create_index("idx_case_files_case_id", "case_files", ["case_id"])
    op.create_index(
        "idx_case_files_duplicate_check", "case_files", ["case_id", "content_hash"]
    )


def downgrade() -> None:
    """Drop case_files table and related enums."""
    op.drop_index("idx_case_files_duplicate_check", table_name="case_files")
    op.drop_index("idx_case_files_case_id", table_name="case_files")
    op.drop_table("case_files")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS filestatus")
    op.execute("DROP TYPE IF EXISTS filecategory")
