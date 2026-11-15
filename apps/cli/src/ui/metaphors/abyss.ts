import type { BulkheadBoxChars, MetaphorTelemetry, UIMetaphor } from "./types.js";

/**
 * Standard double-line box drawing characters for deep-sea submarine bulkheads.
 * E.g., ╔═══╦═══╗, ║   ║   ║, ╚═══╩═══╝
 */
export const BULKHEAD_BOX_CHARS: BulkheadBoxChars = {
  topLeft: "╔",
  topRight: "╗",
  bottomLeft: "╚",
  bottomRight: "╝",
  horizontal: "═",
  vertical: "║",
  teeDown: "╦",
  teeUp: "╩",
  teeRight: "╠",
  teeLeft: "╣",
  cross: "╬",
} as const;

export const BULKHEAD_BORDER_STYLE = "double" as const;

export const BULKHEAD_SAMPLE_TOP = "╔═══╦═══╗";
export const BULKHEAD_SAMPLE_MID = "║   ║   ║";
export const BULKHEAD_SAMPLE_BOT = "╚═══╩═══╝";

export const DEFAULT_ABYSS_DEPTH = 10928;
export const DEFAULT_ABYSS_PRESSURE = 108.6;
export const DEFAULT_ABYSS_HULL = 100;
export const DEFAULT_ABYSS_SONAR = "ACTIVE";
export const ABYSS_COCKPIT_LABEL = "[ABYSS COCKPIT 潜艇深潜舱]";
export const FLIGHT_DECK_LABEL = "[FLIGHT DECK]";

/**
 * Formats submarine depth in meters with US-style thousands separators.
 * E.g., "DEPTH: 10,928m"
 */
export function formatDepth(meters: number = DEFAULT_ABYSS_DEPTH): string {
  const formattedNumber = Math.round(meters).toLocaleString("en-US");
  return `DEPTH: ${formattedNumber}m`;
}

/**
 * Formats ambient hydrostatic pressure in megapascals (MPa).
 * E.g., "PRESSURE: 108.6 MPa"
 */
export function formatPressure(mpa: number = DEFAULT_ABYSS_PRESSURE): string {
  return `PRESSURE: ${mpa.toFixed(1)} MPa`;
}

/**
 * Formats submarine titanium hull integrity percentage.
 * E.g., "HULL: 100%"
 */
export function formatHullIntegrity(percent: number = DEFAULT_ABYSS_HULL): string {
  return `HULL: ${Math.round(percent)}%`;
}

/**
 * Formats oceanic sonar active/passive status indicator.
 * E.g., "SONAR: ACTIVE"
 */
export function formatSonarStatus(status: string = DEFAULT_ABYSS_SONAR): string {
  return `SONAR: ${status.toUpperCase()}`;
}

/**
 * Formats the complete Submarine Cockpit telemetry line:
 * `[ABYSS COCKPIT 潜艇深潜舱] | DEPTH: 10,928m | PRESSURE: 108.6 MPa | HULL: 100% | SONAR: ACTIVE`
 */
export function formatAbyssCockpitTelemetry(options?: {
  depth?: number;
  pressure?: number;
  hull?: number;
  sonar?: string;
  cockpitLabel?: string;
}): string {
  const depthStr = formatDepth(options?.depth ?? DEFAULT_ABYSS_DEPTH);
  const pressureStr = formatPressure(options?.pressure ?? DEFAULT_ABYSS_PRESSURE);
  const hullStr = formatHullIntegrity(options?.hull ?? DEFAULT_ABYSS_HULL);
  const sonarStr = formatSonarStatus(options?.sonar ?? DEFAULT_ABYSS_SONAR);
  const label = options?.cockpitLabel ?? ABYSS_COCKPIT_LABEL;

  return `${label} | ${depthStr} | ${pressureStr} | ${hullStr} | ${sonarStr}`;
}

/**
 * Formats the complete Celestial Flight Deck telemetry line:
 * `[FLIGHT DECK] | 80x24 [COMPACT] | main | [model (LOCAL)]`
 */
