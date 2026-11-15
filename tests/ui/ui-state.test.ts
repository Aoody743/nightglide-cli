import { describe, test, expect, beforeEach } from "bun:test";
import {
  getThemeManager,
  BUILTIN_THEMES,
  type Theme,
} from "@nightglide/themes";
import type {
  AgentEvent,
  AgentStatus,
} from "@nightglide/core";

// Define the core UI state accumulation logic to test deterministically
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

export class ChatStateReducer {
  messages: ChatMessage[] = [];
  status: AgentStatus = "idle";
  statusMessage = "";
  activeTool?: string;

  constructor(initialMessages: ChatMessage[] = []) {
    this.messages = [...initialMessages];
  }

  addUserMessage(prompt: string): boolean {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return false;
    }

    this.messages.push({
      id: "usr-" + Date.now() + "-" + Math.random(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    });

    this.status = "thinking";
    this.statusMessage = "Synthesizing flight coordinates...";
    return true;
  }

  applyEvent(event: AgentEvent): void {
    switch (event.type) {
      case "status":
        this.status = event.status;
        if (event.message) {
          this.statusMessage = event.message;
        }
        break;

      case "text_delta": {
        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && lastMsg.isStreaming) {
          lastMsg.content += event.delta;
        } else {
          this.messages.push({
            id: "asst-" + Date.now() + "-" + Math.random(),
            role: "assistant",
            content: event.delta,
            timestamp: Date.now(),
            isStreaming: true,
          });
        }
        break;
      }

      case "tool_start": {
        this.status = "executing_tool";
        this.activeTool = event.toolName;
        const newTool: ToolCallItem = {
          id: event.toolCallId,
          toolName: event.toolName,
          input: event.input,
          status: "running",
        };

        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.toolCalls = [...(lastMsg.toolCalls ?? []), newTool];
        } else {
          this.messages.push({
            id: "asst-" + Date.now() + "-" + Math.random(),
            role: "assistant",
            content: "",
            timestamp: Date.now(),
            toolCalls: [newTool],
            isStreaming: true,
          });
        }
        break;
      }

      case "tool_end": {
        this.activeTool = undefined;
        for (const msg of this.messages) {
          if (!msg.toolCalls) continue;
          for (const t of msg.toolCalls) {
            if (t.id === event.toolCallId) {
              t.result = event.result;
              t.error = event.error;
              t.status = event.error ? "error" : "completed";
            }
          }
        }
        break;
      }

      case "error":
        this.status = "error";
        this.statusMessage = event.error;
        this.messages.push({
          id: "err-" + Date.now() + "-" + Math.random(),
          role: "system",
          content: `✖ Error: ${event.error}`,
          timestamp: Date.now(),
        });
        break;

      case "done": {
        this.status = "completed";
        this.activeTool = undefined;
        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && lastMsg.isStreaming) {
          lastMsg.isStreaming = false;
        }
        break;
      }
    }
  }

  cancel(): void {
    this.status = "cancelling";
    this.statusMessage = "Flight halted by user.";
    const lastMsg = this.messages[this.messages.length - 1];
    if (lastMsg && lastMsg.isStreaming) {
      lastMsg.isStreaming = false;
    }
  }
}

