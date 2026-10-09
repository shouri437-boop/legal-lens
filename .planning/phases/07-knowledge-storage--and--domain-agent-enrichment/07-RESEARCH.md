# Phase 7: Knowledge Storage & Domain Agent Enrichment - Research

**Researched:** 2026-02-07
**Domain:** Backend infrastructure (database schema, services, API endpoints, domain agent enrichment, search indexing)
**Confidence:** HIGH

## Summary

This phase adds the knowledge storage foundation and enriches domain agent outputs for downstream KG, Synthesis, and Chat consumption. The research focused on understanding the existing codebase deeply -- its models, schemas, services, pipeline wiring, SSE patterns, Alembic migrations, and domain agent architecture -- to ensure Phase 7 additions integrate seamlessly.

The existing codebase follows consistent, well-established patterns: SQLAlchemy ORM models with `Base` inheritance, Pydantic schemas for API contracts, FastAPI routers with `CurrentUser` auth dependency, in-memory SSE pub/sub via `agent_events.py`, and Alembic migrations with explicit `upgrade()`/`downgrade()` functions. Phase 7 should replicate these patterns exactly for all 9 new tables, 2 new services, 2 new API routers, and 3 new SSE event types.

**Primary recommendation:** Follow existing codebase patterns exactly. New models go in `backend/app/models/`, new schemas in `backend/app/schemas/`, new services in `backend/app/services/`, new API routers in `backend/app/api/`. The programmatic KG Builder is a pure Python service (not an LLM agent) that reads `agent_executions.output_data` JSONB and writes to new KG tables. PG full-text search via tsvector is the v1 search implementation; the CONTEXT.md-specified `text-embedding-004` is **deprecated as of 2026-01-14** and should be replaced by `gemini-embedding-001` when the vector search upgrade path is implemented.

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy | >=2.0.36 | ORM, async DB access | Already used throughout project |
| asyncpg | >=0.30.0 | Async PostgreSQL driver | Already used, required for async SQLAlchemy |
| Alembic | >=1.14.0 | Database migrations | Already used for all schema changes |
| FastAPI | >=0.115.0 | API framework | Already used for all endpoints |
| Pydantic | >=2.10.0 | Schema validation | Already used for all request/response models |
| sse-starlette | >=2.2.0 | SSE streaming | Already used for all SSE endpoints |
| google-genai | >=0.8.0 | Gemini API (future embeddings) | Already used for agent interactions |

### New Dependencies Required

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rapidfuzz | latest (>=3.x) | Levenshtein fuzzy string matching | Entity deduplication (85%+ threshold) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rapidfuzz | python-Levenshtein | python-Levenshtein is GPL-licensed; rapidfuzz is MIT, faster, and the recommended replacement |
| PG tsvector (v1) | pgvector | pgvector requires extension install; tsvector is built-in PostgreSQL. Use tsvector for v1, add pgvector or Vertex AI embeddings later |
| text-embedding-004 | gemini-embedding-001 | text-embedding-004 was **deprecated 2026-01-14**. Use gemini-embedding-001 (3072 dims, superior performance) when vector search is implemented |

**Installation:**
```bash
cd backend && uv add rapidfuzz
```

## Architecture Patterns

### Existing Project Structure (Must Follow)
```
backend/app/
  models/
    __init__.py          # Exports all models + Base
    base.py              # DeclarativeBase
    case.py              # Case model
    file.py              # CaseFile model
    agent_execution.py   # AgentExecution model
    auth.py              # User, Session, Account models
  schemas/
    __init__.py          # Exports all schemas
    agent.py             # Agent-related schemas (Citation, Finding, DomainEntity, etc.)
    case.py              # Case CRUD schemas
    file.py              # File CRUD schemas
    common.py            # ErrorResponse, TimestampMixin
  services/
    __init__.py
    pipeline.py          # run_analysis_workflow (background task)
    agent_events.py      # SSE pub/sub + event emitters
    file_service.py      # GCS upload/download
    adk_service.py       # ADK session management
    confirmation.py      # HITL confirmation service
  api/
    __init__.py
    agents.py            # POST /api/cases/:id/analyze, GET status
    cases.py             # Case CRUD
    files.py             # File CRUD
    sse.py               # SSE endpoints
    auth.py              # Auth middleware + CurrentUser
    health.py            # Health check
    confirmations.py     # HITL REST API
  agents/
    domain_agent_runner.py  # DomainAgentRunner Template Method
    domain_runner.py        # compute_agent_tasks, run_domain_agents_parallel
    parsing.py              # extract_structured_json, extract_response_texts
    financial.py            # Financial agent module
    legal.py                # Legal agent module
    evidence.py             # Evidence agent module
    strategy.py             # Strategy agent module
    prompts/                # Agent prompt text modules
```

