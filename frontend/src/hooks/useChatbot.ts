// ABOUTME: Hook for streaming chat with the backend case assistant via SSE.
// ABOUTME: Manages messages, tool activities, streaming state, and abort control.

import { useState, useCallback, useRef } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { getToken } from "@/lib/auth-client";
import type {
  ChatMessage,
  ChatCitation,
  ToolActivity,
  UseChatbotReturn,
} from "@/types/chatbot";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface UseChatbotOptions {
  caseId: string;
}

/**
 * Streaming chat hook that connects to the backend SSE endpoint.
 *
 * Sends user messages to POST /api/cases/:caseId/chat and streams the
 * response token-by-token. Manages tool activity indicators, citation
 * extraction on completion, and abort-based stream cancellation.
 */
export function useChatbot({ caseId }: UseChatbotOptions): UseChatbotReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolActivities, setToolActivities] = useState<ToolActivity[]>([]);
  const [error, setError] = useState<string | null>(null);

  // AbortController ref for stream cancellation (avoids re-renders)
  const abortControllerRef = useRef<AbortController | null>(null);

  // Session ID ref for persistent ADK sessions across messages
  const sessionIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !caseId) return;

      // Clear any previous error
      setError(null);

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };

      // Add placeholder assistant message for streaming
      const assistantId = `assistant-${Date.now()}`;
      const placeholderMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, placeholderMessage]);
      setIsStreaming(true);
      setToolActivities([]);

      // Create new AbortController for this stream
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const token = await getToken();

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        await fetchEventSource(`${API_URL}/api/cases/${caseId}/chat`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: content,
            session_id: sessionIdRef.current,
          }),
          signal: controller.signal,

          onmessage(ev) {
            if (!ev.data) return;

            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(ev.data) as Record<string, unknown>;
            } catch {
              return;
            }

            switch (ev.event) {
              case "chat-token": {
                const text = parsed.text as string;
                if (text) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId
                        ? { ...msg, content: msg.content + text }
                        : msg,
                    ),
                  );
                }
                break;
              }

              case "chat-tool-start": {
                const toolName = parsed.tool_name as string;
                if (toolName) {
                  setToolActivities((prev) => [
                    ...prev,
                    {
                      tool_name: toolName,
                      status: "running",
                      started_at: new Date(),
                    },
                  ]);
                }
                break;
              }

              case "chat-tool-end": {
                const toolName = parsed.tool_name as string;
                if (toolName) {
                  setToolActivities((prev) =>
                    prev.map((ta) =>
                      ta.tool_name === toolName && ta.status === "running"
                        ? { ...ta, status: "complete" }
                        : ta,
                    ),
                  );
                }
                break;
              }

              case "chat-done": {
                const finalMessage = parsed.message as string;
                const citations = (parsed.citations ?? []) as ChatCitation[];
                const returnedSessionId = parsed.session_id as
                  | string
                  | undefined;

                // Persist session ID for future messages
                if (returnedSessionId) {
                  sessionIdRef.current = returnedSessionId;
                }

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? {
                          ...msg,
                          content: finalMessage,
                          citations,
                          isStreaming: false,
                        }
                      : msg,
                  ),
                );
                setIsStreaming(false);
                setToolActivities([]);
                break;
              }

              case "chat-error": {
                const errorText =
                  (parsed.error as string) ?? "An unknown error occurred.";
                // Remove the placeholder assistant message and add error message
                setMessages((prev) => [
                  ...prev.filter((msg) => msg.id !== assistantId),
                  {
                    id: `error-${Date.now()}`,
                    role: "error",
                    content: errorText,
                    timestamp: new Date(),
                  },
                ]);
                setError(errorText);
                setIsStreaming(false);
                setToolActivities([]);
                break;
              }
            }
          },

          onerror(err) {
            // If aborted intentionally, don't treat as error
            if (controller.signal.aborted) return;

            const errorMessage =
              err instanceof Error
                ? err.message
                : "Connection to the assistant was lost.";

            // Remove placeholder and add error message
            setMessages((prev) => [
              ...prev.filter((msg) => msg.id !== assistantId),
              {
                id: `error-${Date.now()}`,
                role: "error",
                content: errorMessage,
                timestamp: new Date(),
              },
            ]);
            setError(errorMessage);
            setIsStreaming(false);
            setToolActivities([]);

            // Throw to prevent fetch-event-source from retrying
            throw err;
          },

          onclose() {
            // Stream closed normally — finalize if still streaming
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId && msg.isStreaming
                  ? { ...msg, isStreaming: false }
                  : msg,
              ),
            );
            setIsStreaming(false);
          },

          // Required for POST requests with fetch-event-source
          openWhenHidden: true,
        });
      } catch (err) {
        // Only handle non-abort errors (abort is intentional via stopStreaming)
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to connect to the assistant.";

        // Remove placeholder if it still has no content
        setMessages((prev) => {
          const placeholder = prev.find((msg) => msg.id === assistantId);
          if (placeholder && !placeholder.content) {
            return [
              ...prev.filter((msg) => msg.id !== assistantId),
              {
                id: `error-${Date.now()}`,
                role: "error" as const,
                content: errorMessage,
                timestamp: new Date(),
              },
            ];
          }
          // If some content was accumulated, just finalize
          return prev.map((msg) =>
            msg.id === assistantId ? { ...msg, isStreaming: false } : msg,
          );
        });

        setError(errorMessage);
        setIsStreaming(false);
        setToolActivities([]);
      }
    },
    [caseId],
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Finalize any streaming message with accumulated content
    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg,
      ),
    );
    setIsStreaming(false);
    setToolActivities([]);
  }, []);

  const clearMessages = useCallback(() => {
    // Abort any active stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setMessages([]);
    setError(null);
    setIsStreaming(false);
    setToolActivities([]);

    // Reset session ID so backend creates a fresh ADK session
    sessionIdRef.current = null;
  }, []);

  return {
    messages,
    isStreaming,
    toolActivities,
    sendMessage,
    stopStreaming,
    clearMessages,
    error,
  };
}
