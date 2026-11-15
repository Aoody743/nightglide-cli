import { describe, test, expect, mock } from "bun:test";
import React from "react";
import { BUILTIN_THEMES, type Theme } from "@nightglide/themes";
import type { FileDiffData, ApprovalAnswer } from "@nightglide/core";

// Diff exports
import {
  parseUnifiedDiff,
  parseFileDiff,
  formatHunkHeader,
  formatChangeStats,
  truncateLine,
  wrapLine,
  formatGutterLineNumber,
  DiffViewer,
  NativeDiffView,
} from "../../apps/cli/src/ui/components/diff/index.js";

// Tool & Approval exports
import {
  getToolCategory,
  getToolIcon,
  getToolBadge,
  formatToolSummary,
  formatToolResultSummary,
  formatToolDuration,
  isDestructiveOrHighRisk,
  ToolCard,
  CompactToolCard,
  ExpandedToolCard,
  ApprovalPromptView,
  NativeApprovalGate,
  handleApprovalKey,
} from "../../apps/cli/src/ui/components/tools/index.js";

const theme: Theme = BUILTIN_THEMES[0]; // Midnight Flight

const SAMPLE_UNIFIED_DIFF = `--- a/packages/core/src/errors.ts
+++ b/packages/core/src/errors.ts
@@ -42,6 +42,18 @@ export class EngineError extends NightglideError {
    }
  }

+export class TimeoutError extends EngineError {
+  readonly timeoutMs: number;
+  constructor(timeoutMs: number, message?: string) {
+    super(message || \`Timeout after \${timeoutMs}ms\`, "TIMEOUT_ERROR", true);
+    this.name = "TimeoutError";
+    this.timeoutMs = timeoutMs;
+  }
+}
+
 export class SecurityError extends NightglideError {
-  readonly code = "OLD_SEC_ERR";
+  readonly code = "SECURITY_VIOLATION";
`;

