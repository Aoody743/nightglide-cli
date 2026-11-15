# NIGHTGLIDE M1.2 架构精简与原生 OMP 能力恢复报告
**M1.2 Architecture Simplification & Native OMP Restoration Report**

---

## A. 摘要 (Summary)

### 为什么执行本次重构？
在 Milestone M1.1 开发过程中，Nightglide 引入了一套不符合产品设计初衷的“Below-the-Prompt 四层安全拦截系统”。这套系统包括：
1. 父会话 `taskTool.execute` 猴子补丁与自定义 Agent 白名单拦截；
2. Settings 级别强制注入 `tools.approval: { write: "deny", edit: "deny", bash: "deny" }` 与 `task.disabledAgents: ["task", "reviewer", "sonic"]`，并将会话全局锁死为只读；
3. 基于事件流（`handleOmpEvent` / `handleSubagentEvent`）的写操作看门狗熔断器，在检测到写工具时硬终止会话；
4. 自定义模型分派守卫 `createModelDispatchGuard` 与 `assertDispatchModel` 钩子，试图在 TypeScript 层充当网络防火墙。

这些机制严重越权接管了底层 OMP（Oh-My-Pi）成熟的编码代理运行时，人为限制了内置 Agent（Reviewer、Task、Sonic 等）与原生编码工具（`write`、`edit`、`bash`）的正常调用，使得 Nightglide 沦为一个受限的“演示沙盒”，违背了让 Nightglide 成为 OMP 现代化 TUI 与智能模型路由编排层的核心定位。

### 移除了什么？
在 M1.2 中，我们彻底清除了这四层冗余的权限拦截体系，删除了所有夜翔自建的工具禁用列表、执行拦截器与事件流熔断逻辑，并将配置默认值恢复为非强制只读。Nightglide 彻底回归为 **Thin OMP SDK Adapter（轻量 OMP SDK 适配器）**，完全尊重并透传 OMP 原生工具执行、原生子智能体分派与原生审批策略。

---

## B. 代码与配置删除清单 (Deletion Inventory)

| 序号 | 移除系统 / 机制 | 原始文件 | 原始函数 / 标识符 | 涉及代码量 | 替代方案 | 移除原因 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Layer 1** | 自定义 Task 执行拦截器与 Agent 白名单 | `packages/engine/src/omp-adapter.ts` | `READ_ONLY_PERMITTED_AGENTS`, `taskTool.execute` 包装函数 | ~30 行 | 直接透传 OMP 原生 `task` 工具，由 OMP 自身控制子代理派发 | 人为阻断了 `task`、`reviewer`、`sonic` 等合法原生子代理的生成，违背原生能力复用原则 |
| **Layer 2** | Settings 强制只读与 Agent 禁用策略 | `packages/engine/src/omp-adapter.ts` | `baseOverrides["tools.approval"]`, `baseOverrides["task.disabledAgents"]`, `allowedTools` 只读裁切 | ~25 行 | 使用 `Settings.isolated()` 保持原生配置，默认不注入任何全局工具封禁 | 强制全局只读导致用户无法进行任何代码编辑与脚本执行 |
| **Layer 3** | 事件流安全熔断器 (Watchdog) | `packages/engine/src/omp-adapter.ts` | `MUTATING_TOOL_NAMES`, `handleOmpEvent` / `handleSubagentEvent` 中的 `abort()` 触发逻辑 | ~30 行 | 保留事件归一化供 TUI（`AgentMonitor` / `ChatScreen`）可视化渲染，不再中止会话 | 阻断正常写工具事件流，破坏长任务连续性 |
| **Layer 4** | 自定义模型分派网络守卫 | `packages/engine/src/omp-adapter.ts`, `packages/engine/src/index.ts` | `createModelDispatchGuard`, `assertDispatchModel` 钩子回调 | ~90 行 | 职责归位至 `@nightglide/routing` 的 `WorkloadModelRouter` 策略层进行选模 | 不在 SDK 适配器内构建二次 TypeScript 网络防火墙，由路由策略负责端点与模型选择 |
| **Config** | 全局默认只读配置与无用权限约束 | `packages/config/src/defaults.ts`, `schema.ts`, `loader.ts` | `DEFAULT_CONFIG.permissions.readOnly: true` | ~20 行 | 默认配置 `readOnly: false`，`permissions` 标记为可选并平滑兼容迁移 | 消除全局只读假象，允许用户开箱即用正常编写代码 |
| **Router** | 无用异常依赖 | `packages/routing/src/router.ts` | `RoutingPolicyViolationError` 冗余导入 | 1 行 | 仅保留路由自身所需的合法领域异常 | 清理未使用的历史安全异常依赖 |
| **Tests** | 针对四层拦截器的过时单测 | `tests/engine/engine.test.ts` | `createModelDispatchGuard` 测试套件、只读防线单测 | ~150 行 | 替换为验证原生工具注册、内置 Agent 发现、事件正常转发的集成测试 | 废弃单测不再符合架构设计，需转为验证原生能力 |

