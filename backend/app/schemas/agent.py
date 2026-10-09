# ABOUTME: Pydantic schemas for agent execution logging, triage output, and orchestrator routing.
# ABOUTME: Defines structured output types for Triage and Orchestrator agents plus CRUD schemas for execution records.

from datetime import datetime
from enum import Enum
from typing import Literal, Protocol, runtime_checkable
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.agent_execution import AgentExecutionStatus


class AnalysisMode(str, Enum):
    """Mode for starting an analysis workflow."""

    UPLOADED_ONLY = "uploaded_only"
    RERUN_ALL = "rerun_all"


class AnalysisStartRequest(BaseModel):
    """Optional request body for starting an analysis workflow."""

    mode: AnalysisMode = Field(
        default=AnalysisMode.UPLOADED_ONLY,
        description="'uploaded_only' processes new files; 'rerun_all' resets analyzed/error files first.",
    )


class DomainScore(BaseModel):
    """Confidence score for a single investigation domain.

    Each file is scored across domains (legal, strategy, evidence)
    to determine which domain specialists should process it.
    """

    domain: Literal["legal", "strategy", "evidence"] = Field(
        ..., description="Investigation domain category"
    )
    score: float = Field(..., ge=0, le=100, description="Confidence score 0-100")
    reasoning: str | None = Field(
        default=None, description="Brief rationale for the score"
    )


class ExtractedEntity(BaseModel):
    """Entity extracted from a file during triage.

    Quick entity extraction provides an initial knowledge graph seed
    before full domain analysis.
    """

    type: Literal[
        "person", "organization", "date", "location", "amount", "legal_term"
    ] = Field(..., description="Entity type category")
    value: str = Field(..., description="Extracted entity value")
    context: str | None = Field(
        default=None, description="Surrounding text for disambiguation"
    )
    confidence: float = Field(
        default=1.0,
        ge=0,
        le=1,
        description="Extraction confidence 0-1",
    )


class FileSummary(BaseModel):
    """Short and detailed summaries of a file's content."""

    short: str = Field(..., max_length=200, description="1-2 sentence summary")
    detailed: str = Field(..., max_length=2000, description="Paragraph-length summary")


class ComplexityAssessment(BaseModel):
    """Complexity tier assessment for routing to appropriate model/thinking level.

    Uses a hybrid approach: AI estimates tier, token metadata refines when available.
    """

    tier: Literal["low", "medium", "high"] = Field(
        ..., description="Complexity tier for model routing"
    )
    token_estimate: int | None = Field(
        default=None,
        description="Estimated token count from ADK metadata when available",
    )
    reasoning: str | None = Field(
        default=None, description="Rationale for the complexity assessment"
    )


class FileGrouping(BaseModel):
    """Suggested grouping of related files for batch processing."""

    group_name: str = Field(..., description="Descriptive name for the group")
    file_ids: list[str] = Field(..., description="IDs of files in this group")
    reason: str = Field(..., description="Why these files should be processed together")


class TriageFileResult(BaseModel):
    """Triage output for a single file.

    Contains domain scores, extracted entities, summaries, complexity
    assessment, and corruption detection results.
    """

    file_id: str = Field(..., description="ID of the analyzed file")
    file_name: str | None = Field(
        default=None,
        description="Original filename, populated from multimodal content labels",
    )
    domain_scores: list[DomainScore] = Field(
        ..., description="Confidence scores per investigation domain"
    )
    entities: list[ExtractedEntity] = Field(
        default_factory=list, description="Entities extracted from the file"
    )
    summary: FileSummary = Field(..., description="Short and detailed file summaries")
    complexity: ComplexityAssessment = Field(
        ..., description="Complexity tier assessment"
    )
    confidence: float = Field(
        ...,
        ge=0,
        le=1,
        description="Overall extraction confidence for this file",
    )
    is_corrupted: bool = Field(
        default=False,
        description="Whether the file appears corrupted or unreadable",
    )
    corruption_notes: str | None = Field(
        default=None,
        description="Details about corruption if detected",
    )


class TriageOutput(BaseModel):
    """Complete output from the Triage Agent for a set of files.

    Aggregates per-file results with cross-file grouping suggestions
    and total token estimates for downstream planning.
    """

    file_results: list[TriageFileResult] = Field(
        ..., description="Per-file triage results"
    )
    suggested_groupings: list[FileGrouping] = Field(
        default_factory=list,
        description="Suggested file groupings for batch processing",
    )
    total_token_estimate: int | None = Field(
        default=None,
        description="Estimated total tokens across all files",
    )


