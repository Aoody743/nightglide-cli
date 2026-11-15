import { loadConfig } from "@nightglide/config";
import { ProviderRegistry } from "@nightglide/providers";

export async function runProvidersCommand(): Promise<void> {
  const config = await loadConfig();
  const registry = new ProviderRegistry();

  for (const [id, pConfig] of Object.entries(config.providers)) {
    try {
      registry.register(id, pConfig);
    } catch {}
  }

  console.log(`
==============================================================
  NIGHTGLIDE PROVIDERS — 模型提供商与端点状态
  "Build beyond the horizon."
==============================================================
`);

  const providers = registry.list();
  if (providers.length === 0) {
    console.log("  [!] 未配置任何 Provider。请运行 nightglide 进行初始化或检查配置文件。\n");
    return;
  }

  for (const p of providers) {
    const hasAuth = Boolean(registry.resolveApiKey(p.id));
    const localityTag = p.locality === "local" ? "\x1b[32m[LOCAL]\x1b[0m" : "\x1b[36m[CLOUD]\x1b[0m";
    const authStatus = hasAuth ? "\x1b[32m已认证 (API Key 就绪)\x1b[0m" : "\x1b[33m未配置密钥 (需要认证)\x1b[0m";

    console.log(`• 提供商 ID: \x1b[1m${p.id}\x1b[0m ${localityTag}`);
    console.log(`  显示名称: ${p.name}`);
    console.log(`  物理端点: ${p.baseUrl}`);
    console.log(`  兼容协议: ${p.type}`);
    console.log(`  认证状态: ${authStatus}`);

    // Probe connection status
    process.stdout.write("  端点探测: 正在测试连通性... ");
    const probe = await registry.checkConnection(p.id, 2500);
    if (probe.connected) {
      console.log(`\x1b[32m[在线] ${probe.message}\x1b[0m`);
    } else {
      console.log(`\x1b[33m[告警] (HTTP ${probe.status}) ${probe.message}\x1b[0m`);
    }
    console.log("");
  }

  const report = registry.getDiagnosticReport();
  console.log("--------------------------------------------------------------");
  console.log(`统计: ${report.localProvidersCount} 个本地端点, ${report.cloudProvidersCount} 个云端端点 (当前模式: ${config.routing.mode})`);
  console.log("==============================================================\n");
}
