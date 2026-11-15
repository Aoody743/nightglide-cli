import React, { useState, useEffect, useRef } from "react";
import type { Theme } from "@nightglide/themes";
import {
  INTERVAL_MICRO,
  TIMING_TIERS,
  type MotionMode,
} from "../../motion/constants.js";
import { useMotionMode, hasReactDispatcher } from "../../motion/reducedMotion.js";
import { generateHorizonFrame } from "../../motion/engine.js";

export interface HorizonRevealProps {
  theme: Theme;
  width?: number;
  motionMode?: MotionMode;
  skip?: boolean;
  onComplete?: () => void;
}

export interface HorizonPresentation {
  line: string;
  color: string;
  isComplete: boolean;
}

/**
 * Pure presentation helper for ANIM-START-001.
 */
export function getHorizonPresentation(
  theme: Theme,
  step: number,
  width: number = 80,
  isReduced: boolean = false,
  skip: boolean = false
): HorizonPresentation {
  if (isReduced || skip) {
    const frame = generateHorizonFrame(2, width, true);
    return {
      line: frame.line,
      color: theme.colors.border,
      isComplete: true,
    };
  }

  const frame = generateHorizonFrame(step, width, false);
  const color = frame.isComplete
    ? theme.colors.border
    : frame.isAccent
      ? theme.colors.accent
      : theme.colors.textMuted;

  return {
    line: frame.line,
    color,
    isComplete: frame.isComplete,
  };
}

/**
 * ANIM-START-001: Horizon Reveal Startup Expanding Horizon Line
 *
 * Expands from central spark line (───✦───) to full-width card border within 150ms
 * at 15 FPS (66ms intervals).
 *
 * Bypasses instantly (0ms) when:
 * - `skip` is true (keypress or returning launch)
 * - Motion mode is "off" or "reduced"
 * Starts zero timers when bypassed.
 */
export function HorizonReveal({
  theme,
  width = 80,
  motionMode,
  skip = false,
  onComplete,
}: HorizonRevealProps) {
  const { isReduced } = useMotionMode(motionMode);

  if (!hasReactDispatcher()) {
    const presentation = getHorizonPresentation(theme, isReduced || skip ? 2 : 0, width, isReduced, skip);
    return (
      <box width={width} height={1}>
        <text fg={presentation.color}>{presentation.line}</text>
      </box>
    );
  }

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isReduced || skip) {
      setStep(2);
      onCompleteRef.current?.();
      return;
    }

    // Frame 0: 0ms, Frame 1: 66ms, Frame 2: 133ms, Done: 150ms
    const timer1 = setTimeout(() => {
      setStep(1);
    }, INTERVAL_MICRO);

    const timer2 = setTimeout(() => {
      setStep(2);
    }, INTERVAL_MICRO * 2);

    const timerComplete = setTimeout(() => {
      onCompleteRef.current?.();
    }, TIMING_TIERS.TRANSITION);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timerComplete);
    };
  }, [isReduced, skip]);

  const presentation = getHorizonPresentation(theme, step, width, isReduced, skip);

  return (
    <box width={width} height={1}>
      <text fg={presentation.color}>{presentation.line}</text>
    </box>
  );
}
