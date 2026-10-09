// ABOUTME: Shared utility to partition source IDs into file-backed and excerpt-only groups.
// ABOUTME: Used by EventDetailModal, KnowledgeGraphEntityPanel, and other citation displays.

import type { ResolvedFinding } from "@/hooks/useFindingResolver";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PartitionedSource {
  sourceId: string;
  resolved: ResolvedFinding;
}

// ---------------------------------------------------------------------------
// Partition function
// ---------------------------------------------------------------------------

/**
 * Partitions an array of source IDs into file-backed (openable in source viewer)
 * and excerpt-only (display as text). A source is considered file-backed only if
 * both fileId AND fileName are resolved — meaning the file actually exists in the
 * case files list and can be opened in the source viewer.
 */
export function partitionSources(
  sourceIds: string[],
  getFinding: (id: string) => ResolvedFinding,
): { fileSources: PartitionedSource[]; excerptSources: PartitionedSource[] } {
  const fileSources: PartitionedSource[] = [];
  const excerptSources: PartitionedSource[] = [];

  for (const sourceId of sourceIds) {
    const resolved = getFinding(sourceId);
    if (resolved.fileId && resolved.fileName) {
      fileSources.push({ sourceId, resolved });
    } else {
      excerptSources.push({ sourceId, resolved });
    }
  }

  return { fileSources, excerptSources };
}
