import React from "react";
import type { Theme } from "@nightglide/themes";
import type { ScreenId } from "../components/Header.js";
import type { TerminalDimensions } from "../dimensions.js";

export interface WelcomeScreenProps {
  theme: Theme;
  onNavigate: (screen: ScreenId) => void;
  workspacePath?: string;
  model?: string;
  isMock?: boolean;
  dimensions?: TerminalDimensions;
}

export function WelcomeScreen({
  theme,
  onNavigate,
  workspacePath = process.cwd(),
  model = "qwen2.5-coder:7b",
  isMock = false,
  dimensions,
}: WelcomeScreenProps) {
  const home = process.env.HOME || "";
  const displayPath =
    home && workspacePath.startsWith(home)
      ? "~" + workspacePath.slice(home.length)
      : workspacePath;

  const isCompact = dimensions?.isCompactHeight ?? false;

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.colors.background}
      paddingX={dimensions?.isCompactWidth ? 1 : 3}
      paddingY={isCompact ? 0 : 1}
      gap={1}
    >
      {/* Celestial Horizon Banner */}
      <box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingY={isCompact ? 0 : 1}
        borderColor={theme.colors.border}
        borderStyle="single"
        backgroundColor={theme.colors.surface}
      >
        {isCompact ? (
          <box flexDirection="column" alignItems="center">
            <text fg={theme.colors.accent}>
              ✦ NIGHTGLIDE · Build beyond the horizon ✦
            </text>
            <text fg={theme.colors.textMuted}>
              漫翔苍穹，构筑所想。
            </text>
          </box>
        ) : (
          <>
            <text fg={theme.colors.accentSecondary}>
              ✦   *      ·         ★         ·      *   ✦
            </text>
            <text fg={theme.colors.accent}>
              _  _ _ ____ _  _ ___ ____ _    _ ___  ____
            </text>
            <text fg={theme.colors.accent}>
              |\ | | | __ |--|  |  |__, |___ | |__] |===
            </text>
            <text fg={theme.colors.accentSecondary}>
              ·      ★         ✦  N I G H T G L I D E  ✦         ★      ·
            </text>
            <box marginTop={1} flexDirection="column" alignItems="center">
              <text fg={theme.colors.textPrimary}>
                Build beyond the horizon.
              </text>
              <text fg={theme.colors.textMuted}>
                漫翔苍穹，构筑所想。
              </text>
            </box>
          </>
        )}
      </box>

      {/* System Context Card */}
      <box
        flexDirection="column"
        backgroundColor={theme.colors.surface}
        borderColor={theme.colors.border}
        borderStyle="single"
        paddingX={2}
        paddingY={1}
        gap={1}
      >
        <box flexDirection="row" justifyContent="space-between">
          <box flexDirection="row" gap={1}>
            <text fg={theme.colors.accent}>WORKSPACE:</text>
            <text fg={theme.colors.textPrimary}>{displayPath}</text>
          </box>
          <box flexDirection="row" gap={1}>
            <text fg={theme.colors.accentSecondary}>ENGINE:</text>
            <text fg={theme.colors.textPrimary}>
              {isMock ? "Mock Engine (Deterministic)" : "OMP Adapter (Live)"}
            </text>
          </box>
        </box>
        <box flexDirection="row" justifyContent="space-between">
          <box flexDirection="row" gap={1}>
            <text fg={theme.colors.textMuted}>ACTIVE MODEL:</text>
            <text fg={theme.colors.textPrimary}>{model}</text>
          </box>
          <box flexDirection="row" gap={1}>
            <text fg={theme.colors.textMuted}>THEME:</text>
            <text fg={theme.colors.accent}>
              {theme.name} ({theme.type})
            </text>
          </box>
        </box>
      </box>

      {/* Quick Navigation Action Cards */}
      <box flexDirection="row" gap={1} width="100%">
        {/* Chat / Flight Deck */}
        <box
          flexDirection="column"
          flexGrow={1}
          backgroundColor={theme.colors.surface}
          borderColor={theme.colors.accent}
          borderStyle="single"
          paddingX={2}
          paddingY={1}
        >
          <text fg={theme.colors.accent}>[2] Flight Deck (Chat)</text>
          <text fg={theme.colors.textSecondary}>
            Enter the interactive coding console. Stream assistant responses, invoke native tools, and collaborate with subagents.
          </text>
        </box>

        {/* Setup */}
        <box
          flexDirection="column"
          flexGrow={1}
          backgroundColor={theme.colors.surface}
          borderColor={theme.colors.border}
          borderStyle="single"
          paddingX={2}
          paddingY={1}
        >
          <text fg={theme.colors.accentSecondary}>[3] Setup</text>
          <text fg={theme.colors.textSecondary}>
            Configure local Apple Silicon inference (oMLX/Ollama) or secure cloud providers (Claude, GPT, DeepSeek).
          </text>
        </box>

        {/* Themes */}
        <box
          flexDirection="column"
          flexGrow={1}
          backgroundColor={theme.colors.surface}
          borderColor={theme.colors.border}
          borderStyle="single"
          paddingX={2}
          paddingY={1}
        >
          <text fg={theme.colors.textPrimary}>[4] Celestial Themes</text>
          <text fg={theme.colors.textSecondary}>
            Switch atmospheric palettes: Midnight Flight, Aurora, Cloudlight, Daybreak.
          </text>
        </box>

        {/* Models */}
        <box
          flexDirection="column"
          flexGrow={1}
          backgroundColor={theme.colors.surface}
          borderColor={theme.colors.border}
          borderStyle="single"
          paddingX={2}
          paddingY={1}
        >
          <text fg={theme.colors.accent}>[5] Model Matrix</text>
          <text fg={theme.colors.textSecondary}>
            Configure subagents (Planner, Reviewer, Scout, Task) and routing modes.
          </text>
        </box>
      </box>

      {/* Philosophy Footnote */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        paddingX={1}
      >
        <text fg={theme.colors.textMuted}>
          "Where local intelligence meets unbounded flight."
        </text>
        <text fg={theme.colors.textMuted}>
          Press [1-5] to navigate, [Tab] for Mode, or [Q] to return to terminal
        </text>
      </box>
    </box>
  );
}
