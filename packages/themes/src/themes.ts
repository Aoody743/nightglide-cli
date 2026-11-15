import type { Theme } from "./tokens.js";

/**
 * Theme 1: Midnight Flight (Dark)
 * Deep, elegant, cinematic celestial flight.
 */
export const midnightFlightTheme: Theme = {
  id: "midnight-flight",
  name: "Midnight Flight",
  type: "dark",
  description: "Deep, elegant, cinematic celestial night sky.",
  colors: {
    background: "#090F20",
    surface: "#141D35",
    surfaceElevated: "#1E2A4A",
    border: "#2A3B66",
    textPrimary: "#F0F3FF",
    textSecondary: "#A6B2D0",
    textMuted: "#637299",
    accent: "#A6A0FF",
    accentSecondary: "#74D8E8",
    success: "#4ADE80",
    warning: "#FBBF24",
    error: "#F87171",
    info: "#38BDF8",
    selection: "#2E3F70",
    focus: "#A6A0FF",
  },
};

/**
 * Theme 2: Aurora (Dark)
 * Dreamlike, colorful, energetic polar glow.
 */
export const auroraTheme: Theme = {
  id: "aurora",
  name: "Aurora",
  type: "dark",
  description: "Dreamlike, vibrant polar atmospheric aurora.",
  colors: {
    background: "#100C25",
    surface: "#211936",
    surfaceElevated: "#2F234D",
    border: "#44346B",
    textPrimary: "#F5EEFF",
    textSecondary: "#B8AAD6",
    textMuted: "#7E6E9E",
    accent: "#D5A6FF",
    accentSecondary: "#78E5D8",
    success: "#34D399",
    warning: "#FBBF24",
    error: "#FB7185",
    info: "#60A5FA",
    selection: "#482D6E",
    focus: "#D5A6FF",
  },
};

/**
 * Theme 3: Cloudlight (Light)
 * Soft daylight, clean, welcoming airy sky.
 */
export const cloudlightTheme: Theme = {
  id: "cloudlight",
  name: "Cloudlight",
  type: "light",
  description: "Soft daylight, clean and welcoming airy sky.",
  colors: {
    background: "#F8FAFF",
    surface: "#ECF0F9",
    surfaceElevated: "#DFE5F2",
    border: "#CBD5E6",
    textPrimary: "#24354F",
    textSecondary: "#61728A",
    textMuted: "#94A3B8",
    accent: "#527BC5",
    accentSecondary: "#9B83D0",
    success: "#16A34A",
    warning: "#D97706",
    error: "#DC2626",
    info: "#0284C7",
    selection: "#D4E0F7",
    focus: "#527BC5",
  },
};

/**
 * Theme 4: Daybreak (Light)
 * Warm, optimistic, artistic morning horizon.
 */
export const daybreakTheme: Theme = {
  id: "daybreak",
  name: "Daybreak",
  type: "light",
  description: "Warm, optimistic, artistic morning horizon.",
  colors: {
    background: "#FFFAF2",
    surface: "#F2ECE5",
    surfaceElevated: "#E6DED6",
    border: "#D4C7BA",
    textPrimary: "#33404E",
    textSecondary: "#687789",
    textMuted: "#97A4B2",
    accent: "#C27D68",
    accentSecondary: "#5E9BBA",
    success: "#15803D",
    warning: "#B45309",
    error: "#B91C1C",
    info: "#0369A1",
    selection: "#EAD9CA",
    focus: "#C27D68",
  },
};

export const BUILTIN_THEMES: readonly Theme[] = [
  midnightFlightTheme,
  auroraTheme,
  cloudlightTheme,
  daybreakTheme,
] as const;

export const DEFAULT_THEME_ID = "midnight-flight";
