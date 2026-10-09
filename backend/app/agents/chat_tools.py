# ABOUTME: Chat agent tool factories providing 4 DB-query tools for case Q&A.
# ABOUTME: Each factory captures case_id via closure and creates independent DB sessions per call.

from __future__ import annotations

import logging
from collections.abc import Callable, Coroutine
from typing import Any
from uuid import UUID

from sqlalchemy import func, literal_column, select

from app.database import _get_sessionmaker
from app.models.findings import CaseFinding
from app.models.investigation_task import InvestigationTask
from app.models.knowledge_graph import KgEntity, KgRelationship
from app.models.synthesis import (
    CaseContradiction,
    CaseGap,
    CaseHypothesis,
    CaseSynthesis,
    Location,
    TimelineEvent,
)

logger = logging.getLogger(__name__)


def make_query_knowledge_graph_tool(
    case_id: str,
) -> Callable[..., Coroutine[Any, Any, dict[str, object]]]:
    """Create a knowledge graph query tool bound to a specific case.

    Args:
        case_id: The investigation case UUID string.

    Returns:
        An async function that queries KG entities and relationships.
    """
    _case_uuid = UUID(case_id)

    async def query_knowledge_graph(
        entity_type: str | None = None,
        entity_name_search: str | None = None,
        limit: int = 50,
    ) -> dict[str, object]:
        """Query the knowledge graph for entities and their relationships.

        Use this tool to explore the case's knowledge graph -- the network of
        people, organizations, monetary amounts, documents, locations, and
        other entities extracted from case evidence, along with the
        relationships between them.

        Args:
            entity_type: Filter entities by type. Common types: person,
                organization, monetary_amount, document, location, asset,
                account, event, statute, other.
            entity_name_search: Search entities by name (case-insensitive
                substring match). Use this to find specific people, companies,
                or items.
            limit: Maximum number of entities to return (default 50, max 100).

        Returns:
            Dict with 'entities' list (name, type, description, domain,
            confidence, connections, aliases, source_citations with file_id,
            locator, excerpt), 'relationships' list (source, target, type,
            label, evidence, temporal_context), and counts.
        """
        capped_limit = min(limit, 100)
        session_factory = _get_sessionmaker()

        async with session_factory() as db:
            query = select(KgEntity).where(
                KgEntity.case_id == _case_uuid,
                KgEntity.merged_into_id.is_(None),
            )
            if entity_type:
                query = query.where(KgEntity.entity_type == entity_type)
            if entity_name_search:
                query = query.where(KgEntity.name.ilike(f"%{entity_name_search}%"))

            query = query.order_by(KgEntity.degree.desc()).limit(capped_limit)
            result = await db.execute(query)
            entities = list(result.scalars().all())

            entity_ids = [e.id for e in entities]

            # Build a name lookup for relationship resolution
            entity_name_map: dict[UUID, str] = {e.id: e.name for e in entities}

            # Fetch relationships involving these entities
            rel_query = (
                select(KgRelationship)
                .where(
                    KgRelationship.case_id == _case_uuid,
                    (KgRelationship.source_entity_id.in_(entity_ids))
                    | (KgRelationship.target_entity_id.in_(entity_ids)),
                )
                .limit(200)
            )
            rel_result = await db.execute(rel_query)
            relationships = list(rel_result.scalars().all())

            # Resolve names for relationship endpoints not in the entity set
            missing_ids: set[UUID] = set()
            for r in relationships:
                if r.source_entity_id not in entity_name_map:
                    missing_ids.add(r.source_entity_id)
                if r.target_entity_id not in entity_name_map:
                    missing_ids.add(r.target_entity_id)

            if missing_ids:
                name_result = await db.execute(
                    select(KgEntity.id, KgEntity.name).where(
                        KgEntity.id.in_(list(missing_ids))
                    )
                )
                for eid, ename in name_result.all():
                    entity_name_map[eid] = ename

            # Two-hop resolution: source_finding_ids → CaseFinding.citations → file refs
            all_finding_ids: list[UUID] = []
            for e in entities:
                if e.source_finding_ids:
                    all_finding_ids.extend(
                        UUID(str(fid)) for fid in e.source_finding_ids
                    )

            # Build a mapping from finding_id → list of file citations
            finding_citations: dict[str, list[dict[str, str]]] = {}
            if all_finding_ids:
                cite_result = await db.execute(
                    select(CaseFinding.id, CaseFinding.citations).where(
                        CaseFinding.id.in_(all_finding_ids)
                    )
                )
                for fid, cites in cite_result.all():
                    if cites and isinstance(cites, list):
                        finding_citations[str(fid)] = [
                            {
                                "file_id": c.get("file_id", ""),
                                "locator": c.get("locator", ""),
                                "excerpt": c.get("excerpt", ""),
                            }
                            for c in cites
                            if isinstance(c, dict) and c.get("file_id")
                        ]

        return {
            "entities": [
                {
                    "name": e.name,
                    "type": e.entity_type,
                    "description": e.description_brief or "",
                    "domain": e.domain,
                    "confidence": e.confidence,
                    "connections": e.degree,
                    "aliases": e.aliases or [],
                    "source_citations": [
                        cite
                        for fid in (e.source_finding_ids or [])
                        for cite in finding_citations.get(str(fid), [])
                    ],
                }
                for e in entities
            ],
            "relationships": [
                {
                    "source": entity_name_map.get(
                        r.source_entity_id, str(r.source_entity_id)
                    ),
                    "target": entity_name_map.get(
                        r.target_entity_id, str(r.target_entity_id)
                    ),
                    "type": r.relationship_type,
                    "label": r.label,
                    "evidence": r.evidence_excerpt or "",
                    "temporal_context": r.temporal_context or "",
                }
                for r in relationships
            ],
            "entity_count": len(entities),
            "relationship_count": len(relationships),
        }

    return query_knowledge_graph


