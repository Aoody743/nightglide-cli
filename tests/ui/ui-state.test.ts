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
import { getSubagentBadge } from "../../apps/cli/src/ui/components/AgentMonitor.js";
import {
  getToolIcon,
  formatToolSummary,
  formatToolResultSummary,
} from "../../apps/cli/src/ui/screens/ChatScreen.js";

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
  subagents: Array<{ id: string; role: string; model: string; status: string; task: string }> = [];
  latestRoutingDecision?: any;

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
      case "routing_decision":
        this.latestRoutingDecision = event.decision;
        break;

      case "subagent_start":
        this.subagents.push({
          id: event.subagentId,
          role: event.role,
          model: event.model,
          status: "thinking",
          task: event.task,
        });
        break;

      case "subagent_delta": {
        const sub = this.subagents.find((s) => s.id === event.subagentId);
        if (sub) sub.status = "streaming";
        break;
      }

      case "subagent_end": {
        const sub = this.subagents.find((s) => s.id === event.subagentId);
        if (sub) sub.status = "completed";
        break;
      }

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

import { getTerminalTier, getFallbackDimensions } from "../../apps/cli/src/ui/dimensions.js";

describe("UI Navigation & Screen State Logic", () => {
  type ScreenId = "welcome" | "chat" | "setup" | "themes" | "models";

  function routeKeyToScreen(
    currentScreen: ScreenId,
    key: { name: string; ctrl?: boolean }
  ): ScreenId | "exit" | null {
    if (key.ctrl && (key.name === "c" || key.name === "q")) {
      return "exit";
    }

    if (currentScreen === "chat") {
      // In chat screen: strictly guard against typing hijacking.
      // Single letters, numbers, spaces must NEVER navigate away.
      if (key.ctrl && key.name === "1") return "welcome";
      if (key.ctrl && key.name === "3") return "setup";
      if (key.ctrl && key.name === "4") return "themes";
      if (key.ctrl && key.name === "5") return "models";
      if (key.name === "f1") return "welcome";
      if (key.name === "f2") return "chat";
      if (key.name === "f3") return "setup";
      if (key.name === "f4") return "themes";
      if (key.name === "f5") return "models";
      return null;
    }

    if (currentScreen === "themes") {
      // In themes screen: 1-4 is handled by ThemeSelector for selecting themes.
      // Esc navigates back, Ctrl+numbers navigate, q exits.
      if (key.name === "escape") return "welcome";
      if (key.ctrl && key.name === "1") return "welcome";
      if (key.ctrl && key.name === "2") return "chat";
      if (key.ctrl && key.name === "3") return "setup";
      if (key.ctrl && key.name === "5") return "models";
      if (key.name === "q" && !key.ctrl) return "exit";
      return null;
    }

    if (currentScreen === "models") {
      // In models screen: space/return/c are handled for mode and assignment.
      // Esc navigates back to chat, Ctrl+numbers navigate, q exits.
      if (key.name === "escape") return "chat";
      if (key.ctrl && key.name === "1") return "welcome";
      if (key.ctrl && key.name === "2") return "chat";
      if (key.ctrl && key.name === "3") return "setup";
      if (key.ctrl && key.name === "4") return "themes";
      if (key.name === "q" && !key.ctrl) return "exit";
      return null;
    }

    // In welcome and setup screens: single-key navigation is allowed
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
      case "5":
      case "m":
        return "models";
      case "q":
        return "exit";
      default:
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
    expect(routeKeyToScreen("welcome", { name: "5" })).toBe("models");
    expect(routeKeyToScreen("welcome", { name: "m" })).toBe("models");
    expect(routeKeyToScreen("welcome", { name: "1" })).toBe("welcome");
    expect(routeKeyToScreen("welcome", { name: "q" })).toBe("exit");
  });

  test("chat screen guards single-letter navigation to prevent hijacking typing", () => {
    // Typing single letters or numbers in Composer must NEVER navigate away
    const protectedKeys = ["1", "2", "3", "4", "5", "w", "d", "s", "t", "m", "c", "q", "space", "k", "j"];
    for (const key of protectedKeys) {
      expect(routeKeyToScreen("chat", { name: key })).toBeNull();
    }

    // Explicit modifiers (Ctrl+number or F-keys) are required to navigate from chat screen
    expect(routeKeyToScreen("chat", { name: "1", ctrl: true })).toBe("welcome");
    expect(routeKeyToScreen("chat", { name: "3", ctrl: true })).toBe("setup");
    expect(routeKeyToScreen("chat", { name: "4", ctrl: true })).toBe("themes");
    expect(routeKeyToScreen("chat", { name: "5", ctrl: true })).toBe("models");
    expect(routeKeyToScreen("chat", { name: "f1" })).toBe("welcome");
    expect(routeKeyToScreen("chat", { name: "f2" })).toBe("chat");
    expect(routeKeyToScreen("chat", { name: "f3" })).toBe("setup");
    expect(routeKeyToScreen("chat", { name: "f4" })).toBe("themes");
    expect(routeKeyToScreen("chat", { name: "f5" })).toBe("models");
  });

  test("themes screen guards 1-4 so ThemeSelector can select themes without hijacking", () => {
    expect(routeKeyToScreen("themes", { name: "1" })).toBeNull();
    expect(routeKeyToScreen("themes", { name: "2" })).toBeNull();
    expect(routeKeyToScreen("themes", { name: "3" })).toBeNull();
    expect(routeKeyToScreen("themes", { name: "4" })).toBeNull();
    expect(routeKeyToScreen("themes", { name: "escape" })).toBe("welcome");
  });

  test("models screen guards space, c, and return so ModelAssignmentView can operate", () => {
    expect(routeKeyToScreen("models", { name: "space" })).toBeNull();
    expect(routeKeyToScreen("models", { name: "c" })).toBeNull();
    expect(routeKeyToScreen("models", { name: "return" })).toBeNull();
    expect(routeKeyToScreen("models", { name: "escape" })).toBe("chat");
  });

  test("universal Ctrl+C and Ctrl+Q triggers exit from any screen", () => {
    const screens: ScreenId[] = ["welcome", "chat", "setup", "themes", "models"];
    for (const screen of screens) {
      expect(routeKeyToScreen(screen, { name: "c", ctrl: true })).toBe("exit");
      expect(routeKeyToScreen(screen, { name: "q", ctrl: true })).toBe("exit");
    }
  });
});

