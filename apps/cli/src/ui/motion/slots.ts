/**
 * Anti-Jitter Slot Reservation Primitives
 *
 * Terminal character grids have no sub-pixel rendering. Any change in character length
 * causes surrounding text and layout boxes to shift and jitter violently.
 *
 * Slot reservation guarantees that dynamic animated elements (spinners, cursors,
 * progress bars, status badges) occupy a strictly fixed column width across every frame.
 */

/**
 * Strips ANSI escape sequences from strings before measuring visual terminal width.
 */
export function stripAnsi(str: string): string {
  // Matches ANSI escape codes e.g. \u001b[31m, \u001b[0m
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

/**
 * Calculates visual column width of a single character in a standard terminal.
 * Standard half-width characters (ASCII, Braille, box-drawing) = 1.
 * CJK ideographs and fullwidth characters = 2.
 * Zero-width and control characters = 0.
 */
export function getCharWidth(char: string): number {
  const code = char.codePointAt(0);
  if (!code) return 0;

  // Control characters & zero-width
  if (code < 32 || (code >= 0x7f && code < 0xa0)) {
    return 0;
  }

  // Soft hyphen, zero-width spaces
  if (code === 0x00ad || code === 0x200b || (code >= 0xfe00 && code <= 0xfe0f)) {
    return 0;
  }

  // Wide character ranges:
  // - Hangul Jamo: 0x1100..0x115F
  // - CJK Radicals, Kangxi, Ideographs: 0x2E80..0xA4CF (except 0x303F)
  // - Hangul Syllables: 0xAC00..0xD7A3
  // - CJK Compatibility: 0xF900..0xFAFF
  // - Vertical Forms & CJK Compatibility Forms: 0xFE10..0xFE19, 0xFE30..0xFE6F
  // - Fullwidth ASCII & forms: 0xFF00..0xFF60, 0xFFE0..0xFFE6
  // - Emoji / Pictographs: 0x1F300..0x1F64F, 0x1F680..0x1F6FF
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f64f) ||
    (code >= 0x1f680 && code <= 0x1f6ff)
  ) {
    return 2;
  }

  // Standard terminal characters (ASCII, box drawing ─│┌, braille ⠋, celestial ✦, block █, marks ✔ ✖)
  return 1;
}

/**
 * Returns the exact terminal column width of a string.
 */
export function getStringWidth(text: string): number {
  if (!text) return 0;
  const clean = stripAnsi(text);
  let total = 0;
  for (const char of clean) {
    total += getCharWidth(char);
  }
  return total;
}

export type SlotAlignment = "left" | "right" | "center";

/**
 * Guarantees that `content` occupies EXACTLY `targetWidth` terminal columns.
 * - If `content` is shorter than `targetWidth`, pads with `padChar` according to `align`.
 * - If `content` is longer than `targetWidth`, truncates safely while preserving character boundaries.
 * - Never returns a string whose `getStringWidth` differs from `targetWidth`.
 */
export function reserveSlot(
  content: string,
  targetWidth: number,
  align: SlotAlignment = "left",
  padChar: string = " "
): string {
  if (targetWidth <= 0) return "";

  const padWidth = getCharWidth(padChar) || 1;
  const currentWidth = getStringWidth(content);

  if (currentWidth === targetWidth) {
    return content;
  }

  if (currentWidth < targetWidth) {
    const deficit = targetWidth - currentWidth;
    const padCount = Math.floor(deficit / padWidth);
    const remainder = deficit % padWidth;

    if (align === "left") {
      return content + padChar.repeat(padCount) + " ".repeat(remainder);
    }
    if (align === "right") {
      return padChar.repeat(padCount) + " ".repeat(remainder) + content;
    }
    // center alignment
    const leftCount = Math.floor(padCount / 2);
    const rightCount = padCount - leftCount;
    return (
      padChar.repeat(leftCount) +
      content +
      padChar.repeat(rightCount) +
      " ".repeat(remainder)
    );
  }

  // Current width is strictly greater than target width -> safely truncate
  let accumulatedWidth = 0;
  let truncated = "";
  for (const char of content) {
    const w = getCharWidth(char);
    if (accumulatedWidth + w > targetWidth) {
      break;
    }
    accumulatedWidth += w;
    truncated += char;
  }

  // Pad any remaining odd columns (e.g. if a wide char was skipped)
  const remainingDeficit = targetWidth - accumulatedWidth;
  if (remainingDeficit > 0) {
    truncated += " ".repeat(remainingDeficit);
  }

  return truncated;
}

/**
 * Creates a reusable fixed-width slot formatter for high-frequency frame updates.
 */
export function createFixedSlotFormatter(
  targetWidth: number,
  align: SlotAlignment = "left",
  padChar: string = " "
): (content: string) => string {
  return (content: string) => reserveSlot(content, targetWidth, align, padChar);
}

/**
 * Asserts whether a string's rendered terminal width matches the expected width.
 */
export function assertSlotWidth(content: string, expectedWidth: number): boolean {
  return getStringWidth(content) === expectedWidth;
}
