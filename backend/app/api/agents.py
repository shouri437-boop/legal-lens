# ABOUTME: Agent execution API endpoints for starting and tracking analysis workflows.
# ABOUTME: Provides POST to start analysis, GET for status. Pipeline logic lives in services/pipeline.py.

import logging
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import CurrentUser
from app.database import get_db
from app.models import Case, CaseFile
from app.models.agent_execution import AgentExecution, AgentExecutionStatus
from app.models.case import CaseStatus
from app.models.file import FileStatus
from app.schemas.agent import (
    AnalysisMode,
    AnalysisStartRequest,
    ExecutionDetailResponse,
    OrchestratorOutput,
    TriageOutput,
)
from app.schemas.common import ErrorResponse
from app.services.pipeline import run_analysis_workflow

logger = logging.getLogger(__name__)

router = APIRouter(tags=["agents"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class AnalysisStartResponse(BaseModel):
    """Response returned when an analysis workflow is started."""

    workflow_id: UUID = Field(..., description="Unique ID for tracking this workflow")
    case_id: UUID = Field(..., description="ID of the case being analyzed")
    files_queued: int = Field(..., description="Number of files queued for analysis")
    message: str = Field(..., description="Human-readable status message")


class AnalysisStatusResponse(BaseModel):
    """Current status of an analysis workflow."""

    workflow_id: UUID = Field(..., description="Workflow tracking ID")
    case_id: UUID = Field(..., description="ID of the case")
    status: Literal[
        "pending", "triage", "orchestrating", "domain_analysis", "complete", "error"
    ] = Field(..., description="Current pipeline stage")
    triage_result: TriageOutput | None = Field(
        default=None, description="Triage output once complete"
    )
    orchestrator_result: OrchestratorOutput | None = Field(
        default=None, description="Orchestrator output once complete"
    )
    started_at: datetime = Field(..., description="When the workflow started")
    completed_at: datetime | None = Field(
        default=None, description="When the workflow completed"
    )
    error: str | None = Field(default=None, description="Error message if failed")
    domain_results_summary: dict[str, list[dict[str, object]]] | None = Field(
        default=None,
        description=(
            "Summary of domain agent findings per agent type. "
            "Each agent type maps to a list of execution summaries (one per file group). "
            "Each summary contains: group_label, finding_count, status."
        ),
    )


# ---------------------------------------------------------------------------
# Helper: get case with ownership check
# ---------------------------------------------------------------------------


async def _get_user_case(
    db: AsyncSession,
    case_id: UUID,
    user_id: str,
) -> Case | None:
    """Fetch a case ensuring ownership and not deleted."""
    result = await db.execute(
        select(Case).where(
            Case.id == case_id,
            Case.user_id == user_id,
            Case.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/api/cases/{case_id}/analyze",
    response_model=AnalysisStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start agent analysis for case files",
    responses={
        400: {"model": ErrorResponse, "description": "No files to analyze"},
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        404: {"model": ErrorResponse, "description": "Case not found"},
        409: {"model": ErrorResponse, "description": "Analysis already in progress"},
    },
)
async def start_analysis(
    case_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    request_body: AnalysisStartRequest | None = None,
) -> AnalysisStartResponse:
    """Start agent analysis for case files.

    Per CONTEXT.md: "Batch after uploads -- user explicitly starts analysis"

    Supports two modes via the optional request body:
    - uploaded_only (default): Process files with UPLOADED status, plus files
      whose previous run failed (ERROR).
    - rerun_all: Reset ANALYZED/ERROR files to UPLOADED first, then process all.

    This triggers:
    1. Triage Agent on all UPLOADED files
    2. Orchestrator Agent with triage results
    3. Domain Agents (Legal, Evidence) based on routing
    4. Strategy Agent with domain summaries
    5. HITL confirmation for low-confidence findings
    6. (Future) Synthesis agent for final output

    Returns workflow_id for tracking progress via the status endpoint
    or the Command Center SSE stream.
    """
    mode = (request_body or AnalysisStartRequest()).mode

    # Validate case ownership
    case = await _get_user_case(db, case_id, current_user.id)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    # Concurrency guard: reject if analysis is already running
    if case.status == CaseStatus.PROCESSING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analysis already in progress for this case.",
        )

    # Reset terminal-state files back to UPLOADED. Rerun mode resets analysed
    # and failed files; the default mode still retries FAILED files, otherwise a
    # failed run would leave the case with "no files to analyze" forever.
    reset_states = (
        [FileStatus.ANALYZED, FileStatus.ERROR]
        if mode == AnalysisMode.RERUN_ALL
        else [FileStatus.ERROR]
    )
    await db.execute(
        update(CaseFile)
        .where(
            CaseFile.case_id == case_id,
            CaseFile.status.in_(reset_states),
        )
        .values(status=FileStatus.UPLOADED)
    )
    await db.commit()

    # Find all UPLOADED files in this case (works for both modes)
    result = await db.execute(
        select(CaseFile).where(
            CaseFile.case_id == case_id,
            CaseFile.status == FileStatus.UPLOADED,
        )
    )
    files = list(result.scalars().all())

    if not files:
        detail = (
            "No uploaded files to analyze. Upload files first."
            if mode == AnalysisMode.UPLOADED_ONLY
            else "No files to rerun analysis on."
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )

    # Generate workflow ID and persist case state before scheduling
    from uuid import uuid4

    workflow_id = uuid4()
    file_ids = [str(f.id) for f in files]

    case.status = CaseStatus.PROCESSING
    case.latest_workflow_id = workflow_id
    await db.commit()

    # Schedule background analysis
    background_tasks.add_task(
        run_analysis_workflow,
        case_id=str(case_id),
        workflow_id=str(workflow_id),
        user_id=current_user.id,
        file_ids=file_ids,
    )

    logger.info(
        "Analysis started: case=%s workflow=%s files=%d mode=%s",
        case_id,
        workflow_id,
        len(files),
        mode.value,
    )

    return AnalysisStartResponse(
        workflow_id=workflow_id,
        case_id=case_id,
        files_queued=len(files),
        message=f"Analysis started for {len(files)} file(s). Track progress via SSE.",
    )


@router.get(
    "/api/cases/{case_id}/analysis/{workflow_id}",
    response_model=AnalysisStatusResponse,
    summary="Get analysis workflow status",
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        404: {"model": ErrorResponse, "description": "Workflow or case not found"},
    },
)
async def get_analysis_status(
    case_id: UUID,
    workflow_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AnalysisStatusResponse:
    """Get current status of an analysis workflow.

    Returns the pipeline stage, triage and orchestrator results when available,
    and error information if the workflow failed.
    """
    # Validate case ownership
    case = await _get_user_case(db, case_id, current_user.id)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    # Get all executions for this workflow
    result = await db.execute(
        select(AgentExecution)
        .where(
            AgentExecution.case_id == case_id,
            AgentExecution.workflow_id == workflow_id,
        )
        .order_by(AgentExecution.created_at.asc())
    )
    executions = list(result.scalars().all())

    if not executions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    # Determine current status from executions
    domain_agent_names = frozenset({"legal", "evidence"})
    triage_exec = None
    orchestrator_exec = None
    domain_execs: dict[str, list[AgentExecution]] = {}
    strategy_exec: AgentExecution | None = None
    for exec_record in executions:
        if exec_record.agent_name == "triage":
            triage_exec = exec_record
        elif exec_record.agent_name == "orchestrator":
            orchestrator_exec = exec_record
        elif exec_record.agent_name in domain_agent_names:
            if exec_record.agent_name not in domain_execs:
                domain_execs[exec_record.agent_name] = []
            domain_execs[exec_record.agent_name].append(exec_record)
        elif exec_record.agent_name == "strategy":
            strategy_exec = exec_record

    # Determine pipeline status
    pipeline_status: Literal[
        "pending", "triage", "orchestrating", "domain_analysis", "complete", "error"
    ]
    error_msg: str | None = None
    completed_at: datetime | None = None

    # Check for fatal pipeline-level failures (not individual agent failures
    # which are expected to be partial and non-fatal)
    pipeline_failed = any(
        e.status == AgentExecutionStatus.FAILED
        and e.agent_name in ("triage", "orchestrator", "pipeline")
        for e in executions
    )

    if pipeline_failed:
        pipeline_status = "error"
        failed = [
            e
            for e in executions
            if e.status == AgentExecutionStatus.FAILED
            and e.agent_name in ("triage", "orchestrator", "pipeline")
        ]
        error_msg = failed[0].error_message if failed else "Unknown error"
    elif strategy_exec and strategy_exec.status == AgentExecutionStatus.COMPLETED:
        pipeline_status = "complete"
        completed_at = strategy_exec.completed_at
    elif (strategy_exec and strategy_exec.status == AgentExecutionStatus.RUNNING) or (
        domain_execs
        and any(
            e.status == AgentExecutionStatus.RUNNING
            for exec_list in domain_execs.values()
            for e in exec_list
        )
    ):
        pipeline_status = "domain_analysis"
    elif domain_execs and not strategy_exec:
        # All domain agents completed but strategy not started yet
        pipeline_status = "domain_analysis"
    elif (
        orchestrator_exec
        and orchestrator_exec.status == AgentExecutionStatus.COMPLETED
        and not domain_execs
    ):
        # Backward compat: orchestrator done, no domain agents -> complete
        pipeline_status = "complete"
        completed_at = orchestrator_exec.completed_at
    elif orchestrator_exec and orchestrator_exec.status == AgentExecutionStatus.RUNNING:
        pipeline_status = "orchestrating"
    elif triage_exec and triage_exec.status == AgentExecutionStatus.COMPLETED:
        pipeline_status = "orchestrating"
    elif triage_exec and triage_exec.status == AgentExecutionStatus.RUNNING:
        pipeline_status = "triage"
    else:
        pipeline_status = "pending"

    # Parse triage and orchestrator outputs
    triage_result: TriageOutput | None = None
    orchestrator_result: OrchestratorOutput | None = None

    if triage_exec and triage_exec.output_data:
        try:
            triage_result = TriageOutput.model_validate(triage_exec.output_data)
        except (ValueError, ValidationError) as exc:
            logger.warning(
                "Failed to parse stored triage output for workflow=%s: %s",
                workflow_id,
                exc,
            )

    if orchestrator_exec and orchestrator_exec.output_data:
        try:
            orchestrator_result = OrchestratorOutput.model_validate(
                orchestrator_exec.output_data
            )
        except (ValueError, ValidationError) as exc:
            logger.warning(
                "Failed to parse stored orchestrator output for workflow=%s: %s",
                workflow_id,
                exc,
            )

    # Build domain results summary (multi-execution-aware)
    domain_summary: dict[str, list[dict[str, object]]] | None = None
    if domain_execs:
        domain_summary = {}
        for agent_name, exec_list in domain_execs.items():
            domain_summary[agent_name] = []
            for exec_record in exec_list:
                finding_count = 0
                group_label: str = "unknown"
                if exec_record.input_data and isinstance(exec_record.input_data, dict):
                    raw_suffix = exec_record.input_data.get("stage_suffix", "")
                    group_label = (
                        raw_suffix.lstrip("_")
                        if isinstance(raw_suffix, str)
                        else "default"
                    ) or "default"
                if exec_record.output_data and isinstance(
                    exec_record.output_data, dict
                ):
                    findings = exec_record.output_data.get("findings", [])
                    finding_count = len(findings) if isinstance(findings, list) else 0
                domain_summary[agent_name].append(
                    {
                        "group_label": group_label,
                        "finding_count": finding_count,
                        "status": exec_record.status.value
                        if exec_record.status
                        else "unknown",
                    }
                )

    # Find earliest started_at
    started_at = min(e.started_at for e in executions)

    return AnalysisStatusResponse(
        workflow_id=workflow_id,
        case_id=case_id,
        status=pipeline_status,
        triage_result=triage_result,
        orchestrator_result=orchestrator_result,
        started_at=started_at,
        completed_at=completed_at,
        error=error_msg,
        domain_results_summary=domain_summary,
    )


# ---------------------------------------------------------------------------
# Execution Detail Endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/api/agents/executions/{execution_id}",
    response_model=ExecutionDetailResponse,
    summary="Get detailed agent execution data",
    responses={
        401: {"model": ErrorResponse, "description": "Unauthorized"},
        404: {"model": ErrorResponse, "description": "Execution not found"},
    },
)
async def get_execution_detail(
    execution_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ExecutionDetailResponse:
    """Fetch full execution data (output_data, input_data, thinking_traces).

    Verifies case ownership via the execution's case_id.
    """
    result = await db.execute(
        select(AgentExecution).where(AgentExecution.id == execution_id)
    )
    execution = result.scalar_one_or_none()

    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )

    # Verify ownership via case
    case = await _get_user_case(db, execution.case_id, current_user.id)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )

    return ExecutionDetailResponse.model_validate(execution)
