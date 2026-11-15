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
| **评审 (Reviewer)** | 内置 Reviewer Agent | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/task/agents.ts` (`reviewer.md`) | OMP 原生驱动与执行，由原生工具审批机制管控 |
| | 评审员暴露工具审计 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/prompts/agents/reviewer.md` | `reviewer` 声明包含 `bash` 等工具，由 OMP 原生审批机制管控 |
| | 安全合规评审员 (`security-reviewer`) | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/prompts/agents/security-reviewer.md` | 严格只读（无 `bash`/`write`），原生直接委派 |
| **子智能体 (Subagents)** | 原生 Task 委派工具 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/task/index.ts` (`TaskTool`, `taskSchema`) | Session 原生支持 `task` 工具，实现原生子任务派发 |
| | 智能体工具暴露与权限继承 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/task/executor.ts:4647` | 由 OMP 原生工具审批机制 (Native Approval) 与沙箱管控 |
| | 批量并行执行 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/task/parallel.ts` (`mapWithConcurrencyLimitAllSettled`) | 复用 OMP 并发调度与信号量控制 |
| | 子智能体事件总线 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/sdk.ts` (`subagentEventBus`), `src/task/types.ts` | 订阅 `subagentEventBus` 并标准化为 Nightglide 统一事件 |
| | 智能体发现机制 | **SOURCE VERIFIED** | `src/task/discovery.ts` (`discoverAgents`) | 支持内建 agents 及项目级 `.omp/agents/*.md` |
| | Git Worktree 隔离 | **SOURCE VERIFIED** | `src/task/worktree.ts`, `src/task/isolation-runner.ts` | 需启用 `task.isolation.enabled: true` |
| **模型路由 (Routing)** | 内置与自定义模型角色 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/config/model-roles.ts` (`MODEL_ROLES`) | 支持 `@default`, `@smol`, `@slow`, `@plan`, `@task` 等标准角色 |
| | 智能体级模型覆盖 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/task/settings.ts` (`task.agentModelOverrides`) | 动态注入 Nightglide 决策的角色模型映射表 |
| | 模型回退机制 (Fallback) | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/session/settings.ts` (`cfgRetryFallbackChains`) | **受限于隐私策略**：Nightglide 路由层优先决策，禁止 LOCAL 模式回退至云端 |
| | 本地端点发现与认证 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/config/model-registry.ts` (`ModelRegistry`) | 支持 OpenAI-compatible/Ollama/oMLX 端点与显式 API Key 配置 |
| **SDK 架构集成** | 隔离 Session 实例化 | **SOURCE VERIFIED** & **SDK VERIFIED** | `src/sdk.ts` (`createAgentSession`), `SessionManager.inMemory()` | 独立 Settings 与 SessionManager 保证多 Session 安全无干扰 |
| | 隐私合规路由分派 | **SOURCE VERIFIED** & **SDK VERIFIED** | `@nightglide/routing` | 严格执行物理回环 Locality 判定与 LOCAL 模式云端禁止 |
| | 真实端到端跨提供商协作 | **LIVE VERIFIED** (Opt-In) | `tests/engine/collaboration.test.ts` | 本地探索 + 云端规划端到端模型真实推理（需配置凭据） |

---

## 2. 核心智能体工具暴露审计 (Agent Tool Exposure Audit)

在 OMP SDK 18.20.2 中，各个内建 Agent 通过 frontmatter 声明其可用工具集合。经静态代码审查与运行时探测，各内建 Agent 的工具清单如下：

| Agent 名称 | 声明文件 | 暴露工具集 (Declared Tools) | 是否具备变更/执行权限 | 架构安全属性与 OMP 原生管控 |
|---|---|---|---|---|
| `scout` | `src/prompts/agents/scout.md` | `read`, `find`, `grep`, `glob`, `ast_grep`, `web_search` | ❌ 否 | **只读探测 (Read-Only)**：轻量级代码勘探 |
| `security-reviewer` | `src/prompts/agents/security-reviewer.md` | `read`, `find`, `grep`, `glob`, `lsp`, `ast_grep` | ❌ 否 | **安全评审 (Read-Only)**：漏洞分析与模式审查 |
| `seance` | `src/prompts/agents/seance.md` | `read`, `grep`, `glob` | ❌ 否 | **会话分析 (Read-Only)**：历史会话转录分析 |
| `reviewer` | `src/prompts/agents/reviewer.md` | `read`, `find`, `grep`, `glob`, `bash`, `lsp`, `web_search`, `ast_grep` | ⚠️ **是 (`bash`)** | **代码质量评审**：声明 `bash` 用于 `git diff`，执行受 OMP 原生审批管控 |
| `task` | `src/prompts/agents/task.md` | *未声明 tools 字段* (缺省) | 🚨 **是 (全部内置工具)** | **通用任务 Agent**：继承全部内置工具，执行写操作受 OMP 原生审批管控 |
| `sonic` | `src/task/agents.ts` | *未声明 tools 字段* (缺省) | 🚨 **是 (全部内置工具)** | **极速任务 Agent**：继承全部内置工具，执行写操作受 OMP 原生审批管控 |

> [!NOTE]
> 在 M1.2 架构简化后，Nightglide 不再对 `reviewer`、`task` 或 `sonic` 施加人为禁用；所有涉及变更与命令执行的高危工具均由 OMP 原生工具审批机制 (Native Tool Approval) 和沙箱进行安全管控。

---

## 3. 子智能体原生执行与架构简化 (Native Agent Execution & Architecture Simplification)

### 3.1 原生 OMP 能力全面回归 (M1.2 Native Restoration)

在 M1.2 架构重构与简化中，Nightglide 彻底移除了早前审计阶段引入的多余自定义 4 层 Below-the-Prompt 拦截器，全面回归上游原生能力：
1. **移除自定义 Task 工具拦截器:** 不再对 `task.execute` 实施包装阻断，不再人工拒绝派发 `reviewer`、`task` 或 `sonic` 等智能体；
2. **移除强制 Settings 阻断注入:** 不再强行注入 `tools.approval: { write: "deny", edit: "deny", bash: "deny" }`，不再注入 `task.disabledAgents: ["task", "reviewer", "sonic"]`；
3. **移除运行时事件硬熔断 (Hard-Abort):** 不再在捕获 `tool_execution_start` 时强行中止会话，工具审批逻辑交还 OMP 原生审批流；
4. **移除自定义 TS 网络门禁:** 移除 `createModelDispatchGuard`/`assertDispatchModel` 自定义网络拦截钩子，由 `@nightglide/routing` 在任务指派阶段通过策略路由确定性保障 LOCAL 模式不选择云端模型。

### 3.2 权责划分架构原则 (Responsibility Boundaries)

Nightglide 坚持薄适配器架构（Thin SDK Adapter），与底层 OMP 形成明确互补与职责解耦：

- **OMP 原生拥有 (OMP SDK Owns):**
  - **工具执行与沙箱 (Tool Execution):** 负责所有内置工具（`read`, `write`, `edit`, `bash`, `find`, `grep`, `task` 等）的具体物理执行与隔离。
  - **工具可用性 (Tool Availability):** 工具注册、启用与发现。
  - **原生工具审批机制 (Native Tool Approval):** 确定何时需要审批并解析审批结果。
  - **智能体定义与生命周期 (Agent Definitions & Lifecycle):** 解析智能体 markdown 模板、派发与运行子智能体会话。
  - **任务委派机制 (Task Delegation):** 原生 `task` 工具调度子智能体。
  - **编码工具链:** 原生文件修改与 Shell 执行能力。
  - **内置智能体执行:** 原生 Reviewer 审查与 Plan 规划执行。
  - **底层会话取消:** 调用底层 `ompSession.abort()` 终止当前生成与任务。

- **Nightglide 拥有 (Nightglide Owns):**
  - **终端表现层 (TUI & Presentation):** 基于 OpenTUI 构建流式对话、工具审批卡片与交互组件。
  - **苍穹主题设计系统 (Celestial Themes):** Midnight Flight, Aurora, Cloudlight, Daybreak 及其无障碍对比度合规。
  - **多提供商注册表 (Provider Configuration & Registry):** 本地端点（oMLX, Ollama, LM Studio）与云端服务商（OpenAI, Anthropic, DeepSeek）的统一管理与端点物理 Locality 解析。
  - **任务意图与复杂度分类 (Task Classification):** 8 类任务意图识别与能力需求推导。
  - **任务到模型分配 (Task-to-Model Assignment):** 针对不同角色（`main`, `explore`, `plan`, `implement`, `review`）进行智能模型分配。
  - **4 大工作负载路由模式 (Routing Modes):** `LOCAL`, `BALANCED`, `PERFORMANCE`, `MANUAL` 策略矩阵与透明解释。
  - **多智能体协同监视 (Agent Visualization):** `AgentMonitor` 实时监视活跃子智能体状态、LOCAL/CLOUD 标签与 Token。
  - **环境诊断与错误报告 (Error Reporting & Doctor):** 提供 `nightglide doctor` 与强类型异常呈现。

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

经过 M1.2 原生 OMP 能力回归与架构简化，Nightglide 确立了清晰的薄适配器定位：底层工具执行、工具审批与智能体调度完全由 OMP 原生接管；表现层呈现、多提供商管理与策略模型路由由 Nightglide 专注驱动。
- **所有单元与集成测试均通过验证 (`bun test tests/engine`)**
- **类型检查通过 (`bun run typecheck`)**
- **原生代理能力（Reviewer、Task、Sonic 等）完整复用，系统架构保持极致精简与高健壮性。**
