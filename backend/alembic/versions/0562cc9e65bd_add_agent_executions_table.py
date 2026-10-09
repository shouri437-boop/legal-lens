"""add_agent_executions_table

Revision ID: 0562cc9e65bd
Revises: a7c2f9e83d12
Create Date: 2026-02-03 05:35:00.000000

NOTE: This migration creates the agent_executions table for tracking agent
execution audit trails. Each row records one ADK agent invocation with inputs,
outputs, token usage, timing, and parent-child relationships.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0562cc9e65bd"
down_revision: str | Sequence[str] | None = "a7c2f9e83d12"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create agent_executions table with enum, indexes, and constraints."""
    # Create enum type
    agent_execution_status = postgresql.ENUM(
        "PENDING",
        "RUNNING",
        "COMPLETED",
        "FAILED",
        "RETRYING",
        name="agentexecutionstatus",
        create_type=False,
    )
    agent_execution_status.create(op.get_bind(), checkfirst=True)

    # Create agent_executions table
    op.create_table(
        "agent_executions",
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
            comment="Groups executions belonging to the same analysis run",
        ),
        sa.Column(
            "agent_name",
            sa.String(100),
            nullable=False,
            comment="Logical agent name, e.g. 'triage', 'orchestrator'",
        ),
        sa.Column(
            "agent_type",
            sa.String(50),
            nullable=False,
            comment="ADK agent class, e.g. 'LlmAgent', 'ParallelAgent'",
        ),
        sa.Column(
            "model_name",
            sa.String(100),
            nullable=False,
            comment="Gemini model ID used for this execution",
        ),
        sa.Column(
            "status",
            agent_execution_status,
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column(
            "parent_execution_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
            comment="Parent execution for sub-agent tracking",
        ),
        sa.Column(
            "input_data",
            postgresql.JSONB(),
            nullable=False,
            comment="Agent input context (file refs, instructions, etc.)",
        ),
        sa.Column(
            "output_data",
            postgresql.JSONB(),
            nullable=True,
            comment="Structured agent output (parsed result)",
        ),
        sa.Column(
            "thinking_traces",
            postgresql.JSONB(),
            nullable=True,
            comment="Captured thinking/reasoning traces from the model",
        ),
        sa.Column(
            "tools_called",
            postgresql.JSONB(),
            nullable=True,
            comment="Tool invocation log [{name, args, result}]",
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["case_id"], ["cases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["parent_execution_id"],
            ["agent_executions.id"],
            ondelete="SET NULL",
        ),
    )

    # Create indexes
    op.create_index(
        "idx_agent_executions_case_id",
        "agent_executions",
        ["case_id"],
    )
    op.create_index(
        "idx_agent_executions_workflow_id",
        "agent_executions",
        ["workflow_id"],
    )
    op.create_index(
        "idx_agent_executions_parent",
        "agent_executions",
        ["parent_execution_id"],
    )


def downgrade() -> None:
    """Drop agent_executions table and related enum."""
    op.drop_index("idx_agent_executions_parent", table_name="agent_executions")
    op.drop_index("idx_agent_executions_workflow_id", table_name="agent_executions")
    op.drop_index("idx_agent_executions_case_id", table_name="agent_executions")
    op.drop_table("agent_executions")

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS agentexecutionstatus")
