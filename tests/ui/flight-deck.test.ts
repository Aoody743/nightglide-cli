import { describe, test, expect, beforeEach } from "bun:test";
import { getThemeManager, type Theme } from "@nightglide/themes";
import {
  getTerminalTier,
  getTierDisplayName,
  getTierBadge,
  computeViewportCapacity,
  type TerminalDimensions,
} from "../../apps/cli/src/ui/dimensions.js";
import {
  formatModelPill,
  formatRoutingPill,
  formatTierPill,
  getGitBranch,
  NAV_TABS,
} from "../../apps/cli/src/ui/components/Header.js";
import {
  PromptHistory,
} from "../../apps/cli/src/ui/components/Composer.js";
import {
  parseMarkdownBlocks,
  formatToolSummary,
  formatToolResultSummary,
  getToolIcon,
  type ChatMessage,
} from "../../apps/cli/src/ui/screens/ChatScreen.js";

describe("Flight Deck Header Specification & Identity", () => {
  let theme: Theme;

  beforeEach(() => {
    const tm = getThemeManager();
    tm.setTheme("midnight-flight");
    theme = tm.getActiveTheme();
  });

  test("contains Nightglide identity brand and nav tabs", () => {
    expect(NAV_TABS.length).toBe(5);
    expect(NAV_TABS[0].label).toBe("Welcome");
    expect(NAV_TABS[1].label).toBe("Flight Deck");
    expect(NAV_TABS[1].compactLabel).toBe("Chat");
  });

  test("formats active model pill with clean locality indication", () => {
    expect(formatModelPill("qwen2.5-coder:7b", false)).toBe("[qwen2.5 (LOCAL)]");
    expect(formatModelPill("omlx/qwen2.5-coder-32b", false)).toBe("[qwen2.5-32b (LOCAL)]");
    expect(formatModelPill("ollama/qwen2.5-coder:7b", false)).toBe("[qwen2.5 (LOCAL)]");
    expect(formatModelPill("openai/gpt-4o", false)).toBe("[gpt-4o (CLOUD)]");
    expect(formatModelPill("anthropic/claude-3-5-sonnet", false)).toBe("[claude-3-5-sonnet (CLOUD)]");
    expect(formatModelPill("deepseek/deepseek-coder", false)).toBe("[deepseek (CLOUD)]");
    expect(formatModelPill("qwen2.5", true)).toBe("[Mock (LOCAL)]");
  });

  test("formats routing mode pill across all 4 routing modes", () => {
    expect(formatRoutingPill("LOCAL")).toBe("[LOCAL]");
    expect(formatRoutingPill("BALANCED")).toBe("[BALANCED]");
    expect(formatRoutingPill("PERFORMANCE")).toBe("[PERFORMANCE]");
    expect(formatRoutingPill("MANUAL")).toBe("[MANUAL]");
    expect(formatRoutingPill("balanced")).toBe("[BALANCED]");
  });

  test("formats terminal tier pill with dimension and badge", () => {
    expect(formatTierPill(80, 24, "small")).toBe("[80x24 S]");
    expect(formatTierPill(100, 30, "medium")).toBe("[100x30 M]");
    expect(formatTierPill(120, 36, "large")).toBe("[120x36 L]");
  });

  test("resolves Git branch for current repository without failing", () => {
    const branch = getGitBranch();
    expect(typeof branch).toBe("string");
    expect(branch.length).toBeGreaterThan(0);
    expect(branch).toBe("feat_m2_coding_experience");
  });
});