### New Files to Create (Phase 7)
```
backend/app/
  models/
    knowledge_graph.py   # KgEntity, KgRelationship
    findings.py          # CaseFinding
    synthesis.py         # CaseHypothesis, CaseContradiction, CaseGap, CaseSynthesis,
                         #   TimelineEvent, Location
  schemas/
    knowledge_graph.py   # KG API request/response schemas
    findings.py          # Findings API schemas
  services/
    kg_builder.py        # Programmatic KG Builder service
    findings_service.py  # case_findings storage service
  api/
    knowledge_graph.py   # KG API endpoints
    findings.py          # Findings API endpoints
  alembic/versions/
    xxxx_add_knowledge_tables.py  # Single migration for all 9 tables
```

### Pattern 1: SQLAlchemy Model Definition (Copy from existing)

**What:** All models inherit from `Base`, use `PG_UUID` primary keys with `gen_random_uuid()`, and include `created_at`/`updated_at` timestamps with `server_default=text("now()")`.

**When to use:** Every new table.

**Example (from existing `agent_execution.py`):**
```python
from sqlalchemy import DateTime, ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class KgEntity(Base):
    __tablename__ = "kg_entities"
    __table_args__ = (
        Index("idx_kg_entities_case_id", "case_id"),
        # GIN index for full-text search on name
        Index("idx_kg_entities_name_tsvector", "name_tsvector", postgresql_using="gin"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    case_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    # ... remaining columns follow same pattern
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
```

### Pattern 2: Pydantic Schema Definition (Copy from existing)

**What:** All response schemas use `ConfigDict(from_attributes=True)` for ORM compatibility. Request schemas use Field validators.

**Example (from existing `case.py`):**
```python
from pydantic import BaseModel, ConfigDict, Field

class EntityResponse(BaseModel):
    id: UUID = Field(..., description="Entity ID")
    case_id: UUID = Field(..., description="Case ID")
    name: str = Field(..., description="Entity name")
    entity_type: str = Field(..., description="Entity type")
    # ...
    model_config = ConfigDict(from_attributes=True)
```

### Pattern 3: FastAPI Router Definition (Copy from existing)

**What:** Routers use `APIRouter(prefix=..., tags=[...])`, `CurrentUser` dependency for auth, `Depends(get_db)` for DB sessions.

**Example (from existing `files.py`):**
```python
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.auth import CurrentUser
from app.database import get_db

router = APIRouter(prefix="/api/cases/{case_id}/entities", tags=["knowledge-graph"])

@router.get(
    "",
    response_model=EntityListResponse,
    summary="List entities for a case",
)
async def list_entities(
    case_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EntityListResponse:
    # Verify case ownership first
    case = await _get_user_case(db, case_id, current_user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    # ... query and return
```

### Pattern 4: SSE Event Emission (Copy from existing)

**What:** New event types are added to `AgentEventType` enum, convenience emitter functions are added to `agent_events.py`, and they're called from `pipeline.py`.

**Example (from existing `agent_events.py`):**
```python
class AgentEventType(str, Enum):
    # ... existing events ...
    FINDING_COMMITTED = "finding-committed"
    KG_ENTITY_ADDED = "kg-entity-added"
    KG_RELATIONSHIP_ADDED = "kg-relationship-added"

async def emit_finding_committed(
    case_id: str,
    finding_id: str,
    agent_type: str,
    title: str,
) -> None:
    await publish_agent_event(
        case_id,
        AgentEventType.FINDING_COMMITTED,
        {
            "type": AgentEventType.FINDING_COMMITTED.value,
            "findingId": finding_id,
            "agentType": agent_type,
            "title": title,
        },
    )
```

