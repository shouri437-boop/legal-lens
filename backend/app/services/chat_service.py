# ABOUTME: Chat service layer for session management and context loading.
# ABOUTME: Assembles chat agent with tools and synthesis context for case Q&A.

from __future__ import annotations

import hashlib
import logging
import re
from uuid import UUID

from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.base import MODEL_FLASH
from app.agents.chat_tools import (
    make_get_findings_tool,
    make_get_synthesis_tool,
    make_query_knowledge_graph_tool,
    make_search_findings_tool,
)
from app.agents.groq_llm import make_groq_model
from app.agents.prompts.chat import build_chat_system_prompt
from app.models import (
    Case,
    CaseContradiction,
    CaseFinding,
    CaseGap,
    CaseHypothesis,
    CaseSynthesis,
    InvestigationTask,
    KgEntity,
    Location,
    TimelineEvent,
)
from app.services.adk_service import get_artifact_service, get_session_service

logger = logging.getLogger(__name__)


async def load_chat_context(db: AsyncSession, case_id: UUID) -> dict[str, object]:
    """Load full case context for chat agent system prompt injection.

    Queries the Case record, latest CaseSynthesis, and counts from all
    analysis tables. Returns a dict suitable for build_chat_system_prompt().

    Args:
        db: Async database session.
        case_id: The investigation case UUID.

    Returns:
        Dict with case metadata, synthesis fields, and data counts.
        Includes 'analysis_available' boolean indicating whether synthesis
        data exists.

    Raises:
        ValueError: If the case is not found.
    """
    # Load case record
    case_result = await db.execute(select(Case).where(Case.id == case_id))
    case = case_result.scalar_one_or_none()
    if case is None:
        raise ValueError(f"Case {case_id} not found")

    context: dict[str, object] = {
        "case_name": case.name,
        "case_description": case.description or "",
        "case_type": case.type.value if case.type else "",
        "case_status": case.status.value if case.status else "",
        "verdict_label": case.verdict_label or "",
        "verdict_summary": case.verdict_summary or "",
    }

    # Load latest synthesis
    synth_result = await db.execute(
        select(CaseSynthesis)
        .where(CaseSynthesis.case_id == case_id)
        .order_by(CaseSynthesis.created_at.desc())
        .limit(1)
    )
    synthesis = synth_result.scalar_one_or_none()

    if synthesis:
        context["analysis_available"] = True
        context["case_summary"] = synthesis.case_summary or ""
        context["case_verdict"] = synthesis.case_verdict or {}
        context["key_findings_summary"] = synthesis.key_findings_summary or ""
        context["risk_assessment"] = synthesis.risk_assessment or ""
        context["cross_domain_conclusions"] = synthesis.cross_domain_conclusions or []
    else:
        context["analysis_available"] = False
        context["case_summary"] = ""
        context["case_verdict"] = {}
        context["key_findings_summary"] = ""
        context["risk_assessment"] = ""
        context["cross_domain_conclusions"] = []

    # Count all data types
    findings_count = await db.execute(
        select(func.count())
        .select_from(CaseFinding)
        .where(CaseFinding.case_id == case_id)
    )
    context["findings_count"] = findings_count.scalar() or 0

    entity_count = await db.execute(
        select(func.count())
        .select_from(KgEntity)
        .where(
            KgEntity.case_id == case_id,
            KgEntity.merged_into_id.is_(None),
        )
    )
    context["entity_count"] = entity_count.scalar() or 0

    hypothesis_count = await db.execute(
        select(func.count())
        .select_from(CaseHypothesis)
        .where(CaseHypothesis.case_id == case_id)
    )
    context["hypothesis_count"] = hypothesis_count.scalar() or 0

    contradiction_count = await db.execute(
        select(func.count())
        .select_from(CaseContradiction)
        .where(CaseContradiction.case_id == case_id)
    )
    context["contradiction_count"] = contradiction_count.scalar() or 0

    gap_count = await db.execute(
        select(func.count()).select_from(CaseGap).where(CaseGap.case_id == case_id)
    )
    context["gap_count"] = gap_count.scalar() or 0

    timeline_count = await db.execute(
        select(func.count())
        .select_from(TimelineEvent)
        .where(TimelineEvent.case_id == case_id)
    )
    context["timeline_count"] = timeline_count.scalar() or 0

    location_count = await db.execute(
        select(func.count()).select_from(Location).where(Location.case_id == case_id)
    )
    context["location_count"] = location_count.scalar() or 0

    task_count = await db.execute(
        select(func.count())
        .select_from(InvestigationTask)
        .where(InvestigationTask.case_id == case_id)
    )
    context["task_count"] = task_count.scalar() or 0

    return context


