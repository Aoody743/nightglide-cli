# Nightglide 开发者与贡献者指南 (DEVELOPMENT)

> **"Build beyond the horizon." / "漫翔苍穹，构筑所想。"**

本文档面向 Nightglide 的核心开发者与开源贡献者，详细指导如何搭建环境、运行调试、执行测试、构建发布以及扩展适配器。

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

安装完成后，Bun 会自动解析并链接如下内部工作区包：
- `@nightglide/core`
- `@nightglide/config`
- `@nightglide/themes`
- `@nightglide/engine`
- `apps/cli`

---

## 3. 标准开发与执行命令

本仓库的所有主要任务均通过根目录 `package.json` 中的命令进行标准化编排：

| 任务说明 | 执行命令 | 对应子任务与底层行为 |
| :--- | :--- | :--- |
| **启动交互式 TUI** | `bun run dev` | 启动 `apps/cli` 入口，加载默认苍穹主题与引导界面 |
| **免 Key 演示模式** | `bun run demo` | 使用确定性 `MockAgentEngine` 启动流式交互与工具调用演示 |
| **系统与环境诊断** | `bun run doctor` | 检测 Bun、Git、OMP SDK、OpenTUI 及本地推理服务状态 |
| **全量类型检查** | `bun run typecheck` | 执行严格 TypeScript 编译器类型校验 (`tsc --noEmit`) |
| **执行自动化测试** | `bun test` | 执行 `tests/` 目录下的所有单元测试与集成测试 |
| **二进制编译构建** | `bun run build` | 编译打包独立可执行文件至 `dist/nightglide` |

---

## 4. 本地推理环境配置

Nightglide 遵循本地模型优先（Local-First）原则。若希望连接本地服务（如开发机上运行的 oMLX）：

### 4.1 配置文件方式

用户配置文件存储于标准跨平台配置目录中：
- macOS/Linux: `~/.config/nightglide/config.json`
- Windows: `%APPDATA%\nightglide\config.json`

基础配置示例：
```json
{
  "version": 1,
  "theme": "midnight-flight",
  "interactionMode": "guided",
  "provider": "local",
  "model": "local-model-id",
  "providers": {
    "local": {
      "type": "openai-compatible",
      "baseUrl": "http://127.0.0.1:8000/v1"
    }
  },
  "permissions": {
    "readOnly": true,
    "requireToolConfirmation": true,
    "allowShellExecution": false
  }
}
```

### 4.2 环境变量方式

复制模板并根据实际情况配置环境变量（注意切勿提交包含私密 Key 的 `.env`）：
```bash
cp .env.example .env
```

---

## 5. 调试 OMP 适配器 (`packages/engine`)

OMP 适配器运行于独立的隔离环境中。开发调试时注意：

1. **会话创建参数:**
   ```typescript
   import { OmpAgentEngine } from "@nightglide/engine";

   const engine = new OmpAgentEngine();
   const session = await engine.createSession({
     workspacePath: process.cwd(),
     readOnly: true,
   });
   ```
2. **事件监听订阅:**
   ```typescript
   const unsubscribe = session.subscribe((event) => {
     console.log("[Engine Event]", event.type, event);
   });
   ```
3. **安全终止与资源回收:**
   ```typescript
   await session.dispose();
   ```

---

## 6. 测试规范

- 测试框架统一使用 `bun:test`。
- 遵循 Arrange-Act-Assert (AAA) 结构。
- 严禁在测试中发起真实的付费 API 请求或依赖未启动的网络模型。
- 测试命令速查：
  ```bash
  bun test tests/config    # 配置模块测试
  bun test tests/engine    # 引擎适配器测试
  bun test tests/ui        # 终端 UI 状态测试
  bun test tests/integration # 端到端集成测试
  ```
