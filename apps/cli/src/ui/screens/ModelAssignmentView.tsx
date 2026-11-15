import React, { useState, useEffect, useCallback } from "react";
import type { Theme } from "@nightglide/themes";
import { loadConfig, saveConfig, type NightglideConfig } from "@nightglide/config";
import type { AgentRole, RoutingMode } from "@nightglide/core";
import { useKeyboard } from "@opentui/react";
import type { ScreenId } from "../components/Header.js";
import type { TerminalDimensions } from "../dimensions.js";

export interface ModelAssignmentViewProps {
  theme: Theme;
  onNavigate?: (screen: ScreenId) => void;
  dimensions?: TerminalDimensions;
}

const ROLES: Array<{ role: AgentRole; label: string; desc: string }> = [
  { role: "main", label: "MAIN", desc: "Primary conversational coordinator & synthesizer" },
  { role: "plan", label: "PLANNER", desc: "Deep architectural reasoning & refactor planning (Planner)" },
  { role: "review", label: "REVIEWER", desc: "Independent code quality & security review (Reviewer)" },
  { role: "scout", label: "SCOUT", desc: "Lightweight file & symbol search agent (Scout)" },
  { role: "implement", label: "TASK", desc: "Native coding, refactoring & subagent execution (Task)" },
  { role: "explore", label: "EXPLORE", desc: "Fast on-device repository context exploration" },
];

const MODES: RoutingMode[] = ["LOCAL", "BALANCED", "PERFORMANCE", "MANUAL"];

const ROLE_MODEL_OPTIONS: string[] = [
  "", // Auto-routed
  "omlx/endless",
  "openai/gpt-4o",
  "anthropic/claude-3-5-sonnet",
  "deepseek/deepseek-coder",
];

