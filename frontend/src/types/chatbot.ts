// ABOUTME: Type definitions for the chatbot system with SSE streaming support.
// ABOUTME: Includes message, citation, tool activity, stream event, and hook return types.

// ---------------------------------------------------------------------------
// Core message type — supports user, assistant, and error roles
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  timestamp: Date;
  citations?: ChatCitation[];
  /** True while tokens are still arriving from the SSE stream. */
  isStreaming?: boolean;
}

// ---------------------------------------------------------------------------
// Structured citation extracted from [[file_id|locator|label]] markers
// ---------------------------------------------------------------------------

export interface ChatCitation {
  file_id: string;
  locator: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Tool activity tracking during streaming
// ---------------------------------------------------------------------------

export interface ToolActivity {
  tool_name: string;
  status: "running" | "complete";
  started_at: Date;
}

// ---------------------------------------------------------------------------
// SSE event types emitted by the backend chat endpoint
// ---------------------------------------------------------------------------

export type ChatStreamEvent =
  | { event: "chat-token"; data: { text: string } }
  | { event: "chat-tool-start"; data: { tool_name: string } }
  | { event: "chat-tool-end"; data: { tool_name: string } }
  | {
      event: "chat-done";
      data: { message: string; citations: ChatCitation[]; session_id: string };
    }
  | { event: "chat-error"; data: { error: string } };

// ---------------------------------------------------------------------------
// Context passed to the chatbot (kept for backward compatibility)
// ---------------------------------------------------------------------------

export interface ChatbotContext {
  caseId?: string;
  caseName?: string;
  caseDescription?: string;
  caseStatus?: string;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseChatbotReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  toolActivities: ToolActivity[];
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => void;
  clearMessages: () => void;
  error: string | null;
}
