import { describe, test, expect, beforeEach } from "bun:test";
import {
  ThemeManager,
  getThemeManager,
  midnightFlightTheme,
  auroraTheme,
  cloudlightTheme,
  daybreakTheme,
  abyssTrenchTheme,
  abyssChallengerTheme,
  ALL_THEMES,
  type Theme,
  type ThemeColors,
  type UIMetaphor,
} from "@nightglide/themes";
import {
  formatDepth,
  formatPressure,
  formatHullIntegrity,
  formatSonarStatus,
  formatAbyssCockpitTelemetry,
  formatFlightDeckTelemetry,
  getMetaphorTelemetry,
  createBulkheadDivider,
  createBulkheadFrame,
  BULKHEAD_BOX_CHARS,
  BULKHEAD_BORDER_STYLE,
  DEFAULT_ABYSS_DEPTH,
  DEFAULT_ABYSS_PRESSURE,
  DEFAULT_ABYSS_HULL,
  DEFAULT_ABYSS_SONAR,
} from "../../apps/cli/src/ui/metaphors/index.js";
import { formatHeaderTelemetry } from "../../apps/cli/src/ui/components/Header.js";

describe("UI Metaphors & Abyss Cockpit Specialist", () => {
  // WCAG 2.1 relative luminance and contrast ratio computation
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

  describe("Theme Registration & Oceanic Metaphor Tokens", () => {
    test("ThemeManager registers all 6 themes including both Abyss themes", () => {
      const tm = new ThemeManager();
      const allThemes = tm.getAllThemes();
      expect(allThemes.length).toBe(6);

      const ids = allThemes.map((t) => t.id);
      expect(ids).toContain("midnight-flight");
      expect(ids).toContain("aurora");
      expect(ids).toContain("cloudlight");
      expect(ids).toContain("daybreak");
      expect(ids).toContain("abyss-trench");
      expect(ids).toContain("abyss-challenger");
    });

    test("ALL_THEMES contains all 6 themes", () => {
      expect(ALL_THEMES.length).toBe(6);
    });

    test("Abyss themes specify abyss-dive metaphor and oceanic tokens", () => {
      expect(abyssTrenchTheme.metaphor).toBe("abyss-dive");
      expect(abyssTrenchTheme.sonarPing).toBe("#00F0FF");
      expect(abyssTrenchTheme.depthGauge).toBe("#00E5A3");
      expect(abyssTrenchTheme.hullBorder).toBe("#1C324E");

      expect(abyssChallengerTheme.metaphor).toBe("abyss-dive");
      expect(abyssChallengerTheme.sonarPing).toBe("#00FFE0");
      expect(abyssChallengerTheme.depthGauge).toBe("#38BDF8");
      expect(abyssChallengerTheme.hullBorder).toBe("#253556");
    });

    test("Celestial themes default to flight-deck metaphor", () => {
      expect(midnightFlightTheme.metaphor).toBe("flight-deck");
      expect(auroraTheme.metaphor).toBe("flight-deck");
      expect(cloudlightTheme.metaphor).toBe("flight-deck");
      expect(daybreakTheme.metaphor).toBe("flight-deck");
    });

    test("ThemeManager allows switching between celestial and abyss themes", () => {
      const tm = new ThemeManager();
      expect(tm.getActiveTheme().metaphor).toBe("flight-deck");

      const switchedToTrench = tm.setTheme("abyss-trench");
      expect(switchedToTrench).toBe(true);
      expect(tm.getActiveTheme().id).toBe("abyss-trench");
      expect(tm.getActiveTheme().metaphor).toBe("abyss-dive");

      const switchedToChallenger = tm.setTheme("abyss-challenger");
      expect(switchedToChallenger).toBe(true);
      expect(tm.getActiveTheme().id).toBe("abyss-challenger");
      expect(tm.getActiveTheme().metaphor).toBe("abyss-dive");

      const switchedBack = tm.setTheme("midnight-flight");
      expect(switchedBack).toBe(true);
      expect(tm.getActiveTheme().metaphor).toBe("flight-deck");
    });
  });

  describe("WCAG 2.1 AA Contrast Ratio Compliance for All 6 Themes", () => {
    const tm = new ThemeManager();
    const allThemes = tm.getAllThemes();

    test("all 6 themes achieve >= 4.5:1 textPrimary and textSecondary contrast against background", () => {
      for (const theme of allThemes) {
        const bg = theme.colors.background;

        const crPrimary = getContrastRatio(theme.colors.textPrimary, bg);
        expect(crPrimary).toBeGreaterThanOrEqual(4.5);

        const crSecondary = getContrastRatio(theme.colors.textSecondary, bg);
        expect(crSecondary).toBeGreaterThanOrEqual(4.5);
      }
    });

    test("all 6 themes achieve >= 4.5:1 textPrimary and textSecondary contrast against surface", () => {
      for (const theme of allThemes) {
        const surface = theme.colors.surface;

        const crPrimary = getContrastRatio(theme.colors.textPrimary, surface);
        expect(crPrimary).toBeGreaterThanOrEqual(4.5);

        const crSecondary = getContrastRatio(theme.colors.textSecondary, surface);
        expect(crSecondary).toBeGreaterThanOrEqual(4.5);
      }
    });

    test("all 6 themes achieve >= 4.5:1 contrast for text-carrying accents and status tokens against background", () => {
      const tokens: (keyof ThemeColors)[] = [
        "accent",
        "accentSecondary",
        "success",
        "warning",
        "error",
        "info",
      ];

      for (const theme of allThemes) {
        const bg = theme.colors.background;
        for (const token of tokens) {
          const color = theme.colors[token];
          const cr = getContrastRatio(color, bg);
          expect(cr).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    test("all 6 themes achieve >= 4.5:1 contrast for text-carrying accents and status tokens against surface", () => {
      const tokens: (keyof ThemeColors)[] = [
        "accent",
        "accentSecondary",
        "success",
        "warning",
        "error",
        "info",
      ];

      for (const theme of allThemes) {
        const surface = theme.colors.surface;
        for (const token of tokens) {
          const color = theme.colors[token];
          const cr = getContrastRatio(color, surface);
          expect(cr).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });

  describe("Abyss Submarine Cockpit Telemetry Formatters", () => {
    test("formatDepth formats meters with comma separation", () => {
      expect(formatDepth(10928)).toBe("DEPTH: 10,928m");
      expect(formatDepth(0)).toBe("DEPTH: 0m");
      expect(formatDepth(8500)).toBe("DEPTH: 8,500m");
      expect(formatDepth()).toBe(`DEPTH: ${DEFAULT_ABYSS_DEPTH.toLocaleString("en-US")}m`);
    });

    test("formatPressure formats MPa with one decimal point", () => {
      expect(formatPressure(108.6)).toBe("PRESSURE: 108.6 MPa");
      expect(formatPressure(0.1)).toBe("PRESSURE: 0.1 MPa");
      expect(formatPressure()).toBe("PRESSURE: 108.6 MPa");
    });

    test("formatHullIntegrity formats percentage", () => {
      expect(formatHullIntegrity(100)).toBe("HULL: 100%");
      expect(formatHullIntegrity(95.4)).toBe("HULL: 95%");
      expect(formatHullIntegrity(0)).toBe("HULL: 0%");
      expect(formatHullIntegrity()).toBe("HULL: 100%");
    });

    test("formatSonarStatus formats sonar state in uppercase", () => {
      expect(formatSonarStatus("active")).toBe("SONAR: ACTIVE");
      expect(formatSonarStatus("standby")).toBe("SONAR: STANDBY");
      expect(formatSonarStatus("passive")).toBe("SONAR: PASSIVE");
      expect(formatSonarStatus()).toBe("SONAR: ACTIVE");
    });

    test("formatAbyssCockpitTelemetry produces exact submarine cockpit telemetry line", () => {
      const line = formatAbyssCockpitTelemetry({
        depth: 10928,
        pressure: 108.6,
        hull: 100,
        sonar: "ACTIVE",
      });
      expect(line).toBe(
        "[ABYSS COCKPIT 潜艇深潜舱] | DEPTH: 10,928m | PRESSURE: 108.6 MPa | HULL: 100% | SONAR: ACTIVE"
      );
    });

    test("formatFlightDeckTelemetry produces celestial flight deck telemetry line", () => {
      const line = formatFlightDeckTelemetry({
        width: 80,
        height: 24,
        tierBadge: "COMPACT",
        branch: "main",
        modelPill: "[model (LOCAL)]",
      });
      expect(line).toBe("[FLIGHT DECK] | 80x24 [COMPACT] | main | [model (LOCAL)]");
    });
  });

  describe("Bulkhead Double-Line Box Drawing Styles", () => {
    test("BULKHEAD_BOX_CHARS contains authentic double-line characters", () => {
      expect(BULKHEAD_BOX_CHARS.topLeft).toBe("╔");
      expect(BULKHEAD_BOX_CHARS.topRight).toBe("╗");
      expect(BULKHEAD_BOX_CHARS.bottomLeft).toBe("╚");
      expect(BULKHEAD_BOX_CHARS.bottomRight).toBe("╝");
      expect(BULKHEAD_BOX_CHARS.horizontal).toBe("═");
      expect(BULKHEAD_BOX_CHARS.vertical).toBe("║");
      expect(BULKHEAD_BOX_CHARS.teeDown).toBe("╦");
      expect(BULKHEAD_BOX_CHARS.teeUp).toBe("╩");
      expect(BULKHEAD_BORDER_STYLE).toBe("double");
    });

    test("createBulkheadDivider produces double-line horizontal border", () => {
      expect(createBulkheadDivider(5)).toBe("═════");
      expect(createBulkheadDivider(0)).toBe("");
    });

    test("createBulkheadFrame encapsulates content with double-line bulkhead frame", () => {
      const framed = createBulkheadFrame(["SONAR PING NOMINAL"], 30);
      expect(framed.length).toBe(3);
      expect(framed[0]!.startsWith("╔")).toBe(true);
      expect(framed[0]!.endsWith("╗")).toBe(true);
      expect(framed[1]!.startsWith("║")).toBe(true);
      expect(framed[1]!.endsWith("║")).toBe(true);
      expect(framed[1]!.includes("SONAR PING NOMINAL")).toBe(true);
      expect(framed[2]!.startsWith("╚")).toBe(true);
      expect(framed[2]!.endsWith("╝")).toBe(true);
    });
  });

  describe("Metaphor Telemetry & Switching", () => {
    test("getMetaphorTelemetry generates abyss-dive telemetry object", () => {
      const telemetry = getMetaphorTelemetry("abyss-dive", {
        depth: 10928,
        pressure: 108.6,
        hull: 100,
        sonar: "ACTIVE",
      });

      expect(telemetry.metaphor).toBe("abyss-dive");
      expect(telemetry.depthFormatted).toBe("DEPTH: 10,928m");
      expect(telemetry.pressureFormatted).toBe("PRESSURE: 108.6 MPa");
      expect(telemetry.hullFormatted).toBe("HULL: 100%");
      expect(telemetry.sonarFormatted).toBe("SONAR: ACTIVE");
      expect(telemetry.cockpitLabel).toBe("[ABYSS COCKPIT 潜艇深潜舱]");
      expect(telemetry.fullTelemetryString).toBe(
        "[ABYSS COCKPIT 潜艇深潜舱] | DEPTH: 10,928m | PRESSURE: 108.6 MPa | HULL: 100% | SONAR: ACTIVE"
      );
    });

    test("getMetaphorTelemetry generates flight-deck telemetry object", () => {
      const telemetry = getMetaphorTelemetry("flight-deck", {
        width: 80,
        height: 24,
        tierBadge: "COMPACT",
        branch: "main",
        modelPill: "[model (LOCAL)]",
      });

      expect(telemetry.metaphor).toBe("flight-deck");
      expect(telemetry.flightDeckTitle).toBe("[FLIGHT DECK]");
      expect(telemetry.tierPill).toBe("80x24 [COMPACT]");
      expect(telemetry.branch).toBe("main");
      expect(telemetry.fullTelemetryString).toBe(
        "[FLIGHT DECK] | 80x24 [COMPACT] | main | [model (LOCAL)]"
      );
    });

    test("formatHeaderTelemetry dispatches correctly by metaphor", () => {
      const abyssLine = formatHeaderTelemetry("abyss-dive", {
        depth: 10928,
        pressure: 108.6,
        hull: 100,
        sonar: "ACTIVE",
      });
      expect(abyssLine).toBe(
        "[ABYSS COCKPIT 潜艇深潜舱] | DEPTH: 10,928m | PRESSURE: 108.6 MPa | HULL: 100% | SONAR: ACTIVE"
      );

      const flightLine = formatHeaderTelemetry("flight-deck", {
        width: 80,
        height: 24,
        tierBadge: "COMPACT",
        branch: "main",
        modelPill: "[model (LOCAL)]",
      });
      expect(flightLine).toBe("[FLIGHT DECK] | 80x24 [COMPACT] | main | [model (LOCAL)]");
    });
  });
});
