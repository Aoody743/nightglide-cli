import React from "react";
import type { Theme } from "@nightglide/themes";
import type { ScreenId } from "../components/Header.js";

export interface SetupScreenProps {
  theme: Theme;
  onNavigate: (screen: ScreenId) => void;
}

export function SetupScreen({ theme, onNavigate }: SetupScreenProps) {
  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.colors.background}
      paddingX={3}
      paddingY={1}
      gap={1}
    >
      {/* Title */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        paddingBottom={1}
        borderColor={theme.colors.border}
      >
        <box flexDirection="column">
          <text fg={theme.colors.accent}>
            ✦ NIGHTGLIDE PROVIDER & CREDENTIAL CONFIGURATION
          </text>
          <text fg={theme.colors.textMuted}>
            Beginner-friendly guide to Local vs Cloud AI setups and safe credential management.
          </text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.colors.accent}>[2] Open Chat</text>
          <text fg={theme.colors.border}>·</text>
          <text fg={theme.colors.textSecondary}>[1] Welcome</text>
        </box>
      </box>

      {/* Two Column Grid: Local vs Cloud */}
      <box flexDirection="row" gap={2} width="100%">
        {/* Local Providers */}
        <box
          flexDirection="column"
          flexGrow={1}
          backgroundColor={theme.colors.surface}
          borderColor={theme.colors.accentSecondary}
          borderStyle="single"
          paddingX={2}
          paddingY={1}
          gap={1}
        >
          <text fg={theme.colors.accentSecondary}>
            ◈ 1. LOCAL INTELLIGENCE (Recommended / Zero-Cost)
          </text>
          <text fg={theme.colors.textPrimary}>
            Nightglide is designed as a first-class local AI coding agent on Apple Silicon.
          </text>
          <box flexDirection="column">
            <text fg={theme.colors.success}>✔ 100% Private:</text>
            <text fg={theme.colors.textSecondary}>
              Code never leaves your Mac. Fully offline capable.
            </text>
            <text fg={theme.colors.success}>✔ Zero API Costs:</text>
            <text fg={theme.colors.textSecondary}>
              No credit card or monthly subscription required.
            </text>
            <text fg={theme.colors.success}>✔ Supported Local Engines:</text>
            <text fg={theme.colors.textSecondary}>
              • Ollama (http://localhost:11434)
            </text>
            <text fg={theme.colors.textSecondary}>
              • oMLX (Apple Silicon MLX unified memory)
            </text>
            <text fg={theme.colors.textSecondary}>
              • Recommended: qwen2.5-coder:7b-instruct
            </text>
          </box>
        </box>

        {/* Cloud Providers */}
        <box
          flexDirection="column"
          flexGrow={1}
          backgroundColor={theme.colors.surface}
          borderColor={theme.colors.border}
          borderStyle="single"
          paddingX={2}
          paddingY={1}
          gap={1}
        >
          <text fg={theme.colors.accent}>
            ◈ 2. CLOUD INFERENCE PROVIDERS
          </text>
          <text fg={theme.colors.textPrimary}>
            For large-scale repository refactoring and maximum frontier reasoning:
          </text>
          <box flexDirection="column">
            <text fg={theme.colors.textSecondary}>
              • Anthropic Claude 3.5 Sonnet / Haiku
            </text>
            <text fg={theme.colors.textSecondary}>
              • OpenAI GPT-4o / GPT-4o-mini
            </text>
            <text fg={theme.colors.textSecondary}>
              • DeepSeek V3 / R1 (via OpenRouter or direct)
            </text>
            <text fg={theme.colors.textSecondary}>
              • Google Gemini 2.0 Flash / Pro
            </text>
          </box>
          <box
            paddingX={1}
            backgroundColor={theme.colors.surfaceElevated}
            borderColor={theme.colors.border}
          >
            <text fg={theme.colors.textMuted}>
              Tip: Switch between Local and Cloud in seconds with no vendor lock-in.
            </text>
          </box>
        </box>
      </box>

      {/* Safe Credentials & Diagnostics */}
      <box
        flexDirection="column"
        backgroundColor={theme.colors.surface}
        borderColor={theme.colors.border}
        borderStyle="single"
        paddingX={2}
        paddingY={1}
        gap={1}
      >
        <text fg={theme.colors.warning}>
          🔒 SAFE CREDENTIAL MANAGEMENT
        </text>
        <text fg={theme.colors.textSecondary}>
          Nightglide saves configuration to ~/.nightglide/config.json with strict file permissions (0600).
        </text>
        <text fg={theme.colors.textSecondary}>
          You can also set environment variables in your shell profile (.zshrc / .bashrc):
        </text>
        <box
          paddingX={1}
          backgroundColor={theme.colors.surfaceElevated}
          borderColor={theme.colors.border}
        >
          <text fg={theme.colors.accent}>
            export OPENAI_API_KEY="sk-..."  # or ANTHROPIC_API_KEY / DEEPSEEK_API_KEY
          </text>
        </box>
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <text fg={theme.colors.textMuted}>
            Run "nightglide doctor" in your terminal anytime to verify toolchains and providers.
          </text>
          <box flexDirection="row" gap={1}>
            <text fg={theme.colors.accent}>[1] Welcome</text>
            <text fg={theme.colors.accent}>[2] Launch Chat</text>
            <text fg={theme.colors.accent}>[4] Themes</text>
            <text fg={theme.colors.accent}>[5] Model Matrix</text>
          </box>
        </box>
      </box>
    </box>
  );
}
