// ABOUTME: Renders the case summary prose and verdict box at the top of the Verdict view.
// ABOUTME: Includes evidence strength badge, key strengths (green), and key weaknesses (red).

"use client";

import { Shield, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { clsx } from "clsx";

import type { SynthesisResponse } from "@/types/synthesis";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VerdictSummaryProps {
  synthesis: SynthesisResponse | null;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Evidence Strength Config
// ---------------------------------------------------------------------------

const EVIDENCE_STRENGTH_STYLE: Record<
  string,
  { bg: string; border: string; text: string; icon: React.ReactNode }
> = {
  Conclusive: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    icon: <Shield size={14} />,
  },
  Substantial: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    icon: <AlertTriangle size={14} />,
  },
  Inconclusive: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    icon: <AlertTriangle size={14} />,
  },
};

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function VerdictSummarySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 w-40 rounded bg-stone/10" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-stone/10" />
        <div className="h-4 w-5/6 rounded bg-stone/10" />
        <div className="h-4 w-4/6 rounded bg-stone/10" />
      </div>
      <div className="h-32 w-full rounded-lg bg-stone/10" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// VerdictSummary Component
// ---------------------------------------------------------------------------

export function VerdictSummary({ synthesis, isLoading }: VerdictSummaryProps) {
  if (isLoading) return <VerdictSummarySkeleton />;
  if (!synthesis) return null;

  const verdict = synthesis.case_verdict;
  const strengthStyle = verdict
    ? (EVIDENCE_STRENGTH_STYLE[verdict.evidence_strength] ??
      EVIDENCE_STRENGTH_STYLE.Inconclusive)
    : null;

  return (
    <div className="space-y-5">
      {/* Case Summary Prose */}
      {synthesis.case_summary && (
        <div className="space-y-3">
          <p className="text-sm text-smoke/80 leading-relaxed whitespace-pre-line">
            {synthesis.case_summary}
          </p>
        </div>
      )}

      {/* Verdict Box */}
      {verdict && (
        <div
          className={clsx(
            "rounded-lg border p-5",
            strengthStyle?.bg,
            strengthStyle?.border,
          )}
        >
          {/* Evidence Strength Badge */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className={clsx("flex items-center gap-1.5", strengthStyle?.text)}
            >
              {strengthStyle?.icon}
              <span className="text-xs font-semibold uppercase tracking-wide">
                {verdict.evidence_strength}
              </span>
            </span>
          </div>

          {/* Verdict Text */}
          <p className="text-sm text-smoke/90 leading-relaxed mb-4">
            {verdict.verdict}
          </p>

          {/* Strengths & Weaknesses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Key Strengths */}
            {verdict.key_strengths.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2">
                  Key Strengths
                </h4>
                <ul className="space-y-1.5">
                  {verdict.key_strengths.map((strength, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs text-smoke/70"
                    >
                      <CheckCircle2
                        size={12}
                        className="text-emerald-500 mt-0.5 shrink-0"
                      />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Weaknesses */}
            {verdict.key_weaknesses.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">
                  Key Weaknesses
                </h4>
                <ul className="space-y-1.5">
                  {verdict.key_weaknesses.map((weakness, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-xs text-smoke/70"
                    >
                      <XCircle
                        size={12}
                        className="text-red-500 mt-0.5 shrink-0"
                      />
                      <span>{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
