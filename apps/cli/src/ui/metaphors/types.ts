import type { UIMetaphor } from "@nightglide/themes";

export type { UIMetaphor };

/**
 * Telemetry and cockpit instrumentation data for UI Metaphors.
 */
export interface MetaphorTelemetry {
  readonly metaphor: UIMetaphor;

  // Oceanic Submarine Cockpit Telemetry (Abyss Dive)
  readonly depth?: number;
  readonly depthFormatted?: string; // e.g. "DEPTH: 10,928m"
  readonly pressure?: number;
  readonly pressureFormatted?: string; // e.g. "PRESSURE: 108.6 MPa"
  readonly hullIntegrity?: number;
  readonly hullFormatted?: string; // e.g. "HULL: 100%"
  readonly sonarStatus?: string;
  readonly sonarFormatted?: string; // e.g. "SONAR: ACTIVE"
  readonly cockpitLabel?: string; // e.g. "[ABYSS COCKPIT 潜艇深潜舱]"

  // Celestial Flight Deck Telemetry (Flight Deck)
  readonly flightDeckTitle?: string; // e.g. "[FLIGHT DECK]"
  readonly tierPill?: string; // e.g. "80x24 [COMPACT]"
  readonly branch?: string; // e.g. "main"
  readonly modelPill?: string; // e.g. "[model (LOCAL)]"

  // Unified one-line telemetry summary string
  readonly fullTelemetryString?: string;
}

/**
 * Bulkhead box drawing border characters for double-line industrial submarine styling.
 */
export interface BulkheadBoxChars {
  readonly topLeft: string;
  readonly topRight: string;
  readonly bottomLeft: string;
  readonly bottomRight: string;
  readonly horizontal: string;
  readonly vertical: string;
  readonly teeDown: string;
  readonly teeUp: string;
  readonly teeRight: string;
  readonly teeLeft: string;
  readonly cross: string;
}
