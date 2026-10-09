// ABOUTME: Main scrollable Verdict view assembling all synthesis intelligence sections.
// ABOUTME: Fetches from 5 synthesis hooks and renders Summary, Key Findings, Hypotheses, Contradictions, Gaps, Tasks.

"use client";

import { useMemo, useCallback } from "react";
import { FileText } from "lucide-react";

import {
  useSynthesis,
  useHypotheses,
  useContradictions,
  useGaps,
  useTasks,
} from "@/hooks/useSynthesisData";
import type { SidebarContentDescriptor } from "@/types/detail-sidebar";
import type {
  KeyFindingResponse,
  HypothesisResponse,
  ContradictionResponse,
  GapResponse,
} from "@/types/synthesis";

import { VerdictSummary } from "./VerdictSummary";
import { KeyFindingCard } from "./KeyFindingCard";
import { HypothesisCard } from "./HypothesisCard";
import { ContradictionCard } from "./ContradictionCard";
import { GapCard } from "./GapCard";
import { TaskCard } from "./TaskCard";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VerdictViewProps {
  caseId: string;
  onOpenDetail?: (descriptor: SidebarContentDescriptor) => void;
  onViewFinding?: (findingId: string) => void;
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-sm font-semibold text-smoke uppercase tracking-wide">
        {title}
      </h3>
      <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-stone/10 border border-stone/15 text-xs text-stone tabular-nums">
        {count}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Skeleton
// ---------------------------------------------------------------------------

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 rounded-lg bg-stone/10" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <FileText size={40} className="text-stone/30 mb-4" />
      <h3 className="text-sm font-medium text-smoke/70 mb-1">
        No Intelligence Available
      </h3>
      <p className="text-xs text-stone/50 max-w-xs">
        Run analysis to generate hypotheses, contradictions, evidence gaps, and
        a case verdict.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VerdictView Component
// ---------------------------------------------------------------------------

export function VerdictView({
  caseId,
  onOpenDetail,
  onViewFinding,
}: VerdictViewProps) {
  // Data fetching via React Query hooks
  const { data: synthesis, isLoading: synthLoading } = useSynthesis(caseId);
  const { data: hypotheses, isLoading: hypLoading } = useHypotheses(caseId);
  const { data: contradictions, isLoading: conLoading } =
    useContradictions(caseId);
  const { data: gaps, isLoading: gapLoading } = useGaps(caseId);
  const { data: tasks, isLoading: taskLoading } = useTasks(caseId);

  // Parse key_findings from synthesis JSONB string
  const keyFindings: KeyFindingResponse[] = useMemo(() => {
    const raw = synthesis?.key_findings_summary;
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as KeyFindingResponse[];
      return [];
    } catch {
      return [];
    }
  }, [synthesis]);

  // Click handlers that construct SidebarContentDescriptor objects
  const handleHypothesisClick = useCallback(
    (hypothesis: HypothesisResponse) => {
      onOpenDetail?.({
        type: "verdict-hypothesis",
        props: { caseId, hypothesis, onViewFinding },
      });
    },
    [onOpenDetail, onViewFinding, caseId],
  );

  const handleContradictionClick = useCallback(
    (contradiction: ContradictionResponse) => {
      onOpenDetail?.({
        type: "verdict-contradiction",
        props: { caseId, contradiction, onViewFinding },
      });
    },
    [onOpenDetail, onViewFinding, caseId],
  );

  const handleGapClick = useCallback(
    (gap: GapResponse) => {
      onOpenDetail?.({
        type: "verdict-gap",
        props: { gap },
      });
    },
    [onOpenDetail],
  );

  // Global empty state: synthesis not yet available and not loading
  const isGlobalEmpty = !synthesis && !synthLoading;

  if (isGlobalEmpty) return <EmptyState />;

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-6 space-y-8"
      style={{ scrollbarWidth: "thin" }}
    >
      {/* Section 1: Summary + Verdict */}
      <section>
        <SectionHeader title="Summary & Verdict" count={synthesis ? 1 : 0} />
        <VerdictSummary
          synthesis={synthesis ?? null}
          isLoading={synthLoading}
        />
      </section>

      {/* Section 2: Key Findings */}
      <section>
        <SectionHeader title="Key Findings" count={keyFindings.length} />
        {synthLoading ? (
          <SectionSkeleton rows={3} />
        ) : keyFindings.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {keyFindings.map((finding, idx) => (
              <KeyFindingCard
                key={`finding-${idx}`}
                finding={finding}
                rank={idx + 1}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone/40">No key findings available.</p>
        )}
      </section>

      {/* Section 3: Hypotheses */}
      <section>
        <SectionHeader title="Hypotheses" count={hypotheses?.length ?? 0} />
        {hypLoading ? (
          <SectionSkeleton rows={2} />
        ) : hypotheses && hypotheses.length > 0 ? (
          <div className="space-y-3">
            {hypotheses.map((h) => (
              <HypothesisCard
                key={h.id}
                hypothesis={h}
                onClick={() => handleHypothesisClick(h)}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone/40">No hypotheses generated.</p>
        )}
      </section>

      {/* Section 4: Contradictions */}
      <section>
        <SectionHeader
          title="Contradictions"
          count={contradictions?.length ?? 0}
        />
        {conLoading ? (
          <SectionSkeleton rows={2} />
        ) : contradictions && contradictions.length > 0 ? (
          <div className="space-y-3">
            {contradictions.map((c) => (
              <ContradictionCard
                key={c.id}
                contradiction={c}
                onClick={() => handleContradictionClick(c)}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone/40">No contradictions detected.</p>
        )}
      </section>

      {/* Section 5: Evidence Gaps */}
      <section>
        <SectionHeader title="Evidence Gaps" count={gaps?.length ?? 0} />
        {gapLoading ? (
          <SectionSkeleton rows={2} />
        ) : gaps && gaps.length > 0 ? (
          <div className="space-y-3">
            {gaps.map((g) => (
              <GapCard key={g.id} gap={g} onClick={() => handleGapClick(g)} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone/40">No evidence gaps identified.</p>
        )}
      </section>

      {/* Section 6: Investigation Tasks */}
      <section>
        <SectionHeader title="Investigation Tasks" count={tasks?.length ?? 0} />
        {taskLoading ? (
          <SectionSkeleton rows={2} />
        ) : tasks && tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone/40">
            No investigation tasks generated.
          </p>
        )}
      </section>
    </div>
  );
}
