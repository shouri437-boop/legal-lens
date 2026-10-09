// ABOUTME: Hook that resolves finding IDs to enriched display data (title, file name, excerpt).
// ABOUTME: Analogous to useEntityResolver but for case findings. Caches via React Query.

"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listFindings } from "@/lib/api/findings";
import { listFiles, type FileResponse } from "@/lib/api/files";
import { normalizeFindingId } from "@/lib/citation-utils";
import type { FindingResponse } from "@/types/findings";

// ---------------------------------------------------------------------------
// Resolved finding type (for display)
// ---------------------------------------------------------------------------

/** Enriched finding data for display in citation lists and source links. */
export interface ResolvedFinding {
  id: string;
  /** Finding title from the backend (e.g., "Suspicious wire transfer pattern"). */
  title: string;
  /** Finding category (e.g., "suspicious_transaction", "contract_clause"). */
  category: string;
  /** Source agent type (e.g., "legal", "evidence"). */
  agentType: string;
  /** Agent-assessed confidence (0-100). */
  confidence: number;
  /** Original filename of the first cited source file (null if unresolved). */
  fileName: string | null;
  /** File ID of the first citation (null if no citations). */
  fileId: string | null;
  /** Locator string of the first citation (e.g., "page:3"). */
  locator: string | null;
  /** Excerpt text from the first citation. */
  excerpt: string | null;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

interface UseFindingResolverReturn {
  /** Resolve a single finding ID to enriched display data. Returns a placeholder if not yet loaded. */
  getFinding: (findingId: string) => ResolvedFinding;
  /** Resolve multiple finding IDs at once. */
  resolveFindings: (ids: string[]) => ResolvedFinding[];
  /** Whether findings or files are still loading. */
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * Resolves finding UUIDs to enriched display data including file names and excerpts.
 *
 * Uses two React Query caches:
 * - "case-findings-list" for all case findings (shared across components)
 * - "case-files" for all case files (shared with useSourceNavigation)
 *
 * Components use `getFinding(id)` to get display-ready data for any finding UUID.
 */
export function useFindingResolver(caseId: string): UseFindingResolverReturn {
  // Fetch all findings for the case (max 200 per page; sufficient for most cases)
  const { data: findingsData, isLoading: findingsLoading } = useQuery({
    queryKey: ["case-findings-list", caseId],
    queryFn: () => listFindings(caseId, 200, 0),
    staleTime: 5 * 60 * 1000,
    enabled: !!caseId,
  });

  // Fetch all files (reuses existing cache from useSourceNavigation)
  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["case-files", caseId],
    queryFn: () => listFiles(caseId, 1, 100),
    staleTime: 5 * 60 * 1000,
    enabled: !!caseId,
  });

  // Build finding lookup map
  const findingMap = useMemo(() => {
    const map = new Map<string, FindingResponse>();
    if (findingsData?.findings) {
      for (const f of findingsData.findings) {
        map.set(f.id, f);
      }
    }
    return map;
  }, [findingsData]);

  // Build file lookup map
  const fileMap = useMemo(() => {
    const map = new Map<string, FileResponse>();
    if (filesData?.files) {
      for (const f of filesData.files) {
        map.set(f.id, f);
      }
    }
    return map;
  }, [filesData]);

  // Resolve a single finding ID to enriched display data
  const getFinding = useMemo(() => {
    return (rawFindingId: string): ResolvedFinding => {
      const findingId = normalizeFindingId(rawFindingId);
      const finding = findingMap.get(findingId);
      if (!finding) {
        // Return a placeholder with the truncated ID as title while loading
        return {
          id: findingId,
          title: findingId.slice(0, 8),
          category: "",
          agentType: "",
          confidence: 0,
          fileName: null,
          fileId: null,
          locator: null,
          excerpt: null,
        };
      }

      const firstCitation = finding.citations?.[0] ?? null;
      const file = firstCitation ? fileMap.get(firstCitation.file_id) : null;

      return {
        id: finding.id,
        title: finding.title,
        category: finding.category,
        agentType: finding.agent_type,
        confidence: finding.confidence,
        fileName: file?.original_filename ?? null,
        fileId: firstCitation?.file_id ?? null,
        locator: firstCitation?.locator ?? null,
        excerpt: firstCitation?.excerpt ?? null,
      };
    };
  }, [findingMap, fileMap]);

  // Resolve multiple finding IDs
  const resolveFindings = useMemo(() => {
    return (ids: string[]): ResolvedFinding[] => {
      return ids.map((id) => getFinding(id));
    };
  }, [getFinding]);

  return {
    getFinding,
    resolveFindings,
    isLoading: findingsLoading || filesLoading,
  };
}
