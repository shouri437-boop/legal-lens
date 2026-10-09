import { useEffect, useRef, useCallback, useState } from "react";
import { TimelineSSEEvent, TimelineEvent } from "@/types/timeline.types";
import { PERFORMANCE_CONFIG } from "@/constants/timeline.constants";

interface UseTimelineSSEOptions {
  enabled?: boolean;
  onEventCreated?: (event: TimelineEvent) => void;
  onEventUpdated?: (event: TimelineEvent) => void;
  onEventDeleted?: (eventId: string) => void;
  onExtractionProgress?: (progress: {
    filesProcessed: number;
    eventsExtracted: number;
  }) => void;
  onExtractionComplete?: (result: { totalEvents: number }) => void;
  onError?: (error: Error) => void;
}

export function useTimelineSSE(caseId: string, options: UseTimelineSSEOptions) {
  const {
    enabled = true,
    onEventCreated,
    onEventUpdated,
    onEventDeleted,
    onExtractionProgress,
    onExtractionComplete,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const setupConnection = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    try {
      const eventSource = new EventSource(
        `/api/cases/${caseId}/timeline/events/stream`,
      );

      eventSource.addEventListener("timeline-event-created", (e) => {
        try {
          const data = JSON.parse(e.data) as TimelineSSEEvent;
          if (data.caseId === caseId) {
            onEventCreated?.(data.data as TimelineEvent);
          }
        } catch (error) {
          console.error("Failed to parse SSE event:", error);
        }
      });

      eventSource.addEventListener("timeline-event-updated", (e) => {
        try {
          const data = JSON.parse(e.data) as TimelineSSEEvent;
          if (data.caseId === caseId) {
            onEventUpdated?.(data.data as TimelineEvent);
          }
        } catch (error) {
          console.error("Failed to parse SSE event:", error);
        }
      });

      eventSource.addEventListener("timeline-event-deleted", (e) => {
        try {
          const data = JSON.parse(e.data) as TimelineSSEEvent;
          if (data.caseId === caseId) {
            onEventDeleted?.(data.data as string);
          }
        } catch (error) {
          console.error("Failed to parse SSE event:", error);
        }
      });

      eventSource.addEventListener("timeline-extraction-progress", (e) => {
        try {
          const data = JSON.parse(e.data) as TimelineSSEEvent;
          if (data.caseId === caseId) {
            onExtractionProgress?.(
              data.data as { filesProcessed: number; eventsExtracted: number },
            );
          }
        } catch (error) {
          console.error("Failed to parse SSE event:", error);
        }
      });

      eventSource.addEventListener("timeline-extraction-complete", (e) => {
        try {
          const data = JSON.parse(e.data) as TimelineSSEEvent;
          if (data.caseId === caseId) {
            onExtractionComplete?.(data.data as { totalEvents: number });
          }
        } catch (error) {
          console.error("Failed to parse SSE event:", error);
        }
      });

      eventSource.onerror = () => {
        console.error("SSE connection error");
        eventSource.close();
        eventSourceRef.current = null;
        setIsConnected(false);

        if (
          reconnectAttemptsRef.current <
          PERFORMANCE_CONFIG.MAX_SSE_RECONNECT_ATTEMPTS
        ) {
          reconnectAttemptsRef.current += 1;
          const delay =
            PERFORMANCE_CONFIG.SSE_RECONNECT_DELAY *
            Math.pow(2, reconnectAttemptsRef.current - 1);

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(
              `Attempting SSE reconnection (attempt ${reconnectAttemptsRef.current})`,
            );
            connectRef.current();
          }, delay);
        } else {
          onError?.(new Error("Max SSE reconnection attempts reached"));
        }
      };

      eventSource.onopen = () => {
        console.log("SSE connection established");
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error("Failed to establish SSE connection:", error);
      onError?.(error as Error);
    }
  }, [
    enabled,
    caseId,
    onEventCreated,
    onEventUpdated,
    onEventDeleted,
    onExtractionProgress,
    onExtractionComplete,
    onError,
  ]);

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
      }
      setIsConnected(false);
    };
  }, [enabled, setupConnection]);

  return {
    isConnected,
    reconnect: setupConnection,
  };
}
