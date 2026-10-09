# ABOUTME: Package for agent system prompts, exporting prompts used by the agent factory.
# ABOUTME: Each agent type has its own prompt module; this init re-exports for convenience.

from app.agents.prompts.evidence import EVIDENCE_SYSTEM_PROMPT
from app.agents.prompts.legal import LEGAL_SYSTEM_PROMPT
from app.agents.prompts.orchestrator import ORCHESTRATOR_SYSTEM_PROMPT
from app.agents.prompts.strategy import STRATEGY_SYSTEM_PROMPT
from app.agents.prompts.triage import TRIAGE_SYSTEM_PROMPT

__all__ = [
    "EVIDENCE_SYSTEM_PROMPT",
    "LEGAL_SYSTEM_PROMPT",
    "ORCHESTRATOR_SYSTEM_PROMPT",
    "STRATEGY_SYSTEM_PROMPT",
    "TRIAGE_SYSTEM_PROMPT",
]
