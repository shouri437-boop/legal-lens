# ABOUTME: File service for GCS upload/download operations.
# ABOUTME: Handles chunked streaming, content hashing, and file type validation.

import asyncio
import hashlib
import logging
from datetime import timedelta
from typing import Any
from urllib.parse import quote
from uuid import UUID

from fastapi import UploadFile
from google.auth import default, impersonated_credentials
from google.auth.credentials import Credentials
from google.auth.transport import requests as google_auth_requests

# google-cloud-storage doesn't ship type stubs (no py.typed marker)
# See: https://github.com/googleapis/python-storage/issues/393
from google.cloud import storage  # type: ignore[import-untyped,attr-defined]

from app.config import settings
from app.local_storage import (
    delete_local,
    delete_local_prefix,
    local_file_url,
    use_local_storage,
    write_local,
)
from app.models.file import FileCategory
from app.storage import get_bucket

logger = logging.getLogger(__name__)

# Allowed MIME types per CONTEXT.md whitelist
ALLOWED_MIME_TYPES: frozenset[str] = frozenset(
    [
        # Documents
        "application/pdf",
        # Images
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        # Video
        "video/mp4",
        "video/quicktime",
        "video/webm",
        # Audio
        "audio/mpeg",
        "audio/wav",
        "audio/x-m4a",
    ]
)

# Maximum file size: 500MB
MAX_FILE_SIZE: int = 500 * 1024 * 1024

# Chunk size for streaming uploads: 8MB
CHUNK_SIZE: int = 8 * 1024 * 1024


def detect_category(mime_type: str) -> FileCategory:
    """
    Map MIME type to FileCategory enum.

    Args:
        mime_type: The MIME type string (e.g., 'application/pdf')

    Returns:
        FileCategory enum value based on MIME type prefix
    """
    if mime_type.startswith("image/"):
        return FileCategory.IMAGE
    elif mime_type.startswith("video/"):
        return FileCategory.VIDEO
    elif mime_type.startswith("audio/"):
        return FileCategory.AUDIO
    else:
        # Default to DOCUMENT for application/* types
        return FileCategory.DOCUMENT


async def upload_to_gcs(
    file: UploadFile,
    case_id: UUID,
    file_uuid: UUID,
) -> tuple[str, int, str]:
    """
    Stream upload a file to GCS in chunks while computing SHA-256 hash.

    Args:
        file: The FastAPI UploadFile object
        case_id: UUID of the case this file belongs to
        file_uuid: UUID to use for the file in storage

    Returns:
        Tuple of (storage_path, total_bytes, content_hash)

    Raises:
        ValueError: If file exceeds MAX_FILE_SIZE
        Exception: On GCS upload errors
    """
    # Extract extension from original filename
    original_filename = file.filename or "file"
    ext = ""
    if "." in original_filename:
        ext = original_filename.rsplit(".", 1)[1].lower()

    # Construct storage path: cases/{case_id}/files/{file_uuid}.{ext}
    if ext:
        storage_path = f"cases/{case_id}/files/{file_uuid}.{ext}"
    else:
        storage_path = f"cases/{case_id}/files/{file_uuid}"

    # Get GCS bucket and blob (not needed for local storage)
    local = use_local_storage()
    blob = None if local else get_bucket().blob(storage_path)

    # Initialize hash computation
    sha256_hash = hashlib.sha256()
    total_bytes = 0

    # Use resumable upload for large files
    # We'll collect chunks and upload in one go since google-cloud-storage
    # doesn't have async support - we stream read but upload synchronously
    chunks: list[bytes] = []

    try:
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break

            total_bytes += len(chunk)

            # Check size limit during upload
            if total_bytes > MAX_FILE_SIZE:
                # Clean up any partial data
                raise ValueError(
                    f"File exceeds maximum size of {MAX_FILE_SIZE // (1024 * 1024)}MB"
                )

            # Update hash
            sha256_hash.update(chunk)
            chunks.append(chunk)

        # Combine chunks and upload
        file_content = b"".join(chunks)

        # Set content type for proper serving
        content_type = file.content_type or "application/octet-stream"
        if local:
            write_local(storage_path, file_content)
        else:
            assert blob is not None
            blob.upload_from_string(file_content, content_type=content_type)

        # Compute final hash
        content_hash = sha256_hash.hexdigest()

        logger.info(
            "Uploaded file to GCS: path=%s, size=%d, hash=%s",
            storage_path,
            total_bytes,
            content_hash,
        )

        return storage_path, total_bytes, content_hash

    except ValueError:
        # Re-raise size limit errors
        raise
    except Exception as e:
        # Try to clean up partial upload on error
        try:
            if local:
                delete_local(storage_path)
            elif blob is not None and blob.exists():
                blob.delete()
        except Exception:
            pass
        logger.error("GCS upload failed: %s", e)
        raise


async def delete_from_gcs(storage_path: str) -> bool:
    """
    Delete a file from GCS.

    Args:
        storage_path: The GCS path of the file to delete

    Returns:
        True if file was deleted, False if file was not found
    """
    if use_local_storage():
        return delete_local(storage_path)

    try:
        bucket = get_bucket()
        blob = bucket.blob(storage_path)

        if not blob.exists():
            logger.warning("File not found in GCS: %s", storage_path)
            return False

        blob.delete()
        logger.info("Deleted file from GCS: %s", storage_path)
        return True

    except Exception as e:
        logger.error("Failed to delete file from GCS: %s - %s", storage_path, e)
        raise


