import { describe, test, expect, beforeEach } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { ProviderRegistry } from "@nightglide/providers";
import { WorkloadModelRouter, classifyTask } from "@nightglide/routing";
import {
  OmpAgentEngine,
  MockAgentEngine,
  LOCAL_COPILOT_DELEGATION_DIRECTIVE,
} from "@nightglide/engine";
import {
  CloudAuthorizationRequiredError,
  ProviderUnavailableError,
} from "@nightglide/core";
import type { RoutingConfig } from "@nightglide/config";

describe("Routing & Local Co-Pilot Delegation", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();

    // Local provider (e.g. oMLX / Endless) with fast coding model
    registry.register("omlx", {
      type: "openai-compatible",
      baseUrl: "http://127.0.0.1:8000/v1",
      displayName: "oMLX Local On-Device",
    });
    registry.registerModel("omlx", "qwen2.5-coder-7b", {
      name: "Qwen 2.5 Coder 7B",
      capabilities: ["coding", "fast", "tool_call"],
    });

    // Cloud provider (e.g. OpenAI / Cloud Lead Model) with high reasoning & planning capabilities
    registry.register("openai", {
      type: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      displayName: "OpenAI Cloud Lead",
      apiKeyEnv: "OPENAI_API_KEY",
    });
    registry.registerModel("openai", "gpt-4o", {
      name: "GPT-4o",
      capabilities: ["planning", "reasoning", "coding"],
    });
  });

  describe("Tiered Balanced Mode Routing", () => {
    test("routes heavy complex tasks to Cloud model when cloud is authorized", () => {
      const config: RoutingConfig = {
        mode: "BALANCED",
        allowCloud: true,
        roleAssignments: {},
      };
      const router = new WorkloadModelRouter(registry, config);

      // 1. Multi-file refactoring
      const refactorDecision = router.routeTask({
        prompt: "perform a multi-file refactoring of user auth across controllers and models",
      });
      expect(refactorDecision.locality).toBe("remote");
      expect(refactorDecision.providerId).toBe("openai");
      expect(refactorDecision.modelId).toBe("openai/gpt-4o");
      expect(refactorDecision.requiresCloud).toBe(true);
      expect(refactorDecision.reason).toContain("routed to Cloud for heavy architectural reasoning");

      // 2. Architectural planning (category: plan)
      const planDecision = router.routeTask({
        prompt: "create an architectural plan and blueprint for the new database layer",
      });
      expect(planDecision.taskCategory).toBe("plan");
      expect(planDecision.locality).toBe("remote");
      expect(planDecision.providerId).toBe("openai");
      expect(planDecision.requiresCloud).toBe(true);
      expect(planDecision.reason).toContain("routed to Cloud for heavy architectural reasoning");

      // 3. Comprehensive code review (category: review)
      const reviewDecision = router.routeTask({
        prompt: "review and audit this pull request diff for critical security flaws and performance leaks",
      });
      expect(reviewDecision.taskCategory).toBe("review");
      expect(reviewDecision.locality).toBe("remote");
      expect(reviewDecision.providerId).toBe("openai");
      expect(reviewDecision.requiresCloud).toBe(true);
      expect(reviewDecision.reason).toContain("routed to Cloud for heavy architectural reasoning");

      // 4. Complex context heuristics (isComplex: true via high files count)
      const complexContextDecision = router.routeTask({
        prompt: "update function signatures across all files",
        filesCount: 20,
      });
      expect(complexContextDecision.locality).toBe("remote");
      expect(complexContextDecision.requiresCloud).toBe(true);
      expect(complexContextDecision.reason).toContain("routed to Cloud for heavy architectural reasoning");
    });

    test("allows routine and lightweight tasks on Local model without artificial blocks", () => {
      const config: RoutingConfig = {
        mode: "BALANCED",
        allowCloud: true,
        roleAssignments: {},
      };
      const router = new WorkloadModelRouter(registry, config);

      // 1. Daily chat and conversational interactions
      const chatDecision = router.routeTask({
        prompt: "hello! how can you assist me today?",
      });
      expect(chatDecision.taskCategory).toBe("explain");
      expect(chatDecision.locality).toBe("local");
      expect(chatDecision.providerId).toBe("omlx");
      expect(chatDecision.modelId).toBe("omlx/qwen2.5-coder-7b");
      expect(chatDecision.requiresCloud).toBe(false);
      expect(chatDecision.estimatedCost).toBe("Free (Local)");
      expect(chatDecision.reason).toContain("kept on Local for fast zero-cost execution");

      // 2. Small localized edits (small diffs)
      const smallEditDecision = router.routeTask({
        prompt: "small edit to fix the typo in README.md",
      });
      expect(smallEditDecision.locality).toBe("local");
      expect(smallEditDecision.providerId).toBe("omlx");
      expect(smallEditDecision.modelId).toBe("omlx/qwen2.5-coder-7b");
      expect(smallEditDecision.requiresCloud).toBe(false);
      expect(smallEditDecision.estimatedCost).toBe("Free (Local)");
      expect(smallEditDecision.reason).toContain("kept on Local for fast zero-cost execution");

      // 3. Quick localized fix / patch
      const quickFixDecision = router.routeTask({
        prompt: "quick fix for the off-by-one error in pagination helper",
      });
      expect(quickFixDecision.locality).toBe("local");
      expect(quickFixDecision.requiresCloud).toBe(false);
      expect(quickFixDecision.reason).toContain("kept on Local for fast zero-cost execution");

      // 4. Code explanation
      const explainDecision = router.routeTask({
        prompt: "explain how the router resolves fallback chains",
      });
      expect(explainDecision.taskCategory).toBe("explain");
      expect(explainDecision.locality).toBe("local");
      expect(explainDecision.requiresCloud).toBe(false);
      expect(explainDecision.reason).toContain("kept on Local for fast zero-cost execution");

      // 5. Local repository exploration
      const exploreDecision = router.routeTask({
        prompt: "find all occurrences of createAgentSession in packages/engine",
      });
      expect(exploreDecision.taskCategory).toBe("explore");
      expect(exploreDecision.locality).toBe("local");
      expect(exploreDecision.requiresCloud).toBe(false);
      expect(exploreDecision.reason).toContain("kept on Local for fast zero-cost execution");
    });

    test("does NOT strictly ban local models from small edits even with minimal capabilities", () => {
      // Local model with only ["fast", "tool_call"], no "coding" or "reasoning"
      const restrictedRegistry = new ProviderRegistry();
      restrictedRegistry.register("local_small", {
        type: "openai-compatible",
        baseUrl: "http://127.0.0.1:8000/v1",
      });
      restrictedRegistry.registerModel("local_small", "tiny-model", {
        capabilities: ["fast", "tool_call"],
      });

      const config: RoutingConfig = {
        mode: "BALANCED",
        allowCloud: true,
        roleAssignments: {},
      };
      const router = new WorkloadModelRouter(restrictedRegistry, config);

      // Small edit should still route smoothly to local model without throwing capability errors
      const decision = router.routeTask({
        prompt: "minor edit to update version string in package.json",
      });
      expect(decision.locality).toBe("local");
      expect(decision.modelId).toBe("local_small/tiny-model");
      expect(decision.requiresCloud).toBe(false);
      expect(decision.reason).toContain("kept on Local for fast zero-cost execution");
    });
  });

  describe("Mode Fallback & Cloud Authorization Checks", () => {
    test("BALANCED mode keeps heavy complex tasks on Local model when cloud is unauthorized", () => {
      const config: RoutingConfig = {
        mode: "BALANCED",
        allowCloud: false, // Unauthorized!
        roleAssignments: {},
      };
      const router = new WorkloadModelRouter(registry, config);

      const decision = router.routeTask({
        prompt: "create an architectural plan and multi-file refactoring strategy",
      });

      expect(decision.locality).toBe("local");
      expect(decision.modelId).toBe("omlx/qwen2.5-coder-7b");
      expect(decision.requiresCloud).toBe(false);
      expect(decision.reason).toContain("kept on Local for fast zero-cost execution");
      expect(decision.reason).toContain("cloud access is not authorized ('allowCloud: false')");
      // Fallback chain must not leak unauthorized cloud models
      expect(decision.fallbackChain.every((id) => !id.startsWith("openai/"))).toBe(true);
    });

    test("BALANCED mode falls back to authorized cloud model when no local models are available", () => {
      const cloudOnlyRegistry = new ProviderRegistry();
      cloudOnlyRegistry.register("openai", {
        type: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
      });
      cloudOnlyRegistry.registerModel("openai", "gpt-4o", {
        capabilities: ["reasoning", "coding"],
      });
      cloudOnlyRegistry.registerModel("openai", "gpt-4o-mini", {
        capabilities: ["fast", "coding"],
      });

      const config: RoutingConfig = {
        mode: "BALANCED",
        allowCloud: true,
        roleAssignments: {},
      };
      const router = new WorkloadModelRouter(cloudOnlyRegistry, config);

      const decision = router.routeTask({
        prompt: "explain how to configure providers",
      });

      expect(decision.locality).toBe("remote");
      expect(decision.modelId).toBe("openai/gpt-4o");
      expect(decision.requiresCloud).toBe(true);
      expect(decision.reason).toContain("No local models available; falling back to authorized cloud model");
      expect(decision.fallbackChain).toContain("openai/gpt-4o-mini");
    });

    test("BALANCED mode throws CloudAuthorizationRequiredError when no local models and cloud unauthorized", () => {
      const cloudOnlyRegistry = new ProviderRegistry();
      cloudOnlyRegistry.register("openai", {
        type: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
      });
      cloudOnlyRegistry.registerModel("openai", "gpt-4o");

      const config: RoutingConfig = {
        mode: "BALANCED",
        allowCloud: false,
        roleAssignments: {},
      };
      const router = new WorkloadModelRouter(cloudOnlyRegistry, config);

      expect(() => {
        router.routeTask({ prompt: "explain this function" });
      }).toThrow(CloudAuthorizationRequiredError);
    });

    test("throws ProviderUnavailableError when no models are available", () => {
      const emptyRegistry = new ProviderRegistry();
      emptyRegistry.register("openai", {
        type: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
      }); // No models registered

      const config: RoutingConfig = {
        mode: "BALANCED",
        allowCloud: true,
        roleAssignments: {},
      };
      const router = new WorkloadModelRouter(emptyRegistry, config);

      expect(() => {
        router.routeTask({ prompt: "hello" });
      }).toThrow();
    });

    test("LOCAL mode strictly forbids cloud routing even for heavy planning tasks", () => {
      const config: RoutingConfig = {
        mode: "LOCAL",
        allowCloud: true, // Even if true, LOCAL mode strictly enforces local
        roleAssignments: {},
      };
      const router = new WorkloadModelRouter(registry, config);

      const decision = router.routeTask({
        prompt: "design a massive multi-file architecture plan",
      });

      expect(decision.locality).toBe("local");
      expect(decision.providerId).toBe("omlx");
      expect(decision.requiresCloud).toBe(false);
      expect(decision.fallbackChain.every((id) => !id.startsWith("openai/"))).toBe(true);
    });
  });

  describe("Local Co-Pilot Delegation Directive in System Prompt", () => {
    let tempAgentDir: string;
    let tempWorkspace: string;

    beforeEach(async () => {
      tempAgentDir = await fs.mkdtemp(path.join(os.tmpdir(), "nightglide-delegation-agent-"));
      tempWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), "nightglide-delegation-work-"));
    });

    test("OmpAgentEngine injects Local Co-Pilot Delegation Directive into default system prompt", async () => {
      const engine = new OmpAgentEngine({
        defaultAgentDir: tempAgentDir,
      });

      const session = await engine.createSession({
        workspacePath: tempWorkspace,
        model: "openai/gpt-4o",
      });

      try {
        expect(session.systemPrompt).toBeDefined();
        const prompt = session.systemPrompt ?? "";

        // Verify key directive sections
        expect(prompt).toContain("## Multi-Model Architecture & Local Co-Pilot");
        expect(prompt).toContain("You are operating within Nightglide's tiered multi-model environment.");
        expect(prompt).toContain("An on-device Local Model (such as oMLX / Ollama / Endless) is running locally on the user's machine.");
        expect(prompt).toContain("- Local Model Boundaries: Excellent for fast conversational replies, local file exploration, and small, localized code edits without network latency.");
        expect(prompt).toContain("- Lead Model Responsibilities: You are responsible for complex multi-file architectural changes, deep algorithmic problem solving, critical security audits, and comprehensive test suite validation.");
        expect(prompt).toContain("- Delegation: For lightweight, targeted sub-tasks, you may delegate or reference local tool executions seamlessly.");
      } finally {
        await session.dispose();
      }
    });

    test("OmpAgentEngine cleanly appends directive to custom user system prompt without breaking it", async () => {
      const engine = new OmpAgentEngine({
        defaultAgentDir: tempAgentDir,
      });

      const customPrompt = "You are a senior TypeScript architect specialized in low-latency systems.";
      const session = await engine.createSession({
        workspacePath: tempWorkspace,
        model: "openai/gpt-4o",
        systemPrompt: customPrompt,
      });

      try {
        expect(session.systemPrompt).toBeDefined();
        const prompt = session.systemPrompt ?? "";

        // Custom prompt must be preserved at the top
        expect(prompt.startsWith(customPrompt)).toBe(true);

        // Delegation directive cleanly appended
        expect(prompt).toContain("## Multi-Model Architecture & Local Co-Pilot");
        expect(prompt).toContain("- Local Model Boundaries:");
        expect(prompt).toContain("- Lead Model Responsibilities:");
        expect(prompt).toContain("- Delegation:");
      } finally {
        await session.dispose();
      }
    });

    test("does not duplicate directive if custom user prompt already includes it", async () => {
      const engine = new OmpAgentEngine({
        defaultAgentDir: tempAgentDir,
      });

      const customPromptWithDirective = `Custom initial prompt.\n\n${LOCAL_COPILOT_DELEGATION_DIRECTIVE}`;
      const session = await engine.createSession({
        workspacePath: tempWorkspace,
        model: "openai/gpt-4o",
        systemPrompt: customPromptWithDirective,
      });

      try {
        const prompt = session.systemPrompt ?? "";
        // Occurrence count of the header should be exactly 1
        const occurrences = prompt.split("## Multi-Model Architecture & Local Co-Pilot").length - 1;
        expect(occurrences).toBe(1);
      } finally {
        await session.dispose();
      }
    });

    test("MockAgentEngine also reliably populates delegation directive", async () => {
      const mockEngine = new MockAgentEngine();
      const session = await mockEngine.createSession({
        workspacePath: tempWorkspace,
        systemPrompt: "Base instructions for mock session.",
      });

      try {
        expect(session.systemPrompt).toBeDefined();
        expect(session.systemPrompt).toContain("Base instructions for mock session.");
        expect(session.systemPrompt).toContain("## Multi-Model Architecture & Local Co-Pilot");
      } finally {
        await session.dispose();
      }
    });
  });
});
