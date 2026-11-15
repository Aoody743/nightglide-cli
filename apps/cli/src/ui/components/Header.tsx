import React from "react";
import fs from "fs";
import path from "path";
import type { Theme, UIMetaphor } from "@nightglide/themes";
import {
  type TerminalDimensions,
  type TerminalTier,
  getTerminalTier,
  getTierBadge,
} from "../dimensions.js";
import {
  resolveProviderVendor,
  type VendorSignature,
} from "../motion/vendors.js";
import {
  formatDepth,
  formatPressure,
  formatHullIntegrity,
  formatSonarStatus,
  formatAbyssCockpitTelemetry,
  formatFlightDeckTelemetry,
  BULKHEAD_BORDER_STYLE,
  DEFAULT_ABYSS_DEPTH,
  DEFAULT_ABYSS_PRESSURE,
  DEFAULT_ABYSS_HULL,
  DEFAULT_ABYSS_SONAR,
} from "../metaphors/index.js";

export type ScreenId = "welcome" | "chat" | "setup" | "themes" | "models";

export interface HeaderProps {
  activeScreen: ScreenId;
  theme: Theme;
  model?: string;
  isMock?: boolean;
  dimensions?: TerminalDimensions;
  workspacePath?: string;
  gitBranch?: string;
  routingMode?: "LOCAL" | "BALANCED" | "PERFORMANCE" | "MANUAL" | string;
  metaphor?: UIMetaphor;
  depth?: number;
  pressure?: number;
  hull?: number;
  sonar?: string;
}

export interface NavTab {
  id: ScreenId;
  key: string;
  label: string;
  compactLabel: string;
}

export const NAV_TABS: readonly NavTab[] = [
  { id: "welcome", key: "1", label: "Welcome", compactLabel: "Home" },
  { id: "chat", key: "2", label: "Flight Deck", compactLabel: "Chat" },
  { id: "setup", key: "3", label: "Setup", compactLabel: "Setup" },
  { id: "themes", key: "4", label: "Themes", compactLabel: "Themes" },
  { id: "models", key: "5", label: "Model Matrix", compactLabel: "Models" },
] as const;

/**
 * Resolves current Git branch synchronously without spawning external processes.
 */
