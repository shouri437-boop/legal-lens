# ABOUTME: Agent package exposing factory, base configurations, and model constants.
# ABOUTME: All agent creation flows through AgentFactory to prevent single-parent violations.

from app.agents.base import (
    MODEL_FLASH,
    MODEL_PRO,
    create_agent_callbacks,
)
from app.agents.factory import AgentFactory
from app.agents.orchestrator import OrchestratorAgent, run_orchestrator
from app.agents.prompts import ORCHESTRATOR_SYSTEM_PROMPT, TRIAGE_SYSTEM_PROMPT
from app.agents.triage import TriageAgent, run_triage

__all__ = [
    # Factory and base configs
    "AgentFactory",
    "MODEL_FLASH",
    "MODEL_PRO",
    "create_agent_callbacks",
    # Triage Agent
    "TriageAgent",
    "run_triage",
    "TRIAGE_SYSTEM_PROMPT",
    # Orchestrator Agent
    "OrchestratorAgent",
    "run_orchestrator",
    "ORCHESTRATOR_SYSTEM_PROMPT",
]
