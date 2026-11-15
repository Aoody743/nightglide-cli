import React from "react";
import type { Theme } from "@nightglide/themes";
import {
  DELEGATION_SPARK,
  DELEGATION_SPARK_REDUCED,
  TIMING_TIERS,
  type MotionMode,
} from "../../motion/constants.js";
import { useMotionMode } from "../../motion/reducedMotion.js";
import { useTimedFeedback } from "../../motion/hooks.js";
import { reserveSlot } from "../../motion/slots.js";

export type AgentMotionState = "waiting" | "running" | "completed" | "error";

export interface AgentStatusMotionProps {
  theme: Theme;
  role: string;
  status: AgentMotionState;
  isDelegating?: boolean;
  motionMode?: MotionMode;
  transitionDurationMs?: number;
  sparkSlotWidth?: number;
}

export interface AgentStatusPresentation {
  roleBadge: string;
  statusBadge: string;
  spark: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
}

/**
 * Pure presentation helper for ANIM-AGENT-001 & ANIM-AGENT-002.
 */
export function getAgentStatusPresentation(
  theme: Theme,
  role: string,
  status: AgentMotionState,
  isDelegating: boolean,
  isHighlighting: boolean,
  isReduced: boolean,
  sparkSlotWidth: number = 8
): AgentStatusPresentation {
  const roleUpper = (role || "AGENT").toUpperCase();
  const roleBadge = reserveSlot(`[${roleUpper}]`, 12);

  let statusBadgeText = "[WAITING]";
  let color = theme.colors.textMuted;
  let borderColor = theme.colors.border;
  let backgroundColor = theme.colors.surface;

  switch (status) {
    case "running":
      statusBadgeText = "[RUNNING]";
      color = theme.colors.accent;
      borderColor = isHighlighting && !isReduced ? theme.colors.accent : theme.colors.border;
      backgroundColor = isHighlighting && !isReduced ? theme.colors.surfaceElevated : theme.colors.surface;
      break;

    case "completed":
      statusBadgeText = "[COMPLETED]";
      color = theme.colors.success;
      borderColor = isHighlighting && !isReduced ? theme.colors.success : theme.colors.border;
      backgroundColor = theme.colors.surface;
      break;

    case "error":
      statusBadgeText = "[FAILED]";
      color = theme.colors.error;
      borderColor = theme.colors.error;
      backgroundColor = theme.colors.surface;
      break;

    case "waiting":
    default:
      statusBadgeText = "[WAITING]";
      color = theme.colors.textMuted;
      borderColor = theme.colors.border;
      backgroundColor = theme.colors.surface;
      break;
  }

  const rawSpark = isDelegating
    ? isReduced
      ? DELEGATION_SPARK_REDUCED
      : DELEGATION_SPARK
    : "";
  const spark = reserveSlot(rawSpark, sparkSlotWidth);

  return {
    roleBadge,
    statusBadge: reserveSlot(statusBadgeText, 12),
    spark,
    color,
    backgroundColor,
    borderColor,
  };
}

/**
 * ANIM-AGENT-001 / ANIM-AGENT-002: Multi-Agent Delegation & State Shifting Motion
 *
 * Implements delegation spark lines (ANIM-AGENT-001) and state transition feedback (ANIM-AGENT-002)
 * for the AgentMonitor.
 *
 * When motion is "off" or "reduced":
 * - Transitions complete with 0ms delay.
 * - Starts zero timers.
 */
export function AgentStatusMotion({
  theme,
  role,
  status,
  isDelegating = false,
  motionMode,
  transitionDurationMs = TIMING_TIERS.MICRO,
  sparkSlotWidth = 8,
}: AgentStatusMotionProps) {
  const { isReduced } = useMotionMode(motionMode);
  const isHighlighting = useTimedFeedback({
    durationMs: transitionDurationMs,
    active: status === "running" || status === "completed",
    motionMode,
  });

  const presentation = getAgentStatusPresentation(
    theme,
    role,
    status,
    isDelegating,
    isHighlighting,
    isReduced,
    sparkSlotWidth
  );

  return (
    <box
      flexDirection="row"
      alignItems="center"
      backgroundColor={presentation.backgroundColor}
      borderColor={presentation.borderColor}
      paddingX={1}
    >
      <text fg={theme.colors.accentSecondary}>{presentation.roleBadge}</text>
      {isDelegating && <text fg={theme.colors.accent}>{presentation.spark}</text>}
      <text fg={presentation.color}>{presentation.statusBadge}</text>
    </box>
  );
}
