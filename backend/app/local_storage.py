# ABOUTME: Local-disk evidence storage used when GCS_BUCKET is not configured.
# ABOUTME: Mirrors the GCS object layout under LOCAL_STORAGE_PATH and serves files via /api/local-files.

import asyncio
import shutil
from pathlib import Path
from urllib.parse import quote

from app.config import settings


def use_local_storage() -> bool:
    """Local storage is used whenever no GCS bucket is configured."""
    return not settings.gcs_bucket


def _root() -> Path:
    root = Path(settings.local_storage_path)
    if not root.is_absolute():
        # Relative paths resolve against the backend directory
        root = Path(__file__).resolve().parent.parent / root
    return root.resolve()


def local_path(storage_path: str) -> Path:
    """Resolve a storage path inside the local root, rejecting path traversal."""
    root = _root()
    path = (root / storage_path).resolve()
    if root != path and root not in path.parents:
        raise ValueError(f"Invalid storage path: {storage_path}")
    return path


def write_local(storage_path: str, data: bytes) -> None:
    path = local_path(storage_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


async def read_local(storage_path: str) -> bytes:
    return await asyncio.to_thread(local_path(storage_path).read_bytes)


def delete_local(storage_path: str) -> bool:
    path = local_path(storage_path)
    if not path.exists():
        return False
    path.unlink()
    return True


def delete_local_prefix(prefix: str) -> int:
    """Delete a stored folder (e.g. ``cases/<id>``) and everything in it.

    Returns the number of files removed (0 if the folder did not exist).
    """
    path = local_path(prefix)
    if path == _root() or not path.is_dir():
        return 0
    count = sum(1 for f in path.rglob("*") if f.is_file())
    shutil.rmtree(path)
    return count


def local_file_url(storage_path: str, original_filename: str, inline: bool) -> str:
    """URL on this backend that serves a locally stored file."""
    base = settings.backend_url.rstrip("/")
    return (
        f"{base}/api/local-files/{quote(storage_path)}"
        f"?name={quote(original_filename, safe='')}&inline={'true' if inline else 'false'}"
    )
