# ABOUTME: LLM-based KG Builder agent that reads all domain findings holistically.
# ABOUTME: Produces curated entities with semantic relationships, replacing programmatic co-occurrence builder.

from __future__ import annotations

import json
import logging
from uuid import UUID

from google.adk.agents import LlmAgent
from google.genai import types
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import PublishFn
from app.agents.domain_agent_runner import DomainAgentRunner
from app.agents.factory import AgentFactory
from app.models.file import CaseFile
from app.models.knowledge_graph import KgEntity, KgRelationship
from app.schemas.kg_builder import KgBuilderOutput

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Runner subclass (Strategy pattern)
# ---------------------------------------------------------------------------


class KgBuilderAgentRunner(DomainAgentRunner[KgBuilderOutput]):
    """KG Builder agent runner that assembles text-only input from all domain findings.

    Unlike standard domain agents that receive multimodal file content,
    the KG Builder receives pre-assembled text: case description, domain
    agent findings (with [FINDING:uuid] prefixes), and DomainEntity lists
    serialized as JSON. No files are sent -- text only.
    """

    def get_agent_name(self) -> str:
        return "kg_builder"

    def _get_output_type(self) -> type[KgBuilderOutput]:
        return KgBuilderOutput

    def _create_agent_instance(
        self,
        case_id: str,
        model: str,
        publish_fn: PublishFn | None,
    ) -> LlmAgent:
        return AgentFactory.create_kg_builder_agent(
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
        """Build text-only Content from pre-assembled KG Builder input.

        The caller passes findings_text, entities_json, and case_description
        via kwargs (assembled by assemble_kg_builder_input).
        """
        findings_text = str(kwargs.get("findings_text", ""))
        entities_json = str(kwargs.get("entities_json", ""))
        case_description = str(kwargs.get("case_description", ""))

        parts: list[str] = []

        if case_description:
            parts.append(
                "--- CASE DESCRIPTION ---\n"
                f"{case_description}\n"
                "--- END CASE DESCRIPTION ---"
            )

        if findings_text:
            parts.append(
                "\n\n--- DOMAIN AGENT FINDINGS ---\n"
                f"{findings_text}\n"
                "--- END DOMAIN AGENT FINDINGS ---"
            )

        if entities_json:
            parts.append(
                "\n\n--- DOMAIN ENTITY LISTS (JSON) ---\n"
                f"{entities_json}\n"
                "--- END DOMAIN ENTITY LISTS ---"
            )

        if not parts:
            parts.append(
                "No domain findings available. Return empty entities and relationships lists."
            )

        prompt = "\n".join(parts)

        return types.Content(
            role="user",
            parts=[types.Part(text=prompt)],
        )


# ---------------------------------------------------------------------------
# Input assembly
# ---------------------------------------------------------------------------


async def assemble_kg_builder_input(
    case_id: str,
    domain_results: dict[str, list[object]],
    db: AsyncSession,
) -> tuple[str, str, str]:
    """Assemble text-only input for the KG Builder agent.

    Queries all CaseFinding rows for the case, formats findings with
    [FINDING:uuid] prefixes grouped by agent_type, extracts DomainEntity
    lists from domain_results, and fetches the case description.

    Args:
        case_id: UUID string of the case.
        domain_results: Maps agent_type to list of DomainRunResult objects.
        db: Async database session.

    Returns:
        Tuple of (findings_text, entities_json, case_description).
    """
    from app.models.case import Case
    from app.models.findings import CaseFinding

    # 1. Query all case findings, ordered by agent_type and created_at
    findings_result = await db.execute(
        select(CaseFinding)
        .where(CaseFinding.case_id == UUID(case_id))
        .order_by(CaseFinding.agent_type, CaseFinding.created_at)
    )
    findings = list(findings_result.scalars().all())

    # Format findings with [FINDING:uuid] prefix, grouped by agent_type
    findings_parts: list[str] = []
    current_agent: str | None = None
    for finding in findings:
        if finding.agent_type != current_agent:
            current_agent = finding.agent_type
            findings_parts.append(f"\n=== {current_agent.upper()} AGENT FINDINGS ===\n")
        findings_parts.append(
            f"[FINDING:{finding.id}] [{finding.agent_type}] {finding.title}\n"
            f"{finding.finding_text}\n"
        )
    findings_text = "\n".join(findings_parts)

    # 2. Extract DomainEntity lists from domain_results
    entities_by_agent: dict[str, list[dict[str, object]]] = {}
    for agent_type, run_results in domain_results.items():
        for run_result in run_results:
            output = getattr(run_result, "output", None)
            if output is None:
                continue
            entities = getattr(output, "entities", None)
            if not entities:
                continue
            agent_entities: list[dict[str, object]] = []
            for entity in entities:
                entity_dict: dict[str, object] = {
                    "type": entity.type,
                    "value": entity.value,
                    "confidence": entity.confidence,
                }
                if entity.context:
                    entity_dict["context"] = entity.context
                if entity.metadata:
                    entity_dict["metadata"] = [
                        {"key": m.key, "value": m.value} for m in entity.metadata
                    ]
                agent_entities.append(entity_dict)
            entities_by_agent.setdefault(agent_type, []).extend(agent_entities)

    entities_json = json.dumps(entities_by_agent, indent=2) if entities_by_agent else ""

    # 3. Query case description
    case_result = await db.execute(
        select(Case.description).where(Case.id == UUID(case_id))
    )
    case_description = case_result.scalar_one_or_none() or ""

    logger.info(
        "Assembled KG Builder input case=%s: %d findings, %d entity groups, "
        "description_length=%d",
        case_id,
        len(findings),
        len(entities_by_agent),
        len(case_description),
    )

    return (findings_text, entities_json, case_description)


# ---------------------------------------------------------------------------
# DB write logic
# ---------------------------------------------------------------------------


async def write_kg_from_llm_output(
    case_id: str,
    output: KgBuilderOutput,
    execution_id: UUID | None,
    db: AsyncSession,
) -> tuple[int, int]:
    """Write curated KG data from LLM output to the database.

    Clears all existing KG data for the case, then inserts curated
    entities and relationships. Uses lenient parsing: malformed items
    are skipped with a warning log.

    Args:
        case_id: UUID string of the case.
        output: Parsed KgBuilderOutput from the LLM agent.
        execution_id: AgentExecution record ID for traceability.
        db: Async database session.

    Returns:
        Tuple of (entities_written, relationships_written).
    """
    from app.services.kg_builder import compute_entity_degrees, normalize_entity_name

    case_uuid = UUID(case_id)

    # Delete existing KG data (relationships first due to FK constraints)
    await db.execute(delete(KgRelationship).where(KgRelationship.case_id == case_uuid))
    await db.execute(delete(KgEntity).where(KgEntity.case_id == case_uuid))
    await db.flush()

    # Build mapping: LLM integer ID -> DB UUID
    llm_id_to_db_id: dict[int, UUID] = {}
    entities_written = 0

    for entity in output.entities:
        try:
            # Convert properties list to dict
            properties_dict: dict[str, str] | None = None
            if entity.properties:
                properties_dict = {m.key: m.value for m in entity.properties}

            # Use first domain for backward-compat 'domain' column
            primary_domain = entity.domains[0] if entity.domains else "unknown"

            # Use a savepoint so a single malformed entity doesn't poison
            # the entire session transaction (PendingRollbackError cascade).
            async with db.begin_nested():
                kg_entity = KgEntity(
                    case_id=case_uuid,
                    name=entity.name,
                    name_normalized=normalize_entity_name(entity.name),
                    entity_type=entity.entity_type,
                    domain=primary_domain,
                    confidence=entity.confidence,
                    properties=properties_dict,
                    context=entity.description_detailed,
                    aliases=entity.aliases if entity.aliases else None,
                    description_brief=entity.description_brief,
                    description_detailed=entity.description_detailed,
                    domains=entity.domains if entity.domains else None,
                    source_finding_ids=(
                        entity.source_finding_ids if entity.source_finding_ids else None
                    ),
                    source_execution_id=execution_id,
                )
                db.add(kg_entity)
                await db.flush()

            llm_id_to_db_id[entity.id] = kg_entity.id
            entities_written += 1
        except Exception:
            logger.warning(
                "Skipping malformed entity (id=%s, name=%s) for case=%s",
                entity.id,
                entity.name,
                case_id,
                exc_info=True,
            )

    # Insert relationships, resolving integer IDs to DB UUIDs
    relationships_written = 0

    for rel in output.relationships:
        try:
            source_db_id = llm_id_to_db_id.get(rel.source_entity_id)
            target_db_id = llm_id_to_db_id.get(rel.target_entity_id)

            if source_db_id is None or target_db_id is None:
                logger.warning(
                    "Skipping relationship with unresolved entity IDs "
                    "(source=%s->%s, target=%s->%s) for case=%s",
                    rel.source_entity_id,
                    source_db_id,
                    rel.target_entity_id,
                    target_db_id,
                    case_id,
                )
                continue

            corroboration = len(rel.source_finding_ids) if rel.source_finding_ids else 1

            # Savepoint per relationship for the same reason as entities
            async with db.begin_nested():
                kg_rel = KgRelationship(
                    case_id=case_uuid,
                    source_entity_id=source_db_id,
                    target_entity_id=target_db_id,
                    relationship_type=rel.relationship_type,
                    label=rel.label,
                    strength=rel.strength,
                    evidence_excerpt=(
                        rel.evidence_excerpt if rel.evidence_excerpt else None
                    ),
                    source_finding_ids=(
                        rel.source_finding_ids if rel.source_finding_ids else None
                    ),
                    temporal_context=(
                        rel.temporal_context if rel.temporal_context else None
                    ),
                    confidence=rel.confidence,
                    corroboration_count=corroboration,
                    source_execution_id=execution_id,
                )
                db.add(kg_rel)
                await db.flush()

            relationships_written += 1
        except Exception:
            logger.warning(
                "Skipping malformed relationship (source=%s, target=%s, type=%s) "
                "for case=%s",
                rel.source_entity_id,
                rel.target_entity_id,
                rel.relationship_type,
                case_id,
                exc_info=True,
            )

    # Compute entity degrees after all relationships are written
    if entities_written > 0:
        await compute_entity_degrees(case_uuid, db)
        await db.flush()

    logger.info(
        "Wrote curated KG data for case=%s: %d entities, %d relationships "
        "(from %d LLM entities, %d LLM relationships)",
        case_id,
        entities_written,
        relationships_written,
        len(output.entities),
        len(output.relationships),
    )

    return (entities_written, relationships_written)


# ---------------------------------------------------------------------------
# Top-level runner
# ---------------------------------------------------------------------------


async def run_kg_builder(
    case_id: str,
    workflow_id: str,
    user_id: str,
    domain_results: dict[str, list[object]],
    db_session: AsyncSession,
    publish_event: PublishFn | None = None,
) -> tuple[int, int]:
    """Run the LLM-based KG Builder agent end-to-end.

    Assembles input from case findings and domain entity lists,
    runs the KG Builder agent via DomainAgentRunner, and writes
    curated KG data to the database.

    Does NOT catch exceptions -- the caller (pipeline.py) wraps
    this in try/except for graceful failure handling.

    Args:
        case_id: UUID string of the case.
        workflow_id: UUID string of the analysis workflow.
        user_id: UUID string of the authenticated user.
        domain_results: Maps agent_type to list of DomainRunResult objects.
        db_session: Async database session.
        publish_event: Optional SSE publish function.

    Returns:
        Tuple of (entities_created, relationships_created).
    """
    # Assemble text-only input
    findings_text, entities_json, case_description = await assemble_kg_builder_input(
        case_id=case_id,
        domain_results=domain_results,
        db=db_session,
    )

    # Run the KG Builder agent via DomainAgentRunner
    output, execution_id = await KgBuilderAgentRunner().run(
        case_id=case_id,
        workflow_id=workflow_id,
        user_id=user_id,
        files=[],  # KG Builder receives text only, no files
        hypotheses=[],
        db_session=db_session,
        publish_event=publish_event,
        findings_text=findings_text,
        entities_json=entities_json,
        case_description=case_description,
    )

    if output is None:
        logger.warning(
            "KG Builder produced no output for case=%s workflow=%s",
            case_id,
            workflow_id,
        )
        return (0, 0)

    # Write curated KG data to database
    entities_created, relationships_created = await write_kg_from_llm_output(
        case_id=case_id,
        output=output,
        execution_id=execution_id,
        db=db_session,
    )

    return (entities_created, relationships_created)
