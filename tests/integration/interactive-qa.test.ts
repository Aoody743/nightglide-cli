import { describe, test, expect } from "bun:test";
import { getTerminalTier, computeViewportCapacity } from "../../apps/cli/src/ui/dimensions.js";
import { getThemeManager } from "@nightglide/themes";
import { parseDiffStats, generateUnifiedDiff } from "@nightglide/engine";
import { formatToolSummary, getToolIcon, parseMarkdownBlocks } from "../../apps/cli/src/ui/screens/ChatScreen.js";
import { isReducedMotion, reserveSlot } from "../../apps/cli/src/ui/motion/index.js";
import { parseUnifiedDiff } from "../../apps/cli/src/ui/components/diff/diffParser.js";

describe("Interactive Flight Deck & Terminal Layout Verification", () => {
  test("responsive tier classification matches 80x24, 100x30, 120x36 standards", () => {
    // 80x24 Compact / Small
    const compact = getTerminalTier(80, 24);
    expect(compact).toBe("small");
    const compactCap = computeViewportCapacity({ width: 80, height: 24 });
    expect(compactCap.isCompact).toBe(true);
    expect(compactCap.maxVisibleMessages).toBe(3);

    // 100x30 Standard / Medium
    const standard = getTerminalTier(100, 30);
    expect(standard).toBe("medium");
    const standardCap = computeViewportCapacity({ width: 100, height: 30 });
    expect(standardCap.isCompact).toBe(false);
    expect(standardCap.maxVisibleMessages).toBe(5);

    // 120x36 Wide / Large
    const wide = getTerminalTier(120, 36);
    expect(wide).toBe("large");
    const wideCap = computeViewportCapacity({ width: 120, height: 36 });
    expect(wideCap.isCompact).toBe(false);
    expect(wideCap.maxVisibleMessages).toBe(8);
  });

  test("markdown code blocks parse cleanly without breaking terminal layout", () => {
    const raw = "Here is the new module:\n```typescript packages/core/src/calc.ts\nexport function add(a: number, b: number): number {\n  return a + b;\n}\n```\nAnd tests pass!";
    const blocks = parseMarkdownBlocks(raw);
    expect(blocks.length).toBe(3);
    expect(blocks[0].type).toBe("text");
    expect(blocks[1].type).toBe("code");
    expect(blocks[1].language).toBe("typescript");
    expect(blocks[1].filename).toBe("packages/core/src/calc.ts");
    expect(blocks[1].content).toContain("return a + b;");
    expect(blocks[2].type).toBe("text");
  });

  test("diff parser and formatter handle unified diffs correctly", () => {
    const oldCode = "export class Error {};\n";
    const newCode = "export class Error {};\nexport class TimeoutError extends Error {};\n";
    const unified = generateUnifiedDiff("src/errors.ts", oldCode, newCode);
    const parsed = parseUnifiedDiff(unified);

    expect(parsed.filePath).toBe("src/errors.ts");
    expect(parsed.additions).toBeGreaterThanOrEqual(1);
    expect(parsed.deletions).toBe(0);
    expect(parsed.hunks.length).toBeGreaterThanOrEqual(1);
  });

  test("reduced motion disables timers and stabilizes slot widths", () => {
    expect(isReducedMotion("off")).toBe(true);
    expect(isReducedMotion("reduced")).toBe(true);
    expect(isReducedMotion("auto")).toBe(false);

    const slot1 = reserveSlot("⠋", 2);
    const slot2 = reserveSlot("✦", 2);
    expect(slot1.length).toBe(slot2.length);
  });

  test("theme hot-swap does not throw or corrupt color tokens", () => {
    const tm = getThemeManager();
    const original = tm.getActiveTheme().id;

    for (const themeId of ["midnight-flight", "aurora", "cloudlight", "daybreak"]) {
      tm.setTheme(themeId);
      const active = tm.getActiveTheme();
      expect(active.id).toBe(themeId);
      expect(active.colors.background).toBeDefined();
      expect(active.colors.accent).toBeDefined();
      expect(active.colors.surface).toBeDefined();
    }

    tm.setTheme(original);
  });
});
