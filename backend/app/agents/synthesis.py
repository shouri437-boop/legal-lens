# ABOUTME: Synthesis Agent runner that cross-references all domain findings and KG data.
# ABOUTME: Produces hypotheses, contradictions, gaps, timeline events, tasks, case summary, and verdict.

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from google.adk.agents import LlmAgent
from google.genai import types
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.base import PublishFn
from app.agents.domain_agent_runner import DomainAgentRunner
from app.agents.factory import AgentFactory
from app.models.case import Case
from app.models.file import CaseFile
from app.models.findings import CaseFinding
from app.models.investigation_task import InvestigationTask
from app.models.knowledge_graph import KgEntity, KgRelationship
from app.models.synthesis import (
    CaseContradiction,
    CaseGap,
    CaseHypothesis,
    CaseSynthesis,
    TimelineEvent,
)
from app.schemas.synthesis import SynthesisOutput

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Runner subclass (Strategy pattern)
# ---------------------------------------------------------------------------


class SynthesisAgentRunner(DomainAgentRunner[SynthesisOutput]):
    """Synthesis agent runner that assembles text-only input from DB data.

    Unlike standard domain agents that receive multimodal file content,
    the Synthesis Agent receives a pre-assembled text prompt containing
    case metadata, domain findings, and knowledge graph data. No files
    are sent -- text only.
    """

    def get_agent_name(self) -> str:
        return "synthesis"

    def _get_output_type(self) -> type[SynthesisOutput]:
        return SynthesisOutput

    def _create_agent_instance(
        self,
        case_id: str,
        model: str,
        publish_fn: PublishFn | None,
    ) -> LlmAgent:
        return AgentFactory.create_synthesis_agent(
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
        """Build text-only Content from pre-assembled synthesis input.

        The caller passes the fully assembled synthesis_input string
        via kwargs (assembled by assemble_synthesis_input).
        """
        synthesis_input = str(kwargs.get("synthesis_input", ""))

        return types.Content(
            role="user",
            parts=[types.Part(text=synthesis_input)],
        )


# ---------------------------------------------------------------------------
# Input assembly
# ---------------------------------------------------------------------------


async def assemble_synthesis_input(
    case_id: str,
    db: AsyncSession,
) -> str:
    """Assemble text-only input for the Synthesis Agent from DB data.

    Queries 5 data sources: case metadata, files, findings, entities,
    and relationships. Formats them into a structured text document
    with section markers that the SYNTHESIS_SYSTEM_PROMPT references.

    Args:
        case_id: UUID string of the case.
        db: Async database session.

    Returns:
        Assembled input string with all sections.
    """
    case_uuid = UUID(case_id)

    # 1. Query case metadata
    case_result = await db.execute(
        select(Case.name, Case.description, Case.type).where(Case.id == case_uuid)
    )
    case_row = case_result.one_or_none()
    case_name = case_row.name if case_row else "Unknown Case"
    case_description = case_row.description if case_row else ""
    case_type = case_row.type.value if case_row and case_row.type else "OTHER"

    # 2. Query file metadata
    file_result = await db.execute(
        select(CaseFile.original_filename, CaseFile.mime_type).where(
            CaseFile.case_id == case_uuid
        )
    )
    files_list = list(file_result.all())

    # 3. Query all case findings, ordered by agent_type and created_at
    findings_result = await db.execute(
        select(CaseFinding)
        .where(CaseFinding.case_id == case_uuid)
        .order_by(CaseFinding.agent_type, CaseFinding.created_at)
    )
    findings = list(findings_result.scalars().all())

    # 4. Query KG entities, ordered by entity_type
    entities_result = await db.execute(
        select(KgEntity)
        .where(KgEntity.case_id == case_uuid, KgEntity.merged_into_id.is_(None))
        .order_by(KgEntity.entity_type, KgEntity.name)
    )
    entities = list(entities_result.scalars().all())

    # 5. Query KG relationships with joined source/target entity names
    relationships_result = await db.execute(
        select(KgRelationship)
        .where(KgRelationship.case_id == case_uuid)
        .options(
            selectinload(KgRelationship.source_entity),
            selectinload(KgRelationship.target_entity),
        )
    )
    relationships = list(relationships_result.scalars().all())

    # --- Assemble sections ---
    parts: list[str] = []

    # Case metadata section
    parts.append("--- CASE METADATA ---")
    parts.append(f"Case Name: {case_name}")
    parts.append(f"Case Type: {case_type}")
    if case_description:
        parts.append(f"Description: {case_description}")
    parts.append("--- END CASE METADATA ---")

    # Files section
    parts.append("\n--- FILES ---")
    if files_list:
        for fname, ctype in files_list:
            parts.append(f"- {fname} ({ctype or 'unknown type'})")
    else:
        parts.append("No files uploaded.")
    parts.append("--- END FILES ---")

    # Domain agent findings section
    parts.append("\n--- DOMAIN AGENT FINDINGS ---")
    if findings:
        current_agent: str | None = None
        for finding in findings:
            if finding.agent_type != current_agent:
                current_agent = finding.agent_type
                agent_label = current_agent.upper() if current_agent else "UNKNOWN"
                parts.append(f"\n=== {agent_label} AGENT FINDINGS ===\n")
            parts.append(
                f"[FINDING:{finding.id}] [{finding.agent_type}] {finding.title}\n"
                f"{finding.finding_text}\n"
            )
    else:
        parts.append("No domain findings available.")
    parts.append("--- END DOMAIN AGENT FINDINGS ---")

    # Knowledge graph entities section
    parts.append("\n--- KNOWLEDGE GRAPH ENTITIES ---")
    if entities:
        for entity in entities:
            aliases_str = ", ".join(entity.aliases) if entity.aliases else "none"
            domains_str = ", ".join(entity.domains) if entity.domains else "unknown"
            parts.append(
                f"[ENTITY:{entity.id}:{entity.name}] "
                f"Type: {entity.entity_type}, "
                f"Description: {entity.description_brief or entity.context or 'N/A'}, "
                f"Aliases: {aliases_str}, "
                f"Domains: {domains_str}"
            )
    else:
        parts.append("No knowledge graph entities available.")
    parts.append("--- END KNOWLEDGE GRAPH ENTITIES ---")

    # Knowledge graph relationships section
    parts.append("\n--- KNOWLEDGE GRAPH RELATIONSHIPS ---")
    if relationships:
        for rel in relationships:
            source_name = (
                rel.source_entity.name
                if rel.source_entity
                else f"entity:{rel.source_entity_id}"
            )
            target_name = (
                rel.target_entity.name
                if rel.target_entity
                else f"entity:{rel.target_entity_id}"
            )
            evidence_str = rel.evidence_excerpt or "N/A"
            temporal_str = rel.temporal_context or "N/A"
            parts.append(
                f"{source_name} --[{rel.label} ({rel.relationship_type})]-> {target_name} "
                f"| Evidence: {evidence_str} | Temporal: {temporal_str}"
            )
    else:
        parts.append("No knowledge graph relationships available.")
    parts.append("--- END KNOWLEDGE GRAPH RELATIONSHIPS ---")

    assembled = "\n".join(parts)

    logger.info(
        "Assembled synthesis input case=%s: %d findings, %d entities, "
        "%d relationships, %d files, input_length=%d",
        case_id,
        len(findings),
        len(entities),
        len(relationships),
        len(files_list),
        len(assembled),
    )

    return assembled


# ---------------------------------------------------------------------------
# DB write logic
# ---------------------------------------------------------------------------


def _parse_iso_date(date_str: str | None) -> datetime | None:
    """Parse an ISO 8601 date string to a timezone-aware datetime.

    Handles various formats gracefully: full ISO with timezone,
    date-only, or partial dates. Returns None if parsing fails.
    """
    if not date_str:
        return None

    try:
        # Try full ISO 8601 with timezone
        if "T" in date_str:
            # Handle Z suffix
            normalized = date_str.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized)
        # Date-only: treat as midnight UTC
        return datetime.fromisoformat(date_str).replace(tzinfo=UTC)
    except (ValueError, TypeError):
        logger.warning("Could not parse date string: %s", date_str)
        return None