---

## C. 原生 OMP 能力恢复验证 (Native OMP Capability Verification)

通过在真实 OMP SDK（`@oh-my-pi/pi-coding-agent 18.20.2`）运行环境下执行集成探针与单测，验证以下原生能力：

1. **Planner (规划者):**
   - 验证结果：通过 OMP 任务委托和多智能体角色映射，Planner 角色能够正常分派并在 TUI 的 `AgentMonitor` 中呈现 `📋 [PLANNER]` 徽章。
2. **Reviewer (评审者):**
   - 验证结果：OMP 内置 `reviewer` Agent 能够通过 `discoverAgents()` 正常发现并注册在 `task` 工具中，不再受到 Nightglide 白名单阻断。
3. **Scout (侦察者):**
   - 验证结果：OMP 内置 `scout` Agent 原生支持只读探索，能够正常通过 `task` 工具派发并输出只读代码库索引摘要。
4. **Task (任务代理):**
   - 验证结果：OMP 核心全功能 `task` 代理恢复可用，具备调用其全部配置工具执行复杂多步开发的能力。
5. **Native Tools (原生工具集):**
   - 验证结果：可写会话下，OMP 原生工具集完整加载：
     `["read", "bash", "edit", "eval", "glob", "grep", "task", "wait", "todo", "web_search", "write"]`。
     Nightglide 不再对其进行裁剪。仅当用户显式指定 opt-in `readOnly: true` 时，才映射为原生只读工具子集。
6. **Native Approval (原生审批机制):**
   - 验证结果：OMP 原生 `tools.approval` 与 `approvalMode`（如 `always-ask`、`yolo`）正常运行，Nightglide 未构建任何替代性假弹窗或静默绕过逻辑。
7. **Model Role Assignments (模型角色分配):**
   - 验证结果：Nightglide 路由结果通过 `Settings.isolated()` 的 `setModelRole()` 与 `overrideModelRoles()` 正确注入底层 OMP 会话。

---

## D. 架构演进对比 (Architecture Before vs After)

### 重构前 (M1.1 违规四层拦截架构)

```
       Nightglide TUI (受限展示)
                  │
                  ▼
       Nightglide Application Layer
                  │
                  ▼
  ┌────────────────────────────────────────────────────────┐
  │  Nightglide Custom Four-Layer Security System (违规自建)│
  │  Layer 1: taskTool.execute 拦截器 (白名单硬编码阻断)   │
  │  Layer 2: Settings 级注入 tools.approval: deny         │
  │  Layer 3: handleOmpEvent 工具执行看门狗熔断 (abort)     │
  │  Layer 4: createModelDispatchGuard TS网络请求硬拦截    │
  └────────────────────────────────────────────────────────┘
                  │
                  ▼
       Native OMP Runtime (能力被人为封印，退化为只读沙盒)
```

### 重构后 (M1.2 现代化清晰架构)

