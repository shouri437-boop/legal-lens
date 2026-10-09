# ABOUTME: Legal Strategy Agent for case approach planning and investigation priorities.
# ABOUTME: Runs after parallel domain agents, consuming their findings as text summaries.

import json
import logging
from uuid import UUID

from google.adk.agents import LlmAgent
from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import PublishFn
from app.agents.domain_agent_runner import DomainAgentRunner
from app.agents.factory import AgentFactory
from app.models.file import CaseFile
from app.schemas.agent import StrategyOutput
from app.services.adk_service import build_domain_agent_content

logger = logging.getLogger(__name__)


class StrategyAgentRunner(DomainAgentRunner[StrategyOutput]):
    """Strategy domain agent runner with domain-summary-aware content preparation.

    Differs from standard config-driven runners in that it also accepts
    domain_summaries (text from Legal/Evidence agents) and can
    run with summaries alone (no files).
    """

    def get_agent_name(self) -> str:
        return "strategy"

    def _get_output_type(self) -> type[StrategyOutput]:
        return StrategyOutput

    def _create_agent_instance(
        self,
        case_id: str,
        model: str,
        publish_fn: PublishFn | None,
    ) -> LlmAgent:
        return AgentFactory.create_strategy_agent(
            case_id, model=model, publish_fn=publish_fn
        )

    async def _prepare_content(
        self,
        files: list[CaseFile],
        gcs_bucket: str,
        hypotheses: list[dict[str, object]],
        context_injection: str | None = None,
        **kwargs: object,
    ) -> types.Content:
        domain_summaries = str(kwargs.get("domain_summaries", ""))
        hypotheses_text = json.dumps(hypotheses, indent=2) if hypotheses else ""

        prompt_parts: list[str] = []
        if context_injection:
            prompt_parts.append(f"--- CASE CONTEXT ---\n{context_injection}\n---\n")
        prompt_parts.append("Analyze the following for legal strategy insights.")
        if domain_summaries:
            prompt_parts.append(
                "\n\n--- DOMAIN AGENT FINDINGS SUMMARIES ---\n" + domain_summaries
            )
        if hypotheses_text:
            prompt_parts.append(
                "\n\n--- EXISTING HYPOTHESES TO EVALUATE ---\n" + hypotheses_text
            )

        prompt = "\n".join(prompt_parts)

        if files:
            return await build_domain_agent_content(
                files=files,
                gcs_bucket=gcs_bucket,
                prompt=prompt,
            )
        # Strategy may have NO files of its own (only summaries)
        return types.Content(
            role="user",
            parts=[types.Part(text=prompt)],
        )


async def run_strategy(
    case_id: str,
    workflow_id: str,
    user_id: str,
    files: list[CaseFile],
    domain_summaries: str,
    hypotheses: list[dict[str, object]],
    db_session: AsyncSession,
    publish_event: PublishFn | None = None,
    parent_execution_id: UUID | None = None,
    context_injection: str | None = None,
    stage_suffix: str = "",
) -> tuple[StrategyOutput | None, UUID | None]:
    """Run legal strategy analysis on files and domain agent summaries.

    Public function delegating to StrategyAgentRunner.

    Returns:
        Tuple of (parsed_output_or_None, execution_id_or_None).
    """
    # Edge case: no files AND no domain summaries -- nothing to analyze
    if not files and not domain_summaries:
        logger.info(
            "Strategy agent skipped for case=%s: no files and no domain summaries",
            case_id,
        )
        return (None, None)

    return await StrategyAgentRunner().run(
        case_id=case_id,
        workflow_id=workflow_id,
        user_id=user_id,
        files=files,
        hypotheses=hypotheses,
        db_session=db_session,
        publish_event=publish_event,
        parent_execution_id=parent_execution_id,
        context_injection=context_injection,
        stage_suffix=stage_suffix,
        domain_summaries=domain_summaries,
    )
