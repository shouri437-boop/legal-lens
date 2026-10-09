// ABOUTME: React hook that fetches the real knowledge graph for a case via API.
// ABOUTME: Returns raw GraphResponse with loading/error states and refetch.

import { useState, useEffect, useCallback } from "react";
import { fetchGraph } from "@/lib/api/graph";
import type { GraphResponse } from "@/types/knowledge-graph";

interface UseCaseGraphReturn {
  data: GraphResponse | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch and manage knowledge graph data for a case.
 *
 * Returns the raw GraphResponse from the API without transformation.
 * Conversion to ForceNode/ForceLink happens in the simulation hook (Plan 03).
 */
export function useCaseGraph(caseId: string): UseCaseGraphReturn {
  const [data, setData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchGraph(caseId);
      setData(response);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch graph data"),
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  return {
    data,
    loading,
    error,
    refetch: loadGraph,
  };
}