async def create_chat_agent_and_runner(
    case_id: str,
    user_id: str,
    context: dict[str, object],
    session_id: str | None = None,
) -> tuple[Runner, str]:
    """Create a chat agent with tools and an ADK runner bound to a session.

    Builds the system prompt from context, creates 4 closure-based tools,
    instantiates a lightweight LlmAgent (Flash model, no planner, no
    output_schema), and ensures an ADK session exists for conversation history.

    The runner is created with auto_create_session=True so that the runner's
    internal session lookup can create the session if it was not found. This
    avoids stale-session race conditions between the pre-creation here and
    the runner's internal get_session call.

    Args:
        case_id: The investigation case UUID string.
        user_id: The authenticated user's ID.
        context: Dict from load_chat_context with case metadata and synthesis.
        session_id: Optional session ID for conversation continuity. When
            None, creates a deterministic session ID from case_id + user_id.

    Returns:
        Tuple of (Runner, session_id_str). The runner is ready for run_async()
        with the returned session_id; the ADK session service handles
        conversation history persistence internally.
    """
    from app.config import get_settings

    settings = get_settings()

    # Build system prompt with full context
    system_prompt = build_chat_system_prompt(context)

    # Create closure-based tools with case_id baked in
    query_knowledge_graph = make_query_knowledge_graph_tool(case_id)
    get_findings = make_get_findings_tool(case_id)
    get_synthesis = make_get_synthesis_tool(case_id)
    search_findings = make_search_findings_tool(case_id)

    # Inline agent naming (self-contained, not imported from factory.py)
    sanitized = re.sub(r"[^a-zA-Z0-9]", "", case_id[:8])
    agent_name = f"chat_{sanitized}"

    # Create LlmAgent directly (NOT via AgentFactory -- chat has different config)
    # NO output_schema: free-form text with inline citations
    # NO planner: chat doesn't need thinking budget overhead -- speed matters
    # NO temperature override: keep the provider default temperature
    agent = LlmAgent(
        name=agent_name,
        model=make_groq_model(MODEL_FLASH, "chat"),
        instruction=system_prompt,
        tools=[query_knowledge_graph, get_findings, get_synthesis, search_findings],
    )

    # Create Runner with auto_create_session=True for chat.
    # Unlike pipeline stage runners, the chat runner must maintain conversation
    # history across requests. auto_create_session ensures the runner can
    # always find or create the session during run_async(), avoiding stale
    # session references when the pre-created session object drifts from the
    # DB state between our lookup and the runner's internal lookup.
    session_service = get_session_service()
    runner = Runner(
        agent=agent,
        session_service=session_service,
        artifact_service=get_artifact_service(),
        app_name=settings.adk_app_name,
        auto_create_session=True,
    )

    # Determine session ID
    if session_id is None:
        # Deterministic session for persistent conversations
        session_id = hashlib.sha256(f"{case_id}:{user_id}:chat".encode()).hexdigest()

    # Ensure the session exists in the DB so the runner finds it with history.
    # If it already exists, this is a no-op. If it doesn't, we create it with
    # initial state. The runner's auto_create_session is a safety net in case
    # of race conditions, but this pre-creation ensures the session has the
    # case_id in its state from the start.
    existing = await session_service.get_session(
        app_name=settings.adk_app_name,
        user_id=user_id,
        session_id=session_id,
    )

    if existing:
        logger.debug(
            "Reusing chat session=%s with %d prior events",
            session_id,
            len(existing.events),
        )
    else:
        await session_service.create_session(
            app_name=settings.adk_app_name,
            user_id=user_id,
            session_id=session_id,
            state={"case_id": case_id},
        )
        logger.info("Created chat session=%s for case=%s", session_id, case_id)

    return (runner, session_id)
