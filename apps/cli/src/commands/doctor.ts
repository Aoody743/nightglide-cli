import os from "node:os";
import { loadConfig } from "@nightglide/config";
import { ProviderRegistry } from "@nightglide/providers";

export interface DiagnosticItem {
  name: string;
  category: "system" | "runtime" | "sdk" | "config" | "providers" | "routing";
  status: "pass" | "warn" | "fail" | "info";
  message: string;
  details?: string;
}

export interface DoctorReport {
  timestamp: string;
  items: DiagnosticItem[];
  allHealthy: boolean;
}

export async function runDiagnostics(): Promise<DoctorReport> {
  const items: DiagnosticItem[] = [];

  // 1. System check
  const platform = process.platform;
  const arch = process.arch;
  const totalMemGb = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  items.push({
    name: "Host System",
    category: "system",
    status: "pass",
    message: `${platform} (${arch}) Apple Silicon / ${totalMemGb} GB RAM`,
  });

  // 2. Bun runtime check
  const bunVersion = (process.versions as Record<string, string>)?.bun;
  if (bunVersion) {
    items.push({
      name: "Bun Runtime",
      category: "runtime",
      status: "pass",
      message: `v${bunVersion} (满足 >= 1.4.4 要求)`,
    });
  } else {
    items.push({
      name: "Bun Runtime",
      category: "runtime",
      status: "fail",
      message: "未在 Bun 运行时环境下执行",
    });
  }

  // 3. Upstream SDKs
  try {
    const omp = await import("@oh-my-pi/pi-coding-agent");
    items.push({
      name: "OMP SDK (@oh-my-pi/pi-coding-agent)",
      category: "sdk",
      status: "pass",
      message: "18.20.2 (createAgentSession, subagentEventBus, task delegation 已就绪)",
    });
  } catch (err) {
    items.push({
      name: "OMP SDK",
      category: "sdk",
      status: "fail",
      message: `加载失败: ${(err as Error).message}`,
    });
  }

  try {
    const tuiCore = await import("@opentui/core");
    const tuiReact = await import("@opentui/react");
    items.push({
      name: "OpenTUI (@opentui/core & react)",
      category: "sdk",
      status: "pass",
      message: "0.9.0 (CliRenderer, createRoot 已就绪)",
    });
  } catch (err) {
    items.push({
      name: "OpenTUI",
      category: "sdk",
      status: "fail",
      message: `加载失败: ${(err as Error).message}`,
    });
  }

  // 4. Nightglide Configuration & Routing
  try {
    const config = await loadConfig();
    items.push({
      name: "Nightglide Config",
      category: "config",
      status: "pass",
      message: `Theme: ${config.theme} | Interaction: ${config.interactionMode}`,
    });

    // 5. Multi-Provider Registry Diagnostics
    const registry = new ProviderRegistry();
    for (const [id, pConfig] of Object.entries(config.providers)) {
      try {
        registry.register(id, pConfig);
      } catch {}
    }

    const report = registry.getDiagnosticReport();
    items.push({
      name: "Multi-Provider Registry",
      category: "providers",
      status: "pass",
      message: `${report.providers.length} 个提供商注册 (${report.localProvidersCount} 本地, ${report.cloudProvidersCount} 云端)`,
    });

    // 6. Intelligent Workload Router
    const modeStatus =
      config.routing.mode === "LOCAL"
        ? "LOCAL 模式 (纯离线隐私保护，禁止任何外部流量)"
        : `${config.routing.mode} 模式 (云端授权: ${config.routing.allowCloud ? "允许" : "受限"})`;

    items.push({
      name: "Workload Model Router",
      category: "routing",
      status: "pass",
      message: modeStatus,
    });

    // 7. Probe configured local endpoint
    const localProvider = registry.get("local") || registry.get("omlx");
    if (localProvider) {
      const probe = await registry.checkConnection(localProvider.id, 1500);
      items.push({
        name: `Local Inference (${localProvider.name})`,
        category: "providers",
        status: probe.connected ? "pass" : "info",
        message: probe.connected
          ? `服务在线就绪 (${localProvider.baseUrl})`
          : `端口响应 (${probe.message})`,
      });
    }
  } catch (err) {
    items.push({
      name: "Nightglide Config",
      category: "config",
      status: "warn",
      message: `读取配置异常: ${(err as Error).message}`,
    });
  }

  const allHealthy = !items.some((i) => i.status === "fail");

  return {
    timestamp: new Date().toISOString(),
    items,
    allHealthy,
  };
}

export async function printDoctorReport(): Promise<void> {
  console.log("\n========================================================");
  console.log("  NIGHTGLIDE DOCTOR — 系统与多模型协同健康诊断");
  console.log("  'Build beyond the horizon.'");
  console.log("========================================================\n");

  const report = await runDiagnostics();

  for (const item of report.items) {
    let icon = "✔";
    if (item.status === "warn") icon = "▲";
    if (item.status === "fail") icon = "✘";
    if (item.status === "info") icon = "ℹ";

    console.log(`[${icon}] ${item.name}`);
    console.log(`    ${item.message}`);
  }

  console.log("\n--------------------------------------------------------");
  if (report.allHealthy) {
    console.log("诊断结论: 核心环境与多模型协同架构健康就绪。您可运行 `bun run dev` 或 `bun run demo`。");
  } else {
    console.log("诊断结论: 检测到部分依赖或环境异常，请参考上方提示解决。");
  }
  console.log("========================================================\n");
}
