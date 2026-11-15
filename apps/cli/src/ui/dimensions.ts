import { useTerminalDimensions } from "@opentui/react";

export type TerminalTier = "small" | "medium" | "large";

export interface TerminalDimensions {
  width: number;
  height: number;
  isCompactHeight: boolean; // height < 28 (e.g. 80x24)
  isCompactWidth: boolean;  // width < 100 (e.g. 80 cols)
  tier: TerminalTier;
}

/**
 * Classifies terminal dimensions into Small (80x24), Medium (100x30), and Large (120x36+).
 */
export function getTerminalTier(width: number, height: number): TerminalTier {
  if (width <= 85 || height <= 25) {
    return "small"; // e.g. 80x24 classic terminal
  }
  if (width <= 110 || height <= 32) {
    return "medium"; // e.g. 100x30 laptop terminal
  }
  return "large"; // e.g. 120x36 widescreen terminal
}

/**
 * Returns safe fallback dimensions based on stdout columns/rows or default 100x30.
 */
export function getFallbackDimensions(): { width: number; height: number } {
  return {
    width: process.stdout?.columns && process.stdout.columns > 0 ? process.stdout.columns : 100,
    height: process.stdout?.rows && process.stdout.rows > 0 ? process.stdout.rows : 30,
  };
}

/**
 * Hook providing live terminal dimensions with responsive tier classification
 * and safe fallback for non-TTY / test environments.
 */
export function useResponsiveTerminalDimensions(
  override?: { width: number; height: number }
): TerminalDimensions {
  if (override && typeof override.width === "number" && typeof override.height === "number") {
    return {
      width: override.width,
      height: override.height,
      isCompactHeight: override.height < 28,
      isCompactWidth: override.width < 100,
      tier: getTerminalTier(override.width, override.height),
    };
  }

  let dims: { width: number; height: number } | null = null;
  try {
    dims = useTerminalDimensions();
  } catch {
    dims = getFallbackDimensions();
  }

  const width = dims?.width && dims.width > 0 ? dims.width : 100;
  const height = dims?.height && dims.height > 0 ? dims.height : 30;

  return {
    width,
    height,
    isCompactHeight: height < 28,
    isCompactWidth: width < 100,
    tier: getTerminalTier(width, height),
  };
}
