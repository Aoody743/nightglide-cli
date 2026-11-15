import { loadConfig } from "@nightglide/config";
import { getThemeManager } from "@nightglide/themes";
import { MockAgentEngine, OmpAgentEngine } from "@nightglide/engine";
import type { AgentEngine } from "@nightglide/core";

export interface ChatCommandOptions {
  engineType?: "omp" | "mock";
  initialScreen?: "welcome" | "chat" | "setup" | "themes";
  nonInteractive?: boolean;
}

export async function runChatCommand(options: ChatCommandOptions = {}): Promise<void> {
  const config = await loadConfig();
  const themeManager = getThemeManager();
  themeManager.setTheme(config.theme);

  let engine: AgentEngine;
  if (options.engineType === "omp") {
    engine = new OmpAgentEngine({
      baseUrl: config.providers.local?.baseUrl,
      model: config.model,
    });
  } else {
    // Default to Mock Engine in M0 if model not explicitly configured
    const isModelConfigured = Boolean(config.model && config.model.trim().length > 0);
    if (isModelConfigured) {
      engine = new OmpAgentEngine({
        baseUrl: config.providers.local?.baseUrl,
        model: config.model,
      });
    } else {
      engine = new MockAgentEngine();
    }
  }

  if (options.nonInteractive || !process.stdin.isTTY) {
    console.log("=== NIGHTGLIDE CLI (Non-Interactive Mode) ===");
    console.log(`Active Engine: ${engine.id} (isMock: ${engine.isMock})`);
    console.log(`Active Theme: ${themeManager.getActiveTheme().name}`);
    console.log("Terminal is non-interactive. Use interactive terminal to launch OpenTUI.");
    return;
  }

  // Interactive OpenTUI mode
  try {
    const { createCliRenderer } = await import("@opentui/core");
    const { createRoot } = await import("@opentui/react");
    const { App } = await import("../ui/App.js");
    const React = await import("react");

    const renderer = await createCliRenderer();
    const root = createRoot(renderer);

    const onExit = async () => {
      try {
        renderer.destroy();
      } catch {
        // Safe exit
      }
      process.exit(0);
    };

    process.once("SIGINT", onExit);
    process.once("SIGTERM", onExit);

    root.render(
      React.createElement(App, {
        initialScreen: options.initialScreen || "welcome",
        engine,
        onExit,
      })
    );
  } catch (err) {
    console.error("Failed to initialize OpenTUI terminal interface:", err);
    process.exit(1);
  }
}
