# ABOUTME: Health check endpoints for monitoring and load balancers.
# ABOUTME: Includes basic health, database health, and storage health checks.

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.local_storage import use_local_storage
from app.schemas import HealthResponse
from app.storage import check_bucket_accessible

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Basic health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(UTC),
    )


@router.get("/health/db", response_model=HealthResponse)
async def health_db(db: AsyncSession = Depends(get_db)) -> HealthResponse:
    """Health check with database verification."""
    try:
        await db.execute(text("SELECT 1"))
        return HealthResponse(
            status="healthy",
            database="connected",
            timestamp=datetime.now(UTC),
        )
    except Exception as e:
        return HealthResponse(
            status="unhealthy",
            database=f"error: {e}",
            timestamp=datetime.now(UTC),
        )


@router.get("/health/storage", response_model=HealthResponse)
async def health_storage() -> HealthResponse:
    """Health check with GCS storage verification."""
    bucket_name = settings.gcs_bucket
    if not bucket_name:
        if use_local_storage():
            return HealthResponse(
                status="healthy",
                storage="local",
                bucket=None,
                timestamp=datetime.now(UTC),
            )
        return HealthResponse(
            status="unhealthy",
            storage="not_configured",
            bucket=None,
            timestamp=datetime.now(UTC),
        )

    accessible = check_bucket_accessible()
    return HealthResponse(
        status="healthy" if accessible else "unhealthy",
        storage="accessible" if accessible else "inaccessible",
        bucket=bucket_name,
        timestamp=datetime.now(UTC),
    )
