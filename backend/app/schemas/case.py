# ABOUTME: Pydantic schemas for case CRUD API operations.
# ABOUTME: Defines request/response models for creating, listing, and updating cases.

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.case import CaseStatus, CaseType


class CaseCreate(BaseModel):
    """Request body for creating a new case."""

    name: str = Field(
        ...,
        min_length=3,
        max_length=100,
        description="Name of the investigation case",
    )
    description: str | None = Field(
        default=None,
        max_length=5000,
        description="Optional description of the case",
    )
    type: CaseType = Field(
        default=CaseType.OTHER,
        description="Type of investigation",
    )


class CaseResponse(BaseModel):
    """Response model for a single case."""

    id: UUID = Field(..., description="Unique identifier for the case")
    name: str = Field(..., description="Name of the investigation case")
    description: str | None = Field(..., description="Optional description")
    type: CaseType = Field(..., description="Type of investigation")
    status: CaseStatus = Field(..., description="Current processing status")
    file_count: int = Field(..., description="Number of files in the case")
    latest_workflow_id: UUID | None = Field(
        None, description="ID of the most recent analysis workflow"
    )
    verdict_label: str | None = Field(
        default=None,
        description="Verdict strength label (Conclusive, Substantial, Inconclusive) "
        "set by synthesis agent",
    )
    verdict_summary: str | None = Field(
        default=None,
        description="One-line verdict summary from synthesis agent",
    )
    created_at: datetime = Field(..., description="When the case was created")
    updated_at: datetime = Field(..., description="When the case was last updated")

    model_config = ConfigDict(from_attributes=True)


class CaseListResponse(BaseModel):
    """Response model for listing cases with pagination."""

    cases: list[CaseResponse] = Field(..., description="List of cases")
    total: int = Field(..., description="Total number of cases")
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Number of cases per page")


class CaseListQuery(BaseModel):
    """Query parameters for listing cases."""

    page: int = Field(default=1, ge=1, description="Page number")
    per_page: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Number of cases per page",
    )
    sort_by: Literal["name", "created_at", "updated_at", "status"] = Field(
        default="updated_at",
        description="Field to sort by",
    )
    sort_order: Literal["asc", "desc"] = Field(
        default="desc",
        description="Sort order",
    )


class CaseUpdate(BaseModel):
    """Request body for updating an existing case.

    Only name and description are user-editable. Type and status are
    managed by the system (status changes via processing pipeline).
    """

    name: str | None = Field(
        default=None,
        min_length=3,
        max_length=100,
        description="Updated name of the case",
    )
    description: str | None = Field(
        default=None,
        max_length=5000,
        description="Updated description of the case",
    )
