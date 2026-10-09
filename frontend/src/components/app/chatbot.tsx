// ABOUTME: Floating chat window for case Q&A with the backend assistant via SSE streaming.
// ABOUTME: Renders markdown, inline citation chips, tool activity indicators, stop/clear buttons.

"use client";

import { ThemedLogo } from "@/components/app/themed-logo";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  MessageCircle,
  X,
  Send,
  Minimize2,
  Maximize2,
  Square,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChatbot } from "@/hooks/useChatbot";
import type { ChatMessage, ToolActivity } from "@/types/chatbot";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatbotProps {
  caseId?: string;
  caseContext?: {
    name: string;
    description?: string;
    status: string;
  };
  /** Whether analysis data is available for the chat agent. */
  analysisAvailable?: boolean;
}

// ---------------------------------------------------------------------------
// Tool name humanization map
// ---------------------------------------------------------------------------

const TOOL_LABELS: Record<string, string> = {
  query_knowledge_graph: "Searching knowledge graph",
  get_findings: "Querying domain findings",
  get_synthesis: "Loading synthesis data",
  search_findings: "Searching case evidence",
};

function humanizeToolName(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Citation marker stripping -- removes [[file_id|locator|label]] markers
// ---------------------------------------------------------------------------

const CITATION_STRIP_PATTERN =
  /\[\[[a-f0-9-]+(?:\|[^\]]*)*\]\]|\[[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:\|[^\]]*)*\]/g;

// ---------------------------------------------------------------------------
// ChatMessageContent -- renders markdown with citation markers stripped
// ---------------------------------------------------------------------------

function ChatMessageContent({ content }: { content: string }) {
  const cleaned = useMemo(
    () => content.replace(CITATION_STRIP_PATTERN, "").trim(),
    [content],
  );
  return <MarkdownRenderer content={cleaned} />;
}

