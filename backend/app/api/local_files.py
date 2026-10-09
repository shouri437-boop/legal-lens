# ABOUTME: Serves locally stored evidence files (only when GCS_BUCKET is not configured).
# ABOUTME: Stands in for GCS signed URLs during local development.

from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse

from app.local_storage import local_path, use_local_storage

router = APIRouter(prefix="/api/local-files", tags=["local-files"])


@router.get("/{storage_path:path}", include_in_schema=False)
async def serve_local_file(
    storage_path: str,
    name: Annotated[str, Query()] = "file",
    inline: Annotated[bool, Query()] = False,
) -> FileResponse:
    if not use_local_storage():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    try:
        path = local_path(storage_path)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST) from None
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    disposition = "inline" if inline else "attachment"
    return FileResponse(
        path,
        headers={
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(name, safe='')}"
        },
    )
