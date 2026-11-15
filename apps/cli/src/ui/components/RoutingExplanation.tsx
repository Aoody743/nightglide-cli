import React from "react";
import type { Theme } from "@nightglide/themes";
import type { RoutingDecision } from "@nightglide/core";
import { getSubagentBadge } from "./AgentMonitor.js";

export interface RoutingExplanationProps {
  theme: Theme;
  decision: RoutingDecision;
}

export function RoutingExplanation({ theme, decision }: RoutingExplanationProps) {
  const localityColor = decision.locality === "local" ? theme.colors.success : theme.colors.accentSecondary;
  const localityLabel = decision.locality === "local" ? "[LOCAL ON-DEVICE]" : "[CLOUD AUTHORIZED]";
  const badge = getSubagentBadge(decision.agentRole);

  return (
    <box
      flexDirection="column"
      backgroundColor={theme.colors.surfaceElevated}
      borderColor={theme.colors.accent}
      borderStyle="single"
      paddingX={1}
      marginY={1}
      width="100%"
    >
      <box flexDirection="row" justifyContent="space-between" alignItems="center">
        <box flexDirection="row" gap={1}>
          <text fg={theme.colors.accent}>⚡ [Intelligent Routing]</text>
          <text fg={theme.colors.textSecondary}>Task: {decision.taskCategory.toUpperCase()}</text>
          <text fg={theme.colors.border}>→</text>
          <text fg={theme.colors.accentSecondary}>
            Role: {badge.icon} {badge.label}
          </text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={localityColor}>{localityLabel}</text>
          <text fg={theme.colors.textMuted}>Mode: {decision.mode}</text>
        </box>
      </box>

      <box flexDirection="row" gap={1} marginY={0}>
        <text fg={theme.colors.textMuted}>Assigned Model:</text>
        <text fg={theme.colors.textPrimary}>{decision.modelId}</text>
        <text fg={theme.colors.textMuted}>({decision.providerId})</text>
        <text fg={theme.colors.border}>│</text>
        <text fg={theme.colors.textMuted}>Estimated Cost:</text>
        <text fg={theme.colors.accent}>{decision.estimatedCost || "Unknown"}</text>
      </box>

      <box flexDirection="row" gap={1}>
        <text fg={theme.colors.textMuted}>Decision Reason:</text>
        <text fg={theme.colors.textSecondary}>{decision.reason}</text>
      </box>
    </box>
  );
}
