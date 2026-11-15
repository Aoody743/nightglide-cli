import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import React from "react";
import {
  BUILTIN_THEMES,
  getThemeManager,
  type Theme,
} from "@nightglide/themes";
import {
  FPS_AMBIENT,
  FPS_MICRO,
  FPS_MAX,
  INTERVAL_AMBIENT,
  INTERVAL_MICRO,
  INTERVAL_TRANSITION,
  INTERVAL_BLINK,
  TIMING_TIERS,
  THINKING_SPINNER_FRAMES,
  REDUCED_MOTION_SPINNER,
  STREAMING_CURSOR_CHAR,
  HORIZON_INITIAL,
  DELEGATION_SPARK,
  DELEGATION_SPARK_REDUCED,
  TOOL_ICONS,
  type MotionMode,
  stripAnsi,
  getCharWidth,
  getStringWidth,
  reserveSlot,
  createFixedSlotFormatter,
  assertSlotWidth,
  isReducedMotion,
  parseHex,
  toHex,
  isValidHex,
  interpolateColor,
  oscillateColors,
  CelestialAnimationController,
  generateHorizonFrame,
  generateDelegationSpark,
} from "../../apps/cli/src/ui/motion/index.js";
import {
  ThinkingIndicator,
  getThinkingPresentation,
  StreamingCursor,
  getStreamingCursorPresentation,
  ToolStatusMotion,
  getToolStatusPresentation,
  AgentStatusMotion,
  getAgentStatusPresentation,
  HorizonReveal,
  getHorizonPresentation,
} from "../../apps/cli/src/ui/components/motion/index.js";

describe("Celestial Kinetics - Frame Budget & Timing Tiers", () => {
  test("enforces strict terminal frame budget: ambient 10 FPS, micro 15 FPS, max 15 FPS", () => {
    expect(FPS_AMBIENT).toBe(10);
    expect(FPS_MICRO).toBe(15);
    expect(FPS_MAX).toBe(15);
    expect(INTERVAL_AMBIENT).toBe(100); // 100ms per frame
    expect(INTERVAL_MICRO).toBe(66); // 66ms per frame (~15 FPS)
    expect(INTERVAL_BLINK).toBe(500); // 500ms (2 Hz)
  });

  test("satisfies discrete timing tiers defined in docs/MOTION_SYSTEM.md", () => {
    expect(TIMING_TIERS.INSTANT).toBe(0); // T0: 0ms
    expect(TIMING_TIERS.MICRO).toBe(100); // T1: 80-120ms
    expect(TIMING_TIERS.TRANSITION).toBe(150); // T2: 150-250ms
    expect(TIMING_TIERS.AMBIENT).toBe(1000); // T3: 800-1200ms
  });

  test("controller clamps requested FPS to strictly not exceed FPS_MAX (15 FPS)", () => {
    const normalController = new CelestialAnimationController({ fps: 10 });
    expect(normalController.getFps()).toBe(10);

    const overbudgetController = new CelestialAnimationController({ fps: 60 });
    expect(overbudgetController.getFps()).toBe(15);

    const negativeController = new CelestialAnimationController({ fps: -5 });
    expect(negativeController.getFps()).toBe(1);
  });
});

