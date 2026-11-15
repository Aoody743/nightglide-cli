/**
 * Semantic Theme Tokens for Nightglide Terminal UI.
 */

export interface ThemeColors {
  readonly background: string;
  readonly surface: string;
  readonly surfaceElevated: string;
  readonly border: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly accentSecondary: string;
  readonly success: string;
  readonly warning: string;
  readonly error: string;
  readonly info: string;
  readonly selection: string;
  readonly focus: string;
}

export type ThemeType = "dark" | "light";

export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly type: ThemeType;
  readonly description: string;
  readonly colors: ThemeColors;
}
