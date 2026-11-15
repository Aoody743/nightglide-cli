import React, { useState, useEffect, useCallback, Component, type ReactNode } from "react";
import { getThemeManager, type Theme, type UIMetaphor } from "@nightglide/themes";
import type { AgentEngine } from "@nightglide/core";
import { loadConfig, saveConfig, type InteractionMode } from "@nightglide/config";
import { useKeyboard } from "@opentui/react";
import { Header, type ScreenId } from "./components/Header.js";
import { StatusBar } from "./components/StatusBar.js";
import { ThemeSelector } from "./components/ThemeSelector.js";
import { WelcomeScreen } from "./screens/WelcomeScreen.js";
import { SetupScreen } from "./screens/SetupScreen.js";
import { ChatScreen } from "./screens/ChatScreen.js";
import { ModelAssignmentView } from "./screens/ModelAssignmentView.js";
import { useResponsiveTerminalDimensions, type TerminalDimensions } from "./dimensions.js";

export interface AppProps {
  initialScreen?: ScreenId;
  engine?: AgentEngine;
  onExit?: () => void;
  workspacePath?: string;
  dimensions?: { width: number; height: number };
  initialInteractionMode?: InteractionMode;
  initialMetaphor?: UIMetaphor;
  metaphor?: UIMetaphor;
}

/**
 * Terminal Error Boundary to catch render anomalies and ensure graceful teardown.
 */
export class TerminalErrorBoundary extends Component<
  { children: ReactNode; theme: Theme; onExit?: () => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; theme: Theme; onExit?: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // Retain error state cleanly without hard unmanaged crash
  }

  render() {
    if (this.state.hasError) {
      return (
        <box
          flexDirection="column"
          paddingX={2}
          paddingY={1}
          backgroundColor={this.props.theme.colors.background}
          borderColor={this.props.theme.colors.error}
          borderStyle="single"
          width="100%"
          height="100%"
        >
          <text fg={this.props.theme.colors.error}>
            ✖ [TUI Anomaly] An unexpected terminal rendering error occurred:
          </text>
          <text fg={this.props.theme.colors.textPrimary}>
            {this.state.error?.message || "Unknown rendering exception"}
          </text>
          <text fg={this.props.theme.colors.textMuted}>
            Press [Ctrl+C] to restore terminal mode and exit safely.
          </text>
        </box>
      );
    }
    return this.props.children;
  }
}

