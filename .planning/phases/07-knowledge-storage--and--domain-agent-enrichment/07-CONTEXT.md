# Phase 7: Knowledge Storage & Domain Agent Enrichment - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the knowledge storage foundation and enrich domain agent outputs with exhaustive exact-source citations for downstream consumption by KG Builder, Synthesis, and Chat. This phase establishes:
- Database schema (9 new tables for KG, findings, synthesis outputs)
- Programmatic KG Builder service (entity extraction, relationship building, deduplication)
- Domain agent prompt enrichment (exhaustive citations)
- API endpoints for KG and findings
- Hybrid search infrastructure (PG full-text + Vertex AI vector search)

</domain>

<decisions>
## Implementation Decisions

### Citation richness & format
- **Excerpt format**: Exact excerpt only, preserved in original format for TypeScript/JS PDF search tools to quickly find exact matches in PDFs
- **Temporal precision**: Second-level timestamps (MM:SS) for video/audio citations
- **Confidence scope**: Finding-level confidence only (not per-citation). Each citation does not have its own confidence score.
- **Multi-page/segment handling**: Split into multiple citations, one per page or time segment. Granular traceability preferred over compact ranges.

### Entity deduplication strategy
- **Exact-match criteria**: Name normalization (trim, lowercase, remove punctuation) + type + domain match required
- **Fuzzy matching threshold**: Moderate (85%+ Levenshtein similarity)
- **Fuzzy match resolution**: Flag for LLM resolution (Synthesis Agent in Phase 8 reviews and decides)
- **Metadata influence**: Use metadata as tie-breaker for borderline matches (85-90% similarity)
- **Merge provenance**: Keep primary source + count of other sources ("3 other sources"). Leaner storage than preserving all links.
- **Reversibility**: Yes, soft delete with `merged_into_id` field. User can unmerge later via UI (Phase 11 Corrections).
- **Cross-domain merging**: Treat same as same-domain merges. Domain doesn't affect merge logic (allows detecting same entity across domains).
- **Degree computation**: Background job after pipeline completes. Async calculation doesn't block domain agent completion.

### KG relationship inference
- **Relationship qualification**: Proximity + semantic relevance. Co-mention in same finding plus agent indicates they're related (not just coincidence).
- **Relationship strength**: 0-100 strength score for each relationship (used for graph layout and filtering)
- **Strength calculation**: Hybrid approach combining frequency of co-occurrence + agent-provided confidence
- **Directionality**: Type-dependent. Some relationship types are directional (employed_by), others symmetric (co-defendant). LLM has full flexibility to decide per relationship.

### Vector vs full-text search
- **Search implementation**: Both PG keyword (tsvector) + Vertex AI vector search. Chat Agent tries keyword first, falls back to semantic search.
- **Index coverage**: Full indexing — findings + entities + citations. Maximum search coverage.
- **Embedding model**: text-embedding-004 (Vertex AI). 768 dimensions, multilingual, task-adaptive.
- **Result re-ranking**: LLM re-ranking using Gemini. Re-rank top 20 results based on query intent for highest quality.

### Claude's Discretion
- Citation schema field names and JSONB structure
- Database index strategy beyond full-text (GIN, BTREE, partial indexes)
- SSE event payload design for findings/KG updates
- KG API pagination strategy
- Entity deduplication algorithm details (Levenshtein vs other distance metrics)
- Background job scheduling mechanism for degree computation
- Relationship type taxonomy (comprehensive list of types like EMPLOYED_BY, CO_DEFENDANT, TRANSACTED_WITH, etc.)
- Search query optimization and caching strategy

</decisions>

<specifics>
## Specific Ideas

- **PDF search integration**: Citation excerpts must be stored character-for-character exactly as they appear in PDFs, preserving whitespace and line breaks, so frontend PDF.js-based search can use the exact string to highlight the location.
- **Deduplication audit trail**: Every merge decision (exact or fuzzy) should be logged with: timestamp, confidence score, algorithm used (exact/fuzzy), merged entity IDs, and preserved source counts.
- **Search quality hierarchy**: For Chat Agent (Phase 9), keyword search should be tried first (fastest), then vector search (semantic), then LLM re-ranking (highest quality). Implement as tiered fallback strategy.
- **Entity degree as KG metric**: Connection count (degree) will drive node sizing in vis-network graph (Phase 7.1). Background computation should update a `degree` column on kg_entities for fast queries.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-knowledge-storage-and-domain-agent-enrichment*
*Context gathered: 2026-02-07*
