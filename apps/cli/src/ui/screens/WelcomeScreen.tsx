import React from "react";
import type { Theme, UIMetaphor } from "@nightglide/themes";
import type { ScreenId } from "../components/Header.js";
import type { TerminalDimensions } from "../dimensions.js";

export interface WelcomeScreenProps {
  theme: Theme;
  onNavigate: (screen: ScreenId) => void;
  workspacePath?: string;
  model?: string;
  isMock?: boolean;
  dimensions?: TerminalDimensions;
  metaphor?: UIMetaphor;
}

/**
 * 6-line high-contrast, bold ANSI block font for Nightglide banner.
 * Exactly 75 columns wide, solid thickness, no thin/broken glyphs.
 */
const BOLD_BANNER_LINES: readonly string[] = [
  "███╗   ██╗██╗ ██████╗ ██╗  ██╗████████╗ ██████╗ ██╗     ██╗██████╗ ███████╗",
  "████╗  ██║██║██╔════╝ ██║  ██║╚══██╔══╝██╔════╝ ██║     ██║██╔══██╗██╔════╝",
  "██╔██╗ ██║██║██║  ███╗███████║   ██║   ██║  ███╗██║     ██║██║  ██║█████╗  ",
  "██║╚██╗██║██║██║   ██║██╔══██║   ██║   ██║   ██║██║     ██║██║  ██║██╔══╝  ",
  "██║ ╚████║██║╚██████╔╝██║  ██║   ██║   ╚██████╔╝███████╗██║██████╔╝███████╗",
  "╚═╝  ╚═══╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚══════╝╚═╝╚═════╝ ╚══════╝",
] as const;

/**
 * Compact 5-line standard font for narrower terminals (60-79 columns).
 * Exactly 55 columns wide.
 */
const COMPACT_BANNER_LINES: readonly string[] = [
  " _   _ ___ ____ _   _ _____ ____ _     ___ ____  _____ ",
  "| \\ | |_ _/ ___| | | |_   _/ ___| |   |_ _|  _ \\| ____|",
  "|  \\| || | |  _| |_| | | || |  _| |    | || | | |  _|  ",
  "| |\\  || | |_| |  _  | | || |_| | |___ | || |_| | |___ ",
  "|_| \\_|___\\____|_| |_| |_| \\____|_____|___|____/|_____|",
] as const;

