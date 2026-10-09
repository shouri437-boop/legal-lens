// ABOUTME: Shared source entry components for citation displays across the app.
// ABOUTME: FileSourceEntry (clickable, file-backed) and ExcerptSourceEntry (read-only, excerpt text).

"use client";

import { FileText, ExternalLink, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResolvedFinding } from "@/hooks/useFindingResolver";

// ---------------------------------------------------------------------------
// Variant styling
// ---------------------------------------------------------------------------

/**
 * "modal" — used inside modals with CSS variable tokens (e.g., EventDetailModal).
 * "panel" — used inside sidebar panels with charcoal/stone tokens (e.g., KG panel).
 */
export type SourceEntryVariant = "modal" | "panel";

const FILE_ENTRY_STYLES: Record<
  SourceEntryVariant,
  { base: string; hover: string; fileName: string; title: string }
> = {
  modal: {
    base: "bg-(--muted)",
    hover: "hover:bg-(--muted)/80",
    fileName: "text-(--foreground)",
    title: "text-(--muted-foreground)",
  },
  panel: {
    base: "bg-charcoal/50 border border-stone/10",
    hover: "hover:bg-charcoal/70",
    fileName: "text-smoke",
    title: "text-stone/70",
  },
};

const EXCERPT_ENTRY_STYLES: Record<
  SourceEntryVariant,
  { base: string; text: string }
> = {
  modal: {
    base: "bg-(--muted)/50",
    text: "text-(--muted-foreground)",
  },
  panel: {
    base: "bg-charcoal/30 border border-stone/10",
    text: "text-stone/70",
  },
};

// ---------------------------------------------------------------------------
// FileSourceEntry
// ---------------------------------------------------------------------------

interface FileSourceEntryProps {
  sourceId: string;
  resolved: ResolvedFinding;
  onViewSource?: (sourceId: string) => void;
  variant?: SourceEntryVariant;
}

/**
 * Renders a source entry backed by an actual file (has fileId).
 * Shows filename + finding title with a "View source" action.
 */
export function FileSourceEntry({
  sourceId,
  resolved,
  onViewSource,
  variant = "modal",
}: FileSourceEntryProps) {
  const styles = FILE_ENTRY_STYLES[variant];

  return (
    <button
      key={sourceId}
      type="button"
      onClick={() => onViewSource?.(sourceId)}
      disabled={!onViewSource}
      className={cn(
        "flex items-start gap-3 p-3 w-full text-left rounded-lg transition-colors",
        styles.base,
        onViewSource
          ? `${styles.hover} cursor-pointer group`
          : "opacity-60 cursor-default",
      )}
    >
      <FileText className="w-4 h-4 text-(--muted-foreground) shrink-0 mt-0.5" />
      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
        <span
          className={cn("text-sm font-medium break-words", styles.fileName)}
        >
          {resolved.fileName}
        </span>
        {resolved.title !== resolved.id.slice(0, 8) && (
          <span
            className={cn("text-xs leading-relaxed break-words", styles.title)}
          >
            {resolved.title}
          </span>
        )}
      </div>
      {onViewSource && (
        <ExternalLink className="w-3.5 h-3.5 text-(--muted-foreground) opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ExcerptSourceEntry
// ---------------------------------------------------------------------------

interface ExcerptSourceEntryProps {
  resolved: ResolvedFinding;
  variant?: SourceEntryVariant;
}

/**
 * Renders a source entry with no file backing (excerpt-only finding).
 * Shows the finding title/excerpt as plain readable text.
 */
export function ExcerptSourceEntry({
  resolved,
  variant = "modal",
}: ExcerptSourceEntryProps) {
  const styles = EXCERPT_ENTRY_STYLES[variant];

  const displayText =
    resolved.excerpt ??
    (resolved.title !== resolved.id.slice(0, 8) ? resolved.title : null);

  if (!displayText) return null;

  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-lg", styles.base)}>
      <Quote className="w-3.5 h-3.5 text-(--muted-foreground) shrink-0 mt-0.5" />
      <p className={cn("text-xs leading-relaxed break-words", styles.text)}>
        {displayText}
      </p>
    </div>
  );
}
