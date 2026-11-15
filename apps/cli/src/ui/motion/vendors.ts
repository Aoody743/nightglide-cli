/**
 * Provider Signature Logos & Kinetic Animations
 * Nightglide Terminal Motion System
 *
 * Defines detailed, authentic vendor signatures for:
 * - Anthropic Claude: Terracotta brand, starburst logo, terracotta sunburst pulse
 * - OpenAI (GPT): Emerald/Teal brand, spiral rosette, sacred rosette spinner
 * - Google Gemini: Celestial Blue / Star Violet brand, twin star sparkle, twin constellation sparkle
 * - xAI Grok: Stark Monochrome brand, relativistic slash vector, quantum slash sweep
 * - Oh My Pi (OMP): Electric Purple brand, pi glyph, kinetic spin
 * - Local / oMLX / Endless / Submarine Sonar: Bioluminescent Cyan / Sonar Amber brand, radar ping
 */

export type VendorId = "anthropic" | "openai" | "google" | "xai" | "omp" | "local";

export interface VendorSignature {
  id: VendorId;
  name: string;
  brandColor: string;
  secondaryColor?: string;
  miniGlyph: string;
  frames: readonly string[];
  asciiLogo: string;
  defaultSlotWidth: number;
}

/**
 * Anthropic Claude Signature
 * Brand color: Terracotta #D97757
 * Kinetic pulse: Terracotta sunburst pulse
 */
export const ANTHROPIC_SIGNATURE: VendorSignature = {
  id: "anthropic",
  name: "Anthropic Claude",
  brandColor: "#D97757",
  secondaryColor: "#E89278",
  miniGlyph: "✶",
  frames: ["✶", "✷", "✸", "✹", "✺", "✹", "✸", "✷"] as const,
  asciiLogo: [
    "   ▄██▄",
    " ▄██████▄",
    "▀██████████▀",
    " ▀██████▀",
    "   ▀██▀",
  ].join("\n"),
  defaultSlotWidth: 2,
};

/**
 * OpenAI Signature
 * Brand color: Teal / Emerald #10A37F
 * Kinetic pulse: Sacred Rosette spinner
 */
export const OPENAI_SIGNATURE: VendorSignature = {
  id: "openai",
  name: "OpenAI",
  brandColor: "#10A37F",
  secondaryColor: "#1AC299",
  miniGlyph: "✢",
  frames: ["✢", "✤", "✥", "✦", "✧", "✦", "✥", "✤"] as const,
  asciiLogo: [
    " ⢀⣴⣶⣦⡀",
    "⢀⣿⠟⠻⣿⡀",
    "⠘⣿⣤⣤⣿⠃",
    " ⠈⠛⠛⠁",
  ].join("\n"),
  defaultSlotWidth: 2,
};

/**
 * Google Gemini Signature
 * Brand color: Celestial Blue #4E75F6 / Star Violet #8AB4F8
 * Kinetic pulse: Twin Constellation sparkle
 */
export const GOOGLE_SIGNATURE: VendorSignature = {
  id: "google",
  name: "Google Gemini",
  brandColor: "#4E75F6",
  secondaryColor: "#8AB4F8",
  miniGlyph: "✦",
  frames: ["✦ ✧", "✧ ✦", "✶ ✦", "✦ ✶", "✦ ✧"] as const,
  asciiLogo: [
    "   ✦",
    " ✦   ✧",
    "   ✦",
  ].join("\n"),
  defaultSlotWidth: 4,
};

/**
 * xAI Grok Signature
 * Brand color: Stark Monochrome #FFFFFF
 * Kinetic pulse: Quantum slash sweep
 */
export const XAI_SIGNATURE: VendorSignature = {
  id: "xai",
  name: "xAI Grok",
  brandColor: "#FFFFFF",
  secondaryColor: "#888888",
  miniGlyph: "／",
  frames: ["／", "─", "＼", "│", "／", "─", "＼", "│"] as const,
  asciiLogo: [
    "   ／",
    "  ／",
    " ／",
  ].join("\n"),
  defaultSlotWidth: 3,
};

/**
 * Oh My Pi (OMP) Signature
 * Brand color: Electric Purple #A6A0FF
 * Kinetic pulse: Kinetic pi orbit
 */
