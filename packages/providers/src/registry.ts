import {
  type ModelDescriptor,
  type ProviderInfo,
  type ProviderLocality,
  type ModelCapability,
  ConfigurationError,
} from "@nightglide/core";
import type { ProviderEndpointConfig } from "@nightglide/config";
import {
  isValidEndpointUrl,
  resolveEndpointLocality,
  normalizeEndpointUrl,
  sanitizeUrlForDisplay,
  sanitizeSecrets,
} from "./locality.js";

export interface RegisteredProvider {
  id: string;
  name: string;
  baseUrl: string;
  originalBaseUrl?: string;
  locality: ProviderLocality;
  type: string;
  apiKey?: string;
  apiKeyEnv?: string;
  enabled: boolean;
  defaultModel?: string;
  models: ModelDescriptor[];
  lastCheck?: {
    connected: boolean;
    status: number;
    message: string;
    checkedAt: number;
  };
}

export interface ProviderDiagnosticReport {
  providers: Array<{
    id: string;
    name: string;
    locality: ProviderLocality;
    baseUrl: string;
    hasAuth: boolean;
    connected: boolean;
    modelsCount: number;
    statusMessage: string;
  }>;
  totalModels: number;
  localProvidersCount: number;
  cloudProvidersCount: number;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, RegisteredProvider>();

  /**
   * Register a new provider in the registry.
   */
  register(id: string, config: ProviderEndpointConfig): RegisteredProvider {
    const trimmedId = id.trim().toLowerCase();
    if (!trimmedId) {
      throw new ConfigurationError("Provider ID cannot be empty");
    }
    if (this.providers.has(trimmedId)) {
      throw new ConfigurationError(`Duplicate provider ID '${trimmedId}' is rejected.`);
    }

    if (!isValidEndpointUrl(config.baseUrl)) {
      const sanitizedUrl = sanitizeUrlForDisplay(config.baseUrl);
      throw new ConfigurationError(
        `Invalid endpoint URL '${sanitizedUrl}' for provider '${trimmedId}'. Must be a valid http:// or https:// URL without embedded credentials.`
      );
    }

    // Physical endpoint locality calculation takes strict precedence over any config override
    const physicalLocality = resolveEndpointLocality(config.baseUrl);
    const normalizedBaseUrl = normalizeEndpointUrl(config.baseUrl);

    const displayName = config.displayName?.trim() || `${trimmedId} (${physicalLocality})`;
    const provider: RegisteredProvider = {
      id: trimmedId,
      name: displayName,
      baseUrl: normalizedBaseUrl,
      originalBaseUrl: config.baseUrl.trim().replace(/\/+$/, ""),
      locality: physicalLocality,
      type: config.type,
      apiKey: config.apiKey,
      apiKeyEnv: config.apiKeyEnv,
      enabled: config.enabled ?? true,
      defaultModel: config.defaultModel,
      models: [],
    };

    this.providers.set(trimmedId, provider);
    return provider;
  }

  unregister(id: string): boolean {
    return this.providers.delete(id.toLowerCase().trim());
  }

  get(id: string): RegisteredProvider | undefined {
    return this.providers.get(id.toLowerCase().trim());
  }

  has(id: string): boolean {
    return this.providers.has(id.toLowerCase().trim());
  }

  list(): RegisteredProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Resolves the active API key for a provider without exposing it to public logs.
   */
  resolveApiKey(providerId: string): string | undefined {
    const p = this.get(providerId);
    if (!p) return undefined;

    if (p.apiKey && p.apiKey.trim()) {
      return p.apiKey.trim();
    }

    if (p.apiKeyEnv && process.env[p.apiKeyEnv]) {
      return process.env[p.apiKeyEnv]?.trim();
    }

    // Default well-known environment variables
    if (p.id === "local" || p.id === "omlx") {
      return process.env.OMLX_API_KEY || process.env.LOCAL_AI_API_KEY;
    }
    if (p.id === "openai" || p.id.includes("openai")) {
      return process.env.OPENAI_API_KEY;
    }
    if (p.id === "anthropic" || p.id.includes("anthropic")) {
      return process.env.ANTHROPIC_API_KEY;
    }
    if (p.id === "openrouter" || p.id.includes("openrouter")) {
      return process.env.OPENROUTER_API_KEY;
    }

    return undefined;
  }

