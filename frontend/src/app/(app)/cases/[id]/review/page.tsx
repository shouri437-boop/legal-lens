// ABOUTME: Case Review page: analysis progress plus the findings (supporting evidence, contradictions, gaps).
// ABOUTME: Findings appear once the synthesis-data-ready SSE event fires or synthesis data already exists.

"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";

import { ConfirmationModal } from "@/components/CommandCenter/ConfirmationModal";
import { BatchConfirmationModal } from "@/components/CommandCenter/BatchConfirmationModal";
import { PipelineProgress } from "@/components/review/PipelineProgress";
import { VerdictView } from "@/components/verdict/VerdictView";
import { SourceViewerModal } from "@/components/source-viewer/SourceViewerModal";
import { useAgentStates } from "@/hooks/useAgentStates";
import { useSourceNavigation } from "@/hooks/useSourceNavigation";
import { useSynthesis } from "@/hooks/useSynthesisData";
import { useDetailSidebarDispatch } from "@/hooks";
import type { SidebarContentDescriptor } from "@/types/detail-sidebar";

const SYNTHESIS_QUERY_KEYS = [
  "synthesis",
  "hypotheses",
  "contradictions",
  "gaps",
  "tasks",
];

export default function ReviewPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const caseId = params.id as string;

  const {
    agentStates,
    pendingConfirmations,
    pendingBatchConfirmations,
    removePendingConfirmation,
    removePendingBatchConfirmation,
    synthesisReady: sseReady,
    isConnected,
  } = useAgentStates(caseId);

  const { openFromFinding, sourceContent, closeSource } =
    useSourceNavigation(caseId);
  const { data: synthesisData } = useSynthesis(caseId);
  const { setContent, clearContent, setCollapsed } = useDetailSidebarDispatch();

  const synthesisAvailable = useMemo(
    () => sseReady || synthesisData != null,
    [sseReady, synthesisData],
  );
  const hasActivity =
    !synthesisAvailable &&
    Array.from(agentStates.values()).some((s) => s.status !== "idle");

  useEffect(() => {
    if (!sseReady) return;
    for (const key of SYNTHESIS_QUERY_KEYS) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [sseReady, queryClient]);

  useEffect(() => () => clearContent(), [clearContent]);

  const handleOpenDetail = useCallback(
    (descriptor: SidebarContentDescriptor) => {
      setContent(descriptor);
      setCollapsed(false);
    },
    [setContent, setCollapsed],
  );

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <PipelineProgress agentStates={agentStates} isConnected={isConnected} />

      {synthesisAvailable ? (
        <VerdictView
          caseId={caseId}
          onOpenDetail={handleOpenDetail}
          onViewFinding={openFromFinding}
        />
      ) : (
        <div
          className="rounded-lg px-6 py-16 text-center text-sm"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--muted-foreground)",
          }}
        >
          {hasActivity
            ? "Legal Lens is reading the evidence. Findings will appear here when the review finishes."
            : "Upload evidence in the Evidence tab, then start the review."}
        </div>
      )}

      {pendingBatchConfirmations.length > 0 ? (
        <BatchConfirmationModal
          batch={pendingBatchConfirmations[0]}
          caseId={caseId}
          onResolved={removePendingBatchConfirmation}
        />
      ) : pendingConfirmations.length > 0 ? (
        <ConfirmationModal
          confirmation={pendingConfirmations[0]}
          caseId={caseId}
          onResolved={removePendingConfirmation}
        />
      ) : null}

      {sourceContent &&
        createPortal(
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(30,33,35,0.6)" }}
          >
            <div className="w-full max-w-5xl h-[85vh]">
              <SourceViewerModal
                content={sourceContent}
                onClose={closeSource}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
