# ABOUTME: Programmatic knowledge graph builder that transforms domain agent output into entities and relationships.
# ABOUTME: Handles entity extraction, co-occurrence relationship inference, deduplication (exact + fuzzy), and degree computation.

from __future__ import annotations

import logging
import string
from uuid import UUID

from rapidfuzz import fuzz
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.domain_runner import DomainRunResult
from app.schemas.agent import DomainAgentOutput

logger = logging.getLogger(__name__)


def normalize_entity_name(name: str) -> str:
    """Normalize entity name for deduplication matching.

    Strips whitespace, lowercases, and removes punctuation.
    """
    stripped = name.strip().lower()
    return stripped.translate(str.maketrans("", "", string.punctuation))


# DEPRECATED: Replaced by LLM-based KG Builder agent (Phase 7.1). Kept for reference.
async def extract_entities_from_output(
    output: DomainAgentOutput,
    agent_type: str,
    execution_id: UUID | None,
    case_id: UUID,
    db: AsyncSession,
) -> list:
    """Extract ALL entities from a domain agent output and persist as KgEntity rows.

    Receives the already-parsed Pydantic BaseModel object directly from
    domain_results. Extracts from both top-level output.entities and
    per-finding finding.entities lists. Never filters or discards entities.

    Args:
        output: Parsed domain agent output (e.g., LegalOutput, EvidenceOutput).
        agent_type: Domain agent type (legal, evidence, strategy).
        execution_id: AgentExecution record ID for traceability.
        case_id: Case UUID.
        db: Async database session.

    Returns:
        List of created KgEntity ORM objects with IDs assigned.
    """
    from app.models.knowledge_graph import KgEntity

    # Lazy import to avoid circular imports with schema definitions
    from app.schemas.agent import DomainEntity

    entities_to_create: list[KgEntity] = []

    def _build_kg_entity(
        domain_entity: DomainEntity,
        source_finding_index: int | None,
    ) -> KgEntity:
        """Build a KgEntity ORM object from a DomainEntity schema object."""
        properties_dict: dict[str, str] | None = None
        if domain_entity.metadata:
            properties_dict = {m.key: m.value for m in domain_entity.metadata}

        return KgEntity(
            case_id=case_id,
            name=domain_entity.value,
            name_normalized=normalize_entity_name(domain_entity.value),
            entity_type=domain_entity.type,
            domain=agent_type,
            confidence=domain_entity.confidence,
            properties=properties_dict,
            context=domain_entity.context,
            source_execution_id=execution_id,
            source_finding_index=source_finding_index,
        )

    # Extract from top-level entities list
    if output.entities:
        for entity in output.entities:
            entities_to_create.append(_build_kg_entity(entity, None))

    # Extract from per-finding entities lists
    if output.findings:
        for finding_idx, finding in enumerate(output.findings):
            if finding.entities:
                for entity in finding.entities:
                    entities_to_create.append(_build_kg_entity(entity, finding_idx))

    # Persist all entities
    for kg_entity in entities_to_create:
        db.add(kg_entity)
    await db.flush()

    logger.info(
        "Extracted %d entities from %s output (case=%s, execution=%s)",
        len(entities_to_create),
        agent_type,
        case_id,
        execution_id,
    )
    return entities_to_create


