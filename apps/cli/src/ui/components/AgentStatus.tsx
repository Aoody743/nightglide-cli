import React from "react";
import type { AgentStatus as StatusType } from "@nightglide/core";
import type { Theme } from "@nightglide/themes";
import { getToolIcon } from "../screens/ChatScreen.js";

export interface AgentStatusProps {
  status: StatusType;
  theme: Theme;
  model?: string;
  statusMessage?: string;
  activeTool?: string;
}

export function AgentStatus({
  status,
  theme,
  model,
  statusMessage,
  activeTool,
}: AgentStatusProps) {
  let indicatorSymbol = "✦";
  let statusColor = theme.colors.textMuted;
  let statusText = "STANDBY";
  let detailText = "Flight deck ready for coordinates";

  switch (status) {
    case "idle":
      indicatorSymbol = "✦";
      statusColor = theme.colors.textMuted;
      statusText = "STANDBY";
      detailText = "Awaiting user flight instruction";
      break;

    case "thinking":
      indicatorSymbol = "⚡";
      statusColor = theme.colors.warning;
      statusText = "DELIBERATING";
      detailText = statusMessage || "Synthesizing code architecture and solution...";
      break;

    case "executing_tool": {
      const toolIcon = activeTool ? getToolIcon(activeTool) : "🛠";
      indicatorSymbol = toolIcon;
      statusColor = theme.colors.info;
      statusText = "EXECUTING TOOL";
      detailText = activeTool ? `Invoking tool: ${activeTool}` : "Executing workspace operation...";
      break;
    }

    case "streaming":
      indicatorSymbol = "▲";
      statusColor = theme.colors.accentSecondary;
      statusText = "TRANSMITTING";
      detailText = "Streaming celestial response tokens...";
      break;

    case "cancelling":
      indicatorSymbol = "⏹";
      statusColor = theme.colors.warning;
      statusText = "HALTING";
      detailText = "Aborting in-flight execution...";
      break;

    case "error":
      indicatorSymbol = "✖";
      statusColor = theme.colors.error;
      statusText = "ANOMALY";
      detailText = statusMessage || "Encountered an unexpected agent error";
      break;

    case "completed":
      indicatorSymbol = "✔";
      statusColor = theme.colors.success;
      statusText = "COMPLETED";
      detailText = "Task reached horizon. Ready for next prompt.";
      break;
  }

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      backgroundColor={theme.colors.surfaceElevated}
      borderColor={theme.colors.border}
      borderStyle="single"
      paddingX={1}
      height={3}
    >
      <box flexDirection="row" alignItems="center" gap={1}>
        <text fg={statusColor}>{indicatorSymbol}</text>
        <text fg={statusColor}>[{statusText}]</text>
        <text fg={theme.colors.textPrimary}>{detailText}</text>
      </box>

      {model ? (
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.textMuted}>Model:</text>
          <text fg={theme.colors.accent}>{model}</text>
        </box>
      ) : null}
    </box>
  );
}