async def write_synthesis_output(
    case_id: str,
    output: SynthesisOutput,
    workflow_id: str,
    db: AsyncSession,
) -> dict[str, int]:
    """Write synthesis output to all destination tables.

    Clears existing synthesis data for the case (clear-and-rebuild),
    then inserts all synthesis results. Each record is wrapped in a
    savepoint to isolate malformed items.

    Writes to:
    - investigation_tasks (deleted first due to FK constraints)
    - timeline_events
    - case_gaps
    - case_contradictions
    - case_hypotheses
    - case_synthesis
    - Case model (verdict columns)

    Args:
        case_id: UUID string of the case.
        output: Parsed SynthesisOutput from the LLM agent.
        workflow_id: UUID string of the analysis workflow.
        db: Async database session.

    Returns:
        Dict with counts: hypotheses, contradictions, gaps, timeline_events, tasks.
    """
    case_uuid = UUID(case_id)
    workflow_uuid = UUID(workflow_id)

    # Delete existing synthesis data (order matters for FK constraints)
    await db.execute(
        delete(InvestigationTask).where(InvestigationTask.case_id == case_uuid)
    )
    await db.execute(delete(TimelineEvent).where(TimelineEvent.case_id == case_uuid))
    await db.execute(delete(CaseGap).where(CaseGap.case_id == case_uuid))
    await db.execute(
        delete(CaseContradiction).where(CaseContradiction.case_id == case_uuid)
    )
    await db.execute(delete(CaseHypothesis).where(CaseHypothesis.case_id == case_uuid))
    await db.execute(delete(CaseSynthesis).where(CaseSynthesis.case_id == case_uuid))
    await db.flush()

    # Track written records for FK linking in investigation_tasks
    written_hypotheses: list[CaseHypothesis] = []
    written_contradictions: list[CaseContradiction] = []
    written_gaps: list[CaseGap] = []

    # --- Write CaseSynthesis ---
    try:
        async with db.begin_nested():
            synthesis_record = CaseSynthesis(
                case_id=case_uuid,
                workflow_id=workflow_uuid,
                case_summary=output.case_summary,
                case_verdict=output.case_verdict.model_dump(mode="json"),
                cross_modal_links=[
                    link.model_dump(mode="json") for link in output.cross_modal_links
                ]
                if output.cross_modal_links
                else [],
                cross_domain_conclusions=[output.cross_domain_conclusions],
                key_findings_summary=json.dumps(
                    [kf.model_dump(mode="json") for kf in output.key_findings]
                ),
                risk_assessment=output.risk_assessment,
                timeline_event_count=len(output.timeline_events),
            )
            db.add(synthesis_record)
            await db.flush()
    except Exception:
        logger.warning(
            "Failed to write CaseSynthesis for case=%s",
            case_id,
            exc_info=True,
        )

    # --- Write CaseHypothesis records ---
    for hyp in output.hypotheses:
        try:
            # Derive status from confidence
            if hyp.confidence > 60:
                status = "SUPPORTED"
            elif hyp.confidence < 40:
                status = "REFUTED"
            else:
                status = "PENDING"

            # Split evidence by role
            supporting = [
                e.model_dump(mode="json")
                for e in hyp.evidence
                if e.role == "supporting"
            ]
            contradicting = [
                e.model_dump(mode="json")
                for e in hyp.evidence
                if e.role == "contradicting"
            ]

            async with db.begin_nested():
                hypothesis = CaseHypothesis(
                    case_id=case_uuid,
                    workflow_id=workflow_uuid,
                    claim=hyp.claim,
                    status=status,
                    confidence=hyp.confidence / 100.0,
                    supporting_evidence=supporting if supporting else None,
                    contradicting_evidence=contradicting if contradicting else None,
                    source_agent="synthesis",
                    reasoning=hyp.reasoning,
                )
                db.add(hypothesis)
                await db.flush()

            written_hypotheses.append(hypothesis)
        except Exception:
            logger.warning(
                "Skipping malformed hypothesis (claim=%s) for case=%s",
                hyp.claim[:80] if hyp.claim else "N/A",
                case_id,
                exc_info=True,
            )

    # --- Write CaseContradiction records ---
    for cont in output.contradictions:
        try:
            async with db.begin_nested():
                contradiction = CaseContradiction(
                    case_id=case_uuid,
                    workflow_id=workflow_uuid,
                    claim_a=cont.claim_a,
                    claim_b=cont.claim_b,
                    source_a={
                        "finding_id": cont.source_a_finding_id,
                        "excerpt": cont.source_a_excerpt,
                    },
                    source_b={
                        "finding_id": cont.source_b_finding_id,
                        "excerpt": cont.source_b_excerpt,
                    },
                    severity=cont.severity,
                    domain=cont.domain,
                )
                db.add(contradiction)
                await db.flush()

            written_contradictions.append(contradiction)
        except Exception:
            logger.warning(
                "Skipping malformed contradiction for case=%s",
                case_id,
                exc_info=True,
            )

    # --- Write CaseGap records ---
    for gap in output.gaps:
        try:
            async with db.begin_nested():
                gap_record = CaseGap(
                    case_id=case_uuid,
                    workflow_id=workflow_uuid,
                    description=gap.description,
                    what_is_missing=gap.what_is_missing,
                    why_needed=gap.why_needed,
                    priority=gap.priority,
                    suggested_actions=gap.suggested_actions,
                    related_entity_ids=gap.related_entity_ids or None,
                )
                db.add(gap_record)
                await db.flush()

            written_gaps.append(gap_record)
        except Exception:
            logger.warning(
                "Skipping malformed gap for case=%s",
                case_id,
                exc_info=True,
            )

    # --- Write TimelineEvent records ---
    timeline_count = 0
    for evt in output.timeline_events:
        try:
            event_date = _parse_iso_date(evt.event_date)
            event_end_date = _parse_iso_date(evt.event_end_date)

            # Build citations from source_finding_ids
            citations = (
                [{"finding_id": fid} for fid in evt.source_finding_ids]
                if evt.source_finding_ids
                else None
            )

            async with db.begin_nested():
                timeline_event = TimelineEvent(
                    case_id=case_uuid,
                    workflow_id=workflow_uuid,
                    title=evt.title,
                    description=evt.description,
                    event_date=event_date,
                    event_end_date=event_end_date,
                    event_type=evt.event_type,
                    layer=evt.domain,
                    source_entity_ids=evt.source_entity_ids or None,
                    citations=citations,
                )
                db.add(timeline_event)
                await db.flush()

            timeline_count += 1
        except Exception:
            logger.warning(
                "Skipping malformed timeline event (title=%s) for case=%s",
                evt.title[:80] if evt.title else "N/A",
                case_id,
                exc_info=True,
            )

    # --- Write InvestigationTask records ---
    task_count = 0
    for task in output.investigation_tasks:
        try:
            # Resolve source FK references using 0-based indexes
            source_hypothesis_id: UUID | None = None
            source_contradiction_id: UUID | None = None
            source_gap_id: UUID | None = None

            if (
                task.source_hypothesis_index is not None
                and 0 <= task.source_hypothesis_index < len(written_hypotheses)
            ):
                source_hypothesis_id = written_hypotheses[
                    task.source_hypothesis_index
                ].id

            if (
                task.source_contradiction_index is not None
                and 0 <= task.source_contradiction_index < len(written_contradictions)
            ):
                source_contradiction_id = written_contradictions[
                    task.source_contradiction_index
                ].id

            if task.source_gap_index is not None and 0 <= task.source_gap_index < len(
                written_gaps
            ):
                source_gap_id = written_gaps[task.source_gap_index].id

            async with db.begin_nested():
                investigation_task = InvestigationTask(
                    case_id=case_uuid,
                    workflow_id=workflow_uuid,
                    title=task.title,
                    description=task.description,
                    task_type=task.task_type,
                    priority=task.priority,
                    status="pending",
                    source_hypothesis_id=source_hypothesis_id,
                    source_contradiction_id=source_contradiction_id,
                    source_gap_id=source_gap_id,
                )
                db.add(investigation_task)
                await db.flush()

            task_count += 1
        except Exception:
            logger.warning(
                "Skipping malformed investigation task (title=%s) for case=%s",
                task.title[:80] if task.title else "N/A",
                case_id,
                exc_info=True,
            )

    # --- Update Case verdict columns ---
    try:
        verdict_summary = output.case_summary[:200] if output.case_summary else None
        await db.execute(
            update(Case)
            .where(Case.id == case_uuid)
            .values(
                verdict_label=output.case_verdict.evidence_strength,
                verdict_summary=verdict_summary,
            )
        )
        await db.flush()
    except Exception:
        logger.warning(
            "Failed to update Case verdict columns for case=%s",
            case_id,
            exc_info=True,
        )

    counts = {
        "hypotheses": len(written_hypotheses),
        "contradictions": len(written_contradictions),
        "gaps": len(written_gaps),
        "timeline_events": timeline_count,
        "tasks": task_count,
    }

    logger.info(
        "Wrote synthesis output for case=%s: %s",
        case_id,
        counts,
    )

    return counts