// ---------------------------------------------------------------------------
// MarkdownRenderer -- styled markdown for assistant messages
// ---------------------------------------------------------------------------

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-lg font-semibold text-[#faf9f7] mt-3 mb-1.5">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-semibold text-[#faf9f7] mt-2.5 mb-1">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-[#faf9f7] mt-2 mb-1">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-sm leading-relaxed mb-1.5">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc ml-4 text-sm leading-relaxed mb-1.5 space-y-0.5">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal ml-4 text-sm leading-relaxed mb-1.5 space-y-0.5">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-sm leading-relaxed">{children}</li>
        ),
        code: ({ className, children }) => {
          // Inline code vs code block detection
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return <code className="text-xs font-mono">{children}</code>;
          }
          return (
            <code className="bg-black/20 px-1 py-0.5 rounded text-xs font-mono">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="bg-black/30 p-3 rounded-lg overflow-x-auto mb-1.5 text-xs">
            {children}
          </pre>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-white/20 pl-3 italic opacity-80 mb-1.5">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-1.5">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-white/10 px-2 py-1 text-left font-semibold bg-white/5">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-white/10 px-2 py-1">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ---------------------------------------------------------------------------
// ToolActivitySection -- expandable "Agent is working..." indicator
// ---------------------------------------------------------------------------

interface ToolActivitySectionProps {
  activities: ToolActivity[];
  isStreaming: boolean;
}

function ToolActivitySection({
  activities,
  isStreaming,
}: ToolActivitySectionProps) {
  const [expanded, setExpanded] = useState(true);

  if (activities.length === 0 || !isStreaming) return null;

  const runningCount = activities.filter((a) => a.status === "running").length;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-2"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx(
          "flex items-center gap-2 w-full text-left",
          "bg-white/5 hover:bg-white/8 backdrop-blur-sm",
          "rounded-lg px-3 py-2",
          "border border-white/10",
          "text-xs text-[#faf9f7]/80",
          "transition-colors",
        )}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />
        <span className="flex-1">Agent is working...</span>
        {runningCount > 0 && (
          <span className="bg-blue-500/20 text-blue-400 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
            {runningCount}
          </span>
        )}
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1 space-y-1 pl-2"
          >
            {activities.map((activity, i) => (
              <div
                key={`${activity.tool_name}-${i}`}
                className="flex items-center gap-2 text-xs text-[#faf9f7]/60 py-0.5"
              >
                {activity.status === "running" ? (
                  <Loader2 className="w-3 h-3 animate-spin text-blue-400 shrink-0" />
                ) : (
                  <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                )}
                <span>
                  {humanizeToolName(activity.tool_name)}
                  {activity.status === "running" ? "..." : ""}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Chatbot -- main floating chat window component
// ---------------------------------------------------------------------------

export function Chatbot({
  caseId,
  caseContext,
  analysisAvailable = true,
}: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const {
    messages,
    isStreaming,
    toolActivities,
    sendMessage,
    stopStreaming,
    clearMessages,
    error,
  } = useChatbot({
    caseId: caseId ?? "",
  });

  // Window dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Window resizing state
  const MIN_WIDTH = 320;
  const MIN_HEIGHT = 400;
  const MAX_WIDTH = 880;
  const MAX_HEIGHT = 1320;
  const [size, setSize] = useState({ width: MAX_WIDTH, height: MAX_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const chatWindowRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track last user message for retry functionality
  const lastUserMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].content;
    }
    return null;
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep window within viewport bounds
      const maxX = window.innerWidth - 100; // Keep at least 100px visible
      const maxY = window.innerHeight - 60; // Keep header visible

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Handle resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      // Calculate new dimensions with constraints
      const newWidth = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, resizeStart.width + deltaX),
      );
      const newHeight = Math.max(
        MIN_HEIGHT,
        Math.min(MAX_HEIGHT, resizeStart.height + deltaY),
      );

      setSize({
        width: newWidth,
        height: newHeight,
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, resizeStart, MIN_WIDTH, MIN_HEIGHT, MAX_WIDTH, MAX_HEIGHT]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (chatWindowRef.current) {
      const rect = chatWindowRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });
    setIsResizing(true);
  };

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isStreaming || !analysisAvailable) return;

    const message = inputValue;
    setInputValue("");
    await sendMessage(message);
  }, [inputValue, isStreaming, analysisAvailable, sendMessage]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  const handleRetry = useCallback(() => {
    if (lastUserMessage) {
      sendMessage(lastUserMessage);
    }
  }, [lastUserMessage, sendMessage]);

  const isDisabled = !analysisAvailable;

  return (
    <>
      {/* Floating Chat Icon */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className={clsx(
              "fixed bottom-6 right-6 z-50",
              "w-14 h-14 rounded-full",
              "flex items-center justify-center",
              "shadow-lg hover:shadow-xl transition-shadow",
              "bg-[#2a2825] dark:bg-[#f5f4ef]",
            )}
            aria-label="Open chat"
          >
            <MessageCircle className="w-6 h-6 text-[#faf9f7] dark:text-[#1a1816]" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatWindowRef}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              width: isMinimized ? 320 : size.width,
              height: isMinimized ? 60 : size.height,
              maxWidth: "90vw",
              maxHeight: "90vh",
              position: "fixed",
              zIndex: 1000,
              right: position ? undefined : "24px",
              bottom: position ? undefined : "24px",
              left: position ? `${position.x}px` : undefined,
              top: position ? `${position.y}px` : undefined,
            }}
            className={clsx(
              "rounded-xl overflow-hidden",
              "shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.6)]",
              // Liquid glass effect with backdrop blur - 10% more transparent
              "bg-white/60 dark:bg-[#1a1816]/70",
              "backdrop-blur-xl backdrop-saturate-150",
              "border border-white/20 dark:border-white/10",
              "flex flex-col",
            )}
          >
            {/* Header - Draggable */}
            <div
              onMouseDown={handleDragStart}
              className={clsx(
                "flex items-center justify-between px-4 py-3",
                // Enhanced glass header with stronger contrast - 10% more transparent
                "bg-white/30 dark:bg-[#2a2825]/50",
                "backdrop-blur-md",
                "border-b border-white/30 dark:border-white/10",
                "cursor-move select-none",
              )}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#2a2825] dark:text-[#f5f4ef] drop-shadow-sm" />
                <h3 className="font-semibold text-[#1a1816] dark:text-[#faf9f7] drop-shadow-sm">
                  Case Assistant
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Clear button */}
                {messages.length > 0 && (
                  <button
                    onClick={clearMessages}
                    className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all hover:scale-105"
                    aria-label="Clear chat"
                    title="Clear chat history"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#2a2825] dark:text-[#f5f4ef] opacity-70" />
                  </button>
                )}
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all hover:scale-105"
                  aria-label={isMinimized ? "Maximize" : "Minimize"}
                >
                  {isMinimized ? (
                    <Maximize2 className="w-4 h-4 text-[#2a2825] dark:text-[#f5f4ef]" />
                  ) : (
                    <Minimize2 className="w-4 h-4 text-[#2a2825] dark:text-[#f5f4ef]" />
                  )}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all hover:scale-105"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4 text-[#2a2825] dark:text-[#f5f4ef]" />
                </button>
              </div>
            </div>

            {/* Chat Content */}
            {!isMinimized && (
              <>
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-gradient-to-b from-transparent to-black/5 dark:to-white/5">
                  {/* Disabled overlay when analysis has not run */}
                  {isDisabled && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
                      <AlertCircle className="w-10 h-10 mb-3 text-[#2a2825] dark:text-[#f5f4ef] opacity-30" />
                      <p className="text-[#2a2825] dark:text-[#faf9f7] text-sm font-medium opacity-60">
                        Run analysis first to enable chat
                      </p>
                      <p className="text-[#2a2825] dark:text-[#faf9f7] text-xs mt-1 opacity-40">
                        The assistant needs analysis data to answer questions
                      </p>
                    </div>
                  )}

                  {!isDisabled && messages.length === 0 && (
                    <div className="text-center py-8 px-4">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 text-[#2a2825] dark:text-[#f5f4ef] opacity-40 drop-shadow" />
                      <p className="text-[#2a2825] dark:text-[#faf9f7] text-sm font-medium drop-shadow-sm break-words">
                        {caseContext
                          ? `Ask me anything about "${caseContext.name}"`
                          : "Start a conversation to get help with your case"}
                      </p>
                    </div>
                  )}

                  {!isDisabled &&
                    messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        onRetry={handleRetry}
                      />
                    ))}

                  {/* Tool activity indicator */}
                  {!isDisabled && (
                    <ToolActivitySection
                      activities={toolActivities}
                      isStreaming={isStreaming}
                    />
                  )}

                  {/* Streaming indicator (when streaming but no tool activities) */}
                  {!isDisabled &&
                    isStreaming &&
                    toolActivities.length === 0 &&
                    messages.length > 0 &&
                    messages[messages.length - 1].role === "assistant" &&
                    messages[messages.length - 1].isStreaming &&
                    messages[messages.length - 1].content === "" && (
                      <StreamingIndicator />
                    )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/30 dark:border-white/10 bg-white/30 dark:bg-[#2a2825]/50 backdrop-blur-md shrink-0">
                  {/* Error banner */}
                  {error && !isStreaming && (
                    <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      {error}
                    </div>
                  )}
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={
                        isDisabled
                          ? "Chat is unavailable -- run analysis first"
                          : "Type your message..."
                      }
                      disabled={isDisabled || isStreaming}
                      rows={1}
                      className={clsx(
                        "flex-1 min-w-0 px-3 py-2.5 rounded-lg resize-none",
                        "bg-white/50 dark:bg-[#1a1816]/50",
                        "backdrop-blur-sm",
                        "border border-white/40 dark:border-white/10",
                        "text-[#1a1816] dark:text-[#faf9f7]",
                        "placeholder:text-[#2a2825]/60 dark:placeholder:text-[#f5f4ef]/60",
                        "focus:outline-none focus:ring-2 focus:ring-[#2a2825]/30 dark:focus:ring-[#f5f4ef]/30",
                        "focus:border-[#2a2825]/40 dark:focus:border-[#f5f4ef]/40",
                        "text-sm font-medium",
                        "shadow-sm",
                        "transition-all",
                        "overflow-y-auto",
                        "disabled:opacity-40 disabled:cursor-not-allowed",
                      )}
                      style={{
                        maxHeight: "120px",
                        minHeight: "40px",
                      }}
                    />

                    {/* Stop button (visible during streaming) */}
                    {isStreaming && (
                      <button
                        onClick={stopStreaming}
                        className={clsx(
                          "px-3 py-2.5 rounded-lg shrink-0",
                          "bg-red-600/80 hover:bg-red-600",
                          "text-white",
                          "hover:scale-105 active:scale-95",
                          "transition-all duration-200",
                          "flex items-center justify-center",
                          "shadow-md",
                        )}
                        aria-label="Stop streaming"
                        title="Stop response"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Send button */}
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isDisabled || isStreaming}
                      className={clsx(
                        "px-4 py-2.5 rounded-lg shrink-0",
                        "bg-[#2a2825] dark:bg-[#f5f4ef]",
                        "text-[#faf9f7] dark:text-[#050505]",
                        "hover:bg-[#3d3a36] dark:hover:bg-[#d4d3ce]",
                        "hover:scale-105 active:scale-95",
                        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
                        "transition-all duration-200",
                        "flex items-center justify-center",
                        "shadow-md hover:shadow-lg",
                      )}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Resize Handle */}
                <div
                  onMouseDown={handleResizeStart}
                  className={clsx(
                    "absolute bottom-0 right-0 w-6 h-6 cursor-se-resize",
                    "opacity-30 hover:opacity-60 transition-opacity",
                    "flex items-end justify-end p-1",
                  )}
                  title="Drag to resize"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    className="text-[#2a2825] dark:text-[#f5f4ef]"
                  >
                    <path
                      d="M11 11L11 7M11 11L7 11M11 11L6 6M11 3L11 1L9 1M3 11L1 11L1 9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble -- individual message rendering
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry: () => void;
}