export function App({
  initialScreen = "welcome",
  engine,
  onExit,
  workspacePath = process.cwd(),
  dimensions: overrideDimensions,
  initialInteractionMode,
  initialMetaphor,
  metaphor: propMetaphor,
}: AppProps) {
  const themeManager = getThemeManager();
  const [theme, setTheme] = useState<Theme>(() => themeManager.getActiveTheme());
  const [activeScreen, setActiveScreen] = useState<ScreenId>(initialScreen);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(
    initialInteractionMode ?? "guided"
  );
  const [metaphor, setMetaphor] = useState<UIMetaphor>(
    () => propMetaphor ?? initialMetaphor ?? theme.metaphor ?? "flight-deck"
  );

  // Responsive dimensions with fallback for 80x24, 100x30, 120x36
  const dimensions: TerminalDimensions = useResponsiveTerminalDimensions(overrideDimensions);

  // Load configured interaction mode on mount if not explicitly supplied
  useEffect(() => {
    if (!initialInteractionMode) {
      loadConfig()
        .then((cfg) => {
          if (cfg.interactionMode) {
            setInteractionMode(cfg.interactionMode);
          }
        })
        .catch(() => {});
    }
  }, [initialInteractionMode]);

  // Subscribe to global theme changes and sync metaphor
  useEffect(() => {
    const unsubscribe = themeManager.subscribe((updatedTheme) => {
      setTheme(updatedTheme);
      if (updatedTheme.metaphor) {
        setMetaphor(updatedTheme.metaphor);
      }
    });
    return unsubscribe;
  }, [themeManager]);

  const handleSelectTheme = useCallback(
    (themeId: string) => {
      themeManager.setTheme(themeId);
    },
    [themeManager]
  );

  const handleExit = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      process.exit(0);
    }
  }, [onExit]);

  const handleToggleMetaphor = useCallback(() => {
    setMetaphor((prev) => (prev === "flight-deck" ? "abyss-dive" : "flight-deck"));
  }, []);

  const handleToggleInteractionMode = useCallback(() => {
    setInteractionMode((prev) => {
      const nextMode: InteractionMode = prev === "guided" ? "expert" : "guided";
      loadConfig()
        .then((cfg) => {
          saveConfig({ ...cfg, interactionMode: nextMode }).catch(() => {});
        })
        .catch(() => {});
      return nextMode;
    });
  }, []);

  const handleSetInteractionMode = useCallback((mode: InteractionMode) => {
    setInteractionMode(mode);
    loadConfig()
      .then((cfg) => {
        saveConfig({ ...cfg, interactionMode: mode }).catch(() => {});
      })
      .catch(() => {});
  }, []);

  // Global keyboard shortcuts with strict focus isolation
  useKeyboard((key) => {
    // Universal safe exit with Ctrl+C or Ctrl+Q
    if (key.ctrl && (key.name === "c" || key.name === "q")) {
      handleExit();
      return;
    }

    // Universal Metaphor Toggle (Ctrl+U: Flight Deck <-> Abyss Dive)
    if (key.ctrl && (key.name === "u" || key.name === "U")) {
      handleToggleMetaphor();
      return;
    }

    // Universal Tab to toggle interaction mode (Guided <-> Expert)
    if (key.name === "tab") {
      handleToggleInteractionMode();
      return;
    }

    // In Chat screen: strictly guard single-letter typing (1-5, w, d, s, t, m, c, space, q)
    // NEVER allow single letters to trigger screen changes while user is in Composer!
    if (activeScreen === "chat") {
      if (key.ctrl && key.name === "1") {
        setActiveScreen("welcome");
      } else if (key.ctrl && key.name === "3") {
        setActiveScreen("setup");
      } else if (key.ctrl && key.name === "4") {
        setActiveScreen("themes");
      } else if (key.ctrl && key.name === "5") {
        setActiveScreen("models");
      } else if (key.name === "f1") {
        setActiveScreen("welcome");
      } else if (key.name === "f2") {
        setActiveScreen("chat");
      } else if (key.name === "f3") {
        setActiveScreen("setup");
      } else if (key.name === "f4") {
        setActiveScreen("themes");
      } else if (key.name === "f5") {
        setActiveScreen("models");
      }
      return;
    }

    // In Themes screen: 1-4 selects theme; do not navigate away on 1-4
    if (activeScreen === "themes") {
      if (key.name === "escape") {
        setActiveScreen("welcome");
      } else if (key.ctrl && key.name === "1") {
        setActiveScreen("welcome");
      } else if (key.ctrl && key.name === "2") {
        setActiveScreen("chat");
      } else if (key.ctrl && key.name === "3") {
        setActiveScreen("setup");
      } else if (key.ctrl && key.name === "5") {
        setActiveScreen("models");
      } else if (key.name === "q" && !key.ctrl) {
        handleExit();
      }
      return;
    }

    // In Models screen: space cycles mode, enter cycles model, c toggles cloud; esc returns
    if (activeScreen === "models") {
      if (key.name === "escape") {
        setActiveScreen("chat");
      } else if (key.ctrl && key.name === "1") {
        setActiveScreen("welcome");
      } else if (key.ctrl && key.name === "2") {
        setActiveScreen("chat");
      } else if (key.ctrl && key.name === "3") {
        setActiveScreen("setup");
      } else if (key.ctrl && key.name === "4") {
        setActiveScreen("themes");
      } else if (key.name === "q" && !key.ctrl) {
        handleExit();
      }
      return;
    }

    // In Welcome and Setup screens: single-key navigation is active
    if (activeScreen === "welcome" || activeScreen === "setup") {
      if (key.name === "1" || key.name === "w") {
        setActiveScreen("welcome");
      } else if (key.name === "2" || key.name === "d") {
        setActiveScreen("chat");
      } else if (key.name === "3" || key.name === "s") {
        setActiveScreen("setup");
      } else if (key.name === "4" || key.name === "t") {
        setActiveScreen("themes");
      } else if (key.name === "5" || key.name === "m") {
        setActiveScreen("models");
      } else if (key.name === "q") {
        handleExit();
      }
    }
  });

  return (
    <TerminalErrorBoundary theme={theme} onExit={handleExit}>
      <box
        flexDirection="column"
        width="100%"
        height="100%"
        backgroundColor={theme.colors.background}
      >
        {/* Celestial or Abyss Header */}
        <Header
          activeScreen={activeScreen}
          theme={theme}
          model="qwen2.5-coder:7b"
          isMock={engine?.isMock ?? false}
          dimensions={dimensions}
          metaphor={metaphor}
        />

        {/* Main View Area */}
        <box flexGrow={1} width="100%">
          {activeScreen === "welcome" && (
            <WelcomeScreen
              theme={theme}
              onNavigate={setActiveScreen}
              workspacePath={workspacePath}
              model="qwen2.5-coder:7b"
              isMock={engine?.isMock ?? false}
              dimensions={dimensions}
            />
          )}

          {activeScreen === "chat" && (
            <ChatScreen
              theme={theme}
              engine={engine}
              onNavigate={setActiveScreen}
              dimensions={dimensions}
              interactionMode={interactionMode}
              onToggleInteractionMode={handleToggleInteractionMode}
              onSetInteractionMode={handleSetInteractionMode}
              workspacePath={workspacePath}
            />
          )}

          {activeScreen === "setup" && (
            <SetupScreen
              theme={theme}
              onNavigate={setActiveScreen}
            />
          )}

          {activeScreen === "themes" && (
            <ThemeSelector
              theme={theme}
              onSelectTheme={handleSelectTheme}
              onClose={() => setActiveScreen("welcome")}
            />
          )}

          {activeScreen === "models" && (
            <ModelAssignmentView
              theme={theme}
              onNavigate={setActiveScreen}
              dimensions={dimensions}
            />
          )}
        </box>

        {/* Bottom Status Bar */}
        <StatusBar
          theme={theme}
          workspacePath={workspacePath}
          activeScreen={activeScreen}
          dimensions={dimensions}
          interactionMode={interactionMode}
        />
      </box>
    </TerminalErrorBoundary>
  );
}

export default App;
