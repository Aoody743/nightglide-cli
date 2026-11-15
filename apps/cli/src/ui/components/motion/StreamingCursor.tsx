import React from "react";
import type { Theme } from "@nightglide/themes";
import {
  STREAMING_CURSOR_CHAR,
  INTERVAL_BLINK,
  type MotionMode,
} from "../../motion/constants.js";
import { useMotionMode } from "../../motion/reducedMotion.js";
import { useBlink } from "../../motion/hooks.js";
import { reserveSlot } from "../../motion/slots.js";

export interface StreamingCursorProps {
  theme: Theme;
  isStreaming: boolean;
  motionMode?: MotionMode;
  cursorChar?: string;
  reserveSlot?: boolean;
}

export interface StreamingCursorPresentation {
  visible: boolean;
  char: string;
  color: string;
}

/**
 * Pure presentation helper for ANIM-STREAM-002.
 */
export function getStreamingCursorPresentation(
  theme: Theme,
  isVisible: boolean,
  isStreaming: boolean,
  isReduced: boolean,
  cursorChar: string = STREAMING_CURSOR_CHAR,
  shouldReserveSlot: boolean = true
): StreamingCursorPresentation {
  if (!isStreaming) {
    return {
      visible: false,
      char: shouldReserveSlot ? " " : "",
      color: theme.colors.textMuted,
    };
  }

  if (isReduced) {
    // In reduced motion mode: static non-blinking slot
    return {
      visible: false,
      char: shouldReserveSlot ? " " : "",
      color: theme.colors.textMuted,
    };
  }

  return {
    visible: isVisible,
    char: isVisible ? cursorChar : shouldReserveSlot ? " " : "",
    color: theme.colors.accent,
  };
}

/**
 * ANIM-STREAM-002: Terminal Cursor Shimmer
 *
 * Renders a fixed-slot block cursor (█) blinking at 500ms (2 Hz) during
 * streaming token generation. Automatically and cleanly unmounts when streaming ends.
 *
 * When motion is "off" or "reduced":
 * - Hidden or static blank slot.
 * - Starts zero interval timers.
 */
export function StreamingCursor({
  theme,
  isStreaming,
  motionMode,
  cursorChar = STREAMING_CURSOR_CHAR,
  reserveSlot: shouldReserveSlot = true,
}: StreamingCursorProps) {
  const { isReduced } = useMotionMode(motionMode);
  const isVisible = useBlink({
    intervalMs: INTERVAL_BLINK,
    active: isStreaming,
    motionMode,
  });

  const presentation = getStreamingCursorPresentation(
    theme,
    isVisible,
    isStreaming,
    isReduced,
    cursorChar,
    shouldReserveSlot
  );

  if (!isStreaming && !shouldReserveSlot) {
    return null;
  }

  return <text fg={presentation.color}>{presentation.char}</text>;
}
