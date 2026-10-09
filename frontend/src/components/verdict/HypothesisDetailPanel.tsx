// ABOUTME: Full hypothesis detail panel rendered inside the app-wide DetailSidebar.
// ABOUTME: Shows claim, confidence meter, reasoning, and color-coded evidence list.

"use client";

import { clsx } from "clsx";
import { FileText, Shield, AlertTriangle, Minus } from "lucide-react";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { useFindingResolver } from "@/hooks/useFindingResolver";
import type {
  HypothesisResponse,
  SynthesisEvidenceItem,
} from "@/types/synthesis";
import type { ResolvedFinding } from "@/hooks/useFindingResolver";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HypothesisDetailPanelProps {
  caseId: string;
  hypothesis: HypothesisResponse;
  onViewFinding?: (findingId: string) => void;
}

// ---------------------------------------------------------------------------
// Confidence helpers
// ---------------------------------------------------------------------------

/** Returns the CSS color for a confidence value (0-100 scale). */
function getConfidenceColor(confidence: number): string {
  if (confidence < 40) return "#ef4444"; // red-500
  if (confidence <= 60) return "#f59e0b"; // amber-500
  return "#10b981"; // emerald-500
}

/** Returns the human-readable label for a confidence value. */
function getConfidenceLabel(confidence: number): string {
  if (confidence < 20) return "Very Low";
  if (confidence < 40) return "Low";
  if (confidence <= 60) return "Moderate";
  if (confidence <= 80) return "High";
  return "Very High";
}

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "bg-stone/10 border-stone/20", text: "text-stone" },
  SUPPORTED: {
    bg: "bg-emerald-500/10 border-emerald-500/25",
    text: "text-emerald-400",
  },
  REFUTED: { bg: "bg-red-500/10 border-red-500/25", text: "text-red-400" },
};

// ---------------------------------------------------------------------------
// Evidence role helpers
// ---------------------------------------------------------------------------

const ROLE_CONFIG: Record<
  string,
  { icon: typeof Shield; color: string; label: string }
> = {
  supporting: {
    icon: Shield,
    color: "#10b981",
    label: "Supporting",
  },
  contradicting: {
    icon: AlertTriangle,
    color: "#ef4444",
    label: "Contradicting",
  },
  neutral: {
    icon: Minus,
    color: "#78716c",
    label: "Neutral",
  },
};

// ---------------------------------------------------------------------------
// EvidenceRow subcomponent
// ---------------------------------------------------------------------------

function EvidenceRow({
  item,
  resolved,
  onViewFinding,
}: {
  item: SynthesisEvidenceItem;
  resolved: ResolvedFinding | null;
  onViewFinding?: (findingId: string) => void;
}) {
  const config = ROLE_CONFIG[item.role] ?? ROLE_CONFIG.neutral;
  const Icon = config.icon;
  const isClickable =
    !!onViewFinding &&
    !!item.finding_id &&
    !!resolved?.fileId &&
    !!resolved?.fileName;

  return (
    <div
      className={clsx(
        "group rounded-lg bg-charcoal/50 border border-stone/10 p-3",
        isClickable && "cursor-pointer hover:bg-charcoal/70 transition-colors",
      )}
      onClick={
        isClickable ? () => onViewFinding(item.finding_id as string) : undefined
      }
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onViewFinding(item.finding_id as string);
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} style={{ color: config.color }} className="shrink-0" />
        <span className="text-xs font-medium" style={{ color: config.color }}>
          {config.label}
        </span>
        {item.finding_id && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-stone/50">
            <FileText size={10} className="shrink-0" />
            <span className="truncate max-w-[120px]">
              {resolved?.fileName ?? item.finding_id.slice(0, 8)}
            </span>
            {isClickable && (
              <span className="hidden group-hover:inline text-[10px] text-stone/70 ml-1">
                View source
              </span>
            )}
          </span>
        )}
      </div>
      <p className="text-xs text-smoke/80 leading-relaxed">{item.excerpt}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HypothesisDetailPanel Component
// ---------------------------------------------------------------------------