# DEPRECATED: Replaced by LLM-based KG Builder agent (Phase 7.1). Kept for reference.
async def build_relationships_from_findings(
    output: DomainAgentOutput,
    agent_type: str,
    execution_id: UUID | None,
    case_id: UUID,
    entity_map: dict[str, UUID],
    db: AsyncSession,
) -> list:
    """Infer relationships from entity co-occurrence within findings.

    For each finding, every pair of entities mentioned together gets a
    co-occurrence relationship. Strength starts at 20 per co-occurrence and
    increases by 20 for each additional co-occurrence (capped at 100).

    Args:
        output: Parsed domain agent output.
        agent_type: Domain agent type.
        execution_id: AgentExecution record ID.
        case_id: Case UUID.
        entity_map: Maps normalized entity name to KgEntity UUID.
        db: Async database session.

    Returns:
        List of created KgRelationship ORM objects.
    """
    from app.models.knowledge_graph import KgRelationship

    if not output.findings:
        return []

    # Track cumulative strength for each entity pair (ordered tuple of UUIDs)
    pair_strength: dict[tuple[UUID, UUID], int] = {}
    pair_category: dict[tuple[UUID, UUID], str] = {}

    for finding in output.findings:
        if not finding.entities:
            continue

        # Collect entity IDs referenced in this finding
        finding_entity_ids: list[UUID] = []
        for entity in finding.entities:
            normalized = normalize_entity_name(entity.value)
            entity_id = entity_map.get(normalized)
            if entity_id is not None:
                finding_entity_ids.append(entity_id)

        # Also check top-level entities that might appear in this finding's context
        # (entities are linked by name match)

        # Generate all unique pairs
        unique_ids = list(dict.fromkeys(finding_entity_ids))
        for i in range(len(unique_ids)):
            for j in range(i + 1, len(unique_ids)):
                # Order pair consistently for deduplication
                pair = (
                    min(unique_ids[i], unique_ids[j]),
                    max(unique_ids[i], unique_ids[j]),
                )
                current_strength = pair_strength.get(pair, 0)
                pair_strength[pair] = min(current_strength + 20, 100)
                if pair not in pair_category:
                    pair_category[pair] = finding.category

    # Create KgRelationship rows
    relationships: list[KgRelationship] = []
    for (source_id, target_id), strength in pair_strength.items():
        category = pair_category.get((source_id, target_id), "unknown")
        rel = KgRelationship(
            case_id=case_id,
            source_entity_id=source_id,
            target_entity_id=target_id,
            relationship_type=f"co_mentioned_in_{category}",
            label=f"co-occurrence ({category})",
            strength=strength,
            source_execution_id=execution_id,
        )
        db.add(rel)
        relationships.append(rel)

    await db.flush()

    logger.info(
        "Created %d relationships from %s findings (case=%s)",
        len(relationships),
        agent_type,
        case_id,
    )
    return relationships


# DEPRECATED: Replaced by LLM-based KG Builder agent (Phase 7.1). Kept for reference.
async def deduplicate_entities(
    case_id: UUID,
    db: AsyncSession,
) -> tuple[int, int]:
    """Deduplicate entities within a case via exact and fuzzy matching.

    Exact matches (same name_normalized + entity_type) are auto-merged using
    soft merge (merged_into_id). Fuzzy matches (>=85% similarity) are flagged
    for later LLM resolution in Phase 8.

    Cross-domain merging is allowed per CONTEXT.md decision -- entities are
    grouped by entity_type only, not by domain.

    Args:
        case_id: Case UUID.
        db: Async database session.

    Returns:
        Tuple of (exact_merges_count, fuzzy_flags_count).
    """
    from app.models.knowledge_graph import KgEntity, KgRelationship

    # Load all non-merged entities for this case
    result = await db.execute(
        select(KgEntity).where(
            KgEntity.case_id == case_id,
            KgEntity.merged_into_id.is_(None),
        )
    )
    entities = list(result.scalars().all())

    # Group by entity_type for deduplication scope
    type_groups: dict[str, list[KgEntity]] = {}
    for entity in entities:
        type_groups.setdefault(entity.entity_type, []).append(entity)

    exact_merges = 0
    fuzzy_flags = 0

    for entity_type, group in type_groups.items():
        # Sort by created_at to pick earliest as primary
        group.sort(key=lambda e: e.created_at)

        # Exact match deduplication
        # Group by name_normalized
        name_groups: dict[str, list[KgEntity]] = {}
        for entity in group:
            name_groups.setdefault(entity.name_normalized, []).append(entity)

        # Primary entities: first in each name group
        primaries: list[KgEntity] = []
        for _name, name_group in name_groups.items():
            primary = name_group[0]
            primaries.append(primary)
            for duplicate in name_group[1:]:
                # Soft merge: point duplicate to primary
                duplicate.merged_into_id = primary.id
                primary.merge_count += 1
                exact_merges += 1

                # Update relationships pointing to duplicate
                await db.execute(
                    update(KgRelationship)
                    .where(KgRelationship.source_entity_id == duplicate.id)
                    .values(source_entity_id=primary.id)
                )
                await db.execute(
                    update(KgRelationship)
                    .where(KgRelationship.target_entity_id == duplicate.id)
                    .values(target_entity_id=primary.id)
                )

        # Fuzzy match detection (between distinct name_normalized values)
        if len(primaries) > 1:
            for i in range(len(primaries)):
                for j in range(i + 1, len(primaries)):
                    ratio = fuzz.ratio(
                        primaries[i].name_normalized,
                        primaries[j].name_normalized,
                    )
                    if ratio >= 85:
                        fuzzy_flags += 1
                        logger.info(
                            "Fuzzy match flagged (ratio=%d%%): '%s' <-> '%s' "
                            "(type=%s, case=%s) -- deferred to Phase 8 LLM resolution",
                            ratio,
                            primaries[i].name,
                            primaries[j].name,
                            entity_type,
                            case_id,
                        )

    await db.flush()

    logger.info(
        "Deduplication complete for case=%s: %d exact merges, %d fuzzy flags",
        case_id,
        exact_merges,
        fuzzy_flags,
    )
    return (exact_merges, fuzzy_flags)