describe("Celestial Kinetics - Anti-Jitter Slot Reservation", () => {
  test("getCharWidth measures ASCII, box-drawing, braille, and CJK characters accurately", () => {
    expect(getCharWidth("a")).toBe(1);
    expect(getCharWidth(" ")).toBe(1);
    expect(getCharWidth("─")).toBe(1);
    expect(getCharWidth("⠋")).toBe(1);
    expect(getCharWidth("✦")).toBe(1);
    expect(getCharWidth("█")).toBe(1);
    expect(getCharWidth("✔")).toBe(1);
    expect(getCharWidth("✖")).toBe(1);

    // CJK Ideographs have width 2
    expect(getCharWidth("思")).toBe(2);
    expect(getCharWidth("考")).toBe(2);
    expect(getCharWidth("中")).toBe(2);

    // Control characters have width 0
    expect(getCharWidth("\u0000")).toBe(0);
    expect(getCharWidth("\u001b")).toBe(0);
  });

  test("getStringWidth calculates terminal column widths and ignores ANSI escapes", () => {
    expect(getStringWidth("Hello")).toBe(5);
    expect(getStringWidth("───✦───")).toBe(7);
    expect(getStringWidth("\u001b[31mHello\u001b[0m")).toBe(5);
    expect(getStringWidth("思考中...")).toBe(9); // 3*2 + 3 = 9
    expect(getStringWidth("")).toBe(0);
  });

  test("reserveSlot pads shorter content to exact width without layout shift", () => {
    const leftPadded = reserveSlot("⠋", 4, "left");
    expect(leftPadded).toBe("⠋   ");
    expect(getStringWidth(leftPadded)).toBe(4);

    const rightPadded = reserveSlot("⠋", 4, "right");
    expect(rightPadded).toBe("   ⠋");
    expect(getStringWidth(rightPadded)).toBe(4);

    const centerPadded = reserveSlot("⠋", 5, "center");
    expect(getStringWidth(centerPadded)).toBe(5);
  });

  test("reserveSlot safely truncates longer content while preserving character boundaries", () => {
    const longText = "Nightglide Terminal Kinetics";
    const truncated = reserveSlot(longText, 10);
    expect(getStringWidth(truncated)).toBe(10);
    expect(assertSlotWidth(truncated, 10)).toBe(true);

    // Truncating CJK text without splitting surrogate or double-column character
    const cjkText = "思考推演中";
    const truncatedCjk = reserveSlot(cjkText, 5); // 5 cols -> 2 CJK chars (4 cols) + 1 space = 5 cols
    expect(getStringWidth(truncatedCjk)).toBe(5);
    expect(assertSlotWidth(truncatedCjk, 5)).toBe(true);
  });

  test("createFixedSlotFormatter creates reusable formatters for frame renders", () => {
    const formatter = createFixedSlotFormatter(6, "center", ".");
    const formatted = formatter("✦");
    expect(getStringWidth(formatted)).toBe(6);
    expect(formatted).toBe("..✦...");
  });

  test("all thinking indicator spinner frames have strictly identical slot widths", () => {
    const slotWidth = 2;
    for (const frame of THINKING_SPINNER_FRAMES) {
      const slotted = reserveSlot(frame, slotWidth);
      expect(getStringWidth(slotted)).toBe(slotWidth);
      expect(assertSlotWidth(slotted, slotWidth)).toBe(true);
    }

    const reducedSlotted = reserveSlot(REDUCED_MOTION_SPINNER, slotWidth);
    expect(getStringWidth(reducedSlotted)).toBe(slotWidth);
    expect(assertSlotWidth(reducedSlotted, slotWidth)).toBe(true);
  });

  test("streaming cursor occupies strictly identical slot width whether visible or blinking", () => {
    const slotWidth = 1;
    const visibleSlot = reserveSlot(STREAMING_CURSOR_CHAR, slotWidth);
    const hiddenSlot = reserveSlot(" ", slotWidth);

    expect(getStringWidth(visibleSlot)).toBe(1);
    expect(getStringWidth(hiddenSlot)).toBe(1);
    expect(assertSlotWidth(visibleSlot, 1)).toBe(true);
    expect(assertSlotWidth(hiddenSlot, 1)).toBe(true);
  });
});

describe("Celestial Kinetics - Reduced-Motion Mode & Zero CPU Budget", () => {
  const originalEnv = process.env.NIGHTGLIDE_REDUCED_MOTION;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NIGHTGLIDE_REDUCED_MOTION = originalEnv;
    } else {
      delete process.env.NIGHTGLIDE_REDUCED_MOTION;
    }
  });

  test("isReducedMotion accurately detects off, reduced, and environment overrides", () => {
    expect(isReducedMotion("off")).toBe(true);
    expect(isReducedMotion("reduced")).toBe(true);
    expect(isReducedMotion("auto")).toBe(false);

    process.env.NIGHTGLIDE_REDUCED_MOTION = "1";
    expect(isReducedMotion("auto")).toBe(true);

    delete process.env.NIGHTGLIDE_REDUCED_MOTION;
    expect(isReducedMotion("auto")).toBe(false);
  });

  test("CelestialAnimationController produces static output in reduced-motion mode", () => {
    const controller = new CelestialAnimationController({ motionMode: "off" });
    expect(controller.getMotionMode()).toBe("off");

    const initial = controller.getCurrent();
    expect(initial.frameChar).toBe(REDUCED_MOTION_SPINNER);
    expect(initial.frameIndex).toBe(0);

    // Stepping does not rotate frames in reduced-motion mode
    const stepped = controller.step();
    expect(stepped.frameChar).toBe(REDUCED_MOTION_SPINNER);
    expect(stepped.frameIndex).toBe(0);
  });

  test("HorizonReveal generates full-width line instantly (0ms) in reduced-motion mode", () => {
    const frameReduced = generateHorizonFrame(0, 80, true);
    expect(frameReduced.isComplete).toBe(true);
    expect(frameReduced.line).toBe("─".repeat(80));
    expect(getStringWidth(frameReduced.line)).toBe(80);

    const theme = BUILTIN_THEMES[0]!;
    const presentation = getHorizonPresentation(theme, 0, 80, true);
    expect(presentation.isComplete).toBe(true);
    expect(presentation.line).toBe("─".repeat(80));
    expect(presentation.color).toBe(theme.colors.border);
  });

  test("DelegationSpark switches to static indicator in reduced-motion mode", () => {
    const normalSpark = generateDelegationSpark(false);
    expect(normalSpark).toBe(DELEGATION_SPARK); // ──✦──>

    const reducedSpark = generateDelegationSpark(true);
    expect(reducedSpark).toBe(DELEGATION_SPARK_REDUCED); // ──>
  });
});

