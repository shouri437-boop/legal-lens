# ABOUTME: Agent factory producing fresh LlmAgent instances per workflow.
# ABOUTME: Avoids ADK single-parent violations by never reusing agent objects.

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING, Any

from google.adk.agents import LlmAgent

from app.agents.base import (
    MODEL_FLASH,
    MODEL_PRO,
    AgentCallbacks,
    PublishFn,
    create_agent_callbacks,
)
from app.agents.groq_llm import make_groq_model
from app.agents.prompts.orchestrator import ORCHESTRATOR_SYSTEM_PROMPT
from app.agents.prompts.triage import TRIAGE_SYSTEM_PROMPT
from app.schemas.agent import OrchestratorOutput, TriageOutput

if TYPE_CHECKING:
    from pydantic import BaseModel

logger = logging.getLogger(__name__)


def _safe_name(prefix: str, case_id: str) -> str:
    """Build a valid ADK agent name from a prefix and case ID.

    ADK requires agent names to be valid Python identifiers (letters, digits,
    underscores only).  UUIDs contain hyphens which are stripped here.
    """
    sanitized = re.sub(r"[^a-zA-Z0-9]", "", case_id[:8])
    return f"{prefix}_{sanitized}"


def _create_llm_agent(
    *,
    name: str,
    model: str,
    instruction: str,
    output_schema: type[BaseModel],
    output_key: str,
    callbacks: AgentCallbacks | None,
) -> LlmAgent:
    """Create an LlmAgent with optional callbacks and content generation config.

    This helper centralizes LlmAgent instantiation to avoid code duplication
    while maintaining type safety for the callbacks TypedDict.

    Args:
        name: ADK agent name (must be valid Python identifier).
        model: Model ID.
        instruction: System prompt for the agent.
        output_schema: Pydantic model for structured output.
        output_key: Key name for the output in session state.
        callbacks: Optional ADK callback hooks for SSE publishing.
    """
    # Build base kwargs that all agents share
    base_kwargs: dict[str, Any] = {
        "name": name,
        # each agent type gets its own Groq key when several are configured
        "model": make_groq_model(model, name.rsplit("_", 1)[0]),
        "instruction": instruction,
        "output_schema": output_schema,
        "output_key": output_key,
    }

    if callbacks:
        # Merge callbacks into kwargs - TypedDict unpacks correctly here
        return LlmAgent(**base_kwargs, **callbacks)
    return LlmAgent(**base_kwargs)