# --- Orchestrator output schemas ---


class RoutingDomainScores(BaseModel):
    """Triage domain scores carried forward into the routing decision.

    Uses explicit fields instead of a generic dict so the structured
    output schema stays compatible with constrained decoding.
    """

    legal: float = Field(..., ge=0, le=100, description="Legal score")
    strategy: float = Field(..., ge=0, le=100, description="Strategy score")
    evidence: float = Field(..., ge=0, le=100, description="Evidence score")


class RoutingDecision(BaseModel):
    """Per-file routing decision with detailed reasoning.

    The Orchestrator evaluates triage results and decides which domain agents
    should process each file, with explicit justification for every assignment.
    """

    file_id: str = Field(..., description="ID of the file being routed")
    file_name: str | None = Field(
        default=None, description="Original filename for readability"
    )
    target_agents: list[Literal["legal", "strategy", "evidence"]] = Field(
        ..., description="Domain agents that should process this file"
    )
    reasoning: str = Field(
        ..., description="Detailed explanation of why these agents were chosen"
    )
    priority: Literal["high", "medium", "low"] = Field(
        default="medium", description="Processing priority for this file"
    )
    domain_scores: RoutingDomainScores = Field(
        ...,
        description="Triage domain scores carried forward for reference",
    )
    context_injection: str | None = Field(
        default=None,
        description="Case-specific framing injected into the domain agent's prompt. "
        "Adapts the agent's analysis to the specific case type without requiring "
        "custom agent types. E.g., 'This is a patent infringement case. Focus on claims mapping.'",
    )
    routing_confidence: float | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Orchestrator's confidence in this routing (0-100). "
        "Low values trigger HITL review before agents deploy.",
    )


class FileGroupForProcessing(BaseModel):
    """Group of related files to be sent together to domain agents.

    Grouping provides richer context when files relate to the same transaction,
    entity, or event.
    """

    group_id: str = Field(..., description="Unique identifier for this group")
    file_ids: list[str] = Field(
        ..., description="IDs of files in this processing group"
    )
    target_agents: list[str] = Field(
        ..., description="Domain agents that should receive this group"
    )
    shared_context: str = Field(..., description="Why these files are grouped together")


class ResearchTrigger(BaseModel):
    """Decision about whether to trigger autonomous research.

    The Orchestrator evaluates whether gaps in triage data warrant
    triggering the Research/Discovery agent for additional context.
    """

    should_trigger: bool = Field(
        ..., description="Whether research should be triggered"
    )
    reason: str | None = Field(
        default=None, description="Why research is or isn't needed"
    )
    research_queries: list[str] = Field(
        default_factory=list, description="Suggested research directions"
    )
    priority: Literal["high", "medium", "low"] = Field(
        default="medium", description="Urgency of the research if triggered"
    )


class OrchestratorOutput(BaseModel):
    """Complete output from the Orchestrator Agent.

    Contains routing decisions, file groupings, execution ordering,
    research triggers, and a human-readable routing summary.
    """

    routing_decisions: list[RoutingDecision] = Field(
        ..., description="Per-file routing decisions with reasoning"
    )
    file_groups: list[FileGroupForProcessing] = Field(
        default_factory=list, description="File groups for batch processing"
    )
    parallel_agents: list[str] = Field(
        default_factory=list,
        description="Domain agents that can run concurrently",
    )
    sequential_agents: list[str] = Field(
        default_factory=list,
        description="Domain agents that must run in order (with dependencies)",
    )
    research_trigger: ResearchTrigger = Field(
        ..., description="Research/Discovery trigger decision"
    )
    overall_complexity: Literal["low", "medium", "high"] = Field(
        ..., description="Aggregate complexity across all files"
    )
    routing_summary: str = Field(
        ..., description="Human-readable summary of the routing plan"
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Concerns, edge cases, or caveats noted during routing",
    )


# --- Shared domain agent types ---


class Citation(BaseModel):
    """Span-level citation for a finding.

    Links a finding back to its exact location within a source file,
    enabling click-to-navigate in the source viewer (Phase 10).
    """

    file_id: str = Field(..., description="ID of the source file")
    locator: str = Field(
        ...,
        description="Exact location within the file. "
        "Format: 'page:3', 'ts:01:23:45', 'region:x,y,w,h'",
    )
    excerpt: str = Field(
        ...,
        max_length=500,
        description="Exact character-for-character excerpt from the source material. "
        "Must be preserved in original format for PDF.js search highlighting. "
        "Required — Pydantic validation rejects citations without an excerpt.",
    )


