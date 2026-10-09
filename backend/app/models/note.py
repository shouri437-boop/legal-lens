# ABOUTME: SQLAlchemy model for case notes (Legal Lens's Diary).
# ABOUTME: Tracks text and audio notes with AI-generated titles/subtitles and export status.

import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class NoteType(enum.Enum):
    """Type of note - text or audio."""

    TEXT = "TEXT"
    AUDIO = "AUDIO"


class CaseNote(Base):
    """
    Note belonging to an investigation case (Legal Lens's Diary).

    Notes can be text or audio, with AI-generated titles and subtitles.
    Notes can be exported as evidence to the case's file library.
    """

    __tablename__ = "case_notes"
    __table_args__ = (
        Index("idx_case_notes_case_id", "case_id"),
        Index("idx_case_notes_user_id", "user_id"),
        Index("idx_case_notes_created_at", "created_at"),
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
    user_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    type: Mapped[NoteType] = mapped_column(
        Enum(NoteType, name="notetype"),
        nullable=False,
    )
    # For text notes
    content: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    # For audio notes
    audio_storage_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    audio_duration_seconds: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    audio_mime_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    # AI-generated metadata
    title: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    subtitle: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    # Export status
    is_exported: Mapped[bool] = mapped_column(
        Boolean,
        server_default="false",
        nullable=False,
    )
    exported_file_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("case_files.id", ondelete="SET NULL"),
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
        nullable=False,
    )

    # Relationships
    case = relationship("Case", back_populates="notes")
    exported_file = relationship("CaseFile", foreign_keys=[exported_file_id])
