import { describe, test, expect, beforeEach } from "bun:test";
import { ProviderRegistry, resolveEndpointLocality, isValidEndpointUrl } from "@nightglide/providers";
import { ConfigurationError } from "@nightglide/core";

describe("Provider Locality Classification", () => {
  test("classifies loopback addresses and hostnames as local", () => {
    expect(resolveEndpointLocality("http://localhost:8000")).toBe("local");
    expect(resolveEndpointLocality("http://127.0.0.1:8000/v1")).toBe("local");
    expect(resolveEndpointLocality("http://127.0.0.2:11434")).toBe("local");
    expect(resolveEndpointLocality("http://[::1]:8000")).toBe("local");
    expect(resolveEndpointLocality("http://0.0.0.0:8000")).toBe("local");
  });

  test("classifies external domains and IP addresses as remote regardless of name", () => {
    expect(resolveEndpointLocality("https://api.openai.com/v1")).toBe("remote");
    expect(resolveEndpointLocality("https://api.anthropic.com")).toBe("remote");
    expect(resolveEndpointLocality("http://192.168.1.50:8000/v1")).toBe("remote");
    expect(resolveEndpointLocality("https://local-proxy.example.com")).toBe("remote");
  });

  test("validates valid and invalid endpoint URLs", () => {
    expect(isValidEndpointUrl("http://localhost:8000")).toBe(true);
    expect(isValidEndpointUrl("https://api.openai.com/v1")).toBe(true);
    expect(isValidEndpointUrl("not-a-url")).toBe(false);
    expect(isValidEndpointUrl("ftp://localhost:8000")).toBe(false);
  });
});

describe("ProviderRegistry", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  test("registers valid providers and allows multiple providers to coexist", () => {
    registry.register("local_omlx", {
      type: "openai-compatible",
      baseUrl: "http://127.0.0.1:8000/v1",
      displayName: "oMLX Local",
    });

    registry.register("cloud_openai", {
      type: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      displayName: "OpenAI Cloud",
      apiKeyEnv: "OPENAI_API_KEY",
    });

    const list = registry.list();
    expect(list.length).toBe(2);
    expect(registry.get("local_omlx")?.locality).toBe("local");
    expect(registry.get("cloud_openai")?.locality).toBe("remote");
  });

  test("rejects duplicate provider IDs", () => {
    registry.register("local", {
      type: "openai-compatible",
      baseUrl: "http://127.0.0.1:8000/v1",
    });

    expect(() => {
      registry.register("LOCAL", {
        type: "openai-compatible",
        baseUrl: "http://127.0.0.1:11434/v1",
      });
    }).toThrow(ConfigurationError);
  });

  test("rejects invalid endpoint URLs", () => {
    expect(() => {
      registry.register("bad_url", {
        type: "openai-compatible",
        baseUrl: "invalid-url-here",
      });
    }).toThrow(ConfigurationError);
  });

  test("resolves API keys without exposing secrets in public fields", () => {
    process.env.TEST_OPENAI_KEY = "sk-test-secret-value-12345";

    registry.register("openai", {
      type: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "TEST_OPENAI_KEY",
    });

    const key = registry.resolveApiKey("openai");
    expect(key).toBe("sk-test-secret-value-12345");

    // Check that getDiagnosticReport does not contain raw key
    const report = registry.getDiagnosticReport();
    const str = JSON.stringify(report);
    expect(str.includes("sk-test-secret-value-12345")).toBe(false);
    expect(report.providers[0].hasAuth).toBe(true);

    delete process.env.TEST_OPENAI_KEY;
  });

  test("model IDs are strictly provider-qualified", () => {
    registry.register("omlx", {
      type: "openai-compatible",
      baseUrl: "http://127.0.0.1:8000/v1",
    });

    const descriptor = registry.registerModel("omlx", "qwen2.5-coder-7b", {
      name: "Qwen 2.5 Coder 7B",
      capabilities: ["coding", "reasoning"],
      contextWindow: 32768,
      isDefault: true,
    });

    expect(descriptor.id).toBe("omlx/qwen2.5-coder-7b");
    expect(descriptor.providerId).toBe("omlx");
    expect(descriptor.locality).toBe("local");

    const retrieved = registry.getModel("omlx/qwen2.5-coder-7b");
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe("omlx/qwen2.5-coder-7b");
  });

  test("generates accurate diagnostic report", () => {
    registry.register("omlx", {
      type: "openai-compatible",
      baseUrl: "http://127.0.0.1:8000/v1",
    });
    registry.registerModel("omlx", "qwen-7b");

    registry.register("anthropic", {
      type: "custom",
      baseUrl: "https://api.anthropic.com",
    });
    registry.registerModel("anthropic", "claude-3-7-sonnet");

    const report = registry.getDiagnosticReport();
    expect(report.totalModels).toBe(2);
    expect(report.localProvidersCount).toBe(1);
    expect(report.cloudProvidersCount).toBe(1);
  });
});