class MetadataEntry(BaseModel):
    """Single key-value metadata pair for domain entities.

    Replaces dict to avoid generating additionalProperties in JSON schema,
    which structured-output APIs reject.
    """

    key: str = Field(..., description="Metadata key (e.g., 'currency', 'jurisdiction')")
    value: str = Field(..., description="Metadata value")


class DomainEntity(BaseModel):
    """Entity extracted by a domain agent.

    Each domain has its own entity taxonomy (see per-domain output docstrings)
    plus an 'other' overflow type for unexpected entities. The `type` field is
    a free-form string rather than a fixed Literal to accommodate domain-specific
    taxonomies and the overflow category.
    """

    type: str = Field(
        ...,
        description="Domain-specific entity type (e.g., 'monetary_amount', 'statute', 'alias'). "
        "Each domain defines its own taxonomy with 'other' as overflow.",
    )
    value: str = Field(..., description="Extracted entity value")
    context: str | None = Field(
        default=None, description="Surrounding text for disambiguation"
    )
    confidence: float = Field(
        ...,
        ge=0,
        le=100,
        description="Agent self-assessed confidence score (0-100)",
    )
    metadata: list[MetadataEntry] = Field(
        default_factory=list,
        description="Domain-dependent metadata depth (e.g., currency for amounts, "
        "jurisdiction for statutes)",
    )


class Finding(BaseModel):
    """A single domain-specific finding with citations and extracted entities.

    Findings are the primary output unit of domain agents. Each finding
    belongs to a domain-specific category and carries span-level citations
    back to source material.
    """

    category: str = Field(
        ...,
        description="Domain-specific category name "
        "(e.g., 'Transactions', 'Contract Obligations', 'Authenticity Analysis')",
    )
    title: str = Field(..., max_length=200, description="Concise finding title")
    description: str = Field(
        ..., max_length=2000, description="Detailed finding description"
    )
    confidence: float = Field(
        ...,
        ge=0,
        le=100,
        description="Agent self-assessed confidence score (0-100)",
    )
    citations: list[Citation] = Field(
        default_factory=list,
        description="Span-level citations linking to source material",
    )
    entities: list[DomainEntity] = Field(
        default_factory=list,
        description="Entities extracted within this finding's context",
    )


class HypothesisEvaluation(BaseModel):
    """Agent's evaluation of an existing hypothesis against its findings.

    Domain agents evaluate (not propose) hypotheses. They assess whether
    their findings support, contradict, or are neutral toward each hypothesis.
    """

    hypothesis_id: str = Field(..., description="ID of the hypothesis being evaluated")
    stance: Literal["supports", "contradicts", "neutral"] = Field(
        ..., description="Agent's assessment of the hypothesis"
    )
    confidence: float = Field(
        ...,
        ge=0,
        le=100,
        description="Confidence in this evaluation (0-100)",
    )
    reasoning: str = Field(
        ...,
        max_length=2000,
        description="Explanation of why the agent reached this stance",
    )
    citations: list[Citation] = Field(
        default_factory=list,
        description="Citations supporting this evaluation",
    )


# --- Common domain output protocol ---


@runtime_checkable
class DomainAgentOutput(Protocol):
    """Structural interface shared by all domain agent output models.

    LegalOutput, EvidenceOutput, and StrategyOutput all
    satisfy this protocol. Using it instead of bare BaseModel gives pyright
    full attribute visibility while keeping the concrete models independent.
    """

    findings: list[Finding]
    findings_text: str | None
    entities: list[DomainEntity]
    no_findings_explanation: str | None


# --- Per-domain output models ---


