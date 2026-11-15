import React from "react";
import type { Theme } from "@nightglide/themes";
import type { AgentStatus } from "@nightglide/core";
import type { TerminalDimensions } from "../dimensions.js";

export interface StatusBarProps {
  theme: Theme;
  workspacePath?: string;
  activeScreen?: string;
  status?: AgentStatus;
  dimensions?: TerminalDimensions;
  interactionMode?: "guided" | "expert";
}

export function StatusBar({
  theme,
  workspacePath = process.cwd(),
  activeScreen = "welcome",
  status = "idle",
  dimensions,
  interactionMode = "guided",
}: StatusBarProps) {
  const home = process.env.HOME || "";
  const displayPath = home && workspacePath.startsWith(home)
    ? "~" + workspacePath.slice(home.length)
    : workspacePath;

  const isCompact = dimensions?.isCompactWidth ?? false;
  const isUltraCompact = (dimensions?.width ?? 100) < 85;

  // Truncate path if in compact mode
  const formattedPath = isUltraCompact
    ? displayPath.split("/").slice(-2).join("/")
    : displayPath;

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      width="100%"
      backgroundColor={theme.colors.surface}
      borderColor={theme.colors.border}
      borderStyle="single"
      paddingX={1}
      height={3}
    >
      {/* Navigation shortcuts */}
      {isUltraCompact ? (
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.accent}>[1-5]</text>
          <text fg={theme.colors.textSecondary}>Tabs</text>
          <text fg={theme.colors.border}>·</text>
          <text fg={theme.colors.accentSecondary}>[Tab]</text>
          <text fg={theme.colors.textSecondary}>Mode</text>
          <text fg={theme.colors.border}>·</text>
          <text fg={theme.colors.error}>[Q]</text>
          <text fg={theme.colors.textMuted}>Exit</text>
        </box>
      ) : (
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.accent}>[1]</text>
          <text fg={theme.colors.textSecondary}>Home</text>
          <text fg={theme.colors.border}>·</text>
          <text fg={theme.colors.accent}>[2]</text>
          <text fg={theme.colors.textSecondary}>Chat</text>
          <text fg={theme.colors.border}>·</text>
          <text fg={theme.colors.accent}>[3]</text>
          <text fg={theme.colors.textSecondary}>Setup</text>
          <text fg={theme.colors.border}>·</text>
          <text fg={theme.colors.accent}>[4]</text>
          <text fg={theme.colors.textSecondary}>Themes</text>
          <text fg={theme.colors.border}>·</text>
          <text fg={theme.colors.accent}>[5]</text>
          <text fg={theme.colors.textSecondary}>Models</text>
          <text fg={theme.colors.border}>·</text>
          <text fg={theme.colors.accentSecondary}>[Tab]</text>
          <text fg={theme.colors.textSecondary}>Mode</text>
          <text fg={theme.colors.border}>·</text>
          <text fg={theme.colors.error}>[Q]</text>
          <text fg={theme.colors.textMuted}>Exit</text>
        </box>
      )}

      {/* Workspace indicator */}
      <box flexDirection="row" alignItems="center" gap={1}>
        <text fg={theme.colors.accentSecondary}>⌂</text>
        <text fg={theme.colors.textSecondary}>{formattedPath}</text>
      </box>

      {/* Active Mode & Theme */}
      {!isUltraCompact ? (
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.textMuted}>Mode:</text>
          <text
            fg={
              interactionMode === "expert"
                ? theme.colors.accentSecondary
                : theme.colors.accent
            }
          >
            {interactionMode === "expert" ? "Expert" : "Guided"}
          </text>
          <text fg={theme.colors.border}>│</text>
          <text fg={theme.colors.textMuted}>Theme:</text>
          <text fg={theme.colors.accent}>{theme.name}</text>
          <text fg={theme.colors.textMuted}>({theme.type})</text>
        </box>
      ) : (
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.accent}>
            {interactionMode === "expert" ? "[Exp]" : "[Gld]"}
          </text>
        </box>
      )}
    </box>
  );
}