async def compute_entity_degrees(
    case_id: UUID,
    db: AsyncSession,
) -> None:
    """Update degree column for all non-merged entities in a case.

    Degree counts the number of relationships where the entity is either
    source or target. Uses bulk update for efficiency.

    Args:
        case_id: Case UUID.
        db: Async database session.
    """
    from sqlalchemy import func

    from app.models.knowledge_graph import KgEntity, KgRelationship

    # Load non-merged entities
    result = await db.execute(
        select(KgEntity.id).where(
            KgEntity.case_id == case_id,
            KgEntity.merged_into_id.is_(None),
        )
    )
    entity_ids = [row[0] for row in result.all()]

    if not entity_ids:
        return

    # Count relationships per entity (as source or target)
    for entity_id in entity_ids:
        count_result = await db.execute(
            select(func.count()).where(
                or_(
                    KgRelationship.source_entity_id == entity_id,
                    KgRelationship.target_entity_id == entity_id,
                ),
                KgRelationship.case_id == case_id,
            )
        )
        degree = count_result.scalar() or 0
        await db.execute(
            update(KgEntity).where(KgEntity.id == entity_id).values(degree=degree)
        )

    await db.flush()

    logger.info(
        "Computed degrees for %d entities in case=%s",
        len(entity_ids),
        case_id,
    )


# DEPRECATED: Replaced by LLM-based KG Builder agent (Phase 7.1). Kept for reference.
async def build_knowledge_graph(
    case_id: str,
    workflow_id: str,
    domain_results: dict[str, list[DomainRunResult]],
    db: AsyncSession,
) -> tuple[int, int, int]:
    """Top-level orchestrator that builds the knowledge graph from domain agent outputs.

    Iterates over all domain agent results, extracts entities, infers
    relationships from co-occurrence, deduplicates, and computes degrees.

    The caller (pipeline.py) is responsible for adding strategy output into
    domain_results before calling this function.

    Args:
        case_id: Case UUID string.
        workflow_id: Analysis workflow UUID string.
        domain_results: Maps agent_type to list of DomainRunResult objects.
            Each DomainRunResult carries the parsed output alongside execution_id.
        db: Async database session.

    Returns:
        Tuple of (entities_created, relationships_created, exact_merges).
    """
    case_uuid = UUID(case_id)
    total_entities = 0
    total_relationships = 0

    for agent_type, results in domain_results.items():
        for run_result in results:
            if run_result.output is None:
                continue

            # Extract entities
            kg_entities = await extract_entities_from_output(
                output=run_result.output,
                agent_type=agent_type,
                execution_id=run_result.execution_id,
                case_id=case_uuid,
                db=db,
            )
            total_entities += len(kg_entities)

            # Build entity_map: normalized_name -> entity_id
            entity_map: dict[str, UUID] = {}
            for entity in kg_entities:
                entity_map[entity.name_normalized] = entity.id

            # Build relationships from co-occurrence
            relationships = await build_relationships_from_findings(
                output=run_result.output,
                agent_type=agent_type,
                execution_id=run_result.execution_id,
                case_id=case_uuid,
                entity_map=entity_map,
                db=db,
            )
            total_relationships += len(relationships)

    # Deduplicate entities across all agents
    exact_merges, fuzzy_flags = await deduplicate_entities(case_uuid, db)

    # Compute entity degrees
    await compute_entity_degrees(case_uuid, db)

    logger.info(
        "Knowledge graph built for case=%s workflow=%s: "
        "%d entities, %d relationships, %d exact merges, %d fuzzy flags",
        case_id,
        workflow_id,
        total_entities,
        total_relationships,
        exact_merges,
        fuzzy_flags,
    )
    return (total_entities, total_relationships, exact_merges)
