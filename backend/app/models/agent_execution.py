# ABOUTME: SQLAlchemy model for agent execution audit trail.
# ABOUTME: Tracks every agent run with inputs, outputs, timing, token usage, and parent-child relationships.

import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AgentExecutionStatus(enum.Enum):
    """Lifecycle status of an agent execution."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"


class AgentExecution(Base):
    """
    Audit record for a single agent execution within a case analysis workflow.

    Each row represents one invocation of an ADK agent (triage, orchestrator,
    domain specialist, etc.). Parent-child relationships track sub-agent
    delegation. JSONB columns store flexible input/output data and diagnostic
    traces.
    """

    __tablename__ = "agent_executions"
    __table_args__ = (
        Index("idx_agent_executions_case_id", "case_id"),
        Index("idx_agent_executions_workflow_id", "workflow_id"),
        Index("idx_agent_executions_parent", "parent_execution_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    case_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    workflow_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=False,
        comment="Groups executions belonging to the same analysis run",
    )
    agent_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Logical agent name, e.g. 'triage', 'orchestrator'",
    )
    agent_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="ADK agent class, e.g. 'LlmAgent', 'ParallelAgent'",
    )
    model_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Gemini model ID used for this execution",
    )
    status: Mapped[AgentExecutionStatus] = mapped_column(
        Enum(AgentExecutionStatus, name="agentexecutionstatus"),
        server_default="PENDING",
        nullable=False,
    )
    parent_execution_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("agent_executions.id", ondelete="SET NULL"),
        nullable=True,
        comment="Parent execution for sub-agent tracking",
    )
    input_data: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        comment="Agent input context (file refs, instructions, etc.)",
    )
    output_data: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Structured agent output (parsed result)",
    )
    thinking_traces: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Captured thinking/reasoning traces from the model",
    )
    tools_called: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Tool invocation log [{name, args, result}]",
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    input_tokens: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    output_tokens: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        onupdate=text("now()"),
        nullable=False,
    )

    # Relationships
    case = relationship("Case", back_populates="agent_executions")
    parent_execution = relationship(
        "AgentExecution",
        remote_side="AgentExecution.id",
        back_populates="child_executions",
    )
    child_executions = relationship(
        "AgentExecution",
        back_populates="parent_execution",
    )
