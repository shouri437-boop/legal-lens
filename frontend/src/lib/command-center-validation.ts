// Command Center SSE Event Validation
// Ensures backend events match expected format for backwards compatibility

import type {
  CommandCenterSSEEvent,
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
  AgentType,
} from "@/types/command-center";

const VALID_AGENT_TYPES: AgentType[] = [
  "triage",
  "orchestrator",
  "legal",
  "evidence",
  "knowledge-graph",
  "synthesis",
];

/**
 * Validates that a value is a valid AgentType
 */
function isValidAgentType(value: unknown): value is AgentType {
  return (
    typeof value === "string" && VALID_AGENT_TYPES.includes(value as AgentType)
  );
}

/**
 * Alias map for backend agent keys that differ from the frontend AgentType names.
 * e.g. the backend sends "kg_builder" but the frontend uses "knowledge-graph".
 */
const AGENT_KEY_ALIASES: Record<string, AgentType> = {
  kg_builder: "knowledge-graph",
};

/**
 * Extracts the base AgentType from a compound agent ID (e.g. "legal_grp_0" → "financial").
 * Returns the AgentType directly if it is already a base type, or null if unrecognized.
 */
export function extractBaseAgentType(agentId: string): AgentType | null {
  // Direct match first
  if (VALID_AGENT_TYPES.includes(agentId as AgentType)) {
    return agentId as AgentType;
  }
  // Alias match (backend key → frontend AgentType)
  if (agentId in AGENT_KEY_ALIASES) {
    return AGENT_KEY_ALIASES[agentId];
  }
  // Prefix match: check if agentId starts with "<baseType>_"
  for (const baseType of VALID_AGENT_TYPES) {
    if (agentId.startsWith(baseType + "_")) {
      return baseType;
    }
  }
  return null;
}

/**
 * Validates that a value is a valid agent identifier — either a base AgentType
 * or a compound agent ID that resolves to one (e.g. "legal_grp_0").
 */
function isValidAgentId(value: unknown): boolean {
  return typeof value === "string" && extractBaseAgentType(value) !== null;
}

/**
 * Validates agent-started event
 */
function validateAgentStartedEvent(data: unknown): data is AgentStartedEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  return (
    event.type === "agent-started" &&
    isValidAgentId(event.agentType) &&
    typeof event.taskId === "string" &&
    typeof event.fileId === "string" &&
    typeof event.fileName === "string"
  );
}

/**
 * Validates agent-complete event
 */
function validateAgentCompleteEvent(data: unknown): data is AgentCompleteEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  if (
    event.type !== "agent-complete" ||
    !isValidAgentId(event.agentType) ||
    typeof event.taskId !== "string"
  ) {
    return false;
  }

  // Validate result object
  const result = event.result as Record<string, unknown>;
  if (typeof result !== "object" || result === null) return false;

  if (
    typeof result.taskId !== "string" ||
    !isValidAgentId(result.agentType) ||
    !Array.isArray(result.outputs)
  ) {
    return false;
  }

  // Validate outputs array
  for (const output of result.outputs) {
    if (
      typeof output !== "object" ||
      output === null ||
      typeof output.type !== "string"
    ) {
      return false;
    }

    // Confidence is optional but must be number if present
    if (
      output.confidence !== undefined &&
      (typeof output.confidence !== "number" ||
        output.confidence < 0 ||
        output.confidence > 1)
    ) {
      return false;
    }
  }

  // Validate optional routingDecisions
  if (result.routingDecisions !== undefined) {
    if (!Array.isArray(result.routingDecisions)) return false;

    for (const decision of result.routingDecisions) {
      if (
        typeof decision !== "object" ||
        decision === null ||
        typeof decision.fileId !== "string" ||
        !isValidAgentType(decision.targetAgent) ||
        typeof decision.reason !== "string" ||
        typeof decision.domainScore !== "number" ||
        decision.domainScore < 0 ||
        decision.domainScore > 100
      ) {
        return false;
      }
    }
  }

  // Validate optional toolsCalled
  if (result.toolsCalled !== undefined) {
    if (!Array.isArray(result.toolsCalled)) return false;
    for (const tool of result.toolsCalled) {
      if (typeof tool !== "string") return false;
    }
  }

  return true;
}

/**
 * Validates agent-error event
 */
function validateAgentErrorEvent(data: unknown): data is AgentErrorEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  return (
    event.type === "agent-error" &&
    isValidAgentId(event.agentType) &&
    typeof event.taskId === "string" &&
    typeof event.error === "string"
  );
}

/**
 * Validates processing-complete event
 */
