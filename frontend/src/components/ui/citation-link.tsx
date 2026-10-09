// ABOUTME: Reusable clickable citation link component for source viewer navigation.
// ABOUTME: Renders file name, locator badge, and optional excerpt snippet.

"use client";

import { FileText } from "lucide-react";
import { formatLocatorDisplay } from "@/lib/citation-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CitationLinkProps {
  /** Citation data with file_id, locator, and optional excerpt. */
  citation: { file_id: string; locator: string; excerpt?: string };
  /** Pre-resolved file name (from the file cache). Falls back to "Source Document". */
  fileName?: string;
  /** Whether the citation is currently being resolved/loaded. */
  isLoading?: boolean;
  /** Called when the user clicks the citation link. */
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CitationLink({
  citation,
  fileName,
  isLoading,
  onClick,
}: CitationLinkProps) {
  const displayName = fileName || "Source Document";
  const locatorLabel = formatLocatorDisplay(citation.locator);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`w-full text-left rounded-lg border border-stone/10 bg-charcoal/30 px-3 py-2 transition-colors hover:bg-charcoal/50 cursor-pointer ${
        isLoading ? "animate-pulse" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FileText size={12} className="shrink-0 text-stone" />
        <span className="text-xs text-smoke truncate">{displayName}</span>
        {locatorLabel && (
          <span className="shrink-0 ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone/15 text-stone/80">
            {locatorLabel}
          </span>
        )}
      </div>
      {citation.excerpt && (
        <p className="mt-1 text-[11px] text-stone/70 italic line-clamp-1 pl-5">
          {citation.excerpt}
        </p>
      )}
    </button>
  );
}
