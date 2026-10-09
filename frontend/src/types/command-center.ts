// Command Center Types - Agent Processing Visualization

export type AgentType =
  | "triage"
  | "orchestrator"
  | "legal"
  | "evidence"
  | "knowledge-graph"
  | "synthesis";

export type AgentStatus = "idle" | "processing" | "complete" | "error";

export interface AgentTask {
  taskId: string;
  fileId: string;
  fileName: string;
  startedAt: Date;
  completedAt?: Date;
  status: "processing" | "complete" | "error";
  error?: string;
}

export interface AgentOutput {
  type: string;
  data: unknown;
  confidence?: number;
}

export interface RoutingDecision {
  fileId: string;
  fileName?: string;
  targetAgent: AgentType;
  reason: string;
  domainScore: number; // Confidence score 0-100 (percentage)
  /** Routing priority assigned by the orchestrator. */
  priority?: "high" | "medium" | "low";
  /** Overall routing confidence (0-100). Low values may trigger HITL review. */
  routingConfidence?: number | null;
}

export interface AgentResult {
  taskId: string;
  agentType: string;
  outputs: AgentOutput[];
  routingDecisions?: RoutingDecision[];
  toolsCalled?: string[];
  metadata?: Record<string, unknown>;
  /** Resolved base agent type (e.g. "financial" from "legal_grp_0") */
  baseAgentType?: string;
  /** Descriptive label for the compound agent group */
  groupLabel?: string;
  /** Original filenames processed by this agent instance */
  fileNames?: string[];
}

export interface AgentState {
  /**
   * Instance identifier. Equals the base `AgentType` for singletons (e.g. "triage"),
   * or a compound ID for multi-instance agents (e.g. "legal_grp_0").
   */
  id: string;
  /** Base agent type — always a valid `AgentType`. Used for color/config lookups and topology resolution. */
  type: AgentType;
  status: AgentStatus;
  currentTask?: AgentTask;
  lastResult?: AgentResult;
  processingHistory: AgentTask[];
}

export interface AgentConnection {
  id: string;
  source: AgentType;
  target: AgentType;
  animated: boolean;
  metadata?: {
    routingDecisions?: RoutingDecision[];
    fileGroupings?: unknown[];
  };
}

// SSE Event Types
// Lifecycle events use `string` for agentType because the backend sends
// compound agent IDs (e.g. "legal_grp_0"). Confirmation events keep
// `AgentType` since the backend sends base types for those.
export interface AgentStartedEvent {
  type: "agent-started";
  agentType: string;
  taskId: string;
  fileId: string;
  fileName: string;
}

export interface AgentCompleteEvent {
  type: "agent-complete";
  agentType: string;
  taskId: string;
  result: AgentResult;
}

export interface AgentErrorEvent {
  type: "agent-error";
  agentType: string;
  taskId: string;
  error: string;
}

export interface ProcessingCompleteEvent {
  type: "processing-complete";
  caseId: string;
  filesProcessed: number;
  entitiesCreated: number;
  relationshipsCreated: number;
  totalDurationMs?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
}

export interface ThinkingUpdateEvent {
  type: "thinking-update";
  agentType: string;
  thought: string;
  timestamp?: string; // Optional: present in ADK callback events, may be absent in direct emissions
  tokenDelta?: {
    inputTokens: number;
    outputTokens: number;
    thoughtsTokens: number;
  };
}

export interface StateSnapshotEvent {
  type: "state-snapshot";
  agents: Record<
    string,
    {
      status: string;
      metadata?: {
        inputTokens?: number;
        outputTokens?: number;
        durationMs?: number;
        startedAt?: string;
        completedAt?: string;
        model?: string;
        thinkingTraces?: string;
      };
      lastResult?: AgentResult;
    }
  >;
}

export interface ConfirmationRequiredEvent {
  type: "confirmation-required";
  taskId: string;
  agentType: AgentType;
  actionDescription: string;
  affectedItems?: string[]; // Optional: may not be sent by backend
  context?: Record<string, unknown>; // Optional: backend sends when available
}

export interface ConfirmationResolvedEvent {
  type: "confirmation-resolved";
  taskId: string;
  agentType: AgentType;
  approved: boolean;
  reason?: string;
}

export interface ToolCalledEvent {
  type: "tool-called";
  agentType: string;
  toolName: string;
  timestamp: string;
}

export interface ConfirmationBatchItem {
  item_id: string;
  action_description: string;
  affected_items?: string[];
  context?: Record<string, unknown>;
}

export interface ConfirmationBatchRequiredEvent {
  type: "confirmation-batch-required";
  agentType: AgentType;
  batchId: string;
  items: ConfirmationBatchItem[];
  context?: Record<string, unknown>;
}

export interface ConfirmationBatchResolvedEvent {
  type: "confirmation-batch-resolved";
  batchId: string;
  agentType: AgentType;
  resolvedCount: number;
}

/** Emitted once after the Synthesis Agent writes all outputs to DB. */
export interface SynthesisDataReadyEvent {
  type: "synthesis-data-ready";
  caseId: string;
  counts: Record<string, number>;
}

export type CommandCenterSSEEvent =
  | AgentStartedEvent
  | AgentCompleteEvent
  | AgentErrorEvent
  | ProcessingCompleteEvent
  | ThinkingUpdateEvent
  | StateSnapshotEvent
  | ConfirmationRequiredEvent
  | ConfirmationResolvedEvent
  | ConfirmationBatchRequiredEvent
  | ConfirmationBatchResolvedEvent
  | ToolCalledEvent
  | SynthesisDataReadyEvent;

// Agent Configuration
export interface AgentConfig {
  type: AgentType;
  name: string;
  description: string;
  color: string;
  position: { x: number; y: number };
}

export interface ProcessingSummary {
  filesProcessed: number;
  entitiesCreated: number;
  relationshipsCreated: number;
  completedAt: Date;
  totalDurationMs?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
}
