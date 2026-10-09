# ABOUTME: Orchestrator Agent implementation for intelligent routing based on triage results.
# ABOUTME: Produces routing decisions, file groupings, and research triggers using the Pro model.

import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from google.adk.events import Event
from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import PublishFn
from app.agents.factory import AgentFactory
from app.agents.parsing import (
    extract_json_from_text,
    extract_thinking_traces,
    extract_token_usage,
)
from app.config import get_settings
from app.models.agent_execution import AgentExecution, AgentExecutionStatus
from app.schemas.agent import OrchestratorOutput, TriageOutput
from app.services.adk_service import (
    create_stage_runner,
    get_or_create_stage_session,
)

logger = logging.getLogger(__name__)

# Maximum retries when LLM output fails to parse (1 retry = 2 total attempts)
MAX_PARSE_RETRIES = 1


class OrchestratorAgent:
    """Orchestrator Agent for intelligent routing based on triage results.

    Wraps ADK LlmAgent creation with case-specific configuration.
    Each instance is intended for a single workflow execution.
    """

    def __init__(
        self,
        case_id: str,
        triage_output: TriageOutput,
        publish_fn: PublishFn | None = None,
    ) -> None:
        self.case_id = case_id
        self.triage_output = triage_output
        self._agent = AgentFactory.create_orchestrator_agent(
            case_id=case_id,
            triage_result=triage_output.model_dump(mode="json"),
            publish_fn=publish_fn,
        )

    @property
    def agent(self):
        """Access the underlying ADK LlmAgent."""
        return self._agent


# ---------------------------------------------------------------------------
# Output parsing
# ---------------------------------------------------------------------------


def parse_orchestrator_output(events: list[Event]) -> OrchestratorOutput | None:
    """Parse OrchestratorOutput from ADK events.

    Scans events in reverse to find the final agent response containing
    the structured JSON output. Schema correctness is enforced at the model
    level via ``output_schema`` (constrained decoding).

    Args:
        events: List of ADK events from runner execution.

    Returns:
        Parsed OrchestratorOutput, or None if parsing fails.
    """
    for event in reversed(events):
        if not event.is_final_response():
            continue

        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    json_str = extract_json_from_text(part.text)
                    if json_str is None:
                        continue
                    try:
                        data = json.loads(json_str)
                        return OrchestratorOutput.model_validate(data)
                    except (json.JSONDecodeError, ValueError) as exc:
                        logger.warning(
                            "Failed to parse orchestrator output JSON: %s",
                            exc,
                        )
                        continue

    logger.error("No valid orchestrator output found in agent events")
    return None


# ---------------------------------------------------------------------------
# Input preparation
# ---------------------------------------------------------------------------


def _prepare_orchestrator_input(triage_output: TriageOutput) -> str:
    """Format triage output as structured text context for the orchestrator.

    Converts the TriageOutput into a readable format the model can reason about.
    This is TEXT ONLY -- no file content is included. The orchestrator works
    entirely from triage metadata to keep its context window lightweight.

    Args:
        triage_output: Complete triage results for all files.

    Returns:
        Formatted string with triage data for the orchestrator prompt.
    """
    sections: list[str] = []

    sections.append(f"Total files analyzed: {len(triage_output.file_results)}")
    if triage_output.total_token_estimate:
        sections.append(
            f"Estimated total tokens across files: {triage_output.total_token_estimate}"
        )

    sections.append("\n--- PER-FILE TRIAGE RESULTS ---\n")

    for result in triage_output.file_results:
        file_section: list[str] = []
        file_section.append(f"File ID: {result.file_id}")
        if result.file_name:
            file_section.append(f"File Name: {result.file_name}")

        # Domain scores
        scores_str = ", ".join(
            f"{ds.domain}: {ds.score}" + (f" ({ds.reasoning})" if ds.reasoning else "")
            for ds in result.domain_scores
        )
        file_section.append(f"Domain Scores: {scores_str}")

        # Summary (detailed for orchestrator)
        file_section.append(f"Summary: {result.summary.detailed}")

        # Complexity
        file_section.append(
            f"Complexity: {result.complexity.tier}"
            + (
                f" -- {result.complexity.reasoning}"
                if result.complexity.reasoning
                else ""
            )
        )

        # Confidence and corruption
        file_section.append(f"Confidence: {result.confidence}")
        if result.is_corrupted:
            file_section.append(f"CORRUPTED: {result.corruption_notes or 'No details'}")

        # Key entities
        if result.entities:
            entity_strs = [
                f"  - [{e.type}] {e.value} (conf: {e.confidence})"
                for e in result.entities[:15]  # Limit to prevent context bloat
            ]
            file_section.append("Key Entities:\n" + "\n".join(entity_strs))

        sections.append("\n".join(file_section))
        sections.append("")  # Blank line separator

    # Triage-suggested groupings
    if triage_output.suggested_groupings:
        sections.append("--- TRIAGE-SUGGESTED FILE GROUPINGS ---\n")
        for group in triage_output.suggested_groupings:
            sections.append(
                f"Group: {group.group_name}\n"
                f"  Files: {', '.join(group.file_ids)}\n"
                f"  Reason: {group.reason}"
            )
        sections.append("")

    return "\n".join(sections)


# ---------------------------------------------------------------------------
# Stub for domain agent invocation (implemented in Phase 6)
# ---------------------------------------------------------------------------


