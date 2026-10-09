import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import type { CommandCenterSSEEvent } from "@/types/command-center";
import { parseSSEEventData } from "@/lib/command-center-validation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/** SSE event types that the Command Center handles */
type SSEEventType =
  | "agent-started"
  | "agent-complete"
  | "agent-error"
  | "processing-complete"
  | "thinking-update"
  | "state-snapshot"
  | "confirmation-required"
  | "confirmation-resolved"
  | "confirmation-batch-required"
  | "confirmation-batch-resolved"
  | "tool-called"
  | "synthesis-data-ready";

interface UseCommandCenterSSEOptions {
  enabled?: boolean;
  onAgentStarted?: (event: CommandCenterSSEEvent) => void;
  onAgentComplete?: (event: CommandCenterSSEEvent) => void;
  onAgentError?: (event: CommandCenterSSEEvent) => void;
  onProcessingComplete?: (event: CommandCenterSSEEvent) => void;
  onThinkingUpdate?: (event: CommandCenterSSEEvent) => void;
  onStateSnapshot?: (event: CommandCenterSSEEvent) => void;
  onConfirmationRequired?: (event: CommandCenterSSEEvent) => void;
  onConfirmationResolved?: (event: CommandCenterSSEEvent) => void;
  onConfirmationBatchRequired?: (event: CommandCenterSSEEvent) => void;
  onConfirmationBatchResolved?: (event: CommandCenterSSEEvent) => void;
  onToolCalled?: (event: CommandCenterSSEEvent) => void;
  onSynthesisDataReady?: (event: CommandCenterSSEEvent) => void;
}

export function useCommandCenterSSE(
  caseId: string,
  options: UseCommandCenterSSEOptions,
) {
  const {
    enabled = true,
    onAgentStarted,
    onAgentComplete,
    onAgentError,
    onProcessingComplete,
    onThinkingUpdate,
    onStateSnapshot,
    onConfirmationRequired,
    onConfirmationResolved,
    onConfirmationBatchRequired,
    onConfirmationBatchResolved,
    onToolCalled,
    onSynthesisDataReady,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 2000;

  // Map event types to their handlers for DRY event listener registration
  const eventHandlers = useMemo(
    () =>
      ({
        "agent-started": onAgentStarted,
        "agent-complete": onAgentComplete,
        "agent-error": onAgentError,
        "processing-complete": onProcessingComplete,
        "thinking-update": onThinkingUpdate,
        "state-snapshot": onStateSnapshot,
        "confirmation-required": onConfirmationRequired,
        "confirmation-resolved": onConfirmationResolved,
        "confirmation-batch-required": onConfirmationBatchRequired,
        "confirmation-batch-resolved": onConfirmationBatchResolved,
        "tool-called": onToolCalled,
        "synthesis-data-ready": onSynthesisDataReady,
      }) as Record<
        SSEEventType,
        ((event: CommandCenterSSEEvent) => void) | undefined
      >,
    [
      onAgentStarted,
      onAgentComplete,
      onAgentError,
      onProcessingComplete,
      onThinkingUpdate,
      onStateSnapshot,
      onConfirmationRequired,
      onConfirmationResolved,
      onConfirmationBatchRequired,
      onConfirmationBatchResolved,
      onToolCalled,
      onSynthesisDataReady,
    ],
  );

  const setupConnection = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    try {
      const sseUrl = `${API_URL}/sse/cases/${caseId}/command-center/stream`;
      const eventSource = new EventSource(sseUrl);

      // Register all event handlers using map iteration (DRY)
      for (const [eventType, handler] of Object.entries(eventHandlers)) {
        if (handler) {
          eventSource.addEventListener(eventType, (e: MessageEvent) => {
            const event = parseSSEEventData(e.data);
            if (event && event.type === eventType) {
              handler(event);
            }
          });
        }
      }

      eventSource.onerror = () => {
        // Silently handle connection errors when endpoint doesn't exist yet
        // This is expected in demo mode before backend is implemented
        eventSource.close();
        eventSourceRef.current = null;
        setIsConnected(false);

        // Don't attempt reconnection if we've already tried multiple times
        // This prevents console spam when endpoint doesn't exist
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          setIsReconnecting(true);
          reconnectAttemptsRef.current += 1;
          const delay =
            RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1);

          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current();
          }, delay);
        } else {
          setIsReconnecting(false);
          // Don't call onError for expected failures (endpoint not implemented)
          // onError?.(new Error("Max SSE reconnection attempts reached"));
        }
      };

      eventSource.onopen = () => {
        console.log("Command Center SSE connection established");
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
        setIsReconnecting(false);
      };

      eventSourceRef.current = eventSource;
    } catch {
      // Silently handle connection errors in demo mode
      console.debug("Command Center SSE not available (expected in demo mode)");
    }
  }, [enabled, caseId, eventHandlers]);

  useEffect(() => {
    connectRef.current = setupConnection;
  }, [setupConnection]);

  useEffect(() => {
    if (enabled) {
      setupConnection();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setIsConnected(false);
      setIsReconnecting(false);
    };
  }, [enabled, setupConnection]);

  return {
    isConnected,
    isReconnecting,
    reconnect: setupConnection,
  };
}
