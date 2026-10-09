"use client";

import { useState } from "react";
import { formatEventClock, formatEventDate } from "@/lib/utils/dateFormatters";
import {
  FileText,
  Scale,
  Target,
  DollarSign,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { TimelineEvent } from "@/types/timeline.types";
import { LAYER_CONFIG } from "@/constants/timeline.constants";
import { cn } from "@/lib/utils";
import { formatLocatorDisplay } from "@/lib/citation-utils";

// ---------------------------------------------------------------------------
// Citation type for timeline events (from metadata.citations)
// ---------------------------------------------------------------------------

interface TimelineCitation {
  file_id: string;
  locator: string;
  excerpt?: string;
}

interface TimelineEventCardProps {
  event: TimelineEvent;
  onClick?: () => void;
  onViewCitation?: (citation: TimelineCitation) => void;
}

const ICON_MAP = {
  FileText,
  Scale,
  Target,
  DollarSign,
};

export function TimelineEventCard({
  event,
  onClick,
  onViewCitation,
}: TimelineEventCardProps) {
  const layerConfig = LAYER_CONFIG[event.layer];
  const IconComponent = ICON_MAP[layerConfig.icon as keyof typeof ICON_MAP];

  // Extract citations from event metadata, validating at the API boundary.
  // metadata.citations is untyped (Record<string, unknown>), so each item
  // must be validated before use rather than blindly cast.
  const citations: TimelineCitation[] = (() => {
    const raw = event.metadata?.citations;
    if (!Array.isArray(raw)) return [];
    return raw.filter((c: unknown): c is TimelineCitation => {
      if (typeof c !== "object" || c === null) return false;
      const obj = c as { file_id?: unknown; locator?: unknown };
      return typeof obj.file_id === "string" && typeof obj.locator === "string";
    });
  })();

  const [showCitations, setShowCitations] = useState(false);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "group relative p-4 rounded-lg border transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        "bg-white/90 dark:bg-[rgba(17,17,17,0.6)]",
        "dark:shadow-none",
        "border-warm-gray/15 dark:border-stone/20",
      )}
      style={{
        borderLeftColor: layerConfig.hexColor + "40",
        borderLeftWidth: "3px",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-md"
            style={{ backgroundColor: layerConfig.hexColor + "12" }}
          >
            <IconComponent
              className="w-4 h-4 opacity-60"
              style={{ color: layerConfig.hexColor }}
            />
          </div>
          <span
            className="text-xs font-medium uppercase tracking-wide opacity-60"
            style={{ color: layerConfig.hexColor }}
          >
            {layerConfig.label}
          </span>
          {event.eventType && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              {event.eventType.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {/* Confidence indicator */}
        <div className="flex items-center gap-1">
          {event.isUserCorrected ? (
            <div
              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-500/12 text-green-700 dark:text-green-400"
              title="User verified"
            >
              <Check className="w-3 h-3" />
              <span className="hidden sm:inline">Verified</span>
            </div>
          ) : event.confidence < 0.7 ? (
            <div
              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-700 dark:text-amber-400"
              title={`Confidence: ${Math.round(event.confidence * 100)}%`}
            >
              <AlertCircle className="w-3 h-3" />
              <span className="hidden sm:inline">
                {Math.round(event.confidence * 100)}%
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold mb-1 transition-colors text-foreground">
        {event.title}
      </h4>

      {/* Description */}
      {event.description && (
        <p className="text-sm line-clamp-2 mb-3 text-muted-foreground">
          {event.description}
        </p>
      )}

      {/* Footer metadata */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <time dateTime={event.date}>
          {[formatEventDate(event.date, "MMM d"), formatEventClock(event.date)]
            .filter(Boolean)
            .join(" · ")}
        </time>

        {citations.length > 0 ? (
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 transition-colors",
              onViewCitation &&
                "cursor-pointer hover:text-foreground underline decoration-muted-foreground/30",
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (onViewCitation) {
                setShowCitations((prev) => !prev);
              }
            }}
          >
            <FileText className="w-3 h-3" />
            {citations.length} {citations.length === 1 ? "source" : "sources"}
            {onViewCitation &&
              (showCitations ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              ))}
          </button>
        ) : (
          event.sourceIds &&
          event.sourceIds.length > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {event.sourceIds.length}{" "}
              {event.sourceIds.length === 1 ? "source" : "sources"}
            </span>
          )
        )}

        {event.entityIds && event.entityIds.length > 0 && (
          <span>
            {event.entityIds.length}{" "}
            {event.entityIds.length === 1 ? "entity" : "entities"}
          </span>
        )}
      </div>

      {/* Expandable citation list */}
      {showCitations && onViewCitation && citations.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
          {citations.map((citation, idx) => (
            <button
              key={`citation-${idx}`}
              type="button"
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/50 cursor-pointer transition-colors w-full text-left"
              onClick={(e) => {
                e.stopPropagation();
                onViewCitation(citation);
              }}
            >
              <FileText size={12} className="shrink-0 text-muted-foreground" />
              <span className="font-mono text-muted-foreground shrink-0">
                {citation.file_id.slice(0, 8)}...
              </span>
              {citation.locator && (
                <span className="text-muted-foreground/70 shrink-0">
                  {formatLocatorDisplay(citation.locator)}
                </span>
              )}
              {citation.excerpt && (
                <span className="text-muted-foreground/60 italic line-clamp-1 ml-1">
                  {citation.excerpt}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Hover indicator */}
      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ring-1 ring-inset ring-stone/30" />
    </div>
  );
}
