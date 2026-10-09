# ABOUTME: Geospatial Agent runner that extracts and geocodes location references from case data.
# ABOUTME: Produces locations, movement paths, and temporal-spatial analysis with full citations.

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from google.adk.agents import LlmAgent
from google.genai import types
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import PublishFn
from app.agents.domain_agent_runner import DomainAgentRunner
from app.agents.factory import AgentFactory
from app.models.case import Case
from app.models.file import CaseFile
from app.models.findings import CaseFinding
from app.models.knowledge_graph import KgEntity
from app.models.synthesis import CaseSynthesis, Location, TimelineEvent
from app.schemas.geospatial import GeospatialOutput
from app.services.geocoding_service import GeocodingService

logger = logging.getLogger(__name__)


class GeospatialAgentRunner(DomainAgentRunner[GeospatialOutput]):
    """Geospatial agent runner that assembles text-only input from DB data.

    Follows SynthesisAgentRunner pattern: text-only input, structured output,
    clear-and-rebuild DB write.
    """

    def get_agent_name(self) -> str:
        return "geospatial"

    def _get_output_type(self) -> type[GeospatialOutput]:
        return GeospatialOutput

    def _create_agent_instance(
        self, case_id: str, model: str, publish_fn: PublishFn | None
    ) -> LlmAgent:
        return AgentFactory.create_geospatial_agent(
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
        """Build text-only Content from pre-assembled geospatial input.

        Args files, gcs_bucket, hypotheses, context_injection are unused
        as geospatial agent only uses text-only input from kwargs.
        """
        geospatial_input = str(kwargs.get("geospatial_input", ""))
        return types.Content(role="user", parts=[types.Part(text=geospatial_input)])


async def assemble_geospatial_input(case_id: str, db: AsyncSession) -> str:
    """Assemble text-only input for Geospatial Agent from DB data.

    Queries 6 data sources: case metadata, case synthesis, timeline events,
    KG entities, and domain findings.
    """
    case_uuid = UUID(case_id)

    # Query all data sources
    case_stmt = select(Case).where(Case.id == case_uuid)
    case = (await db.execute(case_stmt)).scalar_one_or_none()

    synthesis_stmt = select(CaseSynthesis).where(CaseSynthesis.case_id == case_uuid)
    synthesis = (await db.execute(synthesis_stmt)).scalar_one_or_none()

    timeline_stmt = (
        select(TimelineEvent)
        .where(TimelineEvent.case_id == case_uuid)
        .order_by(TimelineEvent.event_date)
    )
    timeline_events = (await db.execute(timeline_stmt)).scalars().all()

    entity_stmt = (
        select(KgEntity)
        .where(KgEntity.case_id == case_uuid, KgEntity.merged_into_id.is_(None))
        .order_by(KgEntity.name)
    )
    entities = (await db.execute(entity_stmt)).scalars().all()

    findings_stmt = (
        select(CaseFinding)
        .where(CaseFinding.case_id == case_uuid)
        .order_by(CaseFinding.created_at)
    )
    findings = (await db.execute(findings_stmt)).scalars().all()

    # Build text document
    sections = []

    sections.append("# CASE METADATA")
    sections.append(f"Case Name: {case.name if case else 'Unknown'}")
    sections.append(f"Case Description: {case.description if case else 'N/A'}")

    if synthesis:
        sections.append("\n# CASE SYNTHESIS")
        sections.append(f"Summary: {synthesis.case_summary or 'N/A'}")
        sections.append(f"Key Findings: {synthesis.key_findings_summary or 'N/A'}")

    sections.append(f"\n# TIMELINE EVENTS ({len(timeline_events)} events)")
    for event in timeline_events:
        sections.append(
            f"[EVENT:{event.id}] {event.title} | {event.event_date} | Layer: {event.layer}"
        )
        if event.description:
            sections.append(f"  Description: {event.description}")

    sections.append(f"\n# KNOWLEDGE GRAPH ENTITIES ({len(entities)} entities)")
    for i, entity in enumerate(entities, start=1):
        sections.append(
            f"[ENTITY:{i}:{entity.id}:{entity.name}] Type: {entity.entity_type}"
        )
        if entity.properties:
            sections.append(f"  Properties: {json.dumps(entity.properties)}")

    sections.append(f"\n# DOMAIN FINDINGS ({len(findings)} findings)")
    for finding in findings:
        sections.append(
            f"[FINDING:{finding.id}] Agent: {finding.agent_type} | Category: {finding.category}"
        )
        if finding.finding_text:
            # Truncate to 500 chars
            text = finding.finding_text[:500]
            sections.append(f"  Text: {text}...")

    logger.info(
        "Assembled geospatial input for case=%s: %d findings, %d entities, %d timeline_events",
        case_id,
        len(findings),
        len(entities),
        len(timeline_events),
    )

    return "\n".join(sections)


async def write_geospatial_output(
    case_id: str,
    workflow_id: UUID,
    output: GeospatialOutput,
    db: AsyncSession,
    geocoding_service: GeocodingService,
) -> dict[str, int]:
    """Write geospatial output to locations table.

    Clear-and-rebuild pattern: delete all existing locations for this case,
    then insert fresh results.

    Returns:
        Dict with counts: locations, paths, unmappable.
    """
    case_uuid = UUID(case_id)

    # Step 1: Delete all existing locations for this case
    delete_stmt = delete(Location).where(Location.case_id == case_uuid)
    await db.execute(delete_stmt)
    await db.flush()

    # Step 2: Geocode any locations missing coordinates
    # Prefer geocodable_address (real-world address) over name (may be case-specific)
    for loc in output.locations:
        if loc.latitude is None or loc.longitude is None:
            # Try geocodable_address first, then fall back to name
            address = loc.geocodable_address.strip() if loc.geocodable_address else ""
            if address:
                coords = await geocoding_service.geocode_address(address)
            else:
                coords = None

            # Fall back to name if geocodable_address failed
            if not coords and address != loc.name:
                coords = await geocoding_service.geocode_address(loc.name)

            if coords:
                loc.latitude = coords["lat"]
                loc.longitude = coords["lng"]
            else:
                if loc.name not in output.unmappable_locations:
                    output.unmappable_locations.append(loc.name)

    # Step 3: Insert new locations
    location_count = 0
    for loc in output.locations:
        # Build coordinates dict
        coordinates = None
        if loc.latitude is not None and loc.longitude is not None:
            coordinates = {"lat": loc.latitude, "lng": loc.longitude}

        # Build temporal associations
        temporal_start = None
        temporal_end = None
        if loc.temporal_start:
            try:
                temporal_start = datetime.fromisoformat(loc.temporal_start).replace(
                    tzinfo=UTC
                )
            except (ValueError, TypeError):
                logger.warning("Could not parse temporal_start: %s", loc.temporal_start)
        if loc.temporal_end:
            try:
                temporal_end = datetime.fromisoformat(loc.temporal_end).replace(
                    tzinfo=UTC
                )
            except (ValueError, TypeError):
                logger.warning("Could not parse temporal_end: %s", loc.temporal_end)

        # Build temporal_associations JSONB
        temporal_associations = []
        if temporal_start:
            temporal_associations.append(
                {
                    "type": "period",
                    "start": temporal_start.isoformat(),
                    "end": temporal_end.isoformat() if temporal_end else None,
                }
            )

        # Add events to temporal_associations
        for evt in loc.events:
            temporal_associations.append(
                {
                    "type": "event",
                    "title": evt.event_title,
                    "description": evt.event_description,
                    "timestamp": evt.timestamp,
                    "layer": evt.layer,
                    "confidence": evt.confidence,
                }
            )

        # Build source_entity_ids JSONB - store the integer IDs directly for now
        # (They reference position in the entities list from input assembly)
        source_entity_ids_list = None
        if loc.source_entity_ids:
            source_entity_ids_list = loc.source_entity_ids

        # Build citations JSONB from LLM output
        citations_list = None
        if loc.citations:
            citations_list = [
                {
                    "file_id": c.file_id,
                    "locator": c.locator,
                    "excerpt": c.excerpt,
                }
                for c in loc.citations
            ]

        # Create location record
        location_record = Location(
            case_id=case_uuid,
            workflow_id=workflow_id,
            name=loc.name,
            coordinates=coordinates,
            location_type=loc.location_type,
            citations=citations_list,
            source_entity_ids=source_entity_ids_list,
            temporal_associations=temporal_associations,
        )
        db.add(location_record)
        location_count += 1

    await db.flush()

    # Step 4: Log paths (stored in analysis_summary for now)
    # In Phase 8.2, we can add a dedicated paths table
    path_count = len(output.paths)

    logger.info(
        f"Wrote {location_count} locations for case {case_id} (workflow {workflow_id}), "
        f"{path_count} paths, {len(output.unmappable_locations)} unmappable"
    )

    return {
        "locations": location_count,
        "paths": path_count,
        "unmappable": len(output.unmappable_locations),
    }


async def run_geospatial(
    case_id: str,
    workflow_id: UUID,
    user_id: str,
    db_session: AsyncSession,
    publish_event: PublishFn | None = None,
) -> dict[str, int]:
    """Top-level geospatial runner for pipeline integration.

    Returns:
        Dict with counts of written records.
    """
    import os

    geocoding_service = GeocodingService(api_key=os.getenv("GOOGLE_MAPS_API_KEY", ""))

    # Assemble input
    geospatial_input = await assemble_geospatial_input(case_id, db_session)

    # Run agent
    runner = GeospatialAgentRunner()
    output, _ = await runner.run(
        case_id=case_id,
        workflow_id=str(workflow_id),
        user_id=user_id,
        files=[],
        hypotheses=[],
        db_session=db_session,
        publish_event=publish_event,
        geospatial_input=geospatial_input,
    )

    if output is None:
        logger.warning(
            "Geospatial agent produced no output for case=%s workflow=%s",
            case_id,
            workflow_id,
        )
        return {"locations": 0, "paths": 0, "unmappable": 0}

    # Write output
    counts = await write_geospatial_output(
        case_id, workflow_id, output, db_session, geocoding_service
    )

    return counts
