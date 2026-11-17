# Nightglide M1 阶段实施与验收总结报告 (M1 IMPLEMENTATION REPORT)

> **历史原型记录。** 此文的完成状态不代表新主线已经实现或验证，参见 [新路线图](ROADMAP.md)。

**项目名称：** Nightglide  
**里程碑：** M1 — 多模型协同与工作负载智能路由 (Multi-Provider Intelligence & Agent Collaboration)  
**实施环境：** Google Antigravity + Gemini 3.8 Flash + Subagents  
**完成日期：** 2026-11-15  
**Git 分支：** `feat/m1-agent-collaboration`  
**基线版本：** `a235317` (`tag: m0-complete`)  

---

## 一、总体研发成果综述 (Executive Summary)

Nightglide M1 里程碑严格遵照 **“复用 OMP、扩展 Nightglide、不重复发明轮子”** 的工程哲学，在 M0 单引擎隔离基础之上，全面构建了真正的多模型管理、工作负载智能路由与本地/云端协同开发架构。

### 核心交付物一览
1. **OMP 原生能力深度审计 (`docs/OMP_CAPABILITY_AUDIT.md`):** 对已安装 `@oh-my-pi/pi-coding-agent: 18.20.2` 源码实施了系统级审查，确认并接通了原生 Plan 模式、Reviewer 嵌入式 Agent、原生 `task` 委派工具及 `subagentEventBus` 事件总线。
2. **多提供商注册表 (`@nightglide/providers`):** 实现供应商解耦，支持 oMLX、Ollama、OpenAI、Anthropic 及自定义端点。严格基于回环 IP 进行物理 Locality 判定，提供安全的凭据提取与脱敏诊断。新增 `nightglide providers` 命令。
3. **工作负载感知模型路由器 (`@nightglide/routing`):** 实现 8 类强类型任务分类（`explore`, `explain`, `plan`, `implement`, `debug`, `review`, `test`, `summarize`）与 4 大运行模式（`LOCAL`, `BALANCED`, `PERFORMANCE`, `MANUAL`）。提供端到端不可变 `RoutingDecision`。新增 `nightglide models` 命令。
4. **引擎升级与跨 Provider 协同流水线 (`@nightglide/engine`):**
   - `OmpAgentEngine`: 解锁原生 `task` 工具白名单，支持通过 `Settings.isolated()` 动态注入模型角色覆盖，无损捕获 `subagentEventBus` 并广播标准化事件，注册 `assertDispatchModel` 调度层确定性隐私门禁。
   - `MockAgentEngine`: 构建高保真确定性多 Agent 协同模拟器，完整复现“本地 Explorer 侦察代码 + 云端 Planner 编制规划 + 最终汇聚”的双工闭环。
5. **OpenTUI 终端体验深度升级 (`apps/cli/src/ui`):**
   - **`AgentMonitor`:** 对话界面内嵌的多智能体监视卡片，实时呈现参与 Agent 角色、模型、LOCAL/CLOUD 标签、状态与 Token。
   - **`RoutingExplanation`:** 路由透明卡片，清晰向用户展示任务分类、模型选配理由及预估成本。
   - **`ModelAssignmentView` (`[5]` 快捷导航):** 交互式角色分配矩阵，无需手动编辑 YAML 即可直观查看与调整模型分配，一键切换路由模式与云端开关。
6. **全量测试与质量保证:**
   - 全 Monorepo 编译期类型检查 `tsc --noEmit` 0 报错通过。
   - 全量自动化测试套件 **75 项测试全部通过（0 失败，445 个断言）**。

---

## 二、OMP SDK 原生能力审计与复用结论

通过深入分析 `node_modules/@oh-my-pi/pi-coding-agent/src/` 源码，明确划分了 OMP 与 Nightglide 的职责边界：

