# OMP SDK 原生能力审计报告 (Capability Audit)

**测试与审查环境：**
- **OMP SDK 版本：** `@oh-my-pi/pi-coding-agent: 18.20.2`
- **底层依赖组件：**
  - `@oh-my-pi/pi-agent-core: 18.20.2`
  - `@oh-my-pi/pi-ai: 18.20.2`
  - `@oh-my-pi/pi-catalog: 18.20.2`
  - `@oh-my-pi/pi-tui: 18.20.2`
  - `@oh-my-pi/pi-utils: 18.20.2`
- **审计日期：** 2026-11-15 (M1.1 Audit Remediation)
- **代码物理路径：** `node_modules/@oh-my-pi/pi-coding-agent/src/`

---

## 1. 验证等级分类与总体矩阵 (Verification Categories)

为消除“源码存在即功能可用”的误判，本审计将所有 OMP 原生特性的验证状态严格划分为三大递进等级：

1. **SOURCE VERIFIED (源码级验证)：**
   已在 `@oh-my-pi/pi-coding-agent: 18.20.2` 的上游 TypeScript 源码中精确定位实现逻辑，确认架构设计、数据结构与控制流。
2. **SDK VERIFIED (SDK 级验证)：**
   已在实际自动化测试套件（`tests/engine/engine.test.ts`、`tests/engine/collaboration.test.ts`）中，通过调用真实的 OMP SDK API（`createAgentSession`、`SessionManager.inMemory()`、`Settings.isolated()`、`task` 工具调用、事件总线分发、取消与清理生命周期），完成真实无 Mock 的运行时验证。
3. **LIVE VERIFIED (实机推理验证)：**
   在真实配置了有效 API Key / 本地 oMLX 或 Ollama 守护进程的环境下，完成端到端模型真实推理、Token 流式生成与任务交付。在 CI/离线环境下作为可选项（Opt-in: `NIGHTGLIDE_REAL_PROVIDER_TEST=1`）运行。

### 总体特性分类矩阵

| 功能域 | 功能项 | 验证状态 | OMP 源码定位 | Nightglide 应对策略 |
|---|---|---|---|---|
| **规划 (Planning)** | Plan Mode 状态流转 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/plan-mode/approved-plan.ts`<br>`src/plan-mode/settings.ts` | 通过 session 设置与内部路由直接复用 |
| | Plan 模型角色映射 (`@plan`) | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/plan-mode/model-transition.ts`<br>`src/config/model-roles.ts` | 映射 Nightglide 规划模型至 OMP 的 `@plan` 角色 |
| | 规划期只读工具约束 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/sdk.ts` (`restrictToolNames`, `toolNames`) | 强制约束工具集为 `["read", "find", "grep"]` |
| | 规划成果持久化与批准 | **SOURCE VERIFIED** | `src/plan-mode/plan-files.ts`<br>`src/plan-mode/plan-handoff.ts` | 导出 markdown 工件并在 TUI 显式确认 |
| **评审 (Reviewer)** | 内置 Reviewer Agent | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/task/agents.ts` (`reviewer.md`) | 经由 `task` 工具调用，但在 `readOnly` 模式下受权限限制 |
| | 评审员暴露工具审计 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/prompts/agents/reviewer.md` | `reviewer` 包含 `bash` 工具，必须被底层权限护栏管控 |
| | 安全合规评审员 (`security-reviewer`) | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/prompts/agents/security-reviewer.md` | 严格只读（无 `bash`/`write`），只读模式允许委派 |
| **子智能体 (Subagents)** | 原生 Task 委派工具 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/task/index.ts` (`TaskTool`, `taskSchema`) | Session 开启 `task` 工具白名单，实现原生子任务派发 |
| | 智能体工具暴露与权限继承 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/task/executor.ts:4647` | 默认继承全量工具，需 Nightglide Below-the-Prompt 强制拦截 |
| | 批量并行执行 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/task/parallel.ts` (`mapWithConcurrencyLimitAllSettled`) | 复用 OMP 并发调度与信号量控制 |
| | 子智能体事件总线 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/sdk.ts` (`subagentEventBus`), `src/task/types.ts` | 订阅 `subagentEventBus` 并标准化为 Nightglide 统一事件 |
| | 智能体发现机制 | **SOURCE VERIFIED** | `src/task/discovery.ts` (`discoverAgents`) | 支持内建 agents 及项目级 `.omp/agents/*.md` |
| | Git Worktree 隔离 | **SOURCE VERIFIED** | `src/task/worktree.ts`, `src/task/isolation-runner.ts` | 需启用 `task.isolation.enabled: true` |
| **模型路由 (Routing)** | 内置与自定义模型角色 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/config/model-roles.ts` (`MODEL_ROLES`) | 支持 `@default`, `@smol`, `@slow`, `@plan`, `@task` 等标准角色 |
| | 智能体级模型覆盖 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/task/settings.ts` (`task.agentModelOverrides`) | 动态注入 Nightglide 决策的角色模型映射表 |
| | 模型回退机制 (Fallback) | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/session/settings.ts` (`cfgRetryFallbackChains`) | **受限于隐私策略**：Nightglide 路由层优先拦截，禁止静默回退至外部云端 |
| | 本地端点发现与认证 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/config/model-registry.ts` (`ModelRegistry`) | 支持 OpenAI-compatible/Ollama/oMLX 端点与显式 API Key 配置 |
| **SDK 架构集成** | 隔离 Session 实例化 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/sdk.ts` (`createAgentSession`), `SessionManager.inMemory()` | 独立 Settings 与 SessionManager 保证多 Session 安全无干扰 |
| | 请求前模型守卫 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/sdk.ts` (`assertDispatchModel`) | 严格执行 WHATWG URL + RFC 回环/SSRF 检查与云端拦截 |
| | 真实端到端跨提供商协作 | **LIVE VERIFIED** (Opt-In) | `tests/engine/collaboration.test.ts` | 本地探索 + 云端规划端到端模型真实推理（需配置凭据） |