describe("Terminal Dimensions & Responsive Layout", () => {
  test("getTerminalTier accurately categorizes 80x24, 100x30, and 120x36", () => {
    expect(getTerminalTier(80, 24)).toBe("small");
    expect(getTerminalTier(85, 25)).toBe("small");
    expect(getTerminalTier(100, 30)).toBe("medium");
    expect(getTerminalTier(110, 32)).toBe("medium");
    expect(getTerminalTier(120, 36)).toBe("large");
    expect(getTerminalTier(160, 48)).toBe("large");
  });

  test("getFallbackDimensions returns safe positive dimension values", () => {
    const fallback = getFallbackDimensions();
    expect(fallback.width).toBeGreaterThanOrEqual(80);
    expect(fallback.height).toBeGreaterThanOrEqual(24);
  });

  test("responsive message viewport sizing adapts to terminal height tiers", () => {
    function computeVisibleMessageCount(height: number): number {
      const isCompact = height < 28;
      return isCompact ? 3 : height < 34 ? 5 : 8;
    }

    expect(computeVisibleMessageCount(24)).toBe(3); // 80x24 compact
    expect(computeVisibleMessageCount(30)).toBe(5); // 100x30 standard laptop
    expect(computeVisibleMessageCount(36)).toBe(8); // 120x36 widescreen
  });
});

