import React from "react";
import { useKeyboard } from "@opentui/react";
import type { Theme } from "@nightglide/themes";
import type { ApprovalAnswer, FileDiffData } from "@nightglide/core";
import type { TerminalDimensions } from "../../dimensions.js";
import { DiffViewer } from "../diff/DiffViewer.js";
import { getToolCategory, getToolIcon, formatToolSummary } from "./toolUtils.js";
import { truncateLine } from "../diff/diffParser.js";

export interface ApprovalPromptViewProps {
  id?: string;
  toolName: string;
  input?: Record<string, unknown>;
  diff?: FileDiffData | string;
  prompt?: {
    full: string;
    compact: string;
    session?: string;
  };
  resolve: (answer: ApprovalAnswer) => void;
  theme: Theme;
  dimensions?: TerminalDimensions;
}

/**
 * Pure keyboard handler for Native Approval Gate decisions.
 * Returns true if the key event was consumed and resolved.
 */
export function handleApprovalKey(
  key: { name: string; ctrl?: boolean; shift?: boolean },
  resolve: (answer: ApprovalAnswer) => void
): boolean {
  if (!key || !key.name) return false;
  const name = key.name.toLowerCase();

  if (name === "y") {
    resolve("once");
    return true;
  }
  if (name === "a") {
    resolve("session");
    return true;
  }
  if (name === "n") {
    resolve("deny");
    return true;
  }
  if (name === "escape" || name === "esc") {
    resolve("deny");
    return true;
  }
  return false;
}

/**
 * Native Approval Gate View.
 * Displays pending tool call details requiring user permission.
 * For file modifications (edit/write), embeds the Terminal Diff Viewer.
 * Intercepts keyboard input to invoke `resolve("once" | "session" | "deny")`.
 */
export function ApprovalPromptView({
  id,
  toolName,
  input = {},
  diff: propDiff,
  prompt,
  resolve,
  theme,
  dimensions,
}: ApprovalPromptViewProps) {
  // Wire up OpenTUI React keyboard hook
  try {
    useKeyboard((key) => {
      handleApprovalKey(key, resolve);
    });
  } catch {
    // In headless/test environments where useKeyboard context might not be mounted
  }

  const effectiveWidth =
    dimensions?.width ?? (process.stdout?.columns && process.stdout.columns > 0 ? process.stdout.columns : 100);
  const isNarrow = effectiveWidth < 80;

  const category = getToolCategory(toolName);
  const icon = getToolIcon(toolName);
  const isBash = category === "bash";
  const isFileEdit = category === "edit" || category === "write";

  // Check for embedded diff in props or input
  const diffData: FileDiffData | string | undefined =
    propDiff ||
    (input.diff as FileDiffData | string | undefined) ||
    (input.patch as string | undefined);

  // Target summary representation
  const targetSummary = formatToolSummary(toolName, input);

  return (
    <box
      flexDirection="column"
      width="100%"
      backgroundColor={theme.colors.surfaceElevated}
      borderColor={theme.colors.warning}
      borderStyle="single"
      paddingX={1}
      paddingY={0}
      marginY={0}
    >
      {/* Approval Header */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        width="100%"
        backgroundColor={theme.colors.surface}
        paddingX={1}
      >
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.warning}>⚠ NATIVE APPROVAL GATE</text>
          <text fg={theme.colors.border}>│</text>
          <text fg={theme.colors.accent}>
            {icon} TOOL: {toolName.toUpperCase()}
          </text>
        </box>
        <text fg={theme.colors.warning}>[ACTION REQUIRED]</text>
      </box>

      {/* Target Details */}
      <box flexDirection="column" paddingX={1} marginY={0}>
        {isBash ? (
          <box flexDirection="column">
            <box flexDirection="row" gap={1}>
              <text fg={theme.colors.accent}>Command:</text>
              <text fg={theme.colors.textPrimary}>
                {isNarrow ? truncateLine(targetSummary, effectiveWidth - 15) : targetSummary}
              </text>
            </box>
            {Boolean(input.cwd) && (
              <box flexDirection="row" gap={1}>
                <text fg={theme.colors.textMuted}>Directory:</text>
                <text fg={theme.colors.textSecondary}>{String(input.cwd)}</text>
              </box>
            )}
          </box>
        ) : (
          <box flexDirection="row" gap={1}>
            <text fg={theme.colors.accent}>Target:</text>
            <text fg={theme.colors.textPrimary}>
              {isNarrow ? truncateLine(targetSummary, effectiveWidth - 15) : targetSummary}
            </text>
          </box>
        )}

        {/* Custom Prompt Message if provided */}
        {prompt?.full && (
          <box marginY={0}>
            <text fg={theme.colors.textSecondary}>{prompt.full}</text>
          </box>
        )}
      </box>

      {/* Embedded Terminal Diff Viewer for file edits/writes */}
      {isFileEdit && diffData && (
        <box flexDirection="column" width="100%" marginY={0}>
          <DiffViewer
            diff={diffData}
            filePath={typeof input.path === "string" ? input.path : undefined}
            theme={theme}
            dimensions={dimensions}
            width={effectiveWidth - 4}
            maxHeight={14}
            compact={true}
          />
        </box>
      )}

      {/* Action Prompt Footer */}
      <box
        flexDirection="row"
        justifyContent={isNarrow ? "flex-start" : "space-between"}
        alignItems="center"
        width="100%"
        backgroundColor={theme.colors.surface}
        borderColor={theme.colors.border}
        borderStyle="single"
        paddingX={1}
        marginY={0}
      >
        <box flexDirection="row" alignItems="center" gap={isNarrow ? 1 : 2}>
          <box flexDirection="row">
            <text fg={theme.colors.success}>[y] </text>
            <text fg={theme.colors.textPrimary}>Approve once</text>
          </box>

          <box flexDirection="row">
            <text fg={theme.colors.accent}>[a] </text>
            <text fg={theme.colors.textPrimary}>Always for session</text>
          </box>

          <box flexDirection="row">
            <text fg={theme.colors.error}>[n] </text>
            <text fg={theme.colors.textPrimary}>Deny</text>
          </box>

          <box flexDirection="row">
            <text fg={theme.colors.textMuted}>[Esc] </text>
            <text fg={theme.colors.textMuted}>Cancel</text>
          </box>
        </box>
      </box>
    </box>
  );
}
