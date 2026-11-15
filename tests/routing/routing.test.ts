import { describe, test, expect, beforeEach } from "bun:test";
import { ProviderRegistry } from "@nightglide/providers";
import { WorkloadModelRouter, classifyTask } from "@nightglide/routing";
import {
  CloudAuthorizationRequiredError,
  ManualRoleNotAssignedError,
  ModelCapabilityMismatchError,
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

  test("classifies mixed Chinese and English prompts seamlessly", () => {
    const resReview = classifyTask("帮我 review 一下这段 PR 代码的安全隐患");
    expect(resReview.category).toBe("review");

    const resPlan = classifyTask("为 auth 模块设计一个 high-level 架构 plan 方案路线图");
    expect(resPlan.category).toBe("plan");
    expect(resPlan.isComplex).toBe(true);

    const resDebug = classifyTask("debug 排查线上出现的 NullPointerException 崩溃异常堆栈");
    expect(resDebug.category).toBe("debug");

    const resExplore = classifyTask("在代码库里 search 搜索所有 controller 目录结构");
    expect(resExplore.category).toBe("explore");

    const resTest = classifyTask("为 userService 编写 unit test 单元测试用例");
    expect(resTest.category).toBe("test");

    const resSummarize = classifyTask("summarize 总结刚才所有 agent 的排查结论");
    expect(resSummarize.category).toBe("summarize");
  });

  test("produces policy-based workload routing explanation", () => {
    const res = classifyTask("inspect diff and review changes");
    expect(res.explanation).toContain("Policy-based workload classification");
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

  test("LOCAL mode throws ProviderUnavailableError when local provider is disconnected", () => {
    const disconnectedRegistry = new ProviderRegistry();
    const p = disconnectedRegistry.register("local_omlx", {
      type: "openai-compatible",
      baseUrl: "http://127.0.0.1:8000/v1",
    });
    disconnectedRegistry.registerModel("local_omlx", "local-model");
    p.lastCheck = {
      connected: false,
      status: 503,
      message: "Connection refused",
      checkedAt: Date.now(),
    };

    const config: RoutingConfig = {
      mode: "LOCAL",
      allowCloud: false,
      roleAssignments: {},
    };
    const router = new WorkloadModelRouter(disconnectedRegistry, config);

    expect(() => {
      router.routeTask({ prompt: "test prompt" });
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

  test("BALANCED mode stays on local model for complex task when cloud is unauthorized with explicit reason", () => {
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
    expect(decision.reason).toContain("cloud access is not authorized ('allowCloud: false')");
    expect(decision.fallbackChain.every((id) => !id.startsWith("openai/"))).toBe(true);
  });

  test("BALANCED mode throws CloudAuthorizationRequiredError when no local model exists and cloud is unauthorized", () => {
    const remoteOnlyRegistry = new ProviderRegistry();
    remoteOnlyRegistry.register("openai", {
      type: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
    });
    remoteOnlyRegistry.registerModel("openai", "gpt-4o", {
      capabilities: ["planning", "reasoning"],
    });

    const config: RoutingConfig = {
      mode: "BALANCED",
      allowCloud: false,
      roleAssignments: {},
    };
    const router = new WorkloadModelRouter(remoteOnlyRegistry, config);

    expect(() => {
      router.routeTask({ prompt: "explain this function" });
    }).toThrow(CloudAuthorizationRequiredError);
  });

  test("PERFORMANCE mode prioritizes cloud model when authorized", () => {
    const config: RoutingConfig = {
      mode: "PERFORMANCE",
      allowCloud: true,
      roleAssignments: {},
    };
    const router = new WorkloadModelRouter(registry, config);

    const decision = router.routeTask({ prompt: "generate a feature" });
    expect(decision.locality).toBe("remote");
    expect(decision.modelId).toBe("openai/gpt-4o");
    expect(decision.requiresCloud).toBe(true);
  });

  test("PERFORMANCE mode falls back to top local model when cloud is unauthorized", () => {
    const config: RoutingConfig = {
      mode: "PERFORMANCE",
      allowCloud: false,
      roleAssignments: {},
    };
    const router = new WorkloadModelRouter(registry, config);

    const decision = router.routeTask({ prompt: "generate a feature" });
    expect(decision.locality).toBe("local");
    expect(decision.modelId).toBe("omlx/qwen2.5-coder-7b");
    expect(decision.requiresCloud).toBe(false);
    expect(decision.reason).toContain("PERFORMANCE mode preferred cloud, but cloud is unauthorized");
  });

  test("PERFORMANCE mode throws CloudAuthorizationRequiredError when cloud unauthorized and no local models exist", () => {
    const remoteOnlyRegistry = new ProviderRegistry();
    remoteOnlyRegistry.register("openai", {
      type: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
    });
    remoteOnlyRegistry.registerModel("openai", "gpt-4o");

    const config: RoutingConfig = {
      mode: "PERFORMANCE",
      allowCloud: false,
      roleAssignments: {},
    };
    const router = new WorkloadModelRouter(remoteOnlyRegistry, config);

    expect(() => {
      router.routeTask({ prompt: "generate a feature" });
    }).toThrow(CloudAuthorizationRequiredError);
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

  test("MANUAL mode throws ManualRoleNotAssignedError when role is not assigned in roleAssignments", () => {
    const config: RoutingConfig = {
      mode: "MANUAL",
      allowCloud: true,
      roleAssignments: {
        explore: "omlx/qwen2.5-coder-7b",
      },
    };
    const router = new WorkloadModelRouter(registry, config);

    expect(() => {
      router.routeTask({ prompt: "hello world", explicitRole: "plan" });
    }).toThrow(ManualRoleNotAssignedError);

    try {
      router.routeTask({ prompt: "hello world", explicitRole: "plan" });
    } catch (err) {
      expect(err).toBeInstanceOf(ManualRoleNotAssignedError);
      const manualErr = err as ManualRoleNotAssignedError;
      expect(manualErr.role).toBe("plan");
      expect(manualErr.code).toBe("MANUAL_ROLE_NOT_ASSIGNED");
    }
  });

  test("MANUAL mode throws ManualRoleNotAssignedError when assigned role has empty or whitespace string", () => {
    const config: RoutingConfig = {
      mode: "MANUAL",
      allowCloud: true,
      roleAssignments: {
        main: "   ",
      },
    };
    const router = new WorkloadModelRouter(registry, config);

    expect(() => {
      router.routeTask({ prompt: "write some code", explicitRole: "main" });
    }).toThrow(ManualRoleNotAssignedError);
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

  test("MANUAL mode throws ProviderUnavailableError when provider is disabled", () => {
    const p = registry.register("disabled_p", {
      type: "openai-compatible",
      baseUrl: "http://127.0.0.1:9000/v1",
      enabled: false,
    });
    registry.registerModel("disabled_p", "model-a");

    const config: RoutingConfig = {
      mode: "MANUAL",
      allowCloud: true,
      roleAssignments: {
        main: "disabled_p/model-a",
      },
    };
    const router = new WorkloadModelRouter(registry, config);

    expect(() => {
      router.routeTask({ prompt: "test prompt", explicitRole: "main" });
    }).toThrow(ProviderUnavailableError);
  });

  test("MANUAL mode throws ProviderUnavailableError when provider is marked disconnected", () => {
    const omlx = registry.get("omlx");
    expect(omlx).toBeDefined();
    if (omlx) {
      omlx.lastCheck = {
        connected: false,
        status: 502,
        message: "Bad gateway",
        checkedAt: Date.now(),
      };
    }

    const config: RoutingConfig = {
      mode: "MANUAL",
      allowCloud: false,
      roleAssignments: {
        explore: "omlx/qwen2.5-coder-7b",
      },
    };
    const router = new WorkloadModelRouter(registry, config);

    expect(() => {
      router.routeTask({ prompt: "explore files", explicitRole: "explore" });
    }).toThrow(ProviderUnavailableError);
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

  test("MANUAL mode throws ModelCapabilityMismatchError when assigned model lacks required capabilities", () => {
    // qwen2.5-coder-7b only has ["coding", "fast", "tool_call"], lacks ["planning", "reasoning"]
    const config: RoutingConfig = {
      mode: "MANUAL",
      allowCloud: true,
      roleAssignments: {
        plan: "omlx/qwen2.5-coder-7b",
      },
    };
    const router = new WorkloadModelRouter(registry, config);

    expect(() => {
      router.routeTask({
        prompt: "create a comprehensive architecture plan and roadmap",
        explicitRole: "plan",
      });
    }).toThrow(ModelCapabilityMismatchError);

    try {
      router.routeTask({
        prompt: "create a comprehensive architecture plan and roadmap",
        explicitRole: "plan",
      });
    } catch (err) {
      expect(err).toBeInstanceOf(ModelCapabilityMismatchError);
      const capErr = err as ModelCapabilityMismatchError;
      expect(capErr.modelId).toBe("omlx/qwen2.5-coder-7b");
      expect(capErr.requiredCapabilities).toContain("planning");
    }
  });

  test("MANUAL mode uses user-configured fallbackAssignments if provided, otherwise empty", () => {
    const config: RoutingConfig = {
      mode: "MANUAL",
      allowCloud: true,
      roleAssignments: {
        plan: "openai/gpt-4o",
      },
      fallbackAssignments: {
        plan: ["omlx/qwen2.5-coder-7b"],
      },
    };
    const router = new WorkloadModelRouter(registry, config);

    const decision = router.routeTask({
      prompt: "create an architecture plan",
      explicitRole: "plan",
    });

    expect(decision.fallbackChain).toEqual(["omlx/qwen2.5-coder-7b"]);
  });

  test("explicitRole strictly overrides classifier category output", () => {
    const config: RoutingConfig = {
      mode: "LOCAL",
      allowCloud: false,
      roleAssignments: {},
    };
    const router = new WorkloadModelRouter(registry, config);

    // Prompt looks like explore, but explicitRole is review
    const decision = router.routeTask({
      prompt: "find all instances of auth in files",
      explicitRole: "review",
    });

    expect(decision.agentRole).toBe("review");
    expect(decision.taskCategory).toBe("explore");
  });
});
