import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import {
  ProviderRegistry,
  resolveEndpointLocality,
  isValidEndpointUrl,
  normalizeEndpointUrl,
  sanitizeUrlForDisplay,
  sanitizeSecrets,
  maskApiKey,
} from "@nightglide/providers";
import { ConfigurationError } from "@nightglide/core";

describe("Provider Locality Classification", () => {
  test("classifies loopback addresses and hostnames as local", () => {
    expect(resolveEndpointLocality("http://localhost:8000")).toBe("local");
    expect(resolveEndpointLocality("http://localhost:11434/v1")).toBe("local");
    expect(resolveEndpointLocality("http://127.0.0.1:8000/v1")).toBe("local");
    expect(resolveEndpointLocality("http://127.0.0.2:11434")).toBe("local");
    expect(resolveEndpointLocality("http://127.123.45.67:8000")).toBe("local");
    expect(resolveEndpointLocality("http://127.255.255.254:8000")).toBe("local");
    expect(resolveEndpointLocality("http://[::1]:8000")).toBe("local");
    expect(resolveEndpointLocality("http://[::1]:8000/v1/")).toBe("local");
    expect(resolveEndpointLocality("http://0.0.0.0:8000")).toBe("local");
    expect(resolveEndpointLocality("http://0.0.0.0:8000/v1")).toBe("local");
    expect(resolveEndpointLocality("http://[0000:0000:0000:0000:0000:0000:0000:0001]:8000")).toBe("local");
  });

  test("classifies external domains and public IP addresses as remote regardless of name", () => {
    expect(resolveEndpointLocality("https://api.openai.com/v1")).toBe("remote");
    expect(resolveEndpointLocality("https://api.anthropic.com")).toBe("remote");
    expect(resolveEndpointLocality("http://8.8.8.8:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://93.184.216.34:80/v1")).toBe("remote");
    expect(resolveEndpointLocality("https://local-proxy.example.com")).toBe("remote");
  });

  test("classifies private LAN addresses (RFC 1918) as remote", () => {
    expect(resolveEndpointLocality("http://10.0.0.1:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://10.255.255.255:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://172.16.0.1:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://172.31.255.255:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://192.168.1.1:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://192.168.1.50:8000/v1")).toBe("remote");
    expect(resolveEndpointLocality("http://192.168.0.100:8000")).toBe("remote");
  });

  test("classifies link-local addresses as remote", () => {
    expect(resolveEndpointLocality("http://169.254.1.1:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://169.254.169.254:80")).toBe("remote");
  });

  test("classifies domain spoofing and confusion attempts as remote", () => {
    expect(resolveEndpointLocality("http://127.example.com:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://localhost.attacker.com")).toBe("remote");
    expect(resolveEndpointLocality("http://127.0.0.1.nip.io:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://fake-localhost:8000")).toBe("remote");
  });

  test("rejects or treats alternate IP representations as remote", () => {
    expect(resolveEndpointLocality("http://0x7f000001:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://0x7f.0.0.1:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://2130706433:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://0177.0.0.1:8000")).toBe("remote");
  });

  test("fails-closed to remote for URLs with embedded credentials or malformed URLs", () => {
    expect(resolveEndpointLocality("http://user:pass@localhost:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://admin:secret@127.0.0.1:8000")).toBe("remote");
    expect(resolveEndpointLocality("not-a-url")).toBe("remote");
    expect(resolveEndpointLocality("ftp://localhost:8000")).toBe("remote");
    expect(resolveEndpointLocality("ws://localhost:8000")).toBe("remote");
    expect(resolveEndpointLocality("http://")).toBe("remote");
  });
});

