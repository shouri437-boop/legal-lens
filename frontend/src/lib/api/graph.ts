// ABOUTME: API client for the Knowledge Graph graph endpoint.
// ABOUTME: Fetches the full entity/relationship graph for a case with auth.

import { getToken } from "@/lib/auth-client";
import type { GraphResponse } from "@/types/knowledge-graph";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getToken();
  // Authentication is disabled locally: send no header when there is no token.
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch the full knowledge graph for a case.
 * Returns entities, relationships, and counts from GET /api/cases/:caseId/graph.
 */
export async function fetchGraph(caseId: string): Promise<GraphResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/cases/${caseId}/graph`, { headers });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to fetch graph data" }));
    throw new Error(error.detail || "Failed to fetch graph data");
  }
  return res.json();
}
