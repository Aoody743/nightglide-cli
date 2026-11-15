# OMP SDK 原生能力审计报告 (Capability Audit)

**测试与审查环境：**
- **OMP SDK 版本：** `@oh-my-pi/pi-coding-agent: 18.20.2`
- **底层依赖组件：**
  - `@oh-my-pi/pi-agent-core: 18.20.2`
  - `@oh-my-pi/pi-ai: 18.20.2`
  - `@oh-my-pi/pi-catalog: 18.20.2`
  - `@oh-my-pi/pi-tui: 18.20.2`
  - `@oh-my-pi/pi-utils: 18.20.2`
- **审计日期：** 2026-11-15
- **代码物理路径：** `node_modules/@oh-my-pi/pi-coding-agent/src/`

---

## 1. 总体结论与分类矩阵

根据对已安装 OMP SDK 源码（`src/` 目录）的全面深入审查，评估结果分类如下：

| 功能域 | 功能项 | 状态分类 | OMP 源码定位 | Nightglide 应对策略 |
|---|---|---|---|---|
| **规划 (Planning)** | Plan Mode 状态流转 | **Supported and verified** | `src/plan-mode/approved-plan.ts`<br>`src/plan-mode/settings.ts` | 通过 session 设置与内部路由直接复用 |
| | Plan 模型角色映射 (`plan` role) | **Supported and verified** | `src/plan-mode/model-transition.ts` (`resolvePlanModelTransition`) | 映射 Nightglide 规划模型至 OMP 的 `@plan` 角色 |
| | 规划期只读工具约束 | **Supported and verified** | `src/sdk.ts` (`restrictToolNames`, `toolNames`) | 强制约束工具集为 `["read", "find", "grep"]` |
| | 规划成果持久化与批准 | **Supported and verified** | `src/plan-mode/plan-files.ts`<br>`src/plan-mode/plan-handoff.ts` | 导出 markdown 工件并由用户在 TUI 明确批准 |
| **评审 (Reviewer)** | 内置 Reviewer Agent | **Supported and verified** | `src/task/agents.ts` (`EMBEDDED_AGENT_DEFS`, `reviewer.md`) | 直接通过原生 Task 委派机制调用 `reviewer` |
| | 评审模型绑定 | **Supported and verified** | `src/task/settings.ts` (`task.agentModelOverrides`) | 配置 `task.agentModelOverrides.reviewer` 绑定指定审查模型 |
| | 安全合规评审员 | **Supported and verified** | `src/prompts/agents/security-reviewer.md` | 支持调用内置 `security-reviewer` |
| **子智能体 (Subagents)** | 原生 Task 委派工具 | **Supported and verified** | `src/task/index.ts` (`taskSchema`, `taskItemSchema`) | Session 开启 `task` 工具白名单，实现原生子任务派发 |
| | 批量并行执行 | **Supported and verified** | `src/task/parallel.ts` (`mapWithConcurrencyLimitAllSettled`) | 复用 OMP 并发调度与信号量控制 |
| | 子智能体事件总线 | **Supported and verified** | `src/sdk.ts` (`subagentEventBus`), `src/task/types.ts` (`TASK_SUBAGENT_EVENT_CHANNEL`) | 订阅 `subagentEventBus` 并标准化为 Nightglide 统一事件 |
| | 智能体发现机制 | **Supported and verified** | `src/task/discovery.ts` (`discoverAgents`) | 支持内建 agents 及用户/项目级 `.omp/agents/*.md` |
| | Git Worktree 隔离 | **Supported but requires config** | `src/task/worktree.ts`, `src/task/isolation-runner.ts` | 需启用 `task.isolation.enabled: true`（注意：Worktree 不提供进程级沙箱） |
| **模型路由 (Routing)** | 内置与自定义模型角色 | **Supported and verified** | `src/config/model-roles.ts` (`MODEL_ROLES`, `getKnownRoleIds`) | 支持 `@default`, `@smol`, `@slow`, `@plan`, `@task` 等标准角色 |
| | 智能体级模型覆盖 | **Supported and verified** | `src/task/settings.ts` (`task.agentModelOverrides`) | 动态注入 Nightglide 决策的模型分配表 |
| | 模型回退机制 (Fallback) | **Supported but requires config** | `src/session/settings.ts` (`cfgRetryFallbackChains`) | **受限于隐私策略**：Nightglide 路由层必须优先拦截，禁止静默回退至外部云端 |
| | 本地端点发现与认证 | **Supported and verified** | `src/config/model-registry.ts` (`ModelRegistry`) | 支持 OpenAI-compatible/Ollama/oMLX 端点与显式 API Key 配置 |
| **SDK 架构集成** | 隔离 Session 实例化 | **Supported and verified** | `src/sdk.ts` (`createAgentSession`), `SessionManager.inMemory()` | 独立 Settings 与 SessionManager 保证多 Session 安全无干扰 |
| | 请求前模型守卫 | **Supported and verified** | `src/sdk.ts` (`assertDispatchModel`) | 拦截非预期越权模型分派 |

---

## 2. 深度特性审计详情

### 2.1 规划系统 (Planning Architecture)
- **代码依据：**
  - `src/plan-mode/model-transition.ts`：导出了 `resolvePlanModelTransition(currentModel, resolved, isStreaming)` 函数。该策略在进入规划模式时自动尝试切换至 `plan` 角色的模型，并在退出时恢复主模型。
  - `src/plan-mode/approved-plan.ts`：规范化计划产出为 `local://<slug>-plan.md`，并通过 `resolveApprovedPlan` 处理批准流程。
  - `src/plan-mode/settings.ts`：注册了 `plan.enabled`, `plan.defaultOnStartup`, `plan.autosave` 等配置项。
