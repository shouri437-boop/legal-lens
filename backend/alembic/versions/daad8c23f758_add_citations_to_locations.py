"""add_citations_to_locations

Revision ID: daad8c23f758
Revises: 475d688d81ea
Create Date: 2026-02-09 12:58:17.411761

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "daad8c23f758"
down_revision: str | Sequence[str] | None = "475d688d81ea"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add citations JSONB column to locations table."""
    op.add_column(
        "locations",
        sa.Column(
            "citations",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Source citations [{file_id, locator, excerpt}]",
        ),
    )


def downgrade() -> None:
    """Remove citations column from locations table."""
    op.drop_column("locations", "citations")
