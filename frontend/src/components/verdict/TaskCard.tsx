// ABOUTME: Investigation task card displayed in read-only mode within the Verdict view.
// ABOUTME: Shows task type, priority badge, status badge, title, and description preview.

"use client";

import { clsx } from "clsx";
import { Search, FileQuestion, GitCompare, ClipboardList } from "lucide-react";

import type { TaskResponse } from "@/types/synthesis";

// ---------------------------------------------------------------------------
// Task Type Config
// ---------------------------------------------------------------------------

const TASK_TYPE_ICON: Record<string, React.ReactNode> = {
  verify_hypothesis: <Search size={14} />,
  obtain_evidence: <FileQuestion size={14} />,
  resolve_contradiction: <GitCompare size={14} />,
};

const FALLBACK_TASK_ICON = <ClipboardList size={14} />;

/** Title-case a task_type string (replace underscores, capitalize). */
function formatTaskType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Priority badge styling (shared pattern with GapCard)
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
// Status badge styling
// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  pending: {
    bg: "bg-stone/10 border-stone/20",
    text: "text-stone",
    label: "Pending",
  },
  in_progress: {
    bg: "bg-blue-500/10 border-blue-500/25",
    text: "text-blue-400",
    label: "In Progress",
  },
  completed: {
    bg: "bg-emerald-500/10 border-emerald-500/25",
    text: "text-emerald-400",
    label: "Completed",
  },
  dismissed: {
    bg: "bg-stone/10 border-stone/20",
    text: "text-stone/50",
    label: "Dismissed",
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: TaskResponse;
}

// ---------------------------------------------------------------------------
// TaskCard Component
// ---------------------------------------------------------------------------

export function TaskCard({ task }: TaskCardProps) {
  const priorityStyle = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.low;
  const statusStyle = STATUS_STYLE[task.status] ?? STATUS_STYLE.pending;
  const icon = TASK_TYPE_ICON[task.task_type] ?? FALLBACK_TASK_ICON;

  return (
    <div className="rounded-lg border border-stone/15 bg-jet/60 p-4">
      {/* Header: Type Icon + Badges */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-stone/70">
          {icon}
          <span>{formatTaskType(task.task_type)}</span>
        </span>

        <span
          className={clsx(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
            priorityStyle.bg,
            priorityStyle.text,
          )}
        >
          {priorityStyle.label}
        </span>

        <span
          className={clsx(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
            statusStyle.bg,
            statusStyle.text,
          )}
        >
          {statusStyle.label}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-smoke leading-snug mb-1">
        {task.title}
      </h4>

      {/* Description Preview */}
      <p className="text-xs text-stone/60 leading-relaxed line-clamp-2">
        {task.description}
      </p>
    </div>
  );
}