```
       Nightglide TUI (OpenTUI React)
         - 4 款天体主题 (WCAG 2.1 AA 达标)
         - Guided / Expert 双交互模式
         - AgentMonitor 实时子代理监控
         - RoutingExplanation 决策透视
         - ModelAssignmentView 模型分配矩阵
                  │
                  ▼
       Nightglide Application Layer
         - Provider 管理与端点物理 Locality 解析
         - 智能工作负载路由 (LOCAL / BALANCED / PERFORMANCE / MANUAL)
         - 双语任务分类器与 Agent 角色分配
         - 配置管理与平滑迁移
                  │
                  ▼
       Thin OMP SDK Adapter (@nightglide/engine)
         - 会话生命周期与设置翻译 (Settings.isolated + 角色模型注入)
         - 事件归一化流 (AgentEvent: tool_start/end, subagent_start/delta/end)
         - 用户主动取消 (Ctrl+C / Esc -> session.abort())
         - 资源释放 (session.dispose())
                  │
                  ▼
       Native OMP Runtime (@oh-my-pi/pi-coding-agent)
         - 原生编码工具 (read, write, edit, bash, task, glob, grep, todo)
         - 原生 Agent 体系 (Main, Planner, Reviewer, Scout, Task, Sonic)
         - 原生任务分派与并发执行
         - 原生工具审批机制 (tools.approval)
```

---

## E. 测试与构建验证 (Automated Tests & Diagnostics)

### 1. `bun run typecheck`
```
$ tsc --noEmit
(退出代码 0，全 Monorepo 严格类型检查完全通过，零错误)
```

### 2. `bun test`
```
bun test v1.4.4 (38afee6c8)

 138 pass
 0 fail
 924 expect() calls
Ran 138 tests across 8 files. [8.08s]
```
测试分层说明：
- **模拟层 (Simulated):** `tests/ui/ui-state.test.ts` (40 项), `tests/themes/themes.test.ts` (9 项), `tests/config/config.test.ts` (9 项)。
- **SDK 与适配层 (SDK-Level):** `tests/engine/engine.test.ts` (18 项，含真实 OMP 隔离会话启动、工具发现与事件归一化验证), `tests/engine/collaboration.test.ts` (4 项), `tests/routing/routing.test.ts` (33 项), `tests/providers/providers.test.ts` (19 项), `tests/integration/cli.test.ts` (6 项)。
- **实际提供商联调 (Live-Provider):** 包含真实提供商跳过保护项，需在显式声明 `NIGHTGLIDE_REAL_PROVIDER_TEST=1` 时执行。

### 3. `bun run build`
```
$ bun run --cwd apps/cli build
$ bun build src/index.ts --target bun --outfile dist/nightglide.js --external '@opentui/*' --external '@oh-my-pi/*' --external 'omp-legacy-pi-modules'
Bundled 39 modules in 15ms

  nightglide.js  223.78 KB  (entry point)
(构建成功，无告警)
```

### 4. `bun run doctor`
```
========================================================
  NIGHTGLIDE DOCTOR — 系统与多模型协同健康诊断
  'Build beyond the horizon.'
========================================================

[✔] Host System
    darwin (arm64) Apple Silicon / 64.0 GB RAM
[✔] Bun Runtime
    v1.4.4 (满足 >= 1.4.4 要求)
[✔] OMP SDK (@oh-my-pi/pi-coding-agent)
    18.20.2 (createAgentSession, subagentEventBus, task delegation 已就绪)
[✔] OpenTUI (@opentui/core & react)
    0.9.0 (CliRenderer, createRoot 已就绪)
[✔] Nightglide Config
    Theme: midnight-flight | Interaction: guided
[✔] Multi-Provider Registry
    1 个提供商注册 (1 本地, 0 云端)
[✔] Workload Model Router
    LOCAL 模式 (纯离线隐私保护，禁止任何外部流量)
[ℹ] Local Inference (Local Inference (oMLX/Local))
    端口响应 (Authentication required (HTTP 401). Set API key.)

--------------------------------------------------------
诊断结论: 核心环境与多模型协同架构健康就绪。您可运行 `bun run dev` 或 `bun run demo`。
========================================================
```

---

## F. TUI 终端界面实测验证 (TUI Verification)

1. **原生工具高保真呈现:**
   - `ChatScreen.tsx` 支持原生 OMP 工具的语义化图标与参数摘要：
     `read`/`read_file` (📖), `write`/`write_file` (✍️), `edit` (✂️), `bash` (💻), `task` (⚙️), `glob` (🔍), `grep` (🔎), `todo` (📝)。
   - 不再受任何拦截器屏蔽，工具调用输入与输出均实时上屏。
