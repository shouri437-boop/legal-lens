# ABOUTME: Evidence domain agent for assessing authenticity, chain of custody, and corroboration.
# ABOUTME: Config-driven — no subclass needed. Uses DomainAgentRunner with DomainAgentConfig.

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import PublishFn
from app.agents.domain_agent_runner import DomainAgentConfig, DomainAgentRunner
from app.agents.factory import AgentFactory
from app.models.file import CaseFile
from app.schemas.agent import EvidenceOutput

logger = logging.getLogger(__name__)


EVIDENCE_CONFIG = DomainAgentConfig(
    agent_name="evidence",
    output_type=EvidenceOutput,
    domain_prompt=(
        "Analyze the following documents as physical/digital evidence. "
        "Assess authenticity, chain of custody, and corroboration."
    ),
    create_agent=lambda case_id, model, publish_fn: (
        AgentFactory.create_evidence_agent(case_id, model=model, publish_fn=publish_fn)
    ),
)


async def run_evidence(
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
) -> tuple[EvidenceOutput | None, UUID | None]:
    """Run evidence analysis on a set of files.

    Public function delegating to DomainAgentRunner with EVIDENCE_CONFIG.

    Returns:
        Tuple of (parsed_output_or_None, execution_id_or_None).
    """
    return await DomainAgentRunner[EvidenceOutput](EVIDENCE_CONFIG).run(
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
    )