### Pattern 5: Alembic Migration (Copy from existing)

**What:** Each migration has a docstring with revision ID and `down_revision` chain. Uses `op.create_table()` with explicit column definitions, followed by `op.create_index()`.

**Example (from existing `0562cc9e65bd_add_agent_executions_table.py`):**
```python
revision: str = "xxxx_knowledge_tables"
down_revision: str | Sequence[str] | None = "b3a1f7c42e90"  # latest migration

def upgrade() -> None:
    op.create_table("kg_entities", ...)
    op.create_index(...)

def downgrade() -> None:
    op.drop_index(...)
    op.drop_table(...)
```

### Pattern 6: Pipeline Wiring (Modify existing `pipeline.py`)

**What:** After domain agents complete and before `processing-complete`, insert KG Builder + findings storage steps.

**Current pipeline flow:**
```
Triage -> Orchestrator -> Domain Agents (parallel) -> Strategy -> HITL -> Final
```

**Phase 7 updated flow:**
```
Triage -> Orchestrator -> Domain Agents (parallel) -> Strategy -> HITL
  -> [NEW] Save findings to case_findings (per agent)
  -> [NEW] Run KG Builder (entity extraction + relationships)
  -> [NEW] Run entity deduplication pass
  -> [NEW] Emit FINDING_COMMITTED / KG_ENTITY_ADDED / KG_RELATIONSHIP_ADDED SSE events
  -> Final (update file statuses, emit processing-complete)
```

### Pattern 7: Service Pattern (Copy from existing `file_service.py`)

**What:** Services are standalone modules with async functions. They take DB sessions as parameters (not global state). They handle errors and log operations.

**Example structure for `kg_builder.py`:**
```python
async def build_knowledge_graph(
    case_id: str,
    workflow_id: str,
    domain_results: dict[str, list[tuple[BaseModel | None, str]]],
    db: AsyncSession,
) -> tuple[int, int]:
    """Extract entities and relationships from domain agent outputs.

    Returns:
        Tuple of (entities_created, relationships_created).
    """
    # Read domain output -> extract DomainEntity -> write KgEntity
    # Build co-occurrence relationships -> write KgRelationship
    # Run deduplication pass
```

### Anti-Patterns to Avoid

- **Do NOT create an LLM agent for KG building:** The CONTEXT.md explicitly states KG Builder is a "Programmatic Python service, NOT LLM." It reads structured Pydantic output programmatically.
- **Do NOT use dict for JSONB mapped columns:** Use `Mapped[dict | None]` with explicit JSONB type, matching the existing `agent_execution.py` pattern.
- **Do NOT create separate Alembic migrations per table:** Create ONE migration for all 9 tables to keep the migration chain clean.
- **Do NOT use `gen_random_uuid()` in Python:** Use `server_default=text("gen_random_uuid()")` to let PostgreSQL generate UUIDs, matching existing models.
- **Do NOT filter or discard entities:** The ROADMAP explicitly states "Additive-only: NEVER filters or discards entities/relationships."
- **Do NOT store MetadataEntry lists as JSONB arrays of objects:** Use JSONB directly and convert MetadataEntry lists to dicts when storing in KG tables.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Custom Levenshtein | `rapidfuzz.fuzz.ratio()` | C-optimized, handles Unicode, 10x faster than pure Python |
| Full-text search | Custom text search | PostgreSQL `tsvector` + `to_tsquery` + GIN index | Built into PostgreSQL, handles stemming, ranking, phrase search |
| UUID generation | `uuid4()` in Python | `server_default=text("gen_random_uuid()")` | Consistent with all existing models, DB-generated |
| JSON serialization | Custom serializers | Pydantic `model_dump(mode="json")` | Already used throughout (see `domain_agent_runner.py` line 318) |
| SSE event publishing | New pub/sub | Existing `publish_agent_event()` | In-memory pub/sub already handles subscriber management, replay buffers |
| Entity name normalization | Custom normalizer | `name.strip().lower()` + remove punctuation via `str.translate()` | Simple, deterministic, consistent |