2. **多子代理协同监控 (`AgentMonitor`):**
   - Planner、Reviewer、Scout、Task 等各角色均配有专用色系与图标徽章，可实时展示流式输出 delta、运行状态（Thinking / Streaming / Executing Tool / Completed）与 Token 计数。
3. **双交互模式 (Guided vs Expert):**
   - **Guided Mode:** 卡片式展开工具输入参数与返回值。
   - **Expert Mode:** 单行紧凑模式，仅显示工具名、目标摘要与状态指示符，减少终端滚动占用。支持通过 `[Tab]` 键或 `/mode expert` / `/mode guided` 命令实时切换。
4. **天体主题与色彩无障碍:**
   - 4 款主题（Midnight Flight、Aurora、Cloudlight、Daybreak）完全保留，对比度严格维持在 WCAG 2.1 AA (>= 4.5:1)。
5. **已知限制:**
   - 在非 TTY 或无图形能力的 CI 管道中，交互式 TUI 会自动降级为非交互流式命令行打印（通过 `--non-interactive` 验证）。

---

## G. 文档清理与一致性更新 (Documentation Changes)

以下 9 份核心文档已全面同步修订，彻底消除了过时的四层拦截与物理防火墙夸大描述：
1. `docs/ARCHITECTURE.md`: 确立 OMP 与 Nightglide 权责边界矩阵，更新架构图，删除 `assertDispatchModel`。
2. `docs/PRODUCT_SPEC.md`: 修正 FR-4 与安全描述，删除自建审批与拦截器定义，添加 M1.2 里程碑规划。
3. `docs/FEATURE_MATRIX.md`: 新增 `OMP NATIVE` 标签，将删除的自建拦截功能标记为 `REMOVED (M1.2)`，准确标注原生 Reviewer、Task 与编码工具。
4. `docs/ROADMAP.md`: 正式纳入 M1.2 原生 OMP 恢复与架构精简里程碑。
5. `docs/SECURITY.md`: 全面重构安全架构章节，基于 OMP 原生工具审批策略与 Nightglide 路由隐私边界编写，删除 TS 网络防火墙叙述。
6. `docs/OMP_CAPABILITY_AUDIT.md`: 废弃旧版拦截章节，记录 M1.2 原生还原过程，重新签署审计结论。
7. `docs/M1_AGENT_ROUTING_SPEC.md`: 路由说明中剔除 `assertDispatchModel`，强化确定性路由规则与物理 Locality 约束。
8. `docs/ENGINEERING_STANDARDS.md`: 加入 Rule 4“严格轻量适配器原则”，严禁在 Adapter 内部自建业务阻断层。
9. `docs/DEVELOPMENT.md`: 更新 Engine 说明与适配器设计规范。

---

## H. Git 审计记录 (Git Audit)

- **起始提交 (Baseline SHA):** `f56517a` (`chore(m1.1): audit remediation and real capability verification`)
- **开发分支 (Branch):** `refactor/m1.2-native-omp`
- **目标提交信息:** `refactor: remove redundant Nightglide permission layers`
- **里程碑标签:** `m1.2-complete`
- **工作区状态:** 本报告生成并纳入版本控制后，工作区保持 Clean。

---

## I. 遗留限制与边界说明 (Remaining Limitations)

1. **真实提供商端点凭证依赖:**
   - 尽管 OMP 架构完全支持本地与云端模型无缝派发，但在没有配置真实有效 API Key 或本地大模型未运行（HTTP 401/连接拒绝）的情况下，真实模型推理调用仍会提示凭据缺失。这是正常的外部依赖限制，而非架构缺陷。
2. **原生 OMP 审批 UI 对接:**
   - 目前 Nightglide 与 OMP 原生审批体系完全兼容并尊重其规则，但尚未为 OMP 的交互式 `prompt` 审批模式提供全图形化覆盖弹窗（当前采用 OMP 默认策略及事件流报告）。如未来产品规划需要由 Nightglide 代理审批提示交互，应通过 OMP 官方公开的 approval 回调接口进行接入，绝不应通过自建前置阻断器实现。

---
**Nightglide 架构委员会 · M1.2 认证通过**  
`Build beyond the horizon.`