# ---------------------------------------------------------------------------
# Top-level runner
# ---------------------------------------------------------------------------


async def run_synthesis(
    case_id: str,
    workflow_id: str,
    user_id: str,
    db_session: AsyncSession,
    publish_event: PublishFn | None = None,
) -> dict[str, int]:
    """Run the Synthesis Agent end-to-end.

    Assembles input from case findings and knowledge graph data,
    runs the Synthesis Agent via DomainAgentRunner, and writes
    all synthesis results to the database.

    Args:
        case_id: UUID string of the case.
        workflow_id: UUID string of the analysis workflow.
        user_id: UUID string of the authenticated user.
        db_session: Async database session.
        publish_event: Optional SSE publish function.

    Returns:
        Dict with counts of written records.
    """
    # Assemble text-only input from DB
    input_text = await assemble_synthesis_input(case_id=case_id, db=db_session)

    # Run the Synthesis Agent via DomainAgentRunner
    output, _execution_id = await SynthesisAgentRunner().run(
        case_id=case_id,
        workflow_id=workflow_id,
        user_id=user_id,
        files=[],
        hypotheses=[],
        db_session=db_session,
        publish_event=publish_event,
        synthesis_input=input_text,
    )

    if output is None:
        logger.warning(
            "Synthesis agent produced no output for case=%s workflow=%s",
            case_id,
            workflow_id,
        )
        return {
            "hypotheses": 0,
            "contradictions": 0,
            "gaps": 0,
            "timeline_events": 0,
            "tasks": 0,
        }

    # Write synthesis output to all destination tables
    counts = await write_synthesis_output(
        case_id=case_id,
        output=output,
        workflow_id=workflow_id,
        db=db_session,
    )

    return counts