---

## 2. 核心智能体工具暴露审计 (Agent Tool Exposure Audit)

在 OMP SDK 18.20.2 中，各个内建 Agent 通过 frontmatter 声明其可用工具集合。经静态代码审查与运行时探测，各内建 Agent 的工具清单如下：

| Agent 名称 | 声明文件 | 暴露工具集 (Declared Tools) | 是否具备变更/执行权限 | 架构安全属性 |
|---|---|---|---|---|
| `scout` | `src/prompts/agents/scout.md` | `read`, `find`, `grep`, `glob`, `ast_grep`, `web_search` | ❌ 否 | **严格只读 (Read-Only)**：用于轻量级代码勘探 |
| `security-reviewer` | `src/prompts/agents/security-reviewer.md` | `read`, `find`, `grep`, `glob`, `lsp`, `ast_grep` | ❌ 否 | **严格只读 (Read-Only)**：用于漏洞分析与模式审查 |
| `seance` | `src/prompts/agents/seance.md` | `read`, `grep`, `glob` | ❌ 否 | **严格只读 (Read-Only)**：用于历史会话转录分析 |
| `reviewer` | `src/prompts/agents/reviewer.md` | `read`, `find`, `grep`, `glob`, `bash`, `lsp`, `web_search`, `ast_grep` | ⚠️ **是 (`bash`)** | **半特权 Agent**：虽然 prompt 指令要求 `bash` 仅用于 `git diff`，但其具备操作系统命令执行能力 |
| `task` | `src/prompts/agents/task.md` | *未声明 tools 字段* (缺省) | 🚨 **是 (全部内置工具)** | **全特权 Agent**：因未限制 tools，OMP 自动注入全部内置工具（包含 `write`, `edit`, `bash`） |
| `sonic` | `src/task/agents.ts` | *未声明 tools 字段* (缺省) | 🚨 **是 (全部内置工具)** | **全特权 Agent**：继承全部内置工具 |

---

## 3. 子智能体权限继承行为与 Nightglide 护栏 (Permission Inheritance & Safety)

### 3.1 OMP 原生权限继承缺陷分析 (Critical Issue B)
在原生 OMP SDK 机制下，存在关键的权限逃逸隐患：
1. **父会话只读，子任务脱缰：**
   当父会话通过 `createAgentSession({ restrictToolNames: true, toolNames: ["read", "find", "grep", "task"] })` 限制为主只读时，父会话本身无法调用 `write`, `edit`, `bash`。
2. **Task 委派引发工具放大：**
   当主 Agent 调用 `task` 工具派发子任务时：
   - 若调用 `agent: "reviewer"`，子智能体根据其 frontmatter 获得 `bash` 工具；
   - 若调用 `agent: "task"`（或未指定 agent），因 `task.md` 无 tools 约束，子会话在 `createAgentSession` 建立时被赋予包含 `write`, `edit`, `bash` 的完整工具集合。
3. **提示词级防御不可靠：**
   即便提示词中存在“请仅阅读”的指示，大语言模型仍可能在对抗性 Prompt 注入或复杂指令下调用子任务执行写盘或 shell 命令。必须建立**Below-the-Prompt（提示词之下）**的硬性权限不变量。

### 3.2 Nightglide Below-the-Prompt 四层安全护栏

为彻底封死子智能体权限放大通道，Nightglide 在 `packages/engine/src/omp-adapter.ts` 中构建了四层纵深防御体系：