describe("Endpoint URL Validation and Normalization", () => {
  test("validates valid endpoint URLs", () => {
    expect(isValidEndpointUrl("http://localhost:8000")).toBe(true);
    expect(isValidEndpointUrl("http://127.0.0.1:8000/v1")).toBe(true);
    expect(isValidEndpointUrl("http://0.0.0.0:8000")).toBe(true);
    expect(isValidEndpointUrl("http://[::1]:8000")).toBe(true);
    expect(isValidEndpointUrl("https://api.openai.com/v1")).toBe(true);
    expect(isValidEndpointUrl("http://192.168.1.1:8000")).toBe(true);
  });

  test("rejects invalid, malformed, or unsafe endpoint URLs", () => {
    expect(isValidEndpointUrl("not-a-url")).toBe(false);
    expect(isValidEndpointUrl("ftp://localhost:8000")).toBe(false);
    expect(isValidEndpointUrl("http://")).toBe(false);
    expect(isValidEndpointUrl("http://:8000")).toBe(false);
    expect(isValidEndpointUrl("http://localhost:99999")).toBe(false);
    // Embedded credentials must be rejected to prevent leakage
    expect(isValidEndpointUrl("http://user:pass@localhost:8000")).toBe(false);
    expect(isValidEndpointUrl("http://admin:secret@127.0.0.1:8000")).toBe(false);
    // Alternate representations rejected
    expect(isValidEndpointUrl("http://0x7f000001:8000")).toBe(false);
    expect(isValidEndpointUrl("http://2130706433:8000")).toBe(false);
    expect(isValidEndpointUrl("http://0177.0.0.1:8000")).toBe(false);
  });

  test("normalizes endpoint URLs and normalizes 0.0.0.0 client destination to 127.0.0.1", () => {
    expect(normalizeEndpointUrl("http://0.0.0.0:8000/")).toBe("http://127.0.0.1:8000");
    expect(normalizeEndpointUrl("http://0.0.0.0:8000/v1/")).toBe("http://127.0.0.1:8000/v1");
    expect(normalizeEndpointUrl("HTTP://LOCALHOST:8000/")).toBe("http://localhost:8000");
    expect(normalizeEndpointUrl("http://[::1]:8000/v1/")).toBe("http://[::1]:8000/v1");
    expect(normalizeEndpointUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1");
  });

  test("sanitizes URLs for display without exposing credentials", () => {
    expect(sanitizeUrlForDisplay("http://admin:secret_password@localhost:8000/v1")).toBe(
      "http://***:***@localhost:8000/v1"
    );
    expect(sanitizeUrlForDisplay("http://localhost:8000/v1?api_key=sk-secret-12345")).toBe(
      "http://localhost:8000/v1?api_key=***"
    );
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

  test("preserves 0.0.0.0 local compatibility while normalizing baseUrl to 127.0.0.1 for dispatch", () => {
    const p = registry.register("omlx_any", {
      type: "openai-compatible",
      baseUrl: "http://0.0.0.0:8000/v1/",
    });

    expect(p.locality).toBe("local");
    expect(p.baseUrl).toBe("http://127.0.0.1:8000/v1");
    expect(p.originalBaseUrl).toBe("http://0.0.0.0:8000/v1");
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

  test("rejects URLs with credentials without leaking secrets in the error message", () => {
    try {
      registry.register("cred_provider", {
        type: "openai-compatible",
        baseUrl: "http://superadmin:super_secret_password_999@localhost:8000",
      });
      expect(true).toBe(false); // Should not reach here
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ConfigurationError);
      const msg = (err as Error).message;
      expect(msg.includes("super_secret_password_999")).toBe(false);
      expect(msg.includes("***:***")).toBe(true);
    }
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

    // Check maskApiKey helper
    expect(maskApiKey(key)).toBe("sk-••••••••2345");
    expect(maskApiKey("short")).toBe("********");
    expect(maskApiKey(undefined)).toBe("");

    // Check sanitizeSecrets helper
    const sanitized = sanitizeSecrets("Error with key sk-test-secret-value-12345 occurred", [key]);
    expect(sanitized.includes("sk-test-secret-value-12345")).toBe(false);
    expect(sanitized).toBe("Error with key *** occurred");

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

describe("ProviderRegistry Connection Probing & Redirect Security", () => {
  let mockServer: ReturnType<typeof Bun.serve>;
  let serverPort = 0;

  beforeEach(() => {
    // Start lightweight mock server on an ephemeral port
    mockServer = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);

        // Success terminal endpoint
        if (url.pathname === "/v1/models" || url.pathname === "/target/models") {
          return new Response(JSON.stringify({ data: [{ id: "model-1" }] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Cross-locality redirect attempt from local to remote
        if (url.pathname === "/cross-locality-redirect/models") {
          return new Response(null, {
            status: 302,
            headers: { Location: "https://evil.attacker.com/stolen-models" },
          });
        }

        // Same-locality redirect (local to local)
        if (url.pathname === "/local-redirect/models") {
          return new Response(null, {
            status: 301,
            headers: { Location: `http://127.0.0.1:${serverPort}/target/models` },
          });
        }

        // Redirect loop
        if (url.pathname === "/loop/models") {
          return new Response(null, {
            status: 307,
            headers: { Location: `http://127.0.0.1:${serverPort}/loop/models` },
          });
        }

        // Authentication errors
        if (url.pathname === "/auth-401/models") {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        if (url.pathname === "/auth-403/models") {
          return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
        }

        return new Response("Not Found", { status: 404 });
      },
    });

    serverPort = mockServer.port ?? 0;
  });

  afterAll(() => {
    if (mockServer) {
      mockServer.stop();
    }
  });

  test("detects and blocks cross-locality redirects from local provider to remote destination", async () => {
    const registry = new ProviderRegistry();
    registry.register("rogue_local", {
      type: "openai-compatible",
      baseUrl: `http://127.0.0.1:${serverPort}/cross-locality-redirect`,
    });

    const result = await registry.checkConnection("rogue_local", 2000);
    expect(result.connected).toBe(false);
    expect(result.status).toBe(302);
    expect(result.message).toContain("Security violation");
    expect(result.message).toContain("Cross-locality redirect blocked");
  });

  test("follows valid same-locality redirects cleanly", async () => {
    const registry = new ProviderRegistry();
    registry.register("valid_local", {
      type: "openai-compatible",
      baseUrl: `http://127.0.0.1:${serverPort}/local-redirect`,
    });

    const result = await registry.checkConnection("valid_local", 2000);
    expect(result.connected).toBe(true);
    expect(result.status).toBe(200);
    expect(result.message).toBe("Service online and authenticated.");
  });

  test("halts redirect loops exceeding maximum hop limit", async () => {
    const registry = new ProviderRegistry();
    registry.register("loop_local", {
      type: "openai-compatible",
      baseUrl: `http://127.0.0.1:${serverPort}/loop`,
    });

    const result = await registry.checkConnection("loop_local", 2000);
    expect(result.connected).toBe(false);
    expect(result.status).toBe(307);
    expect(result.message).toContain("Too many redirects");
  });

  test("handles 401 and 403 authentication responses cleanly without leaking secrets", async () => {
    const registry = new ProviderRegistry();
    process.env.DUMMY_SECRET_KEY = "sk-super-secret-12345";

    registry.register("auth_401", {
      type: "openai-compatible",
      baseUrl: `http://127.0.0.1:${serverPort}/auth-401`,
      apiKeyEnv: "DUMMY_SECRET_KEY",
    });

    registry.register("auth_403", {
      type: "openai-compatible",
      baseUrl: `http://127.0.0.1:${serverPort}/auth-403`,
      apiKeyEnv: "DUMMY_SECRET_KEY",
    });

    const res401 = await registry.checkConnection("auth_401", 2000);
    expect(res401.connected).toBe(false);
    expect(res401.status).toBe(401);
    expect(res401.message).toContain("Authentication required (HTTP 401)");
    expect(res401.message.includes("sk-super-secret-12345")).toBe(false);

    const res403 = await registry.checkConnection("auth_403", 2000);
    expect(res403.connected).toBe(false);
    expect(res403.status).toBe(403);
    expect(res403.message).toContain("Authentication required (HTTP 403)");
    expect(res403.message.includes("sk-super-secret-12345")).toBe(false);

    delete process.env.DUMMY_SECRET_KEY;
  });
});
