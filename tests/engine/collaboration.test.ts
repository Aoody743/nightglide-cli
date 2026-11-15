import { describe, test, expect } from "bun:test";
import { MockAgentEngine, OmpAgentEngine } from "@nightglide/engine";
import { ProviderRegistry } from "@nightglide/providers";
import { WorkloadModelRouter } from "@nightglide/routing";
import type { AgentEvent } from "@nightglide/core";

describe("Cross-Provider Multi-Agent Collaboration", () => {
  test("deterministic local explore + cloud plan workflow completes end-to-end", async () => {
    // Set up provider registry with distinct local and cloud providers
    const registry = new ProviderRegistry();

    registry.register("omlx", {
      type: "openai-compatible",
      baseUrl: "http://127.0.0.1:8000/v1",
      displayName: "oMLX Local",
    });
    registry.registerModel("omlx", "qwen2.5-coder-7b", {
      name: "Qwen 2.5 Coder 7B",
      capabilities: ["fast", "coding", "tool_call"],
    });

    registry.register("openai", {
      type: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      displayName: "OpenAI Cloud",
      apiKeyEnv: "OPENAI_API_KEY",
    });
    registry.registerModel("openai", "gpt-4o", {
      name: "GPT-4o",
      capabilities: ["planning", "reasoning", "coding"],
    });

    // Workload-aware router selects models for roles
    const router = new WorkloadModelRouter(registry, {
      mode: "BALANCED",
      allowCloud: true,
      roleAssignments: {},
    });

    const exploreDecision = router.routeTask({
      prompt: "explore repository and find architecture files",
      explicitCategory: "explore",
    });
    expect(exploreDecision.locality).toBe("local");
    expect(exploreDecision.modelId).toBe("omlx/qwen2.5-coder-7b");

    const planDecision = router.routeTask({
      prompt: "design a refactoring plan based on explorer context",
      explicitCategory: "plan",
    });
    expect(planDecision.locality).toBe("remote");
    expect(planDecision.modelId).toBe("openai/gpt-4o");

    // Execute through deterministic collaborative mock session
    const mockEngine = new MockAgentEngine({ stepDelayMs: 2, forceMultiAgent: true });
    const session = await mockEngine.createSession({
      workspacePath: process.cwd(),
      routingMode: "BALANCED",
      allowCloud: true,
      roleModelOverrides: {
        explore: exploreDecision.modelId,
        plan: planDecision.modelId,
      },
    });

    const events: AgentEvent[] = [];
    session.subscribe((evt) => events.push(evt));

    await session.sendMessage("Analyze this codebase and suggest a safe refactoring plan.");

    // Verify event progression
    const routingEvt = events.find((e) => e.type === "routing_decision");
    expect(routingEvt).toBeDefined();

    const subagentStarts = events.filter((e) => e.type === "subagent_start");
    expect(subagentStarts.length).toBe(2);

    // Explorer subagent
    const explorerStart = subagentStarts.find(
      (e) => e.type === "subagent_start" && e.role === "explore"
    );
    expect(explorerStart).toBeDefined();
    if (explorerStart && explorerStart.type === "subagent_start") {
      expect(explorerStart.locality).toBe("local");
      expect(explorerStart.model).toBe("omlx/qwen2.5-coder-7b");
    }

    // Planner subagent
    const plannerStart = subagentStarts.find(
      (e) => e.type === "subagent_start" && e.role === "plan"
    );
    expect(plannerStart).toBeDefined();
    if (plannerStart && plannerStart.type === "subagent_start") {
      expect(plannerStart.locality).toBe("remote");
      expect(plannerStart.model).toBe("openai/gpt-4o");
    }

    const subagentDeltas = events.filter((e) => e.type === "subagent_delta");
    expect(subagentDeltas.length).toBeGreaterThanOrEqual(2);

    const subagentEnds = events.filter((e) => e.type === "subagent_end");
    expect(subagentEnds.length).toBe(2);

    const doneEvt = events.find((e) => e.type === "done");
    expect(doneEvt).toBeDefined();

    // Verify session state subagent tracking
    const state = session.getState();
    expect(state.activeSubagents?.length).toBe(2);
    expect(state.activeSubagents?.every((s) => s.status === "completed")).toBe(true);

    await session.dispose();
  });

  test("cancellation of collaborative workflow halts subagent pipeline cleanly", async () => {
    const mockEngine = new MockAgentEngine({ stepDelayMs: 30, forceMultiAgent: true });
    const session = await mockEngine.createSession({
      workspacePath: process.cwd(),
      routingMode: "BALANCED",
      allowCloud: true,
    });

    const events: AgentEvent[] = [];
    session.subscribe((evt) => events.push(evt));

    const p = session.sendMessage("Analyze and plan refactoring");
    // Cancel immediately after launch
    await new Promise((r) => setTimeout(r, 10));
    await session.cancel();
    await p;

    expect(session.getState().status).toBe("idle");
    await session.dispose();
  });

  test("opt-in real cross-provider execution test (skipped when providers unconfigured)", async () => {
    const hasRealCloudKey = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
    const hasRealLocalKey = Boolean(process.env.OMLX_API_KEY || process.env.LOCAL_AI_API_KEY);
    const runReal = Boolean(process.env.NIGHTGLIDE_REAL_PROVIDER_TEST) && hasRealCloudKey && hasRealLocalKey;

    if (!runReal) {
      console.log(
        "[INFO] Real cross-provider test SKIPPED: Requires NIGHTGLIDE_REAL_PROVIDER_TEST=1 and real active local & cloud credentials."
      );
      expect(true).toBe(true);
      return;
    }

    // When real credentials exist and user explicitly opted in:
    const realEngine = new OmpAgentEngine();
    const health = await realEngine.checkHealth();
    expect(health.ready).toBe(true);
  });
});