describe("Celestial Kinetics - Animation Stepping & State Generators", () => {
  const theme = BUILTIN_THEMES[0]!;

  test("ThinkingIndicator steps through all 6 celestial pulse frames deterministically", () => {
    for (let i = 0; i < THINKING_SPINNER_FRAMES.length; i++) {
      const pres = getThinkingPresentation(theme, i, false, "Deliberating...", 2);
      expect(pres.symbol).toBe(THINKING_SPINNER_FRAMES[i]!);
      expect(getStringWidth(pres.formattedSlot)).toBe(2);
      expect(isValidHex(pres.symbolColor)).toBe(true);
      expect(pres.label).toBe("Deliberating...");
    }
  });

  test("ThinkingIndicator in reduced mode renders static star indicator without oscillation", () => {
    const pres = getThinkingPresentation(theme, 3, true, "Synthesizing...", 2);
    expect(pres.symbol).toBe(REDUCED_MOTION_SPINNER);
    expect(pres.formattedSlot).toBe("✦ ");
    expect(getStringWidth(pres.formattedSlot)).toBe(2);
    expect(pres.symbolColor).toBe(theme.colors.accent);
  });

  test("StreamingCursor presentation toggles visibility cleanly without layout jitter", () => {
    const visiblePres = getStreamingCursorPresentation(theme, true, true, false, "█", true);
    expect(visiblePres.visible).toBe(true);
    expect(visiblePres.char).toBe("█");
    expect(getStringWidth(visiblePres.char)).toBe(1);

    const hiddenPres = getStreamingCursorPresentation(theme, false, true, false, "█", true);
    expect(hiddenPres.visible).toBe(false);
    expect(hiddenPres.char).toBe(" ");
    expect(getStringWidth(hiddenPres.char)).toBe(1);

    const donePres = getStreamingCursorPresentation(theme, true, false, false, "█", false);
    expect(donePres.visible).toBe(false);
    expect(donePres.char).toBe("");
  });

  test("ToolStatusMotion presentation reserves slots for running, completed, error, and idle states", () => {
    const runningPres = getToolStatusPresentation(theme, "running", false, false, "read_file");
    expect(runningPres.icon).toBe(TOOL_ICONS.RUNNING);
    expect(runningPres.badge).toBe("[RUNNING]");
    expect(runningPres.color).toBe(theme.colors.info);
    expect(getStringWidth(runningPres.iconSlot)).toBe(2);
    expect(getStringWidth(runningPres.badgeSlot)).toBe(11);

    const completedPres = getToolStatusPresentation(theme, "completed", true, false, "edit_file");
    expect(completedPres.icon).toBe(TOOL_ICONS.COMPLETED);
    expect(completedPres.badge).toBe("[DONE]");
    expect(completedPres.color).toBe(theme.colors.success);
    expect(getStringWidth(completedPres.iconSlot)).toBe(2);
    expect(getStringWidth(completedPres.badgeSlot)).toBe(11);

    const errorPres = getToolStatusPresentation(theme, "error", false, false, "bash");
    expect(errorPres.icon).toBe(TOOL_ICONS.ERROR);
    expect(errorPres.badge).toBe("[FAILED]");
    expect(errorPres.color).toBe(theme.colors.error);
    expect(getStringWidth(errorPres.iconSlot)).toBe(2);
    expect(getStringWidth(errorPres.badgeSlot)).toBe(11);
  });

  test("AgentStatusMotion presentation aligns role badges, delegation sparks, and status", () => {
    const delegatingPres = getAgentStatusPresentation(theme, "scout", "running", true, false, false);
    expect(getStringWidth(delegatingPres.roleBadge)).toBe(12);
    expect(getStringWidth(delegatingPres.statusBadge)).toBe(12);
    expect(getStringWidth(delegatingPres.spark)).toBe(8);
    expect(delegatingPres.color).toBe(theme.colors.accent);

    const completedPres = getAgentStatusPresentation(theme, "planner", "completed", false, false, false);
    expect(getStringWidth(completedPres.roleBadge)).toBe(12);
    expect(getStringWidth(completedPres.statusBadge)).toBe(12);
    expect(completedPres.color).toBe(theme.colors.success);
  });

  test("HorizonReveal steps from spark line to full width and maintains constant column width", () => {
    const targetWidth = 80;

    // Step 0: Initial spark line centered
    const step0 = generateHorizonFrame(0, targetWidth, false);
    expect(step0.isComplete).toBe(false);
    expect(step0.isAccent).toBe(true);
    expect(getStringWidth(step0.line)).toBe(targetWidth);
    expect(step0.line.includes(HORIZON_INITIAL)).toBe(true);

    // Step 1: Intermediate expansion centered
    const step1 = generateHorizonFrame(1, targetWidth, false);
    expect(step1.isComplete).toBe(false);
    expect(getStringWidth(step1.line)).toBe(targetWidth);
    expect(step1.line.includes("✦")).toBe(true);

    // Step 2: Full width line completed
    const step2 = generateHorizonFrame(2, targetWidth, false);
    expect(step2.isComplete).toBe(true);
    expect(getStringWidth(step2.line)).toBe(targetWidth);
    expect(step2.line).toBe("─".repeat(targetWidth));
  });
});

