"""add_latest_workflow_id_to_cases

Revision ID: b3a1f7c42e90
Revises: 0562cc9e65bd
Create Date: 2026-02-06 12:00:00.000000

NOTE: Adds a nullable UUID column `latest_workflow_id` to the cases table.
This tracks the most recent analysis workflow for frontend status display.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3a1f7c42e90"
down_revision: str | None = "0562cc9e65bd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cases",
        sa.Column("latest_workflow_id", postgresql.UUID(as_uuid=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cases", "latest_workflow_id")
