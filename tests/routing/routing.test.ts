import { describe, test, expect, beforeEach } from "bun:test";
import { ProviderRegistry } from "@nightglide/providers";
import { WorkloadModelRouter, classifyTask } from "@nightglide/routing";
import {
  CloudAuthorizationRequiredError,
  ModelNotConfiguredError,
  ProviderUnavailableError,
} from "@nightglide/core";
import type { RoutingConfig } from "@nightglide/config";

describe("Task Classifier", () => {
  test("classifies explore tasks accurately", () => {
    const res = classifyTask("find all instances of createAgentSession in the codebase");
    expect(res.category).toBe("explore");
    expect(res.confidence).toBeGreaterThanOrEqual(0.7);
  });

  test("classifies plan tasks accurately", () => {
    const res = classifyTask("create an architecture refactoring plan for our auth module");
    expect(res.category).toBe("plan");
    expect(res.isComplex).toBe(true);
  });

  test("classifies review tasks accurately", () => {
    const res = classifyTask("review the changes in pull request and inspect diff");
    expect(res.category).toBe("review");
  });

  test("classifies debug tasks accurately", () => {
    const res = classifyTask("debug why the agent is crashing with an uncaught exception");
    expect(res.category).toBe("debug");
  });

  test("classifies summarize tasks accurately", () => {
    const res = classifyTask("summarize the execution findings in a brief overview");
    expect(res.category).toBe("summarize");
  });

  test("classifies Chinese task prompts correctly", () => {
    const resPlan = classifyTask("为当前项目设计一套高并发重构方案和架构路线图");
    expect(resPlan.category).toBe("plan");
    expect(resPlan.isComplex).toBe(true);

    const resExplore = classifyTask("在代码库中搜索所有与数据库连接相关的工具函数");
    expect(resExplore.category).toBe("explore");

    const resReview = classifyTask("审查本次代码改动的安全性和潜在漏洞");
    expect(resReview.category).toBe("review");
  });
});

describe("WorkloadModelRouter", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();

    // Register a local provider with small coding model
    registry.register("omlx", {
      type: "openai-compatible",
      baseUrl: "http://127.0.0.1:8000/v1",
      displayName: "oMLX Local",
    });
    registry.registerModel("omlx", "qwen2.5-coder-7b", {
      name: "Qwen 2.5 Coder 7B",
      capabilities: ["coding", "fast", "tool_call"],
    });

    // Register a cloud provider with strong reasoning model
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
  });

  test("LOCAL mode selects local model for any task and never selects remote", () => {
    const config: RoutingConfig = {
      mode: "LOCAL",
      allowCloud: false,
      roleAssignments: {},
    };
    const router = new WorkloadModelRouter(registry, config);

    const decision = router.routeTask({
      prompt: "design a complex distributed architecture plan",
    });

    expect(decision.locality).toBe("local");
    expect(decision.providerId).toBe("omlx");
    expect(decision.modelId).toBe("omlx/qwen2.5-coder-7b");
    expect(decision.requiresCloud).toBe(false);
    expect(decision.fallbackChain.every((id) => !id.startsWith("openai/"))).toBe(true);
  });

  test("LOCAL mode throws ProviderUnavailableError when no local model exists", () => {
    const emptyLocalRegistry = new ProviderRegistry();
    emptyLocalRegistry.register("openai", {
      type: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
    });
    emptyLocalRegistry.registerModel("openai", "gpt-4o");

    const config: RoutingConfig = {
      mode: "LOCAL",
      allowCloud: true, // Even if true, LOCAL mode forbids cloud
      roleAssignments: {},
    };
    const router = new WorkloadModelRouter(emptyLocalRegistry, config);

    expect(() => {
      router.routeTask({ prompt: "explain this function" });
    }).toThrow(ProviderUnavailableError);
  });

  test("BALANCED mode keeps simple tasks on local model", () => {
    const config: RoutingConfig = {
      mode: "BALANCED",
      allowCloud: true,
      roleAssignments: {},
    };
    const router = new WorkloadModelRouter(registry, config);

    const decision = router.routeTask({
      prompt: "find the definition of UserModel in src/",
    });

    expect(decision.taskCategory).toBe("explore");
    expect(decision.locality).toBe("local");
    expect(decision.modelId).toBe("omlx/qwen2.5-coder-7b");
    expect(decision.requiresCloud).toBe(false);
  });

  test("BALANCED mode routes complex planning task to cloud model when authorized", () => {
    const config: RoutingConfig = {
      mode: "BALANCED",
      allowCloud: true,
      roleAssignments: {},
    };
    const router = new WorkloadModelRouter(registry, config);

    const decision = router.routeTask({
      prompt: "create a comprehensive architectural refactoring plan for all database connections",
    });

    expect(decision.taskCategory).toBe("plan");
    expect(decision.locality).toBe("remote");
    expect(decision.providerId).toBe("openai");
    expect(decision.modelId).toBe("openai/gpt-4o");
    expect(decision.requiresCloud).toBe(true);
    expect(decision.reason).toContain("BALANCED mode");
  });

  test("BALANCED mode stays on local model for complex task when cloud is unauthorized", () => {
    const config: RoutingConfig = {
      mode: "BALANCED",
      allowCloud: false, // Unauthorized!
      roleAssignments: {},
    };
    const router = new WorkloadModelRouter(registry, config);

    const decision = router.routeTask({
      prompt: "create an architectural plan for refactoring",
    });

    expect(decision.locality).toBe("local");
    expect(decision.modelId).toBe("omlx/qwen2.5-coder-7b");
    expect(decision.requiresCloud).toBe(false);
  });

  test("MANUAL mode respects explicit role assignments", () => {
    const config: RoutingConfig = {
      mode: "MANUAL",
      allowCloud: true,
      roleAssignments: {
        plan: "openai/gpt-4o",
        explore: "omlx/qwen2.5-coder-7b",
      },
    };
    const router = new WorkloadModelRouter(registry, config);

    const planDecision = router.routeTask({
      prompt: "any plan prompt",
      explicitRole: "plan",
    });
    expect(planDecision.modelId).toBe("openai/gpt-4o");
    expect(planDecision.locality).toBe("remote");

    const exploreDecision = router.routeTask({
      prompt: "any explore prompt",
      explicitRole: "explore",
    });
    expect(exploreDecision.modelId).toBe("omlx/qwen2.5-coder-7b");
    expect(exploreDecision.locality).toBe("local");
  });

  test("MANUAL mode throws CloudAuthorizationRequiredError when assigned cloud model without cloud authorization", () => {
    const config: RoutingConfig = {
      mode: "MANUAL",
      allowCloud: false,
      roleAssignments: {
        main: "openai/gpt-4o",
      },
    };
    const router = new WorkloadModelRouter(registry, config);

    expect(() => {
      router.routeTask({ prompt: "hello", explicitRole: "main" });
    }).toThrow(CloudAuthorizationRequiredError);
  });

  test("MANUAL mode throws ModelNotConfiguredError when assigned model does not exist", () => {
    const config: RoutingConfig = {
      mode: "MANUAL",
      allowCloud: true,
      roleAssignments: {
        main: "nonexistent/model",
      },
    };
    const router = new WorkloadModelRouter(registry, config);

    expect(() => {
      router.routeTask({ prompt: "hello", explicitRole: "main" });
    }).toThrow(ModelNotConfiguredError);
  });
});
