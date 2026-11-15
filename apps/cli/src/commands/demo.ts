import { MockAgentEngine } from "@nightglide/engine";
import { getThemeManager } from "@nightglide/themes";
import { loadConfig } from "@nightglide/config";

/**
 * Launch Nightglide in Demonstration Mode.
 * Demonstrates deterministic multi-agent collaboration (Local Explorer + Cloud Planner)
 * without requiring API keys or network inference.
 */
export async function runDemoCommand(options: { nonInteractive?: boolean } = {}): Promise<void> {
  const config = await loadConfig();
  const themeManager = getThemeManager();
  themeManager.setTheme(config.theme);

  const mockEngine = new MockAgentEngine({ forceMultiAgent: true });

  if (options.nonInteractive || !process.stdin.isTTY) {
    console.log("=== NIGHTGLIDE DEMO (Multi-Agent Collaboration Test Mode) ===");
    console.log("Initializing deterministic MockAgentEngine with Local Explorer & Cloud Planner...\n");
    const session = await mockEngine.createSession({
      workspacePath: process.cwd(),
      readOnly: true,
      routingMode: "BALANCED",
      allowCloud: true,
      roleModelOverrides: {
        explore: "omlx/qwen2.5-coder-7b",
        plan: "openai/gpt-4o",
      },
    });

    session.subscribe((event) => {
      if (event.type === "routing_decision") {
        console.log(`[Task Director Routing] ${event.decision.taskCategory.toUpperCase()} → ${event.decision.agentRole.toUpperCase()} (${event.decision.modelId} [${event.decision.locality.toUpperCase()}])`);
        console.log(`  Reason: ${event.decision.reason}`);
      } else if (event.type === "subagent_start") {
        console.log(`\n▶ [Subagent Start] Role: ${event.role.toUpperCase()} | Model: ${event.model} (${event.locality.toUpperCase()})`);
        console.log(`  Task: ${event.task}`);
      } else if (event.type === "subagent_delta") {
        console.log(`  ${event.delta}`);
      } else if (event.type === "subagent_end") {
        console.log(`✔ [Subagent End] ${event.result} (${event.totalTokens} tokens)\n`);
      } else if (event.type === "status") {
        console.log(`[Status] ${event.status}${event.message ? ` - ${event.message}` : ""}`);
      } else if (event.type === "text_delta") {
        process.stdout.write(event.delta);
      } else if (event.type === "done") {
        console.log("\n\n[Demo Done] Multi-agent collaboration demonstration finished cleanly.");
      }
    });

    await session.sendMessage("Analyze this codebase and suggest a safe refactoring plan.");
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
