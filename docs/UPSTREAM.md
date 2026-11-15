# 上游技术集成与依赖策略规范 (UPSTREAM)

本文档明确 Nightglide 对核心上游依赖库的技术架构契约、SDK 验证结论、隔离策略及知识产权合规边界。

---

## 1. 核心上游一览与许可证分析

| 组件名称 | 仓库与文档 | 已安装版本 | 许可证 | 合规与归属说明 |
| :--- | :--- | :--- | :--- | :--- |
| **Oh My Pi (OMP) SDK** | `https://github.com/can1357/oh-my-pi`<br>包名: `@oh-my-pi/pi-coding-agent` | `18.20.2` | **MIT License**<br>(Copyright Mario Zechner, Can Bölük, Stencil Labs) | 允许商业与开源集成。必须在发布制品中保留原始版权声明与许可全文。 |
| **OpenTUI Core** | `https://github.com/anomalyco/opentui`<br>包名: `@opentui/core` | `0.9.0` | **MIT License**<br>(Copyright opentui) | 原生与高性能终端渲染器，保留版权声明。 |
| **OpenTUI React** | `https://opentui.com/docs/bindings/react/`<br>包名: `@opentui/react` | `0.9.0` | **MIT License**<br>(Copyright opentui) | 基于 React Reconciler 的 TUI 声明式组件树层。 |

---

## 2. Oh My Pi (OMP) SDK 深度验证与隔离规范

### 2.1 实测导出的关键 API

经过在 Bun 1.4.4 环境下针对 `@oh-my-pi/pi-coding-agent` 18.20.2 的实装探测，验证以下核心 API 均存在且行为符合预期：
- `createAgentSession(options: CreateAgentSessionOptions): Promise<CreateAgentSessionResult>`
- `SessionManager.inMemory(): SessionManager`
- `Settings.isolated(overrides?, options?): Settings`
- `AuthStorage.create(dbPath, options)` / `discoverAuthStorage(agentDir)`
- `ModelRegistry`

### 2.2 Nightglide 隔离架构准则 (Mandatory Isolation)

为防止 Nightglide 静默继承宿主机上其他应用的未授权配置、插件或污染用户全局状态，本框架必须在 OMP 适配器中强制实施如下边界：

1. **会话存储隔离:**
   - M0 阶段强制使用 `SessionManager.inMemory()`，杜绝隐式读取其他产品的历史 Session JSONL。
2. **设置隔离:**
   - 强制使用 `Settings.isolated()` 实例化独立配置层，禁用环境继承。
3. **扩展与 MCP 隔离:**
   - 设置 `disableExtensionDiscovery: true` 与 `enableMCP: false`，禁止自动加载全局未审计的 Ambient Extension。
4. **工具权限白名单机制:**
   - 首期真实 SDK 探针只开放明确受限的只读工具白名单：
     `toolNames: ["read", "find", "grep"]`，并设置 `restrictToolNames: true`。
   - 严禁在 M0 烟雾测试中暴露 `bash`、`edit`、`write` 等具有副作用的工具。
5. **专用应用目录:**
   - 明确指定 Nightglide 自有的 `agentDir`（如 `~/.config/nightglide/agent` 或测试临时目录），绝不与 `~/.omp` 混用。

---

## 3. OpenTUI 终端交互渲染技术契约

### 3.1 渲染管道

- **渲染器初始化:** `const renderer = await createCliRenderer();`
- **React 挂载:** `const root = createRoot(renderer); root.render(<App />);`
- **生命周期清理:**
  - 监听进程 `SIGINT` / `SIGTERM` 与退出事件，确保调用 `renderer.destroy()` 并复原终端光标与 Raw 模式，防止终端花屏。
  - 容器尺寸自适应：通过 `useTerminalDimensions()` 动态监听终端 Resize 事件，安全适配 `80x24` 至超宽终端。

### 3.2 抽象解耦原则

- 所有的 UI 组件（`apps/cli/src/ui/**`）严禁直接导入或依赖 `@oh-my-pi/pi-coding-agent` 的内部类型。
- UI 层仅与 Nightglide 自身在 `packages/core` 定义的抽象合约 (`AgentEngine`, `AgentEvent`, `AgentSessionState`) 通信。
- 通过统一的事件分发总线，UI 可以无缝驱动真实 OMP Adapter 或 Deterministic `MockAgentEngine`，便于无模型环境下的测试与安全交互。

---

## 4. 架构参考与合规防线

- **参考项目:** `OpenCode` (`https://github.com/anomalyco/opencode`) 与 `Oh My OpenAgent` (`https://github.com/code-yeongyu/oh-my-openagent`)。
- **知识产权与合规要求:**
  - 仅参考其架构分层设计思想（例如适配器模式、事件归一化、多模态分发），**严禁直接复制**受限许可证的代码片段或非许可实现。
  - Nightglide 拥有完全自主设计的核心契约、主题系统、引导界面与配置加载器。
  - 所有引入的第三方依赖必须经过许可证审计（必须为 MIT、Apache 2.0 或 BSD 宽松协议）。
