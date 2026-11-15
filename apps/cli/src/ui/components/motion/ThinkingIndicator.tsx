import React from "react";
import type { Theme } from "@nightglide/themes";
import {
  THINKING_SPINNER_FRAMES,
  REDUCED_MOTION_SPINNER,
  type MotionMode,
} from "../../motion/constants.js";
import { useMotionMode } from "../../motion/reducedMotion.js";
import { useSpinner } from "../../motion/hooks.js";
import { oscillateColors } from "../../motion/color.js";
import { reserveSlot } from "../../motion/slots.js";

export interface ThinkingIndicatorProps {
  theme: Theme;
  label?: string;
  slotWidth?: number;
  motionMode?: MotionMode;
  active?: boolean;
}

export interface ThinkingStatePresentation {
  symbol: string;
  formattedSlot: string;
  symbolColor: string;
  label: string;
  labelColor: string;
}

/**
 * Pure presentation helper for ANIM-THINK-001.
 * Ensures deterministic rendering and slot width stability.
 */
export function getThinkingPresentation(
  theme: Theme,
  frameIndex: number,
  isReduced: boolean,
  label: string = "正在思考...",
  slotWidth: number = 2
): ThinkingStatePresentation {
  if (isReduced) {
    const symbol = REDUCED_MOTION_SPINNER;
    return {
      symbol,
      formattedSlot: reserveSlot(symbol, slotWidth),
      symbolColor: theme.colors.accent,
      label,
      labelColor: theme.colors.textSecondary,
    };
  }

  const safeIndex = frameIndex % THINKING_SPINNER_FRAMES.length;
  const symbol = THINKING_SPINNER_FRAMES[safeIndex] ?? THINKING_SPINNER_FRAMES[0]!;
  const symbolColor = oscillateColors(
    theme.colors.textMuted,
    theme.colors.accent,
    safeIndex,
    THINKING_SPINNER_FRAMES.length
  );

  return {
    symbol,
    formattedSlot: reserveSlot(symbol, slotWidth),
    symbolColor,
    label,
    labelColor: theme.colors.textSecondary,
  };
}

/**
 * ANIM-THINK-001: Celestial Pulse Thinking Indicator
 *
 * Renders a fixed-width rotating spinner (⠋, ⠙, ⠹, ⠸, ⠼, ⠴) at 10 FPS with
 * sinusoidal color oscillation between textMuted and accent.
 *
 * When motion is "off" or "reduced":
 * - Displays static "✦" indicator.
 * - Starts zero interval timers (zero CPU consumption).
 */
export function ThinkingIndicator({
  theme,
  label = "正在思考...",
  slotWidth = 2,
  motionMode,
  active = true,
}: ThinkingIndicatorProps) {
  const { isReduced } = useMotionMode(motionMode);
  const { frameIndex } = useSpinner({
    fps: 10,
    active,
    motionMode,
    slotWidth,
  });

  const presentation = getThinkingPresentation(
    theme,
    frameIndex,
    isReduced || !active,
    label,
    slotWidth
  );

  if (!active) {
    return null;
  }

  return (
    <box flexDirection="row" alignItems="center">
      <text fg={presentation.symbolColor}>{presentation.formattedSlot}</text>
      <text fg={presentation.labelColor}>{presentation.label}</text>
    </box>
  );
}