function validateProcessingCompleteEvent(
  data: unknown,
): data is ProcessingCompleteEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  if (
    event.type !== "processing-complete" ||
    typeof event.caseId !== "string" ||
    typeof event.filesProcessed !== "number" ||
    typeof event.entitiesCreated !== "number" ||
    typeof event.relationshipsCreated !== "number"
  ) {
    return false;
  }

  // Optional aggregate fields must be numbers if present
  if (
    event.totalDurationMs !== undefined &&
    typeof event.totalDurationMs !== "number"
  )
    return false;
  if (
    event.totalInputTokens !== undefined &&
    typeof event.totalInputTokens !== "number"
  )
    return false;
  if (
    event.totalOutputTokens !== undefined &&
    typeof event.totalOutputTokens !== "number"
  )
    return false;

  return true;
}

/**
 * Validates thinking-update event
 */
function validateThinkingUpdateEvent(
  data: unknown,
): data is ThinkingUpdateEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  // timestamp is optional (present in ADK callbacks, may be absent in direct emissions)
  if (
    event.type !== "thinking-update" ||
    !isValidAgentId(event.agentType) ||
    typeof event.thought !== "string"
  ) {
    return false;
  }

  // Validate optional timestamp if present
  if (event.timestamp !== undefined && typeof event.timestamp !== "string") {
    return false;
  }

  return true;
}

/**
 * Validates the structure of agent data within a state snapshot.
 */
function validateAgentSnapshotData(
  agentData: unknown,
): agentData is { status: string; metadata?: Record<string, unknown> } {
  if (typeof agentData !== "object" || agentData === null) return false;

  const data = agentData as Record<string, unknown>;

  // status is required and must be a string
  if (typeof data.status !== "string") return false;

  // metadata is optional but must be an object if present
  if (data.metadata !== undefined) {
    if (typeof data.metadata !== "object" || data.metadata === null) {
      return false;
    }
    const meta = data.metadata as Record<string, unknown>;
    // Validate optional metadata fields have correct types
    if (meta.inputTokens !== undefined && typeof meta.inputTokens !== "number")
      return false;
    if (
      meta.outputTokens !== undefined &&
      typeof meta.outputTokens !== "number"
    )
      return false;
    if (meta.durationMs !== undefined && typeof meta.durationMs !== "number")
      return false;
    if (meta.startedAt !== undefined && typeof meta.startedAt !== "string")
      return false;
    if (meta.completedAt !== undefined && typeof meta.completedAt !== "string")
      return false;
    if (meta.model !== undefined && typeof meta.model !== "string")
      return false;
    if (
      meta.thinkingTraces !== undefined &&
      typeof meta.thinkingTraces !== "string"
    )
      return false;
  }

  return true;
}

/**
 * Validates state-snapshot event
 */
function validateStateSnapshotEvent(data: unknown): data is StateSnapshotEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  if (event.type !== "state-snapshot") return false;
  if (typeof event.agents !== "object" || event.agents === null) return false;

  // Validate each agent's data structure
  const agents = event.agents as Record<string, unknown>;
  for (const agentData of Object.values(agents)) {
    if (!validateAgentSnapshotData(agentData)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates confirmation-required event
 */
function validateConfirmationRequiredEvent(
  data: unknown,
): data is ConfirmationRequiredEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  // Required fields
  if (
    event.type !== "confirmation-required" ||
    typeof event.taskId !== "string" ||
    !isValidAgentType(event.agentType) ||
    typeof event.actionDescription !== "string"
  ) {
    return false;
  }

  // Optional affectedItems must be an array if present
  if (
    event.affectedItems !== undefined &&
    !Array.isArray(event.affectedItems)
  ) {
    return false;
  }

  // Optional context must be an object if present
  if (
    event.context !== undefined &&
    (typeof event.context !== "object" || event.context === null)
  ) {
    return false;
  }

  return true;
}

/**
 * Validates confirmation-resolved event
 */
function validateConfirmationResolvedEvent(
  data: unknown,
): data is ConfirmationResolvedEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  // Required fields: type, taskId, agentType, approved
  if (
    event.type !== "confirmation-resolved" ||
    typeof event.taskId !== "string" ||
    !isValidAgentType(event.agentType) ||
    typeof event.approved !== "boolean"
  ) {
    return false;
  }

  // Optional reason must be string if present
  if (event.reason !== undefined && typeof event.reason !== "string") {
    return false;
  }

  return true;
}

/**
 * Validates confirmation-batch-required event
 */
function validateConfirmationBatchRequiredEvent(
  data: unknown,
): data is ConfirmationBatchRequiredEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  if (
    event.type !== "confirmation-batch-required" ||
    !isValidAgentType(event.agentType) ||
    typeof event.batchId !== "string" ||
    !Array.isArray(event.items)
  ) {
    return false;
  }

  // Validate each batch item
  for (const item of event.items) {
    if (typeof item !== "object" || item === null) return false;
    const batchItem = item as Record<string, unknown>;
    if (
      typeof batchItem.item_id !== "string" ||
      typeof batchItem.action_description !== "string"
    ) {
      return false;
    }
    // Optional affected_items must be array if present
    if (
      batchItem.affected_items !== undefined &&
      !Array.isArray(batchItem.affected_items)
    ) {
      return false;
    }
    // Optional context must be object if present
    if (
      batchItem.context !== undefined &&
      (typeof batchItem.context !== "object" || batchItem.context === null)
    ) {
      return false;
    }
  }

  // Optional context must be object if present
  if (
    event.context !== undefined &&
    (typeof event.context !== "object" || event.context === null)
  ) {
    return false;
  }

  return true;
}

