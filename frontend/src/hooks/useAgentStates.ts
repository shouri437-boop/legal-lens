// ABOUTME: Custom hook managing agent state lifecycle for the Command Center.
// ABOUTME: Handles SSE event processing, state transitions, and instance-keyed agent tracking.

import { useState, useCallback, useEffect } from "react";

import { useCommandCenterSSE } from "@/hooks/useCommandCenterSSE";
import {
  clearCachedAgentStates,
  deserializeCachedTask,
  isValidCachedEntry,
  loadCachedAgentStates,
  persistAgentStates,
} from "@/lib/agent-state-cache";
import { onAnalysisReset } from "@/lib/case-events";
import { AGENT_CONFIGS } from "@/lib/command-center-config";
import { extractBaseAgentType } from "@/lib/command-center-validation";
import type {
  AgentResult,
  AgentState,
  AgentStatus,
  AgentType,
  CommandCenterSSEEvent,
  ProcessingSummary,
  AgentStartedEvent,
  AgentCompleteEvent,
  AgentErrorEvent,
  ProcessingCompleteEvent,
  ThinkingUpdateEvent,
  StateSnapshotEvent,
  ConfirmationRequiredEvent,
  ConfirmationResolvedEvent,
  ConfirmationBatchRequiredEvent,
  ConfirmationBatchResolvedEvent,
  ToolCalledEvent,
  SynthesisDataReadyEvent,
} from "@/types/command-center";

/** Maximum number of completed tasks retained in processingHistory per agent instance. */
const MAX_PROCESSING_HISTORY = 5;

/**
 * Resolves the map key for an instance ID. For singletons (instanceId === baseType),
 * falls back to baseType if instanceId is not found. For compound instances, only
 * matches by exact instanceId to prevent cross-instance state corruption.
 */
function resolveInstanceKey(
  map: Map<string, AgentState>,
  instanceId: string,
  baseType: string,
): string | null {
  if (map.has(instanceId)) return instanceId;
  // Only fall back to baseType for singletons
  if (instanceId === baseType && map.has(baseType)) return baseType;
  return null;
}

/**
 * Maps backend execution status strings to frontend AgentStatus values.
 * Backend sends lowercased enum values: pending, running, completed, failed.
 */
function mapSnapshotStatus(backendStatus: string): AgentStatus {
  switch (backendStatus) {
    case "running":
      return "processing";
    case "completed":
      return "complete";
    case "failed":
      return "error";
    case "pending":
    default:
      return "idle";
  }
}

/**
 * Creates skeleton agent states keyed by base type.
 * These are placeholders for progressive reveal; compound instances
 * replace their base-type skeleton when they start.
 */
function createInitialStates(): Map<string, AgentState> {
  const states = new Map<string, AgentState>();
  for (const type of Object.keys(AGENT_CONFIGS)) {
    const agentType = type as AgentType;
    states.set(agentType, {
      id: agentType,
      type: agentType,
      status: "idle",
      processingHistory: [],
    });
  }
  return states;
}

/**
 * Merges an incoming AgentResult with the existing accumulated state.
 * Backend values are authoritative for tokens, duration, model, and outputs.
 * For thinkingTraces and toolsCalled, prefers backend if non-empty,
 * otherwise falls back to frontend-accumulated values.
 */
function mergeAgentResult(
  incoming: AgentResult,
  existing: AgentResult | undefined,
): AgentResult {
  const incomingTraces = incoming.metadata?.thinkingTraces;
  const existingTraces = existing?.metadata?.thinkingTraces;

  return {
    ...incoming,
    metadata: {
      ...(incoming.metadata || {}),
      thinkingTraces:
        (typeof incomingTraces === "string" && incomingTraces) ||
        (typeof existingTraces === "string" && existingTraces) ||
        "",
    },
    toolsCalled: incoming.toolsCalled ?? existing?.toolsCalled,
  };
}