export function formatFlightDeckTelemetry(options?: {
  width?: number;
  height?: number;
  tierBadge?: string;
  branch?: string;
  modelPill?: string;
}): string {
  const w = options?.width ?? 80;
  const h = options?.height ?? 24;
  const badge = options?.tierBadge ?? "COMPACT";
  const branch = options?.branch ?? "main";
  const model = options?.modelPill ?? "[model (LOCAL)]";

  return `${FLIGHT_DECK_LABEL} | ${w}x${h} [${badge}] | ${branch} | ${model}`;
}

/**
 * Creates a horizontal double-line bulkhead divider of a given width.
 */
export function createBulkheadDivider(width: number): string {
  if (width <= 0) return "";
  return BULKHEAD_BOX_CHARS.horizontal.repeat(width);
}

/**
 * Builds a multi-line double-line bulkhead framed box around lines of content.
 */
export function createBulkheadFrame(lines: string[], width: number = 80): string[] {
  const innerWidth = Math.max(0, width - 2);
  const top =
    BULKHEAD_BOX_CHARS.topLeft +
    BULKHEAD_BOX_CHARS.horizontal.repeat(innerWidth) +
    BULKHEAD_BOX_CHARS.topRight;
  const bottom =
    BULKHEAD_BOX_CHARS.bottomLeft +
    BULKHEAD_BOX_CHARS.horizontal.repeat(innerWidth) +
    BULKHEAD_BOX_CHARS.bottomRight;

  const middle = lines.map((line) => {
    const padded =
      line.length > innerWidth
        ? line.slice(0, innerWidth)
        : line.padEnd(innerWidth, " ");
    return `${BULKHEAD_BOX_CHARS.vertical}${padded}${BULKHEAD_BOX_CHARS.vertical}`;
  });

  return [top, ...middle, bottom];
}

/**
 * Creates a structured MetaphorTelemetry data object for the given metaphor.
 */
export function getMetaphorTelemetry(
  metaphor: UIMetaphor,
  options?: {
    depth?: number;
    pressure?: number;
    hull?: number;
    sonar?: string;
    width?: number;
    height?: number;
    tierBadge?: string;
    branch?: string;
    modelPill?: string;
  }
): MetaphorTelemetry {
  if (metaphor === "abyss-dive") {
    const depthVal = options?.depth ?? DEFAULT_ABYSS_DEPTH;
    const pressureVal = options?.pressure ?? DEFAULT_ABYSS_PRESSURE;
    const hullVal = options?.hull ?? DEFAULT_ABYSS_HULL;
    const sonarVal = options?.sonar ?? DEFAULT_ABYSS_SONAR;
    const depthFormatted = formatDepth(depthVal);
    const pressureFormatted = formatPressure(pressureVal);
    const hullFormatted = formatHullIntegrity(hullVal);
    const sonarFormatted = formatSonarStatus(sonarVal);
    const fullTelemetryString = `${ABYSS_COCKPIT_LABEL} | ${depthFormatted} | ${pressureFormatted} | ${hullFormatted} | ${sonarFormatted}`;

    return {
      metaphor: "abyss-dive",
      depth: depthVal,
      depthFormatted,
      pressure: pressureVal,
      pressureFormatted,
      hullIntegrity: hullVal,
      hullFormatted,
      sonarStatus: sonarVal,
      sonarFormatted,
      cockpitLabel: ABYSS_COCKPIT_LABEL,
      fullTelemetryString,
    };
  }

  const w = options?.width ?? 80;
  const h = options?.height ?? 24;
  const badge = options?.tierBadge ?? "COMPACT";
  const branch = options?.branch ?? "main";
  const modelPill = options?.modelPill ?? "[model (LOCAL)]";
  const fullTelemetryString = `${FLIGHT_DECK_LABEL} | ${w}x${h} [${badge}] | ${branch} | ${modelPill}`;

  return {
    metaphor: "flight-deck",
    flightDeckTitle: FLIGHT_DECK_LABEL,
    tierPill: `${w}x${h} [${badge}]`,
    branch,
    modelPill,
    fullTelemetryString,
  };
}
