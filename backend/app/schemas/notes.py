# ABOUTME: Pydantic schemas for case notes API (Legal Lens's Diary).
# ABOUTME: Defines request/response models for note CRUD and export operations.

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class NoteType(str, Enum):
    """Type of note."""

    TEXT = "TEXT"
    AUDIO = "AUDIO"


class NoteBase(BaseModel):
    """Base schema for note data."""

    type: NoteType
    content: str | None = Field(None, description="Text content for text notes")
    title: str | None = Field(
        None, max_length=255, description="AI-generated or user-provided title"
    )
    subtitle: str | None = Field(None, description="AI-generated summary/subtitle")


class NoteCreate(BaseModel):
    """Schema for creating a new note."""

    type: NoteType
    content: str | None = Field(None, description="Text content for text notes")


class NoteUpdate(BaseModel):
    """Schema for updating an existing note."""

    content: str | None = Field(None, description="Updated text content")
    title: str | None = Field(None, max_length=255, description="Updated title")
    subtitle: str | None = Field(None, description="Updated subtitle")


class NoteMetadata(BaseModel):
    """AI-generated metadata for a note."""

    title: str = Field(..., max_length=255, description="AI-generated title")
    subtitle: str = Field(..., description="AI-generated brief summary")


class NoteResponse(BaseModel):
    """Schema for note response."""

    id: UUID
    case_id: UUID
    user_id: str
    type: NoteType
    content: str | None = None
    audio_storage_path: str | None = None
    audio_duration_seconds: int | None = None
    audio_mime_type: str | None = None
    title: str | None = None
    subtitle: str | None = None
    is_exported: bool = False
    exported_file_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
    }


class NoteListResponse(BaseModel):
    """Schema for listing notes."""

    notes: list[NoteResponse]
    total: int
    page: int
    per_page: int


class NoteExportRequest(BaseModel):
    """Schema for exporting a note as evidence."""

    description: str | None = Field(
        None, description="Optional description for the exported file"
    )


class NoteExportResponse(BaseModel):
    """Schema for export response."""

    note_id: UUID
    file_id: UUID
    file_name: str
    message: str


class AudioUploadResponse(BaseModel):
    """Schema for audio upload response (before note creation)."""

    storage_path: str
    duration_seconds: int | None = None
    mime_type: str
    size_bytes: int


class GenerateMetadataRequest(BaseModel):
    """Schema for generating AI metadata for a note."""

    note_id: UUID


class GenerateMetadataResponse(BaseModel):
    """Schema for generated metadata response."""

    note_id: UUID
    title: str
    subtitle: str
    content: str | None = None


class AudioDownloadResponse(BaseModel):
    """Schema for audio download URL response."""

    download_url: str
    expires_in: int