describe("Terminal Diff Viewer - Unified Diff Parsing & Formatting", () => {
  test("parses unified diff header and extracts file paths", () => {
    const parsed = parseUnifiedDiff(SAMPLE_UNIFIED_DIFF);
    expect(parsed.oldPath).toBe("packages/core/src/errors.ts");
    expect(parsed.newPath).toBe("packages/core/src/errors.ts");
    expect(parsed.filePath).toBe("packages/core/src/errors.ts");
  });

  test("calculates additions, deletions, and hunks accurately", () => {
    const parsed = parseUnifiedDiff(SAMPLE_UNIFIED_DIFF);
    expect(parsed.hunks.length).toBe(1);
    expect(parsed.additions).toBe(10);
    expect(parsed.deletions).toBe(1);

    const hunk = parsed.hunks[0];
    expect(hunk.oldStart).toBe(42);
    expect(hunk.oldCount).toBe(6);
    expect(hunk.newStart).toBe(42);
    expect(hunk.newCount).toBe(18);
    expect(hunk.section).toBe("export class EngineError extends NightglideError {");
  });

  test("assigns accurate line numbers to additions, deletions, and context lines", () => {
    const parsed = parseUnifiedDiff(SAMPLE_UNIFIED_DIFF);
    const hunk = parsed.hunks[0];

    // First line is context: `   }`
    const contextLine = hunk.lines[0];
    expect(contextLine.type).toBe("context");
    expect(contextLine.oldLineNumber).toBe(42);
    expect(contextLine.newLineNumber).toBe(42);

    // Added lines have newLineNumber and undefined oldLineNumber
    const addedLine = hunk.lines.find(
      (l) => l.type === "add" && l.content.includes("class TimeoutError")
    );
    expect(addedLine).toBeDefined();
    expect(addedLine?.oldLineNumber).toBeUndefined();
    expect(typeof addedLine?.newLineNumber).toBe("number");
    expect(addedLine?.newLineNumber).toBeGreaterThanOrEqual(44);

    // Deleted line has oldLineNumber and undefined newLineNumber
    const deletedLine = hunk.lines.find((l) => l.type === "delete");
    expect(deletedLine).toBeDefined();
    expect(typeof deletedLine?.oldLineNumber).toBe("number");
    expect(deletedLine?.newLineNumber).toBeUndefined();
    expect(deletedLine?.content).toContain('readonly code = "OLD_SEC_ERR"');
  });

  test("parses FileDiffData object and preserves structured attributes", () => {
    const fileDiffData: FileDiffData = {
      filePath: "src/utils.ts",
      diff: `@@ -1,3 +1,4 @@\n context\n-old\n+new1\n+new2\n`,
      additions: 2,
      deletions: 1,
    };

    const parsed = parseFileDiff(fileDiffData);
    expect(parsed.filePath).toBe("src/utils.ts");
    expect(parsed.additions).toBe(2);
    expect(parsed.deletions).toBe(1);
    expect(parsed.hunks.length).toBe(1);
  });

  test("handles empty or null diff inputs gracefully", () => {
    const parsedEmpty = parseFileDiff(null, "default.ts");
    expect(parsedEmpty.filePath).toBe("default.ts");
    expect(parsedEmpty.additions).toBe(0);
    expect(parsedEmpty.deletions).toBe(0);
    expect(parsedEmpty.hunks.length).toBe(0);
    expect(parsedEmpty.allLines.length).toBe(0);
  });

  test("formats hunk header string correctly", () => {
    const headerWithSection = formatHunkHeader(1, 5, 1, 7, "function test()");
    expect(headerWithSection).toBe("@@ -1,5 +1,7 @@ function test()");

    const headerSingle = formatHunkHeader(10, 1, 10, 1);
    expect(headerSingle).toBe("@@ -10 +10 @@");
  });

  test("formats change stats (+additions, -deletions)", () => {
    expect(formatChangeStats(12, 2)).toBe("(+12, -2)");
    expect(formatChangeStats(5, 0)).toBe("(+5)");
    expect(formatChangeStats(0, 3)).toBe("(-3)");
    expect(formatChangeStats(0, 0)).toBe("(+0)");
  });

  test("formats gutter line numbers with right-aligned padding", () => {
    expect(formatGutterLineNumber(42, 4)).toBe("  42");
    expect(formatGutterLineNumber(1, 4)).toBe("   1");
    expect(formatGutterLineNumber(1024, 4)).toBe("1024");
    expect(formatGutterLineNumber(undefined, 4)).toBe("    ");
  });
});

describe("Terminal Diff Viewer - Visual Styling & Component Tree", () => {
  test("DiffViewer instantiates valid React element with props", () => {
    const element = React.createElement(DiffViewer, {
      diff: SAMPLE_UNIFIED_DIFF,
      filePath: "packages/core/src/errors.ts",
      theme,
      width: 100,
      showLineNumbers: true,
    });

    expect(element.type).toBe(DiffViewer);
    expect(element.props.diff).toBe(SAMPLE_UNIFIED_DIFF);
    expect(element.props.filePath).toBe("packages/core/src/errors.ts");
    expect(element.props.width).toBe(100);
  });

  test("NativeDiffView creates native <diff> element mapping theme colors", () => {
    const element = React.createElement(NativeDiffView, {
      diff: SAMPLE_UNIFIED_DIFF,
      theme,
      showLineNumbers: true,
      viewMode: "unified",
    });

    expect(element.type).toBe(NativeDiffView);
    expect(element.props.theme.colors.success).toBe(theme.colors.success);
    expect(element.props.theme.colors.error).toBe(theme.colors.error);
  });
});