- **Nightglide 架构设计考量：**
  - Nightglide 将规划视为一等任务类别（`TaskCategory: "plan"`）。
  - 在规划执行期间，主 Session 启用只读工具集合（`read`, `find`, `grep`），杜绝未经批准的写入变更；
  - 规划生成后，展示规划报告卡片供用户在 TUI 显式确认，再流转至执行阶段。

### 2.2 评审系统 (Reviewer Architecture)
- **代码依据：**
  - `src/task/agents.ts`：内置嵌入式 Agents 列表 `EMBEDDED_AGENT_DEFS` 包含：
    - `scout.md`（代码侦察与探索）
    - `reviewer.md`（代码质量与逻辑评审）
    - `security-reviewer.md`（安全合规分析）
    - `task.md`（通用全功能子任务执行体）
    - `sonic.md`（低思考级轻量级执行体）
- **Nightglide 架构设计考量：**
  - 严禁在 Nightglide 中重新编写一套重复的评审 Agent 提示词。
  - 复用 OMP 原生 `reviewer` 与 `security-reviewer`，通过 `task.agentModelOverrides` 配置其使用的专有审查模型（例如将独立的 Cloud 强模型分配给 `reviewer`，而本地模型执行日常编码）。

### 2.3 子智能体与任务派发 (Subagents & Task System)
- **代码依据：**
  - `src/task/index.ts`：导出 `taskSchema` 与 `taskItemSchema`。支持单次任务调用与 `tasks` 数组批量派发。
  - `src/task/executor.ts`：子智能体拥有独立的生命周期管理，支持 `task.agentModelOverrides` 与 `assertDispatchModel`。
  - `src/sdk.ts`（第 1078 行）与 `src/task/types.ts`（第 35 行）：
    - `createAgentSession` 显式返回 `subagentEventBus`。
    - 子任务执行过程中，通过 `TASK_SUBAGENT_EVENT_CHANNEL = "task:subagent:event"` 广播 `{ id, event }`。
  - `src/task/parallel.ts`：OMP 具备内建信号量 `Semaphore`，并由 `task.maxConcurrency`（默认根据硬件并发度）控制最大并行派发数。
- **Nightglide 架构设计考量：**
  - Nightglide 核心适配器需捕获 `subagentEventBus`，将其归一化为 Nightglide 统一的 `AgentEvent`（附带子任务 ID、模型标识、角色与时间戳），向上直推给 TUI 的 **Agent Monitor（多智能体监视器）**。

### 2.4 模型路由与提供商机制 (Model Routing & Providers)
- **代码依据：**
  - `src/config/model-roles.ts`：定义了 16 个标准角色。`getKnownRoleIds` 允许通过 settings 动态扩展自定义角色。
  - `src/config/model-resolver.ts`：支持形如 `@plan`、`@task`、`@smol`、`openai/gpt-4o:high` 的选择器解析语法。
  - `src/config/model-registry.ts`：支持动态注册自定义 Provider（包括本地 oMLX、Ollama、LM Studio 以及远程 OpenAI-compatible 服务）。
  - `src/session/settings.ts`：`cfgRetryFallbackChains` 允许配置重试与回退链。
- **Nightglide 架构设计考量：**
  - **核心差异化价值：** OMP 原生的 Fallback 机制缺乏细粒度的**数据隐私合规边界**（它仅基于可用性重试）。如果一个配置了敏感代码的项目遭遇本地模型超时，原生 OMP 可能会直接根据备选链 fallback 到远程 OpenAI。
  - **Nightglide 强制安全守卫：**
    - 在 `LOCAL` 模式下，绝对禁止向任何外部非本地 IP 发送请求；
    - 在 `BALANCED` 模式下，仅当用户显式授权云端使用时，方可将特定非敏感任务路由或降级至云端；
    - 使用 `assertDispatchModel` 在请求真实发出前做硬拦截。

---

## 3. 已知限制与 SDK 版本边界 (Limitations)

1. **API Key 本地凭据隔离：**
   - 之前探测到的 `http://127.0.0.1:8000/v1` 返回 `401 Unauthorized`。OMP SDK 严格遵循授权校验，不会在缺少密钥时伪造成功状态。Nightglide 必须提供透明的配置路径让用户安全地指定环境变量或配置文件，不得尝试绕过认证。
2. **多并发顶层 Session 的注册表隔离：**
   - 若要同时运行多个平行的顶层 AgentSession，不能依赖单一全局 `agentDir`；必须为每个独立会话注入独立的 `SessionManager.inMemory()` 与 `Settings.isolated()`，避免全局模型缓存交叉污染。
3. **只读工具集的严格限制：**
   - M0 的 `omp-adapter.ts` 将工具硬编码限制在 `["read", "find", "grep"]`。为了让 Agent 能够派发原生子任务，工具白名单必须将 `task` 工具纳入，同时根据 Nightglide 权限策略（`permissions.readOnly`）决定是否开放写入和执行类工具。

---

## 4. M1 实施指导方针

- **架构原则：**
  1. **OMP 负责执行：** 工具调用、Agent 循环、子任务派发、原生 Reviewer / Scout 模板均复用 OMP。
  2. **Nightglide 负责统筹与呈现：** 任务工作负载分类、隐私策略决策、多 Provider 凭据管理、模型角色编排、事件归一化监视与 Celestial 四大天象主题 TUI。
- **下一步行动：**
  - 在 `packages/core` 中扩展多 Provider、多模型、路由决策与子任务事件的共享接口契约；
  - 扩展 `packages/config` 支持多 Provider 注册与任务路由配置；
  - 升级 `packages/engine` 中的 OMP 适配器，接入 `subagentEventBus` 与原生 `task` 支持；
  - 构建独立测试双工器（Test Doubles）验证在跨 Provider 协作场景下的全链路闭环。