export interface UseAgentStatesReturn {
  agentStates: Map<string, AgentState>;
  lastProcessingSummary: ProcessingSummary | null;
  pendingConfirmations: ConfirmationRequiredEvent[];
  pendingBatchConfirmations: ConfirmationBatchRequiredEvent[];
  removePendingConfirmation: (taskId: string) => void;
  removePendingBatchConfirmation: (batchId: string) => void;
  /** True when the synthesis agent has completed and all synthesis data is available. */
  synthesisReady: boolean;
  isConnected: boolean;
  isReconnecting: boolean;
}

/**
 * Manages the full agent state lifecycle with instance-level granularity:
 * - Initializes idle skeletons for all configured agent types
 * - Processes SSE events (started, complete, error, processing-complete)
 * - Handles thinking-update events by appending traces to agent state
 * - Handles state-snapshot events for reconnection state restoration
 * - Each agent instance (e.g. "legal_grp_0") gets its own state entry
 * - Tracks pending HITL confirmation requests (single and batch)
 */
export function useAgentStates(caseId: string): UseAgentStatesReturn {
  const [agentStates, setAgentStates] =
    useState<Map<string, AgentState>>(createInitialStates);
  const [lastProcessingSummary, setLastProcessingSummary] =
    useState<ProcessingSummary | null>(null);
  const [pendingConfirmations, setPendingConfirmations] = useState<
    ConfirmationRequiredEvent[]
  >([]);
  const [pendingBatchConfirmations, setPendingBatchConfirmations] = useState<
    ConfirmationBatchRequiredEvent[]
  >([]);
  const [synthesisReady, setSynthesisReady] = useState(false);

  // Persist agent states to sessionStorage on every state change.
  // Bridges the gap for agents whose execution records haven't been
  // committed to the DB yet — the cache supplements the backend snapshot.
  useEffect(() => {
    persistAgentStates(caseId, agentStates);
  }, [caseId, agentStates]);

  // Clears all accumulated state back to initial values. Called when a new
  // analysis workflow starts so previous results don't bleed into the new run.
  const resetState = useCallback(() => {
    clearCachedAgentStates(caseId);
    setAgentStates(createInitialStates());
    setLastProcessingSummary(null);
    setPendingConfirmations([]);
    setPendingBatchConfirmations([]);
    setSynthesisReady(false);
  }, [caseId]);

  // Listen for analysis-reset events from the AnalysisTrigger component
  useEffect(() => {
    return onAnalysisReset(resetState);
  }, [resetState]);

  // ------- SSE event handlers -------

  const handleAgentStarted = useCallback((event: CommandCenterSSEEvent) => {
    const e = event as AgentStartedEvent;
    const instanceId = e.agentType;
    const baseType = extractBaseAgentType(instanceId);
    if (!baseType) return;

    setAgentStates((prev) => {
      const next = new Map(prev);

      if (instanceId === baseType) {
        // Singleton: update existing skeleton in place
        const state = next.get(baseType);
        if (state) {
          next.set(baseType, {
            ...state,
            status: "processing",
            currentTask: {
              taskId: e.taskId,
              fileId: e.fileId,
              fileName: e.fileName,
              startedAt: new Date(),
              status: "processing",
            },
          });
        }
      } else {
        // Compound instance: remove idle skeleton for baseType, add instance entry
        const skeleton = next.get(baseType);
        if (skeleton && skeleton.status === "idle" && !skeleton.lastResult) {
          next.delete(baseType);
        }
        next.set(instanceId, {
          id: instanceId,
          type: baseType,
          status: "processing",
          currentTask: {
            taskId: e.taskId,
            fileId: e.fileId,
            fileName: e.fileName,
            startedAt: new Date(),
            status: "processing",
          },
          processingHistory: [],
        });
      }

      return next;
    });
  }, []);

  const handleAgentComplete = useCallback((event: CommandCenterSSEEvent) => {
    const e = event as AgentCompleteEvent;
    const instanceId = e.agentType;
    const baseType = extractBaseAgentType(instanceId);
    if (!baseType) return;

    setAgentStates((prev) => {
      const next = new Map(prev);
      const resolvedKey = resolveInstanceKey(next, instanceId, baseType);
      if (!resolvedKey) return prev; // Unknown instance — silently ignore
      const state = next.get(resolvedKey)!;

      // Build completedTask for processingHistory only when currentTask
      // is available (may be absent after snapshot restoration).
      const completedTask = state.currentTask
        ? {
            ...state.currentTask,
            completedAt: new Date(),
            status: "complete" as const,
          }
        : null;
      const updatedHistory = completedTask
        ? [completedTask, ...state.processingHistory].slice(
            0,
            MAX_PROCESSING_HISTORY,
          )
        : state.processingHistory;

      next.set(resolvedKey, {
        ...state,
        status: "idle",
        currentTask: undefined,
        lastResult: mergeAgentResult(e.result, state.lastResult),
        processingHistory: updatedHistory,
      });
      return next;
    });
  }, []);

  const handleAgentError = useCallback((event: CommandCenterSSEEvent) => {
    const e = event as AgentErrorEvent;
    const instanceId = e.agentType;
    const baseType = extractBaseAgentType(instanceId);
    if (!baseType) return;

    setAgentStates((prev) => {
      const next = new Map(prev);
      const resolvedKey = resolveInstanceKey(next, instanceId, baseType);
      if (!resolvedKey) return prev; // Unknown instance — silently ignore
      const state = next.get(resolvedKey)!;

      // Build errorTask for processingHistory only when currentTask
      // is available (may be absent after snapshot restoration).
      const errorTask = state.currentTask
        ? {
            ...state.currentTask,
            completedAt: new Date(),
            status: "error" as const,
            error: e.error,
          }
        : null;
      const updatedHistory = errorTask
        ? [errorTask, ...state.processingHistory].slice(
            0,
            MAX_PROCESSING_HISTORY,
          )
        : state.processingHistory;

      next.set(resolvedKey, {
        ...state,
        status: "error",
        currentTask: undefined,
        processingHistory: updatedHistory,
      });
      return next;
    });
  }, []);

  const handleProcessingComplete = useCallback(
    (event: CommandCenterSSEEvent) => {
      const e = event as ProcessingCompleteEvent;
      setLastProcessingSummary({
        filesProcessed: e.filesProcessed,
        entitiesCreated: e.entitiesCreated,
        relationshipsCreated: e.relationshipsCreated,
        completedAt: new Date(),
        totalDurationMs: e.totalDurationMs,
        totalInputTokens: e.totalInputTokens,
        totalOutputTokens: e.totalOutputTokens,
      });

      // Pipeline is done — clear cached states
      clearCachedAgentStates(caseId);

      // Transition any agents still stuck in "processing" to "idle".
      // This handles cases where an agent-complete/agent-error event was
      // lost or never emitted (e.g., BaseException in domain_runner).
      setAgentStates((prev) => {
        const next = new Map(prev);
        for (const [key, state] of next) {
          if (state.status === "processing") {
            next.set(key, {
              ...state,
              status: "idle",
              currentTask: undefined,
            });
          }
        }
        return next;
      });
    },
    [caseId],
  );

  const handleThinkingUpdate = useCallback((event: CommandCenterSSEEvent) => {
    const e = event as ThinkingUpdateEvent;
    const instanceId = e.agentType;
    const baseType = extractBaseAgentType(instanceId);
    if (!baseType) return;

    setAgentStates((prev) => {
      const next = new Map(prev);
      const resolvedKey = resolveInstanceKey(next, instanceId, baseType);
      if (!resolvedKey) return prev;
      const state = next.get(resolvedKey)!;

      // Validate existing traces is actually a string before concatenation
      const rawTraces = state.lastResult?.metadata?.thinkingTraces;
      const existingTraces = typeof rawTraces === "string" ? rawTraces : "";
      let updatedTraces = existingTraces
        ? existingTraces + "\n" + e.thought
        : e.thought;
      // Limit trace length to prevent unbounded memory growth (100KB max)
      const MAX_TRACES_LENGTH = 100_000;
      if (updatedTraces.length > MAX_TRACES_LENGTH) {
        updatedTraces = updatedTraces.slice(-MAX_TRACES_LENGTH);
      }
      next.set(resolvedKey, {
        ...state,
        lastResult: {
          ...(state.lastResult || {
            taskId: "",
            agentType: baseType,
            outputs: [],
          }),
          metadata: {
            ...(state.lastResult?.metadata || {}),
            thinkingTraces: updatedTraces,
          },
        },
      });
      return next;
    });
  }, []);

  const handleStateSnapshot = useCallback(
    (event: CommandCenterSSEEvent) => {
      const e = event as StateSnapshotEvent;

      // Load cached states to supplement the snapshot for agents whose
      // execution records haven't been committed to the DB yet.
      const cached = loadCachedAgentStates(caseId);

      setAgentStates((prev) => {
        // Start from fresh initial states so agents NOT present in the
        // snapshot revert to idle (authoritative).
        const next = createInitialStates();

        // Track which base types have compound instances so we can remove
        // their skeletons after processing all snapshot entries.
        const baseTypesWithCompoundInstances = new Set<string>();

        for (const [agentName, agentData] of Object.entries(e.agents)) {
          // Validate agentData structure before using it
          if (
            typeof agentData !== "object" ||
            agentData === null ||
            typeof agentData.status !== "string"
          ) {
            console.warn(`Invalid agentData for ${agentName}, skipping`);
            continue;
          }

          // Resolve compound agent IDs to their base type
          const baseType = extractBaseAgentType(agentName);
          if (!baseType) {
            console.warn(
              `Unrecognized agent key in snapshot: ${agentName}, skipping`,
            );
            continue;
          }

          const isCompound = agentName !== baseType;
          if (isCompound) {
            baseTypesWithCompoundInstances.add(baseType);
          }

          const frontendStatus = mapSnapshotStatus(agentData.status);
          // Safely extract metadata with type checks
          const meta = agentData.metadata;
          const validatedMetadata =
            meta && typeof meta === "object"
              ? {
                  inputTokens:
                    typeof meta.inputTokens === "number"
                      ? meta.inputTokens
                      : undefined,
                  outputTokens:
                    typeof meta.outputTokens === "number"
                      ? meta.outputTokens
                      : undefined,
                  durationMs:
                    typeof meta.durationMs === "number"
                      ? meta.durationMs
                      : undefined,
                  startedAt:
                    typeof meta.startedAt === "string"
                      ? meta.startedAt
                      : undefined,
                  completedAt:
                    typeof meta.completedAt === "string"
                      ? meta.completedAt
                      : undefined,
                  model:
                    typeof meta.model === "string" ? meta.model : undefined,
                  thinkingTraces:
                    typeof meta.thinkingTraces === "string"
                      ? meta.thinkingTraces
                      : undefined,
                }
              : undefined;

          // Build the snapshot lastResult, always injecting validatedMetadata
          // so thinking traces from the execution-level metadata are never lost.
          const snapshotResult: AgentResult = agentData.lastResult
            ? {
                ...(agentData.lastResult as AgentResult),
                metadata: {
                  ...(agentData.lastResult as AgentResult).metadata,
                  ...validatedMetadata,
                },
              }
            : {
                taskId: "",
                agentType: baseType,
                outputs: [],
                metadata: validatedMetadata,
              };

          // Synthesize a currentTask for processing agents so the sidebar
          // shows task info and subsequent agent-complete events can produce
          // proper processingHistory entries (avoids the currentTask guard).
          const syntheticTask =
            frontendStatus === "processing"
              ? {
                  taskId: "",
                  fileId: "",
                  fileName: agentName,
                  startedAt:
                    typeof meta?.startedAt === "string"
                      ? new Date(meta.startedAt)
                      : new Date(),
                  status: "processing" as const,
                }
              : undefined;

          // Preserve processingHistory and lastResult from the same instance's
          // previous state. For compound instances, only match by exact ID to
          // avoid grafting history from a different instance or skeleton.
          const prevState = isCompound
            ? prev.get(agentName)
            : (prev.get(baseType) ?? prev.get(agentName));

          if (isCompound) {
            // Compound instance: add as its own entry
            next.set(agentName, {
              id: agentName,
              type: baseType,
              status: frontendStatus,
              currentTask: syntheticTask,
              processingHistory: prevState?.processingHistory ?? [],
              lastResult: mergeAgentResult(
                snapshotResult,
                prevState?.lastResult,
              ),
            });
          } else {
            // Singleton: update the skeleton in place
            const freshState = next.get(baseType);
            if (freshState) {
              next.set(baseType, {
                ...freshState,
                status: frontendStatus,
                currentTask: syntheticTask,
                processingHistory: prevState?.processingHistory ?? [],
                lastResult: mergeAgentResult(
                  snapshotResult,
                  prevState?.lastResult,
                ),
              });
            }
          }
        }

        // Remove skeletons for base types that have compound instances
        for (const baseType of baseTypesWithCompoundInstances) {
          const skeleton = next.get(baseType);
          if (skeleton && skeleton.status === "idle" && !skeleton.lastResult) {
            next.delete(baseType);
          }
        }

        // Supplement snapshot with cached processing states for agents whose
        // execution records haven't been committed yet (the visibility gap).
        // Only instance IDs NOT already in the map are eligible.
        if (cached) {
          // Collect all instance IDs present in the snapshot
          const snapshotInstanceIds = new Set<string>();
          for (const agentName of Object.keys(e.agents)) {
            snapshotInstanceIds.add(agentName);
          }

          for (const [instanceId, entry] of Object.entries(cached.agents)) {
            // Validate entry shape to guard against corrupted sessionStorage
            if (!isValidCachedEntry(entry)) continue;
            if (entry.status !== "processing") continue;
            if (snapshotInstanceIds.has(instanceId)) continue;
            // Skip if this instance already exists in next (from snapshot)
            if (next.has(instanceId)) continue;

            const baseType = extractBaseAgentType(instanceId);
            if (!baseType) continue;

            if (instanceId === baseType) {
              // Singleton cached entry: update skeleton if still idle
              const currentState = next.get(baseType);
              if (currentState && currentState.status === "idle") {
                next.set(baseType, {
                  ...currentState,
                  status: "processing",
                  currentTask: entry.currentTask
                    ? deserializeCachedTask(entry.currentTask)
                    : undefined,
                });
              }
            } else {
              // Compound cached entry: add as its own instance
              baseTypesWithCompoundInstances.add(baseType);
              next.set(instanceId, {
                id: instanceId,
                type: baseType,
                status: "processing",
                currentTask: entry.currentTask
                  ? deserializeCachedTask(entry.currentTask)
                  : undefined,
                processingHistory: [],
              });
              // Remove skeleton for this base type if it's still idle
              const skeleton = next.get(baseType);
              if (
                skeleton &&
                skeleton.status === "idle" &&
                !skeleton.lastResult
              ) {
                next.delete(baseType);
              }
            }
          }
        }

        return next;
      });

      // Detect synthesis completion from the snapshot. If the synthesis agent
      // has a "completed" status, mark synthesisReady so the Verdict tab
      // activates on reconnect / initial page load.
      for (const [agentName, agentData] of Object.entries(e.agents)) {
        if (
          agentName === "synthesis" &&
          typeof agentData === "object" &&
          agentData !== null &&
          agentData.status === "completed"
        ) {
          setSynthesisReady(true);
          break;
        }
      }
    },
    [caseId],
  );

  const handleConfirmationRequired = useCallback(
    (event: CommandCenterSSEEvent) => {
      const e = event as ConfirmationRequiredEvent;
      setPendingConfirmations((prev) => [...prev, e]);
    },
    [],
  );

  const handleConfirmationResolved = useCallback(
    (event: CommandCenterSSEEvent) => {
      const e = event as ConfirmationResolvedEvent;
      setPendingConfirmations((prev) =>
        prev.filter((c) => c.taskId !== e.taskId),
      );
    },
    [],
  );

  const handleConfirmationBatchRequired = useCallback(
    (event: CommandCenterSSEEvent) => {
      const e = event as ConfirmationBatchRequiredEvent;
      setPendingBatchConfirmations((prev) => [...prev, e]);
    },
    [],
  );

  const handleConfirmationBatchResolved = useCallback(
    (event: CommandCenterSSEEvent) => {
      const e = event as ConfirmationBatchResolvedEvent;
      setPendingBatchConfirmations((prev) =>
        prev.filter((c) => c.batchId !== e.batchId),
      );
    },
    [],
  );

  // Optimistic removal functions for immediate UI feedback before SSE round-trip
  const removePendingConfirmation = useCallback((taskId: string) => {
    setPendingConfirmations((prev) => prev.filter((c) => c.taskId !== taskId));
  }, []);

  const removePendingBatchConfirmation = useCallback((batchId: string) => {
    setPendingBatchConfirmations((prev) =>
      prev.filter((c) => c.batchId !== batchId),
    );
  }, []);

  const handleSynthesisDataReady = useCallback(
    (_event: CommandCenterSSEEvent) => {
      const _e = _event as SynthesisDataReadyEvent;
      void _e; // counts available if needed in future
      setSynthesisReady(true);
    },
    [],
  );

  const handleToolCalled = useCallback((event: CommandCenterSSEEvent) => {
    const e = event as ToolCalledEvent;
    const instanceId = e.agentType;
    const baseType = extractBaseAgentType(instanceId);
    if (!baseType) return;

    setAgentStates((prev) => {
      const next = new Map(prev);
      const resolvedKey = resolveInstanceKey(next, instanceId, baseType);
      if (!resolvedKey) return prev;
      const state = next.get(resolvedKey)!;

      // Add tool to the list of tools called for this agent
      const existingTools = state.lastResult?.toolsCalled || [];
      // Avoid duplicates and limit to 20 most recent tools
      const MAX_TOOLS_TRACKED = 20;
      const updatedTools = existingTools.includes(e.toolName)
        ? existingTools
        : [...existingTools, e.toolName].slice(-MAX_TOOLS_TRACKED);

      next.set(resolvedKey, {
        ...state,
        lastResult: {
          ...(state.lastResult || {
            taskId: "",
            agentType: baseType,
            outputs: [],
          }),
          toolsCalled: updatedTools,
        },
      });
      return next;
    });
  }, []);

  // ------- SSE connection -------

  const { isConnected, isReconnecting } = useCommandCenterSSE(caseId, {
    enabled: true,
    onAgentStarted: handleAgentStarted,
    onAgentComplete: handleAgentComplete,
    onAgentError: handleAgentError,
    onProcessingComplete: handleProcessingComplete,
    onThinkingUpdate: handleThinkingUpdate,
    onStateSnapshot: handleStateSnapshot,
    onConfirmationRequired: handleConfirmationRequired,
    onConfirmationResolved: handleConfirmationResolved,
    onConfirmationBatchRequired: handleConfirmationBatchRequired,
    onConfirmationBatchResolved: handleConfirmationBatchResolved,
    onToolCalled: handleToolCalled,
    onSynthesisDataReady: handleSynthesisDataReady,
  });

  return {
    agentStates,
    lastProcessingSummary,
    pendingConfirmations,
    pendingBatchConfirmations,
    removePendingConfirmation,
    removePendingBatchConfirmation,
    synthesisReady,
    isConnected,
    isReconnecting,
  };
}
