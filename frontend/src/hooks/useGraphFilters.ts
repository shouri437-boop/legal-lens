// ABOUTME: Manages filter state for the knowledge graph visualization.
// ABOUTME: Provides domain/entity-type toggles, keyword filtering, search highlighting (non-filtering), and computed counts.

"use client";

import { useState, useMemo, useCallback } from "react";
import type {
  EntityResponse,
  RelationshipResponse,
  GraphFilters,
} from "@/types/knowledge-graph";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

interface UseGraphFiltersProps {
  entities: EntityResponse[];
  relationships: RelationshipResponse[];
}

interface UseGraphFiltersReturn {
  filters: GraphFilters;
  setActiveDomains: (domains: Set<string>) => void;
  toggleDomain: (domain: string) => void;
  setActiveEntityTypes: (types: Set<string>) => void;
  toggleEntityType: (type: string) => void;
  setSearchQuery: (query: string) => void;
  setKeywordFilter: (keywords: string) => void;
  filteredEntities: EntityResponse[];
  filteredRelationships: RelationshipResponse[];
  /** Entity IDs matching the search query (for highlight, not filter). */
  searchMatchIds: Set<string>;
  /** Count per entity type across ALL entities (unfiltered). */
  entityTypeCounts: Map<string, number>;
  /** Count per domain across ALL entities (unfiltered). */
  domainCounts: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract every domain associated with an entity (primary + multi-domain list). */
function entityDomains(entity: EntityResponse): string[] {
  const result: string[] = [];
  if (entity.domain) result.push(entity.domain.toLowerCase());
  if (entity.domains) {
    for (const d of entity.domains) {
      const lower = d.toLowerCase();
      if (!result.includes(lower)) result.push(lower);
    }
  }
  return result;
}

/** Case-insensitive substring check. */
function containsIgnoreCase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGraphFilters({
  entities,
  relationships,
}: UseGraphFiltersProps): UseGraphFiltersReturn {
  // Derive full sets from data
  const allDomains = useMemo(() => {
    const set = new Set<string>();
    for (const e of entities) {
      for (const d of entityDomains(e)) set.add(d);
    }
    return set;
  }, [entities]);

  const allEntityTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of entities) set.add(e.entity_type.toLowerCase());
    return set;
  }, [entities]);

  // Track what the user has explicitly *disabled* (inverted model avoids
  // setState-in-effect lint violations when new domains/types appear in data).
  const [disabledDomains, setDisabledDomains] = useState<Set<string>>(
    () => new Set(),
  );
  const [disabledEntityTypes, setDisabledEntityTypes] = useState<Set<string>>(
    () => new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");

  // Derive active sets: all items minus disabled ones (pure render derivation)
  const activeDomains = useMemo(() => {
    const set = new Set<string>();
    for (const d of allDomains) {
      if (!disabledDomains.has(d)) set.add(d);
    }
    return set;
  }, [allDomains, disabledDomains]);

  const activeEntityTypes = useMemo(() => {
    const set = new Set<string>();
    for (const t of allEntityTypes) {
      if (!disabledEntityTypes.has(t)) set.add(t);
    }
    return set;
  }, [allEntityTypes, disabledEntityTypes]);

  // ---- Composed GraphFilters ----
  const filters: GraphFilters = useMemo(
    () => ({
      activeDomains,
      activeEntityTypes,
      searchQuery,
      keywordFilter,
    }),
    [activeDomains, activeEntityTypes, searchQuery, keywordFilter],
  );

  // ---- Toggle callbacks ----
  const toggleDomain = useCallback((domain: string) => {
    const key = domain.toLowerCase();
    setDisabledDomains((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleEntityType = useCallback((type: string) => {
    const key = type.toLowerCase();
    setDisabledEntityTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Bulk setters: translate "active" set to "disabled" set relative to all items
  const setActiveDomains = useCallback(
    (domains: Set<string>) => {
      setDisabledDomains(() => {
        const disabled = new Set<string>();
        for (const d of allDomains) {
          if (!domains.has(d)) disabled.add(d);
        }
        return disabled;
      });
    },
    [allDomains],
  );

  const setActiveEntityTypes = useCallback(
    (types: Set<string>) => {
      setDisabledEntityTypes(() => {
        const disabled = new Set<string>();
        for (const t of allEntityTypes) {
          if (!types.has(t)) disabled.add(t);
        }
        return disabled;
      });
    },
    [allEntityTypes],
  );

  // ---- Keyword tokens (memoized once) ----
  const keywordTokens = useMemo(() => {
    if (!keywordFilter.trim()) return [] as string[];
    return keywordFilter
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  }, [keywordFilter]);

  // ---- Filtered entities ----
  const filteredEntities = useMemo(() => {
    let result = entities;

    // Domain filter
    result = result.filter((e) => {
      const domains = entityDomains(e);
      return domains.some((d) => activeDomains.has(d));
    });

    // Entity type filter
    result = result.filter((e) =>
      activeEntityTypes.has(e.entity_type.toLowerCase()),
    );

    // Keyword filter (comma-separated fuzzy match)
    if (keywordTokens.length > 0) {
      // Find entity IDs that match keywords or are connected to matching relationships
      const matchingEntityIds = new Set<string>();

      // Direct entity name match
      for (const e of result) {
        for (const kw of keywordTokens) {
          if (containsIgnoreCase(e.name, kw)) {
            matchingEntityIds.add(e.id);
            break;
          }
        }
      }

      // Relationship label match -- add both connected entity IDs
      const resultIdSet = new Set(result.map((e) => e.id));
      for (const r of relationships) {
        for (const kw of keywordTokens) {
          if (containsIgnoreCase(r.label, kw)) {
            if (resultIdSet.has(r.source_entity_id))
              matchingEntityIds.add(r.source_entity_id);
            if (resultIdSet.has(r.target_entity_id))
              matchingEntityIds.add(r.target_entity_id);
            break;
          }
        }
      }

      result = result.filter((e) => matchingEntityIds.has(e.id));
    }

    return result;
  }, [
    entities,
    relationships,
    activeDomains,
    activeEntityTypes,
    keywordTokens,
  ]);

  // ---- Filtered relationships ----
  const filteredRelationships = useMemo(() => {
    const entityIdSet = new Set(filteredEntities.map((e) => e.id));
    return relationships.filter(
      (r) =>
        entityIdSet.has(r.source_entity_id) &&
        entityIdSet.has(r.target_entity_id),
    );
  }, [filteredEntities, relationships]);

  // ---- Search match IDs (highlight, not filter) ----
  const searchMatchIds = useMemo(() => {
    const ids = new Set<string>();
    if (!searchQuery.trim()) return ids;
    const query = searchQuery.toLowerCase();
    for (const e of entities) {
      if (containsIgnoreCase(e.name, query)) {
        ids.add(e.id);
        continue;
      }
      if (e.aliases) {
        for (const alias of e.aliases) {
          if (containsIgnoreCase(alias, query)) {
            ids.add(e.id);
            break;
          }
        }
        if (ids.has(e.id)) continue;
      }
      if (
        e.description_brief &&
        containsIgnoreCase(e.description_brief, query)
      ) {
        ids.add(e.id);
      }
    }
    return ids;
  }, [entities, searchQuery]);

  // ---- Counts (from FULL entity list, not filtered) ----
  const entityTypeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entities) {
      const key = e.entity_type.toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [entities]);

  const domainCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entities) {
      for (const d of entityDomains(e)) {
        map.set(d, (map.get(d) ?? 0) + 1);
      }
    }
    return map;
  }, [entities]);

  return {
    filters,
    setActiveDomains,
    toggleDomain,
    setActiveEntityTypes,
    toggleEntityType,
    setSearchQuery,
    setKeywordFilter,
    filteredEntities,
    filteredRelationships,
    searchMatchIds,
    entityTypeCounts,
    domainCounts,
  };
}