describe("Native Tool Event Cards - Tool Formatting & State Badges", () => {
  test("identifies semantic categories for native OMP tools", () => {
    expect(getToolCategory("read")).toBe("read");
    expect(getToolCategory("read_file")).toBe("read");
    expect(getToolCategory("write")).toBe("write");
    expect(getToolCategory("write_file")).toBe("write");
    expect(getToolCategory("edit")).toBe("edit");
    expect(getToolCategory("edit_file")).toBe("edit");
    expect(getToolCategory("bash")).toBe("bash");
    expect(getToolCategory("run_command")).toBe("bash");
    expect(getToolCategory("task")).toBe("task");
    expect(getToolCategory("glob")).toBe("glob");
    expect(getToolCategory("grep")).toBe("grep");
    expect(getToolCategory("todo")).toBe("todo");
    expect(getToolCategory("unknown_tool")).toBe("custom");
  });

  test("assigns distinct visual icons for tools", () => {
    expect(getToolIcon("read")).toBe("📖");
    expect(getToolIcon("write")).toBe("✍️");
    expect(getToolIcon("edit")).toBe("✂️");
    expect(getToolIcon("bash")).toBe("💻");
    expect(getToolIcon("task")).toBe("⚙️");
    expect(getToolIcon("glob")).toBe("🔍");
    expect(getToolIcon("grep")).toBe("🔎");
    expect(getToolIcon("todo")).toBe("📝");
    expect(getToolIcon("custom")).toBe("🛠");
  });

  test("maps tool statuses to distinct badges and semantic colors", () => {
    const running = getToolBadge("running", theme);
    expect(running.label).toBe("EXECUTING");
    expect(running.icon).toBe("●");
    expect(running.color).toBe(theme.colors.warning);

    const completed = getToolBadge("completed", theme);
    expect(completed.label).toBe("COMPLETED");
    expect(completed.icon).toBe("✔");
    expect(completed.color).toBe(theme.colors.success);

    const error = getToolBadge("error", theme);
    expect(error.label).toBe("ERROR");
    expect(error.icon).toBe("✖");
    expect(error.color).toBe(theme.colors.error);
  });

  test("formats tool input summaries cleanly", () => {
    expect(formatToolSummary("read", { path: "src/app.ts" })).toBe("src/app.ts");
    expect(formatToolSummary("write", { path: "src/out.ts" })).toBe("src/out.ts");
    expect(formatToolSummary("edit", { path: "src/index.ts" })).toBe("src/index.ts");
    expect(formatToolSummary("bash", { command: "bun test" })).toBe("$ bun test");
    expect(
      formatToolSummary("task", { subagent: "scout", prompt: "explore codebase" })
    ).toBe("[scout] explore codebase");
    expect(formatToolSummary("glob", { pattern: "**/*.test.ts" })).toBe(
      "pattern: **/*.test.ts"
    );
    expect(formatToolSummary("grep", { query: "EngineError", path: "src" })).toBe(
      'search "EngineError" in src'
    );
    expect(formatToolSummary("todo", { action: "mark_done" })).toBe("action: mark_done");
  });

  test("formats tool result summaries and handles objects and stdout", () => {
    expect(formatToolResultSummary("read", "file contents line 1\nline 2")).toBe(
      "file contents line 1 line 2"
    );
    expect(
      formatToolResultSummary("bash", { stdout: "Tests: 40 passed\nDuration: 12ms" })
    ).toBe("Tests: 40 passed Duration: 12ms");
    expect(formatToolResultSummary("read", { bytes: 2048, lines: 50 })).toBe(
      "2048 bytes, 50 lines"
    );
  });

  test("formats tool durations into clean human units", () => {
    expect(formatToolDuration(14)).toBe("14ms");
    expect(formatToolDuration(999)).toBe("999ms");
    expect(formatToolDuration(1500)).toBe("1.5s");
    expect(formatToolDuration(undefined)).toBe("");
  });

  test("correctly identifies destructive and high-risk tool operations", () => {
    expect(isDestructiveOrHighRisk("bash", { command: "rm -rf temp" })).toBe(true);
    expect(isDestructiveOrHighRisk("edit", { path: "src/app.ts" })).toBe(true);
    expect(isDestructiveOrHighRisk("write", { path: "src/new.ts" })).toBe(true);
    expect(isDestructiveOrHighRisk("read", { path: "src/app.ts" })).toBe(false);
    expect(isDestructiveOrHighRisk("glob", { pattern: "*.ts" })).toBe(false);
  });

  test("instantiates ToolCard in both compact and expanded modes", () => {
    const compactCard = React.createElement(ToolCard, {
      toolName: "read",
      input: { path: "packages/core/src/errors.ts" },
      status: "completed",
      durationMs: 14,
      mode: "compact",
      theme,
    });
    expect(compactCard.type).toBe(ToolCard);
    expect(compactCard.props.mode).toBe("compact");

    const expandedCard = React.createElement(ToolCard, {
      toolName: "edit",
      input: { path: "packages/core/src/errors.ts" },
      status: "running",
      mode: "expanded",
      theme,
    });
    expect(expandedCard.type).toBe(ToolCard);
    expect(expandedCard.props.mode).toBe("expanded");
  });
});

