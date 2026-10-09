// ABOUTME: TypeScript types for the Knowledge Graph frontend, matching backend
// ABOUTME: GraphResponse/EntityResponse/RelationshipResponse schemas exactly.

import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";

// ---------------------------------------------------------------------------
// API response types (mirror backend/app/schemas/knowledge_graph.py)
// ---------------------------------------------------------------------------

/** Single entity in the knowledge graph. Field names match the backend JSON. */
export interface EntityResponse {
  id: string;
  case_id: string;
  name: string;
  name_normalized: string;
  entity_type: string;
  domain: string;
  confidence: number;
  properties: Record<string, unknown> | null;
  context: string | null;
  aliases: string[] | null;
  description_brief: string | null;
  description_detailed: string | null;
  domains: string[] | null;
  source_finding_ids: string[] | null;
  source_execution_id: string | null;
  source_finding_index: number | null;
  merged_into_id: string | null;
  merge_count: number;
  degree: number;
  created_at: string;
}

/** Single relationship (edge) in the knowledge graph. */
export interface RelationshipResponse {
  id: string;
  case_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  label: string;
  /** Edge weight 0-100 integer (NOT 0-1 float). */
  strength: number;
  source_execution_id: string | null;
  properties: Record<string, unknown> | null;
  evidence_excerpt: string | null;
  source_finding_ids: string[] | null;
  temporal_context: string | null;
  corroboration_count: number | null;
  confidence: number | null;
  created_at: string;
}

/** Full graph payload from GET /api/cases/:caseId/graph. */
export interface GraphResponse {
  entities: EntityResponse[];
  relationships: RelationshipResponse[];
  entity_count: number;
  relationship_count: number;
}

// ---------------------------------------------------------------------------
// D3 force-simulation types
// ---------------------------------------------------------------------------

/** Node in the D3 force simulation, wrapping an EntityResponse. */
export interface ForceNode extends SimulationNodeDatum {
  id: string;
  entity: EntityResponse;
  /** Pixel radius computed from entity degree via discrete size tiers. */
  radius: number;
  /** Hex color derived from entity_type via getEntityColor(). */
  color: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

/**
 * Deduplicated edge in the force simulation. Multiple backend relationships
 * between the same entity pair are collapsed into one visual edge.
 */
export interface ForceLink extends SimulationLinkDatum<ForceNode> {
  /** Canonical dedup key: sorted `${idA}|||${idB}`. */
  id: string;
  source: ForceNode | string;
  target: ForceNode | string;
  /** All backend relationships between this entity pair. */
  relationships: RelationshipResponse[];
  /** Number of relationships collapsed into this edge. */
  count: number;
}

// ---------------------------------------------------------------------------
// UI state types
// ---------------------------------------------------------------------------

/** Active filter state for the KG filter panel. */
export interface GraphFilters {
  activeDomains: Set<string>;
  activeEntityTypes: Set<string>;
  searchQuery: string;
  keywordFilter: string;
}

/** 2D coordinate used for zoom/pan state. */
export interface Position {
  x: number;
  y: number;
}

/** D3 zoom transform state (translate + scale). */
export interface Transform {
  x: number;
  y: number;
  /** Zoom scale factor. */
  k: number;
}
