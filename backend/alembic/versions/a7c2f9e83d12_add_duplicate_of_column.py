"""add_duplicate_of_column

Revision ID: a7c2f9e83d12
Revises: 461979103c5a
Create Date: 2026-02-02 10:00:00.000000

NOTE: Adds duplicate_of column to case_files table for tracking duplicate uploads.
When a file with the same content hash is uploaded to the same case, duplicate_of
references the original file's ID.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c2f9e83d12"
down_revision: str | Sequence[str] | None = "461979103c5a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add duplicate_of column to case_files table."""
    op.add_column(
        "case_files",
        sa.Column(
            "duplicate_of",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("case_files.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "idx_case_files_duplicate_of",
        "case_files",
        ["duplicate_of"],
    )


def downgrade() -> None:
    """Remove duplicate_of column from case_files table."""
    op.drop_index("idx_case_files_duplicate_of", table_name="case_files")
    op.drop_column("case_files", "duplicate_of")
