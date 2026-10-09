// ABOUTME: Batch HITL confirmation modal for reviewing multiple per-agent routing decisions.
// ABOUTME: Displays per-item approve/reject toggles with contextual metadata and submit-all action.

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "motion/react";
import {
  ShieldAlert,
  Check,
  X,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { AGENT_CONFIGS } from "@/lib/command-center-config";
import {
  respondToBatchConfirmation,
  type BatchDecision,
} from "@/lib/api/confirmations";
import type {
  ConfirmationBatchRequiredEvent,
  ConfirmationBatchItem,
  AgentType,
} from "@/types/command-center";

// -----------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------
interface BatchConfirmationModalProps {
  batch: ConfirmationBatchRequiredEvent;
  caseId: string;
  onResolved: (batchId: string) => void;
}

// -----------------------------------------------------------------------
// Context field extraction (validates types from Record<string, unknown>)
// -----------------------------------------------------------------------
interface BatchItemContext {
  agentUnderReview: string | undefined;
  fileName: string | undefined;
  confidence: number | undefined;
  reasoning: string | undefined;
}

function extractItemContext(
  context: Record<string, unknown> | undefined,
): BatchItemContext {
  if (!context) {
    return {
      agentUnderReview: undefined,
      fileName: undefined,
      confidence: undefined,
      reasoning: undefined,
    };
  }

  const agentUnderReview =
    typeof context.agent_under_review === "string"
      ? context.agent_under_review
      : undefined;
  const fileName =
    typeof context.file_name === "string" ? context.file_name : undefined;
  const reasoning =
    typeof context.reasoning === "string" ? context.reasoning : undefined;

  // Validate and clamp confidence to [0, 1]
  let confidence: number | undefined;
  if (typeof context.routing_confidence === "number") {
    confidence = Math.max(0, Math.min(1, context.routing_confidence));
  }

  return { agentUnderReview, fileName, confidence, reasoning };
}

// -----------------------------------------------------------------------
// Confidence indicator
// -----------------------------------------------------------------------
function ConfidenceBadge({ score }: { score: number }) {
  let color: string;
  if (score >= 0.8) {
    color = "hsl(142 60% 50%)";
  } else if (score >= 0.5) {
    color = "hsl(45 80% 55%)";
  } else {
    color = "hsl(0 70% 60%)";
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {Math.round(score * 100)}%
    </span>
  );
}

// -----------------------------------------------------------------------
// Single batch item row
// -----------------------------------------------------------------------
interface BatchItemRowProps {
  item: ConfirmationBatchItem;
  approved: boolean;
  reason: string;
  onToggle: () => void;
  onReasonChange: (value: string) => void;
  disabled: boolean;
}

function BatchItemRow({
  item,
  approved,
  reason,
  onToggle,
  onReasonChange,
  disabled,
}: BatchItemRowProps) {
  const [expanded, setExpanded] = useState(false);

  const { agentUnderReview, fileName, confidence, reasoning } =
    extractItemContext(item.context);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "hsl(0 0% 12% / 0.6)",
        border: `1px solid ${approved ? "hsl(142 40% 30% / 0.4)" : "hsl(0 40% 30% / 0.4)"}`,
      }}
    >
      {/* Item header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Toggle button */}
        <button
          onClick={onToggle}
          disabled={disabled}
          className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-colors disabled:opacity-50"
          style={{
            background: approved
              ? "hsl(142 50% 35% / 0.3)"
              : "hsl(0 50% 35% / 0.3)",
            border: `1px solid ${approved ? "hsl(142 50% 45% / 0.5)" : "hsl(0 50% 45% / 0.5)"}`,
          }}
          aria-label={approved ? "Reject this item" : "Approve this item"}
        >
          {approved ? (
            <Check className="w-4 h-4" style={{ color: "hsl(142 60% 55%)" }} />
          ) : (
            <X className="w-4 h-4" style={{ color: "hsl(0 70% 60%)" }} />
          )}
        </button>

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {agentUnderReview && (
              <span className="text-sm font-medium text-smoke">
                {agentUnderReview}
              </span>
            )}
            {fileName && (
              <span className="text-xs text-stone truncate">{fileName}</span>
            )}
          </div>
          <p className="text-xs text-stone mt-0.5 truncate">
            {item.action_description}
          </p>
        </div>

        {/* Confidence */}
        {typeof confidence === "number" && (
          <ConfidenceBadge score={confidence} />
        )}

        {/* Expand toggle */}
        {reasoning && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 p-1 rounded text-stone hover:text-smoke transition-colors"
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && reasoning && (
        <div
          className="px-4 pb-3 pt-0 border-t"
          style={{ borderColor: "hsl(0 0% 20% / 0.3)" }}
        >
          <p className="text-xs text-stone leading-relaxed mt-2">{reasoning}</p>
          {!approved && (
            <input
              type="text"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Rejection reason (optional)"
              disabled={disabled}
              className="mt-2 w-full rounded-md px-3 py-1.5 text-xs text-smoke placeholder:text-stone/40 focus:outline-none focus:ring-1"
              style={{
                background: "hsl(0 0% 10% / 0.6)",
                border: "1px solid hsl(0 0% 20% / 0.4)",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// BatchConfirmationModal
// -----------------------------------------------------------------------
export function BatchConfirmationModal({
  batch,
  caseId,
  onResolved,
}: BatchConfirmationModalProps) {
  const [decisions, setDecisions] = useState<Map<string, boolean>>(() => {
    const initial = new Map<string, boolean>();
    for (const item of batch.items) {
      initial.set(item.item_id, true);
    }
    return initial;
  });
  const [reasons, setReasons] = useState<Map<string, string>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const agentConfig =
    AGENT_CONFIGS[batch.agentType as AgentType] ?? AGENT_CONFIGS["triage"];

  // Focus submit button on mount for accessibility
  useEffect(() => {
    submitButtonRef.current?.focus();
  }, []);

  const toggleDecision = useCallback((itemId: string) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.set(itemId, !prev.get(itemId));
      return next;
    });
  }, []);

  const updateReason = useCallback((itemId: string, value: string) => {
    setReasons((prev) => {
      const next = new Map(prev);
      next.set(itemId, value);
      return next;
    });
  }, []);

  const approvedCount = Array.from(decisions.values()).filter(Boolean).length;
  const rejectedCount = batch.items.length - approvedCount;

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const batchDecisions: BatchDecision[] = batch.items.map((item) => ({
        item_id: item.item_id,
        approved: decisions.get(item.item_id) ?? true,
        reason: reasons.get(item.item_id)?.trim() || undefined,
      }));
      await respondToBatchConfirmation(caseId, batch.batchId, batchDecisions);
      onResolved(batch.batchId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit batch response";
      setError(message);
      console.error("Batch confirmation response failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [caseId, batch, decisions, reasons, onResolved]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-confirmation-modal-title"
      aria-describedby="batch-confirmation-modal-description"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-2xl mx-4 rounded-xl overflow-hidden"
        style={{
          background: "hsl(0 0% 10% / 0.95)",
          border: "1px solid hsl(0 0% 20% / 0.5)",
          boxShadow:
            "0 25px 50px rgba(0, 0, 0, 0.5), 0 0 30px hsl(var(--cc-accent) / 0.1)",
          maxHeight: "80vh",
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.0, 0.0, 0.2, 1.0] }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b"
          style={{
            borderColor: "hsl(0 0% 20% / 0.4)",
            background:
              "linear-gradient(135deg, hsl(var(--cc-accent) / 0.08) 0%, transparent 100%)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{
                background: "hsl(var(--cc-accent) / 0.15)",
                border: "1px solid hsl(var(--cc-accent) / 0.25)",
              }}
            >
              <ShieldAlert
                className="w-5 h-5"
                style={{ color: "hsl(var(--cc-accent))" }}
              />
            </div>
            <div>
              <h3
                id="batch-confirmation-modal-title"
                className="text-base font-semibold text-smoke"
              >
                Batch Confirmation Required
              </h3>
              <p
                id="batch-confirmation-modal-description"
                className="text-xs text-stone mt-0.5"
              >
                {agentConfig.name} — {batch.items.length} items awaiting review
              </p>
            </div>
          </div>
        </div>

        {/* Body - scrollable */}
        <div
          className="px-6 py-4 space-y-3 overflow-y-auto"
          style={{ maxHeight: "calc(80vh - 160px)" }}
        >
          {batch.items.map((item) => (
            <BatchItemRow
              key={item.item_id}
              item={item}
              approved={decisions.get(item.item_id) ?? true}
              reason={reasons.get(item.item_id) ?? ""}
              onToggle={() => toggleDecision(item.item_id)}
              onReasonChange={(value) => updateReason(item.item_id, value)}
              disabled={isSubmitting}
            />
          ))}

          {/* Error message */}
          {error && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg text-sm"
              role="alert"
              style={{
                background: "hsl(0 60% 30% / 0.15)",
                border: "1px solid hsl(0 60% 40% / 0.3)",
                color: "hsl(0 70% 70%)",
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between border-t"
          style={{ borderColor: "hsl(0 0% 20% / 0.4)" }}
        >
          {/* Summary */}
          <div className="flex items-center gap-3 text-xs">
            <span style={{ color: "hsl(142 60% 55%)" }}>
              {approvedCount} approved
            </span>
            {rejectedCount > 0 && (
              <span style={{ color: "hsl(0 70% 60%)" }}>
                {rejectedCount} rejected
              </span>
            )}
          </div>

          {/* Submit */}
          <button
            ref={submitButtonRef}
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "hsl(var(--cc-accent) / 0.2)",
              border: "1px solid hsl(var(--cc-accent) / 0.4)",
              color: "hsl(var(--cc-accent))",
            }}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Submit All Decisions
          </button>
        </div>
      </motion.div>
    </div>
  );
}
