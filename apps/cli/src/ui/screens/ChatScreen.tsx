import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Theme } from "@nightglide/themes";
import { useKeyboard } from "@opentui/react";
import type {
  AgentEngine,
  AgentSession,
  AgentEvent,
  AgentStatus as StatusType,
  SubagentMonitorItem,
  RoutingDecision,
} from "@nightglide/core";
import type { InteractionMode } from "@nightglide/config";
import { AgentStatus } from "../components/AgentStatus.js";
import { Composer } from "../components/Composer.js";
import { AgentMonitor } from "../components/AgentMonitor.js";
import { RoutingExplanation } from "../components/RoutingExplanation.js";
import type { ScreenId } from "../components/Header.js";
import type { TerminalDimensions } from "../dimensions.js";

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
  dimensions?: TerminalDimensions;
  interactionMode?: InteractionMode;
  onToggleInteractionMode?: () => void;
  onSetInteractionMode?: (mode: InteractionMode) => void;
}

/**
 * Maps native OMP and coding tool names to representative visual icons.
 */
export function getToolIcon(toolName: string): string {
  const name = (toolName || "").toLowerCase();
  switch (name) {
    case "read":
    case "read_file":
      return "📖";
    case "write":
    case "write_file":
      return "✍️";
    case "edit":
      return "✂️";
    case "bash":
      return "💻";
    case "task":
      return "⚙️";
    case "glob":
      return "🔍";
    case "grep":
      return "🔎";
    case "todo":
      return "📝";
    default:
      return "🛠";
  }
}

/**
 * Cleanly formats tool input parameters into human-readable summaries for native OMP tools.
 */
export function formatToolSummary(toolName: string, input: Record<string, unknown> = {}): string {
  const name = (toolName || "").toLowerCase();
  switch (name) {
    case "read":
    case "read_file":
      return input.path ? String(input.path) : "read file";
    case "write":
    case "write_file":
      return input.path ? String(input.path) : "write file";
    case "edit":
      return input.path ? String(input.path) : "edit file";
    case "bash":
      return input.command ? `$ ${String(input.command)}` : "shell command";
    case "task": {
      const taskDesc = input.prompt || input.description || input.task || "";
      const targetRole = input.subagent || input.role || "subagent";
      return taskDesc ? `[${targetRole}] ${String(taskDesc)}` : `delegated to ${targetRole}`;
    }
    case "glob":
      return input.pattern ? `pattern: ${String(input.pattern)}` : "find files";
    case "grep":
      return input.query || input.pattern
        ? `search "${String(input.query || input.pattern)}" in ${input.path || "."}`
        : "search text";
    case "todo":
      return input.action ? `action: ${String(input.action)}` : "manage todos";
    default:
      return Object.keys(input).length > 0 ? JSON.stringify(input) : "execute";
  }
}

/**
 * Extracts a concise single-line representation from tool execution results.
 */
export function formatToolResultSummary(toolName: string, result: unknown): string {
  if (result === undefined || result === null) return "";
  if (typeof result === "string") {
    const singleLine = result.trim().replace(/\s+/g, " ");
    return singleLine.length > 50 ? singleLine.slice(0, 47) + "..." : singleLine;
  }
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (obj.output && typeof obj.output === "string") {
      const out = obj.output.trim().replace(/\s+/g, " ");
      return out.length > 50 ? out.slice(0, 47) + "..." : out;
    }
    if (obj.stdout && typeof obj.stdout === "string") {
      const out = obj.stdout.trim().replace(/\s+/g, " ");
      return out.length > 50 ? out.slice(0, 47) + "..." : out;
    }
    if (obj.bytes !== undefined) {
      return `${obj.bytes} bytes` + (obj.lines ? `, ${obj.lines} lines` : "");
    }
    const str = JSON.stringify(result);
    return str.length > 50 ? str.slice(0, 47) + "..." : str;
  }
  return String(result);
}

