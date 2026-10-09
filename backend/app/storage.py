# ABOUTME: GCS client initialization and helpers for evidence storage.
# ABOUTME: Provides bucket accessibility checking for health endpoints.

import logging

# google-cloud-storage doesn't ship type stubs (no py.typed marker)
# See: https://github.com/googleapis/python-storage/issues/393
from google.cloud import storage  # type: ignore[import-untyped,attr-defined]

from app.config import settings

logger = logging.getLogger(__name__)


def get_storage_client() -> storage.Client:
    """Get a GCS client instance."""
    return storage.Client()


def get_bucket() -> storage.Bucket:
    """Get the configured evidence storage bucket."""
    client = get_storage_client()
    bucket_name = settings.gcs_bucket
    if not bucket_name:
        raise ValueError("GCS_BUCKET environment variable not configured")
    return client.bucket(bucket_name)


def check_bucket_accessible() -> bool:
    """
    Check if the configured GCS bucket is accessible.

    Returns True if the bucket exists and is accessible,
    False otherwise (including on errors).
    """
    try:
        bucket = get_bucket()
        return bucket.exists()
    except ValueError as e:
        logger.warning("GCS bucket not configured: %s", e)
        return False
    except Exception as e:
        logger.warning("GCS bucket accessibility check failed: %s", e)
        return False
