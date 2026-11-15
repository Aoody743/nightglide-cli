import React from "react";
import type { ToolCardProps } from "./toolTypes.js";
import {
  getToolIcon,
  getToolBadge,
  formatToolSummary,
  formatToolResultSummary,
  formatToolDuration,
} from "./toolUtils.js";
import { truncateLine } from "../diff/diffParser.js";

/**
 * Compact Native Tool Card designed for Expert mode and collapsed history timelines.
 * Renders concise single-line tool events with icons, target arguments, and status badges.
 */
export function CompactToolCard({
  toolName,
  input,
  result,
  error,
  status,
  durationMs,
  theme,
  dimensions,
  onToggleExpand,
}: ToolCardProps) {
  const icon = getToolIcon(toolName);
  const badge = getToolBadge(status, theme);
  const summary = formatToolSummary(toolName, input);
  const duration = formatToolDuration(durationMs);
  const resultSummary = formatToolResultSummary(toolName, result, 35);

  const effectiveWidth =
    dimensions?.width ?? (process.stdout?.columns && process.stdout.columns > 0 ? process.stdout.columns : 100);
  const isNarrow = effectiveWidth < 80;

  // Adapt length based on narrow terminal breakpoint (<80 cols)
  const maxArgLength = isNarrow ? 28 : 50;
  const truncatedSummary = truncateLine(summary, maxArgLength);

  const borderColor = status === "error" ? theme.colors.error : theme.colors.border;

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      width="100%"
      backgroundColor={theme.colors.surfaceElevated}
      borderColor={borderColor}
      borderStyle="single"
      paddingX={1}
      paddingY={0}
      marginY={0}
    >
      {/* Left: Icon, Tool Name, Target Argument */}
      <box flexDirection="row" alignItems="center" gap={1}>
        <text fg={theme.colors.info}>
          {icon} [{toolName}]
        </text>
        <text fg={theme.colors.textPrimary}>{truncatedSummary}</text>
      </box>

      {/* Right: Output / Error / Duration / Status Badge */}
      <box flexDirection="row" alignItems="center" gap={1}>
        {error ? (
          <text fg={theme.colors.error}>
            ✖ {truncateLine(error, isNarrow ? 20 : 40)}
          </text>
        ) : resultSummary ? (
          <text fg={theme.colors.textSecondary}>
            {truncateLine(resultSummary, isNarrow ? 15 : 30)}
          </text>
        ) : null}

        {duration && !isNarrow && (
          <text fg={theme.colors.textMuted}>{duration}</text>
        )}

        <text fg={badge.color}>
          {badge.icon} {badge.label}
        </text>
      </box>
    </box>
  );
}
