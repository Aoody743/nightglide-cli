import { MockAgentEngine } from "@nightglide/engine";
import { getThemeManager } from "@nightglide/themes";
import { loadConfig } from "@nightglide/config";

/**
 * Launch Nightglide in Demonstration Mode.
 * Uses the deterministic MockAgentEngine without requiring API keys or network inference.
 */
export async function runDemoCommand(options: { nonInteractive?: boolean } = {}): Promise<void> {
  const config = await loadConfig();
  const themeManager = getThemeManager();
  themeManager.setTheme(config.theme);

  const mockEngine = new MockAgentEngine();

  if (options.nonInteractive || !process.stdin.isTTY) {
    console.log("=== NIGHTGLIDE DEMO (Non-Interactive Test Mode) ===");
    console.log("Initializing deterministic MockAgentEngine...");
    const session = await mockEngine.createSession({
      workspacePath: process.cwd(),
      readOnly: true,
    });

    session.subscribe((event) => {
      if (event.type === "status") {
        console.log(`[Demo Status] ${event.status}`);
      } else if (event.type === "tool_start") {
        console.log(`[Demo Tool] Start -> ${event.toolName}`);
      } else if (event.type === "text_delta") {
        process.stdout.write(event.delta);
      } else if (event.type === "done") {
        console.log("\n[Demo Done] Stream finished cleanly.");
      }
    });

    await session.sendMessage("Explore celestial architecture");
    await session.dispose();
    console.log("Demo session completed and disposed cleanly.");
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
        initialScreen: "chat",
        engine: mockEngine,
        onExit,
      })
    );
  } catch (err) {
    console.error("OpenTUI Renderer initialization failed:", err);
    process.exit(1);
  }
}
