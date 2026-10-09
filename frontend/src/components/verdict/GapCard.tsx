// ABOUTME: Evidence gap card showing priority badge, description, and actionable suggestions.
// ABOUTME: Color-coded by priority level (critical=red, high=orange, medium=amber, low=gray).

"use client";

import { clsx } from "clsx";
import { Lightbulb } from "lucide-react";

import type { GapResponse } from "@/types/synthesis";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GapCardProps {
  gap: GapResponse;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Priority badge styling
// ---------------------------------------------------------------------------

const PRIORITY_STYLE: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  critical: {
    bg: "bg-red-500/10 border-red-500/25",
    text: "text-red-400",
    label: "Critical",
  },
  high: {
    bg: "bg-orange-500/10 border-orange-500/25",
    text: "text-orange-400",
    label: "High",
  },
  medium: {
    bg: "bg-amber-500/10 border-amber-500/25",
    text: "text-amber-400",
    label: "Medium",
  },
  low: {
    bg: "bg-stone/10 border-stone/20",
    text: "text-stone",
    label: "Low",
  },
};

// ---------------------------------------------------------------------------
// GapCard Component
// ---------------------------------------------------------------------------

export function GapCard({ gap, onClick }: GapCardProps) {
  const priorityStyle = PRIORITY_STYLE[gap.priority] ?? PRIORITY_STYLE.low;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-stone/15 bg-jet/60 p-4 transition-colors hover:bg-jet/80 hover:border-stone/25"
    >
      {/* Priority Badge */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={clsx(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
            priorityStyle.bg,
            priorityStyle.text,
          )}
        >
          {priorityStyle.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-smoke/90 leading-relaxed line-clamp-2 mb-2">
        {gap.description}
      </p>

      {/* What Is Missing */}
      <p className="text-xs text-stone/60 leading-relaxed line-clamp-2 mb-2">
        {gap.what_is_missing}
      </p>

      {/* Suggested Actions Preview */}
      {gap.suggested_actions && (
        <div className="flex items-start gap-1.5 text-xs text-amber-400/70">
          <Lightbulb size={12} className="mt-0.5 shrink-0" />
          <span className="line-clamp-1">{gap.suggested_actions}</span>
        </div>
      )}
    </button>
  );
}
