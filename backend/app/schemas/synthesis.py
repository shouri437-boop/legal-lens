# ABOUTME: Pydantic schemas for the Synthesis Agent structured output and API responses.
# ABOUTME: Category A = structured output target; Category B = API response serialization.

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

# ---------------------------------------------------------------------------
# Category A: Structured Output Schemas
# ---------------------------------------------------------------------------
# These schemas define the LLM's structured output. They use simple types
# compatible with JSON-mode structured output.


class SynthesisEvidence(BaseModel):
    """A single evidence reference linked to a hypothesis."""

    finding_id: str = Field(
        ...,
        description="UUID of the case_finding from [FINDING:uuid] prefix",
    )
    role: str = Field(
        ...,
        description="Evidence role: 'supporting', 'contradicting', or 'neutral'",
    )
    excerpt: str = Field(
        ...,
        description="Verbatim excerpt from the finding that supports the role assignment",
    )


class SynthesisHypothesis(BaseModel):
    """An investigative hypothesis with confidence score and evidence."""

    claim: str = Field(
        ...,
        description="The hypothesis statement describing a potential conclusion",
    )
    confidence: float = Field(
        ...,
        ge=0,
        le=100,
        description="Confidence score 0-100, reflecting strength of evidence",
    )
    reasoning: str = Field(
        ...,
        description="Explanation of why this hypothesis was proposed and how "
        "evidence supports or weakens it",
    )
    evidence: list[SynthesisEvidence] = Field(
        ...,
        description="Flat list of evidence items with role labels "
        "(supporting/contradicting/neutral)",
    )


class SynthesisContradiction(BaseModel):
    """A detected contradiction between two claims from different sources."""

    claim_a: str = Field(
        ...,
        description="First conflicting claim",
    )
    claim_b: str = Field(
        ...,
        description="Second conflicting claim that conflicts with claim_a",
    )
    source_a_finding_id: str = Field(
        ...,
        description="UUID of the finding containing claim_a",
    )
    source_a_excerpt: str = Field(
        ...,
        description="Verbatim excerpt from source_a supporting claim_a",
    )
    source_b_finding_id: str = Field(
        ...,
        description="UUID of the finding containing claim_b",
    )
    source_b_excerpt: str = Field(
        ...,
        description="Verbatim excerpt from source_b supporting claim_b",
    )
    severity: str = Field(
        ...,
        description="Contradiction severity: 'minor', 'significant', or 'critical'",
    )
    domain: str = Field(
        ...,
        description="Domain where contradiction was detected "
        "(financial, legal, evidence, strategy, cross-domain)",
    )


class SynthesisGap(BaseModel):
    """An identified gap in the investigation where information is missing."""

    description: str = Field(
        ...,
        description="What information gap was identified",
    )
    what_is_missing: str = Field(
        ...,
        description="Specific description of the missing information",
    )
    why_needed: str = Field(
        ...,
        description="Why this information is important for the investigation",
    )
    priority: str = Field(
        ...,
        description="Gap priority: 'low', 'medium', 'high', or 'critical'",
    )
    suggested_actions: str = Field(
        ...,
        description="Specific actionable steps to obtain the missing information",
    )
    related_entity_ids: list[str] = Field(
        default_factory=list,
        description="UUIDs from [ENTITY:uuid:name] entries that relate to this gap",
    )


class SynthesisTimelineEvent(BaseModel):
    """A chronological event extracted from the case analysis."""

    title: str = Field(
        ...,
        description="Short title for the timeline event",
    )
    description: str = Field(
        ...,
        description="Detailed description of what happened",
    )
    event_date: str = Field(
        ...,
        description="Event date in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)",
    )
    event_end_date: str | None = Field(
        default=None,
        description="End date for duration events in ISO 8601 format, or null for point events",
    )
    event_type: str = Field(
        ...,
        description="Category: 'transaction', 'meeting', 'filing', 'communication', "
        "'legal_action', 'disclosure', 'transfer', 'incident', or 'other'",
    )
    domain: str = Field(
        ...,
        description="Source domain: 'financial', 'legal', 'evidence', or 'strategy'",
    )
    source_finding_ids: list[str] = Field(
        default_factory=list,
        description="UUIDs of case_findings that evidence this event",
    )
    source_entity_ids: list[str] = Field(
        default_factory=list,
        description="UUIDs from [ENTITY:uuid:name] entries involved in this event",
    )


