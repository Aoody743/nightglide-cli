import React, { useState, useCallback, useRef } from "react";
import type { Theme } from "@nightglide/themes";
import type { AgentStatus } from "@nightglide/core";
import { useKeyboard } from "@opentui/react";
import type { TerminalDimensions } from "../dimensions.js";

export interface ComposerProps {
  theme: Theme;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  status?: AgentStatus;
  placeholder?: string;
  isFocused?: boolean;
  dimensions?: TerminalDimensions;
  onToggleMode?: () => void;
}

/**
 * Manages prompt submission history navigation (Up / Down arrows).
 */
export class PromptHistory {
  private history: string[] = [];
  private index: number = -1;
  private draft: string = "";

  constructor(initialHistory: string[] = []) {
    this.history = [...initialHistory];
  }

  getEntries(): readonly string[] {
    return this.history;
  }

  getCurrentIndex(): number {
    return this.index;
  }

  push(entry: string): void {
    const trimmed = entry.trim();
    if (!trimmed) return;
    if (this.history[this.history.length - 1] !== trimmed) {
      this.history.push(trimmed);
    }
    this.index = -1;
    this.draft = "";
  }

  navigateUp(currentInput: string): string | null {
    if (this.history.length === 0) return null;

    if (this.index === -1) {
      this.draft = currentInput;
      this.index = this.history.length - 1;
      return this.history[this.index];
    }

    if (this.index > 0) {
      this.index -= 1;
      return this.history[this.index];
    }

    return this.history[0];
  }

  navigateDown(): string | null {
    if (this.index === -1) return null;

    if (this.index < this.history.length - 1) {
      this.index += 1;
      return this.history[this.index];
    }

    this.index = -1;
    return this.draft;
  }

  reset(): void {
    this.index = -1;
    this.draft = "";
  }
}

export function Composer({
  theme,
  onSubmit,
  onCancel,
  disabled = false,
  status = "idle",
  placeholder = "Ask Nightglide to write code, review architecture, or run tests...",
  isFocused = true,
  dimensions,
  onToggleMode,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [isMultiline, setIsMultiline] = useState(false);
  const historyRef = useRef<PromptHistory>(new PromptHistory());

  const isBusy =
    disabled ||
    status === "thinking" ||
    status === "streaming" ||
    status === "executing_tool";

  const handleSubmit = useCallback(
    (submittedText?: string) => {
      const textToSend = (submittedText !== undefined ? submittedText : value).trim();
      if (!textToSend || isBusy) {
        return;
      }
      historyRef.current.push(textToSend);
      onSubmit(textToSend);
      setValue("");
      setIsMultiline(false);
    },
    [value, isBusy, onSubmit]
  );

  // Keyboard navigation & control shortcuts
  useKeyboard((key) => {
    // 1. Cancellation: Escape or Ctrl+C
    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      if (isBusy && onCancel) {
        onCancel();
      } else if (value.length > 0) {
        setValue("");
        setIsMultiline(false);
        historyRef.current.reset();
      }
      return;
    }

    // 2. Multiline insertion on Shift+Enter / Shift+Return
    if ((key.name === "return" || key.name === "enter") && key.shift) {
      if (!isBusy) {
        setValue((prev) => prev + "\n");
        setIsMultiline(true);
      }
      return;
    }

    // 3. History traversal: Up arrow
    if (key.name === "up" && !isBusy) {
      const prevEntry = historyRef.current.navigateUp(value);
      if (prevEntry !== null) {
        setValue(prevEntry);
        setIsMultiline(prevEntry.includes("\n"));
      }
      return;
    }

    // 4. History traversal: Down arrow
    if (key.name === "down" && !isBusy) {
      const nextEntry = historyRef.current.navigateDown();
      if (nextEntry !== null) {
        setValue(nextEntry);
        setIsMultiline(nextEntry.includes("\n"));
      }
      return;
    }

    // 5. Mode toggle via Tab
    if (key.name === "tab" && onToggleMode) {
      onToggleMode();
      return;
    }
  });

  const isCompact = dimensions?.isCompactWidth ?? false;
  const isUltraCompact = (dimensions?.width ?? 100) < 85;

  // Active border styling depending on status and focus
  const activeBorderColor = isBusy
    ? theme.colors.warning
    : isFocused
    ? theme.colors.focus
    : theme.colors.border;

  const lineCount = value.split("\n").length;

  return (
    <box
      flexDirection="column"
      width="100%"
      backgroundColor={theme.colors.surface}
      borderColor={activeBorderColor}
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
              Processing stream. Press [Esc] or [Ctrl+C] to cancel.
            </text>
          </box>
          {onCancel ? (
            <text fg={theme.colors.textMuted}>[Esc/Ctrl+C] Cancel</text>
          ) : null}
        </box>
      ) : (
        <box flexDirection="column" gap={0}>
          {/* Main prompt input row */}
          <box flexDirection="row" alignItems="center" height={2} gap={1}>
            <text fg={theme.colors.accent}>
              {isMultiline ? `✦ [Multi:${lineCount}] ❯` : "✦ prompt ❯"}
            </text>
            <box flexGrow={1}>
              <input
                placeholder={placeholder}
                value={value}
                onChange={(newVal: string) => {
                  setValue(newVal);
                  if (newVal.includes("\n")) setIsMultiline(true);
                }}
                onSubmit={(submittedVal: string) => handleSubmit(submittedVal)}
                focused={!isBusy && isFocused}
                textColor={theme.colors.textPrimary}
                placeholderColor={theme.colors.textMuted}
                backgroundColor={theme.colors.surfaceElevated}
              />
            </box>
          </box>

          {/* Multiline preview if input contains multiple lines */}
          {isMultiline && lineCount > 1 ? (
            <box
              flexDirection="column"
              backgroundColor={theme.colors.surfaceElevated}
              borderColor={theme.colors.border}
              borderStyle="single"
              paddingX={1}
              marginY={0}
            >
              <text fg={theme.colors.textMuted}>Multiline Buffer ({lineCount} lines):</text>
              {value.split("\n").slice(0, 3).map((line, idx) => (
                <text key={idx} fg={theme.colors.textSecondary}>
                  {idx + 1} │ {line || " "}
                </text>
              ))}
              {lineCount > 3 ? (
                <text fg={theme.colors.textMuted}>... +{lineCount - 3} more lines</text>
              ) : null}
            </box>
          ) : null}
        </box>
      )}

      {/* Discoverable hints row */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        height={1}
      >
        <box flexDirection="row" alignItems="center" gap={1}>
          {isUltraCompact ? (
            <text fg={theme.colors.textMuted}>
              [Enter] Send  [Shift+Enter] Multi  [Tab] Mode  [Ctrl+C] Cancel
            </text>
          ) : (
            <text fg={theme.colors.textMuted}>
              [Enter] Send  [Shift+Enter] Multiline  [Tab] Mode  [t] Theme  [Ctrl+C] Cancel
            </text>
          )}
        </box>

        {!isCompact && (
          <text fg={theme.colors.accentSecondary}>
            {isBusy ? "⚡ Streaming" : "✈ Ready"}
          </text>
        )}
      </box>
    </box>
  );
}
