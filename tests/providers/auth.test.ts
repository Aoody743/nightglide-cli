import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import {
  OmpAuthAdapter,
  AuthStorage,
  SqliteAuthCredentialStore,
  normalizeSubscriptionProviderId,
  getStandardApiKeyEnvVar,
  type ProviderAuthType,
} from "@nightglide/providers";
import { ConfigurationError } from "@nightglide/core";
import { SetupScreen } from "../../apps/cli/src/ui/screens/SetupScreen.js";
import { runLoginCommand } from "../../apps/cli/src/commands/login.js";
import { ALL_THEMES } from "@nightglide/themes";

describe("OMP Auth & Subscription Login Specialist (@nightglide/providers)", () => {
  let db: Database;
  let store: SqliteAuthCredentialStore;
  let storage: AuthStorage;
  let adapter: OmpAuthAdapter;

  beforeEach(() => {
    db = new Database(":memory:");
    store = new SqliteAuthCredentialStore(db);
    storage = new AuthStorage(store);
    adapter = new OmpAuthAdapter({ authStorage: storage });
  });

  afterEach(() => {
    try {
      db.close();
    } catch {}
  });

  describe("1. Discovery & Storage Memoization", () => {
    it("returns an AuthStorage instance and caches it across calls", async () => {
      const realAdapter = new OmpAuthAdapter();
      const storage1 = await realAdapter.getAuthStorage();
      expect(storage1).toBeDefined();
      expect(typeof storage1.credentials.hasSubscription).toBe("function");

      const storage2 = await realAdapter.getAuthStorage();
      expect(storage2).toBe(storage1);
    });

    it("respects injected AuthStorage in constructor", async () => {
      const retrieved = await adapter.getAuthStorage();
      expect(retrieved).toBe(storage);
    });

    it("allows resetting the cached AuthStorage", async () => {
      const db2 = new Database(":memory:");
      const store2 = new SqliteAuthCredentialStore(db2);
      const storage2 = new AuthStorage(store2);

      adapter.resetCache(storage2);
      const retrieved = await adapter.getAuthStorage();
      expect(retrieved).toBe(storage2);
      db2.close();
    });
  });

  describe("2. Auth Type Detection & Provider Aliases", () => {
    it("returns 'unauthenticated' and isAuthenticated=false when no credentials exist", async () => {
      const authType = await adapter.getProviderAuthType("openai-codex");
      expect(authType).toBe("unauthenticated");

      const isAuth = await adapter.isAuthenticated("openai-codex");
      expect(isAuth).toBe(false);
    });

    it("detects 'official_subscription' when OAuth credential is stored", async () => {
      await storage.credentials.upsertOAuth("openai-codex", {
        type: "oauth",
        accessToken: "test-oauth-token",
        refreshToken: "test-refresh-token",
        expiresAt: Date.now() + 3600_000,
      });

      const authType = await adapter.getProviderAuthType("openai-codex");
      expect(authType).toBe("official_subscription");

      const isAuth = await adapter.isAuthenticated("openai-codex");
      expect(isAuth).toBe(true);
    });

    it("normalizes provider aliases for subscriptions (codex, copilot, claude)", async () => {
      await storage.credentials.upsertOAuth("openai-codex", {
        type: "oauth",
        accessToken: "codex-token",
        refreshToken: "codex-refresh",
        expiresAt: Date.now() + 3600_000,
      });

      await storage.credentials.upsertOAuth("github-copilot", {
        type: "oauth",
        accessToken: "copilot-token",
        refreshToken: "copilot-refresh",
        expiresAt: Date.now() + 3600_000,
      });

      // Querying via aliases
      expect(await adapter.getProviderAuthType("codex")).toBe("official_subscription");
      expect(await adapter.getProviderAuthType("chatgpt")).toBe("official_subscription");
      expect(await adapter.isAuthenticated("codex")).toBe(true);

      expect(await adapter.getProviderAuthType("copilot")).toBe("official_subscription");
      expect(await adapter.getProviderAuthType("github")).toBe("official_subscription");
      expect(await adapter.isAuthenticated("copilot")).toBe(true);
    });

    it("detects 'custom_api_key' when custom API key is configured", async () => {
      await adapter.setCustomApiKey("openai", "sk-proj-test-key-1234");

      const authType = await adapter.getProviderAuthType("openai");
      expect(authType).toBe("custom_api_key");

      const isAuth = await adapter.isAuthenticated("openai");
      expect(isAuth).toBe(true);
    });

    it("helper normalizeSubscriptionProviderId maps friendly names correctly", () => {
      expect(normalizeSubscriptionProviderId("codex")).toBe("openai-codex");
      expect(normalizeSubscriptionProviderId("copilot")).toBe("github-copilot");
      expect(normalizeSubscriptionProviderId("claude")).toBe("anthropic");
      expect(normalizeSubscriptionProviderId("gemini-cli")).toBe("google-gemini-cli");
      expect(normalizeSubscriptionProviderId("cursor")).toBe("cursor");
      expect(normalizeSubscriptionProviderId("custom-unknown")).toBe("custom-unknown");
    });
  });

  describe("3. Custom API Key Configuration & Environment Sync", () => {
    beforeEach(() => {
      delete process.env.DEEPSEEK_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete Bun.env.DEEPSEEK_API_KEY;
      delete Bun.env.OPENAI_API_KEY;
      delete Bun.env.ANTHROPIC_API_KEY;
    });

    afterEach(() => {
      delete process.env.DEEPSEEK_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete Bun.env.DEEPSEEK_API_KEY;
      delete Bun.env.OPENAI_API_KEY;
      delete Bun.env.ANTHROPIC_API_KEY;
    });

    it("stores custom API key in OMP key storage", async () => {
      await adapter.setCustomApiKey("deepseek", "sk-deepseek-test-9999");

      const retrievedKey = await storage.keys.get("deepseek");
      expect(retrievedKey).toBe("sk-deepseek-test-9999");
      expect(await adapter.getProviderAuthType("deepseek")).toBe("custom_api_key");
    });

    it("sets standard environment variable for known providers", async () => {
      delete process.env.OPENAI_API_KEY;
      expect(getStandardApiKeyEnvVar("openai")).toBe("OPENAI_API_KEY");

      await adapter.setCustomApiKey("openai", "sk-live-test-env-key");
      expect(process.env.OPENAI_API_KEY).toBe("sk-live-test-env-key");
    });

    it("rejects empty or whitespace-only API keys", async () => {
      await expect(adapter.setCustomApiKey("openai", "   ")).rejects.toThrow(
        ConfigurationError
      );
    });

    it("removes custom API key and cleans up environment variable", async () => {
      await adapter.setCustomApiKey("deepseek", "sk-deepseek-remove-test");
      expect(await adapter.isAuthenticated("deepseek")).toBe(true);

      await adapter.removeCustomApiKey("deepseek");
      expect(await storage.keys.get("deepseek")).toBeUndefined();
      expect(process.env.DEEPSEEK_API_KEY).toBeUndefined();
      expect(await adapter.getProviderAuthType("deepseek")).toBe("unauthenticated");
    });
  });

  describe("4. Graceful OAuth Error Handling", () => {
    it("throws ConfigurationError when provider is not an official subscription OAuth provider", async () => {
      await expect(
        adapter.loginOfficialSubscription("non-existent-or-custom-provider")
      ).rejects.toThrow(ConfigurationError);
    });

    it("handles aborted signal gracefully during OAuth flow", async () => {
      const ac = new AbortController();
      ac.abort();

      let caught = false;
      try {
        await adapter.loginOfficialSubscription("openai-codex", {
          signal: ac.signal,
        });
      } catch (err: unknown) {
        caught = true;
        expect(err).toBeDefined();
      }
      expect(caught).toBe(true);
    });

    it("handles interactive prompt cancellation gracefully", async () => {
      let caught = false;
      try {
        await adapter.loginOfficialSubscription("openai-codex", {
          onPrompt: async () => {
            throw new Error("User pressed Escape");
          },
        });
      } catch (err: unknown) {
        caught = true;
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg.length).toBeGreaterThan(0);
      }
      expect(caught).toBe(true);
    });
  });

  describe("5. SetupScreen Dual Authentication Presentation", () => {
    const theme = ALL_THEMES.find((t) => t.id === "midnight-flight") ?? ALL_THEMES[0];

    it("renders dual authentication cards with active status badges", () => {
      const element = SetupScreen({
        theme,
        onNavigate: () => {},
        authStatuses: {
          "openai-codex": "official_subscription",
          "github-copilot": "unauthenticated",
          anthropic: "unauthenticated",
          openai: "custom_api_key",
          deepseek: "unauthenticated",
          siliconflow: "unauthenticated",
          omlx: "unauthenticated",
        },
      });

      expect(element).toBeDefined();
      expect(element.type).toBe("box");

      const elementStr = JSON.stringify(element);
      // Dual choice titles
      expect(elementStr).toContain("官方订阅登录 / Official Subscription Login");
      expect(elementStr).toContain("第三方 API Key / Custom Provider");

      // Active status badges
      expect(elementStr).toContain("SUBSCRIPTION ACTIVE");
      expect(elementStr).toContain("API KEY CONFIGURED");
      expect(elementStr).toContain("NOT AUTHENTICATED");
      expect(elementStr).toContain("LOCAL (ZERO-COST)");
    });
  });

  describe("6. CLI login command", () => {
    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete Bun.env.OPENAI_API_KEY;
      delete Bun.env.DEEPSEEK_API_KEY;
      delete Bun.env.ANTHROPIC_API_KEY;
    });

    it("executes login --status without throwing", async () => {
      let errorThrown = false;
      try {
        await runLoginCommand(["--status"]);
      } catch {
        errorThrown = true;
      }
      expect(errorThrown).toBe(false);
    });

    it("configures custom API key via login command with --key argument", async () => {
      await runLoginCommand(["openai", "--key", "sk-cli-test-openai-key"]);
      const stored = process.env.OPENAI_API_KEY;
      expect(stored).toBe("sk-cli-test-openai-key");
    });
  });
});
