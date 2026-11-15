import { loadConfig } from "@nightglide/config";
import { ProviderRegistry } from "@nightglide/providers";
import type { AgentRole } from "@nightglide/core";

export async function runModelsCommand(): Promise<void> {
  const config = await loadConfig();
  const registry = new ProviderRegistry();

  for (const [id, pConfig] of Object.entries(config.providers)) {
    try {
      registry.register(id, pConfig);
      // Register default model if specified
      if (pConfig.defaultModel) {
        registry.registerModel(id, pConfig.defaultModel, { isDefault: true });
      }
    } catch {}
  }

  // Also include role assignment models if present
  for (const [role, modelId] of Object.entries(config.routing.roleAssignments)) {
    if (modelId) {
      const parts = modelId.split("/");
      const pId = parts[0];
      const mId = parts.slice(1).join("/");
      if (pId && mId && registry.has(pId) && !registry.getModel(modelId)) {
        registry.registerModel(pId, mId, { name: mId });
      }
    }
  }

  console.log(`
==============================================================
  NIGHTGLIDE MODELS — 已知模型与角色分配视图
  "Build beyond the horizon."
==============================================================
`);

  console.log(`当前路由模式: \x1b[1m${config.routing.mode}\x1b[0m | 云端授权: ${config.routing.allowCloud ? "\x1b[32m已授权 (Allowed)\x1b[0m" : "\x1b[33m已锁定 (Forbidden)\x1b[0m"}\n`);

  console.log("─── 智能体角色映射 (Role Assignments) ───");
  const roles: AgentRole[] = ["main", "explore", "plan", "implement", "review", "scout"];
  for (const r of roles) {
    const assigned = config.routing.roleAssignments[r] || "(未指定，遵循模式策略)";
    console.log(`  • ${r.toUpperCase().padEnd(10)}: ${assigned}`);
  }
  console.log("");

  console.log("─── 已知可用模型清单 (Models) ───");
  const allModels = registry.listModels();
  if (allModels.length === 0) {
    console.log("  [!] 暂无已注册的模型描述符。可通过配置文件或 TUI 设置添加模型。\n");
  } else {
    for (const m of allModels) {
      const locTag = m.locality === "local" ? "\x1b[32m[LOCAL]\x1b[0m" : "\x1b[36m[CLOUD]\x1b[0m";
      const caps = m.capabilities.join(", ");
      console.log(`  • \x1b[1m${m.id}\x1b[0m ${locTag}`);
      console.log(`    名称: ${m.name} | 能力: [${caps}]`);
    }
  }

  console.log("\n==============================================================\n");
}
