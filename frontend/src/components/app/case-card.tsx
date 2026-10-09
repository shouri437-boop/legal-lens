// ABOUTME: Case card component for displaying case in grid or list view
// ABOUTME: Shows case name, status badge, file count, and last updated

"use client";

import { useRouter } from "next/navigation";
import { Trash2, FileText, Clock } from "lucide-react";
import { clsx } from "clsx";
import type { Case, CaseStatus, VerdictLabel } from "@/types/case";

interface CaseCardProps {
  caseData: Case;
  viewMode: "grid" | "list";
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

const statusConfig: Record<
  CaseStatus,
  { label: string; className: string; style?: React.CSSProperties }
> = {
  DRAFT: {
    label: "Draft",
    className: "text-(--muted-foreground)",
    style: { backgroundColor: "var(--muted)" },
  },
  PROCESSING: {
    label: "Processing",
    className: "bg-amber-500/20 text-amber-500 dark:text-amber-400",
  },
  READY: {
    label: "Ready",
    className: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  },
  ERROR: {
    label: "Error",
    className: "bg-red-500/20 text-red-600 dark:text-red-400",
  },
};

/** Verdict badge colors keyed by evidence strength label. */
const verdictConfig: Record<VerdictLabel, { className: string }> = {
  Conclusive: {
    className: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  },
  Substantial: {
    className: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  },
  Inconclusive: {
    className: "bg-stone-500/20 text-stone-500 dark:text-stone-400",
  },
};

/** Resolve the badge label and className for a case (verdict takes priority). */
function resolveBadge(caseData: Case): {
  label: string;
  className: string;
  style?: React.CSSProperties;
} {
  if (caseData.verdict_label && verdictConfig[caseData.verdict_label]) {
    return {
      label: caseData.verdict_label,
      className: verdictConfig[caseData.verdict_label].className,
    };
  }
  return statusConfig[caseData.status];
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function CaseCard({
  caseData,
  viewMode,
  onDelete,
  isDeleting,
}: CaseCardProps) {
  const router = useRouter();
  const badge = resolveBadge(caseData);

  const handleClick = () => {
    router.push(`/cases/${caseData.id}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${caseData.name}"?`)) {
      onDelete(caseData.id);
    }
  };

  if (viewMode === "list") {
    return (
      <div
        onClick={handleClick}
        className={clsx(
          "flex items-center gap-4 p-4 rounded-xl",
          "cursor-pointer transition-all duration-200",
          isDeleting && "opacity-50 pointer-events-none",
        )}
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Name */}
        <div className="flex-1 min-w-0">
          <h3 className="text-(--foreground) font-medium truncate">
            {caseData.name}
          </h3>
          {caseData.description && (
            <p className="text-(--muted-foreground) text-sm truncate mt-0.5">
              {caseData.description}
            </p>
          )}
        </div>

        {/* Status / Verdict badge */}
        <span
          className={clsx(
            "px-2.5 py-1 rounded-full text-xs font-medium",
            badge.className,
          )}
          style={badge.style}
        >
          {badge.label}
        </span>

        {/* File count */}
        <div className="flex items-center gap-1.5 text-(--muted-foreground) text-sm w-20">
          <FileText className="w-4 h-4" />
          <span>{caseData.file_count} files</span>
        </div>

        {/* Last updated */}
        <div className="flex items-center gap-1.5 text-(--muted-foreground) text-sm w-24">
          <Clock className="w-4 h-4" />
          <span>{formatRelativeTime(caseData.updated_at)}</span>
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className={clsx(
            "p-2 rounded-lg transition-colors",
            "text-(--muted-foreground) hover:text-red-400 hover:bg-red-500/10",
            "focus:outline-none focus:ring-2 focus:ring-red-500/50",
          )}
          title="Delete case"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Grid mode
  return (
    <div
      onClick={handleClick}
      className={clsx(
        "flex flex-col p-4 rounded-xl",
        "cursor-pointer transition-all duration-200",
        isDeleting && "opacity-50 pointer-events-none",
      )}
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header with status/verdict badge and delete */}
      <div className="flex items-start justify-between mb-3">
        <span
          className={clsx(
            "px-2.5 py-1 rounded-full text-xs font-medium",
            badge.className,
          )}
          style={badge.style}
        >
          {badge.label}
        </span>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className={clsx(
            "p-1.5 rounded-lg transition-colors",
            "text-(--muted-foreground) hover:text-red-400 hover:bg-red-500/10",
            "focus:outline-none focus:ring-2 focus:ring-red-500/50",
          )}
          title="Delete case"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Name and description */}
      <h3 className="text-(--foreground) font-medium mb-1 line-clamp-1">
        {caseData.name}
      </h3>
      {caseData.description && (
        <p className="text-(--muted-foreground) text-sm line-clamp-2 mb-4">
          {caseData.description}
        </p>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer with metadata */}
      <div
        className="flex items-center justify-between text-(--muted-foreground) text-sm pt-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4" />
          <span>{caseData.file_count} files</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          <span>{formatRelativeTime(caseData.updated_at)}</span>
        </div>
      </div>
    </div>
  );
}