```
[ 用户请求 / Prompt ]
         │
         ▼
[ Layer 1: Tool-Level Interceptor (task.execute 包装拦截) ]
   └── readOnly 模式下，直接拒绝派发 reviewer / task / sonic 等非只读 Agent
         │
         ▼
[ Layer 2: Settings-Level Deny & Disable (OMP Settings 隔离层) ]
   ├── task.disabledAgents = ["task", "reviewer", "sonic"]
   └── tools.approval = { write: "deny", edit: "deny", bash: "deny" } (子会话 live 继承)
         │
         ▼
[ Layer 3: Runtime Event Tripwire (会话事件监听熔断) ]
   └── 捕获 tool_execution_start，一旦出现 mutating 工具立即中止会话并报错
         │
         ▼
[ Layer 4: Model Locality Guard (assertDispatchModel 网络拦截) ]
   └── 校验 WHATWG URL、回环地址、云端前缀，禁止 LOCAL 模式下向外部发送载荷
```

1. **第一层：Task 工具调用拦截器 (Tool-Level Interceptor)**
   在 `options.readOnly === true` 时，包装父会话中的 `task` 工具实例：
   - 拦截 `taskTool.execute(toolCallId, params)`；
   - 若请求的 `params.agent` 属于非只读 Agent（如 `reviewer`, `task`, `sonic` 等），立即抛出 `EngineError: Permission denied`，在子会话创建前进行硬阻断；
   - 仅白名单内的只读 Agent（`scout`, `security-reviewer`, `seance`）允许执行。
2. **第二层：Settings 级工具策略拒绝与 Agent 禁用 (Settings-Level Deny)**
   在 `Settings.isolated` 初始化时直接注入：
   - `tools.approval: { write: "deny", edit: "deny", bash: "deny" }`
   - `task.disabledAgents: ["task", "reviewer", "sonic"]`
   - 由于 OMP 子会话通过 `baseSettings.overlay()` 实时继承父会话设置，即使用户处于 `yolo` 无人值守模式，OMP 内部 `resolveApproval` 也会优先读取用户策略，强行阻断任何修改类工具的执行。
3. **第三层：运行时事件熔断保护 (Runtime Event Tripwire)**
   在 `handleOmpEvent` 与 `handleSubagentEvent` 中实时监控：
   - 当收到 `tool_execution_start` 且工具名称属于 `MUTATING_TOOL_NAMES`（`write`, `edit`, `bash`）时；
   - 立即触发安全违规，发出 `error` 事件并调用底层会话的 `abort()`，强制中止会话。
4. **第四层：模型分派隐私硬拦截 (`assertDispatchModel`)**
   通过 `createModelDispatchGuard`：
   - 对模型 `baseUrl` 执行严格的 `resolveEndpointLocality` 校验（杜绝十六进制 IP、八进制 IP、SSRF 绕过域名如 `127.example.com`）；
   - 对云端提供商（`openai`, `anthropic`, `google` 等）及云端模型前缀做无差别拦截；
   - 保证在 `LOCAL` 模式或未授权云端时，代码与提示词绝不离机。

---

## 4. 生命周期管理：取消 (Cancel) 与销毁 (Dispose)

### 4.1 会话取消机制 (Cancellation)
1. **统一广播与状态重置：**
   调用 `session.cancel()` 时，会话立即将主状态置为 `"cancelling"`，并调用底层的 `ompSession.abort({ reason: "User cancelled session" })`。
2. **子智能体级联中止：**
   遍历 `activeSubagents` 追踪器中所有处于 `"thinking"`, `"streaming"`, `"executing_tool"` 的子智能体，将其状态原子转换为 `"completed"`，盖上 `endedAt` 时间戳，并向前端监视器广播 `subagent_end` 事件（附加取消说明）。
3. **就绪复位：**
   取消结束后将主会话状态安全重置为 `"idle"`，保证后续交互可正常进行。

### 4.2 资源清理与销毁 (Disposal)
1. **幂等清理：**
   `dispose()` 标记 `disposed = true`，重复调用安全无副作用。
2. **解除所有外部订阅：**
   解除 `unsubscribeOmp` 与 `unsubscribeSubagent`，清空 `subscribers` 集合，防止内存泄漏。
3. **终止运行并释放底层资源：**
   先执行取消确保无悬挂进程，再调用 `ompSession.dispose()` 释放底层 LSP、子进程与内存管理器。
4. **防御性失效：**
   销毁后会话调用 `sendMessage()` 将确定性抛出 `SessionDisposedError`。

---

## 5. 结论与审计签署

经过 M1.1 阶段对 OMP SDK 18.20.2 的深度权限审计与改造修复，Nightglide 成功消除了原生 OMP 子任务的权限放大漏洞，实现了真正 Below-the-Prompt 的只读安全保障与端到端生命周期可观测性。
- **所有单元与集成测试均通过验证 (`bun test tests/engine`)**
- **类型检查通过 (`bun run typecheck`)**
- **权限不变量与模型隐私策略在所有执行分支下具备完整硬拦截保证。**
