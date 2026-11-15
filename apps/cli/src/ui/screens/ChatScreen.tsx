import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Theme } from "@nightglide/themes";
import type {
  AgentEngine,
  AgentSession,
  AgentEvent,
  AgentStatus as StatusType,
} from "@nightglide/core";
import { AgentStatus } from "../components/AgentStatus.js";
import { Composer } from "../components/Composer.js";
import type { ScreenId } from "../components/Header.js";

export interface ToolCallItem {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  result?: unknown;
  error?: string;
  status: "running" | "completed" | "error";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCalls?: ToolCallItem[];
  isStreaming?: boolean;
}

export interface ChatScreenProps {
  theme: Theme;
  engine?: AgentEngine;
  onNavigate?: (screen: ScreenId) => void;
}

export function ChatScreen({ theme, engine }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "system-init",
      role: "system",
      content:
        "✦ Celestial Flight Deck Online. Nightglide is standing by to navigate your codebase.",
      timestamp: Date.now(),
    },
  ]);
  const [status, setStatus] = useState<StatusType>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [activeTool, setActiveTool] = useState<string | undefined>(undefined);
  const sessionRef = useRef<AgentSession | null>(null);

  // Initialize engine session if engine is supplied
  useEffect(() => {
    let active = true;

    if (!engine) {
      return;
    }

    async function initSession() {
      try {
        const session = await engine!.createSession({
          workspacePath: process.cwd(),
          model: "qwen2.5-coder:7b",
        });

        if (!active) {
          await session.dispose();
          return;
        }

        sessionRef.current = session;

        session.subscribe((event: AgentEvent) => {
          handleAgentEvent(event);
        });
      } catch (err: any) {
        setStatus("error");
        setStatusMessage(err?.message || "Failed to initialize agent session");
      }
    }

    initSession();

    return () => {
      active = false;
      if (sessionRef.current) {
        sessionRef.current.dispose().catch(() => {});
        sessionRef.current = null;
      }
    };
  }, [engine]);

  // Handle stream events
  const handleAgentEvent = useCallback((event: AgentEvent) => {
    if (event.type === "status") {
      setStatus(event.status);
      if (event.message) {
        setStatusMessage(event.message);
      }
    } else if (event.type === "text_delta") {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && lastMsg.isStreaming) {
          const updated: ChatMessage = {
            ...lastMsg,
            content: lastMsg.content + event.delta,
          };
          return [...prev.slice(0, -1), updated];
        } else {
          const newAssistantMsg: ChatMessage = {
            id: "msg-" + Date.now(),
            role: "assistant",
            content: event.delta,
            timestamp: Date.now(),
            isStreaming: true,
          };
          return [...prev, newAssistantMsg];
        }
      });
    } else if (event.type === "tool_start") {
      setStatus("executing_tool");
      setActiveTool(event.toolName);
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        const newTool: ToolCallItem = {
          id: event.toolCallId,
          toolName: event.toolName,
          input: event.input,
          status: "running",
        };
        if (lastMsg && lastMsg.role === "assistant") {
          const existingTools = lastMsg.toolCalls ?? [];
          return [
            ...prev.slice(0, -1),
            { ...lastMsg, toolCalls: [...existingTools, newTool] },
          ];
        } else {
          return [
            ...prev,
            {
              id: "msg-" + Date.now(),
              role: "assistant",
              content: "",
              timestamp: Date.now(),
              toolCalls: [newTool],
              isStreaming: true,
            },
          ];
        }
      });
    } else if (event.type === "tool_end") {
      setActiveTool(undefined);
      setMessages((prev) => {
        return prev.map((msg) => {
          if (!msg.toolCalls) return msg;
          const updatedTools = msg.toolCalls.map((t) => {
            if (t.id === event.toolCallId) {
              return {
                ...t,
                result: event.result,
                error: event.error,
                status: (event.error ? "error" : "completed") as "error" | "completed",
              };
            }
            return t;
          });
          return { ...msg, toolCalls: updatedTools };
        });
      });
    } else if (event.type === "error") {
      setStatus("error");
      setStatusMessage(event.error);
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "system",
          content: `✖ Error: ${event.error}`,
          timestamp: Date.now(),
        },
      ]);
    } else if (event.type === "done") {
      setStatus("completed");
      setActiveTool(undefined);
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && lastMsg.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...lastMsg, isStreaming: false },
          ];
        }
        return prev;
      });
    }
  }, []);

  // Handle user prompt submit
  const handleSendMessage = useCallback(
    async (prompt: string) => {
      const userMsg: ChatMessage = {
        id: "usr-" + Date.now(),
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setStatus("thinking");
      setStatusMessage("Synthesizing flight coordinates...");

      if (sessionRef.current) {
        try {
          await sessionRef.current.sendMessage(prompt);
        } catch (err: any) {
          setStatus("error");
          setStatusMessage(err?.message || "Failed to deliver prompt to engine");
        }
      } else {
        // Standalone simulated fallback
        setTimeout(() => {
          handleAgentEvent({
            type: "status",
            status: "thinking",
            message: "Exploring workspace...",
          });
        }, 150);

        setTimeout(() => {
          handleAgentEvent({
            type: "tool_start",
            toolName: "read_file",
            toolCallId: "call-" + Date.now(),
            input: { path: "packages/core/src/contracts.ts" },
          });
        }, 350);

        setTimeout(() => {
          handleAgentEvent({
            type: "tool_end",
            toolName: "read_file",
            toolCallId: "call-" + Date.now(),
            result: { bytes: 1420, lines: 61 },
          });
          handleAgentEvent({
            type: "text_delta",
            delta: `Nightglide analyzed your instruction: "${prompt}".\n\nAll engine contracts and themes are properly aligned. Ready to accelerate into the next flight segment!`,
          });
          handleAgentEvent({ type: "done" });
        }, 750);
      }
    },
    [handleAgentEvent]
  );

  const handleCancel = useCallback(async () => {
    if (sessionRef.current) {
      await sessionRef.current.cancel();
    }
    setStatus("cancelling");
    setStatusMessage("Flight halted by user.");
  }, []);

  // Show latest 6 messages to prevent overflow in fixed terminal height
  const visibleMessages = messages.slice(-6);

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.colors.background}
      paddingX={1}
      paddingY={0}
      gap={1}
    >
      {/* Top Agent Status Bar */}
      <AgentStatus
        status={status}
        theme={theme}
        model="qwen2.5-coder:7b"
        statusMessage={statusMessage}
        activeTool={activeTool}
      />

      {/* Conversation Scrollable Message Flow */}
      <box
        flexDirection="column"
        flexGrow={1}
        backgroundColor={theme.colors.surface}
        borderColor={theme.colors.border}
        borderStyle="single"
        paddingX={1}
        paddingY={1}
        gap={1}
      >
        {visibleMessages.map((msg) => {
          if (msg.role === "user") {
            return (
              <box
                key={msg.id}
                flexDirection="column"
                backgroundColor={theme.colors.surfaceElevated}
                borderColor={theme.colors.accent}
                borderStyle="single"
                paddingX={1}
              >
                <box flexDirection="row" justifyContent="space-between">
                  <text fg={theme.colors.accent}>✦ User</text>
                  <text fg={theme.colors.textMuted}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </text>
                </box>
                <text fg={theme.colors.textPrimary}>{msg.content}</text>
              </box>
            );
          }

          if (msg.role === "assistant") {
            return (
              <box
                key={msg.id}
                flexDirection="column"
                backgroundColor={theme.colors.surface}
                borderColor={theme.colors.border}
                borderStyle="single"
                paddingX={1}
              >
                <box flexDirection="row" justifyContent="space-between">
                  <box flexDirection="row" gap={1}>
                    <text fg={theme.colors.accentSecondary}>▲ Nightglide</text>
                    {msg.isStreaming ? (
                      <text fg={theme.colors.warning}>[streaming...]</text>
                    ) : null}
                  </box>
                  <text fg={theme.colors.textMuted}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </text>
                </box>

                {/* Render Tool Calls if any */}
                {msg.toolCalls?.map((tool) => (
                  <box
                    key={tool.id}
                    flexDirection="column"
                    borderColor={
                      tool.status === "error"
                        ? theme.colors.error
                        : theme.colors.info
                    }
                    borderStyle="single"
                    backgroundColor={theme.colors.surfaceElevated}
                    paddingX={1}
                    marginY={0}
                  >
                    <box flexDirection="row" justifyContent="space-between">
                      <text fg={theme.colors.info}>
                        🛠 [Tool] {tool.toolName}
                      </text>
                      <text
                        fg={
                          tool.status === "completed"
                            ? theme.colors.success
                            : tool.status === "error"
                            ? theme.colors.error
                            : theme.colors.warning
                        }
                      >
                        {tool.status.toUpperCase()}
                      </text>
                    </box>
                    <text fg={theme.colors.textMuted}>
                      Input: {JSON.stringify(tool.input)}
                    </text>
                    {tool.result ? (
                      <text fg={theme.colors.textSecondary}>
                        Result: {JSON.stringify(tool.result)}
                      </text>
                    ) : null}
                    {tool.error ? (
                      <text fg={theme.colors.error}>
                        Error: {tool.error}
                      </text>
                    ) : null}
                  </box>
                ))}

                {/* Assistant Text Content */}
                {msg.content ? (
                  <text fg={theme.colors.textPrimary}>{msg.content}</text>
                ) : null}
              </box>
            );
          }

          // System message
          return (
            <box
              key={msg.id}
              flexDirection="row"
              paddingX={1}
              backgroundColor={theme.colors.surfaceElevated}
            >
              <text fg={theme.colors.textMuted}>{msg.content}</text>
            </box>
          );
        })}

        {status === "thinking" ? (
          <box flexDirection="row" paddingX={1} gap={1}>
            <text fg={theme.colors.warning}>⚡</text>
            <text fg={theme.colors.warning}>
              Deliberating solution and synthesizing flight coordinates...
            </text>
          </box>
        ) : null}
      </box>

      {/* Composer Input Deck */}
      <Composer
        theme={theme}
        onSubmit={handleSendMessage}
        onCancel={handleCancel}
        status={status}
      />
    </box>
  );
}
