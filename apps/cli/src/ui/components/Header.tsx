import React from "react";
import type { Theme } from "@nightglide/themes";

export type ScreenId = "welcome" | "chat" | "setup" | "themes";

export interface HeaderProps {
  activeScreen: ScreenId;
  theme: Theme;
  model?: string;
  isMock?: boolean;
}

interface NavTab {
  id: ScreenId;
  key: string;
  label: string;
}

const NAV_TABS: readonly NavTab[] = [
  { id: "welcome", key: "1", label: "Welcome" },
  { id: "chat", key: "2", label: "Flight Deck" },
  { id: "setup", key: "3", label: "Setup" },
  { id: "themes", key: "4", label: "Themes" },
] as const;

export function Header({
  activeScreen,
  theme,
  model = "qwen2.5-coder:7b",
  isMock = false,
}: HeaderProps) {
  const engineLabel = isMock ? "Mock Engine" : model;

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
          <text fg={theme.colors.border}>│</text>
          <text fg={theme.colors.textMuted}>Celestial AI Flight</text>
        </box>

        {/* Navigation Tabs */}
        <box flexDirection="row" alignItems="center" gap={1}>
          {NAV_TABS.map((tab) => {
            const isActive = activeScreen === tab.id;
            return (
              <box
                key={tab.id}
                paddingX={1}
                backgroundColor={isActive ? theme.colors.selection : "transparent"}
              >
                <text
                  fg={isActive ? theme.colors.accent : theme.colors.textSecondary}
                >
                  [{tab.key}] {tab.label}
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
          <box
            paddingX={1}
            backgroundColor={theme.colors.surfaceElevated}
          >
            <text fg={theme.colors.textMuted}>
              ◐ {theme.name}
            </text>
          </box>
        </box>
      </box>
    </box>
  );
}