def make_get_findings_tool(
    case_id: str,
) -> Callable[..., Coroutine[Any, Any, dict[str, object]]]:
    """Create a findings retrieval tool bound to a specific case.

    Args:
        case_id: The investigation case UUID string.

    Returns:
        An async function that queries case findings.
    """
    _case_uuid = UUID(case_id)

    async def get_findings(
        finding_id: str | None = None,
        agent_type: str | None = None,
        category: str | None = None,
        min_confidence: float = 0.0,
        limit: int = 50,
    ) -> dict[str, object]:
        """Retrieve domain analysis findings for this case.

        This tool has TWO modes:

        **Detail mode** (when finding_id is provided): Fetches a single finding
        by its UUID and returns the FULL finding text (not truncated). Use this
        when you need the complete text of a specific finding for deep citation-
        backed answers. All other filter parameters are ignored in this mode.

        **List mode** (when finding_id is None): Queries findings with optional
        filters and returns a paginated list with truncated text. Use this to
        browse and discover relevant findings.

        Args:
            finding_id: UUID string of a specific finding to retrieve in full.
                When provided, all other filters are ignored. Use this for
                deep drill-down into a specific finding.
            agent_type: Filter by source agent: 'legal',
                'evidence', or 'strategy'.
            category: Filter by finding category (e.g. 'suspicious_transaction',
                'contract_clause', 'chain_of_custody').
            min_confidence: Minimum confidence score (0-100). Only findings
                with confidence >= this value are returned.
            limit: Maximum number of findings to return in list mode
                (default 50, max 100).

        Returns:
            In detail mode: dict with 'finding' (full finding data including
            complete finding_text) and 'mode': 'detail'.
            In list mode: dict with 'findings' list (truncated finding_text),
            'count', and 'mode': 'list'.
        """
        session_factory = _get_sessionmaker()

        async with session_factory() as db:
            # Detail mode: single finding with full text
            if finding_id is not None:
                try:
                    fid = UUID(finding_id)
                except ValueError:
                    return {
                        "error": f"Invalid finding_id: {finding_id}",
                        "mode": "detail",
                    }

                result = await db.execute(
                    select(CaseFinding).where(
                        CaseFinding.id == fid,
                        CaseFinding.case_id == _case_uuid,
                    )
                )
                finding = result.scalar_one_or_none()
                if finding is None:
                    return {"error": "Finding not found", "mode": "detail"}

                return {
                    "finding": {
                        "id": str(finding.id),
                        "agent_type": finding.agent_type,
                        "category": finding.category,
                        "title": finding.title,
                        "finding_text": finding.finding_text,
                        "confidence": finding.confidence,
                        "citations": finding.citations or [],
                    },
                    "mode": "detail",
                }

            # List mode: filtered query with truncated text
            capped_limit = min(limit, 100)
            query = select(CaseFinding).where(CaseFinding.case_id == _case_uuid)

            if agent_type:
                query = query.where(CaseFinding.agent_type == agent_type)
            if category:
                query = query.where(CaseFinding.category == category)
            if min_confidence > 0.0:
                query = query.where(CaseFinding.confidence >= min_confidence)

            query = query.order_by(CaseFinding.confidence.desc()).limit(capped_limit)
            result = await db.execute(query)
            findings = list(result.scalars().all())

        return {
            "findings": [
                {
                    "id": str(f.id),
                    "agent_type": f.agent_type,
                    "category": f.category,
                    "title": f.title,
                    "finding_text": (
                        f.finding_text[:500] + "..."
                        if len(f.finding_text) > 500
                        else f.finding_text
                    ),
                    "confidence": f.confidence,
                    "citations": f.citations or [],
                }
                for f in findings
            ],
            "count": len(findings),
            "mode": "list",
        }

    return get_findings


