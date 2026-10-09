"""merge_case_notes_and_verdict_branches

Revision ID: 475d688d81ea
Revises: add_case_notes_001, f8a3b2c91d40
Create Date: 2026-02-09 11:55:53.155892

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "475d688d81ea"
down_revision: str | Sequence[str] | None = ("add_case_notes_001", "f8a3b2c91d40")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
