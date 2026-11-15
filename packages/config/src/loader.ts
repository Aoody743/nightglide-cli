import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import type { NightglideConfig, InteractionMode, ProviderEndpointConfig } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";

/**
 * Determine the user configuration directory in a cross-platform manner.
 */
export function getConfigDir(): string {
  if (process.env.NIGHTGLIDE_CONFIG_DIR) {
    return process.env.NIGHTGLIDE_CONFIG_DIR;
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "nightglide");
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(xdgConfig, "nightglide");
}

export function getDefaultConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export function validateConfig(raw: unknown): ValidationResult<NightglideConfig> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, errors: ["Configuration root must be an object"] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  const version = typeof obj.version === "number" ? obj.version : DEFAULT_CONFIG.version;
  const theme = typeof obj.theme === "string" && obj.theme.trim() ? obj.theme.trim() : DEFAULT_CONFIG.theme;
  const interactionMode: InteractionMode =
    obj.interactionMode === "expert" || obj.interactionMode === "guided"
      ? obj.interactionMode
      : DEFAULT_CONFIG.interactionMode;
  const provider = typeof obj.provider === "string" ? obj.provider : DEFAULT_CONFIG.provider;
  const model = typeof obj.model === "string" ? obj.model : DEFAULT_CONFIG.model;

  const providers: Record<string, ProviderEndpointConfig> = {};
  if (obj.providers && typeof obj.providers === "object" && !Array.isArray(obj.providers)) {
    for (const [key, p] of Object.entries(obj.providers as Record<string, unknown>)) {
      if (p && typeof p === "object") {
        const pObj = p as Record<string, unknown>;
        providers[key] = {
          type: (typeof pObj.type === "string" ? pObj.type : "openai-compatible") as ProviderEndpointConfig["type"],
          baseUrl: typeof pObj.baseUrl === "string" ? pObj.baseUrl : "http://127.0.0.1:8000/v1",
          defaultModel: typeof pObj.defaultModel === "string" ? pObj.defaultModel : undefined,
        };
      }
    }
  } else {
    providers.local = { ...DEFAULT_CONFIG.providers.local };
  }

  const rawPerms = (obj.permissions && typeof obj.permissions === "object" ? obj.permissions : {}) as Record<string, unknown>;
  const permissions = {
    readOnly: typeof rawPerms.readOnly === "boolean" ? rawPerms.readOnly : DEFAULT_CONFIG.permissions.readOnly,
    requireToolConfirmation:
      typeof rawPerms.requireToolConfirmation === "boolean"
        ? rawPerms.requireToolConfirmation
        : DEFAULT_CONFIG.permissions.requireToolConfirmation,
    allowShellExecution:
      typeof rawPerms.allowShellExecution === "boolean"
        ? rawPerms.allowShellExecution
        : DEFAULT_CONFIG.permissions.allowShellExecution,
  };

  return {
    success: errors.length === 0,
    data: {
      version,
      theme,
      interactionMode,
      provider,
      model,
      providers,
      permissions,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function loadConfig(customPath?: string): Promise<NightglideConfig> {
  const filePath = customPath || getDefaultConfigPath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const validated = validateConfig(parsed);
    if (validated.success && validated.data) {
      return validated.data;
    }
    return DEFAULT_CONFIG;
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr?.code === "ENOENT") {
      // Configuration file does not exist yet; safe fallback
      return DEFAULT_CONFIG;
    }
    // Return default on syntax error or parse failure
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: NightglideConfig, customPath?: string): Promise<void> {
  const filePath = customPath || getDefaultConfigPath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const content = JSON.stringify(config, null, 2);
  await fs.writeFile(filePath, content, "utf-8");
}