def make_get_synthesis_tool(
    case_id: str,
) -> Callable[..., Coroutine[Any, Any, dict[str, object]]]:
    """Create a synthesis data retrieval tool bound to a specific case.

    Args:
        case_id: The investigation case UUID string.

    Returns:
        An async function that queries synthesis tables.
    """
    _case_uuid = UUID(case_id)

    async def get_synthesis(
        include_hypotheses: bool = True,
        include_contradictions: bool = True,
        include_gaps: bool = True,
        include_timeline: bool = False,
        include_locations: bool = False,
        include_tasks: bool = False,
    ) -> dict[str, object]:
        """Retrieve the case synthesis -- hypotheses, contradictions, gaps,
        timeline events, locations, and investigation tasks.

        This is the primary tool for summary-level questions about the case.
        It returns the synthesis agent's conclusions: what hypotheses were
        formed, what contradictions were found, what information gaps exist,
        and the overall case summary/verdict.

        By default, loads hypotheses, contradictions, and gaps. Set optional
        flags to True to also include timeline events, locations, and tasks.

        Args:
            include_hypotheses: Include case hypotheses with evidence
                (default True).
            include_contradictions: Include detected contradictions
                (default True).
            include_gaps: Include information gaps (default True).
            include_timeline: Include timeline events (default False --
                set to True for temporal/chronological questions).
            include_locations: Include geographic locations (default False --
                set to True for location/geographic questions).
            include_tasks: Include investigation tasks (default False --
                set to True for questions about next steps or recommendations).

        Returns:
            Dict with synthesis summary fields (case_summary, case_verdict,
            key_findings_summary, risk_assessment, cross_domain_conclusions)
            and conditionally loaded sections with counts.
        """
        session_factory = _get_sessionmaker()

        async with session_factory() as db:
            # Load latest synthesis record
            synth_result = await db.execute(
                select(CaseSynthesis)
                .where(CaseSynthesis.case_id == _case_uuid)
                .order_by(CaseSynthesis.created_at.desc())
                .limit(1)
            )
            synthesis = synth_result.scalar_one_or_none()

            response: dict[str, object] = {}

            if synthesis:
                response["case_summary"] = synthesis.case_summary or ""
                response["case_verdict"] = synthesis.case_verdict or {}
                response["key_findings_summary"] = synthesis.key_findings_summary or ""
                response["risk_assessment"] = synthesis.risk_assessment or ""
                response["cross_domain_conclusions"] = (
                    synthesis.cross_domain_conclusions or []
                )
            else:
                response["case_summary"] = "No synthesis available yet."
                response["case_verdict"] = {}
                response["key_findings_summary"] = ""
                response["risk_assessment"] = ""
                response["cross_domain_conclusions"] = []

            # Hypotheses
            if include_hypotheses:
                h_result = await db.execute(
                    select(CaseHypothesis)
                    .where(CaseHypothesis.case_id == _case_uuid)
                    .order_by(CaseHypothesis.confidence.desc())
                )
                hypotheses = list(h_result.scalars().all())
                response["hypotheses"] = [
                    {
                        "id": str(h.id),
                        "claim": h.claim,
                        "status": h.status,
                        "confidence": h.confidence,
                        "supporting_evidence": h.supporting_evidence or [],
                        "contradicting_evidence": h.contradicting_evidence or [],
                        "reasoning": h.reasoning or "",
                    }
                    for h in hypotheses
                ]
                response["hypothesis_count"] = len(hypotheses)

            # Contradictions
            if include_contradictions:
                c_result = await db.execute(
                    select(CaseContradiction)
                    .where(CaseContradiction.case_id == _case_uuid)
                    .order_by(CaseContradiction.severity.desc())
                )
                contradictions = list(c_result.scalars().all())
                response["contradictions"] = [
                    {
                        "id": str(c.id),
                        "claim_a": c.claim_a,
                        "claim_b": c.claim_b,
                        "source_a": c.source_a or {},
                        "source_b": c.source_b or {},
                        "severity": c.severity,
                        "domain": c.domain or "",
                    }
                    for c in contradictions
                ]
                response["contradiction_count"] = len(contradictions)

            # Gaps
            if include_gaps:
                g_result = await db.execute(
                    select(CaseGap)
                    .where(CaseGap.case_id == _case_uuid)
                    .order_by(CaseGap.priority.desc())
                )
                gaps = list(g_result.scalars().all())
                response["gaps"] = [
                    {
                        "id": str(g.id),
                        "description": g.description,
                        "what_is_missing": g.what_is_missing,
                        "why_needed": g.why_needed or "",
                        "priority": g.priority,
                        "related_entity_ids": g.related_entity_ids or [],
                    }
                    for g in gaps
                ]
                response["gap_count"] = len(gaps)

            # Timeline events
            if include_timeline:
                t_result = await db.execute(
                    select(TimelineEvent)
                    .where(TimelineEvent.case_id == _case_uuid)
                    .order_by(TimelineEvent.event_date.asc().nullslast())
                )
                events = list(t_result.scalars().all())
                response["timeline_events"] = [
                    {
                        "id": str(e.id),
                        "title": e.title,
                        "description": e.description or "",
                        "event_date": (
                            e.event_date.isoformat() if e.event_date else ""
                        ),
                        "event_type": e.event_type or "",
                        "layer": e.layer or "",
                        "citations": [
                            {
                                "file_id": c.get("file_id", ""),
                                "locator": c.get("locator", ""),
                                "excerpt": c.get("excerpt", ""),
                            }
                            for c in (e.citations or [])
                            if isinstance(c, dict) and c.get("file_id")
                        ],
                    }
                    for e in events
                ]
                response["timeline_event_count"] = len(events)

            # Locations
            if include_locations:
                l_result = await db.execute(
                    select(Location).where(Location.case_id == _case_uuid)
                )
                locations = list(l_result.scalars().all())
                response["locations"] = [
                    {
                        "id": str(loc.id),
                        "name": loc.name,
                        "location_type": loc.location_type or "",
                        "coordinates": loc.coordinates or {},
                        "citations": [
                            {
                                "file_id": c.get("file_id", ""),
                                "locator": c.get("locator", ""),
                                "excerpt": c.get("excerpt", ""),
                            }
                            for c in (loc.citations or [])
                            if isinstance(c, dict) and c.get("file_id")
                        ],
                    }
                    for loc in locations
                ]
                response["location_count"] = len(locations)

            # Investigation tasks
            if include_tasks:
                task_result = await db.execute(
                    select(InvestigationTask)
                    .where(InvestigationTask.case_id == _case_uuid)
                    .order_by(InvestigationTask.priority.desc())
                )
                tasks = list(task_result.scalars().all())
                response["tasks"] = [
                    {
                        "id": str(t.id),
                        "title": t.title,
                        "task_type": t.task_type,
                        "priority": t.priority,
                        "status": t.status,
                        "description": t.description,
                    }
                    for t in tasks
                ]
                response["task_count"] = len(tasks)

        return response

    return get_synthesis


