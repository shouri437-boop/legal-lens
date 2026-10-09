// ABOUTME: Hook that resolves citations into SourceViewerContent for the source viewer modal.
// ABOUTME: Handles file lookup, signed URL retrieval, locator parsing, and two-hop finding resolution.

"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Citation } from "@/lib/citation-utils";
import {
  parseLocator,
  categoryToViewerType,
  normalizeFindingId,
} from "@/lib/citation-utils";
import { listFiles, getDownloadUrl, type FileResponse } from "@/lib/api/files";
import { useFileUrlCache } from "@/hooks/useFileUrlCache";
import type { SourceViewerContent } from "@/components/source-viewer/SourceViewerModal";
import { api } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Finding detail response (minimal shape for two-hop resolution)
// ---------------------------------------------------------------------------

interface FindingDetailCitation {
  file_id: string;
  locator: string;
  excerpt: string;
}

interface FindingDetailResponse {
  id: string;
  citations: FindingDetailCitation[] | null;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

interface UseSourceNavigationReturn {
  /** Open the source viewer for a direct file citation. */
  openSource: (citation: Citation) => Promise<void>;
  /** Open the source viewer by resolving a finding ID to its first citation. */
  openFromFinding: (findingId: string) => Promise<void>;
  /** Current content to render in the SourceViewerModal (null when closed). */
  sourceContent: SourceViewerContent | null;
  /** Whether a citation is currently being resolved. */
  isLoading: boolean;
  /** Error message if resolution failed. */
  error: string | null;
  /** Close the source viewer and reset state. */
  closeSource: () => void;
}

// ---------------------------------------------------------------------------
// Maximum excerpt length for PDF highlight text
// ---------------------------------------------------------------------------

const MAX_HIGHLIGHT_LENGTH = 300;

// ---------------------------------------------------------------------------
// Excerpt normalization for PDF highlighting
// ---------------------------------------------------------------------------

/**
 * Normalizes excerpt text for better PDF highlight matching by converting
 * typographic characters to their ASCII equivalents and collapsing whitespace.
 */
function normalizeExcerptForHighlight(text: string): string {
  return (
    text
      // Smart quotes → straight quotes
      .replace(/[\u2018\u2019\u201A]/g, "'")
      .replace(/[\u201C\u201D\u201E]/g, '"')
      // Em-dash / en-dash → hyphen
      .replace(/[\u2013\u2014]/g, "-")
      // Ellipsis character → three dots
      .replace(/\u2026/g, "...")
      // Collapse whitespace runs (including line breaks) into a single space
      .replace(/\s+/g, " ")
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * Resolves citations into SourceViewerContent objects for the SourceViewerModal.
 *
 * Handles:
 * - Direct file citations (file_id + locator + excerpt)
 * - Two-hop finding citations (finding_id -> CaseFinding.citations -> file)
 * - Signed URL retrieval with caching via useFileUrlCache
 * - Race condition prevention via request counter
 * - Error feedback via sonner toasts (automatic for all consumers)
 */
export function useSourceNavigation(caseId: string): UseSourceNavigationReturn {
  const [sourceContent, setSourceContent] =
    useState<SourceViewerContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Race condition prevention: only apply result if still the most recent request
  const requestCounterRef = useRef(0);

  // Fetch and cache all case files (stale for 5 minutes)
  const { data: filesData } = useQuery({
    queryKey: ["case-files", caseId],
    queryFn: () => listFiles(caseId, 1, 100),
    staleTime: 5 * 60 * 1000,
    enabled: !!caseId,
  });

  const { getCachedUrl, setCachedUrl } = useFileUrlCache();

  // Build file lookup map for efficient access (derived from fetched data)
  const fileMap = useMemo(() => {
    const map = new Map<string, FileResponse>();
    if (filesData?.files) {
      for (const file of filesData.files) {
        map.set(file.id, file);
      }
    }
    return map;
  }, [filesData]);

  /** Sets both the error state and fires a sonner toast for user feedback. */
  const setErrorWithToast = useCallback((message: string) => {
    setError(message);
    toast.error(message);
  }, []);

  const openSource = useCallback(
    async (citation: Citation): Promise<void> => {
      const requestId = ++requestCounterRef.current;
      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Look up file in cached files list
        const file = fileMap.get(citation.file_id);
        if (!file) {
          if (requestId === requestCounterRef.current) {
            setErrorWithToast("Source file not available");
            setIsLoading(false);
          }
          return;
        }

        // Step 2: Get signed URL (check cache first)
        let url = getCachedUrl(caseId, citation.file_id);
        if (!url) {
          const downloadResponse = await getDownloadUrl(
            caseId,
            citation.file_id,
            true,
          );
          url = downloadResponse.download_url;
          setCachedUrl(
            caseId,
            citation.file_id,
            url,
            downloadResponse.expires_in,
          );
        }

        // Step 3: Parse locator
        const parsed = parseLocator(citation.locator);

        // Step 4: Map file category to viewer type
        const viewerType = categoryToViewerType(file.category);

        // Step 5: Build SourceViewerContent
        const content: SourceViewerContent = {
          type: viewerType,
          url,
          fileName: file.original_filename,
          ...(parsed.type === "page" && parsed.page != null
            ? { page: parsed.page }
            : {}),
          ...(parsed.type === "timestamp" && parsed.timestamp != null
            ? { timestamp: parsed.timestamp }
            : {}),
          ...(viewerType === "pdf" && citation.excerpt
            ? {
                highlightText: normalizeExcerptForHighlight(
                  citation.excerpt.length > MAX_HIGHLIGHT_LENGTH
                    ? citation.excerpt.slice(0, MAX_HIGHLIGHT_LENGTH)
                    : citation.excerpt,
                ),
              }
            : {}),
        };

        // Step 6: Only apply if still the most recent request
        if (requestId === requestCounterRef.current) {
          setSourceContent(content);
          setIsLoading(false);
        }
      } catch (err) {
        if (requestId === requestCounterRef.current) {
          setErrorWithToast(
            err instanceof Error ? err.message : "Failed to load source file",
          );
          setIsLoading(false);
        }
      }
    },
    [caseId, fileMap, getCachedUrl, setCachedUrl, setErrorWithToast],
  );

  const openFromFinding = useCallback(
    async (rawFindingId: string): Promise<void> => {
      const findingId = normalizeFindingId(rawFindingId);
      const requestId = ++requestCounterRef.current;
      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Fetch finding detail to get its citations
        const finding = await api.get<FindingDetailResponse>(
          `/api/cases/${caseId}/findings/${findingId}`,
        );

        // Check if still the most recent request
        if (requestId !== requestCounterRef.current) return;

        // Step 2: Use the first citation if available
        if (finding.citations && finding.citations.length > 0) {
          const firstCitation = finding.citations[0];
          await openSource({
            file_id: firstCitation.file_id,
            locator: firstCitation.locator,
            excerpt: firstCitation.excerpt,
          });
        } else {
          if (requestId === requestCounterRef.current) {
            setErrorWithToast("No source citations available for this finding");
            setIsLoading(false);
          }
        }
      } catch (err) {
        if (requestId === requestCounterRef.current) {
          setErrorWithToast(
            err instanceof Error
              ? err.message
              : "Failed to resolve finding citation",
          );
          setIsLoading(false);
        }
      }
    },
    [caseId, openSource, setErrorWithToast],
  );

  const closeSource = useCallback(() => {
    setSourceContent(null);
    setError(null);
  }, []);

  return {
    openSource,
    openFromFinding,
    sourceContent,
    isLoading,
    error,
    closeSource,
  };
}
