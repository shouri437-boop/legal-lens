# ABOUTME: SQLAlchemy model for case findings stored from domain agent analysis.
# ABOUTME: CaseFinding holds extracted findings with full-text search via tsvector (added in migration).

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CaseFinding(Base):
    """
    A discrete analytical finding produced by a domain agent.

    Findings represent individual observations, conclusions, or assessments
    extracted from case files. Each finding belongs to one agent run and
    carries citation references back to source documents. Full-text search
    is enabled via a PostgreSQL tsvector generated column (added in the
    Alembic migration, not mapped here -- see Pitfall 6 in RESEARCH.md).
    """

    __tablename__ = "case_findings"
    __table_args__ = (
        Index("idx_case_findings_case_id", "case_id"),
        Index("idx_case_findings_workflow", "workflow_id"),
        Index("idx_case_findings_agent", "case_id", "agent_type"),
        # GIN index for full-text search added via raw SQL in migration
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
        comment="Analysis workflow this finding was produced in",
    )
    agent_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Source agent (financial, legal, evidence, strategy)",
    )
    agent_execution_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("agent_executions.id", ondelete="SET NULL"),
        nullable=True,
    )
    file_group_label: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Group label for multi-file agent runs",
    )
    category: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Finding category (e.g. 'suspicious_transaction', 'contract_clause')",
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    finding_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Full finding description with analysis",
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    citations: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="List of citation dicts [{file_id, locator, excerpt}]",
    )
    entity_ids: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="IDs of kg_entities linked to this finding",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    # Relationships
    case = relationship("Case")
    agent_execution = relationship("AgentExecution")
