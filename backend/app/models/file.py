# ABOUTME: SQLAlchemy model for case files (evidence files).
# ABOUTME: Tracks file metadata, storage location, processing status, and relationships to cases.

import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    Float,
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


class FileStatus(enum.Enum):
    """Processing status of a file in the ingestion pipeline."""

    UPLOADING = "UPLOADING"
    UPLOADED = "UPLOADED"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    ANALYZED = "ANALYZED"
    ERROR = "ERROR"


class FileCategory(enum.Enum):
    """Category of file auto-detected from MIME type."""

    DOCUMENT = "DOCUMENT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"


class CaseFile(Base):
    """
    Evidence file belonging to an investigation case.

    Files are stored in GCS with metadata in PostgreSQL.
    Processing status tracks the file through the agent analysis pipeline.
    """

    __tablename__ = "case_files"
    __table_args__ = (
        Index("idx_case_files_case_id", "case_id"),
        Index("idx_case_files_duplicate_check", "case_id", "content_hash"),
        Index("idx_case_files_duplicate_of", "duplicate_of"),
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
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    category: Mapped[FileCategory] = mapped_column(
        Enum(FileCategory, name="filecategory"),
        nullable=False,
    )
    status: Mapped[FileStatus] = mapped_column(
        Enum(FileStatus, name="filestatus"),
        server_default="UPLOADED",
        nullable=False,
    )
    content_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    page_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    duration_seconds: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    longitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    duplicate_of: Mapped[UUID | None] = mapped_column(
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
        onupdate=text("now()"),
        nullable=False,
    )

    # Relationship to Case
    case = relationship("Case", back_populates="files")
