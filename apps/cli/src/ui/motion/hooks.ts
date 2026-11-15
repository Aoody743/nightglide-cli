import { useState, useEffect, useRef } from "react";
import {
  FPS_AMBIENT,
  FPS_MAX,
  INTERVAL_MICRO,
  INTERVAL_AMBIENT,
  INTERVAL_BLINK,
  THINKING_SPINNER_FRAMES,
  REDUCED_MOTION_SPINNER,
  TIMING_TIERS,
  type MotionMode,
} from "./constants.js";
import { useMotionMode, hasReactDispatcher } from "./reducedMotion.js";
import { reserveSlot } from "./slots.js";

export interface UseMotionTickOptions {
  fps?: number; // Target FPS (10 - 15 FPS)
  intervalMs?: number; // Direct millisecond override
  enabled?: boolean; // Whether the animation is currently active
  motionMode?: MotionMode; // Override global motion mode
  onTick?: (frame: number) => void;
}

/**
 * Core animation hook driving frame updates within terminal performance budgets.
 * - Enforces frame rate clamp (10-15 FPS, min interval 66ms).
 * - Zero timers registered when motion is "off" or "reduced".
 * - Immediate timer disposal on unmount or when disabled.
 */
export function useMotionTick({
  fps = FPS_AMBIENT,
  intervalMs,
  enabled = true,
  motionMode,
  onTick,
}: UseMotionTickOptions = {}): number {
  if (!hasReactDispatcher()) {
    return 0;
  }

  const { isReduced } = useMotionMode(motionMode);
  const [frame, setFrame] = useState(0);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // Frame budget clamp: never exceed 15 FPS (66ms) in terminal
  const effectiveFps = Math.min(Math.max(1, fps), FPS_MAX);
  const effectiveInterval = Math.max(
    INTERVAL_MICRO,
    intervalMs ?? Math.round(1000 / effectiveFps)
  );

  useEffect(() => {
    // Zero CPU consumption & zero timers in reduced motion mode or when inactive
    if (isReduced || !enabled) {
      return;
    }

    const timer = setInterval(() => {
      setFrame((prev) => {
        const next = prev + 1;
        onTickRef.current?.(next);
        return next;
      });
    }, effectiveInterval);

    return () => {
      // Instant teardown upon unmount or condition change
      clearInterval(timer);
    };
  }, [isReduced, enabled, effectiveInterval]);

  return isReduced || !enabled ? 0 : frame;
}

export interface UseSpinnerOptions {
  fps?: number;
  active?: boolean;
  motionMode?: MotionMode;
  frames?: readonly string[];
  slotWidth?: number;
}

/**
 * ANIM-THINK-001: Celestial Pulse Spinner hook.
 * Fixed-slot rotating braille characters at 10 FPS with static "✦" fallback.
 */
export function useSpinner({
  fps = FPS_AMBIENT,
  active = true,
  motionMode,
  frames = THINKING_SPINNER_FRAMES,
  slotWidth = 2,
}: UseSpinnerOptions = {}): {
  frameChar: string;
  frameIndex: number;
  formattedSlot: string;
} {
  const { isReduced } = useMotionMode(motionMode);
  const frame = useMotionTick({
    fps,
    enabled: active && !isReduced,
    motionMode,
  });

  if (isReduced || !active) {
    const char = REDUCED_MOTION_SPINNER;
    return {
      frameChar: char,
      frameIndex: 0,
      formattedSlot: reserveSlot(char, slotWidth),
    };
  }

  const index = frame % frames.length;
  const char = frames[index] ?? frames[0]!;
  return {
    frameChar: char,
    frameIndex: index,
    formattedSlot: reserveSlot(char, slotWidth),
  };
}

export interface UseBlinkOptions {
  intervalMs?: number;
  active?: boolean;
  motionMode?: MotionMode;
}

/**
 * ANIM-STREAM-002: Terminal Cursor Shimmer hook.
 * Toggles visibility at ~500ms (2 Hz) during streaming text generation.
 * Immediately tears down timer and hides cursor when active becomes false.
 */
export function useBlink({
  intervalMs = INTERVAL_BLINK,
  active = true,
  motionMode,
}: UseBlinkOptions = {}): boolean {
  if (!hasReactDispatcher()) {
    return false;
  }

  const { isReduced } = useMotionMode(motionMode);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (isReduced || !active) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setInterval(() => {
      setVisible((prev) => !prev);
    }, Math.max(INTERVAL_MICRO, intervalMs));

    return () => {
      clearInterval(timer);
    };
  }, [isReduced, active, intervalMs]);

  return isReduced || !active ? false : visible;
}

export interface UseTimedFeedbackOptions {
  durationMs?: number;
  active: boolean;
  motionMode?: MotionMode;
  onComplete?: () => void;
}

/**
 * ANIM-TOOL-003 / ANIM-AGENT-002: Transient state flash feedback hook.
 * Activates briefly for durationMs (e.g. 150ms for tool success flash), then settles.
 * In reduced-motion mode: duration is 0ms, transitions immediately without timers.
 */
export function useTimedFeedback({
  durationMs = TIMING_TIERS.TRANSITION,
  active,
  motionMode,
  onComplete,
}: UseTimedFeedbackOptions): boolean {
  if (!hasReactDispatcher()) {
    return false;
  }

  const { isReduced } = useMotionMode(motionMode);
  const [isFlashing, setIsFlashing] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (isReduced || !active) {
      setIsFlashing(false);
      if (active && isReduced) {
        onCompleteRef.current?.();
      }
      return;
    }

    setIsFlashing(true);
    const timer = setTimeout(() => {
      setIsFlashing(false);
      onCompleteRef.current?.();
    }, durationMs);

    return () => {
      clearTimeout(timer);
    };
  }, [isReduced, active, durationMs]);

  return isReduced || !active ? false : isFlashing;
}
