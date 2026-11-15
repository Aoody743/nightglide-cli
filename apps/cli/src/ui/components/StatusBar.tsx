import React from "react";
import type { Theme } from "@nightglide/themes";
import type { AgentStatus } from "@nightglide/core";
import {
  type TerminalDimensions,
  getTerminalTier,
  getTierBadge,
} from "../dimensions.js";

export interface StatusBarProps {
  theme: Theme;
  workspacePath?: string;
  activeScreen?: string;
  status?: AgentStatus;
  dimensions?: TerminalDimensions;
  interactionMode?: "guided" | "expert";
  onToggleHelp?: () => void;
}

export function StatusBar({
  theme,
  workspacePath = process.cwd(),
  activeScreen = "chat",
  status = "idle",
  dimensions,
  interactionMode = "guided",
}: StatusBarProps) {
  const width = dimensions?.width ?? 100;
  const height = dimensions?.height ?? 30;
  const tier = dimensions?.tier ?? getTerminalTier(width, height);
  const tierBadge = getTierBadge(tier);

  const isCompact = dimensions?.isCompactWidth ?? width < 100;
  const isUltraCompact = width < 85;

  const modeLabel = interactionMode === "expert" ? "Expert" : "Guided";
  const tierDisplay = `[${width}x${height} ${tierBadge}]`;
  const modeDisplay = `[Mode: ${modeLabel}]`;
  const themeDisplay = `[Theme: ${theme.name}]`;
  const helpHint = "[?] Help";

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
      height={1}
    >
      {/* Left side: Terminal Tier, Mode Indicator, Theme Name */}
      <box flexDirection="row" alignItems="center" gap={1}>
        <text fg={theme.colors.textMuted}>{tierDisplay}</text>
        <text
          fg={
            interactionMode === "expert"
              ? theme.colors.accentSecondary
              : theme.colors.accent
          }
        >
          {modeDisplay}
        </text>
        <text fg={theme.colors.textSecondary}>{themeDisplay}</text>
      </box>

      {/* Right side: Navigation hint, Help toggle hint */}
      <box flexDirection="row" alignItems="center" gap={1}>
        {!isCompact && (
          <>
            <text fg={theme.colors.textMuted}>[Tab] Switch Mode</text>
            <text fg={theme.colors.border}>·</text>
          </>
        )}
        <text fg={theme.colors.accentSecondary}>{helpHint}</text>
        {!isUltraCompact && (
          <>
            <text fg={theme.colors.border}>·</text>
            <text fg={theme.colors.textMuted}>[Ctrl+C] Exit</text>
          </>
        )}
      </box>
    </box>
  );
}