| 功能模块 | OMP 原生提供与复用 | Nightglide 专属增量增强 |
|---|---|---|
| **规划 (Planning)** | `plan-mode/model-transition.ts`<br>根据 `@plan` 角色自动流转模型 | 任务意图分类器精准识别规划任务，提供只读工具约束，TUI 计划审查呈现 |
| **评审 (Reviewer)** | 内置 `reviewer.md` 与 `security-reviewer.md` 模板 | 通过角色覆盖将独立 Cloud/高阶模型分配给 Reviewer，杜绝自我审查偏见 |
| **子任务派发** | 原生 `task` 工具，支持批处理与并发信号量 | 统一封装事件接入，提供多智能体实时监视卡片 `AgentMonitor` |
| **子智能体可观测性** | `subagentEventBus` 广播 `task:subagent:event` | 将底层内部事件归一化为 Nightglide 标准判别联合事件流 (`AgentEvent`) |
| **数据安全防护** | `assertDispatchModel` pre-flight 请求前钩子 | 注入物理端点 Locality 校验，在 LOCAL 模式下硬拦截任何外部公网请求 |

---

## 三、多模型提供商与工作负载路由机制

### 3.1 物理网络位置绝对判定法则 (Locality Invariance)
在 `@nightglide/providers/src/locality.ts` 中：
- 回环地址与主机名：`127.0.0.1`, `localhost`, `::1`, `[::1]`, `127.0.0.0/8`, `0.0.0.0` 统一强制归类为 `local`。
- 其余所有外网域名及内网 IP 地址一律强制归类为 `remote`。
- 绝不信任 Provider 的 `displayName`，彻底杜绝伪装成“local”的外部转发风险。

### 3.2 四大路由模式运行策略
1. **`LOCAL` 模式:** 100% 离线隐私保护。仅匹配本地端点模型，Fallbacks 链仅允许包含其他本地模型。若本地模型不可用，直接抛出 `ProviderUnavailableError` 终止，严禁静默回退至云端。
2. **`BALANCED` 模式 (推荐):** 日常、检索、代码解释等轻量任务保持在端侧轻量模型（零费用、高响应）；复杂规划与深度重构任务在获得 `allowCloud: true` 用户授权时自动派发至云端大模型；若云端未授权，则降级至本地最强模型并提示。
3. **`PERFORMANCE` 模式:** 优先考虑模型智商与解答质量，云端强模型优先，但必须满足用户预算与授权。
4. **`MANUAL` 模式:** 严格遵循 `routing.roleAssignments` 中用户对 `MAIN`、`EXPLORE`、`PLAN`、`IMPLEMENT`、`REVIEW` 各角色的显式绑定。

### 3.3 路由决策实例 (实际运行产出)
- **示例 1 (常规探索 - BALANCED 模式):**
  - Prompt: `"find the definition of UserModel in src/"`
  - Decision: Category: `explore` | Role: `explore` | Model: `omlx/qwen2.5-coder-7b` [LOCAL] | Cost: `Free (Local)`
  - Reason: `BALANCED mode: Routine task 'explore' kept on local model for speed and zero cost.`
- **示例 2 (架构规划 - BALANCED 模式，云端已授权):**
  - Prompt: `"create an architecture refactoring plan for our auth module"`
  - Decision: Category: `plan` | Role: `plan` | Model: `openai/gpt-4o` [CLOUD] | Cost: `Unknown`
  - Reason: `BALANCED mode: Complex task 'plan' routed to cloud model for superior reasoning capacity (User cloud authorized).`
- **示例 3 (架构规划 - LOCAL 模式，隐私锁定):**
  - Prompt: `"为当前项目设计一套高并发重构方案和架构路线图"`
  - Decision: Category: `plan` | Role: `plan` | Model: `omlx/qwen2.5-coder-7b` [LOCAL] | Cost: `Free (Local)`
  - Reason: `LOCAL mode: Task 'plan' assigned to local model for strict on-device privacy.`

---

## 四、本地与云端多智能体协同流水线实测

在 `tests/engine/collaboration.test.ts` 中构建了端到端跨 Provider 协作验证：

