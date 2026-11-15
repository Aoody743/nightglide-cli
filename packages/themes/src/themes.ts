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
    textMuted: "#7A8BB8",
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
    textMuted: "#9282B8",
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
    textSecondary: "#4B5B73",
    textMuted: "#596A82",
    accent: "#2C5CA8",
    accentSecondary: "#62449E",
    success: "#147A38",
    warning: "#944800",
    error: "#B91C1C",
    info: "#0369A1",
    selection: "#D4E0F7",
    focus: "#2C5CA8",
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
    textSecondary: "#4E5D6E",
    textMuted: "#5E6B7A",
    accent: "#9E4D36",
    accentSecondary: "#2A6885",
    success: "#116D33",
    warning: "#944200",
    error: "#B91C1C",
    info: "#0369A1",
    selection: "#EAD9CA",
    focus: "#9E4D36",
  },
};

export const BUILTIN_THEMES: readonly Theme[] = [
  midnightFlightTheme,
  auroraTheme,
  cloudlightTheme,
  daybreakTheme,
] as const;

export const DEFAULT_THEME_ID = "midnight-flight";