class LegalOutput(BaseModel):
    """Structured output from the Legal domain agent.

    Entity taxonomy types:
        statute, case_citation, contract, legal_term, court,
        obligation, party, clause, other

    Finding categories:
        Contract Obligations, Regulatory Compliance, Legal Risks,
        Precedents, Violations
    """

    findings: list[Finding] = Field(
        default_factory=list,
        description="Legal findings extracted from analyzed files",
    )
    findings_text: str | None = Field(
        default=None,
        description="Rich markdown analysis text with inline source references. "
        "Contains the agent's full narrative analysis organized by category, "
        "with every factual claim citing the exact source excerpt. "
        "Populated by enriched domain agent prompts (Phase 7+).",
    )
    hypothesis_evaluations: list[HypothesisEvaluation] = Field(
        default_factory=list,
        description="Evaluations of existing hypotheses against legal findings",
    )
    entities: list[DomainEntity] = Field(
        default_factory=list,
        description="Top-level legal entities extracted across all findings",
    )
    no_findings_explanation: str | None = Field(
        default=None,
        description="Explanation when the agent finds nothing relevant in the file",
    )
    extraction_mode: Literal["dense", "curated"] = Field(
        default="curated",
        description="Extraction depth: 'dense' maximizes graph richness, "
        "'curated' applies confidence-threshold filtering for high-signal output",
    )


class EvidenceQualityAssessment(BaseModel):
    """Quality assessment of evidence integrity and reliability.

    Provides a single composite quality score (not a breakdown) per
    CONTEXT.md decision, plus detailed authenticity and custody analysis.
    """

    overall_score: float = Field(
        ...,
        ge=0,
        le=100,
        description="Single composite quality score (0-100)",
    )
    authenticity_concerns: list[str] = Field(
        default_factory=list,
        description="Identified concerns about evidence authenticity",
    )
    custody_chain_complete: bool = Field(
        ...,
        description="Whether the chain of custody appears complete",
    )
    custody_gaps: list[str] = Field(
        default_factory=list,
        description="Identified gaps in the chain of custody",
    )
    corroboration_status: Literal["strong", "moderate", "weak", "uncorroborated"] = (
        Field(
            ...,
            description="Level of corroboration from other evidence sources",
        )
    )
    recommendation: Literal["ADMIT", "VERIFY", "CHALLENGE", "EXCLUDE"] = Field(
        ...,
        description="Recommended action for this piece of evidence",
    )


class EvidenceOutput(BaseModel):
    """Structured output from the Evidence domain agent.

    Entity taxonomy types:
        communication, alias, vehicle, property, timestamp,
        physical_evidence, digital_artifact, witness, other

    Finding categories:
        Authenticity Analysis, Chain of Custody, Corroboration,
        Digital Forensics, Physical Evidence
    """

    findings: list[Finding] = Field(
        default_factory=list,
        description="Evidence findings extracted from analyzed files",
    )
    findings_text: str | None = Field(
        default=None,
        description="Rich markdown analysis text with inline source references. "
        "Contains the agent's full narrative analysis organized by category, "
        "with every factual claim citing the exact source excerpt. "
        "Populated by enriched domain agent prompts (Phase 7+).",
    )
    hypothesis_evaluations: list[HypothesisEvaluation] = Field(
        default_factory=list,
        description="Evaluations of existing hypotheses against evidence findings",
    )
    entities: list[DomainEntity] = Field(
        default_factory=list,
        description="Top-level evidence entities extracted across all findings",
    )
    no_findings_explanation: str | None = Field(
        default=None,
        description="Explanation when the agent finds nothing relevant in the file",
    )
    extraction_mode: Literal["dense", "curated"] = Field(
        default="curated",
        description="Extraction depth: 'dense' maximizes graph richness, "
        "'curated' applies confidence-threshold filtering for high-signal output",
    )
    quality_assessment: EvidenceQualityAssessment | None = Field(
        default=None,
        description="Composite quality assessment of the evidence's integrity and reliability",
    )


class StrategyOutput(BaseModel):
    """Structured output from the Legal Strategy domain agent.

    The Strategy agent handles legal strategy for the case: firm playbooks,
    internal strategy docs, and case approach planning. It is NOT an evidence
    analysis agent. It runs AFTER domain agents and can incorporate their findings.

    Entity taxonomy types:
        strategic_decision, organizational_unit, stakeholder,
        objective, risk_factor, other

    Finding categories:
        Case Strengths, Case Weaknesses, Investigation Priorities,
        Strategic Recommendations, Risk Assessment
    """

    findings: list[Finding] = Field(
        default_factory=list,
        description="Strategic findings extracted from analyzed files",
    )
    findings_text: str | None = Field(
        default=None,
        description="Rich markdown analysis text with inline source references. "
        "Contains the agent's full narrative analysis organized by category, "
        "with every factual claim citing the exact source excerpt. "
        "Populated by enriched domain agent prompts (Phase 7+).",
    )
    hypothesis_evaluations: list[HypothesisEvaluation] = Field(
        default_factory=list,
        description="Evaluations of existing hypotheses against strategic findings",
    )
    entities: list[DomainEntity] = Field(
        default_factory=list,
        description="Top-level strategy entities extracted across all findings",
    )
    no_findings_explanation: str | None = Field(
        default=None,
        description="Explanation when the agent finds nothing relevant in the file",
    )
    extraction_mode: Literal["dense", "curated"] = Field(
        default="curated",
        description="Extraction depth: 'dense' maximizes graph richness, "
        "'curated' applies confidence-threshold filtering for high-signal output",
    )
    domain_agent_summaries_received: list[str] = Field(
        default_factory=list,
        description="Names of domain agents whose summaries were incorporated "
        "(e.g., ['legal', 'evidence']). Populated when strategy agent "
        "runs after other domain agents.",
    )


