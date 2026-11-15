import {
  AuthStorage,
  discoverAuthStorage,
  SqliteAuthCredentialStore,
  isAuthenticated as ompIsAuthenticated,
} from "@oh-my-pi/pi-coding-agent";
import { ConfigurationError } from "@nightglide/core";

export { AuthStorage, discoverAuthStorage, SqliteAuthCredentialStore };

/**
 * Categorical authentication type for a provider.
 */
export type ProviderAuthType =
  | "official_subscription"
  | "custom_api_key"
  | "unauthenticated";

/**
 * Standard environment variable mappings for popular LLM providers.
 */
const STANDARD_ENV_KEYS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  google: "GEMINI_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  siliconflow: "SILICONFLOW_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
  together: "TOGETHER_API_KEY",
  fireworks: "FIREWORKS_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  xai: "XAI_API_KEY",
};

/**
 * Normalize provider ID for official subscription and OAuth flows.
 */
export function normalizeSubscriptionProviderId(providerId: string): string {
  const normalized = providerId.trim().toLowerCase();
  switch (normalized) {
    case "codex":
    case "chatgpt":
    case "chatgpt-plus":
    case "openai-codex":
      return "openai-codex";
    case "copilot":
    case "github":
    case "github-copilot":
      return "github-copilot";
    case "claude":
    case "claude-cli":
    case "anthropic":
      return "anthropic";
    case "gemini":
    case "gemini-cli":
    case "google-gemini-cli":
      return "google-gemini-cli";
    case "antigravity":
    case "antigravity-cli":
      return "antigravity-cli";
    case "cursor":
      return "cursor";
    case "kimi":
    case "kimi-code":
      return "kimi-code";
    default:
      return normalized;
  }
}

/**
 * Retrieve the standard environment variable name for a provider if known.
 */
export function getStandardApiKeyEnvVar(providerId: string): string | undefined {
  const normalized = providerId.trim().toLowerCase();
  return STANDARD_ENV_KEYS[normalized];
}

/**
 * Best-effort helper to open a URL in the user's default web browser without throwing.
 */
