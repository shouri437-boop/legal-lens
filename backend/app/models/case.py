# ABOUTME: SQLAlchemy model for investigation cases.
# ABOUTME: Cases belong to users and track investigation status and metadata.

import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CaseStatus(enum.Enum):
    """Status of a case in the investigation workflow."""

    DRAFT = "DRAFT"
    PROCESSING = "PROCESSING"
    READY = "READY"
    ERROR = "ERROR"


class CaseType(enum.Enum):
    """Type of investigation case."""

    FRAUD = "FRAUD"
    CORPORATE = "CORPORATE"
    CIVIL = "CIVIL"
    CRIMINAL = "CRIMINAL"
    OTHER = "OTHER"


class Case(Base):
    """
    Investigation case belonging to a user.

    Cases contain uploaded files and are processed by the agent pipeline.
    """

    __tablename__ = "cases"
    __table_args__ = (
        Index("idx_cases_user_id", "user_id"),
        Index(
            "idx_cases_active",
            "deleted_at",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[CaseType] = mapped_column(
        Enum(CaseType, name="casetype"),
        server_default="OTHER",
        nullable=False,
    )
    status: Mapped[CaseStatus] = mapped_column(
        Enum(CaseStatus, name="casestatus"),
        server_default="DRAFT",
        nullable=False,
    )
    file_count: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False,
    )
    latest_workflow_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
    )
    verdict_label: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        comment="Conclusive/Substantial/Inconclusive",
    )
    verdict_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="One-line case summary from synthesis",
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
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationship to User (no backref since User is read-only)
    user = relationship("User", back_populates=None)

    # Relationship to CaseFiles
    files = relationship(
        "CaseFile", back_populates="case", cascade="all, delete-orphan"
    )

    # Relationship to AgentExecutions
    agent_executions = relationship(
        "AgentExecution", back_populates="case", cascade="all, delete-orphan"
    )

    # Relationship to CaseNotes (Legal Lens's Diary)
    notes = relationship(
        "CaseNote", back_populates="case", cascade="all, delete-orphan"
    )