class AgentFactory:
    """Creates fresh agent instances to avoid ADK single-parent violations.

    Every workflow execution MUST create new agent objects.  Reusing an agent
    that already has a parent raises ``ValueError`` in ADK.  The static methods
    on this class guarantee a fresh instance each time.
    """

    @staticmethod
    def create_triage_agent(
        case_id: str,
        file_ids: list[str],
        *,
        publish_fn: PublishFn | None = None,
    ) -> LlmAgent:
        """Create a fresh Triage Agent for a specific case.

        Uses Flash model for speed for thorough analysis.

        Args:
            case_id: Investigation case ID (used in agent name and callbacks).
            file_ids: IDs of files to triage (for logging/context).
            publish_fn: Optional SSE publish function for real-time callbacks.

        Returns:
            A new LlmAgent instance configured for triage.
        """
        callbacks: AgentCallbacks | None = (
            create_agent_callbacks(case_id, publish_fn) if publish_fn else None
        )

        return _create_llm_agent(
            name=_safe_name("triage", case_id),
            model=MODEL_FLASH,
            instruction=TRIAGE_SYSTEM_PROMPT,
            output_schema=TriageOutput,
            output_key="triage_result",
            callbacks=callbacks,
        )

    @staticmethod
    def create_orchestrator_agent(
        case_id: str,
        triage_result: dict[str, object],
        *,
        publish_fn: PublishFn | None = None,
    ) -> LlmAgent:
        """Create a fresh Orchestrator Agent for a specific case.

        Uses Pro model for complex routing reasoning .

        Args:
            case_id: Investigation case ID.
            triage_result: Structured triage output (injected into context).
            publish_fn: Optional SSE publish function for real-time callbacks.

        Returns:
            A new LlmAgent instance configured for orchestration.
        """
        callbacks: AgentCallbacks | None = (
            create_agent_callbacks(case_id, publish_fn) if publish_fn else None
        )

        return _create_llm_agent(
            name=_safe_name("orchestrator", case_id),
            model=MODEL_PRO,
            instruction=ORCHESTRATOR_SYSTEM_PROMPT,
            output_schema=OrchestratorOutput,
            output_key="orchestrator_result",
            callbacks=callbacks,
        )

    @staticmethod
    def create_legal_agent(
        case_id: str,
        *,
        model: str = MODEL_PRO,
        publish_fn: PublishFn | None = None,
    ) -> LlmAgent:
        """Create a fresh Legal domain agent for a specific case.

        Uses Pro model for thorough legal analysis.

        Args:
            case_id: Investigation case ID.
            model: Model ID (default: Pro for complex legal reasoning).
            publish_fn: Optional SSE publish function for real-time callbacks.

        Returns:
            A new LlmAgent instance configured for legal analysis.
        """
        from app.agents.prompts.legal import LEGAL_SYSTEM_PROMPT
        from app.schemas.agent import LegalOutput

        callbacks = create_agent_callbacks(case_id, publish_fn) if publish_fn else None
        return _create_llm_agent(
            name=_safe_name("legal", case_id),
            model=model,
            instruction=LEGAL_SYSTEM_PROMPT,
            output_schema=LegalOutput,
            output_key="legal_result",
            callbacks=callbacks,
        )

    @staticmethod
    def create_evidence_agent(
        case_id: str,
        *,
        model: str = MODEL_PRO,
        publish_fn: PublishFn | None = None,
    ) -> LlmAgent:
        """Create a fresh Evidence domain agent for a specific case.

        Uses Pro model for thorough evidence analysis.

        Args:
            case_id: Investigation case ID.
            model: Model ID (default: Pro for detailed evidence evaluation).
            publish_fn: Optional SSE publish function for real-time callbacks.

        Returns:
            A new LlmAgent instance configured for evidence analysis.
        """
        from app.agents.prompts.evidence import EVIDENCE_SYSTEM_PROMPT
        from app.schemas.agent import EvidenceOutput

        callbacks = create_agent_callbacks(case_id, publish_fn) if publish_fn else None
        return _create_llm_agent(
            name=_safe_name("evidence", case_id),
            model=model,
            instruction=EVIDENCE_SYSTEM_PROMPT,
            output_schema=EvidenceOutput,
            output_key="evidence_result",
            callbacks=callbacks,
        )

    @staticmethod
    def create_strategy_agent(
        case_id: str,
        *,
        model: str = MODEL_PRO,
        publish_fn: PublishFn | None = None,
    ) -> LlmAgent:
        """Create a fresh Legal Strategy domain agent for a specific case.

        Uses Pro model for strategic case analysis.

        The Strategy agent runs AFTER other domain agents and can incorporate
        their findings. Inter-agent communication is deferred to Phase 7.

        Args:
            case_id: Investigation case ID.
            model: Model ID (default: Pro for strategic reasoning).
            publish_fn: Optional SSE publish function for real-time callbacks.

        Returns:
            A new LlmAgent instance configured for legal strategy analysis.
        """
        from app.agents.prompts.strategy import STRATEGY_SYSTEM_PROMPT
        from app.schemas.agent import StrategyOutput

        callbacks = create_agent_callbacks(case_id, publish_fn) if publish_fn else None
        return _create_llm_agent(
            name=_safe_name("strategy", case_id),
            model=model,
            instruction=STRATEGY_SYSTEM_PROMPT,
            output_schema=StrategyOutput,
            output_key="strategy_result",
            callbacks=callbacks,
        )

    @staticmethod
    def create_kg_builder_agent(
        case_id: str,
        *,
        model: str = MODEL_PRO,
        publish_fn: PublishFn | None = None,
    ) -> LlmAgent:
        """Create a fresh KG Builder agent for a specific case.

        Uses Pro model for holistic knowledge graph
        construction from all domain agent findings. Text-only input --

        Args:
            case_id: Investigation case ID.
            model: Model ID (default: Pro for complex graph reasoning).
            publish_fn: Optional SSE publish function for real-time callbacks.

        Returns:
            A new LlmAgent instance configured for KG building.
        """
        from app.agents.prompts.kg_builder import KG_BUILDER_SYSTEM_PROMPT
        from app.schemas.kg_builder import KgBuilderOutput

        callbacks = create_agent_callbacks(case_id, publish_fn) if publish_fn else None
        return _create_llm_agent(
            name=_safe_name("kg_builder", case_id),
            model=model,
            instruction=KG_BUILDER_SYSTEM_PROMPT,
            output_schema=KgBuilderOutput,
            output_key="kg_builder_result",
            callbacks=callbacks,
        )

    @staticmethod
    def create_synthesis_agent(
        case_id: str,
        *,
        model: str = MODEL_PRO,
        publish_fn: PublishFn | None = None,
    ) -> LlmAgent:
        """Create a fresh Synthesis Agent for a specific case.

        Uses Pro model for comprehensive cross-domain
        synthesis of all domain findings and knowledge graph data.
        Text-only input.

        Args:
            case_id: Investigation case ID.
            model: Model ID (default: Pro for complex synthesis reasoning).
            publish_fn: Optional SSE publish function for real-time callbacks.

        Returns:
            A new LlmAgent instance configured for synthesis.
        """
        from app.agents.prompts.synthesis import SYNTHESIS_SYSTEM_PROMPT
        from app.schemas.synthesis import SynthesisOutput

        callbacks = create_agent_callbacks(case_id, publish_fn) if publish_fn else None
        return _create_llm_agent(
            name=_safe_name("synthesis", case_id),
            model=model,
            instruction=SYNTHESIS_SYSTEM_PROMPT,
            output_schema=SynthesisOutput,
            output_key="synthesis_result",
            callbacks=callbacks,
        )

    @staticmethod
    def create_geospatial_agent(
        case_id: str,
        *,
        model: str = MODEL_FLASH,
        publish_fn: PublishFn | None = None,
    ) -> LlmAgent:
        """Create a fresh Geospatial Agent for a specific case.

        Uses Flash model (cost efficiency) for location
        extraction and geospatial analysis. Text-only input.

        Args:
            case_id: Investigation case ID.
            model: Model ID (default: Flash for cost efficiency).
            publish_fn: Optional SSE publish function for real-time callbacks.

        Returns:
            A new LlmAgent instance configured for geospatial analysis.
        """
        from app.agents.prompts.geospatial import GEOSPATIAL_SYSTEM_PROMPT
        from app.schemas.geospatial import GeospatialOutput

        callbacks = create_agent_callbacks(case_id, publish_fn) if publish_fn else None
        return _create_llm_agent(
            name=_safe_name("geospatial", case_id),
            model=model,
            instruction=GEOSPATIAL_SYSTEM_PROMPT,
            output_schema=GeospatialOutput,
            output_key="geospatial_result",
            callbacks=callbacks,
        )
