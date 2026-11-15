/**
 * Celestial Kinetics Motion System Constants
 * Nightglide Terminal Motion & Frame Budget Specifications
 *
 * Implements the discrete timing tiers and slot budget defined in docs/MOTION_SYSTEM.md:
 * - Frame budget: Strict 10-15 FPS (66ms to 100ms)
 * - T0: Instant (0ms)
 * - T1: Micro (80-120ms)
 * - T2: Transition (150-250ms)
 * - T3: Ambient (800-1200ms)
 */

export type MotionMode = "auto" | "reduced" | "off";

/**
 * Strict Frame Rate Budget for Terminal UI.
 * 10 FPS for ambient breathing; 15 FPS max for micro-transitions.
 * Terminal rendering must never exceed 15 FPS to protect SSH sessions and CPU budgets.
 */
export const FPS_AMBIENT = 10;
export const FPS_MICRO = 15;
export const FPS_MAX = 15;

export const INTERVAL_AMBIENT = 100; // 100ms = 10 FPS
export const INTERVAL_MICRO = 66; // 66ms ~ 15 FPS
export const INTERVAL_TRANSITION = 150; // 150ms
export const INTERVAL_BLINK = 500; // 500ms = 2 Hz cursor pulse

export const TIMING_TIERS = {
  INSTANT: 0, // T0: 0ms
  MICRO: 100, // T1: 80 - 120ms
  TRANSITION: 150, // T2: 150 - 250ms
  AMBIENT: 1000, // T3: 800 - 1200ms
} as const;

/**
 * ANIM-THINK-001: Celestial Pulse spinner frames (6 discrete frames at 10 FPS)
 */
export const THINKING_SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
] as const;

/**
 * Reduced-motion static fallback for thinking spinner.
 */
export const REDUCED_MOTION_SPINNER = "✦";

/**
 * ANIM-STREAM-002: Terminal Cursor Shimmer block character.
 */
export const STREAMING_CURSOR_CHAR = "█";

/**
 * ANIM-START-001: Horizon Reveal central spark line.
 */
export const HORIZON_INITIAL = "───✦───";

/**
 * ANIM-AGENT-001: Subagent delegation spark indicator.
 */
export const DELEGATION_SPARK = "──✦──>";
export const DELEGATION_SPARK_REDUCED = "──>";

/**
 * ANIM-TOOL-001 / ANIM-TOOL-003: Tool status icons.
 */
export const TOOL_ICONS = {
  RUNNING: "⚡",
  COMPLETED: "✔",
  ERROR: "✖",
  IDLE: "◈",
} as const;

/**
 * ANIM-THINK-002: Agent monitor status badges.
 */
export const AGENT_STATUS_BADGES = {
  WAITING: "[WAITING]",
  RUNNING: "[RUNNING]",
  COMPLETED: "[COMPLETED]",
  ERROR: "[FAILED]",
} as const;
