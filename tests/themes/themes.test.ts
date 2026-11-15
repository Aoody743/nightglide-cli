import { describe, test, expect } from "bun:test";
import {
  ThemeManager,
  midnightFlightTheme,
  auroraTheme,
  cloudlightTheme,
  daybreakTheme,
  BUILTIN_THEMES,
  DEFAULT_THEME_ID,
  type Theme,
  type ThemeColors,
} from "@nightglide/themes";

describe("Themes Package", () => {
  const REQUIRED_COLOR_KEYS: (keyof ThemeColors)[] = [
    "background",
    "surface",
    "surfaceElevated",
    "border",
    "textPrimary",
    "textSecondary",
    "textMuted",
    "accent",
    "accentSecondary",
    "success",
    "warning",
    "error",
    "info",
    "selection",
    "focus",
  ];

  test("all 4 built-in celestial themes are defined", () => {
    expect(BUILTIN_THEMES.length).toBe(4);
    const ids = BUILTIN_THEMES.map((t) => t.id);
    expect(ids).toContain("midnight-flight");
    expect(ids).toContain("aurora");
    expect(ids).toContain("cloudlight");
    expect(ids).toContain("daybreak");
  });

  test("contains exactly two dark and two light themes", () => {
    const darkThemes = BUILTIN_THEMES.filter((t) => t.type === "dark");
    const lightThemes = BUILTIN_THEMES.filter((t) => t.type === "light");
    expect(darkThemes.length).toBe(2);
    expect(lightThemes.length).toBe(2);
  });

  test("every theme satisfies full semantic color token requirements", () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.id).toBeDefined();
      expect(theme.name).toBeDefined();
      expect(theme.description).toBeDefined();

      for (const key of REQUIRED_COLOR_KEYS) {
        const val = theme.colors[key];
        expect(typeof val).toBe("string");
        expect(val.startsWith("#")).toBe(true);
      }
    }
  });

  test("ThemeManager initializes with default theme", () => {
    const manager = new ThemeManager();
    const active = manager.getActiveTheme();
    expect(active.id).toBe(DEFAULT_THEME_ID);
    expect(active.type).toBe("dark");
  });

  test("ThemeManager switches themes and notifies listeners", () => {
    const manager = new ThemeManager();
    let notifiedTheme: Theme | null = null;

    const unsubscribe = manager.subscribe((theme) => {
      notifiedTheme = theme;
    });

    const switched = manager.setTheme("aurora");
    expect(switched).toBe(true);
    expect(manager.getActiveTheme().id).toBe("aurora");
    expect((notifiedTheme as Theme | null)?.id).toBe("aurora");

    unsubscribe();
    manager.setTheme("cloudlight");
    // Should not notify after unsubscribe
    expect((notifiedTheme as Theme | null)?.id).toBe("aurora");
    expect(manager.getActiveTheme().id).toBe("cloudlight");
  });

  test("ThemeManager handles invalid theme switch safely", () => {
    const manager = new ThemeManager("midnight-flight");
    const result = manager.setTheme("non-existent-theme-id");
    expect(result).toBe(false);
    expect(manager.getActiveTheme().id).toBe("midnight-flight");
  });
});
