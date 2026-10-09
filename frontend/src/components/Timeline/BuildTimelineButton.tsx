"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ListTree } from "lucide-react";
import {
  fetchGeospatialStatus,
  generateGeospatialIntelligence,
} from "@/lib/api/geospatial";
import { invalidateTimelineCache } from "@/lib/cache/timelineCache";

const POLL_MS = 3000;
const MAX_WAIT_MS = 15 * 60 * 1000;

interface BuildTimelineButtonProps {
  caseId: string;
  className?: string;
}

/**
 * Builds the detailed case timeline AND the map locations from the case
 * documents (one backend job), then refreshes the timeline.
 */
export function BuildTimelineButton({
  caseId,
  className,
}: BuildTimelineButtonProps) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const build = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await generateGeospatialIntelligence(caseId, true);
      const started = Date.now();
      // The job reports "generating" until the timeline and map are saved.
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const status = await fetchGeospatialStatus(caseId);
        if (status.status === "complete") break;
        if (status.status === "failed") {
          throw new Error(status.error || "Building the timeline failed.");
        }
        if (status.status === "not_started") {
          throw new Error("Building the timeline failed. See the backend log.");
        }
        if (Date.now() - started > MAX_WAIT_MS) {
          throw new Error("Building the timeline took too long.");
        }
      }
      invalidateTimelineCache(caseId);
      await queryClient.invalidateQueries({ queryKey: ["timeline", caseId] });
      await queryClient.invalidateQueries({ queryKey: ["geospatial", caseId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [caseId, queryClient]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={build}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ListTree className="h-3.5 w-3.5" />
        )}
        {busy
          ? "Reading documents and building the timeline..."
          : "Build timeline from documents"}
      </button>
      {busy && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Long documents take a few minutes. You can leave this page; the
          timeline and map are saved when it finishes.
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