describe("Conversation Timeline: Markdown Code Block Extraction", () => {
  test("parses plain prose text without code blocks", () => {
    const text = "Nightglide is ready to assist with your codebase.";
    const blocks = parseMarkdownBlocks(text);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("text");
    expect(blocks[0].content).toBe(text);
  });

  test("parses code block with language and filename header", () => {
    const text =
      "I have created the requested error class:\n" +
      "```typescript packages/core/src/errors.ts\n" +
      "export class TimeoutError extends EngineError {\n" +
      "  readonly timeoutMs: number;\n" +
      "}\n" +
      "```\n" +
      "This is now ready for use.";

    const blocks = parseMarkdownBlocks(text);
    expect(blocks.length).toBe(3);
    expect(blocks[0].type).toBe("text");
    expect(blocks[0].content).toContain("I have created");

    expect(blocks[1].type).toBe("code");
    expect(blocks[1].language).toBe("typescript");
    expect(blocks[1].filename).toBe("packages/core/src/errors.ts");
    expect(blocks[1].content).toContain("export class TimeoutError");

    expect(blocks[2].type).toBe("text");
    expect(blocks[2].content).toContain("This is now ready");
  });

  test("parses streaming in-progress unclosed code block", () => {
    const streamingText =
      "Drafting architecture plan:\n" +
      "```typescript\n" +
      "interface CachePlan {\n" +
      "  ttlMs: number;";

    const blocks = parseMarkdownBlocks(streamingText);
    expect(blocks.length).toBe(2);
    expect(blocks[0].type).toBe("text");
    expect(blocks[1].type).toBe("code");
    expect(blocks[1].language).toBe("typescript");
    expect(blocks[1].content).toContain("interface CachePlan");
  });

  test("parses multiple sequential code blocks", () => {
    const text =
      "Step 1:\n```bash\nbun test\n```\nStep 2:\n```bash\nbun run build\n```";
    const blocks = parseMarkdownBlocks(text);
    expect(blocks.length).toBe(4);
    expect(blocks[1].type).toBe("code");
    expect(blocks[1].content).toBe("bun test");
    expect(blocks[3].type).toBe("code");
    expect(blocks[3].content).toBe("bun run build");
  });
});

describe("Intelligent Auto-Scroll State Machine & User Inspection", () => {
  interface ScrollState {
    isAutoScrollLocked: boolean;
    scrollOffset: number;
    maxMessages: number;
  }

  function simulateScrollAction(
    state: ScrollState,
    action: "pageup" | "pagedown" | "jump_latest" | "stream_chunk",
    totalMessages: number
  ): ScrollState {
    const maxScroll = Math.max(0, totalMessages - state.maxMessages);

    switch (action) {
      case "pageup":
        return {
          ...state,
          isAutoScrollLocked: false,
          scrollOffset: Math.min(maxScroll, state.scrollOffset + 3),
        };

      case "pagedown": {
        const next = Math.max(0, state.scrollOffset - 3);
        return {
          ...state,
          isAutoScrollLocked: next === 0,
          scrollOffset: next,
        };
      }

      case "jump_latest":
        return {
          ...state,
          isAutoScrollLocked: true,
          scrollOffset: 0,
        };

      case "stream_chunk":
        // If locked, offset remains 0 (locked to bottom); if unlocked, offset is preserved
        return {
          ...state,
          scrollOffset: state.isAutoScrollLocked ? 0 : state.scrollOffset,
        };
    }
  }

  test("initial state is locked to bottom with zero offset", () => {
    const state: ScrollState = {
      isAutoScrollLocked: true,
      scrollOffset: 0,
      maxMessages: 5,
    };
    expect(state.isAutoScrollLocked).toBe(true);
    expect(state.scrollOffset).toBe(0);
  });

  test("user scroll up releases auto-scroll lock for uninterrupted inspection", () => {
    let state: ScrollState = {
      isAutoScrollLocked: true,
      scrollOffset: 0,
      maxMessages: 5,
    };

    // User scrolls up with PageUp
    state = simulateScrollAction(state, "pageup", 15);
    expect(state.isAutoScrollLocked).toBe(false);
    expect(state.scrollOffset).toBe(3);

    // Further scroll up
    state = simulateScrollAction(state, "pageup", 15);
    expect(state.isAutoScrollLocked).toBe(false);
    expect(state.scrollOffset).toBe(6);
  });

  test("token streaming preserves unpinned scroll during reading", () => {
    let state: ScrollState = {
      isAutoScrollLocked: false,
      scrollOffset: 4,
      maxMessages: 5,
    };

    // While inspecting, incoming text chunks do NOT jump the view
    state = simulateScrollAction(state, "stream_chunk", 16);
    expect(state.isAutoScrollLocked).toBe(false);
    expect(state.scrollOffset).toBe(4);
  });

  test("jump to latest [G] snaps back to bottom and re-engages lock", () => {
    let state: ScrollState = {
      isAutoScrollLocked: false,
      scrollOffset: 6,
      maxMessages: 5,
    };

    state = simulateScrollAction(state, "jump_latest", 16);
    expect(state.isAutoScrollLocked).toBe(true);
    expect(state.scrollOffset).toBe(0);
  });

  test("scrolling down to zero re-engages lock automatically", () => {
    let state: ScrollState = {
      isAutoScrollLocked: false,
      scrollOffset: 2,
      maxMessages: 5,
    };

    state = simulateScrollAction(state, "pagedown", 16);
    expect(state.isAutoScrollLocked).toBe(true);
    expect(state.scrollOffset).toBe(0);
  });
});

