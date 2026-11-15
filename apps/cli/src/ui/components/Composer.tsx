import React, { useState, useCallback } from "react";
import type { Theme } from "@nightglide/themes";
import type { AgentStatus } from "@nightglide/core";
import { useKeyboard } from "@opentui/react";

export interface ComposerProps {
  theme: Theme;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  status?: AgentStatus;
  placeholder?: string;
}

export function Composer({
  theme,
  onSubmit,
  onCancel,
  disabled = false,
  status = "idle",
  placeholder = "Ask Nightglide to generate code, explore architecture, or run tests...",
}: ComposerProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(
    (submittedText?: string) => {
      const textToSend = (submittedText ?? value).trim();
      if (!textToSend || disabled) {
        return;
      }
      onSubmit(textToSend);
      setValue("");
    },
    [value, disabled, onSubmit]
  );

  const isBusy =
    disabled ||
    status === "thinking" ||
    status === "streaming" ||
    status === "executing_tool";

  // Handle Escape key to cancel flight or clear input
  useKeyboard((key) => {
    if (key.name === "escape") {
      if (isBusy && onCancel) {
        onCancel();
      } else if (value.length > 0) {
        setValue("");
      }
    }
  });

  return (
    <box
      flexDirection="column"
      width="100%"
      backgroundColor={theme.colors.surface}
      borderColor={isBusy ? theme.colors.accent : theme.colors.border}
      borderStyle="single"
      paddingX={1}
      paddingY={0}
    >
      {isBusy ? (
        <box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          height={2}
        >
          <box flexDirection="row" alignItems="center" gap={1}>
            <text fg={theme.colors.warning}>⚡ [Agent in flight]</text>
            <text fg={theme.colors.textSecondary}>
              Processing stream. Press Esc to cancel or await completion.
            </text>
          </box>
          {onCancel ? (
            <text fg={theme.colors.textMuted}>[Esc] Cancel</text>
          ) : null}
        </box>
      ) : (
        <box flexDirection="row" alignItems="center" height={2} gap={1}>
          <text fg={theme.colors.accent}>✦ prompt ❯</text>
          <box flexGrow={1}>
            <input
              placeholder={placeholder}
              value={value}
              onChange={(newVal: string) => setValue(newVal)}
              onSubmit={(submittedVal: string) => handleSubmit(submittedVal)}
              focused={!isBusy}
              textColor={theme.colors.textPrimary}
              placeholderColor={theme.colors.textMuted}
              backgroundColor={theme.colors.surfaceElevated}
            />
          </box>
        </box>
      )}

      {/* Shortcut hint row */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        height={1}
      >
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.textMuted}>
            [Enter] Submit prompt  │  [Esc] Clear / Cancel
          </text>
        </box>
        <text fg={theme.colors.textMuted}>
          Nightglide Celestial Engine
        </text>
      </box>
    </box>
  );
}
