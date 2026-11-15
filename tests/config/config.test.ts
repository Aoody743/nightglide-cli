import { describe, test, expect } from "bun:test";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  DEFAULT_CONFIG,
  validateConfig,
  loadConfig,
  saveConfig,
  getDefaultConfigPath,
  getConfigDir,
} from "@nightglide/config";

describe("Configuration Package", () => {
  test("DEFAULT_CONFIG has expected schema defaults", () => {
    expect(DEFAULT_CONFIG.version).toBe(1);
    expect(DEFAULT_CONFIG.theme).toBe("midnight-flight");
    expect(DEFAULT_CONFIG.interactionMode).toBe("guided");
    expect(DEFAULT_CONFIG.provider).toBe("local");
    expect(DEFAULT_CONFIG.permissions.readOnly).toBe(true);
    expect(DEFAULT_CONFIG.providers.local.baseUrl).toBe("http://127.0.0.1:8000/v1");
    expect(DEFAULT_CONFIG.routing.mode).toBe("LOCAL");
    expect(DEFAULT_CONFIG.routing.allowCloud).toBe(false);
    expect(DEFAULT_CONFIG.routing.roleAssignments.main).toBe("");
  });

  test("validateConfig handles multi-provider and routing configurations", () => {
    const raw = {
      version: 1,
      theme: "aurora",
      interactionMode: "expert",
      provider: "local",
      model: "test-model",
      providers: {
        local: {
          type: "openai-compatible",
          baseUrl: "http://127.0.0.1:8000/v1",
          locality: "local",
          displayName: "oMLX Local",
        },
        cloud_openai: {
          type: "openai-compatible",
          baseUrl: "https://api.openai.com/v1",
          locality: "remote",
          displayName: "OpenAI Cloud",
          apiKeyEnv: "OPENAI_API_KEY",
        },
      },
      routing: {
        mode: "BALANCED",
        allowCloud: true,
        roleAssignments: {
          main: "cloud_openai/gpt-4o",
          explore: "local/qwen2.5-coder",
        },
        fallbackAssignments: {
          main: ["local/qwen2.5-coder"],
        },
        maxConcurrency: 3,
      },
      permissions: {
        readOnly: false,
        requireToolConfirmation: true,
        allowShellExecution: false,
      },
    };

    const res = validateConfig(raw);
    expect(res.success).toBe(true);
    expect(res.data?.providers.cloud_openai).toBeDefined();
    expect(res.data?.providers.cloud_openai.locality).toBe("remote");
    expect(res.data?.routing.mode).toBe("BALANCED");
    expect(res.data?.routing.allowCloud).toBe(true);
    expect(res.data?.routing.roleAssignments.main).toBe("cloud_openai/gpt-4o");
    expect(res.data?.routing.fallbackAssignments?.main).toEqual(["local/qwen2.5-coder"]);
    expect(res.data?.routing.maxConcurrency).toBe(3);
  });

  test("validateConfig handles valid object", () => {
    const raw = {
      version: 1,
      theme: "aurora",
      interactionMode: "expert",
      provider: "local",
      model: "test-model",
      providers: {
        local: {
          type: "openai-compatible",
          baseUrl: "http://127.0.0.1:11434/v1",
        },
      },
      permissions: {
        readOnly: false,
        requireToolConfirmation: true,
        allowShellExecution: false,
      },
    };

    const res = validateConfig(raw);
    expect(res.success).toBe(true);
    expect(res.data?.theme).toBe("aurora");
    expect(res.data?.interactionMode).toBe("expert");
    expect(res.data?.providers.local.baseUrl).toBe("http://127.0.0.1:11434/v1");
  });

  test("validateConfig falls back safely on invalid root input", () => {
    const resNull = validateConfig(null);
    expect(resNull.success).toBe(false);

    const resArray = validateConfig(["invalid"]);
    expect(resArray.success).toBe(false);
  });

  test("validateConfig handles partial or missing fields with defaults", () => {
    const partial = {
      theme: "daybreak",
    };
    const res = validateConfig(partial);
    expect(res.success).toBe(true);
    expect(res.data?.theme).toBe("daybreak");
    expect(res.data?.version).toBe(1);
    expect(res.data?.interactionMode).toBe("guided");
    expect(res.data?.provider).toBe("local");
    expect(res.data?.providers.local).toBeDefined();
  });

  test("loadConfig returns default config when file does not exist", async () => {
    const nonExistentPath = path.join(os.tmpdir(), `nightglide-nonexistent-${Date.now()}.json`);
    const cfg = await loadConfig(nonExistentPath);
    expect(cfg.version).toBe(1);
    expect(cfg.theme).toBe("midnight-flight");
  });

  test("saveConfig and loadConfig roundtrip correctly", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nightglide-cfg-test-"));
    const tempPath = path.join(tempDir, "config.json");

    try {
      const customConfig = {
        ...DEFAULT_CONFIG,
        theme: "cloudlight",
        model: "custom-local-model",
      };

      await saveConfig(customConfig, tempPath);
      const loaded = await loadConfig(tempPath);

      expect(loaded.theme).toBe("cloudlight");
      expect(loaded.model).toBe("custom-local-model");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test("loadConfig gracefully handles corrupted JSON", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nightglide-corrupt-test-"));
    const tempPath = path.join(tempDir, "corrupt.json");

    try {
      await fs.writeFile(tempPath, "{ corrupted json syntax ...", "utf-8");
      const loaded = await loadConfig(tempPath);
      expect(loaded).toBeDefined();
      expect(loaded.theme).toBe("midnight-flight");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test("cross-platform config directory is resolved properly", () => {
    const dir = getConfigDir();
    expect(typeof dir).toBe("string");
    expect(dir.length).toBeGreaterThan(0);

    const defaultPath = getDefaultConfigPath();
    expect(defaultPath.endsWith("config.json")).toBe(true);
  });
});
