import React from "react";
import type { ToolCardProps } from "./toolTypes.js";
import {
  getToolIcon,
  getToolBadge,
  formatToolSummary,
  formatToolDuration,
  isDestructiveOrHighRisk,
} from "./toolUtils.js";
import { DiffViewer } from "../diff/DiffViewer.js";
import { truncateLine } from "../diff/diffParser.js";

/**
 * Detailed Native Tool Card designed for Guided mode and expanded tool inspection.
 * Renders structured tool headers, clean parameter breakdowns, diff previews,
 * formatted output summaries, and error diagnostics.
 */
export function ExpandedToolCard({
  id,
  toolName,
  input,
  result,
  error,
  diff,
  status,
  durationMs,
  theme,
  dimensions,
  isPendingApproval = false,
  onToggleExpand,
}: ToolCardProps) {
  const icon = getToolIcon(toolName);
  const badge = getToolBadge(status, theme);
  const targetSummary = formatToolSummary(toolName, input);
  const duration = formatToolDuration(durationMs);
  const isHighRisk = isDestructiveOrHighRisk(toolName, input);

  const effectiveWidth =
    dimensions?.width ?? (process.stdout?.columns && process.stdout.columns > 0 ? process.stdout.columns : 100);
  const isNarrow = effectiveWidth < 80;

  // Determine card border color based on status and approval state
  const borderColor =
    status === "error"
      ? theme.colors.error
      : isPendingApproval
      ? theme.colors.warning
      : status === "completed"
      ? theme.colors.success
      : isHighRisk
      ? theme.colors.warning
      : theme.colors.info;

  // Extract stdout or output lines from result
  let outputText: string | undefined;
  if (result !== undefined && result !== null) {
    if (typeof result === "string") {
      outputText = result;
    } else if (typeof result === "object") {
      const obj = result as Record<string, unknown>;
      if (typeof obj.output === "string") {
        outputText = obj.output;
      } else if (typeof obj.stdout === "string") {
        outputText = obj.stdout;
      } else {
        outputText = JSON.stringify(result, null, 2);
      }
    }
  }

  return (
    <box
      flexDirection="column"
      width="100%"
      backgroundColor={theme.colors.surfaceElevated}
      borderColor={borderColor}
      borderStyle="single"
      paddingX={1}
      paddingY={0}
      marginY={0}
    >
      {/* Header Row */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        width="100%"
      >
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.accent}>
            {icon} TOOL: {toolName.toUpperCase()}
          </text>
          {isPendingApproval && (
            <text fg={theme.colors.warning}>[PENDING NATIVE APPROVAL]</text>
          )}
          {isHighRisk && !isPendingApproval && (
            <text fg={theme.colors.warning}>[HIGH RISK]</text>
          )}
        </box>

        <box flexDirection="row" alignItems="center" gap={1}>
          {duration && <text fg={theme.colors.textMuted}>{duration}</text>}
          <text fg={badge.color}>
            {badge.icon} {badge.label}
          </text>
        </box>
      </box>

      {/* Target Summary Row */}
      <box flexDirection="row" alignItems="center" gap={1} marginY={0}>
        <text fg={theme.colors.textSecondary}>Target:</text>
        <text fg={theme.colors.textPrimary}>
          {isNarrow ? truncateLine(targetSummary, effectiveWidth - 16) : targetSummary}
        </text>
      </box>

      {/* Embedded Diff Preview if available */}
      {diff && (
        <box flexDirection="column" width="100%" marginY={0}>
          <DiffViewer
            diff={diff}
            theme={theme}
            dimensions={dimensions}
            width={effectiveWidth - 4}
            maxHeight={12}
            compact={true}
          />
        </box>
      )}

      {/* Input Parameters if not redundant */}
      {Object.keys(input).length > 0 && !diff && (
        <box flexDirection="column" marginY={0}>
          {Object.entries(input).map(([key, val]) => {
            const valStr = typeof val === "object" ? JSON.stringify(val) : String(val);
            return (
              <box key={key} flexDirection="row" gap={1}>
                <text fg={theme.colors.textMuted}>{key}:</text>
                <text fg={theme.colors.textSecondary}>
                  {isNarrow ? truncateLine(valStr, effectiveWidth - 20) : valStr}
                </text>
              </box>
            );
          })}
        </box>
      )}

      {/* Output / Result Body */}
      {outputText && (
        <box flexDirection="column" marginY={0}>
          <text fg={theme.colors.textMuted}>Result / Output:</text>
          <text fg={theme.colors.textSecondary}>
            {isNarrow ? truncateLine(outputText, effectiveWidth - 10) : outputText}
          </text>
        </box>
      )}

      {/* Error Body */}
      {error && (
        <box
          flexDirection="row"
          alignItems="center"
          gap={1}
          backgroundColor={theme.colors.surface}
          paddingX={1}
          marginY={0}
        >
          <text fg={theme.colors.error}>✖ Error:</text>
          <text fg={theme.colors.error}>
            {isNarrow ? truncateLine(error, effectiveWidth - 16) : error}
          </text>
        </box>
      )}
    </box>
  );
}
