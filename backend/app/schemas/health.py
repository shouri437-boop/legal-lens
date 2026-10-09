# ABOUTME: Health endpoint schemas for API health checks.
# ABOUTME: Used by monitoring systems and load balancers.

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Response model for health check endpoints."""

    status: Literal["healthy", "unhealthy"] = Field(
        ..., description="Overall health status of the service"
    )
    database: str | None = Field(default=None, description="Database connection status")
    storage: str | None = Field(default=None, description="GCS storage status")
    bucket: str | None = Field(default=None, description="GCS bucket name")
    timestamp: datetime = Field(
        ..., description="Time when the health check was performed"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "status": "healthy",
                    "database": "connected",
                    "storage": "accessible",
                    "bucket": "my-bucket",
                    "timestamp": "2026-01-21T12:00:00Z",
                }
            ]
        }
    }
