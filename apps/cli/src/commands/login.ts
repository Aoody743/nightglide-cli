import readline from "node:readline";
import { OmpAuthAdapter, type ProviderAuthType, normalizeSubscriptionProviderId } from "@nightglide/providers";

const OFFICIAL_SUBSCRIPTION_PROVIDERS = [
  { id: "openai-codex", alias: "codex", name: "ChatGPT Plus/Pro (Codex Subscription)" },
  { id: "github-copilot", alias: "copilot", name: "GitHub Copilot" },
  { id: "anthropic", alias: "claude", name: "Claude CLI Token / Anthropic Subscription" },
  { id: "google-gemini-cli", alias: "gemini-cli", name: "Google Cloud Code Assist (Gemini CLI)" },
  { id: "antigravity-cli", alias: "antigravity", name: "Antigravity CLI" },
  { id: "cursor", alias: "cursor", name: "Cursor" },
];

const CUSTOM_API_PROVIDERS = [
  { id: "openai", name: "OpenAI Platform (GPT-4o, o3-mini)" },
  { id: "deepseek", name: "DeepSeek (V3, R1 Reasoning)" },
  { id: "siliconflow", name: "SiliconFlow (Cloud Qwen & DeepSeek Gateway)" },
  { id: "openrouter", name: "OpenRouter Multi-Model Gateway" },
  { id: "omlx", name: "Local oMLX (Apple Silicon MLX)", isLocal: true },
  { id: "ollama", name: "Local Ollama (Local Hardware)", isLocal: true },
];

function formatAuthBadge(type: ProviderAuthType | "local_zero_cost"): string {
  switch (type) {
    case "official_subscription":
      return "\x1b[1;32m[SUBSCRIPTION ACTIVE]\x1b[0m";
    case "custom_api_key":
      return "\x1b[1;36m[API KEY CONFIGURED]\x1b[0m";
    case "local_zero_cost":
      return "\x1b[1;32m[LOCAL (ZERO-COST)]\x1b[0m";
    case "unauthenticated":
    default:
      return "\x1b[1;33m[NOT AUTHENTICATED]\x1b[0m";
  }
}

/**
 * Print authentication status overview for all dual auth choices.
 */
export async function printAuthStatus(adapter: OmpAuthAdapter): Promise<void> {
  console.log(`
==============================================================
  NIGHTGLIDE AUTHENTICATION & CREDENTIAL STATUS
  "Build beyond the horizon."
==============================================================
`);

  console.log("\x1b[1m[1] 官方订阅登录 / Official Subscription Login\x1b[0m");
  for (const p of OFFICIAL_SUBSCRIPTION_PROVIDERS) {
    const authType = await adapter.getProviderAuthType(p.id);
    const badge = formatAuthBadge(authType);
    console.log(`  • ${p.name.padEnd(46)} ${badge}`);
    console.log(`    命令: nightglide login ${p.alias}`);
  }

  console.log("\n\x1b[1m[2] 第三方 API Key / Custom Provider\x1b[0m");
  for (const p of CUSTOM_API_PROVIDERS) {
    if (p.isLocal) {
      const authType = await adapter.getProviderAuthType(p.id);
      const badge = authType === "custom_api_key" ? formatAuthBadge("custom_api_key") : formatAuthBadge("local_zero_cost");
      console.log(`  • ${p.name.padEnd(46)} ${badge}`);
      console.log(`    物理端点: http://localhost:11434 (无需网络与费用)`);
    } else {
      const authType = await adapter.getProviderAuthType(p.id);
      const badge = formatAuthBadge(authType);
      console.log(`  • ${p.name.padEnd(46)} ${badge}`);
      console.log(`    命令: nightglide login ${p.id} --key <sk-...>`);
    }
  }

  console.log("\n==============================================================\n");
}

/**
 * CLI command to log in or configure provider authentication.
 */
export async function runLoginCommand(argv: string[] = []): Promise<void> {
  const adapter = new OmpAuthAdapter();

  // Parse arguments
  const args = [...argv];
  const isStatus = args.includes("--status") || args.includes("-s") || args.includes("status");

  let provider: string | undefined;
  let apiKey: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--key" || arg === "-k") {
      apiKey = args[i + 1];
      i++;
    } else if (arg.startsWith("--key=")) {
      apiKey = arg.slice(6);
    } else if (!arg.startsWith("-") && arg !== "status" && !provider) {
      provider = arg;
    }
  }

  if (isStatus || (!provider && !apiKey)) {
    await printAuthStatus(adapter);
    if (!provider) {
      console.log("用法示例:");
      console.log("  $ nightglide login codex                  # 官方订阅 OAuth 登录");
      console.log("  $ nightglide login copilot                # GitHub Copilot 设备授权");
      console.log("  $ nightglide login openai --key sk-...    # 配置第三方 API Key");
      console.log("  $ nightglide login --status               # 检查所有提供商认证状态\n");
    }
    return;
  }

  if (apiKey) {
    // Custom API key configuration flow
    await adapter.setCustomApiKey(provider!, apiKey);
    console.log(`\n\x1b[32m✔ 成功配置 ${provider} 的 API Key: ${formatAuthBadge("custom_api_key")}\x1b[0m\n`);
    return;
  }

  // Official Subscription OAuth Login flow
  const targetId = normalizeSubscriptionProviderId(provider!);
  const isOfficial = OFFICIAL_SUBSCRIPTION_PROVIDERS.some(
    (p) => p.id === targetId || p.alias === provider!.toLowerCase()
  );

  if (isOfficial) {
    console.log(`\n正在启动 ${provider} 的官方订阅认证流程...\n`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    try {
      await adapter.loginOfficialSubscription(provider!, {
        openBrowser: true,
        onAuth: (info) => {
          console.log("\x1b[1m请在浏览器中打开以下链接完成认证授权:\x1b[0m");
          console.log(`\x1b[36m${info.url}\x1b[0m`);
          if (info.instructions) {
            console.log(`\n说明: ${info.instructions}`);
          }
          console.log("");
        },
        onProgress: (message) => {
          console.log(`• ${message}`);
        },
        onPrompt: (p) => {
          return new Promise<string>((resolve) => {
            rl.question(`${p.message} `, (ans) => {
              resolve(ans.trim());
            });
          });
        },
      });

      console.log(`\n\x1b[32m✔ ${provider} 官方订阅登录成功！${formatAuthBadge("official_subscription")}\x1b[0m\n`);
    } catch (err: unknown) {
      console.error(`\n\x1b[31m✖ 登录未完成: ${err instanceof Error ? err.message : String(err)}\x1b[0m\n`);
    } finally {
      rl.close();
    }
  } else {
    // Non-OAuth provider without --key: prompt user to enter key
    console.log(`提供商 '${provider}' 为第三方 API Key 提供商。`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`请输入 ${provider} API Key: `, async (key) => {
      rl.close();
      const trimmed = key.trim();
      if (!trimmed) {
        console.log("\x1b[33m未输入密钥，操作已取消。\x1b[0m\n");
        return;
      }
      await adapter.setCustomApiKey(provider!, trimmed);
      console.log(`\n\x1b[32m✔ 成功配置 ${provider} API Key: ${formatAuthBadge("custom_api_key")}\x1b[0m\n`);
    });
  }
}
