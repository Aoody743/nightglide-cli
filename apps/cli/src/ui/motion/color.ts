/**
 * Celestial Kinetics Color Interpolation & Oscillation
 *
 * Provides smooth, non-intrusive color transitions between semantic theme tokens
 * for terminal UI elements (e.g. celestial pulse between textMuted and accent).
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Validates whether a string is a valid 3-character or 6-character hex color.
 */
export function isValidHex(hex: string): boolean {
  if (!hex || typeof hex !== "string") return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

/**
 * Parses a hex color string into RGB components.
 */
export function parseHex(hex: string): RGB {
  if (!isValidHex(hex)) {
    return { r: 128, g: 128, b: 128 };
  }
  let clean = hex.trim().replace("#", "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Formats RGB components into a standard 7-character #RRGGBB hex string.
 */
export function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toPart = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${toPart(r)}${toPart(g)}${toPart(b)}`;
}

/**
 * Linearly interpolates between two hex colors by ratio [0, 1].
 */
export function interpolateColor(colorA: string, colorB: string, ratio: number): string {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const rgbA = parseHex(colorA);
  const rgbB = parseHex(colorB);

  return toHex(
    rgbA.r + (rgbB.r - rgbA.r) * clampedRatio,
    rgbA.g + (rgbB.g - rgbA.g) * clampedRatio,
    rgbA.b + (rgbB.b - rgbA.b) * clampedRatio
  );
}

/**
 * Sinusoidal oscillation between colorA and colorB based on animation frame step.
 * Smoothly breathes from colorA at step 0 to colorB at peak and back to colorA.
 */
export function oscillateColors(
  colorA: string,
  colorB: string,
  step: number,
  totalSteps: number
): string {
  if (totalSteps <= 1) return colorA;

  // Normalized phase: 0 to 2*PI
  const phase = ((step % totalSteps) / totalSteps) * 2 * Math.PI;
  // Sinusoidal factor mapping [-1, 1] to [0, 1]
  const factor = (Math.sin(phase - Math.PI / 2) + 1) / 2;

  return interpolateColor(colorA, colorB, factor);
}
