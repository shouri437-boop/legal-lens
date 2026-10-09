# ABOUTME: Config-driven domain agent runner with Pro-to-Flash fallback execution.
# ABOUTME: Eliminates ~1200 lines of duplicated run/retry/fallback logic across 4 domain agents.

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from google.adk.agents import LlmAgent
from google.adk.events import Event
from google.genai import types
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import MODEL_FLASH, MODEL_PRO, PublishFn
from app.agents.parsing import (
    extract_structured_json,
    extract_thinking_traces,
    extract_token_usage,
)
from app.config import get_settings
from app.models.agent_execution import AgentExecution, AgentExecutionStatus
from app.models.file import CaseFile
from app.services.adk_service import (
    build_domain_agent_content,
    create_stage_runner,
    get_or_create_stage_session,
)
from app.services.agent_events import emit_agent_fallback

logger = logging.getLogger(__name__)


# Type alias for the agent factory function signature.
# Args: (case_id, model, publish_fn) -> LlmAgent
AgentFactoryFn = Callable[[str, str, PublishFn | None], LlmAgent]


@dataclass(frozen=True)
class DomainAgentConfig:
    """Configuration for a standard domain agent (Legal, Evidence).

    Standard domain agents share the same content preparation pattern
    (context injection + domain prompt + hypotheses + files) and differ
    only in their name, output type, prompt text, and factory method.
    Strategy overrides _prepare_content and cannot use this config.
    """

    agent_name: str
    output_type: type[BaseModel]
    domain_prompt: str
    create_agent: AgentFactoryFn


