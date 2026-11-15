import React, { useState } from "react";
import { BUILTIN_THEMES, type Theme } from "@nightglide/themes";
import { useKeyboard } from "@opentui/react";

export interface ThemeSelectorProps {
  theme: Theme;
  onSelectTheme: (themeId: string) => void;
  onClose?: () => void;
}

export function ThemeSelector({
  theme,
  onSelectTheme,
  onClose,
}: ThemeSelectorProps) {
  const currentIndex = BUILTIN_THEMES.findIndex((t) => t.id === theme.id);
  const [selectedIndex, setSelectedIndex] = useState(
    currentIndex >= 0 ? currentIndex : 0
  );

  useKeyboard((key) => {
    if (key.name === "1") {
      onSelectTheme(BUILTIN_THEMES[0].id);
      setSelectedIndex(0);
    } else if (key.name === "2") {
      onSelectTheme(BUILTIN_THEMES[1].id);
      setSelectedIndex(1);
    } else if (key.name === "3") {
      onSelectTheme(BUILTIN_THEMES[2].id);
      setSelectedIndex(2);
    } else if (key.name === "4") {
      onSelectTheme(BUILTIN_THEMES[3].id);
      setSelectedIndex(3);
    } else if (key.name === "up" || key.name === "k") {
      setSelectedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : BUILTIN_THEMES.length - 1;
        onSelectTheme(BUILTIN_THEMES[next].id);
        return next;
      });
    } else if (key.name === "down" || key.name === "j") {
      setSelectedIndex((prev) => {
        const next = prev < BUILTIN_THEMES.length - 1 ? prev + 1 : 0;
        onSelectTheme(BUILTIN_THEMES[next].id);
        return next;
      });
    } else if (key.name === "escape" && onClose) {
      onClose();
    }
  });

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
      {/* Title & Description */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        paddingBottom={1}
        borderColor={theme.colors.border}
      >
        <box flexDirection="column">
          <text fg={theme.colors.accent}>
            ✦ CELESTIAL THEME GALLERY
          </text>
          <text fg={theme.colors.textMuted}>
            Select an atmospheric colorway. Press [1-4] or [↑/↓] to preview live.
          </text>
        </box>
        {onClose ? (
          <text fg={theme.colors.textSecondary}>[Esc] Back</text>
        ) : null}
      </box>

      {/* Theme Cards Grid */}
      <box flexDirection="column" gap={1}>
        {BUILTIN_THEMES.map((item, idx) => {
          const isCurrentActive = item.id === theme.id;
          const isSelected = selectedIndex === idx;

          return (
            <box
              key={item.id}
              flexDirection="column"
              backgroundColor={
                isSelected
                  ? theme.colors.surfaceElevated
                  : theme.colors.surface
              }
              borderColor={
                isCurrentActive
                  ? theme.colors.accent
                  : isSelected
                  ? theme.colors.focus
                  : theme.colors.border
              }
              borderStyle="single"
              paddingX={1}
              paddingY={1}
            >
              {/* Header row */}
              <box
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <box flexDirection="row" alignItems="center" gap={1}>
                  <text fg={theme.colors.accent}>[{idx + 1}]</text>
                  <text fg={theme.colors.textPrimary}>{item.name}</text>
                  <text fg={theme.colors.textMuted}>
                    ({item.type.toUpperCase()})
                  </text>
                </box>

                {isCurrentActive ? (
                  <box
                    paddingX={1}
                    backgroundColor={theme.colors.selection}
                  >
                    <text fg={theme.colors.accent}>● ACTIVE</text>
                  </box>
                ) : (
                  <text fg={theme.colors.textMuted}>Press [{idx + 1}] to switch</text>
                )}
              </box>

              {/* Description */}
              <text fg={theme.colors.textSecondary}>
                {item.description}
              </text>

              {/* Color Swatch Bar */}
              <box
                flexDirection="row"
                alignItems="center"
                gap={1}
                marginTop={1}
              >
                <text fg={theme.colors.textMuted}>Palette:</text>
                <box
                  paddingX={1}
                  backgroundColor={item.colors.background}
                  borderColor={item.colors.border}
                  borderStyle="single"
                >
                  <text fg={item.colors.textPrimary}>BG</text>
                </box>
                <box
                  paddingX={1}
                  backgroundColor={item.colors.surface}
                  borderColor={item.colors.border}
                  borderStyle="single"
                >
                  <text fg={item.colors.textPrimary}>Surface</text>
                </box>
                <box
                  paddingX={1}
                  backgroundColor={item.colors.accent}
                >
                  <text fg={item.colors.background}>Accent</text>
                </box>
                <box
                  paddingX={1}
                  backgroundColor={item.colors.accentSecondary}
                >
                  <text fg={item.colors.background}>Secondary</text>
                </box>
                <box
                  paddingX={1}
                  backgroundColor={item.colors.success}
                >
                  <text fg={item.colors.background}>Success</text>
                </box>
                <box
                  paddingX={1}
                  backgroundColor={item.colors.warning}
                >
                  <text fg={item.colors.background}>Warning</text>
                </box>
                <box
                  paddingX={1}
                  backgroundColor={item.colors.error}
                >
                  <text fg={item.colors.background}>Error</text>
                </box>
              </box>
            </box>
          );
        })}
      </box>
    </box>
  );
}