describe("Native Approval Gate UI - Action Handling & Permissions", () => {
  test("resolves 'once' when 'y' or 'Y' is pressed", () => {
    const resolve = mock((ans: ApprovalAnswer) => {});

    expect(handleApprovalKey({ name: "y" }, resolve)).toBe(true);
    expect(resolve).toHaveBeenCalledWith("once");

    resolve.mockClear();
    expect(handleApprovalKey({ name: "Y" }, resolve)).toBe(true);
    expect(resolve).toHaveBeenCalledWith("once");
  });

  test("resolves 'session' when 'a' or 'A' is pressed", () => {
    const resolve = mock((ans: ApprovalAnswer) => {});

    expect(handleApprovalKey({ name: "a" }, resolve)).toBe(true);
    expect(resolve).toHaveBeenCalledWith("session");

    resolve.mockClear();
    expect(handleApprovalKey({ name: "A" }, resolve)).toBe(true);
    expect(resolve).toHaveBeenCalledWith("session");
  });

  test("resolves 'deny' when 'n' or 'N' is pressed", () => {
    const resolve = mock((ans: ApprovalAnswer) => {});

    expect(handleApprovalKey({ name: "n" }, resolve)).toBe(true);
    expect(resolve).toHaveBeenCalledWith("deny");

    resolve.mockClear();
    expect(handleApprovalKey({ name: "N" }, resolve)).toBe(true);
    expect(resolve).toHaveBeenCalledWith("deny");
  });

  test("resolves 'deny' when 'Escape' or 'Esc' is pressed", () => {
    const resolve = mock((ans: ApprovalAnswer) => {});

    expect(handleApprovalKey({ name: "escape" }, resolve)).toBe(true);
    expect(resolve).toHaveBeenCalledWith("deny");

    resolve.mockClear();
    expect(handleApprovalKey({ name: "esc" }, resolve)).toBe(true);
    expect(resolve).toHaveBeenCalledWith("deny");
  });

  test("ignores unrelated keys without resolving", () => {
    const resolve = mock((ans: ApprovalAnswer) => {});

    expect(handleApprovalKey({ name: "x" }, resolve)).toBe(false);
    expect(handleApprovalKey({ name: "space" }, resolve)).toBe(false);
    expect(handleApprovalKey({ name: "enter" }, resolve)).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
  });

  test("ApprovalPromptView and NativeApprovalGate instantiate valid component elements", () => {
    const resolve = mock((ans: ApprovalAnswer) => {});

    const view = React.createElement(ApprovalPromptView, {
      toolName: "bash",
      input: { command: "bun test" },
      resolve,
      theme,
    });
    expect(view.type).toBe(ApprovalPromptView);
    expect(view.props.toolName).toBe("bash");

    const gate = React.createElement(NativeApprovalGate, {
      toolName: "edit",
      input: { path: "src/app.ts" },
      diff: SAMPLE_UNIFIED_DIFF,
      resolve,
      theme,
    });
    expect(gate.type).toBe(NativeApprovalGate);
    expect(gate.props.toolName).toBe("edit");
  });
});