def make_search_findings_tool(
    case_id: str,
) -> Callable[..., Coroutine[Any, Any, dict[str, object]]]:
    """Create a full-text search tool bound to a specific case.

    Args:
        case_id: The investigation case UUID string.

    Returns:
        An async function that performs full-text search over findings.
    """
    _case_uuid = UUID(case_id)

    async def search_findings(
        query: str,
        limit: int = 20,
    ) -> dict[str, object]:
        """Full-text search over case findings using PostgreSQL text search.

        Use this tool for keyword-specific queries when you need to find
        findings mentioning specific terms, names, amounts, or concepts.
        This searches the full text of all findings (not just titles).

        The search uses PostgreSQL's built-in full-text search engine, which
        supports stemming and relevance ranking.

        Args:
            query: Search query string. Can be natural language or specific
                keywords (e.g. 'wire transfer', 'breach of contract',
                'surveillance footage').
            limit: Maximum number of results (default 20, max 50).

        Returns:
            Dict with 'results' list (id, agent_type, category, title,
            finding_text truncated to 300 chars, confidence, citations),
            'count', and the original 'query'.
        """
        capped_limit = min(limit, 50)
        session_factory = _get_sessionmaker()

        async with session_factory() as db:
            tsquery = func.plainto_tsquery("english", query)

            stmt = (
                select(
                    CaseFinding,
                    func.ts_rank(
                        literal_column("search_vector"),
                        tsquery,
                    ).label("rank"),
                )
                .where(
                    CaseFinding.case_id == _case_uuid,
                    literal_column("search_vector").op("@@")(tsquery),
                )
                .order_by(literal_column("rank").desc())
                .limit(capped_limit)
            )

            result = await db.execute(stmt)
            rows = result.all()

        return {
            "results": [
                {
                    "id": str(finding.id),
                    "agent_type": finding.agent_type,
                    "category": finding.category,
                    "title": finding.title,
                    "finding_text": (
                        finding.finding_text[:300] + "..."
                        if len(finding.finding_text) > 300
                        else finding.finding_text
                    ),
                    "confidence": finding.confidence,
                    "citations": finding.citations or [],
                }
                for finding, _ in rows
            ],
            "count": len(rows),
            "query": query,
        }

    return search_findings