class SynthesisTask(BaseModel):
    """An investigation task generated from analysis gaps or contradictions."""

    title: str = Field(
        ...,
        description="Short task title",
    )
    description: str = Field(
        ...,
        description="Detailed description of what needs to be done",
    )
    task_type: str = Field(
        ...,
        description="Task type: 'resolve_contradiction', 'obtain_evidence', "
        "'verify_hypothesis', 'follow_up_interview', 'document_retrieval', "
        "'external_research', 'cross_reference', or 'expert_consultation'",
    )
    priority: str = Field(
        ...,
        description="Task priority: 'low', 'medium', 'high', or 'critical'",
    )
    source_hypothesis_index: int | None = Field(
        default=None,
        description="Zero-based index into the hypotheses list that originated this task",
    )
    source_contradiction_index: int | None = Field(
        default=None,
        description="Zero-based index into the contradictions list that originated this task",
    )
    source_gap_index: int | None = Field(
        default=None,
        description="Zero-based index into the gaps list that originated this task",
    )


class SynthesisKeyFinding(BaseModel):
    """A ranked key finding from the investigation."""

    title: str = Field(
        ...,
        description="Short title summarizing the key finding",
    )
    description: str = Field(
        ...,
        description="Detailed explanation of the finding and its significance",
    )
    importance_rank: int = Field(
        ...,
        ge=1,
        description="Ranking by importance (1 = most important)",
    )
    source_finding_ids: list[str] = Field(
        default_factory=list,
        description="UUIDs of case_findings that support this key finding",
    )


class CrossModalLink(BaseModel):
    """A link connecting findings across different evidence modalities."""

    description: str = Field(
        ...,
        description="Description of the cross-modal correlation",
    )
    modality_a: str = Field(
        ...,
        description="First evidence modality (e.g. 'audio', 'document', 'image')",
    )
    modality_b: str = Field(
        ...,
        description="Second evidence modality that correlates with modality_a",
    )
    temporal_link: str = Field(
        ...,
        description="Temporal or causal relationship between the two modalities",
    )


class SynthesisVerdict(BaseModel):
    """The overall case verdict assessment."""

    verdict: str = Field(
        ...,
        description="Free-text verdict statement summarizing the case conclusion",
    )
    evidence_strength: str = Field(
        ...,
        description="Qualitative assessment: 'Conclusive', 'Substantial', or 'Inconclusive'",
    )
    key_strengths: list[str] = Field(
        ...,
        description="List of the strongest aspects of the case evidence",
    )
    key_weaknesses: list[str] = Field(
        ...,
        description="List of weaknesses or vulnerabilities in the case evidence",
    )


