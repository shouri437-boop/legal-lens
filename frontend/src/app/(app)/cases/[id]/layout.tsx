"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clsx } from "clsx";

import { api, ApiError } from "@/lib/api-client";
import { onCaseDataChanged } from "@/lib/case-events";
import type { Case, CaseStatus, VerdictLabel } from "@/types/case";
import { Chatbot } from "@/components/app/chatbot";
import { AnalysisTrigger } from "@/components/app/analysis-trigger";

const PROCESSING_POLL_INTERVAL_MS = 10_000;

const statusConfig: Record<
  CaseStatus,
  { label: string; className: string; style?: React.CSSProperties }
> = {
  DRAFT: {
    label: "Draft",
    className: "text-(--muted-foreground)",
    style: { backgroundColor: "var(--muted)" },
  },
  PROCESSING: {
    label: "Processing",
    className: "bg-amber-500/20 text-amber-500 dark:text-amber-400",
  },
  READY: {
    label: "Ready",
    className: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  },
  ERROR: {
    label: "Error",
    className: "bg-red-500/20 text-red-600 dark:text-red-400",
  },
};

/** Verdict badge colors keyed by evidence strength label. */
const verdictConfig: Record<VerdictLabel, { className: string }> = {
  Conclusive: {
    className: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  },
  Substantial: {
    className: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  },
  Inconclusive: {
    className: "bg-stone-500/20 text-stone-500 dark:text-stone-400",
  },
};

export default function CaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCase = useCallback(async () => {
    try {
      const data = await api.get<Case>(`/api/cases/${params.id}`);
      setCaseData(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        router.push("/cases");
      }
    }
  }, [params.id, router]);

  // Initial fetch
  useEffect(() => {
    async function load() {
      await fetchCase();
      setLoading(false);
    }
    load();
  }, [fetchCase]);

  // Poll while PROCESSING to pick up status changes
  useEffect(() => {
    if (caseData?.status === "PROCESSING") {
      pollRef.current = setInterval(fetchCase, PROCESSING_POLL_INTERVAL_MS);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [caseData?.status, fetchCase]);

  // Refetch when child pages modify case data (e.g. file uploads/deletions)
  useEffect(() => {
    return onCaseDataChanged(fetchCase);
  }, [fetchCase]);

  const handleAnalysisStarted = useCallback(() => {
    fetchCase();
  }, [fetchCase]);

  if (loading) {
    return (
      <div className="px-6 pt-4 pb-6 lg:px-8">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="h-7 w-64 rounded animate-pulse"
            style={{ backgroundColor: "var(--muted)" }}
          />
        </div>
        <div
          className="h-5 w-80 rounded animate-pulse mb-4"
          style={{ backgroundColor: "var(--muted)" }}
        />
        <div
          className="h-48 rounded-xl animate-pulse"
          style={{ backgroundColor: "var(--muted)" }}
        />
      </div>
    );
  }

  if (!caseData) {
    return null;
  }

  const status = statusConfig[caseData.status];
  const verdict = caseData.verdict_label
    ? verdictConfig[caseData.verdict_label]
    : null;

  // Show verdict badge when synthesis is complete, "Pending Analysis" when
  // case has been processed (READY) but no verdict yet, otherwise status badge
  const hasAnalysisRun = caseData.latest_workflow_id !== null;
  const showVerdictBadge = verdict !== null && verdict !== undefined;
  const showPendingAnalysis =
    !showVerdictBadge && hasAnalysisRun && caseData.status === "READY";

  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: "var(--background)" }}
    >
      {/* Case header — fixed height, never shrinks */}
      <div className="shrink-0 px-6 pt-4 lg:px-8">
        {/* Case header: title, badge, and analysis trigger */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <h1
              className="text-xl font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {caseData.name}
            </h1>

            {showVerdictBadge && verdict ? (
              <span
                className={clsx(
                  "px-2.5 py-1 rounded-full text-xs font-medium",
                  verdict.className,
                )}
              >
                {caseData.verdict_label}
              </span>
            ) : showPendingAnalysis ? (
              <span
                className="px-2.5 py-1 rounded-full text-xs font-medium text-(--muted-foreground)"
                style={{ backgroundColor: "var(--muted)" }}
              >
                Pending Analysis
              </span>
            ) : (
              <span
                className={clsx(
                  "px-2.5 py-1 rounded-full text-xs font-medium",
                  status.className,
                )}
                style={status.style}
              >
                {status.label}
              </span>
            )}
          </div>

          <AnalysisTrigger
            caseId={caseData.id}
            caseStatus={caseData.status}
            fileCount={caseData.file_count}
            hasAnalysis={hasAnalysisRun}
            onAnalysisStarted={handleAnalysisStarted}
          />
        </div>

        {/* Case description */}
        {caseData.description && (
          <p
            className="max-w-2xl text-sm mb-4"
            style={{ color: "var(--muted-foreground)" }}
          >
            {caseData.description}
          </p>
        )}
      </div>

      {/* Page content — fills remaining height, scrolls internally */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 lg:px-8">
        {children}
      </div>

      {/* Chatbot - Available on all case pages */}
      <Chatbot
        caseId={params.id as string}
        caseContext={{
          name: caseData.name,
          description: caseData.description || undefined,
          status: caseData.status,
        }}
        analysisAvailable={hasAnalysisRun && caseData.status !== "PROCESSING"}
      />
    </div>
  );
}
