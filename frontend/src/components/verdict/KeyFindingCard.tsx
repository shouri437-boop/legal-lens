// ABOUTME: Compact card displaying a ranked key finding from the synthesis output.
// ABOUTME: Shows rank badge, title, truncated description, and source count.

"use client";

import { FileText } from "lucide-react";

import type { KeyFindingResponse } from "@/types/synthesis";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KeyFindingCardProps {
  finding: KeyFindingResponse;
  rank: number;
  onClick?: () => void;
}

// ---------------------------------------------------------------------------
// KeyFindingCard Component
// ---------------------------------------------------------------------------

export function KeyFindingCard({
  finding,
  rank,
  onClick,
}: KeyFindingCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="w-full text-left rounded-lg border border-stone/15 bg-jet/60 p-4 transition-colors hover:bg-jet/80 hover:border-stone/25 disabled:cursor-default disabled:hover:bg-jet/60 disabled:hover:border-stone/15"
    >
      <div className="flex items-start gap-3">
        {/* Rank Badge */}
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold shrink-0">
          {rank}
        </span>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className="text-sm font-medium text-smoke leading-snug mb-1">
            {finding.title}
          </h4>

          {/* Description (truncated to 2 lines) */}
          <p className="text-xs text-stone/70 leading-relaxed line-clamp-2">
            {finding.description}
          </p>

          {/* Source Count */}
          {finding.source_finding_ids.length > 0 && (
            <div className="flex items-center gap-1 mt-2 text-xs text-stone/50">
              <FileText size={11} />
              <span>
                {finding.source_finding_ids.length} source
                {finding.source_finding_ids.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
