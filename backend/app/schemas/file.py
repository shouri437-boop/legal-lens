# ABOUTME: Pydantic schemas for file upload and management API operations.
# ABOUTME: Defines request/response models for uploading, listing, and downloading case files.

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.file import FileCategory, FileStatus


class FileCreate(BaseModel):
    """Optional metadata provided during file upload.

    The actual file is sent as multipart form data; this schema captures
    optional metadata fields that can accompany the upload.
    """

    description: str | None = Field(
        default=None,
        max_length=2000,
        description="Optional description of the file",
    )
    latitude: float | None = Field(
        default=None,
        ge=-90,
        le=90,
        description="Latitude for geolocation (mobile uploads)",
    )
    longitude: float | None = Field(
        default=None,
        ge=-180,
        le=180,
        description="Longitude for geolocation (mobile uploads)",
    )


class FileResponse(BaseModel):
    """Response model for a single file."""

    id: UUID = Field(..., description="Unique identifier for the file")
    case_id: UUID = Field(..., description="ID of the case this file belongs to")
    name: str = Field(..., description="Display name (original filename)")
    original_filename: str = Field(..., description="Original filename as uploaded")
    storage_path: str = Field(..., description="GCS storage path")
    mime_type: str = Field(..., description="MIME type of the file")
    size_bytes: int = Field(..., description="File size in bytes")
    category: FileCategory = Field(
        ..., description="File category (DOCUMENT, IMAGE, etc.)"
    )
    status: FileStatus = Field(..., description="Processing status")
    content_hash: str = Field(..., description="SHA-256 hash of file content")
    description: str | None = Field(None, description="Optional file description")
    error_message: str | None = Field(
        None, description="Error message if status is ERROR"
    )
    page_count: int | None = Field(None, description="Page count for documents")
    duration_seconds: int | None = Field(
        None, description="Duration for audio/video files"
    )
    latitude: float | None = Field(None, description="Latitude if geolocation provided")
    longitude: float | None = Field(
        None, description="Longitude if geolocation provided"
    )
    created_at: datetime = Field(..., description="When the file was uploaded")
    updated_at: datetime = Field(..., description="When the file was last updated")
    duplicate_of: UUID | None = Field(
        default=None,
        description="ID of existing file if this is a duplicate (same content hash)",
    )

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_with_name(
        cls, obj: object, duplicate_of: UUID | None = None
    ) -> "FileResponse":
        """Create FileResponse from ORM object, mapping original_filename to name.

        Args:
            obj: ORM object with file attributes
            duplicate_of: Explicit duplicate_of value, or None to read from ORM object
        """
        # Use explicit duplicate_of if provided, otherwise read from ORM object
        resolved_duplicate_of = duplicate_of
        if resolved_duplicate_of is None:
            resolved_duplicate_of = getattr(obj, "duplicate_of", None)

        data = {
            "id": obj.id,  # type: ignore[attr-defined]
            "case_id": obj.case_id,  # type: ignore[attr-defined]
            "name": obj.original_filename,  # type: ignore[attr-defined]
            "original_filename": obj.original_filename,  # type: ignore[attr-defined]
            "storage_path": obj.storage_path,  # type: ignore[attr-defined]
            "mime_type": obj.mime_type,  # type: ignore[attr-defined]
            "size_bytes": obj.size_bytes,  # type: ignore[attr-defined]
            "category": obj.category,  # type: ignore[attr-defined]
            "status": obj.status,  # type: ignore[attr-defined]
            "content_hash": obj.content_hash,  # type: ignore[attr-defined]
            "description": obj.description,  # type: ignore[attr-defined]
            "error_message": obj.error_message,  # type: ignore[attr-defined]
            "page_count": obj.page_count,  # type: ignore[attr-defined]
            "duration_seconds": obj.duration_seconds,  # type: ignore[attr-defined]
            "latitude": obj.latitude,  # type: ignore[attr-defined]
            "longitude": obj.longitude,  # type: ignore[attr-defined]
            "created_at": obj.created_at,  # type: ignore[attr-defined]
            "updated_at": obj.updated_at,  # type: ignore[attr-defined]
            "duplicate_of": resolved_duplicate_of,
        }
        return cls(**data)


class FileListResponse(BaseModel):
    """Response model for listing files with pagination."""

    files: list[FileResponse] = Field(..., description="List of files")
    total: int = Field(..., description="Total number of files in the case")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Number of files per page")


class FileStatusUpdate(BaseModel):
    """Schema for SSE events when file status changes."""

    file_id: UUID = Field(..., description="ID of the file")
    status: FileStatus = Field(..., description="New status of the file")
    error_message: str | None = Field(
        default=None,
        description="Error message if status is ERROR",
    )


class DownloadUrlResponse(BaseModel):
    """Response containing a signed download URL."""

    download_url: str = Field(..., description="Signed URL for downloading the file")
    expires_in: int = Field(..., description="Seconds until the URL expires")


class BulkDeleteRequest(BaseModel):
    """Request model for bulk file deletion."""

    file_ids: list[UUID] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of file IDs to delete (max 100)",
    )


class BulkDeleteResponse(BaseModel):
    """Response model for bulk file deletion."""

    deleted_count: int = Field(..., description="Number of files successfully deleted")
    failed_ids: list[UUID] = Field(
        default_factory=list,
        description="IDs of files that failed to delete",
    )