export function openBrowserUrl(url: string): void {
  try {
    let cmd: string[];
    switch (process.platform) {
      case "darwin":
        cmd = ["open", url];
        break;
      case "win32":
        cmd = ["cmd", "/c", "start", '""', url];
        break;
      default:
        cmd = ["xdg-open", url];
        break;
    }
    Bun.spawn(cmd, {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
  } catch {
    // Best-effort: ignore if browser cannot be launched in headless/restricted environments
  }
}

export interface OfficialLoginCallbacks {
  openBrowser?: boolean;
  onAuth?: (info: { url: string; launchUrl?: string; instructions?: string }) => void;
  onProgress?: (message: string) => void;
  onPrompt?: (p: { message: string; placeholder?: string }) => Promise<string>;
  onManualCodeInput?: (signal?: AbortSignal) => Promise<string>;
  signal?: AbortSignal;
}

export interface OmpAuthAdapterOptions {
  authStorage?: AuthStorage;
  agentDir?: string;
  cwd?: string;
}

/**
 * Adapter encapsulating native OMP authentication, credential storage, and subscription discovery.
 */
export class OmpAuthAdapter {
  private cachedStorage: AuthStorage | null = null;
  private storagePromise: Promise<AuthStorage> | null = null;
  private readonly agentDir?: string;
  private readonly cwd?: string;

  constructor(options?: OmpAuthAdapterOptions) {
    if (options?.authStorage) {
      this.cachedStorage = options.authStorage;
    }
    this.agentDir = options?.agentDir;
    this.cwd = options?.cwd;
  }

  /**
   * Returns discoverAuthStorage() memoized/cached, or the injected AuthStorage.
   */
  async getAuthStorage(): Promise<AuthStorage> {
    if (this.cachedStorage) {
      return this.cachedStorage;
    }
    if (!this.storagePromise) {
      this.storagePromise = discoverAuthStorage(this.agentDir, {
        cwd: this.cwd,
      }).then((storage) => {
        this.cachedStorage = storage;
        return storage;
      });
    }
    return this.storagePromise;
  }

  /**
   * Reset or replace the cached storage (useful for testing or cache revalidation).
   */
  resetCache(newStorage?: AuthStorage): void {
    this.cachedStorage = newStorage ?? null;
    this.storagePromise = newStorage ? Promise.resolve(newStorage) : null;
  }

  /**
   * Determines the active authentication type:
   * - "official_subscription": Authenticated via OAuth / vendor subscription credentials
   * - "custom_api_key": Authenticated via custom API key in OMP key storage or environment
   * - "unauthenticated": No valid credential or key found
   */
  async getProviderAuthType(providerId: string): Promise<ProviderAuthType> {
    const storage = await this.getAuthStorage();
    const normalizedId = providerId.trim().toLowerCase();
    const mappedSubscriptionId = normalizeSubscriptionProviderId(normalizedId);

    // 1. Check for official subscription or OAuth credentials
    if (
      storage.credentials.hasSubscription(normalizedId) ||
      storage.credentials.hasSubscription(mappedSubscriptionId) ||
      storage.credentials.hasOAuth(normalizedId) ||
      storage.credentials.hasOAuth(mappedSubscriptionId)
    ) {
      return "official_subscription";
    }

    // Check raw credentials list
    const directCreds = storage.credentials.credentials(normalizedId);
    if (directCreds && directCreds.some((c) => c.type === "oauth")) {
      return "official_subscription";
    }
    const mappedCreds = storage.credentials.credentials(mappedSubscriptionId);
    if (mappedCreds && mappedCreds.some((c) => c.type === "oauth")) {
      return "official_subscription";
    }

    // 2. Check for configured API key (in OMP keys storage, runtime, or env)
    const configuredKey =
      (await storage.keys.get(normalizedId)) ??
      (await storage.keys.get(mappedSubscriptionId)) ??
      (await storage.getApiKey(normalizedId)) ??
      (await storage.getApiKey(mappedSubscriptionId));

    if (configuredKey && ompIsAuthenticated(configuredKey)) {
      return "custom_api_key";
    }

    return "unauthenticated";
  }

  /**
   * Checks if provider is authenticated via OAuth/subscription or API key.
   */
  async isAuthenticated(providerId: string): Promise<boolean> {
    const authType = await this.getProviderAuthType(providerId);
    return authType === "official_subscription" || authType === "custom_api_key";
  }

  /**
   * Initiates official subscription login flow using OMP's OAuth/credential storage.
   */
  async loginOfficialSubscription(
    providerId: string,
    options: OfficialLoginCallbacks = {}
  ): Promise<void> {
    const storage = await this.getAuthStorage();
    const normalizedId = providerId.trim().toLowerCase();
    const targetId = normalizeSubscriptionProviderId(normalizedId);

    try {
      await storage.oauth.login(targetId, {
        onAuth: (info) => {
          if (options.onAuth) {
            options.onAuth(info);
          }
          if (options.openBrowser) {
            openBrowserUrl(info.url);
          }
        },
        onProgress: options.onProgress,
        onPrompt: options.onPrompt ?? (async (p) => {
          throw new Error(`Interactive prompt required: ${p.message}`);
        }),
        onManualCodeInput: options.onManualCodeInput,
        signal: options.signal,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes("Unknown OAuth provider")) {
        throw new ConfigurationError(
          `Provider '${providerId}' is not an available official subscription OAuth provider.`
        );
      }
      throw err;
    }
  }

  /**
   * Stores custom API key in OMP's key storage (`storage.keys.setConfig` or environment/config).
   */
  async setCustomApiKey(
    providerId: string,
    apiKey: string,
    baseUrl?: string
  ): Promise<void> {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      throw new ConfigurationError("API key cannot be empty.");
    }
    const normalizedId = providerId.trim().toLowerCase();
    const storage = await this.getAuthStorage();

    // Store in OMP's native key storage
    storage.keys.setConfig(normalizedId, trimmedKey);

    // Also set standard environment variable if available and not already set
    const envVar = getStandardApiKeyEnvVar(normalizedId);
    if (envVar) {
      process.env[envVar] = trimmedKey;
      if (typeof Bun !== "undefined" && Bun.env) {
        Bun.env[envVar] = trimmedKey;
      }
    }
  }

  /**
   * Remove custom API key from OMP's key storage and environment.
   */
  async removeCustomApiKey(providerId: string): Promise<void> {
    const normalizedId = providerId.trim().toLowerCase();
    const storage = await this.getAuthStorage();
    storage.keys.removeConfig(normalizedId);

    const envVar = getStandardApiKeyEnvVar(normalizedId);
    if (envVar) {
      if (process.env[envVar]) {
        delete process.env[envVar];
      }
      if (typeof Bun !== "undefined" && Bun.env && Bun.env[envVar]) {
        delete Bun.env[envVar];
      }
    }
  }
}
