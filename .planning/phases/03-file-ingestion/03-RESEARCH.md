# Phase 3: File Ingestion - Research

**Researched:** 2026-02-02
**Domain:** FastAPI file upload, GCS storage, SSE real-time updates
**Confidence:** HIGH

## Summary

This phase implements backend APIs for file upload, storage, and management to integrate with the existing frontend `CaseLibrary.tsx` component. The backend structure is well-established with FastAPI, SQLAlchemy async, Alembic migrations, and GCS integration already configured.

Key findings:
- The existing backend has a solid foundation with async database, GCS client, SSE infrastructure, and JWT auth
- A new `CaseFile` model and migration are needed to track files
- FastAPI's `UploadFile` with chunked streaming to GCS is the right pattern for 500MB files
- GCS signed URLs (V4) can be generated for downloads with 24-hour expiration
- SSE events can be published using the existing `sse-starlette` pattern

**Primary recommendation:** Build on the existing patterns - add `CaseFile` model, create files router under `/api/cases/{case_id}/files`, stream uploads to GCS in chunks, and extend SSE for file status events.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 | API framework | Already used, excellent file upload support |
| SQLAlchemy | >=2.0.36 | ORM | Already used for Case model |
| google-cloud-storage | >=2.19.0 | GCS client | Already configured in `storage.py` |
| sse-starlette | >=2.2.0 | SSE streaming | Already used for heartbeat |
| pydantic | >=2.10.0 | Request/response validation | Already used |

### Supporting (Need to Add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-multipart | latest | Multipart form parsing | Required for UploadFile |
| aiofiles | >=24.1.0 | Async file I/O | For chunked streaming to temp file before GCS |

**Note:** `python-multipart` may already be installed as a FastAPI dependency but should be explicitly listed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct upload to backend | Signed URL upload | More complex but better for mobile; DEFER for now per CONTEXT.md |
| UploadFile streaming | Bytes parameter | Memory issues with large files - never use bytes for 500MB |

**Installation:**
```bash
cd backend
uv add python-multipart aiofiles
```

## Architecture Patterns

### Recommended Project Structure

The existing backend structure should be extended:
```
backend/app/
├── api/
│   ├── cases.py          # Existing
│   ├── files.py          # NEW: File CRUD endpoints
│   └── sse.py            # Extend for file events
├── models/
│   ├── case.py           # Existing
│   └── file.py           # NEW: CaseFile model
├── schemas/
│   ├── case.py           # Existing
│   └── file.py           # NEW: File schemas
├── services/
│   └── storage.py        # NEW: GCS upload/download logic
└── storage.py            # Existing GCS bucket helpers
```

### Pattern 1: Chunked File Upload to GCS

**What:** Stream file uploads in chunks to avoid memory issues
**When to use:** Any file > 10MB (always for 500MB max)
**Example:**
```python
# Source: FastAPI docs + GCS best practices
from fastapi import UploadFile
from google.cloud import storage

CHUNK_SIZE = 8 * 1024 * 1024  # 8MB chunks

async def upload_to_gcs(
    file: UploadFile,
    bucket: storage.Bucket,
    blob_name: str,
) -> int:
    """Stream upload file to GCS, return total bytes written."""
    blob = bucket.blob(blob_name)
    total_bytes = 0

    # Use resumable upload for large files
    with blob.open("wb", content_type=file.content_type) as gcs_file:
        while chunk := await file.read(CHUNK_SIZE):
            gcs_file.write(chunk)
            total_bytes += len(chunk)

    return total_bytes
```

### Pattern 2: Signed URL Generation for Downloads

**What:** Generate time-limited signed URLs for file access
**When to use:** All file downloads (24h expiration per CONTEXT.md)
**Example:**
```python
# Source: https://docs.cloud.google.com/storage/docs/samples/storage-generate-signed-url-v4
import datetime
from google.cloud import storage

def generate_download_url(
    bucket: storage.Bucket,
    blob_name: str,
    expiration_hours: int = 24,
) -> str:
    """Generate V4 signed URL for downloading a file."""
    blob = bucket.blob(blob_name)

    url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(hours=expiration_hours),
        method="GET",
    )
    return url
```

