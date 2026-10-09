# ABOUTME: File-group-based parallel domain agent execution orchestrator.
# ABOUTME: Spawns one agent instance per (file_group, agent_type) pair based on orchestrator routing.

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager as AsyncContextManager
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import PublishFn
from app.agents.evidence import run_evidence
from app.agents.legal import run_legal
from app.models.file import CaseFile
from app.schemas.agent import DomainAgentOutput, EvidenceOutput, OrchestratorOutput

# Type alias for domain agent run functions (run_legal, run_evidence).
# Each accepts a fixed set of keyword args and returns (output_or_None, execution_id_or_None).
DomainRunFn = Callable[..., Awaitable[tuple[DomainAgentOutput | None, UUID | None]]]

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Agent task dataclass
# ---------------------------------------------------------------------------


@dataclass
class AgentTask:
    """A single agent execution task derived from orchestrator routing.

    Represents one (agent_type, group) pair that will be executed as a
    concurrent coroutine. The domain_runner spawns one task per unique
    combination of agent type and file group.
    """

    agent_type: str
    files: list[CaseFile]
    context_injection: str | None
    stage_suffix: str  # e.g., "_grp_0", "_ungrouped_2"
    group_label: str  # e.g., "grp_0", "ungrouped_2"


# ---------------------------------------------------------------------------
# Supported domain agent types (strategy excluded -- runs sequentially after)
# ---------------------------------------------------------------------------

_DOMAIN_AGENT_TYPES = frozenset({"legal", "evidence"})


# ---------------------------------------------------------------------------
# Domain run result (carries execution provenance alongside output)
# ---------------------------------------------------------------------------


@dataclass
class DomainRunResult:
    """Result of a single domain agent execution within the parallel runner.

    Carries the parsed output alongside execution provenance, eliminating
    the need for downstream consumers to re-query the database for execution_id.
    """

    agent_type: str
    output: DomainAgentOutput | None
    group_label: str
    execution_id: UUID | None


# ---------------------------------------------------------------------------
# Task computation (single source of truth)
# ---------------------------------------------------------------------------


def compute_agent_tasks(
    routing: OrchestratorOutput,
    files: list[CaseFile],
) -> list[AgentTask]:
    """Compute the list of agent tasks that will be executed.

    This is the single source of truth for file-group iteration logic.
    Used by both run_domain_agents_parallel (for actual execution) and the
    pipeline (for SSE event pre-emission).

    Returns a list of AgentTask entries, one per (agent_type, group) pair.
    Each AgentTask contains agent_type, files, context_injection, stage_suffix,
    and group_label.

    Args:
        routing: Orchestrator routing output with decisions and file groups.
        files: All case files available for processing.

    Returns:
        List of AgentTask instances ready for parallel execution.
    """
    file_lookup: dict[str, CaseFile] = {str(f.id): f for f in files}
    tasks: list[AgentTask] = []

    # Track which (file_id, agent_type) pairs are already covered by
    # file_groups. Per-file routing_decisions create tasks only for
    # UNCOVERED pairs — this ensures per-file routing to additional agents
    # (e.g., case-report.pdf → legal) is not silently dropped when the
    # file also belongs to a group routed to a different agent (e.g., evidence).
    covered_pairs: set[tuple[str, str]] = set()

    # Explicit file_groups from orchestrator
    for grp_idx, group in enumerate(routing.file_groups):
        group_files = [file_lookup[fid] for fid in group.file_ids if fid in file_lookup]
        if not group_files:
            continue
        for agent_type in group.target_agents:
            if agent_type in _DOMAIN_AGENT_TYPES:
                tasks.append(
                    AgentTask(
                        agent_type=agent_type,
                        files=group_files,
                        context_injection=group.shared_context,
                        stage_suffix=f"_grp_{grp_idx}",
                        group_label=f"grp_{grp_idx}",
                    )
                )
                for fid in group.file_ids:
                    covered_pairs.add((fid, agent_type))

    # Per-file routing decisions for UNCOVERED (file_id, agent_type) pairs
    ungrouped_idx = 0
    for decision in routing.routing_decisions:
        file = file_lookup.get(decision.file_id)
        if not file:
            continue
        has_uncovered = False
        for agent_type in decision.target_agents:
            if (
                agent_type in _DOMAIN_AGENT_TYPES
                and (decision.file_id, agent_type) not in covered_pairs
            ):
                tasks.append(
                    AgentTask(
                        agent_type=agent_type,
                        files=[file],
                        context_injection=decision.context_injection,
                        stage_suffix=f"_ungrouped_{ungrouped_idx}",
                        group_label=f"ungrouped_{ungrouped_idx}",
                    )
                )
                has_uncovered = True
        if has_uncovered:
            ungrouped_idx += 1

    return tasks


