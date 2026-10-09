// ABOUTME: API client for the fast document RAG endpoints (cited analysis and grounded Q&A).

import { api, ApiError } from "@/lib/api-client";

export interface RagCitation {
  file_id: string;
  file_name: string;
  page: number;
  quote: string;
}

export interface RagFact {
  text: string;
  citations: RagCitation[];
}

export interface RagAnalysis {
  summary: string;
  parties: { name: string; role: string }[];
  key_facts: RagFact[];
  timeline: { date: string; event: string; citations: RagCitation[] }[];
  legal_issues: { issue: string; analysis: string; citations: RagCitation[] }[];
  outcome: RagFact;
  contradictions: RagFact[];
  gaps: string[];
}

export interface RagMeta {
  model: string;
  pages_total: number;
  chunks_indexed: number;
  chunks_used: number;
  citations_total: number;
  citations_verified: number;
  latency_ms: { index: number; retrieve: number; llm: number; total: number };
}

export interface RagResult {
  analysis: RagAnalysis;
  meta: RagMeta;
}

export interface RagAnswer {
  answer: string;
  answerable: boolean;
  citations: RagCitation[];
  meta: { latency_ms: { total: number } };
}

/** Returns the cached analysis, or null if none has been generated yet. */
export async function getCachedAnalysis(
  caseId: string,
): Promise<RagResult | null> {
  try {
    return await api.get<RagResult>(`/api/cases/${caseId}/rag/analysis`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function runAnalysis(caseId: string, refresh = false) {
  return api.post<RagResult>(
    `/api/cases/${caseId}/rag/analyze${refresh ? "?refresh=true" : ""}`,
  );
}

export function askQuestion(caseId: string, question: string) {
  return api.post<RagAnswer>(`/api/cases/${caseId}/rag/ask`, { question });
}

/** Human-readable message from a failed RAG call. */
export function ragErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.data && typeof err.data === "object") {
    const d = err.data as Record<string, unknown>;
    if (typeof d.message === "string") return d.message;
    if (typeof d.detail === "string") return d.detail;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}
