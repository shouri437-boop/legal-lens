# ABOUTME: Locations API endpoints for geospatial intelligence.
# ABOUTME: Provides endpoints for triggering geospatial analysis and retrieving location data.

from __future__ import annotations

import asyncio
import logging
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import CurrentUser
from app.config import get_settings
from app.database import get_db
from app.models import Case
from app.models.synthesis import Location
from app.services.agent_events import (
    emit_agent_error,
    emit_agent_started,
    emit_geospatial_complete,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases/{case_id}", tags=["geospatial"])

# In-memory tracking for in-flight geospatial generation tasks.
# Follows the same single-instance in-memory pattern as SSE event buffers.
_generating_cases: set[str] = set()
# Why the last generation of a case failed (cleared when a new one starts).
_generation_errors: dict[str, str] = {}


async def _get_user_case(
    db: AsyncSession,
    case_id: UUID,
    user_id: str,
) -> Case:
    """Fetch a case ensuring ownership. Raises 404 if not found or not owned."""
    result = await db.execute(
        select(Case).where(
            Case.id == case_id,
            Case.user_id == user_id,
            Case.deleted_at.is_(None),
        )
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )
    return case


# ---------------------------------------------------------------------------
# Generation & Status
# ---------------------------------------------------------------------------


@router.post("/geospatial/generate", status_code=202)
async def generate_geospatial_intelligence(
    case_id: UUID,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    force: Annotated[
        bool, Query(description="Force regeneration even if exists")
    ] = False,
):
    """Trigger on-demand geospatial analysis.

    Schedules a background task with its own DB session (following the
    pipeline pattern). Returns immediately with 202 Accepted.
    Frontend polls GET /geospatial/status for progress.
    """
    # Verify case ownership
    await _get_user_case(db, case_id, current_user.id)

    # Check if analysis already exists (unless force=True)
    if not force:
        existing_stmt = select(func.count(Location.id)).where(
            Location.case_id == case_id
        )
        existing_count = (await db.execute(existing_stmt)).scalar()
        if existing_count and existing_count > 0:
            return {
                "status": "exists",
                "message": "Geospatial analysis already exists. Use force=true to regenerate.",
                "location_count": existing_count,
            }

    # One build per case: a second click must not start a duplicate run.
    if str(case_id) in _generating_cases:
        return {"status": "generating", "case_id": str(case_id)}

    # Claim the slot now (before the task is scheduled) so a second request sees it.
    _generating_cases.add(str(case_id))
    _generation_errors.pop(str(case_id), None)

    # Schedule background task (uses its own DB session, not the request session)
    workflow_id = uuid4()
    background_tasks.add_task(
        _run_geospatial_background,
        case_id=str(case_id),
        workflow_id=workflow_id,
        user_id=current_user.id,
    )

    return {"status": "generating", "case_id": str(case_id)}


async def _run_geospatial_background(
    case_id: str,
    workflow_id: UUID,
    user_id: str,
) -> None:
    """Background task that runs geospatial analysis with its own DB session.

    Follows the pipeline pattern: creates an independent session from the
    session factory so it is decoupled from the request lifecycle.
    """
    from app.database import _get_sessionmaker
    from app.services.case_timeline import build_case_chronology

    task_id = str(uuid4())
    session_factory = _get_sessionmaker()

    _generating_cases.add(case_id)
    await emit_agent_started(case_id, "geospatial", task_id, "", "geospatial-analysis")

    async with session_factory() as db:
        try:
            # Builds the detailed timeline AND the map locations from the documents.
            counts = await asyncio.wait_for(
                build_case_chronology(case_id, workflow_id, db),
                timeout=get_settings().chronology_timeout_seconds,
            )
            await db.commit()
            await emit_geospatial_complete(case_id, counts)
        except TimeoutError:
            minutes = get_settings().chronology_timeout_seconds / 60
            logger.error("Geospatial generation timed out after %.0f min", minutes)
            await db.rollback()
            _generation_errors[case_id] = (
                f"Building the timeline took longer than {minutes:.0f} minutes and "
                "was stopped. Try again; existing results were kept."
            )
            await emit_agent_error(case_id, "geospatial", task_id, "timed out")
        except Exception as e:
            logger.error("Geospatial generation failed: %s", e, exc_info=True)
            await db.rollback()
            _generation_errors[case_id] = str(e)[:300] or type(e).__name__
            await emit_agent_error(case_id, "geospatial", task_id, str(e)[:500])
        finally:
            _generating_cases.discard(case_id)


@router.get("/geospatial/status")
async def get_geospatial_status(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Check if geospatial analysis exists and its status."""
    # Verify case ownership
    await _get_user_case(db, case_id, current_user.id)

    # Check if generation is in progress
    if str(case_id) in _generating_cases:
        return {
            "exists": False,
            "status": "generating",
            "location_count": 0,
        }

    # The last run failed: say why instead of looking like "not started" or "done"
    if str(case_id) in _generation_errors:
        failed_count = (
            await db.execute(
                select(func.count(Location.id)).where(Location.case_id == case_id)
            )
        ).scalar() or 0
        return {
            "exists": failed_count > 0,
            "status": "failed",
            "error": _generation_errors[str(case_id)],
            "location_count": failed_count,
        }

    # Check if locations exist
    count_stmt = select(func.count(Location.id)).where(Location.case_id == case_id)
    location_count = (await db.execute(count_stmt)).scalar() or 0

    if location_count == 0:
        return {
            "exists": False,
            "status": "not_started",
            "location_count": 0,
        }

    # Get latest location timestamp
    latest_stmt = (
        select(Location.created_at)
        .where(Location.case_id == case_id)
        .order_by(Location.created_at.desc())
        .limit(1)
    )
    latest_created = (await db.execute(latest_stmt)).scalar_one_or_none()

    return {
        "exists": True,
        "status": "complete",
        "location_count": location_count,
        "last_generated": latest_created.isoformat() if latest_created else None,
    }


# ---------------------------------------------------------------------------
# Locations
# ---------------------------------------------------------------------------


@router.get("/locations")
async def get_locations(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    location_type: Annotated[
        str | None,
        Query(
            description="Filter by type: crime_scene, witness_location, evidence_location, suspect_location, other"
        ),
    ] = None,
):
    """Get all locations for map visualization."""
    # Verify case ownership
    await _get_user_case(db, case_id, current_user.id)

    # Build query
    stmt = select(Location).where(Location.case_id == case_id)
    if location_type:
        stmt = stmt.where(Location.location_type == location_type)
    stmt = stmt.order_by(Location.name)

    locations = (await db.execute(stmt)).scalars().all()

    return {
        "locations": [
            {
                "id": str(loc.id),
                "name": loc.name,
                "coordinates": loc.coordinates if loc.coordinates else None,
                "location_type": loc.location_type,
                "event_count": (
                    len(
                        [
                            item
                            for item in loc.temporal_associations or []
                            if item.get("type") == "event"
                        ]
                    )
                ),
                "has_temporal_period": (
                    any(
                        item.get("type") == "period"
                        for item in loc.temporal_associations or []
                    )
                ),
            }
            for loc in locations
        ]
    }


@router.get("/locations/{location_id}")
async def get_location_detail(
    case_id: UUID,
    location_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get detailed location data with events and temporal associations."""
    # Verify case ownership
    await _get_user_case(db, case_id, current_user.id)

    # Get location
    stmt = select(Location).where(
        Location.case_id == case_id, Location.id == location_id
    )
    location = (await db.execute(stmt)).scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    # Extract events and temporal periods from temporal_associations JSONB
    events = []
    temporal_period = None
    if location.temporal_associations:
        for item in location.temporal_associations:
            if item.get("type") == "event":
                events.append(
                    {
                        "title": item.get("title"),
                        "description": item.get("description"),
                        "timestamp": item.get("timestamp"),
                        "layer": item.get("layer"),
                        "confidence": item.get("confidence"),
                    }
                )
            elif item.get("type") == "period":
                temporal_period = {
                    "start": item.get("start"),
                    "end": item.get("end"),
                }

    return {
        "id": str(location.id),
        "name": location.name,
        "coordinates": location.coordinates,
        "location_type": location.location_type,
        "events": events,
        "citations": location.citations or [],
        "temporal_period": temporal_period,
        "source_entity_ids": location.source_entity_ids or [],
    }


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------


@router.get("/paths")
async def get_paths(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get movement paths for visualization.

    Note: For Phase 8.1, paths are stored in GeospatialOutput but not persisted.
    Phase 8.2 may add dedicated paths table.
    """
    # Verify case ownership
    await _get_user_case(db, case_id, current_user.id)

    # For v1, return empty array (paths not persisted to DB yet)
    # Phase 8.2 can add proper path persistence and retrieval
    return {"paths": []}


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


@router.delete("/geospatial")
async def delete_geospatial_data(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Clear geospatial data for regeneration."""
    # Verify case ownership
    await _get_user_case(db, case_id, current_user.id)

    # Count before delete
    count_stmt = select(func.count(Location.id)).where(Location.case_id == case_id)
    location_count = (await db.execute(count_stmt)).scalar() or 0

    # Delete all locations for this case
    delete_stmt = delete(Location).where(Location.case_id == case_id)
    await db.execute(delete_stmt)
    await db.commit()

    return {"deleted": True, "location_count": location_count}
