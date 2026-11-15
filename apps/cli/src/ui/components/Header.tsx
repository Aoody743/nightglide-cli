import React from "react";
import type { Theme } from "@nightglide/themes";
import type { TerminalDimensions } from "../dimensions.js";

export type ScreenId = "welcome" | "chat" | "setup" | "themes" | "models";

export interface HeaderProps {
  activeScreen: ScreenId;
  theme: Theme;
  model?: string;
  isMock?: boolean;
  dimensions?: TerminalDimensions;
}

interface NavTab {
  id: ScreenId;
  key: string;
  label: string;
  compactLabel: string;
}

const NAV_TABS: readonly NavTab[] = [
  { id: "welcome", key: "1", label: "Welcome", compactLabel: "Home" },
  { id: "chat", key: "2", label: "Flight Deck", compactLabel: "Chat" },
  { id: "setup", key: "3", label: "Setup", compactLabel: "Setup" },
  { id: "themes", key: "4", label: "Themes", compactLabel: "Themes" },
  { id: "models", key: "5", label: "Model Matrix", compactLabel: "Models" },
] as const;

export function Header({
  activeScreen,
  theme,
  model = "qwen2.5-coder:7b",
  isMock = false,
  dimensions,
}: HeaderProps) {
  const engineLabel = isMock ? "Mock" : model.replace(":instruct", "");
  const isCompact = dimensions?.isCompactWidth ?? false;
  const isUltraCompact = (dimensions?.width ?? 100) < 85;

  return (
    <box
      flexDirection="column"
      width="100%"
      backgroundColor={theme.colors.surface}
      borderColor={theme.colors.border}
      borderStyle="single"
      paddingX={1}
      paddingY={0}
    >
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        width="100%"
      >
        {/* Brand Wordmark & Horizon Symbol */}
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.accent}>✦ NIGHTGLIDE</text>
          {!isCompact && (
            <>
              <text fg={theme.colors.border}>│</text>
              <text fg={theme.colors.textMuted}>Celestial AI Flight</text>
            </>
          )}
        </box>

        {/* Navigation Tabs */}
        <box flexDirection="row" alignItems="center" gap={1}>
          {NAV_TABS.map((tab) => {
            const isActive = activeScreen === tab.id;
            const labelText = isCompact ? tab.compactLabel : tab.label;
            return (
              <box
                key={tab.id}
                paddingX={1}
                backgroundColor={isActive ? theme.colors.selection : "transparent"}
              >
                <text
                  fg={isActive ? theme.colors.accent : theme.colors.textSecondary}
                >
                  [{tab.key}] {labelText}
                </text>
              </box>
            );
          })}
        </box>

        {/* Engine and Theme Pills */}
        <box flexDirection="row" alignItems="center" gap={1}>
          <box
            paddingX={1}
            backgroundColor={theme.colors.surfaceElevated}
            borderColor={theme.colors.border}
          >
            <text fg={theme.colors.accentSecondary}>
              ◈ {engineLabel}
            </text>
          </box>
          {!isUltraCompact && (
            <box
              paddingX={1}
              backgroundColor={theme.colors.surfaceElevated}
            >
              <text fg={theme.colors.textMuted}>
                ◐ {theme.name}
              </text>
            </box>
          )}
        </box>
      </box>
    </box>
  );
}