**Key insight:** The project already has well-established patterns for every infrastructure concern. Phase 7 should never invent new patterns -- it should replicate existing ones exactly for all new models, schemas, services, APIs, and SSE events.

## Common Pitfalls

### Pitfall 1: Circular Import Between Models and Pipeline

**What goes wrong:** New models imported in `models/__init__.py` can create circular imports with `pipeline.py` if services import models that import other services.

**Why it happens:** The pipeline imports from multiple services and agents that all need model definitions.

**How to avoid:** Follow the existing pattern: models only import from `base.py`. Services import models. API imports services. Pipeline uses lazy imports (see `pipeline.py` lines 145-159 for existing `from app.agents.base import create_sse_publish_fn` inside the function body).

**Warning signs:** `ImportError: cannot import name ... from partially initialized module`.

### Pitfall 2: Alembic env.py Must See All Models

**What goes wrong:** New tables not created by `alembic upgrade head` because Alembic's `target_metadata = Base.metadata` doesn't see the new models.

**Why it happens:** `alembic/env.py` imports `from app.models import Base` which imports `models/__init__.py`. If new model files aren't imported there, their tables aren't in `Base.metadata`.

**How to avoid:** Add all new model classes to `models/__init__.py`'s imports and `__all__`. The existing file already does this for `AgentExecution`, `Case`, `CaseFile`, etc.

**Warning signs:** `alembic revision --autogenerate` doesn't detect the new tables.

### Pitfall 3: JSONB Column Type Annotations

**What goes wrong:** MyPy or runtime errors from incorrect JSONB column type annotations.

**Why it happens:** SQLAlchemy JSONB maps to Python `dict` but the type annotation needs to match.

**How to avoid:** Follow the existing pattern from `agent_execution.py`:
```python
output_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
citations: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # For JSON arrays
```

### Pitfall 4: Domain Agent Output Schema Changes Must Be Backward Compatible

**What goes wrong:** Adding `findings_text: str` to output schemas breaks parsing of existing `agent_executions.output_data` records.

**Why it happens:** The `extract_structured_json` parser validates against Pydantic models. Existing JSONB records won't have the new field.

**How to avoid:** Make new fields optional with defaults:
```python
findings_text: str | None = Field(
    default=None,
    description="Rich markdown analysis text with inline citations",
)
```
This way, old records parse successfully (field defaults to None), and new pipeline runs produce the enriched field.

### Pitfall 5: Pipeline Session Scope for KG Builder

**What goes wrong:** KG Builder operations partially committed if an error occurs mid-entity-extraction.

**Why it happens:** The pipeline uses a single `async with session_factory() as db:` block. If KG Builder fails partway through, some entities are flushed but not committed.

**How to avoid:** Follow the existing pattern where each stage flushes incrementally and commits at stage boundaries. The KG Builder should:
1. Extract all entities and flush (not commit)
2. Build all relationships and flush
3. Run deduplication and flush
4. Only commit once all three steps succeed
If any step fails, the session rollback cleans up all three.

### Pitfall 6: tsvector Generated Column Migration

**What goes wrong:** Alembic detects changes to generated columns on every autogenerate run, creating phantom migrations.