async def delete_case_storage(case_id: str) -> int:
    """Delete every stored object for a case (uploads, analysis caches, ...).

    Returns the number of files removed.
    """
    prefix = f"cases/{case_id}"
    if use_local_storage():
        return await asyncio.to_thread(delete_local_prefix, prefix)

    def _delete_all() -> int:
        blobs = list(get_bucket().list_blobs(prefix=f"{prefix}/"))
        for blob in blobs:
            blob.delete()
        return len(blobs)

    count = await asyncio.to_thread(_delete_all)
    logger.info("Deleted %d stored files for case %s", count, case_id)
    return count


def _get_signing_credentials() -> tuple[Credentials, str | None]:
    """
    Get credentials that can sign GCS URLs.

    This handles different credential types:
    1. Service account JSON key: Can sign directly
    2. Workload identity (Cloud Run): Has service_account_email, use IAM signing
    3. User credentials (local dev): Impersonate a service account for signing

    Returns:
        Tuple of (credentials, service_account_email)
        - If credentials can sign directly, service_account_email is None
        - If IAM signing needed, service_account_email is the account to sign as
    """
    credentials, _ = default()

    # Case 1: Credentials can sign directly (service account key)
    # Service account credentials don't need refresh for signing - they use the private key
    sign_bytes_method = getattr(credentials, "sign_bytes", None)
    if sign_bytes_method is not None and callable(sign_bytes_method):
        logger.debug("Using direct signing with service account key")
        return credentials, None

    # For other credential types, we need to refresh to get an access token
    auth_request = google_auth_requests.Request()
    credentials.refresh(auth_request)

    # Case 2: Workload identity (compute engine, Cloud Run)
    # These credentials have service_account_email attribute
    service_account_email = getattr(credentials, "service_account_email", None)
    if service_account_email:
        logger.debug(
            "Using IAM signing with workload identity: %s", service_account_email
        )
        return credentials, service_account_email

    # Case 3: User credentials - need to impersonate a service account
    target_sa = settings.gcs_signing_service_account
    if target_sa:
        logger.debug("Impersonating service account for signing: %s", target_sa)
        # Create impersonated credentials
        impersonated = impersonated_credentials.Credentials(
            source_credentials=credentials,
            target_principal=target_sa,
            target_scopes=["https://www.googleapis.com/auth/devstorage.read_only"],
        )
        impersonated.refresh(auth_request)
        return impersonated, None  # Impersonated creds can sign directly

    # Case 4: No way to sign - raise helpful error
    raise ValueError(
        "Cannot sign GCS URLs: credentials don't have signing capability. "
        "Either:\n"
        "  1. Set GOOGLE_APPLICATION_CREDENTIALS to a service account key file\n"
        "  2. Run on Cloud Run with workload identity\n"
        "  3. Set GCS_SIGNING_SERVICE_ACCOUNT to a service account email for impersonation"
    )


def generate_signed_url(
    storage_path: str,
    original_filename: str,
    expiration_seconds: int = 86400,
    inline: bool = False,
) -> str:
    """
    Generate a signed URL for downloading or viewing a file from GCS.

    This function handles different credential types:
    - Service account keys: Sign directly with the private key
    - Workload identity: Use IAM Credentials API to sign
    - User credentials: Impersonate a service account to sign

    Args:
        storage_path: The GCS path of the file
        original_filename: The original filename for Content-Disposition header
        expiration_seconds: URL validity period in seconds (default 24 hours)
        inline: If True, use 'inline' disposition for browser preview.
                If False, use 'attachment' to force download.

    Returns:
        Signed URL string

    Raises:
        ValueError: If credentials can't sign and no impersonation configured
        Exception: On GCS signing errors
    """
    # RFC 5987 encoding for Content-Disposition filename
    # This handles non-ASCII characters in filenames
    encoded_filename = quote(original_filename, safe="")
    disposition_type = "inline" if inline else "attachment"
    content_disposition = f"{disposition_type}; filename*=UTF-8''{encoded_filename}"

    if use_local_storage():
        return local_file_url(storage_path, original_filename, inline)

    # Get credentials that can sign
    credentials, service_account_email = _get_signing_credentials()

    # Create a client with signing credentials
    client = storage.Client(credentials=credentials)
    bucket = client.bucket(get_bucket().name)
    blob = bucket.blob(storage_path)

    # Prepare signing arguments
    sign_kwargs: dict[str, Any] = {
        "version": "v4",
        "expiration": timedelta(seconds=expiration_seconds),
        "method": "GET",
        "response_disposition": content_disposition,
    }

    # If we need IAM signing (workload identity), pass the credentials info
    if service_account_email:
        sign_kwargs["service_account_email"] = service_account_email
        sign_kwargs["access_token"] = getattr(credentials, "token", None)

    url = blob.generate_signed_url(**sign_kwargs)

    logger.info(
        "Generated signed URL: path=%s, expires_in=%ds, inline=%s",
        storage_path,
        expiration_seconds,
        inline,
    )

    return url