```
[Task Director] 任务识别: 重构规划 (Category: plan)
      │
      ├── [Subagent 1: Local Explorer] (omlx/qwen2.5-coder-7b - LOCAL)
      │     └─ 只读遍历本地 12 个核心文件，提炼模块接口与符号骨架 (256 tokens)
      │
      ├── [Context Handoff] 最小必要上下文提炼，零源码全量外发
      │
      ├── [Subagent 2: Cloud Planner] (openai/gpt-4o - CLOUD AUTHORIZED)
      │     └─ 接收结构摘要，进行三阶段架构演进蓝图推导 (512 tokens)
      │
      └── [Main Synthesizer] 汇聚双模型成果，交付终端用户
```

### 真实端点与测试双工器声明
- **确定性测试双工器 (Test Doubles):** 默认单测套件通过精巧的 Mock Engine 仿真跨端点协作流程，在无网络连接、无真实 Token 消耗的情况下实现 100% 毫秒级回归验证。
- **真实 Provider 互通声明:** 本地环境中 `http://127.0.0.1:8000/v1` 返回 `HTTP 401 Unauthorized`（需真实 API Key），故在无用户明确提供两套真实凭据时，测试套件安全跳过真实付费调用，明确标为 `SKIPPED`，绝不虚构测试通过结论。

---

## 五、自动化测试与验收数据

### 1. 全量单测运行结果 (`bun test`)
```text
bun test v1.4.4

tests/ui/ui-state.test.ts:                  15 pass
tests/config/config.test.ts:                 9 pass
tests/integration/cli.test.ts:               6 pass
tests/providers/providers.test.ts:           9 pass
tests/routing/routing.test.ts:              14 pass
tests/engine/engine.test.ts:                13 pass
tests/engine/collaboration.test.ts:          3 pass
tests/themes/themes.test.ts:                 6 pass

Ran 75 tests across 8 files. [6.64s]
Pass: 75 | Fail: 0 | Assertions: 445 calls
```

### 2. 静态编译类型检查 (`bun run typecheck`)
```text
$ tsc --noEmit
(Process exited with code 0 - Zero errors)
```

### 3. 应用打包构建 (`bun run build`)
```text
$ bun run --cwd apps/cli build
$ bun build src/index.ts --target bun --outfile dist/nightglide.js --external '@opentui/*' --external '@oh-my-pi/*' --external 'omp-legacy-pi-modules'
Bundled 38 modules in 13ms

  nightglide.js  190.79 KB  (entry point)
```

---

## 六、Git 历史与分支状态

- **起始基线 Tag:** `m0-complete` (`a235317d7c318f946be41cd3ef984b0283a25327`)
- **开发分支:** `feat/m1-agent-collaboration`
- **提交策略:** 严格遵守规范，不向远程仓库推流，不破坏现有历史标签。

---

## 七、已知边界与 M2 演进建议

### 1. 当前已知限制 (Known Limitations)
1. **真实本地模型连接状态:** 本机 8000 端口服务存在鉴权防护（HTTP 401），真实跨模型调用取决于用户是否配置 `OMLX_API_KEY`；未配置时系统安全提示并启用离线保护。
2. **写操作依然受限:** 根据设计原则，M1 专注于“多模型协调、意图路由与只读探索”，代码文件直接修改与 Shell 执行依然受到严格白名单门禁限制，未直接开放无限制物理落盘。

### 2. M2 里程碑建议规划
1. **受控文件修改与 Diff 审查 (Safe File Editing):** 解锁受控的 `edit` / `write` 工具，在 TUI 中实现完整的语法着色差异对比弹窗，用户确认后原子提交。
2. **Git Worktree 临时沙箱验证:** 在执行复杂重构时自动拉起独立的 Git Worktree 进行测试验证。
3. **语法报错自愈循环 (Self-Healing Loop):** 当测试未通过时，由 Reviewer 智能体捕捉堆栈并在受限轮数内自动发起重试修正。
