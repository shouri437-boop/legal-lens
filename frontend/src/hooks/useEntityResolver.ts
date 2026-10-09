// ABOUTME: Hook that resolves entity UUIDs to human-readable names, types, and colors.
// ABOUTME: Uses cached KG graph data to build a lookup map for entity resolution across all views.

"use client";

import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGraph } from "@/lib/api/graph";
import { getEntityColor } from "@/lib/knowledge-graph-config";

// ---------------------------------------------------------------------------
// Resolved entity type
// ---------------------------------------------------------------------------

/** A resolved entity with human-readable name, type, and color. */
export interface ResolvedEntity {
  id: string;
  name: string;
  entity_type: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

interface UseEntityResolverReturn {
  /** Resolve multiple entity IDs to ResolvedEntity objects. Unknown IDs get fallback entries. */
  resolveEntities: (ids: string[]) => ResolvedEntity[];
  /** Resolve a single entity ID. Returns null if not found. */
  getEntity: (id: string) => ResolvedEntity | null;
  /** Whether the entity data is still loading. */
  isLoading: boolean;
  /** Full entity lookup map (for advanced consumers). */
  entityMap: Map<string, ResolvedEntity>;
}

// ---------------------------------------------------------------------------
// Fallback for unresolved entities
// ---------------------------------------------------------------------------

function createFallbackEntity(id: string): ResolvedEntity {
  return {
    id,
    name: "Unknown Entity",
    entity_type: "other",
    color: getEntityColor("other"),
  };
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * Resolves entity UUIDs to human-readable names, types, and colors using
 * the cached KG graph data.
 *
 * All entities for a case are fetched once and cached for 5 minutes via
 * React Query. The lookup map is built in a useMemo from the graph response.
 */
export function useEntityResolver(caseId: string): UseEntityResolverReturn {
  const { data: graphData, isLoading } = useQuery({
    queryKey: ["case-graph", caseId],
    queryFn: () => fetchGraph(caseId),
    staleTime: 5 * 60 * 1000,
    enabled: !!caseId,
  });

  // Build entity lookup map from graph data
  const entityMap = useMemo(() => {
    const map = new Map<string, ResolvedEntity>();
    if (graphData?.entities) {
      for (const entity of graphData.entities) {
        map.set(entity.id, {
          id: entity.id,
          name: entity.name,
          entity_type: entity.entity_type,
          color: getEntityColor(entity.entity_type),
        });
      }
    }
    return map;
  }, [graphData]);

  const getEntity = useCallback(
    (id: string): ResolvedEntity | null => {
      return entityMap.get(id) ?? null;
    },
    [entityMap],
  );

  const resolveEntities = useCallback(
    (ids: string[]): ResolvedEntity[] => {
      return ids.map((id) => entityMap.get(id) ?? createFallbackEntity(id));
    },
    [entityMap],
  );

  return {
    resolveEntities,
    getEntity,
    isLoading,
    entityMap,
  };
}