/**
 * Validates confirmation-batch-resolved event
 */
function validateConfirmationBatchResolvedEvent(
  data: unknown,
): data is ConfirmationBatchResolvedEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  return (
    event.type === "confirmation-batch-resolved" &&
    typeof event.batchId === "string" &&
    isValidAgentType(event.agentType) &&
    typeof event.resolvedCount === "number"
  );
}

/**
 * Validates synthesis-data-ready event
 */
function validateSynthesisDataReadyEvent(
  data: unknown,
): data is SynthesisDataReadyEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  return (
    event.type === "synthesis-data-ready" &&
    typeof event.caseId === "string" &&
    typeof event.counts === "object" &&
    event.counts !== null
  );
}

/**
 * Validates tool-called event
 */
function validateToolCalledEvent(data: unknown): data is ToolCalledEvent {
  if (typeof data !== "object" || data === null) return false;

  const event = data as Record<string, unknown>;

  return (
    event.type === "tool-called" &&
    isValidAgentId(event.agentType) &&
    typeof event.toolName === "string" &&
    typeof event.timestamp === "string"
  );
}

/**
 * Validates any Command Center SSE event
 * Returns the validated event or null if invalid
 */
export function validateCommandCenterEvent(
  data: unknown,
): CommandCenterSSEEvent | null {
  if (typeof data !== "object" || data === null) {
    console.warn("Invalid SSE event: not an object", data);
    return null;
  }

  const event = data as Record<string, unknown>;

  switch (event.type) {
    case "agent-started":
      if (validateAgentStartedEvent(data)) {
        return data as AgentStartedEvent;
      }
      console.warn("Invalid agent-started event", data);
      return null;

    case "agent-complete":
      if (validateAgentCompleteEvent(data)) {
        return data as AgentCompleteEvent;
      }
      console.warn("Invalid agent-complete event", data);
      return null;

    case "agent-error":
      if (validateAgentErrorEvent(data)) {
        return data as AgentErrorEvent;
      }
      console.warn("Invalid agent-error event", data);
      return null;

    case "processing-complete":
      if (validateProcessingCompleteEvent(data)) {
        return data as ProcessingCompleteEvent;
      }
      console.warn("Invalid processing-complete event", data);
      return null;

    case "thinking-update":
      if (validateThinkingUpdateEvent(data)) {
        return data as ThinkingUpdateEvent;
      }
      console.warn("Invalid thinking-update event", data);
      return null;

    case "state-snapshot":
      if (validateStateSnapshotEvent(data)) {
        return data as StateSnapshotEvent;
      }
      console.warn("Invalid state-snapshot event", data);
      return null;

    case "confirmation-required":
      if (validateConfirmationRequiredEvent(data)) {
        return data as ConfirmationRequiredEvent;
      }
      console.warn("Invalid confirmation-required event", data);
      return null;

    case "confirmation-resolved":
      if (validateConfirmationResolvedEvent(data)) {
        return data as ConfirmationResolvedEvent;
      }
      console.warn("Invalid confirmation-resolved event", data);
      return null;

    case "confirmation-batch-required":
      if (validateConfirmationBatchRequiredEvent(data)) {
        return data as ConfirmationBatchRequiredEvent;
      }
      console.warn("Invalid confirmation-batch-required event", data);
      return null;

    case "confirmation-batch-resolved":
      if (validateConfirmationBatchResolvedEvent(data)) {
        return data as ConfirmationBatchResolvedEvent;
      }
      console.warn("Invalid confirmation-batch-resolved event", data);
      return null;

    case "tool-called":
      if (validateToolCalledEvent(data)) {
        return data as ToolCalledEvent;
      }
      console.warn("Invalid tool-called event", data);
      return null;

    case "synthesis-data-ready":
      if (validateSynthesisDataReadyEvent(data)) {
        return data as SynthesisDataReadyEvent;
      }
      console.warn("Invalid synthesis-data-ready event", data);
      return null;

    default:
      console.warn("Unknown event type", event.type);
      return null;
  }
}

/**
 * Safely parse SSE event data
 */
export function parseSSEEventData(
  eventData: string,
): CommandCenterSSEEvent | null {
  try {
    const parsed = JSON.parse(eventData);
    return validateCommandCenterEvent(parsed);
  } catch (error) {
    console.error("Failed to parse SSE event data", error);
    return null;
  }
}