describe("Responsive Narrow-Terminal Fallback (<80 cols)", () => {
  test("truncateLine shortens long lines and appends ellipsis", () => {
    const text = "This is a very long file path that exceeds narrow terminal width";
    const truncated = truncateLine(text, 25);
    expect(truncated.length).toBeLessThanOrEqual(25);
    expect(truncated.endsWith("…")).toBe(true);
    expect(truncated).toBe("This is a very long file…");
  });

  test("truncateLine keeps lines untouched if within maxWidth", () => {
    const shortText = "short.ts";
    expect(truncateLine(shortText, 25)).toBe("short.ts");
  });

  test("truncateLine handles boundary conditions safely", () => {
    expect(truncateLine("test", 0)).toBe("");
    expect(truncateLine("test", -5)).toBe("");
    expect(truncateLine("test", 1)).toBe("t");
  });

  test("wrapLine splits long lines into multiple width-constrained chunks", () => {
    const longCode = "export class VeryLongClassNameWithMultipleGenericParameters<T, U, V>";
    const chunks = wrapLine(longCode, 20);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(20);
    }
    expect(chunks.join("")).toBe(longCode);
  });

  test("DiffViewer and CompactToolCard adapt cleanly to narrow width (<80 cols)", () => {
    const narrowDims = {
      width: 60,
      height: 24,
      isCompactWidth: true,
      isCompactHeight: true,
      tier: "small" as const,
    };

    const diffEl = React.createElement(DiffViewer, {
      diff: SAMPLE_UNIFIED_DIFF,
      theme,
      dimensions: narrowDims,
      width: 60,
    });
    expect(diffEl.props.width).toBe(60);

    const toolEl = React.createElement(CompactToolCard, {
      toolName: "read",
      input: { path: "packages/core/src/extremely/long/nested/path/to/module/errors.ts" },
      status: "completed",
      theme,
      dimensions: narrowDims,
    });
    expect(toolEl.props.dimensions?.width).toBe(60);
  });

  test("parses and handles multi-hunk unified diff with non-consecutive line numbers", () => {
    const MULTI_HUNK_DIFF = `--- a/src/math.ts
+++ b/src/math.ts
@@ -10,4 +10,5 @@ export function add(a: number, b: number): number {
   validate(a);
   validate(b);
+  log("adding", a, b);
   return a + b;
 }
@@ -50,4 +51,3 @@ export function subtract(a: number, b: number): number {
   validate(a);
   validate(b);
-  log("subtracting", a, b);
   return a - b;
 }
`;
    const parsed = parseUnifiedDiff(MULTI_HUNK_DIFF);
    expect(parsed.hunks.length).toBe(2);
    expect(parsed.additions).toBe(1);
    expect(parsed.deletions).toBe(1);
    expect(parsed.hunks[0].newStart).toBe(10);
    expect(parsed.hunks[1].newStart).toBe(51);
    expect(parsed.hunks[0].lines.some((l) => l.type === "add")).toBe(true);
    expect(parsed.hunks[1].lines.some((l) => l.type === "delete")).toBe(true);
  });

  test("ExpandedToolCard renders embedded DiffViewer when diff is present", () => {
    const expandedWithDiff = React.createElement(ExpandedToolCard, {
      toolName: "edit",
      input: { path: "packages/core/src/errors.ts" },
      diff: {
        filePath: "packages/core/src/errors.ts",
        diff: SAMPLE_UNIFIED_DIFF,
        additions: 10,
        deletions: 1,
      },
      status: "running",
      isPendingApproval: true,
      theme,
    });

    expect(expandedWithDiff.type).toBe(ExpandedToolCard);
    expect(expandedWithDiff.props.diff).toBeDefined();
    expect(expandedWithDiff.props.isPendingApproval).toBe(true);
  });

  test("ApprovalPromptView embeds diff and renders action choices", () => {
    const resolve = mock((ans: ApprovalAnswer) => {});
    const approvalPrompt = React.createElement(ApprovalPromptView, {
      toolName: "edit",
      input: { path: "packages/core/src/errors.ts" },
      diff: SAMPLE_UNIFIED_DIFF,
      prompt: {
        full: "Nightglide requests permission to update packages/core/src/errors.ts",
        compact: "Approve error changes",
      },
      resolve,
      theme,
    });

    expect(approvalPrompt.type).toBe(ApprovalPromptView);
    expect(approvalPrompt.props.diff).toBe(SAMPLE_UNIFIED_DIFF);
    expect(approvalPrompt.props.prompt?.full).toContain("Nightglide requests permission");
  });
});