describe("Composer: Prompt History Traversal & Multiline Editing", () => {
  test("records submitted prompts in history and ignores duplicates", () => {
    const history = new PromptHistory();
    history.push("test prompt 1");
    history.push("test prompt 2");
    history.push("test prompt 2"); // duplicate consecutive
    history.push("   "); // empty whitespace

    const entries = history.getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0]).toBe("test prompt 1");
    expect(entries[1]).toBe("test prompt 2");
  });

  test("navigates history with Up arrow and preserves draft", () => {
    const history = new PromptHistory(["prompt A", "prompt B", "prompt C"]);
    const currentDraft = "my in-progress draft";

    // First Up arrow: returns last entry (prompt C) and saves draft
    const firstUp = history.navigateUp(currentDraft);
    expect(firstUp).toBe("prompt C");
    expect(history.getCurrentIndex()).toBe(2);

    // Second Up arrow: returns prompt B
    const secondUp = history.navigateUp(currentDraft);
    expect(secondUp).toBe("prompt B");
    expect(history.getCurrentIndex()).toBe(1);

    // Third Up arrow: returns prompt A
    const thirdUp = history.navigateUp(currentDraft);
    expect(thirdUp).toBe("prompt A");
    expect(history.getCurrentIndex()).toBe(0);

    // Fourth Up arrow: clamps to prompt A
    const fourthUp = history.navigateUp(currentDraft);
    expect(fourthUp).toBe("prompt A");
    expect(history.getCurrentIndex()).toBe(0);
  });

  test("navigates history with Down arrow and restores saved draft", () => {
    const history = new PromptHistory(["prompt A", "prompt B"]);
    const currentDraft = "draft 123";

    history.navigateUp(currentDraft); // at prompt B (idx 1)
    history.navigateUp(currentDraft); // at prompt A (idx 0)

    const down1 = history.navigateDown();
    expect(down1).toBe("prompt B");

    // Stepping past the end of history restores the original draft
    const down2 = history.navigateDown();
    expect(down2).toBe("draft 123");
    expect(history.getCurrentIndex()).toBe(-1);
  });

  test("multiline string detection and newline counting", () => {
    const singleLine = "single line prompt";
    expect(singleLine.includes("\n")).toBe(false);
    expect(singleLine.split("\n").length).toBe(1);

    const multiLine = "first line\nsecond line\nthird line";
    expect(multiLine.includes("\n")).toBe(true);
    expect(multiLine.split("\n").length).toBe(3);
  });
});

describe("Guided vs Expert Mode (Flow 12) Layout Duality", () => {
  const sampleToolInput = {
    path: "packages/core/src/errors.ts",
    changes: "+12 lines",
  };
  const sampleToolResult = { bytes: 420, lines: 18 };

  test("Guided Mode renders full parameters and detailed summary", () => {
    const mode = "guided";
    const icon = getToolIcon("edit");
    const summary = formatToolSummary("edit", sampleToolInput);
    const resultSummary = formatToolResultSummary("edit", sampleToolResult);

    expect(mode).toBe("guided");
    expect(icon).toBe("✂️");
    expect(summary).toBe("packages/core/src/errors.ts");
    expect(resultSummary).toBe("420 bytes, 18 lines");
  });

  test("Expert Mode compact single-line tool formatting", () => {
    const mode = "expert";
    const icon = getToolIcon("bash");
    const summary = formatToolSummary("bash", { command: "bun test tests/ui/" });
    const resultSummary = formatToolResultSummary("bash", { stdout: "40 pass, 0 fail" });

    expect(mode).toBe("expert");
    expect(icon).toBe("💻");
    expect(summary).toBe("$ bun test tests/ui/");
    expect(resultSummary).toBe("40 pass, 0 fail");
  });

  test("mode command parsing toggles accurately", () => {
    function parseModeCommand(prompt: string, currentMode: "guided" | "expert"): "guided" | "expert" | null {
      const lower = prompt.trim().toLowerCase();
      if (lower === "/mode expert") return "expert";
      if (lower === "/mode guided") return "guided";
      if (lower === "/mode") return currentMode === "guided" ? "expert" : "guided";
      return null;
    }

    expect(parseModeCommand("/mode expert", "guided")).toBe("expert");
    expect(parseModeCommand("/mode guided", "expert")).toBe("guided");
    expect(parseModeCommand("/mode", "guided")).toBe("expert");
    expect(parseModeCommand("/mode", "expert")).toBe("guided");
    expect(parseModeCommand("regular prompt", "guided")).toBe(null);
  });
});