export function ModelAssignmentView({ theme, onNavigate, dimensions }: ModelAssignmentViewProps) {
  const [config, setConfig] = useState<NightglideConfig | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [savedStatus, setSavedStatus] = useState<string>("");

  useEffect(() => {
    loadConfig().then((cfg) => setConfig(cfg));
  }, []);

  const handleCycleMode = useCallback(() => {
    if (!config) return;
    const currentMode = config.routing.mode;
    const nextIndex = (MODES.indexOf(currentMode) + 1) % MODES.length;
    const updated: NightglideConfig = {
      ...config,
      routing: {
        ...config.routing,
        mode: MODES[nextIndex],
      },
    };
    setConfig(updated);
    saveConfig(updated).then(() => {
      setSavedStatus(`Switched mode to ${MODES[nextIndex]}`);
      setTimeout(() => setSavedStatus(""), 2000);
    });
  }, [config]);

  const handleToggleCloud = useCallback(() => {
    if (!config) return;
    const updated: NightglideConfig = {
      ...config,
      routing: {
        ...config.routing,
        allowCloud: !config.routing.allowCloud,
      },
    };
    setConfig(updated);
    saveConfig(updated).then(() => {
      setSavedStatus(`Cloud Access: ${updated.routing.allowCloud ? "Allowed" : "Forbidden"}`);
      setTimeout(() => setSavedStatus(""), 2000);
    });
  }, [config]);

  const handleCycleRoleModel = useCallback(() => {
    if (!config) return;
    const selectedRole = ROLES[selectedIndex].role;
    const currentAssignment = config.routing.roleAssignments[selectedRole] || "";
    const currentIndex = ROLE_MODEL_OPTIONS.indexOf(currentAssignment);
    const nextIndex = (currentIndex + 1) % ROLE_MODEL_OPTIONS.length;
    const nextModel = ROLE_MODEL_OPTIONS[nextIndex];

    const updated: NightglideConfig = {
      ...config,
      routing: {
        ...config.routing,
        roleAssignments: {
          ...config.routing.roleAssignments,
          [selectedRole]: nextModel,
        },
      },
    };
    setConfig(updated);
    saveConfig(updated).then(() => {
      const label = nextModel ? nextModel : "Auto-routed";
      setSavedStatus(`Role [${ROLES[selectedIndex].label}] assigned to: ${label}`);
      setTimeout(() => setSavedStatus(""), 2000);
    });
  }, [config, selectedIndex]);

  useKeyboard((key) => {
    if (key.name === "up" || key.name === "k") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.name === "down" || key.name === "j") {
      setSelectedIndex((prev) => Math.min(ROLES.length - 1, prev + 1));
    } else if (key.name === "space") {
      handleCycleMode();
    } else if (key.name === "return") {
      handleCycleRoleModel();
    } else if (key.name === "c") {
      handleToggleCloud();
    } else if (key.name === "escape" && onNavigate) {
      onNavigate("chat");
    }
  });

  if (!config) {
    return (
      <box paddingX={2} paddingY={2}>
        <text fg={theme.colors.textMuted}>Loading configuration...</text>
      </box>
    );
  }

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.colors.background}
      paddingX={2}
      paddingY={1}
      gap={1}
    >
      {/* Title Banner */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center">
        <box flexDirection="row" gap={1}>
          <text fg={theme.colors.accent}>✦ MODEL MATRIX & AGENT ROLES</text>
          <text fg={theme.colors.border}>│</text>
          <text fg={theme.colors.textMuted}>Intelligent Multi-Provider Coordination</text>
        </box>
        {savedStatus ? (
          <text fg={theme.colors.success}>✔ {savedStatus}</text>
        ) : (
          <text fg={theme.colors.textMuted}>
            [Space: Mode | Enter: Model | C: Cloud | Esc: Back]
          </text>
        )}
      </box>

      {/* Control Banner: Mode & Cloud Authorization */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        backgroundColor={theme.colors.surfaceElevated}
        borderColor={theme.colors.border}
        borderStyle="single"
        paddingX={1}
        paddingY={0}
      >
        <box flexDirection="row" gap={1}>
          <text fg={theme.colors.textMuted}>Routing Policy:</text>
          <text fg={theme.colors.accent}>[{config.routing.mode}]</text>
          <text fg={theme.colors.border}>│</text>
          <text fg={theme.colors.textMuted}>Description:</text>
          <text fg={theme.colors.textSecondary}>
            {config.routing.mode === "LOCAL" && "Strict on-device privacy. Zero cloud network calls."}
            {config.routing.mode === "BALANCED" && "Local for explore/routine; cloud for complex reasoning."}
            {config.routing.mode === "PERFORMANCE" && "Highest capability model prioritized."}
            {config.routing.mode === "MANUAL" && "Explicit role model assignments enforced."}
          </text>
        </box>

        <box flexDirection="row" gap={1}>
          <text fg={theme.colors.textMuted}>Cloud AI Authorization:</text>
          <text fg={config.routing.allowCloud ? theme.colors.success : theme.colors.error}>
            {config.routing.allowCloud ? "AUTHORIZED (YES)" : "LOCKED (NO)"}
          </text>
        </box>
      </box>

      {/* Roles Assignment Table */}
      <box
        flexDirection="column"
        backgroundColor={theme.colors.surface}
        borderColor={theme.colors.border}
        borderStyle="single"
        paddingX={1}
        paddingY={1}
        flexGrow={1}
        gap={1}
      >
        <text fg={theme.colors.accent}>Active Agent Role Configuration:</text>

        {ROLES.map((r, idx) => {
          const isSelected = selectedIndex === idx;
          const assigned = config.routing.roleAssignments[r.role] || "(Auto-routed by Mode)";
          const isLocalAssigned =
            assigned.includes("omlx") || assigned.includes("local") || assigned.includes("ollama");

          return (
            <box
              key={r.role}
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              backgroundColor={isSelected ? theme.colors.selection : "transparent"}
              borderColor={isSelected ? theme.colors.accent : theme.colors.border}
              borderStyle="single"
              paddingX={1}
            >
              <box flexDirection="row" alignItems="center" gap={1}>
                <text fg={isSelected ? theme.colors.accent : theme.colors.textPrimary}>
                  {r.label.padEnd(10)}
                </text>
                <text fg={theme.colors.border}>→</text>
                <text fg={theme.colors.textPrimary}>{assigned}</text>
                {assigned !== "(Auto-routed by Mode)" ? (
                  <text fg={isLocalAssigned ? theme.colors.success : theme.colors.accentSecondary}>
                    {isLocalAssigned ? "[LOCAL]" : "[CLOUD]"}
                  </text>
                ) : null}
              </box>

              <text fg={theme.colors.textMuted}>{r.desc}</text>
            </box>
          );
        })}
      </box>
    </box>
  );
}