export function ChatScreen({
  theme,
  engine,
  dimensions,
  interactionMode = "guided",
  onToggleInteractionMode,
  onSetInteractionMode,
}: ChatScreenProps) {
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
  const [subagents, setSubagents] = useState<SubagentMonitorItem[]>([]);
  const [routingDecision, setRoutingDecision] = useState<RoutingDecision | null>(null);
  const [showMonitor, setShowMonitor] = useState<boolean>(true);
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
    if (event.type === "routing_decision") {
      setRoutingDecision(event.decision);
    } else if (event.type === "subagent_start") {
      setSubagents((prev) => {
        const existing = prev.find((s) => s.id === event.subagentId);
        if (existing) {
          return prev.map((s) => (s.id === event.subagentId ? { ...s, status: "thinking" } : s));
        }
        return [
          ...prev,
          {
            id: event.subagentId,
            role: event.role,
            model: event.model,
            providerId: event.providerId || "omp",
            locality: event.locality,
            task: event.task,
            status: "thinking",
            startedAt: Date.now(),
          },
        ];
      });
    } else if (event.type === "subagent_delta") {
      setSubagents((prev) =>
        prev.map((s) => (s.id === event.subagentId ? { ...s, status: "streaming" } : s))
      );
    } else if (event.type === "subagent_end") {
      setSubagents((prev) =>
        prev.map((s) =>
          s.id === event.subagentId
            ? {
                ...s,
                status: event.error ? "error" : "completed",
                result: event.result,
                error: event.error,
                totalTokens: event.totalTokens,
                endedAt: Date.now(),
              }
            : s
        )
      );
    } else if (event.type === "status") {
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
      // Check for command-based interaction mode switching: /mode expert, /mode guided, /mode
      const lowerPrompt = prompt.trim().toLowerCase();
      if (
        lowerPrompt === "/mode expert" ||
        lowerPrompt === "/mode guided" ||
        lowerPrompt === "/mode"
      ) {
        let targetMode: InteractionMode = "guided";
        if (lowerPrompt === "/mode expert") {
          targetMode = "expert";
        } else if (lowerPrompt === "/mode guided") {
          targetMode = "guided";
        } else {
          targetMode = interactionMode === "guided" ? "expert" : "guided";
        }

        if (onSetInteractionMode) {
          onSetInteractionMode(targetMode);
        } else if (onToggleInteractionMode) {
          onToggleInteractionMode();
        }

        setMessages((prev) => [
          ...prev,
          {
            id: "usr-" + Date.now(),
            role: "user",
            content: prompt,
            timestamp: Date.now(),
          },
          {
            id: "sys-" + Date.now(),
            role: "system",
            content: `✦ Interaction mode switched to ${
              targetMode === "expert"
                ? "Expert (compact tool execution summary)"
                : "Guided (detailed parameter breakdown)"
            }.`,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

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
        // Standalone simulated fallback with native OMP tool execution
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
            toolName: "read",
            toolCallId: "call-" + Date.now(),
            input: { path: "packages/core/src/contracts.ts" },
          });
        }, 350);

        setTimeout(() => {
          handleAgentEvent({
            type: "tool_end",
            toolName: "read",
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
    [handleAgentEvent, interactionMode, onSetInteractionMode, onToggleInteractionMode]
  );

  const handleCancel = useCallback(async () => {
    if (sessionRef.current) {
      await sessionRef.current.cancel();
    }
    setStatus("cancelling");
    setStatusMessage("Flight halted by user.");
  }, []);

  // Keyboard shortcut listener for ChatScreen
  useKeyboard((key) => {
    if (key.ctrl && key.name === "m") {
      setShowMonitor((prev) => !prev);
    } else if (key.name === "escape") {
      if (status === "thinking" || status === "streaming" || status === "executing_tool") {
        handleCancel();
      }
    }
  });

  // Calculate message count adaptively based on terminal height (e.g. 80x24, 100x30, 120x36)
  const isCompact = dimensions?.isCompactHeight ?? false;
  const maxMessages = isCompact ? 3 : (dimensions?.height ?? 30) < 34 ? 5 : 8;
  const visibleMessages = messages.slice(-maxMessages);

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
        {routingDecision ? (
          <RoutingExplanation theme={theme} decision={routingDecision} />
        ) : null}

        {subagents.length > 0 ? (
          <AgentMonitor
            theme={theme}
            subagents={subagents}
            isOpen={showMonitor}
            maxVisible={isCompact ? 2 : undefined}
            interactionMode={interactionMode}
          />
        ) : null}

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

                {/* Render Native OMP Tool Calls */}
                {msg.toolCalls?.map((tool) => {
                  const toolIcon = getToolIcon(tool.toolName);
                  const statusColor =
                    tool.status === "completed"
                      ? theme.colors.success
                      : tool.status === "error"
                      ? theme.colors.error
                      : theme.colors.warning;

                  // Expert Mode: compact single-line execution summary
                  if (interactionMode === "expert") {
                    return (
                      <box
                        key={tool.id}
                        flexDirection="row"
                        justifyContent="space-between"
                        alignItems="center"
                        backgroundColor={theme.colors.surfaceElevated}
                        borderColor={tool.status === "error" ? theme.colors.error : theme.colors.border}
                        borderStyle="single"
                        paddingX={1}
                        marginY={0}
                      >
                        <box flexDirection="row" alignItems="center" gap={1}>
                          <text fg={theme.colors.info}>{toolIcon} [{tool.toolName}]</text>
                          <text fg={theme.colors.textPrimary}>
                            {formatToolSummary(tool.toolName, tool.input)}
                          </text>
                        </box>
                        <box flexDirection="row" alignItems="center" gap={1}>
                          {tool.error ? (
                            <text fg={theme.colors.error}>✖ {tool.error}</text>
                          ) : tool.result !== undefined && tool.result !== null ? (
                            <text fg={theme.colors.textSecondary}>
                              {formatToolResultSummary(tool.toolName, tool.result)}
                            </text>
                          ) : null}
                          <text fg={statusColor}>● {tool.status.toUpperCase()}</text>
                        </box>
                      </box>
                    );
                  }

                  // Guided Mode: detailed parameter breakdown and results card
                  return (
                    <box
                      key={tool.id}
                      flexDirection="column"
                      borderColor={
                        tool.status === "error"
                          ? theme.colors.error
                          : tool.status === "completed"
                          ? theme.colors.success
                          : theme.colors.info
                      }
                      borderStyle="single"
                      backgroundColor={theme.colors.surfaceElevated}
                      paddingX={1}
                      marginY={0}
                    >
                      <box flexDirection="row" justifyContent="space-between">
                        <box flexDirection="row" gap={1}>
                          <text fg={theme.colors.info}>
                            {toolIcon} [{tool.toolName}]
                          </text>
                          <text fg={theme.colors.textSecondary}>
                            {formatToolSummary(tool.toolName, tool.input)}
                          </text>
                        </box>
                        <text fg={statusColor}>
                          {tool.status.toUpperCase()}
                        </text>
                      </box>
                      <text fg={theme.colors.textMuted}>
                        Input: {JSON.stringify(tool.input)}
                      </text>
                      {tool.result !== undefined && tool.result !== null ? (
                        <text fg={theme.colors.textSecondary}>
                          Result: {typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result)}
                        </text>
                      ) : null}
                      {tool.error ? (
                        <text fg={theme.colors.error}>
                          Error: {tool.error}
                        </text>
                      ) : null}
                    </box>
                  );
                })}

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
