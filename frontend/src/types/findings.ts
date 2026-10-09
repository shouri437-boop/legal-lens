// ABOUTME: TypeScript interfaces for case findings API responses.
// ABOUTME: Mirrors backend FindingResponse and FindingCitation Pydantic schemas.

// ---------------------------------------------------------------------------
// Finding Citation
// ---------------------------------------------------------------------------

/** A citation linking a finding to a specific location within a source file. */
export interface FindingCitationResponse {
  file_id: string;
  locator: string;
  excerpt: string | null;
}

// ---------------------------------------------------------------------------
// Finding
// ---------------------------------------------------------------------------

/** Full finding response from GET /api/cases/{case_id}/findings/{finding_id}. */
export interface FindingResponse {
  id: string;
  case_id: string;
  workflow_id: string;
  agent_type: string;
  agent_execution_id: string | null;
  file_group_label: string | null;
  category: string;
  title: string;
  finding_text: string;
  confidence: number;
  citations: FindingCitationResponse[] | null;
  entity_ids: string[] | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// List Response
// ---------------------------------------------------------------------------

/** Paginated list response from GET /api/cases/{case_id}/findings. */
export interface FindingListResponse {
  findings: FindingResponse[];
  total: number;
}
