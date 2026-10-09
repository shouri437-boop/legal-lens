# ABOUTME: Analysis pipeline orchestrator with session-per-stage architecture.
# ABOUTME: Runs as a background task coordinating triage, orchestrator, domain agents, and synthesis.

import logging
import time
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import get_settings
from app.models import Case, CaseFile
from app.models.agent_execution import AgentExecution
from app.models.case import CaseStatus
from app.models.file import FileStatus
from app.models.findings import CaseFinding
from app.services.agent_events import (
    build_execution_metadata,
    clear_event_buffer,
    emit_agent_complete,
    emit_agent_error,
    emit_agent_started,
    emit_finding_committed,
    emit_processing_complete,
    emit_synthesis_data_ready,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Session-scoped status helpers
# ---------------------------------------------------------------------------


async def _update_case_status(
    session_factory: async_sessionmaker[AsyncSession],
    case_id: str,
    status: CaseStatus,
) -> None:
    """Update case status using a fresh, short-lived DB session."""
    async with session_factory() as db:
        await db.execute(
            update(Case).where(Case.id == UUID(case_id)).values(status=status)
        )
        await db.commit()


async def _ensure_case_not_stuck(
    session_factory: async_sessionmaker[AsyncSession],
    case_id: str,
) -> None:
    """Safety net: if case is still PROCESSING after pipeline exits, force to ERROR.

    Called from the finally block to guarantee cases never get stuck in PROCESSING.
    """
    try:
        async with session_factory() as db:
            result = await db.execute(
                select(Case.status).where(Case.id == UUID(case_id))
            )
            current = result.scalar_one_or_none()
            if current == CaseStatus.PROCESSING:
                logger.warning(
                    "Safety net: forcing case %s from PROCESSING to ERROR",
                    case_id,
                )
                await db.execute(
                    update(Case)
                    .where(Case.id == UUID(case_id))
                    .values(status=CaseStatus.ERROR)
                )
                await db.commit()
    except Exception:
        logger.exception("Safety net failed for case=%s", case_id)


async def _handle_pipeline_error(
    session_factory: async_sessionmaker[AsyncSession],
    case_id: str,
    file_ids: list[str],
    workflow_id: str,
    exc: BaseException,
) -> None:
    """Handle pipeline-level errors using a fresh DB session.

    Updates file statuses to ERROR, case status to ERROR, and emits
    an error SSE event.
    """
    try:
        async with session_factory() as db:
            await db.execute(
                update(CaseFile)
                .where(CaseFile.id.in_([UUID(fid) for fid in file_ids]))
                .values(status=FileStatus.ERROR)
            )
            await db.execute(
                update(Case)
                .where(Case.id == UUID(case_id))
                .values(status=CaseStatus.ERROR)
            )
            await db.commit()
    except Exception:
        logger.exception("Failed to update statuses to ERROR for case=%s", case_id)

    await emit_agent_error(
        case_id=case_id,
        agent_type="pipeline",
        task_id=workflow_id,
        error=str(exc)[:500],
    )


# ---------------------------------------------------------------------------
# Background analysis task
# ---------------------------------------------------------------------------


async def run_analysis_workflow(
    case_id: str,
    workflow_id: str,
    user_id: str,
    file_ids: list[str],
) -> None:
    """Background task that orchestrates the stage-isolated analysis pipeline.

    Each stage gets a FRESH ADK session to prevent context window bloat
    from multimodal file content. Inter-stage data flows via database.

    Steps:
    1. Update file statuses to QUEUED
    2. Stage 1: Run Triage Agent (fresh session, multimodal files)
    3. Stage 2: Run Orchestrator Agent (fresh session, text-only input)
    4. Stage 3: Run Domain Agents (file-group-based parallel fresh sessions)
    5. Stage 4: HITL for low-confidence findings
    6. Stage 5: Save Findings to case_findings table
    7. Stage 6: Build Knowledge Graph (entities, relationships, dedup)
    8. Stage 6b: Backfill finding-to-entity links
    9. Update file statuses to ANALYZED
    10. Emit processing-complete event

    SSE events emitted at each stage transition:
    - agent-started: When an agent within a stage starts
    - agent-complete: When an agent finishes
    - agent-error: When an agent encounters an error
    - processing-complete: When entire pipeline is done
    """
    # Import here to avoid circular dependency (agents -> services -> agents)
    from app.agents.base import create_sse_publish_fn
    from app.agents.domain_runner import (
        DomainRunResult,
        compute_agent_tasks,
        run_domain_agents_parallel,
    )
    from app.agents.kg_builder import run_kg_builder
    from app.agents.orchestrator import run_orchestrator
    from app.agents.synthesis import run_synthesis
    from app.agents.triage import run_triage
    from app.database import _get_sessionmaker
    from app.models.knowledge_graph import KgEntity
    from app.services.confirmation import (
        BatchConfirmationItem,
        request_batch_confirmation,
        request_confirmation,
    )
    from app.services.findings_service import (
        save_findings_from_output,
        update_finding_entity_ids,
    )

    settings = get_settings()
    session_factory = _get_sessionmaker()
    pipeline_start = time.monotonic()

    # Clear stale events from any previous workflow for this case
    clear_event_buffer(case_id)

    # Create a bound SSE publish function for real-time THINKING_UPDATE events
    publish_fn = create_sse_publish_fn(case_id)

    async with session_factory() as db:
        try:
            # ---- Step 1: Update file statuses to QUEUED ----
            await db.execute(
                update(CaseFile)
                .where(CaseFile.id.in_([UUID(fid) for fid in file_ids]))
                .values(status=FileStatus.QUEUED)
            )
            await db.commit()

            # ---- Step 2: Load files for triage ----
            file_query = await db.execute(
                select(CaseFile).where(CaseFile.id.in_([UUID(fid) for fid in file_ids]))
            )
            files = list(file_query.scalars().all())

            if not files:
                logger.error(
                    "No files found for workflow=%s case=%s",
                    workflow_id,
                    case_id,
                )
                return

            # Update files to PROCESSING
            await db.execute(
                update(CaseFile)
                .where(CaseFile.id.in_([UUID(fid) for fid in file_ids]))
                .values(status=FileStatus.PROCESSING)
            )
            await db.commit()

            # ---- Stage 1: Triage ----
            logger.info(
                "Pipeline starting stage=triage case=%s workflow=%s files=%d",
                case_id,
                workflow_id,
                len(files),
            )
            triage_start = time.monotonic()
            triage_task_id = str(uuid4())

            # Emit started event for first file (representing the batch)
            first_file = files[0]
            await emit_agent_started(
                case_id=case_id,
                agent_type="triage",
                task_id=triage_task_id,
                file_id=str(first_file.id),
                file_name=first_file.original_filename,
            )

            triage_output = await run_triage(
                case_id=case_id,
                workflow_id=workflow_id,
                user_id=user_id,
                files=files,
                db_session=db,
                publish_event=publish_fn,
            )

            if triage_output is None:
                await emit_agent_error(
                    case_id=case_id,
                    agent_type="triage",
                    task_id=triage_task_id,
                    error="Triage failed to produce structured output",
                )
                # Update file statuses to ERROR
                await db.execute(
                    update(CaseFile)
                    .where(CaseFile.id.in_([UUID(fid) for fid in file_ids]))
                    .values(status=FileStatus.ERROR)
                )
                await db.commit()
                return

            # Query triage execution record for metadata and parent chain
            triage_exec_result = await db.execute(
                select(AgentExecution)
                .where(
                    AgentExecution.workflow_id == UUID(workflow_id),
                    AgentExecution.agent_name == "triage",
                )
                .order_by(AgentExecution.created_at.desc())
                .limit(1)
            )
            triage_execution = triage_exec_result.scalar_one_or_none()

            # Build enriched metadata for triage completion event
            triage_metadata = (
                build_execution_metadata(triage_execution, settings.flash_model)
                if triage_execution
                else {}
            )

            await emit_agent_complete(
                case_id=case_id,
                agent_type="triage",
                task_id=triage_task_id,
                result={
                    "taskId": triage_task_id,
                    "agentType": "triage",
                    "outputs": [
                        {
                            "type": "triage-results",
                            "data": {
                                "fileCount": len(triage_output.file_results),
                                "groupings": len(triage_output.suggested_groupings),
                            },
                        }
                    ],
                    "metadata": triage_metadata,
                },
            )

            # Commit so the triage execution record is visible to snapshot
            # queries from reconnecting SSE clients during orchestrator execution.
            await db.commit()

            # ---- Stage 2: Orchestrator ----
            triage_duration_s = time.monotonic() - triage_start
            logger.info(
                "Pipeline starting stage=orchestrator case=%s workflow=%s triage_duration_s=%.2f",
                case_id,
                workflow_id,
                triage_duration_s,
            )

            orchestrator_task_id = str(uuid4())
            await emit_agent_started(
                case_id=case_id,
                agent_type="orchestrator",
                task_id=orchestrator_task_id,
                file_id=str(first_file.id),
                file_name="routing-analysis",
            )

            orchestrator_output = await run_orchestrator(
                case_id=case_id,
                workflow_id=workflow_id,
                user_id=user_id,
                triage_output=triage_output,
                db_session=db,
                publish_event=publish_fn,
                parent_execution_id=(triage_execution.id if triage_execution else None),
            )

            orch_execution: AgentExecution | None = None
            if orchestrator_output is None:
                await emit_agent_error(
                    case_id=case_id,
                    agent_type="orchestrator",
                    task_id=orchestrator_task_id,
                    error="Orchestrator failed to produce routing decisions",
                )
                # Files stay in PROCESSING -- partial results preserved
                await db.commit()
            else:
                # Query orchestrator execution record for metadata
                orch_exec_result = await db.execute(
                    select(AgentExecution)
                    .where(
                        AgentExecution.workflow_id == UUID(workflow_id),
                        AgentExecution.agent_name == "orchestrator",
                    )
                    .order_by(AgentExecution.created_at.desc())
                    .limit(1)
                )
                orch_execution = orch_exec_result.scalar_one_or_none()

                orch_metadata = (
                    build_execution_metadata(orch_execution, settings.pro_model)
                    if orch_execution
                    else {}
                )

                await emit_agent_complete(
                    case_id=case_id,
                    agent_type="orchestrator",
                    task_id=orchestrator_task_id,
                    result={
                        "taskId": orchestrator_task_id,
                        "agentType": "orchestrator",
                        "outputs": [
                            {
                                "type": "routing-decisions",
                                "data": {
                                    "routingCount": len(
                                        orchestrator_output.routing_decisions
                                    ),
                                    "parallelAgents": orchestrator_output.parallel_agents,
                                    "researchTriggered": orchestrator_output.research_trigger.should_trigger,
                                },
                            }
                        ],
                        "routingDecisions": [
                            {
                                "fileId": rd.file_id,
                                "fileName": rd.file_name or "",
                                "targetAgent": agent,
                                "reason": rd.reasoning,
                                "domainScore": getattr(rd.domain_scores, agent, 0),
                                "priority": rd.priority,
                                "routingConfidence": rd.routing_confidence,
                            }
                            for rd in orchestrator_output.routing_decisions
                            for agent in rd.target_agents
                        ],
                        "metadata": orch_metadata,
                    },
                )

                # Commit so the orchestrator execution record is visible to
                # domain agent sessions (separate DB sessions via session_factory).
                await db.commit()

            # ---- Stage 3: Domain Agents (File-Group-Based Parallel) ----
            # domain_results type: dict[str, list[DomainRunResult]]
            # where key=agent_type, value=list of DomainRunResult per group
            domain_results: dict[str, list[DomainRunResult]] = {}

            if orchestrator_output:
                logger.info(
                    "Pipeline starting stage=domain_agents case=%s workflow=%s",
                    case_id,
                    workflow_id,
                )

                # Use compute_agent_tasks (single source of truth) to determine what
                # agent instances will run. This is the same function that
                # run_domain_agents_parallel calls internally, ensuring SSE events
                # match exactly the tasks that will execute.
                expected_tasks = compute_agent_tasks(orchestrator_output, files)

                # ---- Routing HITL: per-agent-type confidence thresholds ----
                # Step 1: Identify (file, agent) pairs below per-agent thresholds
                skip_per_agent_hitl = True
                flagged_pairs: list[dict[str, object]] = []
                for rd in orchestrator_output.routing_decisions:
                    if rd.routing_confidence is None:
                        continue
                    for agent_type in rd.target_agents:
                        threshold = settings.get_routing_hitl_threshold(agent_type)
                        if rd.routing_confidence < threshold:
                            flagged_pairs.append(
                                {
                                    "file_name": rd.file_name or rd.file_id,
                                    "agent": agent_type,
                                    "confidence": rd.routing_confidence,
                                    "threshold": threshold,
                                }
                            )

                # Step 2: Plan-level HITL overview when flagged pairs exist
                if flagged_pairs:
                    plan_confirmation = await request_confirmation(
                        case_id=case_id,
                        agent_type="orchestrator",
                        action_description=(
                            f"Routing plan ready. {len(flagged_pairs)} agent "
                            f"assignment(s) flagged for review. Approve all or "
                            f"review individually?"
                        ),
                        affected_items=[
                            f"{p['file_name']} -> {p['agent']}" for p in flagged_pairs
                        ],
                        context={
                            "total_decisions": len(
                                orchestrator_output.routing_decisions
                            ),
                            "flagged_count": len(flagged_pairs),
                            "flagged_pairs": flagged_pairs,
                            "routing_summary": orchestrator_output.routing_summary,
                        },
                    )
                    skip_per_agent_hitl = plan_confirmation.approved

                # Step 3: Per-agent HITL (only if user chose to review individually)
                # Sends ONE batch SSE event so the frontend renders a single
                # multi-item review dialog. Pipeline blocks on one await.
                if not skip_per_agent_hitl:
                    batch_items: list[BatchConfirmationItem] = []
                    # Map item_id -> (file_id, agent_type) for processing results
                    item_mapping: dict[str, tuple[str, str]] = {}

                    for rd in orchestrator_output.routing_decisions:
                        if rd.routing_confidence is None:
                            continue
                        for agent_type in rd.target_agents:
                            threshold = settings.get_routing_hitl_threshold(agent_type)
                            if rd.routing_confidence < threshold:
                                item_id = str(uuid4())
                                item_mapping[item_id] = (
                                    rd.file_id,
                                    agent_type,
                                )
                                batch_items.append(
                                    BatchConfirmationItem(
                                        item_id=item_id,
                                        action_description=(
                                            f"Deploy {agent_type} agent on "
                                            f"'{rd.file_name or rd.file_id}'? "
                                            f"(confidence: "
                                            f"{rd.routing_confidence:.0f}/100)"
                                        ),
                                        affected_items=[rd.file_id],
                                        context={
                                            "file_id": rd.file_id,
                                            "file_name": rd.file_name,
                                            "agent_under_review": agent_type,
                                            "all_target_agents": rd.target_agents,
                                            "routing_confidence": (
                                                rd.routing_confidence
                                            ),
                                            "hitl_threshold": threshold,
                                            "reasoning": rd.reasoning,
                                            "domain_scores": (
                                                rd.domain_scores.model_dump()
                                            ),
                                        },
                                    )
                                )

                    if batch_items:
                        batch_result = await request_batch_confirmation(
                            case_id=case_id,
                            agent_type="orchestrator",
                            items=batch_items,
                            context={
                                "routing_summary": (
                                    orchestrator_output.routing_summary
                                ),
                            },
                        )
                        # Map rejections back to routing decisions
                        rejections: dict[str, list[str]] = {}
                        for decision in batch_result.decisions:
                            if not decision.approved:
                                file_id, rejected_agent = item_mapping[decision.item_id]
                                rejections.setdefault(file_id, []).append(
                                    rejected_agent
                                )
                        for rd in orchestrator_output.routing_decisions:
                            to_remove = rejections.get(rd.file_id, [])
                            if to_remove:
                                rd.target_agents = [
                                    a for a in rd.target_agents if a not in to_remove
                                ]

                # Step 4: Clean up empty routing decisions and file groups
                orchestrator_output.routing_decisions = [
                    rd
                    for rd in orchestrator_output.routing_decisions
                    if rd.target_agents
                ]
                for fg in orchestrator_output.file_groups:
                    valid_agents: set[str] = set()
                    for rd in orchestrator_output.routing_decisions:
                        if rd.file_id in fg.file_ids:
                            valid_agents.update(rd.target_agents)
                    fg.target_agents = [
                        a for a in fg.target_agents if a in valid_agents
                    ]
                orchestrator_output.file_groups = [
                    fg for fg in orchestrator_output.file_groups if fg.target_agents
                ]
                expected_tasks = compute_agent_tasks(orchestrator_output, files)

                # Build lookup: compound_id -> list of original filenames
                domain_file_names: dict[str, list[str]] = {}
                for task in expected_tasks:
                    cid = f"{task.agent_type}_{task.group_label}"
                    domain_file_names[cid] = [f.original_filename for f in task.files]

                # Emit agent-started for each expected (agent_type, group_label) pair
                # Use compound identifier: "{agent_type}_{group_label}"
                domain_task_ids: dict[str, str] = {}  # compound_id -> task_id
                for task in expected_tasks:
                    compound_id = f"{task.agent_type}_{task.group_label}"
                    task_id = str(uuid4())
                    domain_task_ids[compound_id] = task_id
                    await emit_agent_started(
                        case_id=case_id,
                        agent_type=compound_id,
                        task_id=task_id,
                        file_id=str(first_file.id),
                        file_name=f"{task.agent_type}-{task.group_label}",
                    )

                # Run file-group-based parallel domain agents
                # (each creates own DB session via session_factory)
                domain_results = await run_domain_agents_parallel(
                    case_id=case_id,
                    workflow_id=workflow_id,
                    user_id=user_id,
                    routing=orchestrator_output,
                    files=files,
                    hypotheses=[],  # Empty until hypothesis system exists (Phase 7)
                    db_session_factory=session_factory,
                    publish_event=publish_fn,
                    orchestrator_execution_id=(
                        orch_execution.id if orch_execution else None
                    ),
                )

                # Emit agent-complete/error for each agent instance
                for domain_agent, domain_run_list in domain_results.items():
                    for run_result in domain_run_list:
                        compound_id = f"{domain_agent}_{run_result.group_label}"
                        task_id = domain_task_ids.get(compound_id, str(uuid4()))

                        if run_result.output is not None:
                            finding_count = len(run_result.output.findings)
                            entity_count = len(run_result.output.entities)

                            # Look up execution record for SSE metadata
                            agent_metadata: dict[str, object] = {}
                            if run_result.execution_id is not None:
                                exec_result = await db.execute(
                                    select(AgentExecution).where(
                                        AgentExecution.id == run_result.execution_id,
                                    )
                                )
                                agent_exec = exec_result.scalar_one_or_none()
                                if agent_exec:
                                    agent_metadata = build_execution_metadata(
                                        agent_exec, settings.pro_model
                                    )

                            await emit_agent_complete(
                                case_id=case_id,
                                agent_type=compound_id,
                                task_id=task_id,
                                result={
                                    "taskId": task_id,
                                    "agentType": compound_id,
                                    "baseAgentType": domain_agent,
                                    "groupLabel": run_result.group_label,
                                    "fileNames": domain_file_names.get(compound_id, []),
                                    "outputs": [
                                        {
                                            "type": f"{domain_agent}-findings",
                                            "data": {
                                                "findingCount": finding_count,
                                                "entityCount": entity_count,
                                                "groupLabel": run_result.group_label,
                                            },
                                        }
                                    ],
                                    "metadata": agent_metadata,
                                },
                            )
                        else:
                            await emit_agent_error(
                                case_id=case_id,
                                agent_type=compound_id,
                                task_id=task_id,
                                error=f"{domain_agent} agent ({run_result.group_label}) failed to produce output",
                            )

                # Bug fix: emit agent-error for expected tasks that have no results.
                # run_domain_agents_parallel may swallow BaseException, leaving
                # compound IDs with no agent-complete/agent-error event.
                covered_compound_ids: set[str] = set()
                for domain_agent, domain_run_list in domain_results.items():
                    for run_result in domain_run_list:
                        covered_compound_ids.add(
                            f"{domain_agent}_{run_result.group_label}"
                        )

                for compound_id, task_id in domain_task_ids.items():
                    if compound_id not in covered_compound_ids:
                        await emit_agent_error(
                            case_id=case_id,
                            agent_type=compound_id,
                            task_id=task_id,
                            error=f"Agent {compound_id} did not return any result",
                        )

            # ---- Stage 4: HITL for Low-Confidence Findings ----
            if domain_results:
                for domain_agent, domain_run_list in domain_results.items():
                    for run_result in domain_run_list:
                        if run_result.output is None:
                            continue
                        for finding in run_result.output.findings:
                            if finding.confidence < settings.confidence_threshold:
                                logger.info(
                                    "Low-confidence finding from %s (%s): %s "
                                    "(confidence=%s), requesting HITL",
                                    domain_agent,
                                    run_result.group_label,
                                    finding.title,
                                    finding.confidence,
                                )
                                confirmation_result = await request_confirmation(
                                    case_id=case_id,
                                    agent_type=domain_agent,
                                    action_description=(
                                        f"Low-confidence finding "
                                        f"({finding.confidence}/100): {finding.title}"
                                    ),
                                    affected_items=[
                                        c.file_id for c in finding.citations
                                    ],
                                    context={
                                        "finding_title": finding.title,
                                        "finding_category": finding.category,
                                        "finding_description": finding.description[
                                            :500
                                        ],
                                        "confidence": finding.confidence,
                                        "agent": domain_agent,
                                        "group_label": run_result.group_label,
                                    },
                                )
                                if not confirmation_result.approved:
                                    logger.info(
                                        "Finding rejected by user: %s from %s/%s "
                                        "(reason: %s)",
                                        finding.title,
                                        domain_agent,
                                        run_result.group_label,
                                        confirmation_result.reason,
                                    )
                                    # Mark finding as rejected (for audit trail)
                                    # Finding remains in output but excluded from KG in Phase 7

            # ---- Stage 5: Save Findings to case_findings ----
            logger.info(
                "Pipeline starting stage=save_findings case=%s workflow=%s",
                case_id,
                workflow_id,
            )
            all_saved_findings: list[CaseFinding] = []
            for domain_agent, domain_run_list in domain_results.items():
                for run_result in domain_run_list:
                    if run_result.output is None:
                        continue

                    saved = await save_findings_from_output(
                        output=run_result.output,
                        agent_type=domain_agent,
                        execution_id=run_result.execution_id,
                        case_id=UUID(case_id),
                        workflow_id=UUID(workflow_id),
                        file_group_label=run_result.group_label,
                        db=db,
                    )
                    all_saved_findings.extend(saved)
                    for f in saved:
                        await emit_finding_committed(
                            case_id=case_id,
                            finding_id=str(f.id),
                            agent_type=domain_agent,
                            title=f.title,
                        )

            await db.commit()  # Commit findings before KG building

            # ---- Stage 6: Build Knowledge Graph (LLM-based KG Builder) ----
            logger.info(
                "Pipeline starting stage=kg_builder case=%s workflow=%s",
                case_id,
                workflow_id,
            )

            kg_builder_task_id = str(uuid4())
            await emit_agent_started(
                case_id=case_id,
                agent_type="kg_builder",
                task_id=kg_builder_task_id,
                file_id="",
                file_name="knowledge-graph-builder",
            )

            try:
                kg_entities_created, kg_relationships_created = await run_kg_builder(
                    case_id=case_id,
                    workflow_id=workflow_id,
                    user_id=user_id,
                    domain_results=domain_results,
                    db_session=db,
                    publish_event=publish_fn,
                )
                await emit_agent_complete(
                    case_id=case_id,
                    agent_type="kg_builder",
                    task_id=kg_builder_task_id,
                    result={
                        "taskId": kg_builder_task_id,
                        "agentType": "kg_builder",
                        "outputs": [
                            {
                                "type": "kg-builder-results",
                                "data": {
                                    "entitiesCreated": kg_entities_created,
                                    "relationshipsCreated": kg_relationships_created,
                                },
                            }
                        ],
                    },
                )
            except Exception as exc:
                logger.exception("KG Builder failed for case=%s: %s", case_id, exc)
                kg_entities_created = 0
                kg_relationships_created = 0
                # Clear poisoned session state so db.commit() below doesn't
                # cascade-fail with PendingRollbackError and kill the pipeline.
                await db.rollback()
                await emit_agent_error(
                    case_id=case_id,
                    agent_type="kg_builder",
                    task_id=kg_builder_task_id,
                    error=str(exc)[:500],
                )

            await db.commit()  # Commit KG data

            logger.info(
                "KG build complete case=%s entities=%d relationships=%d",
                case_id,
                kg_entities_created,
                kg_relationships_created,
            )

            # ---- Stage 6b: Backfill finding-to-entity links ----
            # For each saved finding, find KG entities that came from the same
            # agent execution and link them via the entity_ids JSONB field.
            for finding in all_saved_findings:
                if finding.agent_execution_id is None:
                    continue
                # Query entities created from this execution
                entity_result = await db.execute(
                    select(KgEntity.id).where(
                        KgEntity.source_execution_id == finding.agent_execution_id,
                        KgEntity.merged_into_id.is_(None),
                    )
                )
                linked_entity_ids = [str(eid) for (eid,) in entity_result.all()]
                if linked_entity_ids:
                    await update_finding_entity_ids(
                        finding_id=finding.id,
                        entity_ids=linked_entity_ids,
                        db=db,
                    )
            await db.commit()

            # ---- Stage 7: Synthesis Agent ----
            logger.info(
                "Pipeline starting stage=synthesis case=%s workflow=%s",
                case_id,
                workflow_id,
            )
            synthesis_task_id = str(uuid4())
            await emit_agent_started(
                case_id=case_id,
                agent_type="synthesis",
                task_id=synthesis_task_id,
                file_id="",
                file_name="synthesis-agent",
            )

            synthesis_counts: dict[str, int] = {}
            try:
                synthesis_counts = await run_synthesis(
                    case_id=case_id,
                    workflow_id=workflow_id,
                    user_id=user_id,
                    db_session=db,
                    publish_event=publish_fn,
                )
                await emit_agent_complete(
                    case_id=case_id,
                    agent_type="synthesis",
                    task_id=synthesis_task_id,
                    result={
                        "taskId": synthesis_task_id,
                        "agentType": "synthesis",
                        "outputs": [
                            {
                                "type": "synthesis-results",
                                "data": synthesis_counts,
                            }
                        ],
                    },
                )
            except Exception as exc:
                logger.exception("Synthesis failed for case=%s: %s", case_id, exc)
                await db.rollback()
                await emit_agent_error(
                    case_id=case_id,
                    agent_type="synthesis",
                    task_id=synthesis_task_id,
                    error=str(exc)[:500],
                )

            await db.commit()  # Commit synthesis data

            # Emit synthesis-data-ready AFTER commit so frontend can safely fetch
            if synthesis_counts:
                await emit_synthesis_data_ready(
                    case_id=case_id,
                    counts=synthesis_counts,
                )

            logger.info(
                "Synthesis complete case=%s counts=%s",
                case_id,
                synthesis_counts,
            )

            # Geospatial agent is on-demand only (triggered from Geospatial tab).
            # Not part of the automatic pipeline.

            # ---- Final: Update file statuses to ANALYZED ----
            await db.execute(
                update(CaseFile)
                .where(CaseFile.id.in_([UUID(fid) for fid in file_ids]))
                .values(status=FileStatus.ANALYZED)
            )
            await db.commit()

            # ---- Final: Emit processing-complete ----
            # Count findings and entities across all domain agents (multi-result structure)
            total_findings = 0
            total_domain_entities = 0
            for _, domain_run_list in domain_results.items():
                for run_result in domain_run_list:
                    if run_result.output is not None:
                        total_findings += len(run_result.output.findings)
                        total_domain_entities += len(run_result.output.entities)

            total_entities = sum(len(fr.entities) for fr in triage_output.file_results)
            total_duration_s = time.monotonic() - pipeline_start
            total_duration_ms = int(total_duration_s * 1000)

            # Aggregate token usage across all executions in this workflow
            all_exec_result = await db.execute(
                select(AgentExecution).where(
                    AgentExecution.workflow_id == UUID(workflow_id),
                )
            )
            all_executions = list(all_exec_result.scalars().all())
            total_input_tokens = sum(e.input_tokens or 0 for e in all_executions)
            total_output_tokens = sum(e.output_tokens or 0 for e in all_executions)

            await emit_processing_complete(
                case_id=case_id,
                files_processed=len(files),
                entities_created=total_entities
                + total_domain_entities
                + kg_entities_created,
                relationships_created=kg_relationships_created,
                total_duration_ms=total_duration_ms,
                total_input_tokens=total_input_tokens,
                total_output_tokens=total_output_tokens,
            )

            # Free replay buffer memory now that all events have been dispatched.
            # Any future SSE reconnect will get full state from the DB snapshot.
            clear_event_buffer(case_id)

            # Update case status to READY on successful completion
            await _update_case_status(session_factory, case_id, CaseStatus.READY)

            logger.info(
                "Pipeline complete case=%s workflow=%s files=%d "
                "total_duration_s=%.2f entities=%d kg_entities=%d "
                "kg_relationships=%d findings=%d",
                case_id,
                workflow_id,
                len(files),
                total_duration_s,
                total_entities + total_domain_entities,
                kg_entities_created,
                kg_relationships_created,
                total_findings,
            )

        except Exception as exc:
            pipeline_duration_s = time.monotonic() - pipeline_start
            logger.exception(
                "Pipeline failed case=%s workflow=%s duration_s=%.2f error=%s",
                case_id,
                workflow_id,
                pipeline_duration_s,
                exc,
            )
            await _handle_pipeline_error(
                session_factory, case_id, file_ids, workflow_id, exc
            )
        finally:
            # Safety net: if case is still PROCESSING, force to ERROR.
            # Guarantees cases never get permanently stuck.
            await _ensure_case_not_stuck(session_factory, case_id)
