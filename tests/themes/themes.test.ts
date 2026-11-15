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

  describe("WCAG 2.1 AA Contrast Ratio Compliance", () => {
    function getLuminance(hex: string): number {
      const rgb = hex
        .replace("#", "")
        .match(/.{2}/g)!
        .map((x) => parseInt(x, 16) / 255);
      const linear = rgb.map((c) =>
        c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    }

    function getContrastRatio(hex1: string, hex2: string): number {
      const lum1 = getLuminance(hex1);
      const lum2 = getLuminance(hex2);
      const brightest = Math.max(lum1, lum2);
      const darkest = Math.min(lum1, lum2);
      return (brightest + 0.05) / (darkest + 0.05);
    }

    test("all themes achieve >= 4.5:1 contrast for textPrimary, textSecondary, and textMuted against background", () => {
      for (const theme of BUILTIN_THEMES) {
        const bg = theme.colors.background;

        const crPrimary = getContrastRatio(theme.colors.textPrimary, bg);
        expect(crPrimary).toBeGreaterThanOrEqual(4.5);

        const crSecondary = getContrastRatio(theme.colors.textSecondary, bg);
        expect(crSecondary).toBeGreaterThanOrEqual(4.5);

        const crMuted = getContrastRatio(theme.colors.textMuted, bg);
        expect(crMuted).toBeGreaterThanOrEqual(4.5);
      }
    });

    test("all themes achieve >= 4.5:1 contrast for textPrimary, textSecondary, and textMuted against surface", () => {
      for (const theme of BUILTIN_THEMES) {
        const surface = theme.colors.surface;

        const crPrimary = getContrastRatio(theme.colors.textPrimary, surface);
        expect(crPrimary).toBeGreaterThanOrEqual(4.5);

        const crSecondary = getContrastRatio(theme.colors.textSecondary, surface);
        expect(crSecondary).toBeGreaterThanOrEqual(4.5);

        const crMuted = getContrastRatio(theme.colors.textMuted, surface);
        expect(crMuted).toBeGreaterThanOrEqual(4.5);
      }
    });

    test("all text-carrying accents and status tokens achieve >= 4.5:1 contrast against background and surface", () => {
      const textCarryingKeys: (keyof ThemeColors)[] = [
        "accent",
        "accentSecondary",
        "success",
        "warning",
        "error",
        "info",
      ];

      for (const theme of BUILTIN_THEMES) {
        const bg = theme.colors.background;
        const surface = theme.colors.surface;

        for (const token of textCarryingKeys) {
          const color = theme.colors[token];
          const crBg = getContrastRatio(color, bg);
          const crSurface = getContrastRatio(color, surface);

          expect(crBg).toBeGreaterThanOrEqual(4.5);
          expect(crSurface).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });
});
