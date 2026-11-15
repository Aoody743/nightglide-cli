import React from "react";
import fs from "fs";
import path from "path";
import type { Theme } from "@nightglide/themes";
import {
  type TerminalDimensions,
  type TerminalTier,
  getTerminalTier,
  getTierBadge,
} from "../dimensions.js";

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
 * Formats model identifier with locality pill representation.
 */
export function formatModelPill(model: string = "qwen2.5-coder:7b", isMock: boolean = false): string {
  if (isMock) {
    return "[Mock (LOCAL)]";
  }
  let clean = model
    .replace(/^([a-z0-9_-]+)\//i, "")
    .replace(":instruct", "")
    .replace(/:[0-9a-zA-Z._-]+$/i, "")
    .replace(/-coder/i, "");
  const isCloud = /gpt|claude|deepseek|gemini/i.test(model);
  const locality = isCloud ? "CLOUD" : "LOCAL";
  return `[${clean} (${locality})]`;
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

export function Header({
  activeScreen,
  theme,
  model = "qwen2.5-coder:7b",
  isMock = false,
  dimensions,
  workspacePath = process.cwd(),
  gitBranch,
  routingMode = "BALANCED",
}: HeaderProps) {
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

  const modelPill = formatModelPill(model, isMock);
  const routingPill = formatRoutingPill(routingMode);
  const tierPill = formatTierPill(width, height, tier);

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
      {/* Primary Row: Flight Deck Identity, Navigation Tabs, Tier */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        width="100%"
      >
        {/* Brand & Identity */}
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.accent}>✈ NIGHTGLIDE · FLIGHT DECK</text>
        </box>

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
                    fg={isActive ? theme.colors.accent : theme.colors.textSecondary}
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
          <text fg={theme.colors.textSecondary}>Workspace: {formattedPath}</text>
          <text fg={theme.colors.accentSecondary}>[Branch: {branchName}*]</text>
        </box>

        {/* Model Pill and Routing Mode Pill */}
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.accent}>{modelPill}</text>
          <text fg={theme.colors.info}>{routingPill}</text>
        </box>
      </box>
    </box>
  );
}