### Pattern 3: Content Hash for Duplicate Detection

**What:** Compute SHA-256 hash while streaming to detect duplicates
**When to use:** Every upload, before storing in GCS
**Example:**
```python
import hashlib

async def compute_hash_while_uploading(file: UploadFile) -> tuple[bytes, str]:
    """Read file, compute SHA-256 hash, return content and hash."""
    hasher = hashlib.sha256()
    chunks = []

    while chunk := await file.read(CHUNK_SIZE):
        hasher.update(chunk)
        chunks.append(chunk)

    content_hash = hasher.hexdigest()
    content = b"".join(chunks)
    return content, content_hash
```

### Pattern 4: SSE Event Publishing

**What:** Publish file status updates to connected clients
**When to use:** File upload complete, processing status change, errors
**Example:**
```python
# Source: Existing sse.py pattern
from sse_starlette import EventSourceResponse
import asyncio
from collections import defaultdict

# Simple in-memory pubsub (upgrade to Redis for production scale)
_file_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)

async def publish_file_event(case_id: str, event_type: str, data: dict):
    """Publish file event to all subscribers for a case."""
    event = {"event": event_type, "data": json.dumps(data)}
    for queue in _file_subscribers.get(case_id, []):
        await queue.put(event)
```

### Anti-Patterns to Avoid
- **Loading entire file into memory:** Never use `file: bytes = File()` for large files. Always use `UploadFile` with streaming.
- **Sync file I/O in async endpoints:** Use `aiofiles` or run_in_executor for disk I/O.
- **Storing files on disk:** Files must go to GCS, not local filesystem (ephemeral on Cloud Run).
- **Hard-coding bucket names:** Always use `settings.gcs_bucket` from config.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MIME type detection | Custom extension mapping | `python-magic` or `file.content_type` | Edge cases, security |
| Signed URLs | Manual URL signing | `blob.generate_signed_url()` | Crypto complexity |
| Chunked uploads | Manual chunk management | `blob.open("wb")` context manager | GCS handles resumable uploads |
| File type validation | Regex on filename | Whitelist of MIME types | Security (can't trust extensions) |

**Key insight:** GCS client library handles resumable uploads, retries, and chunk management internally. Don't reinvent this.

## Common Pitfalls

### Pitfall 1: Memory Exhaustion on Large Uploads
**What goes wrong:** Using `await file.read()` without size parameter loads entire file into memory
**Why it happens:** FastAPI examples often show simple `contents = await file.read()` pattern
**How to avoid:** Always read in chunks with `while chunk := await file.read(CHUNK_SIZE)`
**Warning signs:** 500MB upload causes server OOM or massive memory spike

### Pitfall 2: Signed URL Expiration Mismatch
**What goes wrong:** Frontend caches signed URL but it expires before use
**Why it happens:** Generated on page load but user doesn't download immediately
**How to avoid:** Generate fresh signed URL on each download request; 24h is safe
**Warning signs:** 403 Forbidden on download after some time

### Pitfall 3: Missing Content-Type on GCS Upload
**What goes wrong:** Files stored without MIME type, downloads fail or render incorrectly
**Why it happens:** Not passing `content_type` when creating blob
**How to avoid:** Always set `content_type=file.content_type` during upload
**Warning signs:** PDFs download as binary, images don't render

### Pitfall 4: Race Condition on File Count
**What goes wrong:** `case.file_count` becomes inconsistent with actual file count
**Why it happens:** Concurrent uploads/deletes without proper locking
**How to avoid:** Use database transactions; consider computing count from query instead
**Warning signs:** File count shows wrong number after bulk operations

### Pitfall 5: Orphaned GCS Blobs
**What goes wrong:** Files exist in GCS but not in database (or vice versa)
**Why it happens:** Upload succeeds but DB insert fails; delete from DB succeeds but GCS delete fails
**How to avoid:** Database transaction wraps GCS operation; consider background cleanup job
**Warning signs:** Storage costs grow while reported usage stays flat

## Code Examples

### File Model (SQLAlchemy)
```python
# Source: Following existing Case model pattern from app/models/case.py
import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, BigInteger, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class FileStatus(enum.Enum):
    """Status of a file in the processing pipeline."""
    UPLOADING = "UPLOADING"
    UPLOADED = "UPLOADED"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    ANALYZED = "ANALYZED"
    ERROR = "ERROR"


class FileCategory(enum.Enum):
    """Category of file based on MIME type."""
    DOCUMENT = "DOCUMENT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"


class CaseFile(Base):
    """Evidence file uploaded to a case."""

    __tablename__ = "case_files"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    case_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)  # GCS path
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    category: Mapped[FileCategory] = mapped_column(
        Enum(FileCategory, name="filecategory"),
        nullable=False,
    )
    status: Mapped[FileStatus] = mapped_column(
        Enum(FileStatus, name="filestatus"),
        server_default="UPLOADED",
        nullable=False,
    )
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Metadata fields
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)  # For docs
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)  # For media

    # Geolocation (optional, for mobile uploads)
    latitude: Mapped[float | None] = mapped_column(nullable=True)
    longitude: Mapped[float | None] = mapped_column(nullable=True)

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

    # Relationship
    case = relationship("Case", back_populates="files")
```

### File Upload Endpoint
```python
# Source: FastAPI file upload docs + project patterns
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from uuid import UUID, uuid4
import hashlib

router = APIRouter(prefix="/api/cases/{case_id}/files", tags=["files"])

ALLOWED_MIME_TYPES = {
    # Documents
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    # Images
    "image/jpeg", "image/png", "image/gif", "image/webp",
    # Video
    "video/mp4", "video/quicktime", "video/webm",
    # Audio
    "audio/mpeg", "audio/wav", "audio/x-m4a",
}

MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_file(
    case_id: UUID,
    file: UploadFile,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    description: str | None = None,
):
    """Upload a file to a case."""
    # Validate case ownership
    case = await get_user_case(db, case_id, current_user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Validate MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file.content_type} not allowed",
        )

    # Generate storage path
    file_uuid = uuid4()
    ext = Path(file.filename or "").suffix or ""
    storage_path = f"cases/{case_id}/files/{file_uuid}{ext}"

    # Stream to GCS while computing hash
    bucket = get_bucket()
    blob = bucket.blob(storage_path)

    hasher = hashlib.sha256()
    total_bytes = 0

    with blob.open("wb", content_type=file.content_type) as gcs_file:
        while chunk := await file.read(8 * 1024 * 1024):  # 8MB chunks
            if total_bytes + len(chunk) > MAX_FILE_SIZE:
                # Clean up partial upload
                blob.delete()
                raise HTTPException(status_code=400, detail="File too large (max 500MB)")
            hasher.update(chunk)
            gcs_file.write(chunk)
            total_bytes += len(chunk)

    content_hash = hasher.hexdigest()

    # Check for duplicates
    existing = await db.execute(
        select(CaseFile).where(
            CaseFile.case_id == case_id,
            CaseFile.content_hash == content_hash,
        )
    )
    duplicate = existing.scalar_one_or_none()

    # Create database record
    category = detect_category(file.content_type)
    case_file = CaseFile(
        case_id=case_id,
        original_filename=file.filename or "unnamed",
        storage_path=storage_path,
        mime_type=file.content_type,
        size_bytes=total_bytes,
        category=category,
        status=FileStatus.UPLOADED,
        content_hash=content_hash,
        description=description,
    )

    db.add(case_file)
    case.file_count += 1
    await db.commit()
    await db.refresh(case_file)

    # Publish SSE event
    await publish_file_event(str(case_id), "file-uploaded", {
        "file_id": str(case_file.id),
        "filename": case_file.original_filename,
        "status": case_file.status.value,
        "duplicate_of": str(duplicate.id) if duplicate else None,
    })

    return case_file
```

### Download Signed URL Endpoint
```python
@router.get("/{file_id}/download")
async def get_download_url(
    case_id: UUID,
    file_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Get a signed URL to download a file."""
    # Validate case ownership and file existence
    case_file = await get_user_file(db, case_id, file_id, current_user.id)
    if not case_file:
        raise HTTPException(status_code=404, detail="File not found")

    bucket = get_bucket()
    blob = bucket.blob(case_file.storage_path)

    url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.timedelta(hours=24),
        method="GET",
        response_disposition=f'attachment; filename="{case_file.original_filename}"',
    )

    return {"download_url": url, "expires_in": 86400}  # 24 hours in seconds
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GCS V2 signing | V4 signing | 2019+ | Simpler, more secure |
| `File(bytes)` | `UploadFile` streaming | Always | Memory safety for large files |
| Sync `google-cloud-storage` | Async patterns with `blob.open()` | 2023+ | Better performance in async apps |

**Deprecated/outdated:**
- `google.cloud.storage.blob.Blob.upload_from_string()` for large files: Use `blob.open("wb")` instead
- V2 signed URLs: V4 is now standard

## Open Questions

Things that couldn't be fully resolved:

1. **Signed URL in Cloud Run without service account key**
   - What we know: GCS requires service account credentials for signing
   - What's unclear: Cloud Run's default SA may work with impersonation
   - Recommendation: Test with Cloud Run; may need explicit SA key file or IAM impersonation setup

2. **SSE scaling beyond single instance**
   - What we know: In-memory pubsub only works on single instance
   - What's unclear: Whether Cloud Run will scale to multiple instances
   - Recommendation: Use simple in-memory for now; upgrade to Redis if needed

3. **Large file upload timeout on Cloud Run**
   - What we know: Cloud Run has request timeout limits
   - What's unclear: Exact timeout for 500MB upload
   - Recommendation: Monitor upload times; may need to increase timeout config

## API Contract (Frontend Expectations)

Based on `CaseLibrary.tsx`, the frontend expects:

### File List Response
```typescript
interface LibraryFile {
  id: string;
  name: string;           // original_filename
  type: "pdf" | "video" | "audio" | "image";  // derived from category
  size: number;           // size_bytes
  url: string;            // signed download URL
  category: FileCategory; // "evidence" | "legal" | etc. (user-assigned)
  status: FileStatus;     // "ready" | "processing" | "conflict" | "error"
  processingProgress?: number;  // 0-100 (not implemented per CONTEXT.md)
  conflictInfo?: ConflictInfo;  // for duplicate detection
  uploadedAt: Date;       // created_at
}
```

### Backend to Frontend Status Mapping
| Backend FileStatus | Frontend status |
|-------------------|-----------------|
| UPLOADING | "processing" |
| UPLOADED | "ready" |
| QUEUED | "processing" |
| PROCESSING | "processing" |
| ANALYZED | "ready" |
| ERROR | "error" |

### SSE Events Expected
```typescript
// Event types the frontend should listen for
"file-uploaded"     // New file added
"file-status"       // Status change
"file-deleted"      // File removed
"file-error"        // Processing error
```

## Sources

### Primary (HIGH confidence)
- FastAPI official docs: File upload patterns, UploadFile class
- GCS official docs: V4 signed URL generation
- Existing codebase: `app/api/cases.py`, `app/models/case.py`, `app/api/sse.py`

### Secondary (MEDIUM confidence)
- [FastAPI file uploads guide](https://fastapi.tiangolo.com/tutorial/request-files/)
- [GCS signed URL V4](https://docs.cloud.google.com/storage/docs/samples/storage-generate-signed-url-v4)
- [GCS PUT signed URL](https://docs.cloud.google.com/storage/docs/samples/storage-generate-upload-signed-url-v4)

### Tertiary (LOW confidence)
- WebSearch results for SSE patterns (verified against sse-starlette docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already in project, well-documented
- Architecture: HIGH - Following existing patterns
- Pitfalls: MEDIUM - Based on common issues in similar projects
- API Contract: HIGH - Based on direct code reading of CaseLibrary.tsx

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable domain)
