import React from "react";
import type { Theme } from "@nightglide/themes";
import type { SubagentMonitorItem } from "@nightglide/core";

export interface AgentMonitorProps {
  theme: Theme;
  subagents: SubagentMonitorItem[];
  isOpen?: boolean;
}

export function AgentMonitor({ theme, subagents, isOpen = true }: AgentMonitorProps) {
  if (!isOpen || subagents.length === 0) {
    return null;
  }

  return (
    <box
      flexDirection="column"
      backgroundColor={theme.colors.surface}
      borderColor={theme.colors.border}
      borderStyle="single"
      paddingX={1}
      marginY={1}
      width="100%"
    >
      <box flexDirection="row" justifyContent="space-between" alignItems="center">
        <box flexDirection="row" gap={1}>
          <text fg={theme.colors.accent}>✦ MULTI-AGENT COLLABORATION MONITOR</text>
          <text fg={theme.colors.textMuted}>({subagents.length} Contributing Agents)</text>
        </box>
        <text fg={theme.colors.textMuted}>[Toggle: M]</text>
      </box>

      <box flexDirection="column" gap={0} marginY={1}>
        {subagents.map((agent) => {
          const locColor = agent.locality === "local" ? theme.colors.success : theme.colors.accentSecondary;
          const statusColor =
            agent.status === "completed"
              ? theme.colors.success
              : agent.status === "error"
              ? theme.colors.error
              : theme.colors.warning;

          return (
            <box
              key={agent.id}
              flexDirection="row"
              justifyContent="space-between"
              alignItems="center"
              backgroundColor={theme.colors.surfaceElevated}
              borderColor={theme.colors.border}
              borderStyle="single"
              paddingX={1}
            >
              <box flexDirection="row" alignItems="center" gap={1}>
                <text fg={theme.colors.accent}>[{agent.role.toUpperCase()}]</text>
                <text fg={theme.colors.textPrimary}>{agent.model}</text>
                <text fg={locColor}>({agent.locality === "local" ? "LOCAL" : "CLOUD"})</text>
                <text fg={theme.colors.border}>│</text>
                <text fg={theme.colors.textMuted}>Task: {agent.task}</text>
              </box>

              <box flexDirection="row" alignItems="center" gap={1}>
                {agent.totalTokens ? (
                  <text fg={theme.colors.textMuted}>{agent.totalTokens} tokens</text>
                ) : null}
                <text fg={statusColor}>● {agent.status.toUpperCase()}</text>
              </box>
            </box>
          );
        })}
      </box>
    </box>
  );
}
