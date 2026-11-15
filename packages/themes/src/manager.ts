import type { Theme } from "./tokens.js";
import { BUILTIN_THEMES, DEFAULT_THEME_ID, midnightFlightTheme } from "./themes.js";

export type ThemeChangeListener = (theme: Theme) => void;

export class ThemeManager {
  private activeTheme: Theme;
  private readonly themes: Map<string, Theme> = new Map();
  private readonly listeners: Set<ThemeChangeListener> = new Set();

  constructor(initialThemeId: string = DEFAULT_THEME_ID) {
    for (const theme of BUILTIN_THEMES) {
      this.themes.set(theme.id, theme);
    }
    this.activeTheme = this.themes.get(initialThemeId) ?? midnightFlightTheme;
  }

  getActiveTheme(): Theme {
    return this.activeTheme;
  }

  setTheme(themeId: string): boolean {
    const nextTheme = this.themes.get(themeId);
    if (!nextTheme) {
      return false;
    }
    if (this.activeTheme.id === nextTheme.id) {
      return true;
    }
    this.activeTheme = nextTheme;
    for (const listener of this.listeners) {
      try {
        listener(nextTheme);
      } catch {
        // Safe listener dispatch
      }
    }
    return true;
  }

  getTheme(themeId: string): Theme | undefined {
    return this.themes.get(themeId);
  }

  getAllThemes(): readonly Theme[] {
    return Array.from(this.themes.values());
  }

  registerTheme(theme: Theme): void {
    this.themes.set(theme.id, theme);
  }

  subscribe(listener: ThemeChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

let globalThemeManager: ThemeManager | null = null;

export function getThemeManager(): ThemeManager {
  if (!globalThemeManager) {
    globalThemeManager = new ThemeManager();
  }
  return globalThemeManager;
}
