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
    return "small"; // e.g. 80x24 classic compact terminal
  }
  if (width <= 110 || height <= 32) {
    return "medium"; // e.g. 100x30 laptop standard terminal
  }
  return "large"; // e.g. 120x36 widescreen terminal
}

/**
 * Returns human-readable display name for the terminal tier.
 */
export function getTierDisplayName(tier: TerminalTier): string {
  switch (tier) {
    case "small":
      return "Compact (80x24)";
    case "medium":
      return "Standard (100x30)";
    case "large":
      return "Wide (120x36)";
  }
}

/**
 * Returns a short badge representation for the terminal tier.
 */
export function getTierBadge(tier: TerminalTier): string {
  switch (tier) {
    case "small":
      return "S";
    case "medium":
      return "M";
    case "large":
      return "L";
  }
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
 * Computes viewport capacity and layout heights for the conversation timeline
 * so the Composer and messages remain fully visible without being pushed off screen.
 */
export function computeViewportCapacity(
  dimensions?: { height?: number; width?: number } | TerminalDimensions
): {
  maxVisibleMessages: number;
  timelineHeight: number;
  isCompact: boolean;
} {
  const height = dimensions?.height ?? 30;
  const isCompact = height < 28;

  if (isCompact) {
    // 80x24: strictly limit messages and height to avoid screen overflow
    return {
      maxVisibleMessages: 3,
      timelineHeight: Math.max(12, height - 9),
      isCompact: true,
    };
  }

  if (height < 34) {
    // 100x30: standard laptop view
    return {
      maxVisibleMessages: 5,
      timelineHeight: Math.max(16, height - 10),
      isCompact: false,
    };
  }

  // 120x36+: wide terminal
  return {
    maxVisibleMessages: 8,
    timelineHeight: Math.max(22, height - 10),
    isCompact: false,
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