class SynthesisOutput(BaseModel):
    """Complete structured output from the Synthesis Agent.

    This is the structured-output target. All fields are populated
    by a single LLM call that cross-references domain findings and the
    curated knowledge graph.
    """

    case_summary: str = Field(
        ...,
        description="Executive summary of the case (2-4 paragraphs)",
    )
    case_verdict: SynthesisVerdict = Field(
        ...,
        description="Overall verdict assessment with evidence strength",
    )
    key_findings: list[SynthesisKeyFinding] = Field(
        ...,
        description="Top 5-10 most impactful discoveries, ranked by importance",
    )
    hypotheses: list[SynthesisHypothesis] = Field(
        ...,
        description="Investigative hypotheses with confidence scores and evidence",
    )
    contradictions: list[SynthesisContradiction] = Field(
        ...,
        description="Detected contradictions between sources or claims",
    )
    gaps: list[SynthesisGap] = Field(
        ...,
        description="Identified information gaps with actionable suggestions",
    )
    timeline_events: list[SynthesisTimelineEvent] = Field(
        ...,
        description="Chronological events extracted from the analysis (up to 30)",
    )
    investigation_tasks: list[SynthesisTask] = Field(
        ...,
        description="Actionable investigation tasks derived from findings",
    )
    cross_modal_links: list[CrossModalLink] = Field(
        ...,
        description="Links connecting findings across modalities "
        "(e.g., audio mention matches document reference)",
    )
    cross_domain_conclusions: str = Field(
        ...,
        description="Integrated narrative prose drawing conclusions across domains",
    )
    risk_assessment: str = Field(
        ...,
        description="Overall risk assessment narrative for the case",
    )
    has_location_data: bool = Field(
        ...,
        description="Whether the case findings contain geographic location references "
        "that warrant geospatial analysis",
    )


# ---------------------------------------------------------------------------
# Category B: API Response Schemas
# ---------------------------------------------------------------------------
# These schemas serialize DB models to JSON for API endpoints. They use
# ConfigDict(from_attributes=True) for ORM-mode compatibility and handle
# UUID serialization via Pydantic v2's native UUID->str JSON encoding.


class HypothesisEvidenceResponse(BaseModel):
    """A single evidence item within a hypothesis response."""

    finding_id: str = Field(..., description="UUID of the referenced case_finding")
    role: str = Field(
        ..., description="Evidence role: supporting, contradicting, or neutral"
    )
    excerpt: str = Field(..., description="Verbatim excerpt from the finding")


class HypothesisResponse(BaseModel):
    """API response for a case hypothesis."""

    id: UUID = Field(..., description="Hypothesis ID")
    case_id: UUID = Field(..., description="Case ID")
    workflow_id: UUID = Field(
        ..., description="Workflow that generated this hypothesis"
    )
    claim: str = Field(..., description="The hypothesis statement")
    status: str = Field(..., description="PENDING, SUPPORTED, or REFUTED")
    confidence: float = Field(..., description="Confidence score 0-100")
    evidence: list[HypothesisEvidenceResponse] = Field(
        default_factory=list,
        description="Flat evidence list merged from supporting + contradicting columns",
    )
    source_agent: str | None = Field(
        default=None, description="Agent that proposed this hypothesis"
    )
    reasoning: str | None = Field(
        default=None, description="Explanation of hypothesis reasoning"
    )
    created_at: datetime = Field(..., description="Creation timestamp")

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def merge_evidence(cls, data: object) -> object:
        """Merge supporting_evidence and contradicting_evidence into a flat list.

        The DB model stores evidence split by role in two JSONB columns.
        This validator reunifies them into a single list with role labels
        for frontend consumption.
        """
        # Handle both dict and ORM object access patterns
        if hasattr(data, "__dict__"):
            supporting = getattr(data, "supporting_evidence", None) or []
            contradicting = getattr(data, "contradicting_evidence", None) or []
        elif isinstance(data, dict):
            supporting = data.get("supporting_evidence") or []
            contradicting = data.get("contradicting_evidence") or []
        else:
            return data

        merged: list[dict[str, str]] = []
        for item in supporting:
            if isinstance(item, dict):
                # If items already have a role field, preserve it
                if "role" not in item:
                    item = {**item, "role": "supporting"}
                merged.append(item)
        for item in contradicting:
            if isinstance(item, dict):
                if "role" not in item:
                    item = {**item, "role": "contradicting"}
                merged.append(item)

        if hasattr(data, "__dict__"):
            # For ORM objects, we need to set as a dict for pydantic
            obj_dict = {}
            for field_name in [
                "id",
                "case_id",
                "workflow_id",
                "claim",
                "status",
                "confidence",
                "source_agent",
                "reasoning",
                "created_at",
            ]:
                obj_dict[field_name] = getattr(data, field_name, None)
            obj_dict["evidence"] = merged
            return obj_dict
        elif isinstance(data, dict):
            data["evidence"] = merged
        return data