class DomainAgentRunner[OutputT: BaseModel]:
    """Domain agent runner with Pro-to-Flash fallback execution.

    Encapsulates the shared execution pattern across Legal,
    Evidence, and Strategy agents:
    1. Create execution record (PENDING)
    2. Mark RUNNING
    3. Prepare content (agent-specific hook)
    4. Attempt Pro model with retries
    5. Fall back to Flash model if Pro fails
    6. Emit fallback SSE event
    7. Update execution record (COMPLETED/FAILED)
    8. Flush on exception to preserve audit trail

    Standard domain agents (Legal, Evidence) are fully driven
    by a DomainAgentConfig — no subclassing needed.  Strategy subclasses
    this class to override _prepare_content for its domain-summary-aware
    content preparation.
    """

    def __init__(self, config: DomainAgentConfig | None = None) -> None:
        self._config = config

    # -- Hook methods (read from config, or overridden by Strategy) -----------

    def get_agent_name(self) -> str:
        """Return the logical agent name (e.g., 'legal', 'evidence')."""
        if self._config is not None:
            return self._config.agent_name
        raise NotImplementedError(
            "Subclass must provide config or override get_agent_name"
        )

    def _get_output_type(self) -> type[OutputT]:
        """Return the Pydantic output model class for this agent."""
        if self._config is not None:
            return self._config.output_type  # type: ignore[return-value]
        raise NotImplementedError(
            "Subclass must provide config or override _get_output_type"
        )

    def _create_agent_instance(
        self,
        case_id: str,
        model: str,
        publish_fn: PublishFn | None,
    ) -> LlmAgent:
        """Create a fresh ADK LlmAgent instance for this agent type."""
        if self._config is not None:
            return self._config.create_agent(case_id, model, publish_fn)
        raise NotImplementedError(
            "Subclass must provide config or override _create_agent_instance"
        )

    async def _prepare_content(
        self,
        files: list[CaseFile],
        gcs_bucket: str,
        hypotheses: list[dict[str, object]],
        context_injection: str | None = None,
        **kwargs: object,
    ) -> types.Content:
        """Build multimodal content for this agent type.

        Standard agents use the config's domain_prompt via _build_standard_content.
        Strategy overrides this method entirely.
        """
        if self._config is not None:
            return await self._build_standard_content(
                domain_prompt=self._config.domain_prompt,
                files=files,
                gcs_bucket=gcs_bucket,
                hypotheses=hypotheses,
                context_injection=context_injection,
            )
        raise NotImplementedError(
            "Subclass must provide config or override _prepare_content"
        )

    # -- Shared content builder (used by Legal, Evidence) -----------

    async def _build_standard_content(
        self,
        domain_prompt: str,
        files: list[CaseFile],
        gcs_bucket: str,
        hypotheses: list[dict[str, object]],
        context_injection: str | None = None,
    ) -> types.Content:
        """Build multimodal content with the standard domain agent pattern.

        Shared by the Legal and Evidence agents which all follow the
        same pattern: context injection + domain prompt + hypotheses + files.
        Strategy overrides _prepare_content entirely and does not use this.

        Args:
            domain_prompt: Domain-specific analysis instruction text.
            files: Case files to include as multimodal parts.
            gcs_bucket: GCS bucket name for file downloads.
            hypotheses: Existing hypotheses for evaluation.
            context_injection: Case-specific framing from orchestrator.

        Returns:
            Multimodal Content with prompt and file parts.
        """
        prompt_parts: list[str] = []
        if context_injection:
            prompt_parts.append(f"--- CASE CONTEXT ---\n{context_injection}\n---\n")
        prompt_parts.append(domain_prompt)
        if hypotheses:
            prompt_parts.append(
                "\n\n--- EXISTING HYPOTHESES TO EVALUATE ---\n"
                + json.dumps(hypotheses, indent=2)
            )

        return await build_domain_agent_content(
            files=files,
            gcs_bucket=gcs_bucket,
            prompt="\n".join(prompt_parts),
        )

    # -- Template method: run() -----------------------------------------------

    async def run(
        self,
        case_id: str,
        workflow_id: str,
        user_id: str,
        files: list[CaseFile],
        hypotheses: list[dict[str, object]],
        db_session: AsyncSession,
        publish_event: PublishFn | None = None,
        parent_execution_id: UUID | None = None,
        context_injection: str | None = None,
        stage_suffix: str = "",
        **kwargs: object,
    ) -> tuple[OutputT | None, UUID | None]:
        """Execute the domain agent with Pro-to-Flash fallback.

        Args:
            case_id: UUID string of the case.
            workflow_id: UUID string of the analysis workflow.
            user_id: UUID string of the authenticated user.
            files: List of CaseFile records to analyze.
            hypotheses: Existing hypotheses for evaluation context.
            db_session: Database session for execution logging.
            publish_event: Optional callback for SSE events.
            parent_execution_id: Optional orchestrator execution ID for audit chain.
            context_injection: Case-specific framing from orchestrator.
            stage_suffix: Appended to stage name for concurrent instance isolation.
            **kwargs: Additional keyword arguments passed to _prepare_content.

        Returns:
            Tuple of (parsed_output_or_None, execution_id_or_None).
            execution_id is always set once the execution record is created,
            even if the agent fails to produce output.
        """
        agent_name = self.get_agent_name()
        settings = get_settings()
        file_ids = [str(f.id) for f in files]

        # ---- Create execution record (PENDING) ----
        input_data: dict[str, object] = {
            "file_ids": file_ids,
            "file_count": len(files),
            "file_names": [f.original_filename for f in files],
        }
        if stage_suffix:
            input_data["stage_suffix"] = stage_suffix

        execution = AgentExecution(
            case_id=UUID(case_id),
            workflow_id=UUID(workflow_id),
            agent_name=agent_name,
            agent_type="LlmAgent",
            model_name=settings.pro_model,
            status=AgentExecutionStatus.PENDING,
            input_data=input_data,
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

            # ---- Build multimodal content (shared across retries) ----
            content = await self._prepare_content(
                files,
                settings.gcs_bucket or "",
                hypotheses,
                context_injection,
                **kwargs,
            )

            # ---- Attempt Pro model ----
            (
                output,
                total_input_tokens,
                total_output_tokens,
                all_thinking_traces,
            ) = await self._attempt_model_loop(
                model=MODEL_PRO,
                case_id=case_id,
                workflow_id=workflow_id,
                user_id=user_id,
                content=content,
                stage_suffix=stage_suffix,
                publish_event=publish_event,
            )

            # ---- Flash fallback if Pro failed ----
            # (skipped when Pro and Flash are the same model: it would just repeat)
            fallback_used = False
            if output is None and MODEL_FLASH != MODEL_PRO:
                logger.warning(
                    "%s Pro model failed for case=%s, falling back to Flash",
                    agent_name.capitalize(),
                    case_id,
                )
                fallback_used = True

                (
                    flash_output,
                    flash_in,
                    flash_out,
                    flash_traces,
                ) = await self._attempt_model_loop(
                    model=MODEL_FLASH,
                    case_id=case_id,
                    workflow_id=workflow_id,
                    user_id=user_id,
                    content=content,
                    stage_suffix=f"{stage_suffix}_fallback",
                    publish_event=publish_event,
                )
                output = flash_output
                total_input_tokens += flash_in
                total_output_tokens += flash_out
                all_thinking_traces.extend(flash_traces)

            # ---- Emit fallback warning SSE event ----
            if fallback_used:
                await emit_agent_fallback(
                    case_id=case_id,
                    agent_type=agent_name,
                    fallback_model=MODEL_FLASH,
                )

            # ---- Update execution record ----
            execution.status = (
                AgentExecutionStatus.COMPLETED
                if output
                else AgentExecutionStatus.FAILED
            )

            output_data_record: dict[str, object] | None = None
            if output:
                output_data_record = output.model_dump(mode="json")
                if fallback_used and output_data_record is not None:
                    output_data_record["_metadata"] = {
                        "fallback_used": True,
                        "fallback_model": MODEL_FLASH,
                    }
            execution.output_data = output_data_record

            execution.input_tokens = total_input_tokens or None
            execution.output_tokens = total_output_tokens or None
            execution.thinking_traces = all_thinking_traces or None
            execution.completed_at = datetime.now(tz=UTC)

            if not output:
                execution.error_message = "Failed to parse structured output from model"

            if fallback_used:
                execution.model_name = MODEL_FLASH

            await db_session.flush()

            duration_s = (
                (execution.completed_at - execution.started_at).total_seconds()
                if execution.completed_at and execution.started_at
                else None
            )
            logger.info(
                "%s completed case=%s workflow=%s execution=%s status=%s "
                "duration_s=%.2f model=%s fallback=%s input_tokens=%s "
                "output_tokens=%s files=%d stage_suffix=%s",
                agent_name.capitalize(),
                case_id,
                workflow_id,
                execution_id,
                execution.status.value,
                duration_s or 0.0,
                execution.model_name,
                fallback_used,
                total_input_tokens or 0,
                total_output_tokens or 0,
                len(files),
                stage_suffix,
            )
            return (output, execution_id)

        except Exception as exc:
            logger.exception(
                "%s failed for case=%s workflow=%s: %s",
                agent_name.capitalize(),
                case_id,
                workflow_id,
                exc,
            )
            execution.status = AgentExecutionStatus.FAILED
            execution.error_message = str(exc)[:2000]
            execution.completed_at = datetime.now(tz=UTC)
            # Flush (not rollback) so the FAILED execution record is preserved
            # for audit. The caller (run_domain_agents_parallel) commits.
            await db_session.flush()
            return (None, execution_id)

    # -- Private: model attempt loop ------------------------------------------

    async def _attempt_model_loop(
        self,
        model: str,
        case_id: str,
        workflow_id: str,
        user_id: str,
        content: types.Content,
        stage_suffix: str,
        publish_event: PublishFn | None,
    ) -> tuple[OutputT | None, int, int, list[dict[str, object]]]:
        """Run the agent with retries on a specific model.

        Args:
            model: Model ID to use.
            case_id: UUID string of the case.
            workflow_id: UUID string of the analysis workflow.
            user_id: UUID string of the authenticated user.
            content: Multimodal content to send to the agent.
            stage_suffix: Stage name suffix for session isolation.
            publish_event: Optional callback for SSE events.

        Returns:
            Tuple of (output, input_tokens, output_tokens, thinking_traces).
        """
        agent_name = self.get_agent_name()
        output_type = self._get_output_type()
        settings = get_settings()
        max_retries = settings.max_parse_retries

        total_input_tokens = 0
        total_output_tokens = 0
        all_thinking_traces: list[dict[str, object]] = []

        for attempt in range(1 + max_retries):
            agent_instance = self._create_agent_instance(
                case_id=case_id,
                model=model,
                publish_fn=publish_event,
            )
            runner = create_stage_runner(agent_instance)

            stage = f"{agent_name}{stage_suffix}"
            if attempt > 0:
                stage = f"{agent_name}{stage_suffix}_retry_{attempt}"
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

            attempt_in, attempt_out = extract_token_usage(attempt_events)
            total_input_tokens += attempt_in
            total_output_tokens += attempt_out
            all_thinking_traces.extend(extract_thinking_traces(attempt_events))

            output = extract_structured_json(attempt_events, output_type, agent_name)
            if output is not None:
                return (
                    output,
                    total_input_tokens,
                    total_output_tokens,
                    all_thinking_traces,
                )

            if attempt < max_retries:
                logger.warning(
                    "%s parse failed on attempt %d/%d for case=%s, "
                    "retrying with fresh session...",
                    agent_name.capitalize(),
                    attempt + 1,
                    1 + max_retries,
                    case_id,
                )

        return None, total_input_tokens, total_output_tokens, all_thinking_traces