export const OMP_SIGNATURE: VendorSignature = {
  id: "omp",
  name: "Oh My Pi (OMP)",
  brandColor: "#A6A0FF",
  secondaryColor: "#C4C0FF",
  miniGlyph: "π",
  frames: ["π·", "·π", "π·", "·π"] as const,
  asciiLogo: [
    "████████",
    "  ██  ██",
    "  ██  ██",
  ].join("\n"),
  defaultSlotWidth: 3,
};

/**
 * Local / oMLX / Endless / Submarine Sonar Signature
 * Brand color: Bioluminescent Cyan #00F0FF / Sonar Amber #FFB800
 * Kinetic pulse: Sonar radar ping
 */
export const LOCAL_SIGNATURE: VendorSignature = {
  id: "local",
  name: "Local / Submarine Sonar",
  brandColor: "#00F0FF",
  secondaryColor: "#FFB800",
  miniGlyph: "◎",
  frames: ["◌", "◯", "◎", "◉", "◎", "◯"] as const,
  asciiLogo: [
    "╭───╮",
    "│ ◎ │",
    "╰───╯",
  ].join("\n"),
  defaultSlotWidth: 2,
};

/**
 * Map of all vendor signatures with primary IDs and common aliases.
 */
export const VENDOR_SIGNATURES: Record<VendorId, VendorSignature> & {
  claude: VendorSignature;
  gemini: VendorSignature;
  grok: VendorSignature;
} = {
  anthropic: ANTHROPIC_SIGNATURE,
  claude: ANTHROPIC_SIGNATURE,
  openai: OPENAI_SIGNATURE,
  google: GOOGLE_SIGNATURE,
  gemini: GOOGLE_SIGNATURE,
  xai: XAI_SIGNATURE,
  grok: XAI_SIGNATURE,
  omp: OMP_SIGNATURE,
  local: LOCAL_SIGNATURE,
};

/**
 * Resolves a model identifier or provider string to an authentic VendorSignature.
 *
 * Inspects model IDs and provider strings (e.g. "claude-3-5-sonnet", "gpt-4o",
 * "gemini-1.5-pro", "grok-2", "omlx/endless", "omp") and returns the matching
 * VendorSignature complete with brand color, mini glyph, kinetic frames, and ASCII logo.
 *
 * Defaults to Local / Submarine Sonar signature when unrecognized or omitted.
 */
export function resolveProviderVendor(modelIdOrProvider?: string): VendorSignature {
  if (!modelIdOrProvider) {
    return LOCAL_SIGNATURE;
  }

  const raw = modelIdOrProvider.trim().toLowerCase();

  // Anthropic Claude
  if (raw.includes("claude") || raw.includes("anthropic")) {
    return ANTHROPIC_SIGNATURE;
  }

  // OpenAI (GPT, o1, o3, o4)
  if (
    raw.includes("gpt") ||
    raw.includes("openai") ||
    raw.includes("chatgpt") ||
    /^o[134](-|$)/.test(raw) ||
    raw.includes("/o1") ||
    raw.includes("/o3") ||
    raw.includes("/o4")
  ) {
    return OPENAI_SIGNATURE;
  }

  // Google Gemini
  if (raw.includes("gemini") || raw.includes("google") || raw.includes("bard")) {
    return GOOGLE_SIGNATURE;
  }

  // xAI Grok
  if (raw.includes("grok") || raw.includes("xai")) {
    return XAI_SIGNATURE;
  }

  // Oh My Pi (OMP)
  if (
    raw === "omp" ||
    raw.startsWith("omp/") ||
    raw.includes("-omp") ||
    raw.includes("/omp") ||
    raw.includes("oh-my-pi") ||
    raw.includes("ohmypi")
  ) {
    return OMP_SIGNATURE;
  }

  // Local / Submarine Sonar / oMLX / Endless / Ollama / Local weights
  if (
    raw.includes("local") ||
    raw.includes("omlx") ||
    raw.includes("endless") ||
    raw.includes("sonar") ||
    raw.includes("submarine") ||
    raw.includes("ollama") ||
    raw.includes("qwen") ||
    raw.includes("deepseek") ||
    raw.includes("llama") ||
    raw.includes("mistral") ||
    raw.includes("mock")
  ) {
    return LOCAL_SIGNATURE;
  }

  // Default fallback for Nightglide local-first architecture
  return LOCAL_SIGNATURE;
}