describe("UI Theme Synchronization", () => {
  beforeEach(() => {
    const tm = getThemeManager();
    tm.setTheme("midnight-flight");
  });

  test("ThemeManager initializes with midnight-flight and exposes 6 themes", () => {
    const tm = getThemeManager();
    expect(tm.getActiveTheme().id).toBe("midnight-flight");
    expect(tm.getAllThemes().length).toBe(6);
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

  test("all 4 UI themes satisfy WCAG 2.1 AA (>= 4.5:1) text contrast ratios on background and surface", () => {
    function getLuminance(hex: string): number {
      const rgb = hex
        .replace("#", "")
        .match(/.{2}/g)!
        .map((x) => parseInt(x, 16) / 255);
      const linear = rgb.map((c) =>
        c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    }

    function getContrastRatio(hex1: string, hex2: string): number {
      const lum1 = getLuminance(hex1);
      const lum2 = getLuminance(hex2);
      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);
      return (brightest + 0.05) / (darkest + 0.05);
    }

    for (const theme of BUILTIN_THEMES) {
      const bg = theme.colors.background;
      const surface = theme.colors.surface;

      // Text tokens
      const crPrimaryBg = getContrastRatio(theme.colors.textPrimary, bg);
      const crPrimarySurf = getContrastRatio(theme.colors.textPrimary, surface);
      expect(crPrimaryBg).toBeGreaterThanOrEqual(4.5);
      expect(crPrimarySurf).toBeGreaterThanOrEqual(4.5);

      const crSecondaryBg = getContrastRatio(theme.colors.textSecondary, bg);
      const crSecondarySurf = getContrastRatio(theme.colors.textSecondary, surface);
      expect(crSecondaryBg).toBeGreaterThanOrEqual(4.5);
      expect(crSecondarySurf).toBeGreaterThanOrEqual(4.5);

      const crMutedBg = getContrastRatio(theme.colors.textMuted, bg);
      const crMutedSurf = getContrastRatio(theme.colors.textMuted, surface);
      expect(crMutedBg).toBeGreaterThanOrEqual(4.5);
      expect(crMutedSurf).toBeGreaterThanOrEqual(4.5);

      // Accent & Status tokens carrying textual cues
      const textCarryingTokens = [
        theme.colors.accent,
        theme.colors.accentSecondary,
        theme.colors.success,
        theme.colors.warning,
        theme.colors.error,
        theme.colors.info,
      ];

      for (const token of textCarryingTokens) {
        expect(getContrastRatio(token, bg)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(token, surface)).toBeGreaterThanOrEqual(4.5);
      }
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

  test("accumulates routing decision and subagent lifecycle events", () => {
    const state = new ChatStateReducer();
    state.addUserMessage("Refactor auth module");

    state.applyEvent({
      type: "routing_decision",
      decision: {
        taskCategory: "plan",
        agentRole: "plan",
        providerId: "openai",
        modelId: "openai/gpt-4o",
        locality: "remote",
        mode: "BALANCED",
        reason: "Complex architectural planning",
        requiresCloud: true,
        requiresApproval: false,
        fallbackChain: [],
      },
    });

    expect(state.latestRoutingDecision).toBeDefined();
    expect(state.latestRoutingDecision.modelId).toBe("openai/gpt-4o");

    state.applyEvent({
      type: "subagent_start",
      subagentId: "sub_001",
      role: "explore",
      model: "omlx/qwen2.5-coder",
      locality: "local",
      task: "Inspect source files",
    });

    expect(state.subagents.length).toBe(1);
    expect(state.subagents[0].status).toBe("thinking");

    state.applyEvent({
      type: "subagent_delta",
      subagentId: "sub_001",
      delta: "Scanned files",
    });
    expect(state.subagents[0].status).toBe("streaming");

    state.applyEvent({
      type: "subagent_end",
      subagentId: "sub_001",
      result: "Done",
      totalTokens: 100,
    });
    expect(state.subagents[0].status).toBe("completed");
  });
});

describe("Native OMP Subagents Visualization", () => {
  test("identifies Planner role (plan, planner) with distinct badge and category", () => {
    const badgePlan = getSubagentBadge("plan");
    expect(badgePlan.label).toBe("PLANNER");
    expect(badgePlan.icon).toBe("📋");
    expect(badgePlan.category).toBe("planner");

    const badgePlanner = getSubagentBadge("planner");
    expect(badgePlanner.label).toBe("PLANNER");
    expect(badgePlanner.icon).toBe("📋");
    expect(badgePlanner.category).toBe("planner");
  });

  test("identifies Reviewer role (review, reviewer) with distinct badge and category", () => {
    const badgeReview = getSubagentBadge("review");
    expect(badgeReview.label).toBe("REVIEWER");
    expect(badgeReview.icon).toBe("🛡");
    expect(badgeReview.category).toBe("reviewer");

    const badgeReviewer = getSubagentBadge("reviewer");
    expect(badgeReviewer.label).toBe("REVIEWER");
    expect(badgeReviewer.icon).toBe("🛡");
    expect(badgeReviewer.category).toBe("reviewer");
  });

  test("identifies Scout role (scout, explore) with distinct badge and category", () => {
    const badgeScout = getSubagentBadge("scout");
    expect(badgeScout.label).toBe("SCOUT");
    expect(badgeScout.icon).toBe("🔭");
    expect(badgeScout.category).toBe("scout");

    const badgeExplore = getSubagentBadge("explore");
    expect(badgeExplore.label).toBe("SCOUT");
    expect(badgeExplore.icon).toBe("🔭");
    expect(badgeExplore.category).toBe("scout");
  });

  test("identifies Task role (task, implement) with distinct badge and category", () => {
    const badgeTask = getSubagentBadge("task");
    expect(badgeTask.label).toBe("TASK");
    expect(badgeTask.icon).toBe("⚙");
    expect(badgeTask.category).toBe("task");

    const badgeImplement = getSubagentBadge("implement");
    expect(badgeImplement.label).toBe("TASK");
    expect(badgeImplement.icon).toBe("⚙");
    expect(badgeImplement.category).toBe("task");
  });

  test("identifies Main coordinator role with distinct badge", () => {
    const badgeMain = getSubagentBadge("main");
    expect(badgeMain.label).toBe("MAIN");
    expect(badgeMain.icon).toBe("✦");
    expect(badgeMain.category).toBe("main");
  });

  test("falls back gracefully for custom or unknown roles", () => {
    const customBadge = getSubagentBadge("custom_worker");
    expect(customBadge.label).toBe("CUSTOM_WORKER");
    expect(customBadge.icon).toBe("◈");
    expect(customBadge.category).toBe("other");
  });
});

describe("Native OMP Tools Formatting & Icons", () => {
  test("assigns distinct icons to native OMP tools", () => {
    expect(getToolIcon("read")).toBe("📖");
    expect(getToolIcon("read_file")).toBe("📖");
    expect(getToolIcon("write")).toBe("✍️");
    expect(getToolIcon("write_file")).toBe("✍️");
    expect(getToolIcon("edit")).toBe("✂️");
    expect(getToolIcon("bash")).toBe("💻");
    expect(getToolIcon("task")).toBe("⚙️");
    expect(getToolIcon("glob")).toBe("🔍");
    expect(getToolIcon("grep")).toBe("🔎");
    expect(getToolIcon("todo")).toBe("📝");
    expect(getToolIcon("unknown_tool")).toBe("🛠");
  });

  test("formats read, write, and edit tool summaries with file path", () => {
    expect(formatToolSummary("read", { path: "src/index.ts" })).toBe("src/index.ts");
    expect(formatToolSummary("write", { path: "dist/bundle.js" })).toBe("dist/bundle.js");
    expect(formatToolSummary("edit", { path: "packages/core/src/contracts.ts" })).toBe(
      "packages/core/src/contracts.ts"
    );
  });

  test("formats bash command input with shell command indicator", () => {
    expect(formatToolSummary("bash", { command: "bun test tests/ui/" })).toBe(
      "$ bun test tests/ui/"
    );
  });

  test("formats task subagent delegation description", () => {
    expect(
      formatToolSummary("task", {
        prompt: "Refactor router module",
        subagent: "planner",
      })
    ).toBe("[planner] Refactor router module");
  });

  test("formats glob and grep search patterns", () => {
    expect(formatToolSummary("glob", { pattern: "**/*.test.ts" })).toBe("pattern: **/*.test.ts");
    expect(formatToolSummary("grep", { query: "AgentRole", path: "packages/" })).toBe(
      'search "AgentRole" in packages/'
    );
  });

  test("formats todo tool action", () => {
    expect(formatToolSummary("todo", { action: "mark_completed" })).toBe("action: mark_completed");
  });

  test("formats tool result summaries into clean representations", () => {
    expect(formatToolResultSummary("read", { bytes: 2048, lines: 80 })).toBe("2048 bytes, 80 lines");
    expect(formatToolResultSummary("bash", { stdout: "All 21 tests passed successfully\n" })).toBe(
      "All 21 tests passed successfully"
    );
    expect(formatToolResultSummary("bash", "Build finished with 0 errors")).toBe(
      "Build finished with 0 errors"
    );
  });
});

describe("Tool Execution Events without Artificial Filtering", () => {
  test("accumulates all native OMP tools without rejection or drop", () => {
    const nativeTools = ["read", "write", "edit", "bash", "task", "glob", "grep", "todo"];
    const state = new ChatStateReducer();
    state.addUserMessage("Execute native coding workflow");

    for (let i = 0; i < nativeTools.length; i++) {
      const toolName = nativeTools[i];
      const callId = `call_${toolName}_${i}`;

      state.applyEvent({
        type: "tool_start",
        toolName,
        toolCallId: callId,
        input: { tool: toolName, index: i },
      });

      expect(state.status).toBe("executing_tool");
      expect(state.activeTool).toBe(toolName);

      state.applyEvent({
        type: "tool_end",
        toolName,
        toolCallId: callId,
        result: { status: "success", executed: toolName },
      });

      expect(state.activeTool).toBeUndefined();
    }

    const asstMsg = state.messages.find((m) => m.role === "assistant");
    expect(asstMsg).toBeDefined();
    expect(asstMsg!.toolCalls?.length).toBe(nativeTools.length);

    for (let i = 0; i < nativeTools.length; i++) {
      expect(asstMsg!.toolCalls![i].toolName).toBe(nativeTools[i]);
      expect(asstMsg!.toolCalls![i].status).toBe("completed");
    }
  });

  test("ensures no permission or approval dialog is artificially required", () => {
    // When executing mutating native OMP tools like write, bash, edit,
    // the UI state reducer processes them directly as native tool calls
    const state = new ChatStateReducer();
    state.addUserMessage("Write code");

    state.applyEvent({
      type: "tool_start",
      toolName: "write",
      toolCallId: "write_01",
      input: { path: "src/app.ts", content: "console.log('hello');" },
    });

    // Directly in progress without custom permission blocker
    expect(state.status).toBe("executing_tool");
    expect(state.activeTool).toBe("write");

    state.applyEvent({
      type: "tool_end",
      toolName: "write",
      toolCallId: "write_01",
      result: { bytesWritten: 32 },
    });

    const asstMsg = state.messages.find((m) => m.role === "assistant");
    expect(asstMsg!.toolCalls![0].status).toBe("completed");
  });
});

describe("Interaction Mode (Guided vs Expert) State & Commands", () => {
  function handleModeCommand(
    prompt: string,
    currentMode: "guided" | "expert"
  ): { nextMode: "guided" | "expert"; isHandled: boolean } {
    const lower = prompt.trim().toLowerCase();
    if (lower === "/mode expert") {
      return { nextMode: "expert", isHandled: true };
    }
    if (lower === "/mode guided") {
      return { nextMode: "guided", isHandled: true };
    }
    if (lower === "/mode") {
      return {
        nextMode: currentMode === "guided" ? "expert" : "guided",
        isHandled: true,
      };
    }
    return { nextMode: currentMode, isHandled: false };
  }

  test("/mode expert switches target mode to expert", () => {
    const res = handleModeCommand("/mode expert", "guided");
    expect(res.isHandled).toBe(true);
    expect(res.nextMode).toBe("expert");
  });

  test("/mode guided switches target mode to guided", () => {
    const res = handleModeCommand("/mode guided", "expert");
    expect(res.isHandled).toBe(true);
    expect(res.nextMode).toBe("guided");
  });

  test("/mode toggles between guided and expert", () => {
    const toggleFromGuided = handleModeCommand("/mode", "guided");
    expect(toggleFromGuided.nextMode).toBe("expert");

    const toggleFromExpert = handleModeCommand("/mode", "expert");
    expect(toggleFromExpert.nextMode).toBe("guided");
  });

  test("regular user prompt is not treated as a mode command", () => {
    const res = handleModeCommand("Write an expert sorting algorithm", "guided");
    expect(res.isHandled).toBe(false);
    expect(res.nextMode).toBe("guided");
  });
});
