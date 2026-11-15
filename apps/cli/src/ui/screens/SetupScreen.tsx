import React from "react";
import type { Theme } from "@nightglide/themes";
import type { ScreenId } from "../components/Header.js";
import type { ProviderAuthType } from "@nightglide/providers";

export interface SetupScreenProps {
  theme: Theme;
  onNavigate: (screen: ScreenId) => void;
  authStatuses?: Record<string, ProviderAuthType>;
}

export function SetupScreen({ theme, onNavigate, authStatuses }: SetupScreenProps) {
  const statuses: Record<string, ProviderAuthType> = {
    "openai-codex": authStatuses?.["openai-codex"] ?? "unauthenticated",
    "github-copilot": authStatuses?.["github-copilot"] ?? "unauthenticated",
    anthropic:
      authStatuses?.anthropic ??
      (process.env.ANTHROPIC_API_KEY ? "custom_api_key" : "unauthenticated"),
    openai:
      authStatuses?.openai ??
      (process.env.OPENAI_API_KEY ? "custom_api_key" : "unauthenticated"),
    deepseek:
      authStatuses?.deepseek ??
      (process.env.DEEPSEEK_API_KEY ? "custom_api_key" : "unauthenticated"),
    siliconflow:
      authStatuses?.siliconflow ??
      (process.env.SILICONFLOW_API_KEY ? "custom_api_key" : "unauthenticated"),
    omlx: authStatuses?.omlx ?? "unauthenticated",
  };

  const renderBadge = (type: ProviderAuthType | "local_zero_cost") => {
    if (type === "official_subscription") {
      return (
        <box
          paddingX={1}
          backgroundColor={theme.colors.surfaceElevated}
          borderColor={theme.colors.success}
          borderStyle="single"
        >
          <text fg={theme.colors.success}>● SUBSCRIPTION ACTIVE</text>
        </box>
      );
    }
    if (type === "custom_api_key") {
      return (
        <box
          paddingX={1}
          backgroundColor={theme.colors.surfaceElevated}
          borderColor={theme.colors.accent}
          borderStyle="single"
        >
          <text fg={theme.colors.accent}>● API KEY CONFIGURED</text>
        </box>
      );
    }
    if (type === "local_zero_cost") {
      return (
        <box
          paddingX={1}
          backgroundColor={theme.colors.surfaceElevated}
          borderColor={theme.colors.accentSecondary}
          borderStyle="single"
        >
          <text fg={theme.colors.accentSecondary}>● LOCAL (ZERO-COST)</text>
        </box>
      );
    }
    return (
      <box
        paddingX={1}
        backgroundColor={theme.colors.surfaceElevated}
        borderColor={theme.colors.border}
        borderStyle="single"
      >
        <text fg={theme.colors.textMuted}>○ NOT AUTHENTICATED</text>
      </box>
    );
  };

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
      {/* Title Header */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        paddingBottom={1}
        borderColor={theme.colors.border}
      >
        <box flexDirection="column">
          <text fg={theme.colors.accent}>
            ✦ NIGHTGLIDE DUAL AUTHENTICATION & CREDENTIAL CONFIGURATION
          </text>
          <text fg={theme.colors.textMuted}>
            Select between Official Subscription Login and Custom API Key Provider methods.
          </text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.colors.accent}>[2] Open Chat</text>
          <text fg={theme.colors.border}>·</text>
          <text fg={theme.colors.textSecondary}>[1] Welcome</text>
        </box>
      </box>

      {/* Dual Authentication Choices: Two Column Grid */}
      <box flexDirection="row" gap={2} width="100%">
        {/* Choice 1: Official Subscription Login */}
        <box
          flexDirection="column"
          flexGrow={1}
          backgroundColor={theme.colors.surface}
          borderColor={theme.colors.success}
          borderStyle="single"
          paddingX={2}
          paddingY={1}
          gap={1}
        >
          <text fg={theme.colors.success}>
            [1] 官方订阅登录 / Official Subscription Login
          </text>
          <text fg={theme.colors.textSecondary}>
            Use your active consumer/pro subscriptions without extra per-token API charges.
          </text>

          {/* Subscription Provider 1: Codex */}
          <box
            flexDirection="column"
            paddingX={1}
            paddingY={1}
            backgroundColor={theme.colors.surfaceElevated}
            borderColor={theme.colors.border}
            gap={1}
          >
            <box flexDirection="row" justifyContent="space-between" alignItems="center">
              <text fg={theme.colors.textPrimary}>• OpenAI Codex (ChatGPT Plus / Pro)</text>
              {renderBadge(statuses["openai-codex"] ?? "unauthenticated")}
            </box>
            <text fg={theme.colors.textMuted}>
              Login: "nightglide login codex" (OAuth browser verification)
            </text>
          </box>

          {/* Subscription Provider 2: GitHub Copilot */}
          <box
            flexDirection="column"
            paddingX={1}
            paddingY={1}
            backgroundColor={theme.colors.surfaceElevated}
            borderColor={theme.colors.border}
            gap={1}
          >
            <box flexDirection="row" justifyContent="space-between" alignItems="center">
              <text fg={theme.colors.textPrimary}>• GitHub Copilot</text>
              {renderBadge(statuses["github-copilot"] ?? "unauthenticated")}
            </box>
            <text fg={theme.colors.textMuted}>
              Login: "nightglide login copilot" (GitHub device authorization)
            </text>
          </box>

          {/* Subscription Provider 3: Claude CLI Token */}
          <box
            flexDirection="column"
            paddingX={1}
            paddingY={1}
            backgroundColor={theme.colors.surfaceElevated}
            borderColor={theme.colors.border}
            gap={1}
          >
            <box flexDirection="row" justifyContent="space-between" alignItems="center">
              <text fg={theme.colors.textPrimary}>• Claude CLI Token / Anthropic Subscription</text>
              {renderBadge(
                statuses.anthropic === "official_subscription"
                  ? "official_subscription"
                  : "unauthenticated"
              )}
            </box>
            <text fg={theme.colors.textMuted}>
              Login: "nightglide login claude" (Anthropic token adoption)
            </text>
          </box>
        </box>

        {/* Choice 2: Custom API Key Provider */}
        <box
          flexDirection="column"
          flexGrow={1}
          backgroundColor={theme.colors.surface}
          borderColor={theme.colors.accent}
          borderStyle="single"
          paddingX={2}
          paddingY={1}
          gap={1}
        >
          <text fg={theme.colors.accent}>
            [2] 第三方 API Key / Custom Provider
          </text>
          <text fg={theme.colors.textSecondary}>
            Bring your own API key for frontier cloud models or connect zero-cost local LLMs.
          </text>

          {/* Custom Provider 1: OpenAI */}
          <box
            flexDirection="column"
            paddingX={1}
            paddingY={1}
            backgroundColor={theme.colors.surfaceElevated}
            borderColor={theme.colors.border}
            gap={1}
          >
            <box flexDirection="row" justifyContent="space-between" alignItems="center">
              <text fg={theme.colors.textPrimary}>• OpenAI (GPT-4o, o3-mini)</text>
              {renderBadge(
                statuses.openai === "custom_api_key" ? "custom_api_key" : "unauthenticated"
              )}
            </box>
            <text fg={theme.colors.textMuted}>
              Key: "nightglide login openai --key sk-..." or export OPENAI_API_KEY
            </text>
          </box>

          {/* Custom Provider 2: DeepSeek & SiliconFlow */}
          <box
            flexDirection="column"
            paddingX={1}
            paddingY={1}
            backgroundColor={theme.colors.surfaceElevated}
            borderColor={theme.colors.border}
            gap={1}
          >
            <box flexDirection="row" justifyContent="space-between" alignItems="center">
              <text fg={theme.colors.textPrimary}>• DeepSeek & SiliconFlow (V3 / R1)</text>
              {renderBadge(
                statuses.deepseek === "custom_api_key" ||
                  statuses.siliconflow === "custom_api_key"
                  ? "custom_api_key"
                  : "unauthenticated"
              )}
            </box>
            <text fg={theme.colors.textMuted}>
              Key: export DEEPSEEK_API_KEY="..." / SILICONFLOW_API_KEY="..."
            </text>
          </box>

          {/* Custom Provider 3: Local oMLX / Ollama */}
          <box
            flexDirection="column"
            paddingX={1}
            paddingY={1}
            backgroundColor={theme.colors.surfaceElevated}
            borderColor={theme.colors.border}
            gap={1}
          >
            <box flexDirection="row" justifyContent="space-between" alignItems="center">
              <text fg={theme.colors.textPrimary}>• Local oMLX & Ollama (Apple Silicon)</text>
              {renderBadge("local_zero_cost")}
            </box>
            <text fg={theme.colors.textMuted}>
              Zero-cost & 100% private. Runs offline on Mac (http://localhost:11434).
            </text>
          </box>
        </box>
      </box>

      {/* Safe Credentials & Navigation Footer */}
      <box
        flexDirection="column"
        backgroundColor={theme.colors.surface}
        borderColor={theme.colors.border}
        borderStyle="single"
        paddingX={2}
        paddingY={1}
        gap={1}
      >
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <text fg={theme.colors.warning}>
            🔒 SAFE CREDENTIAL MANAGEMENT & CLI COMMANDS
          </text>
          <text fg={theme.colors.textMuted}>
            Strict file permissions (0600) at ~/.nightglide/config.json
          </text>
        </box>
        <text fg={theme.colors.textSecondary}>
          CLI Commands: "nightglide login &lt;provider&gt;" · "nightglide providers" · "nightglide doctor"
        </text>
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <text fg={theme.colors.textMuted}>
            Switch providers and models anytime without vendor lock-in.
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