# --- Agent execution CRUD schemas ---


class AgentExecutionCreate(BaseModel):
    """Schema for creating a new agent execution record."""

    case_id: UUID = Field(..., description="ID of the case being analyzed")
    workflow_id: UUID = Field(
        ..., description="ID grouping executions in the same analysis run"
    )
    agent_name: str = Field(..., description="Logical agent name, e.g. 'triage'")
    agent_type: str = Field(..., description="ADK agent class, e.g. 'LlmAgent'")
    model_name: str = Field(..., description="Model ID used for this execution")
    input_data: dict = Field(..., description="Agent input context")
    parent_execution_id: UUID | None = Field(
        default=None, description="Parent execution ID for sub-agent tracking"
    )


class AgentExecutionUpdate(BaseModel):
    """Schema for updating an existing agent execution record."""

    status: AgentExecutionStatus | None = Field(
        default=None, description="Updated execution status"
    )
    output_data: dict | None = Field(
        default=None, description="Structured agent output"
    )
    thinking_traces: list[dict] | None = Field(
        default=None, description="Captured thinking/reasoning traces"
    )
    tools_called: list[dict] | None = Field(
        default=None, description="Tool invocation log"
    )
    error_message: str | None = Field(
        default=None, description="Error message if execution failed"
    )
    input_tokens: int | None = Field(default=None, description="Input token count")
    output_tokens: int | None = Field(default=None, description="Output token count")
    completed_at: datetime | None = Field(
        default=None, description="Completion timestamp"
    )


class AgentExecutionResponse(BaseModel):
    """API response model for a single agent execution record."""

    id: UUID = Field(..., description="Execution record ID")
    case_id: UUID = Field(..., description="ID of the analyzed case")
    workflow_id: UUID = Field(..., description="Workflow group ID")
    agent_name: str = Field(..., description="Logical agent name")
    agent_type: str = Field(..., description="ADK agent class")
    model_name: str = Field(..., description="Model ID")
    status: AgentExecutionStatus = Field(..., description="Execution status")
    parent_execution_id: UUID | None = Field(
        default=None, description="Parent execution ID"
    )
    input_data: dict = Field(..., description="Agent input context")
    output_data: dict | None = Field(
        default=None, description="Structured agent output"
    )
    thinking_traces: list[dict] | None = Field(
        default=None, description="Thinking traces"
    )
    tools_called: list[dict] | None = Field(
        default=None, description="Tool invocation log"
    )
    error_message: str | None = Field(default=None, description="Error message")
    input_tokens: int | None = Field(default=None, description="Input token count")
    output_tokens: int | None = Field(default=None, description="Output token count")
    started_at: datetime = Field(..., description="Execution start time")
    completed_at: datetime | None = Field(
        default=None, description="Execution completion time"
    )
    created_at: datetime = Field(..., description="Record creation time")
    updated_at: datetime = Field(..., description="Record last update time")

    model_config = ConfigDict(from_attributes=True)


class ExecutionDetailResponse(BaseModel):
    """Detailed execution data for a single agent run."""

    id: UUID = Field(..., description="Execution record ID")
    agent_name: str = Field(..., description="Logical agent name")
    model_name: str = Field(..., description="Model ID")
    input_data: dict[str, object] | None = Field(
        default=None, description="Agent input context"
    )
    output_data: dict[str, object] | None = Field(
        default=None, description="Structured agent output"
    )
    thinking_traces: list[dict[str, object]] | None = Field(
        default=None, description="Thinking traces"
    )

    model_config = ConfigDict(from_attributes=True)