export function HypothesisDetailPanel({
  caseId,
  hypothesis,
  onViewFinding,
}: HypothesisDetailPanelProps) {
  const confidenceColor = getConfidenceColor(hypothesis.confidence);
  const statusStyle = STATUS_STYLE[hypothesis.status] ?? STATUS_STYLE.PENDING;
  const { getFinding } = useFindingResolver(caseId);

  const supportingEvidence = hypothesis.evidence.filter(
    (e) => e.role === "supporting",
  );
  const contradictingEvidence = hypothesis.evidence.filter(
    (e) => e.role === "contradicting",
  );
  const neutralEvidence = hypothesis.evidence.filter(
    (e) => e.role === "neutral",
  );

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex-none px-5 py-5 border-b border-stone/15"
        style={{
          background: `linear-gradient(135deg, ${confidenceColor}20 0%, transparent 100%)`,
        }}
      >
        {/* Status badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={clsx(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
              statusStyle.bg,
              statusStyle.text,
            )}
          >
            {hypothesis.status}
          </span>
          {hypothesis.source_agent && (
            <span className="text-xs text-stone/50">
              via {hypothesis.source_agent}
            </span>
          )}
        </div>

        {/* Claim text */}
        <h3 className="text-sm font-semibold text-smoke leading-relaxed mb-4">
          {hypothesis.claim}
        </h3>

        {/* Confidence meter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone/70">Confidence</span>
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: confidenceColor }}
            >
              {hypothesis.confidence}% &mdash;{" "}
              {getConfidenceLabel(hypothesis.confidence)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-charcoal/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${hypothesis.confidence}%`,
                backgroundColor: confidenceColor,
              }}
            />
          </div>
        </div>

        {/* Evidence count summary */}
        <div className="flex items-center gap-4 mt-3 text-xs text-stone/80">
          <span className="flex items-center gap-1">
            <FileText size={12} />
            {hypothesis.evidence.length} evidence item
            {hypothesis.evidence.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* Reasoning section */}
        {hypothesis.reasoning && (
          <CollapsibleSection
            title="Reasoning"
            color={confidenceColor}
            icon={<Shield className="w-3.5 h-3.5" />}
            defaultOpen
          >
            <p className="text-sm text-smoke/80 leading-relaxed whitespace-pre-wrap">
              {hypothesis.reasoning}
            </p>
          </CollapsibleSection>
        )}

        {/* Supporting Evidence */}
        {supportingEvidence.length > 0 && (
          <CollapsibleSection
            title="Supporting Evidence"
            color="#10b981"
            icon={<Shield className="w-3.5 h-3.5" />}
            badge={supportingEvidence.length}
            defaultOpen
          >
            <div className="space-y-2">
              {supportingEvidence.map((item, idx) => (
                <EvidenceRow
                  key={`supporting-${idx}`}
                  item={item}
                  resolved={
                    item.finding_id ? getFinding(item.finding_id) : null
                  }
                  onViewFinding={onViewFinding}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Contradicting Evidence */}
        {contradictingEvidence.length > 0 && (
          <CollapsibleSection
            title="Contradicting Evidence"
            color="#ef4444"
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            badge={contradictingEvidence.length}
            defaultOpen
          >
            <div className="space-y-2">
              {contradictingEvidence.map((item, idx) => (
                <EvidenceRow
                  key={`contradicting-${idx}`}
                  item={item}
                  resolved={
                    item.finding_id ? getFinding(item.finding_id) : null
                  }
                  onViewFinding={onViewFinding}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Neutral Evidence */}
        {neutralEvidence.length > 0 && (
          <CollapsibleSection
            title="Neutral Evidence"
            color="#78716c"
            icon={<Minus className="w-3.5 h-3.5" />}
            badge={neutralEvidence.length}
          >
            <div className="space-y-2">
              {neutralEvidence.map((item, idx) => (
                <EvidenceRow
                  key={`neutral-${idx}`}
                  item={item}
                  resolved={
                    item.finding_id ? getFinding(item.finding_id) : null
                  }
                  onViewFinding={onViewFinding}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Empty evidence state */}
        {hypothesis.evidence.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-stone">
              No evidence items linked to this hypothesis.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