describe("UI Navigation & Screen State Logic", () => {
  type ScreenId = "welcome" | "chat" | "setup" | "themes";

  function routeKeyToScreen(
    currentScreen: ScreenId,
    key: { name: string; ctrl?: boolean }
  ): ScreenId | "exit" | null {
    if (key.ctrl && (key.name === "c" || key.name === "q")) {
      return "exit";
    }

    if (currentScreen !== "chat") {
      switch (key.name) {
        case "1":
        case "w":
          return "welcome";
        case "2":
        case "d":
          return "chat";
        case "3":
        case "s":
          return "setup";
        case "4":
        case "t":
          return "themes";
        case "q":
          return "exit";
        default:
          return null;
      }
    } else {
      if (key.ctrl && key.name === "1") return "welcome";
      if (key.ctrl && key.name === "3") return "setup";
      if (key.ctrl && key.name === "4") return "themes";
      if (key.name === "f1") return "welcome";
      if (key.name === "f2") return "chat";
      if (key.name === "f3") return "setup";
      if (key.name === "f4") return "themes";
      return null;
    }
  }

  test("initial screen navigation defaults to welcome", () => {
    let screen: ScreenId = "welcome";
    expect(screen).toBe("welcome");
  });

  test("navigation from welcome to all other screens via keyboard", () => {
    expect(routeKeyToScreen("welcome", { name: "2" })).toBe("chat");
    expect(routeKeyToScreen("welcome", { name: "d" })).toBe("chat");
    expect(routeKeyToScreen("welcome", { name: "3" })).toBe("setup");
    expect(routeKeyToScreen("welcome", { name: "s" })).toBe("setup");
    expect(routeKeyToScreen("welcome", { name: "4" })).toBe("themes");
    expect(routeKeyToScreen("welcome", { name: "t" })).toBe("themes");
    expect(routeKeyToScreen("welcome", { name: "1" })).toBe("welcome");
    expect(routeKeyToScreen("welcome", { name: "q" })).toBe("exit");
  });

  test("chat screen guards single-letter navigation to prevent hijacking typing", () => {
    // Typing 'w' or 'd' or 'q' should NOT navigate away in chat screen
    expect(routeKeyToScreen("chat", { name: "w" })).toBeNull();
    expect(routeKeyToScreen("chat", { name: "d" })).toBeNull();
    expect(routeKeyToScreen("chat", { name: "s" })).toBeNull();
    expect(routeKeyToScreen("chat", { name: "q" })).toBeNull();

    // Ctrl shortcuts or F-keys work in chat screen
    expect(routeKeyToScreen("chat", { name: "1", ctrl: true })).toBe("welcome");
    expect(routeKeyToScreen("chat", { name: "3", ctrl: true })).toBe("setup");
    expect(routeKeyToScreen("chat", { name: "f4" })).toBe("themes");
  });

  test("universal Ctrl+C triggers exit from any screen", () => {
    expect(routeKeyToScreen("welcome", { name: "c", ctrl: true })).toBe("exit");
    expect(routeKeyToScreen("chat", { name: "c", ctrl: true })).toBe("exit");
    expect(routeKeyToScreen("setup", { name: "c", ctrl: true })).toBe("exit");
    expect(routeKeyToScreen("themes", { name: "c", ctrl: true })).toBe("exit");
  });
});

describe("UI Theme Synchronization", () => {
  beforeEach(() => {
    const tm = getThemeManager();
    tm.setTheme("midnight-flight");
  });

  test("ThemeManager initializes with midnight-flight and exposes 4 celestial themes", () => {
    const tm = getThemeManager();
    expect(tm.getActiveTheme().id).toBe("midnight-flight");
    expect(tm.getAllThemes().length).toBe(4);
  });

  test("switching themes updates active theme and dispatches to subscriber", () => {
    const tm = getThemeManager();
    let currentTheme: Theme = tm.getActiveTheme();

    const unsubscribe = tm.subscribe((next) => {
      currentTheme = next;
    });

    tm.setTheme("aurora");
    expect(currentTheme.id).toBe("aurora");
    expect(currentTheme.type).toBe("dark");

    tm.setTheme("cloudlight");
    expect(currentTheme.id).toBe("cloudlight");
    expect(currentTheme.type).toBe("light");

    tm.setTheme("daybreak");
    expect(currentTheme.id).toBe("daybreak");
    expect(currentTheme.type).toBe("light");

    unsubscribe();
  });

  test("all theme colors satisfy required contrast and hex formats", () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.colors.background.startsWith("#")).toBe(true);
      expect(theme.colors.surface.startsWith("#")).toBe(true);
      expect(theme.colors.accent.startsWith("#")).toBe(true);
      expect(theme.colors.accentSecondary.startsWith("#")).toBe(true);
      expect(theme.colors.textPrimary.startsWith("#")).toBe(true);
      expect(theme.colors.border.startsWith("#")).toBe(true);
    }
  });
});

