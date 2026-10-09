// ABOUTME: TypeScript types for synthesis API responses, matching backend
// ABOUTME: Pydantic schemas in backend/app/schemas/synthesis.py (Category B).

// ---------------------------------------------------------------------------
// Sub-types used within responses
// ---------------------------------------------------------------------------

/** Evidence item within a hypothesis, merged from supporting/contradicting columns. */
export interface SynthesisEvidenceItem {
  finding_id: string;
  role: "supporting" | "contradicting" | "neutral";
  excerpt: string;
}

/** Ranked key finding from case_synthesis JSONB. */
export interface KeyFindingResponse {
  title: string;
  description: string;
  importance_rank: number;
  source_finding_ids: string[];
}

/** Case verdict parsed from case_synthesis JSONB. */
export interface VerdictResponse {
  verdict: string;
  evidence_strength: "Conclusive" | "Substantial" | "Inconclusive";
  key_strengths: string[];
  key_weaknesses: string[];
}

// ---------------------------------------------------------------------------
// Primary API response types (mirror backend Category B schemas)
// ---------------------------------------------------------------------------

/** API response for a case hypothesis. */
export interface HypothesisResponse {
  id: string;
  case_id: string;
  workflow_id: string;
  claim: string;
  status: "PENDING" | "SUPPORTED" | "REFUTED";
  /** Confidence score 0-100 (percentage). */
  confidence: number;
  evidence: SynthesisEvidenceItem[];
  source_agent: string | null;
  reasoning: string | null;
  created_at: string;
}

/** API response for a case contradiction. */
export interface ContradictionResponse {
  id: string;
  case_id: string;
  workflow_id: string;
  claim_a: string;
  claim_b: string;
  /** Source reference for claim_a (finding_id + excerpt). */
  source_a: Record<string, unknown> | null;
  /** Source reference for claim_b (finding_id + excerpt). */
  source_b: Record<string, unknown> | null;
  severity: "minor" | "significant" | "critical";
  domain: string | null;
  resolution_status: string;
  created_at: string;
}

/** Resolved KG entity referenced by a gap. */
export interface RelatedEntity {
  id: string;
  name: string;
  entity_type: string;
}

/** API response for an evidence gap. */
export interface GapResponse {
  id: string;
  case_id: string;
  workflow_id: string;
  description: string;
  what_is_missing: string;
  why_needed: string | null;
  priority: "low" | "medium" | "high" | "critical";
  related_entities: RelatedEntity[];
  suggested_actions: string | null;
  created_at: string;
}

/** API response for an investigation task. */
export interface TaskResponse {
  id: string;
  case_id: string;
  workflow_id: string;
  title: string;
  description: string;
  task_type: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "in_progress" | "completed" | "dismissed";
  source_hypothesis_id: string | null;
  source_contradiction_id: string | null;
  source_gap_id: string | null;
  created_at: string;
}

/** API response for the overall case synthesis record. */
export interface SynthesisResponse {
  id: string;
  case_id: string;
  workflow_id: string;
  case_summary: string | null;
  case_verdict: VerdictResponse | null;
  cross_modal_links: Record<string, unknown>[] | null;
  cross_domain_conclusions: string[] | null;
  key_findings_summary: string | null;
  risk_assessment: string | null;
  timeline_event_count: number;
  created_at: string;
}

/** API response for a timeline event. */
export interface TimelineEventResponse {
  id: string;
  case_id: string;
  workflow_id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  event_end_date: string | null;
  event_type: string | null;
  layer: string | null;
  source_entity_ids: string[] | null;
  citations: Record<string, unknown>[] | null;
  created_at: string;
}

/** API response wrapping timeline events with aggregation metadata. */
export interface TimelineApiResponse {
  events: TimelineEventResponse[];
  totalCount: number;
  dateRange: { earliest: string; latest: string };
  layerCounts: Record<string, number>;
}