class ContradictionResponse(BaseModel):
    """API response for a case contradiction."""

    id: UUID = Field(..., description="Contradiction ID")
    case_id: UUID = Field(..., description="Case ID")
    workflow_id: UUID = Field(
        ..., description="Workflow that detected this contradiction"
    )
    claim_a: str = Field(..., description="First conflicting claim")
    claim_b: str = Field(..., description="Second conflicting claim")
    source_a: dict[str, object] | None = Field(
        default=None, description="Source reference for claim_a"
    )
    source_b: dict[str, object] | None = Field(
        default=None, description="Source reference for claim_b"
    )
    severity: str = Field(..., description="minor, significant, or critical")
    domain: str | None = Field(
        default=None, description="Domain where contradiction was detected"
    )
    resolution_status: str = Field(..., description="unresolved or resolved")
    created_at: datetime = Field(..., description="Creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class RelatedEntity(BaseModel):
    """Lightweight representation of a KG entity referenced by a gap or task."""

    id: str = Field(..., description="Entity UUID")
    name: str = Field(..., description="Entity display name")
    entity_type: str = Field(..., description="Entity type (PERSON, ORG, etc.)")


class GapResponse(BaseModel):
    """API response for an evidence gap."""

    id: UUID = Field(..., description="Gap ID")
    case_id: UUID = Field(..., description="Case ID")
    workflow_id: UUID = Field(..., description="Workflow that identified this gap")
    description: str = Field(..., description="What information gap was identified")
    what_is_missing: str = Field(
        ..., description="Specific description of missing information"
    )
    why_needed: str | None = Field(
        default=None,
        description="Why this information is important for the investigation",
    )
    priority: str = Field(..., description="low, medium, high, or critical")
    related_entities: list[RelatedEntity] = Field(
        default_factory=list,
        description="Resolved KG entities related to this gap",
    )
    suggested_actions: str | None = Field(
        default=None, description="Recommended steps to fill the gap"
    )
    created_at: datetime = Field(..., description="Creation timestamp")


class TaskResponse(BaseModel):
    """API response for an investigation task."""

    id: UUID = Field(..., description="Task ID")
    case_id: UUID = Field(..., description="Case ID")
    workflow_id: UUID = Field(..., description="Workflow that generated this task")
    title: str = Field(..., description="Short task title")
    description: str = Field(..., description="Detailed task description")
    task_type: str = Field(..., description="Task type classification")
    priority: str = Field(..., description="low, medium, high, or critical")
    status: str = Field(
        ..., description="pending, in_progress, completed, or dismissed"
    )
    source_hypothesis_id: UUID | None = Field(
        default=None, description="Hypothesis that originated this task"
    )
    source_contradiction_id: UUID | None = Field(
        default=None, description="Contradiction that originated this task"
    )
    source_gap_id: UUID | None = Field(
        default=None, description="Gap that originated this task"
    )
    created_at: datetime = Field(..., description="Creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class KeyFindingResponse(BaseModel):
    """API response for a ranked key finding (from case_synthesis JSONB)."""

    title: str = Field(..., description="Key finding title")
    description: str = Field(..., description="Key finding description")
    importance_rank: int = Field(..., description="Ranking (1 = most important)")
    source_finding_ids: list[str] = Field(
        default_factory=list, description="Supporting finding UUIDs"
    )


class VerdictResponse(BaseModel):
    """API response for the case verdict (from case_synthesis JSONB)."""

    verdict: str = Field(..., description="Free-text verdict statement")
    evidence_strength: str = Field(
        ..., description="Conclusive, Substantial, or Inconclusive"
    )
    key_strengths: list[str] = Field(
        default_factory=list, description="Strongest evidence aspects"
    )
    key_weaknesses: list[str] = Field(
        default_factory=list, description="Evidence weaknesses"
    )


class SynthesisResponse(BaseModel):
    """API response for the overall case synthesis record."""

    id: UUID = Field(..., description="Synthesis record ID")
    case_id: UUID = Field(..., description="Case ID")
    workflow_id: UUID = Field(..., description="Workflow that produced this synthesis")
    case_summary: str | None = Field(default=None, description="Executive case summary")
    case_verdict: VerdictResponse | None = Field(
        default=None, description="Structured verdict parsed from JSONB"
    )
    cross_modal_links: list[dict[str, object]] | None = Field(
        default=None, description="Cross-modality finding links"
    )
    cross_domain_conclusions: list[str] | None = Field(
        default=None, description="Cross-domain conclusion items"
    )
    key_findings_summary: str | None = Field(
        default=None, description="Distilled key findings summary"
    )
    risk_assessment: str | None = Field(
        default=None, description="Overall risk assessment narrative"
    )
    timeline_event_count: int = Field(
        default=0, description="Number of timeline events from this synthesis"
    )
    created_at: datetime = Field(..., description="Creation timestamp")

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def parse_verdict_jsonb(cls, data: object) -> object:
        """Parse case_verdict from raw JSONB dict into VerdictResponse.

        The DB stores case_verdict as a JSONB dict. This validator ensures
        it gets parsed into the typed VerdictResponse structure.
        """
        if hasattr(data, "__dict__"):
            verdict_raw = getattr(data, "case_verdict", None)
            if isinstance(verdict_raw, dict):
                obj_dict = {}
                for field_name in [
                    "id",
                    "case_id",
                    "workflow_id",
                    "case_summary",
                    "cross_modal_links",
                    "cross_domain_conclusions",
                    "key_findings_summary",
                    "risk_assessment",
                    "timeline_event_count",
                    "created_at",
                ]:
                    obj_dict[field_name] = getattr(data, field_name, None)
                obj_dict["case_verdict"] = VerdictResponse(**verdict_raw)
                return obj_dict
        elif isinstance(data, dict):
            verdict_raw = data.get("case_verdict")
            if isinstance(verdict_raw, dict):
                data["case_verdict"] = VerdictResponse(**verdict_raw)
        return data


class TimelineEventResponse(BaseModel):
    """API response for a timeline event."""

    id: UUID = Field(..., description="Timeline event ID")
    case_id: UUID = Field(..., description="Case ID")
    workflow_id: UUID = Field(..., description="Workflow that produced this event")
    title: str = Field(..., description="Event title")
    description: str | None = Field(default=None, description="Event description")
    event_date: datetime | None = Field(
        default=None, description="Start date/time of the event"
    )
    event_end_date: datetime | None = Field(
        default=None, description="End date/time for duration events"
    )
    event_type: str | None = Field(
        default=None, description="Category (transaction, meeting, filing, etc.)"
    )
    layer: str | None = Field(
        default=None, description="Visualization layer grouping (domain-based)"
    )
    source_entity_ids: list[str] | None = Field(
        default=None, description="KG entity UUIDs associated with this event"
    )
    citations: list[dict[str, object]] | None = Field(
        default=None, description="Source citations [{file_id, locator, excerpt}]"
    )
    created_at: datetime = Field(..., description="Creation timestamp")

    model_config = ConfigDict(from_attributes=True)


class TimelineApiResponseModel(BaseModel):
    """API response wrapping a list of timeline events with aggregation metadata.

    Matches the frontend TimelineApiResponse shape: events list, total count,
    date range boundaries, and per-layer counts.
    """

    events: list[TimelineEventResponse] = Field(
        ..., description="Timeline events matching the query"
    )
    totalCount: int = Field(..., description="Total number of events returned")
    dateRange: dict[str, str] = Field(
        ...,
        description="Date boundaries: {earliest: ISO string, latest: ISO string}",
    )
    layerCounts: dict[str, int] = Field(
        default_factory=dict,
        description="Count of events per layer (e.g. financial: 5, legal: 3)",
    )
