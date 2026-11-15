import React from "react";
import type { Theme } from "@nightglide/themes";
import {
  TOOL_ICONS,
  TIMING_TIERS,
  type MotionMode,
} from "../../motion/constants.js";
import { useMotionMode } from "../../motion/reducedMotion.js";
import { useTimedFeedback } from "../../motion/hooks.js";
import { reserveSlot } from "../../motion/slots.js";

export type ToolMotionStatus = "idle" | "running" | "completed" | "error";

export interface ToolStatusMotionProps {
  theme: Theme;
  status: ToolMotionStatus;
  toolName?: string;
  summary?: string;
  motionMode?: MotionMode;
  flashDurationMs?: number;
  iconSlotWidth?: number;
  badgeSlotWidth?: number;
}

export interface ToolStatusPresentation {
  icon: string;
  iconSlot: string;
  badge: string;
  badgeSlot: string;
  color: string;
  backgroundColor: string;
  title: string;
}

/**
 * Pure presentation helper for ANIM-TOOL-001 & ANIM-TOOL-003.
 * Guarantees zero horizontal jitter through deterministic slot reservation.
 */
export function getToolStatusPresentation(
  theme: Theme,
  status: ToolMotionStatus,
  isFlashing: boolean,
  isReduced: boolean,
  toolName: string = "tool",
  summary?: string,
  iconSlotWidth: number = 2,
  badgeSlotWidth: number = 11
): ToolStatusPresentation {
  let icon: string = TOOL_ICONS.IDLE;
  let badge: string = "[IDLE]";
  let color = theme.colors.textMuted;
  let backgroundColor = theme.colors.surface;
  let title = summary || `TOOL: ${toolName}`;

  switch (status) {
    case "running":
      icon = TOOL_ICONS.RUNNING;
      badge = "[RUNNING]";
      color = theme.colors.info;
      backgroundColor = theme.colors.surfaceElevated;
      title = summary || `TOOL: ${toolName} (executing...)`;
      break;

    case "completed":
      icon = TOOL_ICONS.COMPLETED;
      badge = "[DONE]";
      // On fresh completion flash (unless reduced motion), flash success color
      color = theme.colors.success;
      backgroundColor = isFlashing && !isReduced ? theme.colors.surfaceElevated : theme.colors.surface;
      title = summary || `${toolName} (completed)`;
      break;

    case "error":
      icon = TOOL_ICONS.ERROR;
      badge = "[FAILED]";
      color = theme.colors.error;
      backgroundColor = theme.colors.surface;
      title = summary || `${toolName} (failed)`;
      break;

    case "idle":
    default:
      icon = TOOL_ICONS.IDLE;
      badge = "[IDLE]";
      color = theme.colors.textMuted;
      backgroundColor = theme.colors.surface;
      title = summary || `TOOL: ${toolName}`;
      break;
  }

  return {
    icon,
    iconSlot: reserveSlot(icon, iconSlotWidth),
    badge,
    badgeSlot: reserveSlot(badge, badgeSlotWidth),
    color,
    backgroundColor,
    title,
  };
}

/**
 * ANIM-TOOL-001 / ANIM-TOOL-003: Tool Execution Motion Feedback
 *
 * Provides execution pulse (ANIM-TOOL-001), 150ms success flash (ANIM-TOOL-003),
 * and deterministic fixed-width slot alignment.
 *
 * When motion is "off" or "reduced":
 * - Transitions complete with 0ms delay.
 * - Starts zero timers.
 */
export function ToolStatusMotion({
  theme,
  status,
  toolName = "tool",
  summary,
  motionMode,
  flashDurationMs = TIMING_TIERS.TRANSITION,
  iconSlotWidth = 2,
  badgeSlotWidth = 11,
}: ToolStatusMotionProps) {
  const { isReduced } = useMotionMode(motionMode);
  const isFlashing = useTimedFeedback({
    durationMs: flashDurationMs,
    active: status === "completed",
    motionMode,
  });

  const presentation = getToolStatusPresentation(
    theme,
    status,
    isFlashing,
    isReduced,
    toolName,
    summary,
    iconSlotWidth,
    badgeSlotWidth
  );

  return (
    <box
      flexDirection="row"
      alignItems="center"
      backgroundColor={presentation.backgroundColor}
      borderColor={theme.colors.border}
      paddingX={1}
    >
      <text fg={presentation.color}>{presentation.iconSlot}</text>
      <text fg={presentation.color}>{presentation.badgeSlot}</text>
      <text fg={theme.colors.textPrimary}>{presentation.title}</text>
    </box>
  );
}
