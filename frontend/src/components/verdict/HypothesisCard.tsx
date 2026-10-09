// ABOUTME: Hypothesis card with colored confidence dot (red/amber/green) and percentage.
// ABOUTME: Shows claim text, status badge, and evidence count. Clickable for detail sidebar.

"use client";

import { clsx } from "clsx";

import type { HypothesisResponse } from "@/types/synthesis";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HypothesisCardProps {
  hypothesis: HypothesisResponse;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the Tailwind color class for confidence dot and text. */
function getConfidenceColor(confidence: number): {
  dot: string;
  text: string;
} {
  if (confidence < 40) return { dot: "bg-red-500", text: "text-red-400" };
  if (confidence <= 60) return { dot: "bg-amber-500", text: "text-amber-400" };
  return { dot: "bg-emerald-500", text: "text-emerald-400" };
}

/** Status badge styling by hypothesis status. */
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "bg-stone/10 border-stone/20", text: "text-stone" },
  SUPPORTED: {
    bg: "bg-emerald-500/10 border-emerald-500/25",
    text: "text-emerald-400",
  },
  REFUTED: { bg: "bg-red-500/10 border-red-500/25", text: "text-red-400" },
};

// ---------------------------------------------------------------------------
// HypothesisCard Component
// ---------------------------------------------------------------------------

export function HypothesisCard({ hypothesis, onClick }: HypothesisCardProps) {
  const confidenceColor = getConfidenceColor(hypothesis.confidence);
  const statusStyle = STATUS_STYLE[hypothesis.status] ?? STATUS_STYLE.PENDING;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-stone/15 bg-jet/60 p-4 transition-colors hover:bg-jet/80 hover:border-stone/25"
    >
      <div className="flex items-start gap-3">
        {/* Confidence Dot + Percentage */}
        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          <span className={clsx("w-3 h-3 rounded-full", confidenceColor.dot)} />
          <span
            className={clsx(
              "text-xs font-semibold tabular-nums",
              confidenceColor.text,
            )}
          >
            {hypothesis.confidence}%
          </span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Claim Text */}
          <p className="text-sm text-smoke/90 leading-relaxed line-clamp-3 mb-2">
            {hypothesis.claim}
          </p>

          {/* Status + Evidence Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Badge */}
            <span
              className={clsx(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                statusStyle.bg,
                statusStyle.text,
              )}
            >
              {hypothesis.status}
            </span>

            {/* Evidence Count */}
            {hypothesis.evidence.length > 0 && (
              <span className="text-xs text-stone/50">
                {hypothesis.evidence.length} evidence item
                {hypothesis.evidence.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