# ---------------------------------------------------------------------------
# Run function dispatch table
# ---------------------------------------------------------------------------

# Maps agent type names to their async run functions.
# Each run function has an identical signature (see legal.py, evidence.py).
RUN_FNS: dict[str, DomainRunFn] = {
    "legal": run_legal,
    "evidence": run_evidence,
}


# ---------------------------------------------------------------------------
# Parallel domain agent execution
# ---------------------------------------------------------------------------


async def run_domain_agents_parallel(
    case_id: str,
    workflow_id: str,
    user_id: str,
    routing: OrchestratorOutput,
    files: list[CaseFile],
    hypotheses: list[dict[str, object]],
    db_session_factory: Callable[..., AsyncContextManager[AsyncSession]],
    publish_event: PublishFn | None = None,
    orchestrator_execution_id: UUID | None = None,
) -> dict[str, list[DomainRunResult]]:
    """Run domain agents in parallel based on orchestrator routing.

    Spawns one agent instance per (file_group, agent_type) pair. Multiple
    instances of the same agent type run concurrently with different file
    subsets and group-specific context injection.

    Each parallel agent creates its own database session from the factory
    to avoid shared session conflicts (per RESEARCH.md Pitfall 3).

    Args:
        case_id: UUID string of the case.
        workflow_id: UUID string of the analysis workflow.
        user_id: UUID string of the authenticated user.
        routing: Orchestrator output with routing decisions and file groups.
        files: All case files available for processing.
        hypotheses: Existing hypotheses for evaluation context.
        db_session_factory: Callable returning async context manager for DB sessions.
        publish_event: Optional callback for SSE events.
        orchestrator_execution_id: Optional orchestrator execution ID for audit chain.

    Returns:
        Dict mapping agent type to list of DomainRunResult objects.
        Key: agent type name (e.g., "legal", "evidence").
        Value: list of DomainRunResult for each group that ran.
    """
    tasks = compute_agent_tasks(routing, files)

    if not tasks:
        logger.info(
            "No domain agent tasks computed for case=%s workflow=%s",
            case_id,
            workflow_id,
        )
        return {}

    # Log what we're about to execute
    task_summary: dict[str, list[str]] = {}
    for t in tasks:
        task_summary.setdefault(t.agent_type, []).append(t.group_label)
    logger.info(
        "Launching %d domain agent tasks for case=%s: %s",
        len(tasks),
        case_id,
        {k: len(v) for k, v in task_summary.items()},
    )

    async def _run_agent_with_session(
        task: AgentTask,
    ) -> tuple[str, DomainAgentOutput | None, str, UUID | None]:
        """Execute a single agent task with its own database session.

        Returns (agent_type, result, group_label, execution_id). Catches
        exceptions internally so the result always appears in the output dict
        — this ensures agents.py emits agent-error SSE events for failed
        agents instead of silently dropping them from the gather results.
        """
        try:
            run_fn = RUN_FNS[task.agent_type]
            async with db_session_factory() as db:
                result, execution_id = await run_fn(
                    case_id=case_id,
                    workflow_id=workflow_id,
                    user_id=user_id,
                    files=task.files,
                    hypotheses=hypotheses,
                    db_session=db,
                    publish_event=publish_event,
                    parent_execution_id=orchestrator_execution_id,
                    context_injection=task.context_injection,
                    stage_suffix=task.stage_suffix,
                )
                await db.commit()
                return task.agent_type, result, task.group_label, execution_id
        except Exception as exc:
            logger.error(
                "Domain agent %s (%s) failed with exception: %s",
                task.agent_type,
                task.group_label,
                exc,
            )
            return task.agent_type, None, task.group_label, None

    # Launch ALL tasks concurrently.
    # _run_agent_with_session handles Exception internally (returns clean tuple).
    # return_exceptions=True catches BaseException (CancelledError, SystemExit)
    # which the inner function intentionally does not catch.
    coros = [_run_agent_with_session(t) for t in tasks]
    results = await asyncio.gather(*coros, return_exceptions=True)

    # Map results back, grouped by agent type
    output: dict[str, list[DomainRunResult]] = {}
    successes = 0
    failures = 0

    for item in results:
        if isinstance(item, BaseException):
            logger.error("Domain agent task failed with exception: %s", item)
            failures += 1
            continue
        agent_type, result, group_label, execution_id = item
        if agent_type not in output:
            output[agent_type] = []
        output[agent_type].append(
            DomainRunResult(
                agent_type=agent_type,
                output=result,
                group_label=group_label,
                execution_id=execution_id,
            )
        )
        if result is not None:
            successes += 1
        else:
            failures += 1

    logger.info(
        "Domain agents completed for case=%s: total_tasks=%d successes=%d "
        "failures=%d agent_types=%s",
        case_id,
        len(tasks),
        successes,
        failures,
        list(output.keys()),
    )

    return output