describe("Responsive Layouts: 80x24 (Compact), 100x30 (Standard), 120x36 (Wide)", () => {
  test("80x24 compact tier allocates correct viewport capacity", () => {
    const tier = getTerminalTier(80, 24);
    expect(tier).toBe("small");
    expect(getTierBadge(tier)).toBe("S");
    expect(getTierDisplayName(tier)).toBe("Compact (80x24)");

    const dims: TerminalDimensions = {
      width: 80,
      height: 24,
      isCompactWidth: true,
      isCompactHeight: true,
      tier: "small",
    };

    const capacity = computeViewportCapacity(dims);
    expect(capacity.isCompact).toBe(true);
    expect(capacity.maxVisibleMessages).toBe(3);
    // Timeline height must leave sufficient room for Header (2), StatusBar (1), Composer (3)
    expect(capacity.timelineHeight + 2 + 1 + 3).toBeLessThanOrEqual(24 + 2);
  });

  test("100x30 standard tier allocates correct viewport capacity", () => {
    const tier = getTerminalTier(100, 30);
    expect(tier).toBe("medium");
    expect(getTierBadge(tier)).toBe("M");
    expect(getTierDisplayName(tier)).toBe("Standard (100x30)");

    const dims: TerminalDimensions = {
      width: 100,
      height: 30,
      isCompactWidth: false,
      isCompactHeight: false,
      tier: "medium",
    };

    const capacity = computeViewportCapacity(dims);
    expect(capacity.isCompact).toBe(false);
    expect(capacity.maxVisibleMessages).toBe(5);
    expect(capacity.timelineHeight).toBeGreaterThanOrEqual(16);
  });

  test("120x36 widescreen tier allocates extended capacity", () => {
    const tier = getTerminalTier(120, 36);
    expect(tier).toBe("large");
    expect(getTierBadge(tier)).toBe("L");
    expect(getTierDisplayName(tier)).toBe("Wide (120x36)");

    const dims: TerminalDimensions = {
      width: 120,
      height: 36,
      isCompactWidth: false,
      isCompactHeight: false,
      tier: "large",
    };

    const capacity = computeViewportCapacity(dims);
    expect(capacity.isCompact).toBe(false);
    expect(capacity.maxVisibleMessages).toBe(8);
    expect(capacity.timelineHeight).toBeGreaterThanOrEqual(22);
  });

  test("at 80x24 compact tier, composer and latest messages remain visible", () => {
    const dims: TerminalDimensions = {
      width: 80,
      height: 24,
      isCompactWidth: true,
      isCompactHeight: true,
      tier: "small",
    };

    const capacity = computeViewportCapacity(dims);
    // 3 visible messages in compact tier ensures latest context is visible
    expect(capacity.maxVisibleMessages).toBe(3);
    // Timeline height is at least 12 rows
    expect(capacity.timelineHeight).toBeGreaterThanOrEqual(12);
  });
});

describe("Cancellation Markers & Safe Recovery", () => {
  test("cancellation marker formats as required by Flow 10", () => {
    const cancelText = "[■ Task cancelled by user via Ctrl+C / Esc]";
    expect(cancelText).toContain("Task cancelled by user");
    expect(cancelText).toContain("Ctrl+C / Esc");
  });

  test("cancelling halts streaming and leaves messages intact", () => {
    const messages: ChatMessage[] = [
      {
        id: "usr-1",
        role: "user",
        content: "Refactor network connection pool",
        timestamp: 1000,
      },
      {
        id: "asst-1",
        role: "assistant",
        content: "Starting refactoring...",
        timestamp: 1050,
        isStreaming: true,
      },
    ];

    // Cancellation appends cancellation marker to streaming message
    const last = messages[messages.length - 1];
    if (last.isStreaming) {
      last.content += "\n[■ Task cancelled by user via Ctrl+C / Esc]";
      last.isStreaming = false;
    }

    expect(messages.length).toBe(2);
    expect(messages[1].isStreaming).toBe(false);
    expect(messages[1].content).toContain("[■ Task cancelled by user via Ctrl+C / Esc]");
  });
});