  /**
   * Register known models for a provider.
   * Model IDs are strictly provider-qualified: `${provider.id}/${modelId}`.
   */
  registerModel(
    providerId: string,
    rawModelId: string,
    metadata: {
      name?: string;
      capabilities?: ModelCapability[];
      contextWindow?: number;
      isDefault?: boolean;
    } = {}
  ): ModelDescriptor {
    const provider = this.get(providerId);
    if (!provider) {
      throw new ConfigurationError(`Cannot register model: provider '${providerId}' not found.`);
    }

    const cleanModelId = rawModelId.replace(new RegExp(`^${provider.id}/`), "");
    const qualifiedId = `${provider.id}/${cleanModelId}`;

    // Remove existing if present
    provider.models = provider.models.filter((m) => m.id !== qualifiedId);

    const descriptor: ModelDescriptor = {
      id: qualifiedId,
      name: metadata.name || cleanModelId,
      providerId: provider.id,
      locality: provider.locality,
      contextWindow: metadata.contextWindow,
      capabilities: metadata.capabilities ?? ["coding"],
      isDefault: metadata.isDefault ?? false,
    };

    provider.models.push(descriptor);
    return descriptor;
  }

  /**
   * Retrieve a qualified model descriptor by its full ID e.g. "omlx/qwen2.5-coder".
   */
  getModel(qualifiedId: string): ModelDescriptor | undefined {
    for (const provider of this.providers.values()) {
      const found = provider.models.find((m) => m.id === qualifiedId);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * List all models registered across all active providers.
   */
  listModels(options: { locality?: ProviderLocality; capability?: ModelCapability } = {}): ModelDescriptor[] {
    const result: ModelDescriptor[] = [];
    for (const p of this.providers.values()) {
      if (!p.enabled) continue;
      for (const m of p.models) {
        if (options.locality && m.locality !== options.locality) continue;
        if (options.capability && !m.capabilities.includes(options.capability)) continue;
        result.push(m);
      }
    }
    return result;
  }

  /**
   * Probe network connectivity and authentication state of a provider endpoint.
   * Enforces strict redirect security:
   * - Prohibits cross-locality redirects (local endpoints must never silently redirect to remote destinations)
   * - Prohibits SSRF redirects (remote endpoints redirecting to local loopback)
   * - Prohibits protocol downgrade redirects (HTTPS to HTTP)
   * - Handles authentication errors cleanly without credential leakage
   */
  async checkConnection(
    providerId: string,
    timeoutMs = 3000
  ): Promise<{ connected: boolean; status: number; message: string }> {
    const provider = this.get(providerId);
    if (!provider) {
      return { connected: false, status: 404, message: `Provider '${providerId}' not found.` };
    }

    const apiKey = this.resolveApiKey(providerId);
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Determine target probe URL
    const targetUrl = `${provider.baseUrl}/models`;
    let currentUrl = targetUrl;
    let redirectHops = 0;
    const MAX_REDIRECTS = 3;

    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);

      while (redirectHops <= MAX_REDIRECTS) {
        const resp = await fetch(currentUrl, {
          method: "GET",
          headers,
          signal: controller.signal,
          redirect: "manual",
        });

        // Handle HTTP redirects (301, 302, 303, 307, 308)
        if (resp.status >= 300 && resp.status < 400) {
          const location = resp.headers.get("location");
          if (!location) {
            const result = {
              connected: false,
              status: resp.status,
              message: `Endpoint returned HTTP ${resp.status} redirect without Location header.`,
            };
            provider.lastCheck = { ...result, checkedAt: Date.now() };
            return result;
          }

          let nextUrl: URL;
          try {
            nextUrl = new URL(location, currentUrl);
          } catch {
            const result = {
              connected: false,
              status: resp.status,
              message: `Endpoint returned invalid redirect Location header.`,
            };
            provider.lastCheck = { ...result, checkedAt: Date.now() };
            return result;
          }

          const nextLocality = resolveEndpointLocality(nextUrl.href);

          // Security check 1: Local endpoint must NEVER silently redirect to remote destination!
          if (provider.locality === "local" && nextLocality !== "local") {
            const result = {
              connected: false,
              status: resp.status,
              message: `Security violation: Local provider redirected to remote destination (${nextUrl.origin}). Cross-locality redirect blocked.`,
            };
            provider.lastCheck = { ...result, checkedAt: Date.now() };
            return result;
          }

          // Security check 2: Remote endpoint must NEVER redirect to local loopback (SSRF protection)
          if (provider.locality === "remote" && nextLocality === "local") {
            const result = {
              connected: false,
              status: resp.status,
              message: `Security violation: Remote provider redirected to local loopback destination (${nextUrl.origin}). Reverse cross-locality redirect blocked.`,
            };
            provider.lastCheck = { ...result, checkedAt: Date.now() };
            return result;
          }

          // Security check 3: Prohibit HTTPS to HTTP downgrade
          if (currentUrl.startsWith("https:") && nextUrl.protocol === "http:") {
            const result = {
              connected: false,
              status: resp.status,
              message: `Security violation: Insecure redirect from HTTPS to HTTP blocked.`,
            };
            provider.lastCheck = { ...result, checkedAt: Date.now() };
            return result;
          }

          redirectHops++;
          if (redirectHops > MAX_REDIRECTS) {
            const result = {
              connected: false,
              status: resp.status,
              message: `Too many redirects (exceeded limit of ${MAX_REDIRECTS}).`,
            };
            provider.lastCheck = { ...result, checkedAt: Date.now() };
            return result;
          }

          // If redirect changes origin, strip Authorization header to prevent secret leakage
          const currentOrigin = new URL(currentUrl).origin;
          if (nextUrl.origin !== currentOrigin) {
            delete headers["Authorization"];
          }

          currentUrl = nextUrl.href;
          continue;
        }

        if (resp.status === 200) {
          let discoveredCount = 0;
          try {
            const contentType = resp.headers.get("content-type") || "";
            if (contentType.includes("json")) {
              const body = await resp.json();
              const list = Array.isArray(body?.data)
                ? body.data
                : Array.isArray(body?.models)
                ? body.models
                : [];
              for (const item of list) {
                const modelId = typeof item === "string" ? item : item.id || item.name;
                if (modelId) {
                  this.registerModel(provider.id, modelId, {
                    name: typeof item === "object" && item.name ? item.name : modelId,
                    contextWindow: typeof item === "object" ? item.max_model_len : undefined,
                    isDefault: discoveredCount === 0,
                  });
                  discoveredCount++;
                }
              }
              if (provider.models.length > 0 && !provider.defaultModel) {
                provider.defaultModel = provider.models[0].id;
              }
            }
          } catch {}

          const result = {
            connected: true,
            status: 200,
            message: "Service online and authenticated.",
          };
          provider.lastCheck = { ...result, checkedAt: Date.now() };
          return result;
        }

        if (resp.status === 401 || resp.status === 403) {
          const authHint = provider.apiKeyEnv ? `Set ${provider.apiKeyEnv}.` : "Set API key.";
          const result = {
            connected: false,
            status: resp.status,
            message: `Authentication required (HTTP ${resp.status}). ${authHint}`,
          };
          provider.lastCheck = { ...result, checkedAt: Date.now() };
          return result;
        }

        const result = {
          connected: false,
          status: resp.status,
          message: `Endpoint returned HTTP ${resp.status}`,
        };
        provider.lastCheck = { ...result, checkedAt: Date.now() };
        return result;
      }

      const result = {
        connected: false,
        status: 0,
        message: "Maximum redirects reached without terminal response.",
      };
      provider.lastCheck = { ...result, checkedAt: Date.now() };
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const safeMsg = sanitizeSecrets(msg, [apiKey]);
      const result = {
        connected: false,
        status: 0,
        message: safeMsg.includes("abort") ? "Connection timed out." : `Connection failed: ${safeMsg}`,
      };
      provider.lastCheck = { ...result, checkedAt: Date.now() };
      return result;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * Generate structured diagnostics for doctor and providers commands.
   */
  getDiagnosticReport(): ProviderDiagnosticReport {
    const providersList = this.list();
    const items = providersList.map((p) => {
      const hasAuth = Boolean(this.resolveApiKey(p.id));
      const connected = p.lastCheck?.connected ?? false;
      const statusMessage = p.lastCheck?.message || (p.enabled ? "Not probed" : "Disabled");
      return {
        id: p.id,
        name: p.name,
        locality: p.locality,
        baseUrl: p.baseUrl,
        hasAuth,
        connected,
        modelsCount: p.models.length,
        statusMessage,
      };
    });

    const localCount = items.filter((i) => i.locality === "local").length;
    const cloudCount = items.filter((i) => i.locality === "remote").length;
    const totalModels = items.reduce((acc, i) => acc + i.modelsCount, 0);

    return {
      providers: items,
      totalModels,
      localProvidersCount: localCount,
      cloudProvidersCount: cloudCount,
    };
  }

  toProviderInfos(): ProviderInfo[] {
    return this.list().map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      locality: p.locality,
      requiresAuth: Boolean(p.apiKeyEnv || p.apiKey),
      hasAuth: Boolean(this.resolveApiKey(p.id)),
      isConnected: p.lastCheck?.connected ?? false,
      models: p.models,
      error: p.lastCheck && !p.lastCheck.connected ? p.lastCheck.message : undefined,
    }));
  }
}
