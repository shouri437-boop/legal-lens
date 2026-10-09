# ABOUTME: ADK service layer for Runner, session, and artifact management.
# ABOUTME: Provides stage-isolated sessions, file preparation, and service singletons.

import asyncio
import hashlib
import logging
from typing import TYPE_CHECKING
from uuid import UUID

from google.adk.artifacts import GcsArtifactService, InMemoryArtifactService
from google.adk.runners import Runner
from google.adk.sessions import DatabaseSessionService, Session
from google.genai import types

if TYPE_CHECKING:
    from google.adk.agents.base_agent import BaseAgent

from app.config import get_settings
from app.models.file import CaseFile
from app.services.media_text import file_to_text

logger = logging.getLogger(__name__)

# Singleton service instances (lazily initialized)
_session_service: DatabaseSessionService | None = None
_artifact_service: GcsArtifactService | InMemoryArtifactService | None = None


def get_session_service() -> DatabaseSessionService:
    """Get or create the singleton DatabaseSessionService.

    Uses postgresql+asyncpg:// URL for async operations.
    Note: For schema migrations, run separately with sync driver:
        adk migrate session --db-url="postgresql+psycopg2://..."
    """
    global _session_service
    if _session_service is None:
        settings = get_settings()
        if not settings.database_url:
            raise RuntimeError(
                "DATABASE_URL is required to initialize ADK session service"
            )
        _session_service = DatabaseSessionService(db_url=settings.database_url)
        logger.info("Initialized ADK DatabaseSessionService")
    return _session_service


def get_artifact_service() -> GcsArtifactService | InMemoryArtifactService:
    """Get or create the singleton GcsArtifactService.

    Uses adk_artifacts_bucket setting, falling back to gcs_bucket.
    The bucket must already exist (ADK does not create it).
    """
    global _artifact_service
    if _artifact_service is None:
        settings = get_settings()
        bucket_name = settings.adk_artifacts_bucket or settings.gcs_bucket
        if not bucket_name:
            # Local development without GCS: keep ADK artifacts in memory
            _artifact_service = InMemoryArtifactService()
            logger.info("Initialized ADK InMemoryArtifactService (no GCS bucket)")
        else:
            _artifact_service = GcsArtifactService(bucket_name=bucket_name)
            logger.info(
                "Initialized ADK GcsArtifactService with bucket=%s", bucket_name
            )
    return _artifact_service


def create_stage_runner(
    agent: "BaseAgent",
) -> Runner:
    """Create a Runner for a single pipeline stage.

    Each pipeline stage (triage, orchestrator, domain, synthesis) gets its own
    Runner invocation. This enables stage-isolated sessions where each agent
    gets a fresh context window without inherited multimodal file content.

    Args:
        agent: The root agent for this pipeline stage.

    Returns:
        Configured Runner with session and artifact services.
    """
    settings = get_settings()
    return Runner(
        agent=agent,
        session_service=get_session_service(),
        artifact_service=get_artifact_service(),
        app_name=settings.adk_app_name,
    )


def create_session_id(case_id: UUID, workflow_id: UUID, stage: str) -> str:
    """Create a deterministic session ID for a pipeline stage.

    Each stage gets a FRESH session to prevent context window bloat from
    multimodal file content propagating across stages.

    Args:
        case_id: The investigation case UUID.
        workflow_id: The analysis workflow UUID.
        stage: Pipeline stage name (e.g. "triage", "orchestrator", "legal").

    Returns:
        SHA-256 hex digest (64 chars) as session ID.
    """
    composite = f"{case_id}:{workflow_id}:{stage}"
    return hashlib.sha256(composite.encode()).hexdigest()


async def get_or_create_stage_session(
    user_id: str,
    case_id: UUID,
    workflow_id: UUID,
    stage: str,
    initial_state: dict[str, object] | None = None,
) -> Session:
    """Idempotent session creation for a pipeline stage.

    Each stage gets a clean session with only the data it needs.
    Inter-stage data flows via the database (agent_executions table),
    NOT via shared session state.

    Args:
        user_id: The user running the analysis.
        case_id: The investigation case UUID.
        workflow_id: The analysis workflow UUID.
        stage: Pipeline stage name.
        initial_state: Optional state to seed the session with.

    Returns:
        An ADK Session (existing or newly created).
    """
    settings = get_settings()
    session_service = get_session_service()
    session_id = create_session_id(case_id, workflow_id, stage)

    existing = await session_service.get_session(
        app_name=settings.adk_app_name,
        user_id=user_id,
        session_id=session_id,
    )
    if existing:
        return existing

    return await session_service.create_session(
        app_name=settings.adk_app_name,
        user_id=user_id,
        session_id=session_id,
        state={
            "case_id": str(case_id),
            "workflow_id": str(workflow_id),
            "stage": stage,
            **(initial_state or {}),
        },
    )


# ---------------------------------------------------------------------------
# File preparation utilities
# ---------------------------------------------------------------------------


def _fit_budget(texts: list[str], budget: int) -> list[str]:
    """Trim file texts so their combined size fits ``budget`` characters.

    Short files keep everything; the leftover is shared among longer ones
    (each keeps at least ~500 characters). Trimmed files keep their beginning
    and get a note saying so. ``budget <= 0`` disables trimming.
    """
    if budget <= 0 or sum(len(t) for t in texts) <= budget:
        return texts
    n = len(texts)
    remaining = budget
    alloc = [0] * n
    for k, i in enumerate(sorted(range(n), key=lambda i: len(texts[i]))):
        alloc[i] = min(len(texts[i]), max(remaining // (n - k), 500))
        remaining = max(remaining - alloc[i], 0)
    return [
        t
        if len(t) <= a
        else f"{t[:a]}\n\n[... excerpt: first {a} of {len(t)} characters; the rest "
        "was left out to fit the model's per-request token limit]"
        for t, a in zip(texts, alloc, strict=True)
    ]


async def build_agent_content(
    files: list[CaseFile],
    gcs_bucket: str,
    prompt: str,
) -> types.Content:
    """Build the user message for a pipeline-stage agent from files + prompt.

    Groq chat models are text-only, so PDFs, audio, video and images are first
    converted to text (see ``media_text``), concurrently across files. Each file
    is preceded by a label part with filename and ID, followed by its text,
    trimmed to ``agent_text_budget_chars`` in total.
    """
    texts = await asyncio.gather(*(file_to_text(f, gcs_bucket) for f in files))
    texts = _fit_budget(list(texts), get_settings().agent_text_budget_chars)
    parts: list[types.Part] = [types.Part(text=prompt)]
    for f, text in zip(files, texts, strict=True):
        parts.append(
            types.Part(text=f"\n\n--- File: {f.original_filename} (ID: {f.id}) ---")
        )
        parts.append(types.Part(text=text))
    return types.Content(role="user", parts=parts)


async def build_domain_agent_content(
    files: list[CaseFile],
    gcs_bucket: str,
    prompt: str,
) -> types.Content:
    """Build the user message for domain agents.

    Same as ``build_agent_content``; kept as a separate entry point so domain
    agents can diverge from triage without touching callers.
    """
    return await build_agent_content(files, gcs_bucket, prompt)