export function WelcomeScreen({
  theme,
  onNavigate,
  workspacePath = process.cwd(),
  model = "omlx/endless",
  isMock = false,
  dimensions,
  metaphor = "flight-deck",
}: WelcomeScreenProps) {
  const home = process.env.HOME || "";
  const displayPath =
    home && workspacePath.startsWith(home)
      ? "~" + workspacePath.slice(home.length)
      : workspacePath;

  const isCompactHeight = dimensions?.isCompactHeight ?? false;
  const terminalWidth = dimensions?.width ?? 80;
  const isAbyss = metaphor === "abyss-dive";

  // Use bold 75-column banner when terminal width >= 80 and not ultra-compact
  const showBoldBanner = terminalWidth >= 80 && !isCompactHeight;
  // Use 55-column banner for medium widths (60 - 79)
  const showMediumBanner = !showBoldBanner && terminalWidth >= 60 && !isCompactHeight;

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.colors.background}
      paddingX={terminalWidth < 84 ? 1 : 2}
      paddingY={isCompactHeight ? 0 : 1}
      gap={1}
    >
      {/* Dynamic Celestial Horizon or Abyss Bulkhead Banner */}
      <box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        paddingY={isCompactHeight ? 0 : 1}
        borderColor={theme.colors.border}
        borderStyle={isAbyss ? "double" : "single"}
        backgroundColor={theme.colors.surface}
      >
        {isCompactHeight || (!showBoldBanner && !showMediumBanner) ? (
          <box flexDirection="column" alignItems="center">
            <text fg={theme.colors.accent}>
              {isAbyss
                ? "◎ ABYSS DIVE · Subsea Cockpit Online ◎"
                : "✦ NIGHTGLIDE · Build beyond the horizon ✦"}
            </text>
            <text fg={theme.colors.textMuted}>
              {isAbyss ? "深潜深渊，探赜索隐。" : "漫翔苍穹，构筑所想。"}
            </text>
          </box>
        ) : (
          <>
            {/* Ambient telemetry line */}
            <text fg={theme.colors.accentSecondary}>
              {isAbyss
                ? "✦   ~      ≈         ◎   A B Y S S   D E E P   D I V E   ◎         ≈      ~   ✦"
                : "✦   *      ·         ★   C E L E S T I A L   F L I G H T   ★         ·      *   ✦"}
            </text>

            {/* Bold, thick, majestic Nightglide ASCII / Block Art */}
            {showBoldBanner &&
              BOLD_BANNER_LINES.map((line, idx) => (
                <text key={`bold-logo-${idx}`} fg={theme.colors.accent}>
                  {line}
                </text>
              ))}

            {showMediumBanner &&
              COMPACT_BANNER_LINES.map((line, idx) => (
                <text key={`med-logo-${idx}`} fg={theme.colors.accent}>
                  {line}
                </text>
              ))}

            <text fg={theme.colors.accentSecondary}>
              {isAbyss
                ? "·      ≈         ✦  N I G H T G L I D E  ·  A B Y S S  ✦         ≈      ·"
                : "·      ★         ✦  N I G H T G L I D E  ✦         ★      ·"}
            </text>

            <box marginTop={1} flexDirection="column" alignItems="center">
              <text fg={theme.colors.textPrimary}>
                {isAbyss
                  ? "Subsea Abyss Cockpit · Deep Dive into the Mariana Trench"
                  : "Build beyond the horizon."}
              </text>
              <text fg={theme.colors.textMuted}>
                {isAbyss ? "深潜深渊，探赜索隐。" : "漫翔苍穹，构筑所想。"}
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
        borderStyle={isAbyss ? "double" : "single"}
        paddingX={2}
        paddingY={1}
        gap={1}
      >
        <box flexDirection="row" justifyContent="space-between">
          <box flexDirection="row" gap={1}>
            <text fg={theme.colors.accent}>
              {isAbyss ? "DIVE BASE:" : "WORKSPACE:"}
            </text>
            <text fg={theme.colors.textPrimary}>{displayPath}</text>
          </box>
          <box flexDirection="row" gap={1}>
            <text fg={theme.colors.accentSecondary}>
              {isAbyss ? "HYDRO ENGINE:" : "ENGINE:"}
            </text>
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
            <text fg={theme.colors.textMuted}>
              {isAbyss ? "OCEANIC PALETTE:" : "THEME:"}
            </text>
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
          <text fg={theme.colors.accent}>
            {isAbyss ? "[2] Abyss Cockpit (Chat)" : "[2] Flight Deck (Chat)"}
          </text>
          <text fg={theme.colors.textSecondary}>
            {isAbyss
              ? "Deep dive coding console. Sonar acoustic telemetry, diff inspection, and subsea agent delegation."
              : "Enter the interactive coding console. Stream assistant responses, invoke native tools, and collaborate with subagents."}
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
          <text fg={theme.colors.accentSecondary}>[3] Setup & Auth</text>
          <text fg={theme.colors.textSecondary}>
            Official subscription login (Codex, Copilot, Claude) or custom API key configuration.
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
          <text fg={theme.colors.textPrimary}>[4] Themes & Cockpit</text>
          <text fg={theme.colors.textSecondary}>
            Switch atmospheric palettes: 6 Celestial & Abyss Deep Dive Themes.
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
          {isAbyss
            ? "\"Deep below the surface, intelligence runs silent and undisturbed.\""
            : "\"Where local intelligence meets unbounded flight.\""}
        </text>
        <text fg={theme.colors.textMuted}>
          [1-5] Navigate · [Ctrl+U] Toggle Submarine/Flight · [Q] Exit
        </text>
      </box>
    </box>
  );
}
