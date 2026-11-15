import React, { useState, useEffect, useCallback } from "react";
import { getThemeManager, type Theme } from "@nightglide/themes";
import type { AgentEngine } from "@nightglide/core";
import { useKeyboard } from "@opentui/react";
import { Header, type ScreenId } from "./components/Header.js";
import { StatusBar } from "./components/StatusBar.js";
import { ThemeSelector } from "./components/ThemeSelector.js";
import { WelcomeScreen } from "./screens/WelcomeScreen.js";
import { SetupScreen } from "./screens/SetupScreen.js";
import { ChatScreen } from "./screens/ChatScreen.js";

export interface AppProps {
  initialScreen?: ScreenId;
  engine?: AgentEngine;
  onExit?: () => void;
  workspacePath?: string;
}

export function App({
  initialScreen = "welcome",
  engine,
  onExit,
  workspacePath = process.cwd(),
}: AppProps) {
  const themeManager = getThemeManager();
  const [theme, setTheme] = useState<Theme>(() => themeManager.getActiveTheme());
  const [activeScreen, setActiveScreen] = useState<ScreenId>(initialScreen);

  // Subscribe to global theme changes
  useEffect(() => {
    const unsubscribe = themeManager.subscribe((updatedTheme) => {
      setTheme(updatedTheme);
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

  // Global keyboard shortcuts
  useKeyboard((key) => {
    // Universal exit with Ctrl+C
    if (key.ctrl && (key.name === "c" || key.name === "q")) {
      handleExit();
      return;
    }

    // In non-chat screens, allow single-key navigation
    if (activeScreen !== "chat") {
      if (key.name === "1" || key.name === "w") {
        setActiveScreen("welcome");
      } else if (key.name === "2" || key.name === "d") {
        setActiveScreen("chat");
      } else if (key.name === "3" || key.name === "s") {
        setActiveScreen("setup");
      } else if (key.name === "4" || key.name === "t") {
        setActiveScreen("themes");
      } else if (key.name === "q") {
        handleExit();
      }
    } else {
      // In chat screen, allow navigation via Ctrl+number or F-keys
      if (key.ctrl && key.name === "1") {
        setActiveScreen("welcome");
      } else if (key.ctrl && key.name === "3") {
        setActiveScreen("setup");
      } else if (key.ctrl && key.name === "4") {
        setActiveScreen("themes");
      } else if (key.name === "f1") {
        setActiveScreen("welcome");
      } else if (key.name === "f2") {
        setActiveScreen("chat");
      } else if (key.name === "f3") {
        setActiveScreen("setup");
      } else if (key.name === "f4") {
        setActiveScreen("themes");
      }
    }
  });

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.colors.background}
    >
      {/* Celestial Header */}
      <Header
        activeScreen={activeScreen}
        theme={theme}
        model="qwen2.5-coder:7b"
        isMock={engine?.isMock ?? false}
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
          />
        )}

        {activeScreen === "chat" && (
          <ChatScreen
            theme={theme}
            engine={engine}
            onNavigate={setActiveScreen}
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
      </box>

      {/* Bottom Status Bar */}
      <StatusBar
        theme={theme}
        workspacePath={workspacePath}
        activeScreen={activeScreen}
      />
    </box>
  );
}

export default App;