describe("Celestial Kinetics - Color Math & Theme Token Resolution", () => {
  test("isValidHex accurately validates 3-hex and 6-hex strings", () => {
    expect(isValidHex("#fff")).toBe(true);
    expect(isValidHex("#FFFFFF")).toBe(true);
    expect(isValidHex("#79c0ff")).toBe(true);
    expect(isValidHex("not-hex")).toBe(false);
    expect(isValidHex("#12345")).toBe(false);
  });

  test("parseHex and toHex correctly round-trip RGB values", () => {
    const parsed = parseHex("#ff8800");
    expect(parsed.r).toBe(255);
    expect(parsed.g).toBe(136);
    expect(parsed.b).toBe(0);

    const hex = toHex(parsed.r, parsed.g, parsed.b);
    expect(hex.toLowerCase()).toBe("#ff8800");
  });

  test("interpolateColor smoothly blends colors by ratio", () => {
    const black = "#000000";
    const white = "#ffffff";

    expect(interpolateColor(black, white, 0)).toBe("#000000");
    expect(interpolateColor(black, white, 1)).toBe("#ffffff");
    expect(interpolateColor(black, white, 0.5)).toBe("#808080");
  });

  test("oscillateColors produces valid hex strings for all frames across all 4 built-in themes", () => {
    for (const theme of BUILTIN_THEMES) {
      for (let frame = 0; frame < 6; frame++) {
        const color = oscillateColors(theme.colors.textMuted, theme.colors.accent, frame, 6);
        expect(isValidHex(color)).toBe(true);
      }
    }
  });

  test("all 4 built-in themes define necessary semantic tokens for motion components", () => {
    for (const theme of BUILTIN_THEMES) {
      expect(isValidHex(theme.colors.accent)).toBe(true);
      expect(isValidHex(theme.colors.accentSecondary)).toBe(true);
      expect(isValidHex(theme.colors.textPrimary)).toBe(true);
      expect(isValidHex(theme.colors.textSecondary)).toBe(true);
      expect(isValidHex(theme.colors.textMuted)).toBe(true);
      expect(isValidHex(theme.colors.surface)).toBe(true);
      expect(isValidHex(theme.colors.surfaceElevated)).toBe(true);
      expect(isValidHex(theme.colors.border)).toBe(true);
      expect(isValidHex(theme.colors.success)).toBe(true);
      expect(isValidHex(theme.colors.error)).toBe(true);
      expect(isValidHex(theme.colors.info)).toBe(true);
    }
  });
});

