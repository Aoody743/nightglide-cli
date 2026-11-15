import {
  FPS_AMBIENT,
  FPS_MICRO,
  FPS_MAX,
  INTERVAL_AMBIENT,
  INTERVAL_MICRO,
  THINKING_SPINNER_FRAMES,
  REDUCED_MOTION_SPINNER,
  STREAMING_CURSOR_CHAR,
  HORIZON_INITIAL,
  DELEGATION_SPARK,
  DELEGATION_SPARK_REDUCED,
  TOOL_ICONS,
  type MotionMode,
} from "./constants.js";
import { isReducedMotion } from "./reducedMotion.js";
import { reserveSlot, getStringWidth } from "./slots.js";

export interface CelestialControllerOptions {
  fps?: number;
  frames?: readonly string[];
  motionMode?: MotionMode;
  slotWidth?: number;
}

/**
 * Deterministic Motion Engine Controller.
 * Provides programmatic frame progression, slot verification, and lifecycle teardown
 * without external wall-clock dependencies.
 */
export class CelestialAnimationController {
  private frameIndex = 0;
  private active = true;
  private readonly fps: number;
  private readonly frames: readonly string[];
  private motionMode: MotionMode;
  private readonly slotWidth: number;
  private readonly activeTimers = new Set<ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>>();

  constructor(options: CelestialControllerOptions = {}) {
    this.fps = Math.min(Math.max(1, options.fps ?? FPS_AMBIENT), FPS_MAX);
    this.frames = options.frames ?? THINKING_SPINNER_FRAMES;
    this.motionMode = options.motionMode ?? "auto";
    this.slotWidth = options.slotWidth ?? 2;
  }

  getFps(): number {
    return this.fps;
  }

  getMotionMode(): MotionMode {
    return this.motionMode;
  }

  setMotionMode(mode: MotionMode): void {
    this.motionMode = mode;
  }

  isActive(): boolean {
    return this.active;
  }

  getCurrentFrameIndex(): number {
    return isReducedMotion(this.motionMode) || !this.active ? 0 : this.frameIndex;
  }

  getCurrent(): { frameChar: string; frameIndex: number; formattedSlot: string } {
    if (isReducedMotion(this.motionMode) || !this.active) {
      const char = REDUCED_MOTION_SPINNER;
      return {
        frameChar: char,
        frameIndex: 0,
        formattedSlot: reserveSlot(char, this.slotWidth),
      };
    }

    const char = this.frames[this.frameIndex] ?? this.frames[0]!;
    return {
      frameChar: char,
      frameIndex: this.frameIndex,
      formattedSlot: reserveSlot(char, this.slotWidth),
    };
  }

  step(): { frameChar: string; frameIndex: number; formattedSlot: string } {
    if (isReducedMotion(this.motionMode) || !this.active) {
      const char = REDUCED_MOTION_SPINNER;
      return {
        frameChar: char,
        frameIndex: 0,
        formattedSlot: reserveSlot(char, this.slotWidth),
      };
    }

    this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    const char = this.frames[this.frameIndex] ?? this.frames[0]!;
    return {
      frameChar: char,
      frameIndex: this.frameIndex,
      formattedSlot: reserveSlot(char, this.slotWidth),
    };
  }

  reset(): void {
    this.frameIndex = 0;
  }

  stop(): void {
    this.active = false;
    this.dispose();
  }

  registerTimer(timer: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>): void {
    this.activeTimers.add(timer);
  }

  clearTimer(timer: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>): void {
    this.activeTimers.delete(timer);
    clearInterval(timer as any);
    clearTimeout(timer as any);
  }

  dispose(): void {
    for (const timer of this.activeTimers) {
      clearInterval(timer as any);
      clearTimeout(timer as any);
    }
    this.activeTimers.clear();
  }

  getActiveTimerCount(): number {
    return this.activeTimers.size;
  }
}

/**
 * Pure generator for ANIM-START-001 (Horizon Reveal).
 * Guarantees that at every step, the rendered line has length strictly equal to targetWidth.
 */
export function generateHorizonFrame(
  step: number,
  targetWidth: number = 80,
  isReduced: boolean = false
): { line: string; isComplete: boolean; isAccent: boolean } {
  const safeWidth = Math.max(10, targetWidth);

  // In reduced-motion mode or completed step (step >= 2), return full width border line
  if (isReduced || step >= 2) {
    return {
      line: "─".repeat(safeWidth),
      isComplete: true,
      isAccent: false,
    };
  }

  if (step === 0) {
    // Initial 7-character spark line centered
    const spark = HORIZON_INITIAL; // 7 chars: ───✦───
    const sparkWidth = getStringWidth(spark);
    const leftPad = Math.floor((safeWidth - sparkWidth) / 2);
    const rightPad = safeWidth - sparkWidth - leftPad;
    return {
      line: " ".repeat(leftPad) + spark + " ".repeat(rightPad),
      isComplete: false,
      isAccent: true,
    };
  }

  // Step 1: Expanded horizon line
  const intermediateWidth = Math.min(safeWidth, Math.max(20, Math.floor(safeWidth * 0.5)));
  const halfDash = Math.floor((intermediateWidth - 1) / 2);
  const midSpark = "─".repeat(halfDash) + "✦" + "─".repeat(halfDash);
  const midWidth = getStringWidth(midSpark);
  const leftPad = Math.floor((safeWidth - midWidth) / 2);
  const rightPad = safeWidth - midWidth - leftPad;

  return {
    line: " ".repeat(leftPad) + midSpark + " ".repeat(rightPad),
    isComplete: false,
    isAccent: true,
  };
}

/**
 * Pure generator for ANIM-AGENT-001 (Delegation Spark).
 */
export function generateDelegationSpark(isReduced: boolean = false): string {
  return isReduced ? DELEGATION_SPARK_REDUCED : DELEGATION_SPARK;
}
