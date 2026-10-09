// ABOUTME: Full contradiction detail panel rendered inside the app-wide DetailSidebar.
// ABOUTME: Shows side-by-side claims with source excerpts, severity badge, and domain tag.

"use client";

import { clsx } from "clsx";
import { AlertTriangle, FileText, Quote } from "lucide-react";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { useFindingResolver } from "@/hooks/useFindingResolver";
import type { ResolvedFinding } from "@/hooks/useFindingResolver";
import type { ContradictionResponse } from "@/types/synthesis";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ContradictionDetailPanelProps {
  caseId: string;
  contradiction: ContradictionResponse;
  onViewFinding?: (findingId: string) => void;
}

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------

const SEVERITY_STYLE: Record<
  string,
  { color: string; bg: string; text: string; label: string }
> = {
  minor: {
    color: "#78716c",
    bg: "bg-stone/10 border-stone/20",
    text: "text-stone",
    label: "Minor",
  },
  significant: {
    color: "#f59e0b",
    bg: "bg-amber-500/10 border-amber-500/25",
    text: "text-amber-400",
    label: "Significant",
  },
  critical: {
    color: "#ef4444",
    bg: "bg-red-500/10 border-red-500/25",
    text: "text-red-400",
    label: "Critical",
  },
};

// ---------------------------------------------------------------------------
// Source excerpt subcomponent
// ---------------------------------------------------------------------------

interface SourceExcerptProps {
  label: string;
  source: Record<string, unknown> | null;
  accentColor: string;
  resolved?: ResolvedFinding | null;
  onViewFinding?: (findingId: string) => void;
}

function SourceExcerpt({
  label,
  source,
  accentColor,
  resolved,
  onViewFinding,
}: SourceExcerptProps) {
  if (!source) return null;

  const findingId =
    typeof source.finding_id === "string" ? source.finding_id : null;
  const excerpt = typeof source.excerpt === "string" ? source.excerpt : null;

  if (!findingId && !excerpt) return null;

  const isClickable =
    !!onViewFinding &&
    !!findingId &&
    !!resolved?.fileId &&
    !!resolved?.fileName;

  return (
    <div
      className={clsx(
        "group rounded-lg bg-charcoal/50 border border-stone/10 p-3",
        isClickable && "cursor-pointer hover:bg-charcoal/70 transition-colors",
      )}
      onClick={
        isClickable ? () => onViewFinding(findingId as string) : undefined
      }
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onViewFinding(findingId as string);
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Quote size={12} style={{ color: accentColor }} className="shrink-0" />
        <span className="text-xs font-medium" style={{ color: accentColor }}>
          {label}
        </span>
        {findingId && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-stone/50">
            <FileText size={10} className="shrink-0" />
            <span className="truncate max-w-[120px]">
              {resolved?.fileName ?? findingId.slice(0, 8)}
            </span>
            {isClickable && (
              <span className="hidden group-hover:inline text-[10px] text-stone/70 ml-1">
                View source
              </span>
            )}
          </span>
        )}
      </div>
      {excerpt && (
        <p className="text-xs text-smoke/80 leading-relaxed italic">
          &ldquo;{excerpt}&rdquo;
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContradictionDetailPanel Component
// ---------------------------------------------------------------------------

export function ContradictionDetailPanel({
  caseId,
  contradiction,
  onViewFinding,
}: ContradictionDetailPanelProps) {
  const severityStyle =
    SEVERITY_STYLE[contradiction.severity] ?? SEVERITY_STYLE.minor;
  const { getFinding } = useFindingResolver(caseId);

  // Resolve file names for source references
  const sourceAFindingId =
    typeof contradiction.source_a?.finding_id === "string"
      ? contradiction.source_a.finding_id
      : null;
  const sourceBFindingId =
    typeof contradiction.source_b?.finding_id === "string"
      ? contradiction.source_b.finding_id
      : null;
  const resolvedA = sourceAFindingId ? getFinding(sourceAFindingId) : null;
  const resolvedB = sourceBFindingId ? getFinding(sourceBFindingId) : null;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex-none px-5 py-5 border-b border-stone/15"
        style={{
          background: `linear-gradient(135deg, ${severityStyle.color}20 0%, transparent 100%)`,
        }}
      >
        {/* Severity + Domain */}
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
            <span className="text-xs text-stone/60">
              {contradiction.domain}
            </span>
          )}
          <span className="text-xs text-stone/50">
            {contradiction.resolution_status}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-smoke mb-1">
          Conflicting Claims
        </h3>
        <p className="text-xs text-stone/60">
          Two evidence items present contradictory findings.
        </p>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* Side-by-side Claims */}
        <CollapsibleSection
          title="Claims Comparison"
          color={severityStyle.color}
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          defaultOpen
        >
          <div className="space-y-3">
            {/* Claim A */}
            <div className="rounded-lg bg-charcoal/50 border border-stone/10 p-4">
              <span className="text-[10px] font-semibold text-stone/50 uppercase tracking-wider block mb-1.5">
                Claim A
              </span>
              <p className="text-sm text-smoke/90 leading-relaxed">
                {contradiction.claim_a}
              </p>
            </div>

            {/* VS Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-stone/15" />
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold shrink-0">
                VS
              </span>
              <div className="flex-1 h-px bg-stone/15" />
            </div>

            {/* Claim B */}
            <div className="rounded-lg bg-charcoal/50 border border-stone/10 p-4">
              <span className="text-[10px] font-semibold text-stone/50 uppercase tracking-wider block mb-1.5">
                Claim B
              </span>
              <p className="text-sm text-smoke/90 leading-relaxed">
                {contradiction.claim_b}
              </p>
            </div>
          </div>
        </CollapsibleSection>

        {/* Source Excerpts */}
        {(contradiction.source_a || contradiction.source_b) && (
          <CollapsibleSection
            title="Source References"
            color={severityStyle.color}
            icon={<FileText className="w-3.5 h-3.5" />}
            badge={
              (contradiction.source_a ? 1 : 0) +
              (contradiction.source_b ? 1 : 0)
            }
            defaultOpen
          >
            <div className="space-y-2">
              <SourceExcerpt
                label="Source for Claim A"
                source={contradiction.source_a}
                accentColor={severityStyle.color}
                resolved={resolvedA}
                onViewFinding={onViewFinding}
              />
              <SourceExcerpt
                label="Source for Claim B"
                source={contradiction.source_b}
                accentColor={severityStyle.color}
                resolved={resolvedB}
                onViewFinding={onViewFinding}
              />
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
