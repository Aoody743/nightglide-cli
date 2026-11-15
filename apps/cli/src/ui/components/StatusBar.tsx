import React from "react";
import type { Theme } from "@nightglide/themes";
import type { AgentStatus } from "@nightglide/core";

export interface StatusBarProps {
  theme: Theme;
  workspacePath?: string;
  activeScreen?: string;
  status?: AgentStatus;
}

export function StatusBar({
  theme,
  workspacePath = process.cwd(),
  activeScreen = "welcome",
  status = "idle",
}: StatusBarProps) {
  // Shorten workspace path if home directory prefix matches
  const home = process.env.HOME || "";
  const displayPath = home && workspacePath.startsWith(home)
    ? "~" + workspacePath.slice(home.length)
    : workspacePath;

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
      <box flexDirection="row" alignItems="center" gap={1}>
        <text fg={theme.colors.accent}>[1]</text>
        <text fg={theme.colors.textSecondary}>Welcome</text>
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
        <text fg={theme.colors.error}>[Q]</text>
        <text fg={theme.colors.textMuted}>Exit</text>
      </box>

      {/* Workspace indicator */}
      <box flexDirection="row" alignItems="center" gap={1}>
        <text fg={theme.colors.accentSecondary}>⌂</text>
        <text fg={theme.colors.textSecondary}>{displayPath}</text>
      </box>

      {/* Active Theme & Mode */}
      <box flexDirection="row" alignItems="center" gap={1}>
        <text fg={theme.colors.textMuted}>Theme:</text>
        <text fg={theme.colors.accent}>{theme.name}</text>
        <text fg={theme.colors.textMuted}>({theme.type})</text>
      </box>
    </box>
  );
}