async def _invoke_domain_agents_stub(
    routing: OrchestratorOutput,
) -> None:
    """Placeholder for domain agent invocation. Implemented in Phase 6.

    Logs what would be invoked based on routing decisions. This stub
    allows the orchestrator to be tested end-to-end without actual
    domain agent implementations.
    """
    logger.info(
        "Domain agent invocation stub: parallel=%s, sequential=%s",
        routing.parallel_agents,
        routing.sequential_agents,
    )
    if routing.research_trigger.should_trigger:
        logger.info(
            "Research trigger active: reason=%s, queries=%s",
            routing.research_trigger.reason,
            routing.research_trigger.research_queries,
        )


# ---------------------------------------------------------------------------
# Main execution function
# ---------------------------------------------------------------------------


async def run_orchestrator(
    case_id: str,
    workflow_id: str,
    user_id: str,
    triage_output: TriageOutput,
    db_session: AsyncSession,
    publish_event: PublishFn | None = None,
    parent_execution_id: UUID | None = None,
) -> OrchestratorOutput | None:
    """Run orchestrator to determine domain agent routing.

    Creates a FRESH ADK session for the orchestrator stage (stage-isolated).
    Input is TEXT ONLY: the TriageOutput JSON from the triage execution.
    This keeps the orchestrator context lightweight (~10-50K tokens).

    Args:
        case_id: UUID string of the case.
        workflow_id: UUID string of the analysis workflow.
        user_id: UUID string of the authenticated user.
        triage_output: Results from triage analysis.
        db_session: Database session for execution logging.
        publish_event: Optional callback for SSE events.
        parent_execution_id: Optional triage execution ID for audit chain.

    Returns:
        OrchestratorOutput with routing decisions and research triggers,
        or None on failure.
    """
    settings = get_settings()

    # ---- Create execution record (PENDING) ----
    execution = AgentExecution(
        case_id=UUID(case_id),
        workflow_id=UUID(workflow_id),
        agent_name="orchestrator",
        agent_type="LlmAgent",
        model_name=settings.pro_model,
        status=AgentExecutionStatus.PENDING,
        input_data={
            "file_count": len(triage_output.file_results),
            "file_ids": [r.file_id for r in triage_output.file_results],
            "triage_groupings": len(triage_output.suggested_groupings),
        },
        parent_execution_id=parent_execution_id,
    )
    db_session.add(execution)
    await db_session.flush()
    execution_id = execution.id

    try:
        # ---- Mark RUNNING ----
        execution.status = AgentExecutionStatus.RUNNING
        execution.started_at = datetime.now(tz=UTC)
        await db_session.flush()

        # ---- Build text-only content from triage output (shared across retries) ----
        orchestrator_input = _prepare_orchestrator_input(triage_output)
        content = types.Content(
            role="user",
            parts=[types.Part(text=orchestrator_input)],
        )

        # ---- Run agent with retry on parse failure ----
        orchestrator_output: OrchestratorOutput | None = None
        total_input_tokens = 0
        total_output_tokens = 0
        all_thinking_traces: list[dict[str, object]] = []

        for attempt in range(1 + MAX_PARSE_RETRIES):
            # Create agent and runner per attempt
            orchestrator = OrchestratorAgent(
                case_id=case_id,
                triage_output=triage_output,
                publish_fn=publish_event,
            )
            runner = create_stage_runner(orchestrator.agent)

            # Fresh session per attempt to avoid polluted context
            stage = "orchestrator" if attempt == 0 else f"orchestrator_retry_{attempt}"
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

            orchestrator_output = parse_orchestrator_output(attempt_events)
            if orchestrator_output is not None:
                break

            if attempt < MAX_PARSE_RETRIES:
                logger.warning(
                    "Orchestrator parse failed on attempt %d/%d for case=%s, "
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
            if orchestrator_output
            else AgentExecutionStatus.FAILED
        )
        execution.output_data = (
            orchestrator_output.model_dump(mode="json") if orchestrator_output else None
        )
        execution.input_tokens = input_tokens or None
        execution.output_tokens = output_tokens or None
        execution.thinking_traces = thinking_traces or None
        execution.completed_at = datetime.now(tz=UTC)

        if not orchestrator_output:
            execution.error_message = "Failed to parse structured output from model"

        await db_session.flush()

        # ---- Log domain agent stub ----
        if orchestrator_output:
            await _invoke_domain_agents_stub(orchestrator_output)

        duration_s = (
            (execution.completed_at - execution.started_at).total_seconds()
            if execution.completed_at and execution.started_at
            else None
        )
        logger.info(
            "Orchestrator completed case=%s workflow=%s execution=%s status=%s "
            "duration_s=%.2f model=%s input_tokens=%s output_tokens=%s",
            case_id,
            workflow_id,
            execution_id,
            execution.status.value,
            duration_s or 0.0,
            settings.pro_model,
            input_tokens or 0,
            output_tokens or 0,
        )
        return orchestrator_output

    except Exception as exc:
        logger.exception(
            "Orchestrator failed for case=%s workflow=%s: %s",
            case_id,
            workflow_id,
            exc,
        )
        execution.status = AgentExecutionStatus.FAILED
        execution.error_message = str(exc)[:2000]
        execution.completed_at = datetime.now(tz=UTC)
        await db_session.flush()
        return None