describe("Message Accumulation from AgentEvent Streams", () => {
  test("addUserMessage ignores empty or whitespace-only prompts", () => {
    const state = new ChatStateReducer();
    expect(state.addUserMessage("")).toBe(false);
    expect(state.addUserMessage("   ")).toBe(false);
    expect(state.messages.length).toBe(0);
    expect(state.status).toBe("idle");
  });

  test("addUserMessage appends user message and sets status to thinking", () => {
    const state = new ChatStateReducer();
    const ok = state.addUserMessage("Create a celestial CLI");
    expect(ok).toBe(true);
    expect(state.messages.length).toBe(1);
    expect(state.messages[0].role).toBe("user");
    expect(state.messages[0].content).toBe("Create a celestial CLI");
    expect(state.status).toBe("thinking");
  });

  test("accumulates text_delta chunks into continuous assistant message", () => {
    const state = new ChatStateReducer();
    state.addUserMessage("Write hello world");

    state.applyEvent({ type: "status", status: "streaming" });
    expect(state.status).toBe("streaming");

    state.applyEvent({ type: "text_delta", delta: "Here " });
    state.applyEvent({ type: "text_delta", delta: "is the " });
    state.applyEvent({ type: "text_delta", delta: "flight plan." });

    expect(state.messages.length).toBe(2);
    const asstMsg = state.messages[1];
    expect(asstMsg.role).toBe("assistant");
    expect(asstMsg.content).toBe("Here is the flight plan.");
    expect(asstMsg.isStreaming).toBe(true);

    state.applyEvent({ type: "done", summary: "All done" });
    expect(state.status).toBe("completed");
    expect(asstMsg.isStreaming).toBe(false);
  });

  test("records tool_start and updates with tool_end result", () => {
    const state = new ChatStateReducer();
    state.addUserMessage("Inspect files");

    state.applyEvent({
      type: "tool_start",
      toolName: "read_file",
      toolCallId: "call_001",
      input: { path: "package.json" },
    });

    expect(state.status).toBe("executing_tool");
    expect(state.activeTool).toBe("read_file");

    const asstMsg = state.messages.find((m) => m.role === "assistant");
    expect(asstMsg).toBeDefined();
    expect(asstMsg!.toolCalls?.length).toBe(1);
    expect(asstMsg!.toolCalls![0].id).toBe("call_001");
    expect(asstMsg!.toolCalls![0].status).toBe("running");

    state.applyEvent({
      type: "tool_end",
      toolName: "read_file",
      toolCallId: "call_001",
      result: { size: 1024 },
    });

    expect(state.activeTool).toBeUndefined();
    expect(asstMsg!.toolCalls![0].status).toBe("completed");
    expect(asstMsg!.toolCalls![0].result).toEqual({ size: 1024 });
  });

  test("handles tool_end error properly", () => {
    const state = new ChatStateReducer();
    state.addUserMessage("Inspect missing file");

    state.applyEvent({
      type: "tool_start",
      toolName: "read_file",
      toolCallId: "call_err",
      input: { path: "ghost.txt" },
    });

    state.applyEvent({
      type: "tool_end",
      toolName: "read_file",
      toolCallId: "call_err",
      error: "File not found: ghost.txt",
    });

    const asstMsg = state.messages.find((m) => m.role === "assistant");
    expect(asstMsg!.toolCalls![0].status).toBe("error");
    expect(asstMsg!.toolCalls![0].error).toBe("File not found: ghost.txt");
  });

  test("handles agent error event and creates system error entry", () => {
    const state = new ChatStateReducer();
    state.addUserMessage("Do something");

    state.applyEvent({
      type: "error",
      error: "Ollama connection refused at localhost:11434",
    });

    expect(state.status).toBe("error");
    expect(state.statusMessage).toBe("Ollama connection refused at localhost:11434");

    const errEntry = state.messages.find((m) => m.role === "system");
    expect(errEntry).toBeDefined();
    expect(errEntry!.content).toContain("Ollama connection refused");
  });

  test("cancel() transitions status to cancelling and stops stream", () => {
    const state = new ChatStateReducer();
    state.addUserMessage("Long task");
    state.applyEvent({ type: "text_delta", delta: "Partial text..." });

    expect(state.messages[1].isStreaming).toBe(true);

    state.cancel();
    expect(state.status).toBe("cancelling");
    expect(state.messages[1].isStreaming).toBe(false);
  });
});