export function getGitBranch(cwd: string = process.cwd()): string {
  try {
    let currentDir = cwd;
    for (let i = 0; i < 5; i++) {
      const gitFilePath = path.join(currentDir, ".git");
      if (fs.existsSync(gitFilePath)) {
        const stat = fs.statSync(gitFilePath);
        if (stat.isFile()) {
          const gitFileContent = fs.readFileSync(gitFilePath, "utf-8").trim();
          if (gitFileContent.startsWith("gitdir: ")) {
            const gitDir = gitFileContent.replace("gitdir: ", "").trim();
            const resolvedGitDir = path.isAbsolute(gitDir)
              ? gitDir
              : path.resolve(currentDir, gitDir);
            const worktreeHead = path.join(resolvedGitDir, "HEAD");
            if (fs.existsSync(worktreeHead)) {
              const headContent = fs.readFileSync(worktreeHead, "utf-8").trim();
              if (headContent.startsWith("ref: refs/heads/")) {
                return headContent.replace("ref: refs/heads/", "");
              }
              return headContent.slice(0, 7);
            }
          }
        } else if (stat.isDirectory()) {
          const headPath = path.join(gitFilePath, "HEAD");
          if (fs.existsSync(headPath)) {
            const headContent = fs.readFileSync(headPath, "utf-8").trim();
            if (headContent.startsWith("ref: refs/heads/")) {
              return headContent.replace("ref: refs/heads/", "");
            }
            return headContent.slice(0, 7);
          }
        }
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;
      currentDir = parentDir;
    }
  } catch {}
  return "main";
}

/**
 * Formats model identifier with locality pill representation and authentic vendor mini glyph.
 */
export function formatModelPill(
  model: string = "omlx/endless",
  isMock: boolean = false,
  includeVendorGlyph: boolean = false
): string {
  const vendor = resolveProviderVendor(isMock ? "mock" : model);
  const glyphPrefix = includeVendorGlyph ? `${vendor.miniGlyph} ` : "";

  if (isMock) {
    return `[${glyphPrefix}Mock (LOCAL)]`;
  }
  let clean = model
    .replace(/^([a-z0-9_-]+)\//i, "")
    .replace(":instruct", "")
    .replace(/:[0-9a-zA-Z._-]+$/i, "")
    .replace(/-coder/i, "");
  const isCloud = /gpt|claude|deepseek|gemini|grok/i.test(model);
  const locality = isCloud ? "CLOUD" : "LOCAL";
  return `[${glyphPrefix}${clean} (${locality})]`;
}

export interface ModelBadgeInfo {
  pill: string;
  glyph: string;
  brandColor: string;
  vendor: VendorSignature;
}

/**
 * Formats full model badge including vendor metadata and brand color styling.
 */
export function formatModelBadge(
  model: string = "omlx/endless",
  isMock: boolean = false
): ModelBadgeInfo {
  const vendor = resolveProviderVendor(isMock ? "mock" : model);
  return {
    pill: formatModelPill(model, isMock, true),
    glyph: vendor.miniGlyph,
    brandColor: vendor.brandColor,
    vendor,
  };
}

/**
 * Formats routing mode pill representation.
 */
export function formatRoutingPill(routingMode: string = "BALANCED"): string {
  return `[${routingMode.toUpperCase()}]`;
}

/**
 * Formats terminal tier pill representation.
 */
export function formatTierPill(width: number, height: number, tier: TerminalTier): string {
  const badge = getTierBadge(tier);
  return `[${width}x${height} ${badge}]`;
}

/**
 * Renders the primary header telemetry line based on active metaphor.
 */
export function formatHeaderTelemetry(
  metaphor: UIMetaphor = "flight-deck",
  options?: {
    depth?: number;
    pressure?: number;
    hull?: number;
    sonar?: string;
    width?: number;
    height?: number;
    tierBadge?: string;
    branch?: string;
    modelPill?: string;
  }
): string {
  if (metaphor === "abyss-dive") {
    return formatAbyssCockpitTelemetry(options);
  }
  return formatFlightDeckTelemetry(options);
}

export function Header({
  activeScreen,
  theme,
  model = "omlx/endless",
  isMock = false,
  dimensions,
  workspacePath = process.cwd(),
  gitBranch,
  routingMode = "BALANCED",
  metaphor,
  depth = DEFAULT_ABYSS_DEPTH,
  pressure = DEFAULT_ABYSS_PRESSURE,
  hull = DEFAULT_ABYSS_HULL,
  sonar = DEFAULT_ABYSS_SONAR,
}: HeaderProps) {
  const effectiveMetaphor: UIMetaphor = metaphor ?? theme.metaphor ?? "flight-deck";
  const isAbyss = effectiveMetaphor === "abyss-dive";

  const width = dimensions?.width ?? 100;
  const height = dimensions?.height ?? 30;
  const tier = dimensions?.tier ?? getTerminalTier(width, height);
  const isCompact = dimensions?.isCompactWidth ?? width < 100;
  const isUltraCompact = width < 85;

  // Resolve Git branch
  const branchName = gitBranch || getGitBranch(workspacePath);

  // Format workspace path with home abbreviation
  const home = process.env.HOME || "";
  const displayPath =
    home && workspacePath.startsWith(home)
      ? "~" + workspacePath.slice(home.length)
      : workspacePath;
  const formattedPath = isUltraCompact
    ? displayPath.split("/").slice(-2).join("/")
    : displayPath;

  const vendor = resolveProviderVendor(isMock ? "mock" : model);
  const modelPill = formatModelPill(model, isMock, true);
  const routingPill = formatRoutingPill(routingMode);
  const tierPill = formatTierPill(width, height, tier);

  const sonarColor = theme.sonarPing ?? theme.colors.accent;
  const depthColor = theme.depthGauge ?? theme.colors.accentSecondary;
  const hullBorderColor = theme.hullBorder ?? theme.colors.border;
  const borderStyle = isAbyss ? BULKHEAD_BORDER_STYLE : "single";

  const depthStr = formatDepth(depth);
  const pressureStr = formatPressure(pressure);
  const hullStr = formatHullIntegrity(hull);
  const sonarStr = formatSonarStatus(sonar);

  return (
    <box
      flexDirection="column"
      width="100%"
      backgroundColor={theme.colors.surface}
      borderColor={isAbyss ? hullBorderColor : theme.colors.border}
      borderStyle={borderStyle}
      paddingX={1}
      paddingY={0}
    >
      {/* Primary Row: Submarine Cockpit Telemetry vs Celestial Flight Deck Identity */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        width="100%"
      >
        {/* Brand & Cockpit Telemetry */}
        {isAbyss ? (
          <box flexDirection="row" alignItems="center" gap={1}>
            <text fg={sonarColor}>[ABYSS COCKPIT 潜艇深潜舱]</text>
            <text fg={theme.colors.textMuted}>|</text>
            <text fg={depthColor}>{depthStr}</text>
            <text fg={theme.colors.textMuted}>|</text>
            <text fg={theme.colors.info}>{pressureStr}</text>
            <text fg={theme.colors.textMuted}>|</text>
            <text fg={theme.colors.success}>{hullStr}</text>
            <text fg={theme.colors.textMuted}>|</text>
            <text fg={sonarColor}>{sonarStr}</text>
          </box>
        ) : (
          <box flexDirection="row" alignItems="center" gap={1}>
            <text fg={theme.colors.accent}>✈ NIGHTGLIDE · FLIGHT DECK</text>
          </box>
        )}

        {/* Navigation Tabs (condensed on smaller screens) */}
        {!isUltraCompact && (
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
                    fg={isActive ? (isAbyss ? sonarColor : theme.colors.accent) : theme.colors.textSecondary}
                  >
                    [{tab.key}] {labelText}
                  </text>
                </box>
              );
            })}
          </box>
        )}

        {/* Terminal Tier Badge */}
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.textMuted}>{tierPill}</text>
        </box>
      </box>

      {/* Secondary Context Row: Workspace, Git Branch, Active Model, Routing Mode */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        width="100%"
      >
        {/* Workspace Path and Git Branch Indicator */}
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.textSecondary}>
            {isAbyss ? `Sector: ${formattedPath}` : `Workspace: ${formattedPath}`}
          </text>
          <text fg={depthColor}>[{isAbyss ? "Hull" : "Branch"}: {branchName}*]</text>
        </box>

        {/* Model Pill and Routing Mode Pill */}
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={vendor.brandColor}>{modelPill}</text>
          <text fg={theme.colors.info}>{routingPill}</text>
        </box>
      </box>
    </box>
  );
}
