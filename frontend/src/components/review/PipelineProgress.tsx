// ABOUTME: Compact progress strip showing which analysis stages are pending, running, done or failed.
// ABOUTME: Derives per-stage status from the SSE-driven agent state map.

"use client";

import { Check, Circle, Loader2, AlertTriangle } from "lucide-react";
import type {
  AgentState,
  AgentStatus,
  AgentType,
} from "@/types/command-center";

const STAGES: { type: AgentType; label: string }[] = [
  { type: "triage", label: "Read evidence" },
  { type: "orchestrator", label: "Plan review" },
  { type: "legal", label: "Legal" },
  { type: "evidence", label: "Evidence" },
  { type: "knowledge-graph", label: "Connections" },
  { type: "synthesis", label: "Findings" },
];

function stageStatus(states: AgentState[]): AgentStatus {
  if (states.length === 0) return "idle";
  if (states.some((s) => s.status === "error")) return "error";
  if (states.some((s) => s.status === "processing")) return "processing";
  if (states.every((s) => s.status === "complete")) return "complete";
  return "idle";
}

function StageIcon({ status }: { status: AgentStatus }) {
  switch (status) {
    case "complete":
      return <Check size={14} className="text-emerald-600" />;
    case "processing":
      return <Loader2 size={14} className="animate-spin text-slate-500" />;
    case "error":
      return <AlertTriangle size={14} className="text-red-500" />;
    default:
      return (
        <Circle size={14} className="text-(--muted-foreground) opacity-50" />
      );
  }
}

interface PipelineProgressProps {
  agentStates: Map<string, AgentState>;
  isConnected: boolean;
}

export function PipelineProgress({
  agentStates,
  isConnected,
}: PipelineProgressProps) {
  const all = Array.from(agentStates.values());

  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg px-4 py-3"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      {STAGES.map((stage) => {
        const status = stageStatus(all.filter((s) => s.type === stage.type));
        return (
          <div key={stage.type} className="flex items-center gap-1.5 text-xs">
            <StageIcon status={status} />
            <span
              style={{
                color:
                  status === "idle"
                    ? "var(--muted-foreground)"
                    : "var(--foreground)",
              }}
            >
              {stage.label}
            </span>
          </div>
        );
      })}
      <span
        className="ml-auto text-xs"
        style={{ color: "var(--muted-foreground)" }}
      >
        {isConnected ? "Live" : "Reconnecting…"}
      </span>
    </div>
  );
}