# ---------------------------------------------------------------------------
# Strategy context builder
# ---------------------------------------------------------------------------


def build_strategy_context(
    domain_results: dict[str, list[DomainRunResult]],
) -> str:
    """Build text summaries of domain agent findings for the Strategy agent.

    Strategy agent receives TEXT summaries (not raw files) from other
    domain agents, per CONTEXT.md decision and RESEARCH.md Pitfall 4.

    Handles the multi-result-per-agent structure: iterates over all
    DomainRunResult objects for each agent type.

    Args:
        domain_results: Dict mapping agent type to list of DomainRunResult objects.

    Returns:
        Formatted text summary of all domain agent findings.
        Returns empty string if no results are available.
    """
    if not domain_results:
        return ""

    sections: list[str] = []

    for agent_type, run_results in domain_results.items():
        agent_display = agent_type.capitalize()

        for run_result in run_results:
            if run_result.output is None:
                sections.append(
                    f"--- {agent_display} Agent ({run_result.group_label}) ---\n"
                    "Agent execution failed or produced no output.\n"
                )
                continue

            result = run_result.output
            group_label = run_result.group_label

            findings = result.findings
            finding_count = len(findings)

            section_lines: list[str] = [
                f"--- {agent_display} Agent Findings ({group_label}, {finding_count} findings) ---"
            ]

            if not findings:
                if result.no_findings_explanation:
                    section_lines.append(
                        f"No findings: {result.no_findings_explanation}"
                    )
                else:
                    section_lines.append("No findings extracted.")
            else:
                for finding in findings:
                    # Extract first sentence of description for brevity
                    desc = finding.description
                    first_sentence = desc.split(". ")[0] if ". " in desc else desc[:200]
                    if not first_sentence.endswith("."):
                        first_sentence += "..."

                    section_lines.append(
                        f"[{finding.category}] {finding.title} "
                        f"(confidence: {finding.confidence:.0f}): {first_sentence}"
                    )

            # Add quality assessment for evidence agent (only EvidenceOutput has this field)
            if (
                isinstance(result, EvidenceOutput)
                and result.quality_assessment is not None
            ):
                quality = result.quality_assessment
                section_lines.append(
                    f"Quality Assessment: score={quality.overall_score:.0f}, "
                    f"recommendation={quality.recommendation}, "
                    f"corroboration={quality.corroboration_status}"
                )

            sections.append("\n".join(section_lines))

    return "\n\n".join(sections)
