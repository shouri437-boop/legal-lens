// ABOUTME: Side-by-side claim comparison card for contradictions.
// ABOUTME: Shows Claim A vs Claim B with a VS badge in the center and severity badge.

"use client";

import { clsx } from "clsx";

import type { ContradictionResponse } from "@/types/synthesis";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContradictionCardProps {
  contradiction: ContradictionResponse;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Severity badge styling
// ---------------------------------------------------------------------------

const SEVERITY_STYLE: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  minor: {
    bg: "bg-stone/10 border-stone/20",
    text: "text-stone",
    label: "Minor",
  },
  significant: {
    bg: "bg-amber-500/10 border-amber-500/25",
    text: "text-amber-400",
    label: "Significant",
  },
  critical: {
    bg: "bg-red-500/10 border-red-500/25",
    text: "text-red-400",
    label: "Critical",
  },
};

// ---------------------------------------------------------------------------
// ContradictionCard Component
// ---------------------------------------------------------------------------

export function ContradictionCard({
  contradiction,
  onClick,
}: ContradictionCardProps) {
  const severityStyle =
    SEVERITY_STYLE[contradiction.severity] ?? SEVERITY_STYLE.minor;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-stone/15 bg-jet/60 p-4 transition-colors hover:bg-jet/80 hover:border-stone/25"
    >
      {/* Header: Severity + Domain */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className={clsx(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
            severityStyle.bg,
            severityStyle.text,
          )}
        >
          {severityStyle.label}
        </span>

        {contradiction.domain && (
          <span className="text-xs text-stone/50">{contradiction.domain}</span>
        )}
      </div>

      {/* Side-by-side Claims */}
      <div className="flex items-stretch gap-2">
        {/* Claim A */}
        <div className="flex-1 min-w-0 rounded-md bg-charcoal/40 border border-stone/10 p-3">
          <span className="text-[10px] font-semibold text-stone/50 uppercase tracking-wider block mb-1">
            Claim A
          </span>
          <p className="text-xs text-smoke/80 leading-relaxed line-clamp-3">
            {contradiction.claim_a}
          </p>
        </div>

        {/* VS Badge */}
        <div className="flex items-center shrink-0">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold">
            VS
          </span>
        </div>

        {/* Claim B */}
        <div className="flex-1 min-w-0 rounded-md bg-charcoal/40 border border-stone/10 p-3">
          <span className="text-[10px] font-semibold text-stone/50 uppercase tracking-wider block mb-1">
            Claim B
          </span>
          <p className="text-xs text-smoke/80 leading-relaxed line-clamp-3">
            {contradiction.claim_b}
          </p>
        </div>
      </div>
    </button>
  );
}
