# ABOUTME: Pydantic schemas for case findings API response models with search support.
# ABOUTME: Defines finding list/detail, citation, and full-text search request/response contracts.

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FindingCitation(BaseModel):
    """Citation reference stored alongside a finding in the database.

    Mirrors the agent Citation schema but represents the DB-stored format
    with file_id, locator, and excerpt fields.
    """

    file_id: str = Field(..., description="ID of the source file")
    locator: str = Field(
        ...,
        description="Exact location within the file. "
        "Format: 'page:3', 'ts:01:23:45', 'region:x,y,w,h'",
    )
    excerpt: str | None = Field(
        default=None,
        description="Exact character-for-character excerpt from the source material. "
        "Must be preserved in original format for PDF.js search highlighting.",
    )


class FindingResponse(BaseModel):
    """API response model for a single case finding."""

    id: UUID = Field(..., description="Finding ID")
    case_id: UUID = Field(..., description="Case this finding belongs to")
    workflow_id: UUID = Field(
        ..., description="Analysis workflow that produced this finding"
    )
    agent_type: str = Field(
        ...,
        description="Source agent (financial, legal, evidence, strategy)",
    )
    agent_execution_id: UUID | None = Field(
        default=None, description="Agent execution that produced this finding"
    )
    file_group_label: str | None = Field(
        default=None, description="Group label for multi-file agent runs"
    )
    category: str = Field(
        ...,
        description="Finding category (e.g. 'suspicious_transaction', 'contract_clause')",
    )
    title: str = Field(..., description="Concise finding title")
    finding_text: str = Field(..., description="Full finding description with analysis")
    confidence: float = Field(..., description="Agent-assessed confidence 0-100")
    citations: list[FindingCitation] | None = Field(
        default=None, description="Citation references to source material"
    )
    entity_ids: list[str] | None = Field(
        default=None, description="IDs of kg_entities linked to this finding"
    )
    created_at: datetime = Field(..., description="When the finding was created")

    model_config = ConfigDict(from_attributes=True)


class FindingListResponse(BaseModel):
    """Paginated list of findings for a case."""

    findings: list[FindingResponse] = Field(..., description="List of findings")
    total: int = Field(..., description="Total number of findings matching query")


class FindingSearchRequest(BaseModel):
    """Request body for full-text search across case findings."""

    query: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Search query text",
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of results to return",
    )


class FindingSearchResult(BaseModel):
    """A single search result containing a finding and its relevance score."""

    finding: FindingResponse = Field(..., description="The matching finding")
    relevance_score: float = Field(..., description="Full-text search relevance score")


class FindingSearchResponse(BaseModel):
    """Response for a full-text search across case findings."""

    results: list[FindingSearchResult] = Field(
        ..., description="Search results ranked by relevance"
    )
    query: str = Field(..., description="Original search query")
    total: int = Field(..., description="Total number of matching results")