function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  // Error messages
  if (message.role === "error") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-start gap-2"
      >
        <div className="shrink-0 mt-1">
          <AlertCircle className="w-5 h-5 text-red-400 opacity-70" />
        </div>
        <div
          className={clsx(
            "rounded-lg px-4 py-2.5 shadow-sm",
            "max-w-[85%] min-w-[120px]",
            "bg-red-500/10 border border-red-500/20",
            "text-red-400",
          )}
          style={{
            wordWrap: "break-word",
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
          <button
            onClick={onRetry}
            className={clsx(
              "mt-2 flex items-center gap-1.5",
              "text-xs text-red-300 hover:text-red-200",
              "transition-colors",
            )}
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      </motion.div>
    );
  }

  // User messages
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2 justify-end"
      >
        <div
          className={clsx(
            "rounded-lg px-4 py-2.5 shadow-sm",
            "max-w-[85%] min-w-[120px]",
            "bg-[#2a2825] dark:bg-[#f5f4ef] text-[#faf9f7] dark:text-[#050505]",
          )}
          style={{
            wordWrap: "break-word",
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed font-medium">
            {message.content}
          </p>
          <span className="text-xs mt-1.5 block font-medium opacity-70">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </motion.div>
    );
  }

  // Assistant messages: hide the bubble entirely while streaming with no content
  // to avoid a "double bubble" (empty timestamp bubble + separate streaming indicator).
  if (message.isStreaming && !message.content) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2 justify-start"
    >
      {/* Legal Lens logo for Assistant Messages */}
      <div className="shrink-0 mt-1">
        <ThemedLogo width={24} height={24} className="opacity-70" />
      </div>

      <div
        className={clsx(
          "rounded-lg px-4 py-2.5 shadow-sm",
          "max-w-[85%] min-w-[120px]",
          "bg-white/50 dark:bg-[#2a2825]/60 backdrop-blur-md",
          "text-[#1a1816] dark:text-[#faf9f7]",
          "border border-white/40 dark:border-white/10",
        )}
        style={{
          wordWrap: "break-word",
          overflowWrap: "break-word",
          wordBreak: "break-word",
        }}
      >
        {message.content ? (
          <ChatMessageContent content={message.content} />
        ) : (
          <p className="text-sm opacity-60 italic">No response</p>
        )}

        {/* Streaming cursor */}
        {message.isStreaming && message.content && (
          <span className="inline-block w-1.5 h-4 bg-current opacity-60 animate-pulse ml-0.5 align-middle" />
        )}

        <span className="text-xs mt-1.5 block font-medium opacity-60">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// StreamingIndicator -- thinking animation shown before first token
// ---------------------------------------------------------------------------

function StreamingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex justify-start"
    >
      <div className="bg-white/50 dark:bg-[#2a2825]/60 backdrop-blur-md rounded-lg px-4 py-3 border border-white/40 dark:border-white/10 shadow-sm">
        <div className="flex items-center gap-2">
          {/* Legal Lens logo */}
          <ThemedLogo width={20} height={20} className="opacity-80 shrink-0 drop-shadow-sm" />

          {/* Thinking Text */}
          <span className="text-sm text-[#1a1816] dark:text-[#faf9f7] font-medium">
            Thinking
          </span>

          {/* Animated Dots */}
          <div className="flex items-center gap-0.5">
            <motion.span
              className="inline-block w-1.5 h-1.5 rounded-full bg-[#2a2825] dark:bg-[#f5f4ef]"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0,
              }}
            />
            <motion.span
              className="inline-block w-1.5 h-1.5 rounded-full bg-[#2a2825] dark:bg-[#f5f4ef]"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.2,
              }}
            />
            <motion.span
              className="inline-block w-1.5 h-1.5 rounded-full bg-[#2a2825] dark:bg-[#f5f4ef]"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.4,
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