**Why it happens:** Known Alembic issue (#1390) -- generated columns with `to_tsvector()` expressions are always flagged as changed.

**How to avoid:** Don't use Alembic autogenerate for the tsvector column. Write the migration manually with raw SQL:
```python
op.execute("""
    ALTER TABLE case_findings ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(finding_text, ''))) STORED
""")
op.execute("""
    CREATE INDEX idx_case_findings_search ON case_findings USING gin(search_vector)
""")
```

### Pitfall 7: Entity Deduplication Must Not Delete -- Soft Merge Only

**What goes wrong:** Hard-deleting duplicate entities orphans relationship edges and citation references.

**Why it happens:** The naive approach is to delete the duplicate entity row.

**How to avoid:** Per CONTEXT.md decision, use `merged_into_id` soft merge:
1. Set `merged_into_id = primary_entity.id` on the duplicate
2. Update all relationships pointing to the duplicate to point to the primary
3. Increment a `merge_count` or similar field on the primary
4. The duplicate row stays for audit trail and unmerge capability (Phase 11)

## Code Examples

### Example 1: KgEntity SQLAlchemy Model

```python
# Source: Pattern derived from existing agent_execution.py
import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class KgEntity(Base):
    __tablename__ = "kg_entities"
    __table_args__ = (
        Index("idx_kg_entities_case_id", "case_id"),
        Index("idx_kg_entities_case_type", "case_id", "entity_type"),
        Index("idx_kg_entities_merged_into", "merged_into_id"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    case_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    name_normalized: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="Lowercase, stripped, punctuation-removed name for dedup matching",
    )
    entity_type: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Domain-specific type (e.g., 'monetary_amount', 'statute', 'alias')",
    )
    domain: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Source domain agent (financial, legal, evidence, strategy)",
    )
    confidence: Mapped[float] = mapped_column(nullable=False, default=0.0)
    metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_execution_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("agent_executions.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_finding_index: Mapped[int | None] = mapped_column(
        Integer, nullable=True,
        comment="Index within the finding's entity list for traceability",
    )
    merged_into_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("kg_entities.id", ondelete="SET NULL"),
        nullable=True,
        comment="If set, this entity was merged into the referenced entity",
    )
    merge_count: Mapped[int] = mapped_column(
        Integer, server_default="0", nullable=False,
        comment="Number of other entities merged into this one",
    )
    degree: Mapped[int] = mapped_column(
        Integer, server_default="0", nullable=False,
        comment="Connection count for node sizing in graph visualization",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    # Relationships
    case = relationship("Case")
    source_execution = relationship("AgentExecution")
```

### Example 2: CaseFinding Model with tsvector Search

```python
# Source: Pattern from agent_execution.py + PG tsvector docs
class CaseFinding(Base):
    __tablename__ = "case_findings"
    __table_args__ = (
        Index("idx_case_findings_case_id", "case_id"),
        Index("idx_case_findings_workflow", "workflow_id"),
        Index("idx_case_findings_agent", "case_id", "agent_type"),
        # GIN index for full-text search added via raw SQL in migration
        # (generated column + GIN index, see Pitfall 6)
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    case_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    workflow_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False,
    )
    agent_type: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="Source agent (financial, legal, evidence, strategy)",
    )
    agent_execution_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("agent_executions.id", ondelete="SET NULL"),
        nullable=True,
    )
    file_group_label: Mapped[str | None] = mapped_column(
        String(100), nullable=True,
        comment="Group label for multi-file agent runs",
    )
    category: Mapped[str] = mapped_column(String(200), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    finding_text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(nullable=False)
    citations: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    entity_ids: Mapped[list | None] = mapped_column(
        JSONB, nullable=True,
        comment="IDs of kg_entities linked to this finding",
    )
    # search_vector: added via generated column in migration (Pitfall 6)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
```

### Example 3: Full-Text Search Query

```python
# Source: PostgreSQL docs + SQLAlchemy 2.0 dialect docs
from sqlalchemy import func, text as sa_text

async def search_findings(
    db: AsyncSession,
    case_id: UUID,
    query: str,
    limit: int = 20,
) -> list[CaseFinding]:
    """Search case findings using PostgreSQL full-text search."""
    ts_query = func.plainto_tsquery("english", query)
    result = await db.execute(
        select(CaseFinding)
        .where(
            CaseFinding.case_id == case_id,
            CaseFinding.search_vector.bool_op("@@")(ts_query),
        )
        .order_by(func.ts_rank(CaseFinding.search_vector, ts_query).desc())
        .limit(limit)
    )
    return list(result.scalars().all())
```

### Example 4: Entity Deduplication with RapidFuzz

```python
# Source: rapidfuzz GitHub docs
from rapidfuzz import fuzz

EXACT_MATCH_THRESHOLD = 100  # Normalized name + type + domain must match exactly
FUZZY_MATCH_THRESHOLD = 85   # Levenshtein ratio threshold for flagging

def find_duplicates(
    entities: list[KgEntity],
) -> tuple[list[tuple[UUID, UUID]], list[tuple[UUID, UUID, float]]]:
    """Find exact and fuzzy duplicate entity pairs.

    Returns:
        Tuple of (exact_merge_pairs, fuzzy_flag_pairs).
        exact_merge_pairs: list of (duplicate_id, primary_id) for auto-merge.
        fuzzy_flag_pairs: list of (id_a, id_b, similarity) for LLM resolution.
    """
    exact_merges: list[tuple[UUID, UUID]] = []
    fuzzy_flags: list[tuple[UUID, UUID, float]] = []

    # Group by (entity_type, domain) to narrow comparison space
    groups: dict[tuple[str, str], list[KgEntity]] = {}
    for entity in entities:
        if entity.merged_into_id is not None:
            continue  # Skip already-merged entities
        key = (entity.entity_type, entity.domain)
        groups.setdefault(key, []).append(entity)

    for group_entities in groups.values():
        for i, entity_a in enumerate(group_entities):
            for entity_b in group_entities[i + 1:]:
                # Exact match on normalized name
                if entity_a.name_normalized == entity_b.name_normalized:
                    exact_merges.append((entity_b.id, entity_a.id))
                    continue
                # Fuzzy match
                ratio = fuzz.ratio(entity_a.name_normalized, entity_b.name_normalized)
                if ratio >= FUZZY_MATCH_THRESHOLD:
                    fuzzy_flags.append((entity_a.id, entity_b.id, ratio))

    return exact_merges, fuzzy_flags
```

### Example 5: KG Builder Service Core Logic

```python
# Source: Derived from existing domain_runner.py pattern
from pydantic import BaseModel
from app.schemas.agent import DomainEntity, Finding, Citation

async def extract_entities_from_output(
    output: BaseModel,
    agent_type: str,
    execution_id: UUID,
    case_id: UUID,
    db: AsyncSession,
) -> list[KgEntity]:
    """Extract entities from a domain agent's structured output.

    Reads both top-level entities and per-finding entities.
    Creates KgEntity rows for each. Does NOT filter or discard any entity.
    """
    entities_created: list[KgEntity] = []

    if not hasattr(output, "entities"):
        return entities_created

    for idx, domain_entity in enumerate(output.entities):
        normalized_name = normalize_entity_name(domain_entity.value)
        metadata_dict = {m.key: m.value for m in domain_entity.metadata} if domain_entity.metadata else None

        kg_entity = KgEntity(
            case_id=case_id,
            name=domain_entity.value,
            name_normalized=normalized_name,
            entity_type=domain_entity.type,
            domain=agent_type,
            confidence=domain_entity.confidence,
            metadata=metadata_dict,
            context=domain_entity.context,
            source_execution_id=execution_id,
            source_finding_index=idx,
        )
        db.add(kg_entity)
        entities_created.append(kg_entity)

    # Also extract entities embedded within findings
    if hasattr(output, "findings"):
        for finding_idx, finding in enumerate(output.findings):
            for entity_idx, domain_entity in enumerate(finding.entities):
                normalized_name = normalize_entity_name(domain_entity.value)
                metadata_dict = {m.key: m.value for m in domain_entity.metadata} if domain_entity.metadata else None

                kg_entity = KgEntity(
                    case_id=case_id,
                    name=domain_entity.value,
                    name_normalized=normalized_name,
                    entity_type=domain_entity.type,
                    domain=agent_type,
                    confidence=domain_entity.confidence,
                    metadata=metadata_dict,
                    context=domain_entity.context,
                    source_execution_id=execution_id,
                    source_finding_index=None,  # Finding-level entity
                )
                db.add(kg_entity)
                entities_created.append(kg_entity)

    await db.flush()
    return entities_created


def normalize_entity_name(name: str) -> str:
    """Normalize entity name for deduplication matching.

    Strips whitespace, lowercases, removes punctuation.
    """
    import string
    return name.strip().lower().translate(str.maketrans("", "", string.punctuation))
```

### Example 6: Adding Findings Text to Domain Agent Schema

```python
# Source: Existing schemas/agent.py Finding model
# Add findings_text as optional field to each domain output model

class FinancialOutput(BaseModel):
    findings: list[Finding] = Field(default_factory=list, ...)
    findings_text: str | None = Field(
        default=None,
        description="Rich markdown analysis text with inline source references. "
        "Contains the agent's full narrative analysis organized by category, "
        "with every factual claim citing the exact source excerpt.",
    )
    # ... existing fields remain unchanged
```

### Example 7: Citation Model Enhancement

```python
# Source: Existing schemas/agent.py Citation model (currently)
# Current Citation has excerpt as optional with max_length=500

# Enhanced Citation for Phase 7:
class Citation(BaseModel):
    file_id: str = Field(..., description="ID of the source file")
    locator: str = Field(
        ...,
        description="Exact location within the file. "
        "Format: 'page:3', 'ts:01:23:45', 'region:x,y,w,h'",
    )
    excerpt: str = Field(
        ...,  # Changed from optional to required
        description="Exact character-for-character excerpt from the source. "
        "Preserved in original format for PDF.js search highlighting.",
    )
```

**Note:** Making `excerpt` required is a breaking schema change. The prompt enrichment should instruct agents to ALWAYS provide excerpts. The Pydantic field should remain `str | None` with `default=None` for backward compatibility with stored `agent_executions.output_data`, but the prompt should strongly instruct "EVERY citation MUST include the exact excerpt."

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| text-embedding-004 | gemini-embedding-001 | 2026-01-14 (deprecation) | Use gemini-embedding-001 for vector search upgrade path. 3072 dims, superior performance |
| python-Levenshtein (GPL) | rapidfuzz (MIT) | 2023+ | Use rapidfuzz for all fuzzy string matching. Same API, faster, MIT licensed |
| SQLAlchemy TSVECTOR via TypeDecorator | Generated STORED column + GIN | Stable | Use PostgreSQL generated columns for tsvector, not application-layer compute |

**Deprecated/outdated:**
- **text-embedding-004**: Deprecated 2026-01-14. CONTEXT.md specified this model but it is no longer available. Use `gemini-embedding-001` (3072 dims, task-adaptive) when implementing vector search.
- **python-Levenshtein**: GPL-licensed legacy package. Use `rapidfuzz` instead (MIT, same underlying algorithms, faster).

## Open Questions

1. **tsvector Search Column Scope**
   - What we know: CONTEXT.md says "Full indexing -- findings + entities + citations. Maximum search coverage."
   - What's unclear: Whether to create separate tsvector columns per table or a unified search view/materialized view.
   - Recommendation: Start with tsvector on `case_findings.finding_text` (most searchable content). Add tsvector on `kg_entities.name` as a simple text column index. Citation excerpts are embedded in findings JSONB so they're already covered by finding-level search. Avoid premature optimization with materialized views.

2. **Background Degree Computation Mechanism**
   - What we know: CONTEXT.md says "Background job after pipeline completes. Async calculation."
   - What's unclear: Whether to use a simple `asyncio.create_task()` or a proper job queue.
   - Recommendation: Use a simple async function called after deduplication in the pipeline. No need for a separate job queue framework for a hackathon project. The degree computation is a single SQL query (`COUNT(*) FROM kg_relationships WHERE source_entity_id = X OR target_entity_id = X`).

3. **Synthesis Tables Schema Finality**
   - What we know: Phase 7 creates the tables, Phase 8 populates them.
   - What's unclear: Whether the synthesis table schemas will need changes when the Synthesis Agent is implemented.
   - Recommendation: Create the tables with the schemas described in ROADMAP.md. Make JSONB columns (supporting_evidence, contradicting_evidence, etc.) flexible enough to accommodate Phase 8 refinements. The worst case is a small migration in Phase 8.

4. **Relationship Strength Calculation**
   - What we know: CONTEXT.md says "Hybrid approach combining frequency of co-occurrence + agent-provided confidence."
   - What's unclear: The exact formula for combining these two signals.
   - Recommendation: Start with `strength = min(100, co_occurrence_count * 20 + avg_entity_confidence * 0.3)` as a simple heuristic. The Synthesis Agent (Phase 8) can refine strengths later.

## Existing Code Integration Points

### Domain Agent Output Data Location

Domain agent results are stored in `agent_executions.output_data` (JSONB). The KG Builder reads this data. The column contains the full Pydantic model output serialized via `model_dump(mode="json")` (see `domain_agent_runner.py` line 318).

To find all domain agent results for a workflow:
```python
result = await db.execute(
    select(AgentExecution)
    .where(
        AgentExecution.workflow_id == UUID(workflow_id),
        AgentExecution.agent_name.in_(["financial", "legal", "evidence", "strategy"]),
        AgentExecution.status == AgentExecutionStatus.COMPLETED,
    )
)
```

### Pipeline Insertion Point

In `services/pipeline.py`, the KG Builder and findings storage should be inserted after the HITL stage (line ~919) and before the final file status update (line ~921). The domain_results dict is available at this point with all agent outputs.

### Router Registration

New routers must be registered in `app/main.py`:
```python
from app.api import knowledge_graph, findings
app.include_router(knowledge_graph.router, tags=["knowledge-graph"])
app.include_router(findings.router, tags=["findings"])
```

### Schema Registration

New schemas must be exported from `app/schemas/__init__.py` for type generation to work. The `make generate-types` command runs `python -c 'from app.main import app; print(json.dumps(app.openapi()))'` which traverses all registered routes and their response models.

### Model Registration

New models must be imported in `app/models/__init__.py` and added to `__all__` so Alembic's `env.py` can see them via `Base.metadata`.

## Sources

### Primary (HIGH confidence)
- Existing codebase files (read directly):
  - `backend/app/models/agent_execution.py` -- Model pattern reference
  - `backend/app/schemas/agent.py` -- Schema pattern reference (Citation, DomainEntity, Finding, all domain outputs)
  - `backend/app/services/pipeline.py` -- Pipeline wiring pattern and insertion points
  - `backend/app/services/agent_events.py` -- SSE event emitter pattern
  - `backend/app/agents/domain_agent_runner.py` -- Domain agent execution pattern
  - `backend/app/agents/domain_runner.py` -- Parallel execution and result aggregation
  - `backend/app/agents/parsing.py` -- Output parsing pattern
  - `backend/app/api/agents.py` -- API endpoint pattern
  - `backend/app/api/files.py` -- Router pattern with auth
  - `backend/app/api/sse.py` -- SSE endpoint pattern
  - `backend/app/models/base.py` -- Base class
  - `backend/app/database.py` -- Session factory pattern
  - `backend/app/main.py` -- Router registration
  - `backend/alembic/env.py` -- Migration environment
  - `backend/alembic/versions/0562cc9e65bd_add_agent_executions_table.py` -- Migration pattern
  - `backend/pyproject.toml` -- Dependencies and tooling
  - `Makefile` -- Build commands
  - `.planning/ROADMAP.md` -- Phase 7 deliverables specification
  - `.planning/phases/07-knowledge-storage--and--domain-agent-enrichment/07-CONTEXT.md` -- User decisions

### Secondary (MEDIUM confidence)
- [Vertex AI text embeddings docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings) -- gemini-embedding-001 as replacement for deprecated text-embedding-004
- [SQLAlchemy 2.0 PostgreSQL dialect docs](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html) -- TSVECTOR type support
- [RapidFuzz GitHub](https://github.com/rapidfuzz/RapidFuzz) -- MIT-licensed fuzzy matching library
- [PostgreSQL FTS docs](https://www.postgresql.org/docs/current/textsearch-tables.html) -- tsvector generated columns and GIN indexes
- [Alembic tsvector issue #1390](https://github.com/sqlalchemy/alembic/issues/1390) -- Known issue with generated column detection

### Tertiary (LOW confidence)
- Web search results for best practices -- verified against official docs where possible

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use or well-documented replacements
- Architecture: HIGH -- patterns derived directly from existing codebase (not hypothetical)
- Pitfalls: HIGH -- identified from real code analysis (import chains, migration patterns, session scopes)
- Domain agent enrichment: HIGH -- current schemas read directly, changes are additive/backward-compatible
- Search implementation: MEDIUM -- tsvector is straightforward but the tsvector+Alembic interaction needs manual SQL
- Embedding model: HIGH -- text-embedding-004 deprecation verified via multiple sources

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (stable codebase patterns, 30 days)
