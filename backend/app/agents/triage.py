# ABOUTME: Triage Agent implementation for initial file classification and entity extraction.
# ABOUTME: Processes files via the Flash model and outputs structured TriageOutput with domain scores.

import logging
from datetime import UTC, datetime
from uuid import UUID

from google.adk.events import Event
from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import PublishFn
from app.agents.factory import AgentFactory
from app.agents.parsing import (
    extract_structured_json,
    extract_thinking_traces,
    extract_token_usage,
)
from app.config import get_settings
from app.models.agent_execution import AgentExecution, AgentExecutionStatus
from app.models.file import CaseFile
from app.schemas.agent import TriageOutput
from app.services.adk_service import (
    build_agent_content,
    create_stage_runner,
    get_or_create_stage_session,
)

logger = logging.getLogger(__name__)

# Maximum retries when LLM output fails to parse (1 retry = 2 total attempts)
MAX_PARSE_RETRIES = 1


class TriageAgent:
    """Triage Agent for initial file classification and entity extraction.

    Wraps ADK LlmAgent creation with case-specific configuration.
    Each instance is intended for a single workflow execution.
    """

    def __init__(
        self,
        case_id: str,
        file_ids: list[str],
        publish_fn: PublishFn | None = None,
    ) -> None:
        self.case_id = case_id
        self.file_ids = file_ids
        self._agent = AgentFactory.create_triage_agent(
            case_id=case_id,
            file_ids=file_ids,
            publish_fn=publish_fn,
        )

    @property
    def agent(self):
        """Access the underlying ADK LlmAgent."""
        return self._agent


# ---------------------------------------------------------------------------
# Content preparation
# ---------------------------------------------------------------------------


async def _prepare_triage_content(
    files: list[CaseFile],
    gcs_bucket: str,
) -> types.Content:
    """Build multimodal content for Triage Agent.

    Uses tiered file handling:
    - Small files (<=100MB): inline base64
    - Large files (>100MB): File API upload -> URI reference
    """
    return await build_agent_content(
        files=files,
        gcs_bucket=gcs_bucket,
        prompt="Analyze the following documents:",
    )


# ---------------------------------------------------------------------------
# Main execution function
# ---------------------------------------------------------------------------


async def run_triage(
    case_id: str,
    workflow_id: str,
    user_id: str,
    files: list[CaseFile],
    db_session: AsyncSession,
    publish_event: PublishFn | None = None,
) -> TriageOutput | None:
    """Run triage analysis on a batch of files.

    Creates a FRESH ADK session for the triage stage (stage-isolated).
    This ensures file content does not bloat downstream agents' contexts.

    Args:
        case_id: UUID string of the case.
        workflow_id: UUID string of the analysis workflow.
        user_id: UUID string of the authenticated user.
        files: List of CaseFile records to analyze.
        db_session: Database session for execution logging.
        publish_event: Optional callback for SSE events.

    Returns:
        TriageOutput with file results and groupings, or None on failure.
    """
    settings = get_settings()
    file_ids = [str(f.id) for f in files]

    # ---- Create execution record (PENDING) ----
    execution = AgentExecution(
        case_id=UUID(case_id),
        workflow_id=UUID(workflow_id),
        agent_name="triage",
        agent_type="LlmAgent",
        model_name=settings.flash_model,
        status=AgentExecutionStatus.PENDING,
        input_data={"file_ids": file_ids, "file_count": len(files)},
    )
    db_session.add(execution)
    await db_session.flush()
    execution_id = execution.id

    try:
        # ---- Mark RUNNING ----
        execution.status = AgentExecutionStatus.RUNNING
        execution.started_at = datetime.now(tz=UTC)
        await db_session.flush()

        # ---- Build multimodal content (shared across retries) ----
        content = await _prepare_triage_content(files, settings.gcs_bucket or "")

        # ---- Run agent with retry on parse failure ----
        triage_output: TriageOutput | None = None
        total_input_tokens = 0
        total_output_tokens = 0
        all_thinking_traces: list[dict[str, object]] = []

        for attempt in range(1 + MAX_PARSE_RETRIES):
            # Create agent and runner per attempt
            triage = TriageAgent(
                case_id=case_id,
                file_ids=file_ids,
                publish_fn=publish_event,
            )
            runner = create_stage_runner(triage.agent)

            # Fresh session per attempt to avoid polluted context
            stage = "triage" if attempt == 0 else f"triage_retry_{attempt}"
            session = await get_or_create_stage_session(
                user_id=user_id,
                case_id=UUID(case_id),
                workflow_id=UUID(workflow_id),
                stage=stage,
            )

            attempt_events: list[Event] = []
            async for event in runner.run_async(
                user_id=user_id,
                session_id=session.id,
                new_message=content,
            ):
                attempt_events.append(event)

            # Accumulate tokens across all attempts
            attempt_in, attempt_out = extract_token_usage(attempt_events)
            total_input_tokens += attempt_in
            total_output_tokens += attempt_out
            all_thinking_traces.extend(extract_thinking_traces(attempt_events))

            triage_output = extract_structured_json(
                attempt_events, TriageOutput, "triage"
            )
            if triage_output is not None:
                break

            if attempt < MAX_PARSE_RETRIES:
                logger.warning(
                    "Triage parse failed on attempt %d/%d for case=%s, "
                    "retrying with fresh session...",
                    attempt + 1,
                    1 + MAX_PARSE_RETRIES,
                    case_id,
                )

        # ---- Alias accumulated metadata ----
        input_tokens = total_input_tokens
        output_tokens = total_output_tokens
        thinking_traces = all_thinking_traces

        # ---- Update execution record ----
        execution.status = (
            AgentExecutionStatus.COMPLETED
            if triage_output
            else AgentExecutionStatus.FAILED
        )
        execution.output_data = (
            triage_output.model_dump(mode="json") if triage_output else None
        )
        execution.input_tokens = input_tokens or None
        execution.output_tokens = output_tokens or None
        execution.thinking_traces = thinking_traces or None
        execution.completed_at = datetime.now(tz=UTC)

        if not triage_output:
            execution.error_message = "Failed to parse structured output from model"

        await db_session.flush()

        duration_s = (
            (execution.completed_at - execution.started_at).total_seconds()
            if execution.completed_at and execution.started_at
            else None
        )
        logger.info(
            "Triage completed case=%s workflow=%s execution=%s status=%s "
            "duration_s=%.2f model=%s input_tokens=%s output_tokens=%s files=%d",
            case_id,
            workflow_id,
            execution_id,
            execution.status.value,
            duration_s or 0.0,
            settings.flash_model,
            input_tokens or 0,
            output_tokens or 0,
            len(files),
        )
        return triage_output

    except Exception as exc:
        logger.exception(
            "Triage failed for case=%s workflow=%s: %s",
            case_id,
            workflow_id,
            exc,
        )
        execution.status = AgentExecutionStatus.FAILED
        execution.error_message = str(exc)[:2000]
        execution.completed_at = datetime.now(tz=UTC)
        await db_session.flush()
        return None
