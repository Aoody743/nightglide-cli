# Nightglide 开发者与贡献者指南 (DEVELOPMENT)

> **"Build beyond the horizon." / "漫翔苍穹，构筑所想。"**

本文档面向 Nightglide 的核心开发者与开源贡献者，详细指导如何搭建环境、运行调试、配置多模型提供商、执行工作负载路由与多智能体协作测试、构建发布以及扩展适配器。

---

## 1. 开发前置条件

- **操作系统:** macOS (Apple Silicon 推荐)、Linux (x86_64 / aarch64)、Windows 11 (WSL2 或原生终端)
- **运行时:** [Bun](https://bun.sh) **1.4.4+** (强制要求)
- **工具链:** Node.js v20+ (部分构建工具链)、Git 2.40+
- **本地 AI 推理 (可选):** [oMLX](https://github.com/can1357/omlx)、Ollama 或任意兼容 OpenAI `/v1` 协议的本地服务器。

---

## 2. 仓库克隆与依赖安装

```bash
# 1. 克隆代码仓库
git clone https://github.com/nightglide/nightglide.git
cd nightglide

# 2. 使用 Bun 按照 Monorepo 工作区安装所有依赖
bun install
```

安装完成后，Bun 会自动解析并链接内部工作区包：
- `@nightglide/core` (基础契约、事件与错误)
- `@nightglide/config` (多提供商与路由配置存储)
- `@nightglide/providers` (多提供商注册表与连通性探针)
- `@nightglide/routing` (任务分类与工作负载模型路由器)
- `@nightglide/engine` (OMP 原生任务适配器与确定性协作模拟器)
- `@nightglide/themes` (苍穹天象设计系统)
- `apps/cli` (Nightglide 终端交互应用)

---

## 3. 标准开发与执行命令

本仓库的所有主要任务均通过根目录 `package.json` 中的命令进行标准化编排：

| 任务说明 | 执行命令 | 对应子任务与底层行为 |
| :--- | :--- | :--- |
| **启动交互式 TUI** | `bun run dev` | 启动 `apps/cli` 入口，加载默认苍穹主题与引导界面 |
| **多智能体演示模式** | `bun run demo` | 启动确定性多 Agent 协同（本地 Explorer + 云端 Planner）离线演示 |
| **模型提供商检查** | `bun run apps/cli/src/index.ts providers` | 列出已配置提供商，严格检查物理 Locality 并探测端点健康 |
| **模型与角色分配** | `bun run apps/cli/src/index.ts models` | 展现已知模型清单与当前各 Agent 角色的分配矩阵 |
| **系统与环境诊断** | `bun run doctor` | 检测 Bun、Git、OMP SDK、OpenTUI、提供商注册表与路由状态 |
| **全量类型检查** | `bun run typecheck` | 执行严格 TypeScript 编译器类型校验 (`tsc --noEmit`) |
| **执行全量自动化测试** | `bun test` | 执行 `tests/` 目录下的所有单元测试与跨模型协同测试 (75+ 用例) |
| **应用构建打包** | `bun run build` | 编译打包独立可执行脚本至 `apps/cli/dist/nightglide.js` |

---

## 4. 多模型提供商与路由配置

Nightglide 遵循本地模型优先（Local-First）原则，同时支持与云端大模型无缝接力协作。

### 4.1 配置文件方式 (`~/.config/nightglide/config.json`)

配置示例：
```json
{
  "version": 1,
  "theme": "midnight-flight",
  "interactionMode": "guided",
  "provider": "local",
  "model": "omlx/qwen2.5-coder-7b",
  "providers": {
    "local": {
      "type": "openai-compatible",
      "baseUrl": "http://127.0.0.1:8000/v1",
      "displayName": "oMLX Local Inference",
      "locality": "local",
      "enabled": true
    },
    "openai": {
      "type": "openai-compatible",
      "baseUrl": "https://api.openai.com/v1",
      "displayName": "OpenAI Cloud Gateway",
      "locality": "remote",
      "apiKeyEnv": "OPENAI_API_KEY",
      "enabled": true
    }
  },
  "routing": {
    "mode": "BALANCED",
    "allowCloud": true,
    "roleAssignments": {
      "main": "openai/gpt-4o",
      "explore": "local/qwen2.5-coder-7b",
      "plan": "openai/gpt-4o",
      "implement": "local/qwen2.5-coder-7b",
      "review": "openai/gpt-4o"
    },
    "maxConcurrency": 2
  },
  "permissions": {
    "readOnly": true,
    "requireToolConfirmation": true,
    "allowShellExecution": false
  }
}
```

### 4.2 环境变量安全凭据配置

推荐将私密 API Key 导出为环境变量（绝不将 Key 明文保存在配置文件中）：
```bash
# 本地端点 (若需要认证)
export OMLX_API_KEY="your-omlx-api-key"

# 云端服务商凭据
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

---

## 5. 跨模型协作与测试规范

测试框架统一使用 `bun:test`。

### 5.1 模块测试套件速查
```bash
bun test tests/config/config.test.ts          # 配置校验与多 Provider 解析
bun test tests/providers/providers.test.ts    # 提供商注册表与网络 Locality 判定
bun test tests/routing/routing.test.ts        # 任务意图分类与工作负载路由器
bun test tests/engine/engine.test.ts          # OMP 适配器与 Mock 引擎单测
bun test tests/engine/collaboration.test.ts   # 跨 Provider 多 Agent 接力协同测试
bun test tests/ui/ui-state.test.ts            # TUI 状态机、多智能体监视与事件流累积
bun test tests/integration/cli.test.ts        # CLI 命令入口集成测试
```

### 5.2 真实双端点集成测试 (Opt-in Real Test)
若要在真实网络环境中验证两个真实 Provider 间的物理协作（需消耗 Token）：
```bash
export NIGHTGLIDE_REAL_PROVIDER_TEST=1
export OPENAI_API_KEY="sk-..."
export OMLX_API_KEY="..."

bun test tests/engine/collaboration.test.ts
```
若未设置 `NIGHTGLIDE_REAL_PROVIDER_TEST=1`，测试套件将自动跳过真实网络调用，依靠内置的高保真测试双工器（Test Doubles）实现毫秒级确定性通过。
