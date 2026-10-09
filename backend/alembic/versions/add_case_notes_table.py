# ABOUTME: Database migration to add case_notes table for Legal Lens's Diary feature.
# ABOUTME: Stores text and audio notes with AI-generated metadata.

"""Add case_notes table for Legal Lens's Diary

Revision ID: add_case_notes_001
Revises: e4b2c1a37f90
Create Date: 2026-02-09

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_case_notes_001"
down_revision: str | None = "e4b2c1a37f90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create enum for note type
    note_type_enum = postgresql.ENUM(
        "TEXT", "AUDIO", name="notetype", create_type=False
    )
    note_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "case_notes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "case_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column(
            "type",
            postgresql.ENUM("TEXT", "AUDIO", name="notetype", create_type=False),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=True),  # For text notes
        sa.Column(
            "audio_storage_path", sa.String(500), nullable=True
        ),  # For audio notes
        sa.Column("audio_duration_seconds", sa.Integer(), nullable=True),
        sa.Column("audio_mime_type", sa.String(100), nullable=True),
        sa.Column("title", sa.String(255), nullable=True),  # AI-generated
        sa.Column("subtitle", sa.Text(), nullable=True),  # AI-generated
        sa.Column("is_exported", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "exported_file_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("case_files.id", ondelete="SET NULL"),
            nullable=True,
        ),
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
    )

    # Create indexes for efficient querying
    op.create_index("idx_case_notes_case_id", "case_notes", ["case_id"])
    op.create_index("idx_case_notes_user_id", "case_notes", ["user_id"])
    op.create_index("idx_case_notes_created_at", "case_notes", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_case_notes_created_at")
    op.drop_index("idx_case_notes_user_id")
    op.drop_index("idx_case_notes_case_id")
    op.drop_table("case_notes")

    # Drop the enum type
    note_type_enum = postgresql.ENUM("TEXT", "AUDIO", name="notetype")
    note_type_enum.drop(op.get_bind(), checkfirst=True)