describe("Celestial Kinetics - Timer Teardown & Lifecycle Cleanup", () => {
  test("CelestialAnimationController registers, clears, and disposes timers completely", () => {
    const controller = new CelestialAnimationController();
    expect(controller.getActiveTimerCount()).toBe(0);

    let tickCount = 0;
    const timer1 = setInterval(() => {
      tickCount++;
    }, 100);
    const timer2 = setTimeout(() => {}, 500);

    controller.registerTimer(timer1);
    controller.registerTimer(timer2);
    expect(controller.getActiveTimerCount()).toBe(2);

    controller.clearTimer(timer1);
    expect(controller.getActiveTimerCount()).toBe(1);

    controller.dispose();
    expect(controller.getActiveTimerCount()).toBe(0);
  });

  test("controller stop marks controller inactive and disposes all resources", () => {
    const controller = new CelestialAnimationController();
    expect(controller.isActive()).toBe(true);

    const timer = setInterval(() => {}, 100);
    controller.registerTimer(timer);
    expect(controller.getActiveTimerCount()).toBe(1);

    controller.stop();
    expect(controller.isActive()).toBe(false);
    expect(controller.getActiveTimerCount()).toBe(0);
  });
});

describe("Celestial Kinetics - Component Elements Structure", () => {
  const theme = BUILTIN_THEMES[0]!;

  test("ThinkingIndicator returns valid React elements with appropriate box and text nodes", () => {
    const element = React.createElement(ThinkingIndicator, {
      theme,
      label: "Thinking...",
      slotWidth: 2,
      active: true,
      motionMode: "off",
    });

    expect(element).toBeDefined();
    expect(element.type).toBe(ThinkingIndicator);
    expect(element.props.label).toBe("Thinking...");

    // Call component function directly in static reduced mode
    const rendered = (ThinkingIndicator as any)({
      theme,
      label: "Thinking...",
      slotWidth: 2,
      active: true,
      motionMode: "off",
    });

    expect(rendered).toBeDefined();
    expect(rendered.type).toBe("box");
    expect(rendered.props.flexDirection).toBe("row");
    expect(Array.isArray(rendered.props.children)).toBe(true);
    expect(rendered.props.children[0].type).toBe("text");
    expect(rendered.props.children[1].type).toBe("text");
  });

  test("StreamingCursor returns text node in active mode and null when inactive", () => {
    const renderedActive = (StreamingCursor as any)({
      theme,
      isStreaming: true,
      motionMode: "off",
      reserveSlot: true,
    });
    expect(renderedActive).toBeDefined();
    expect(renderedActive.type).toBe("text");

    const renderedInactive = (StreamingCursor as any)({
      theme,
      isStreaming: false,
      motionMode: "off",
      reserveSlot: false,
    });
    expect(renderedInactive).toBeNull();
  });

  test("ToolStatusMotion returns box with iconSlot, badgeSlot, and title", () => {
    const rendered = (ToolStatusMotion as any)({
      theme,
      status: "completed",
      toolName: "write_file",
      motionMode: "off",
    });

    expect(rendered).toBeDefined();
    expect(rendered.type).toBe("box");
    expect(rendered.props.children.length).toBe(3);
    expect(rendered.props.children[0].type).toBe("text"); // icon
    expect(rendered.props.children[1].type).toBe("text"); // badge
    expect(rendered.props.children[2].type).toBe("text"); // title
  });

  test("AgentStatusMotion returns box with role badge and status badge", () => {
    const rendered = (AgentStatusMotion as any)({
      theme,
      role: "planner",
      status: "running",
      isDelegating: true,
      motionMode: "off",
    });

    expect(rendered).toBeDefined();
    expect(rendered.type).toBe("box");
    expect(rendered.props.children.length).toBe(3); // role, spark, status
  });

  test("HorizonReveal returns 1-line box matching terminal width", () => {
    const rendered = (HorizonReveal as any)({
      theme,
      width: 100,
      motionMode: "off",
    });

    expect(rendered).toBeDefined();
    expect(rendered.type).toBe("box");
    expect(rendered.props.width).toBe(100);
    expect(rendered.props.height).toBe(1);
    expect(rendered.props.children.props.fg).toBe(theme.colors.border);
  });
});
