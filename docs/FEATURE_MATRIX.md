# Nightglide 全量功能特性矩阵 (FEATURE MATRIX)

> **"Build beyond the horizon." / "漫翔苍穹，构筑所想。"**  
> *状态标识说明:*  
> - `IMPLEMENTED`: 核心代码已编写并通过全量自动化测试验证 (M0 / M1 / M1.1 / M1.2 阶段已完成)  
> - `SDK VERIFIED`: 真实 OMP SDK 运行时、SessionManager、Settings 与事件总线已实测验证  
> - `LIVE VERIFIED`: 经由已配置的真实本地与云端模型端点执行实时推理与协同验证  
> - `OMP NATIVE`: 由上游 OMP SDK 原生提供并驱动，Nightglide 薄适配接入  
> - `REMOVED (M1.2)`: 自定义拦截/防火墙层在 M1.2 架构简化与原生回归中废弃移除  
> - `PARTIAL`: 功能已部分实现但尚存已知边界  
> - `BLOCKED`: 外部依赖、物理端点或未提供凭据导致暂无法完成真实调用 (如真实多模型协同)  
> - `PLANNED`: 已纳入后续里程碑规划 (M2 - M4)

---

## 1. 核心契约与抽象层 (`FEAT-CORE`)

| 特性编号 | 功能名称 | 功能描述 | 用户与架构价值 | 优先级 | 目标里程碑 | 依赖项 | 验收标准 (Acceptance Criteria) | 状态 |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| `FEAT-CORE-001` | 抽象引擎核心契约 | 定义 `AgentEngine` 与 `AgentSession` 接口，解耦 UI 表现与模型执行。 | 保证表现层不依赖任何具体运行时，支持无缝切换真实或模拟引擎。 | P0 | M0 | 无 | 1. 成功导出接口；<br>2. 任何合规引擎均可无侵入注入会话系统。 | **Implemented** |
| `FEAT-CORE-002` | 判别联合事件流 | 采用 TypeScript Discriminated Union 规范 `AgentEvent`（含路由与子智能体事件）。 | 消除类型不安全传递，UI 层可通过 `event.type` 实现强类型匹配。 | P0 | M0/M1 | 无 | 1. 覆盖 `text_delta`、`tool_start`、`tool_end`、`status`、`error`、`done`、`routing_decision`、`subagent_start`、`subagent_delta`、`subagent_end`；<br>2. 编译器能够对未知类型实施 exhaustiveness check。 | **Implemented** |
| `FEAT-CORE-003` | 结构化异常继承树 | 基于 `NightglideError` 扩展 `EngineError`、`RoutingPolicyViolationError`、`CloudAuthorizationRequiredError`。 | 提供机器可读的 `code` 与可恢复标记 `recoverable`，支持 UI 精准降级。 | P0 | M0/M1 | 无 | 1. 异常继承链清晰；<br>2. 支持判断模型未配置、权限拒绝、云端未授权与会话已释放。 | **Implemented** |
| `FEAT-CORE-004` | 会话状态只读快照 | 导出 `SessionState` 提供当前状态、活跃模型、历史条数与 `activeSubagents` 视图。 | 确保 UI 能够以无副作用的方式轮询或获取会话上下文元数据。 | P1 | M0/M1 | `FEAT-CORE-001` | 1. 状态只读（`readonly`）；<br>2. 能准确反映会话是否已被销毁与多智能体监视列表。 | **Implemented** |
| `FEAT-CORE-005` | 响应式事件总线订阅 | `session.subscribe()` 支持传入事件处理器并返回无参销毁函数。 | 防止内存泄漏，支持组件挂载与卸载时的精准事件解绑。 | P0 | M0 | `FEAT-CORE-002` | 1. 订阅后可实时接收流式事件；<br>2. 调用返回函数后立即断开，无孤儿回调。 | **Implemented** |

---

## 2. 引擎与适配器层 (`FEAT-ENG`)

| 特性编号 | 功能名称 | 功能描述 | 用户与架构价值 | 优先级 | 目标里程碑 | 依赖项 | 验收标准 (Acceptance Criteria) | 状态 |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| `FEAT-ENG-001` | 确定性模拟引擎 | 内置 `MockAgentEngine`，模拟单模型与多智能体（本地 Explore + 云端 Plan）协同。 | 允许在无 API Key、无网络连接的离线环境下完整运行 UI 与测试。 | P0 | M0/M1 | `FEAT-CORE-001` | 1. 严格按照步长流式分发事件；<br>2. 支持模拟多智能体并行及接力；<br>3. 单元测试 100% 确定性通过。 | **Implemented** |
| `FEAT-ENG-002` | 隔离 OMP SDK 适配器 | 封装 `@oh-my-pi/pi-coding-agent`，接入原生子智能体、原生工具链与 `subagentEventBus`。 | 具备行业领先的编程智能体能力，同时确保上游类型不泄露。 | P0 | M0/M1 | `FEAT-CORE-001` | 1. 成功导入并初始化会话；<br>2. 捕获子智能体生命周期并归一化事件；<br>3. 配置模型角色映射。 | **Implemented** |
| `FEAT-ENG-003` | 内存会话管理隔离 | 强制使用 `SessionManager.inMemory()` 实例化会话层。 | 防止读取或污染宿主机上其他工具的历史 JSONL 会话记录。 | P0 | M0 | `FEAT-ENG-002` | 1. 退出后本地无历史记录泄露；<br>2. 杜绝宿主历史状态交叉污染。 | **Implemented** |
| `FEAT-ENG-004` | 原生编码与检索工具集成 | 依托 OMP 原生工具体系提供 `write`, `edit`, `bash`, `read`, `find`, `grep`, `task` 等，由 OMP 原生审批机制管控破坏性操作。 | 原生提供完整编码修改与检索能力，保障操作可控可审计。 | P0 | M0/M1.2 | `FEAT-ENG-002` | 1. 原生工具链按需提供；<br>2. 破坏性操作走原生审批流程。 | **OMP Native** |
| `FEAT-ENG-005` | 引擎就绪与健康探测 | `checkHealth()` 探针返回引擎就绪状态、原生 task 工具状态与诊断信息。 | 为 `doctor` 诊断工具与启动向导提供事实依据，绝不伪造成功结果。 | P0 | M0/M1 | `FEAT-CORE-001` | 1. 离线/无模型时准确报告状态；<br>2. 提供明确故障修复指引。 | **Implemented** |
| `FEAT-ENG-006` | 会话安全销毁机制 | `cancel()` 立即终止当前流式生成；`dispose()` 清理底层资源与句柄。 | 保证用户敲击 `Ctrl+C` 时能够立即打断模型输出并释放内存。 | P0 | M0 | `FEAT-CORE-001` | 1. 调用后中止未完成流与子智能体；<br>2. 二次调用安全幂等，抛出标准异常。 | **Implemented** |

---

## 3. 模型供应商适配层 (`FEAT-MOD`)

| 特性编号 | 功能名称 | 功能描述 | 用户与架构价值 | 优先级 | 目标里程碑 | 依赖项 | 验收标准 (Acceptance Criteria) | 状态 |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| `FEAT-MOD-001` | 本地 oMLX 端侧服务适配 | 适配 Apple Silicon 专用的 oMLX 本地推理服务器与端口检测，安全处理 HTTP 401 鉴权。 | 为 Mac 开发者提供极致响应速度与 100% 隐私安全的本地模型编码体验。 | P0 | M0/M1 | `FEAT-ENG-002` | 1. 识别 8000 端口服务；<br>2. 提示需配置 API Key，杜绝凭据泄露。 | **Implemented** |
| `FEAT-MOD-002` | 多提供商注册表架构 | 构建 `@nightglide/providers`，支持多 Provider 并存、唯一标识与模型限定符。 | 彻底打破单供应商绑定，允许本地端点与多个云端网关协同共存。 | P0 | M1 | `FEAT-CORE-001` | 1. 拒绝重复 Provider ID 与非法 URL；<br>2. 严格限定模型 ID 为 `${provider}/${model}`。 | **Implemented** |
| `FEAT-MOD-003` | 物理网络位置绝对判定 | `resolveEndpointLocality` 严格基于回环 IP/Hostname 分类，不轻信 Display Name。 | 避免恶意/误导配置以“local”命名却实际转发至公网的问题。 | P0 | M1 | `FEAT-MOD-002` | 1. 回环 IP 判定为 `local`；<br>2. 所有外部域名/公网 IP 强制为 `remote`。 | **Implemented** |
| `FEAT-MOD-004` | 云端主流服务商安全托管 | 支持 OpenAI、Anthropic、Ollama、oMLX，通过环境变量安全提取密钥。 | 为需要超强推理能力的复杂项目提供高阶云端模型选择，绝不在普通配置写明文。 | P1 | M1 | `FEAT-CFG-005` | 1. 从环境变量安全解析 Key；<br>2. 诊断报告中密钥严格脱敏。 | **Implemented** |
| `FEAT-MOD-005` | 提供商连通性探针与 CLI | 提供 `nightglide providers` 与 `nightglide models` 命令行查看端点与模型。 | 开发者可随时查看每个端点的物理属性、认证状态与连通性。 | P0 | M1 | `FEAT-MOD-002` | 1. 命令行清晰输出表格与连通状态；<br>2. 区分本地与云端标识。 | **Implemented** |

---

## 4. 工作负载感知模型路由与协作 (`FEAT-ROUT` & `FEAT-AGT`)

| 特性编号 | 功能名称 | 功能描述 | 用户与架构价值 | 优先级 | 目标里程碑 | 依赖项 | 验收标准 (Acceptance Criteria) | 状态 |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| `FEAT-ROUT-001` | 任务意图与复杂度分类器 | 支持 8 类任务类型 (`explore`, `explain`, `plan`, `implement`, `debug`, `review`, `test`, `summarize`)。 | 智能识别任务特征，为后续精准路由派发提供结构化输入。 | P0 | M1 | `FEAT-CORE-001` | 1. 准确识别中英文任务 Prompt；<br>2. 结构化输出能力需求与复杂度。 | **Implemented** |
| `FEAT-ROUT-002` | 四大智能路由工作模式 | 实现 `LOCAL`、`BALANCED`、`PERFORMANCE`、`MANUAL` 策略矩阵。 | 满足不同安全合规与算力预算场景的需求。 | P0 | M1 | `FEAT-ROUT-001` | 1. LOCAL 模式绝对禁止云端；<br>2. BALANCED 模式复杂任务在授权时协同云端。 | **Implemented** |
| `FEAT-ROUT-003` | 隐私敏感回退策略链 | Fallback 严格遵守当前路由模式与隐私约束，本地故障决不静默发往云端。 | 彻底杜绝数据在未经明确授权情况下的越权泄露。 | P0 | M1 | `FEAT-ROUT-002` | 1. LOCAL 回退链仅含本地模型；<br>2. 耗尽时抛出明确异常。 | **Implemented** |
| `FEAT-ROUT-004` | 路由层隐私合规分派 | 通过 `WorkloadModelRouter` 在路由决策阶段严格执行隐私约束（LOCAL 模式仅分派本地模型，禁止云端 Fallback）。*(注：原自定义 TS 网络拦截钩子已在 M1.2 架构重构中移除，由路由层策略决策接管)* | 避免恶意越权外发，从源头确保数据不出机。 | P0 | M1/M1.2 | `FEAT-ENG-002` | 1. LOCAL 模式仅分派物理本地模型；<br>2. 未授权云端时抛出异常。 | **Implemented** |
| `FEAT-AGT-005` | 本地/云端跨模型协同工作流 | 实现本地 Explorer 扫码代码库 + 云端 Planner 制定架构方案的接力协同。 | 结合本地隐私零成本与云端高智商推理的最优解。 | P0 | M1 | `FEAT-ROUT-002` | 1. 本地生成摘要，最小必要上下文传云端；<br>2. 最终成果统一汇聚。 | **SDK VERIFIED (LIVE BLOCKED: 需要真实活跃双端点凭据)** |
| `FEAT-AGT-006` | 原生 Reviewer 审查智能体 | 通过 OMP SDK 原生内置 `reviewer` 智能体执行代码质量与安全审计。*(注：M1.2 解除人工禁用，直接复用原生能力)* | 审查由独立模型承接，避免自我审查偏见，原生无缝委派。 | P0 | M1.2 | `FEAT-ENG-002` | 1. 原生支持 `reviewer` 智能体派发；<br>2. 经 OMP SDK 原生调度执行。 | **OMP Native** |
| `FEAT-AGT-007` | 原生 Task 委派智能体 | 通过 OMP SDK 原生内置 `task` 智能体实现任务递归分解与子任务派发。*(注：M1.2 解除人工禁用，直接复用原生能力)* | 原生支持复杂多阶段任务分解与并发执行。 | P0 | M1.2 | `FEAT-ENG-002` | 1. 原生支持 `task` 委派；<br>2. 经 OMP SDK 原生调度执行。 | **OMP Native** |

---

## 5. 终端用户界面与交互 (`FEAT-UI` & `FEAT-UX`)

| 特性编号 | 功能名称 | 功能描述 | 用户与架构价值 | 优先级 | 目标里程碑 | 依赖项 | 验收标准 (Acceptance Criteria) | 状态 |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| `FEAT-UI-001` | OpenTUI 终端应用挂载 | 使用 OpenTUI React 渲染器构建根界面与声明式组件树。 | 摆脱传统终端模板字符串拼接，实现高帧率抗抖动的现代 TUI。 | P0 | M0 | 无 | 1. 成功挂载应用；<br>2. 监听退出信号并复原终端。 | **Implemented** |
| `FEAT-UI-002` | 苍穹视觉字标与五维导航头 | 渲染 Nightglide 艺术字标、当前工作空间、导航 Tab `[1-5]`。 | 强化品牌认知，给用户沉浸、专业且优雅的第一视觉印象。 | P0 | M0/M1 | `FEAT-UI-001` | 1. 包含 Welcome, Flight Deck, Setup, Themes, Model Matrix；<br>2. 视觉层级清晰。 | **Implemented** |
| `FEAT-UI-003` | 多智能体实时监视器 AgentMonitor | 可视化展示参与当前任务的各 Agent 角色、模型、本地/云端标识、状态与 Token。 | 消除多智能体后台协作的黑盒感，实时掌握各模型工作进度。 | P0 | M1 | `FEAT-AGT-005` | 1. 实时更新各 Subagent 状态；<br>2. 清晰展示 LOCAL/CLOUD 标签。 | **Implemented** |
| `FEAT-UI-004` | 路由决策透明解释卡片 | 在任务派发前呈现选定模型、任务类别、预估成本与决策依据。 | 让用户完全清楚为什么选用该模型，避免盲目消耗云端 Token。 | P0 | M1 | `FEAT-ROUT-002` | 1. 卡片视觉突出、不抢占主对话区；<br>2. 理由通俗易懂。 | **Implemented** |
| `FEAT-UI-005` | 模型角色分配交互矩阵 Screen | 交互式界面配置 `MAIN`、`EXPLORE`、`PLAN`、`IMPLEMENT`、`REVIEW` 模型分配。 | 用户无需手动修改 YAML 即可直观分配与切换角色模型。 | P0 | M1 | `FEAT-ROUT-002` | 1. 支持空格键切换路由模式；<br>2. 支持 C 键开关云端授权。 | **Implemented** |
| `FEAT-UI-006` | 四大 Celestial 天象主题 | Midnight Flight、Aurora、Cloudlight、Daybreak 主题及对比度合规。 | 兼顾暗色极客与明色办公环境，保持 Nightglide 苍穹空灵的美学品位。 | P0 | M0 | `FEAT-UI-001` | 1. 4 款主题任意切换即时生效；<br>2. 对比度符合无障碍规范。 | **Implemented** |
| `FEAT-UI-007` | 苍穹主工作台 Flight Deck | 整合对话、模型状态、工具执行与智能体协同的高密度沉浸式主视口。 | 彻底摆脱粗糙日志刷屏，建立具备电影感与秩序感的主工作台。 | P0 | M2 | `FEAT-UI-001` | 1. 黄金四层视觉重心稳定呈现；<br>2. 空间布局抗抖动自适应。 | **Planned** |
| `FEAT-UI-008` | 语法着色 Diff 审查与双栏预览 | 基于 `@opentui/core` 原生 `DiffRenderable`，提供内联与宽屏并排双栏 Diff。 | 给用户绝对的代码控制权与极佳的可读性，审批前看清改动。 | P0 | M2 | `FEAT-ENG-004` | 1. 红绿语法着色清晰；<br>2. 宽屏（$\ge 120$ 列）自动启用并排双栏。 | **Planned** |
| `FEAT-UI-009` | 双模态动态无缝切换系统 | Tab 键即时切换 Guided Mode（新手向导）与 Expert Mode（极速专家）。 | 一套架构底座同时服务小白与资深键盘流，无需安装两个工具。 | P1 | M2 | `FEAT-UI-007` | 1. 敲击 Tab 瞬间重排布局，不中断会话；<br>2. 专家模式最大化代码展示。 | **Planned** |
| `FEAT-UI-010` | 多智能体星图连线可视化 | 在多智能体接力时呈现极简字符连线（`──✦──>`），直观反映任务流转。 | 消除 AI 协作黑盒感，透明展示本地代码未越权外发的隐私边界。 | P1 | M3 | `FEAT-AGT-005` | 1. 呈现本地到云端数据交接；<br>2. 定宽渲染无折行位移。 | **Planned** |
| `FEAT-UI-011` | 智能视口锁定与翻查锚定 | 生成时默认贴底跟随，向上翻查历史时立即解除锁定，按 G 快速回到底部。 | 彻底杜绝终端流式生成时强行拉拽用户视线的糟糕体验。 | P0 | M2 | `FEAT-UI-001` | 1. 翻查时不跳屏；<br>2. 到底部后自动恢复贴底流式。 | **Planned** |

---

## 6. 配置中心与安全防护 (`FEAT-CFG` & `FEAT-SEC`)

| 特性编号 | 功能名称 | 功能描述 | 用户与架构价值 | 优先级 | 目标里程碑 | 依赖项 | 验收标准 (Acceptance Criteria) | 状态 |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| `FEAT-CFG-001` | 多 Provider 与路由配置结构 | 扩展 `NightglideConfig`，原生包含 `providers` 映射表与 `routing` 策略配置。 | 规范化持久化存储用户的所有模型偏好、角色绑定与云端开关。 | P0 | M1 | 无 | 1. 自动兼容旧版配置；<br>2. 结构自愈与校验。 | **Implemented** |
| `FEAT-CFG-005` | 凭据安全提取与无明文 | 从环境变量（如 `OPENAI_API_KEY`）安全解析 Key，绝不在诊断或输出打印明文。 | 彻底杜绝用户误将包含密钥的配置文件提交到公共 Git 仓库。 | P0 | M0/M1 | `FEAT-CFG-001` | 1. 配置文件 Schema 默认不含明文 Key；<br>2. 日志脱敏保护。 | **Implemented** |
| `FEAT-SEC-001` | 原生工具审批集成与 TUI 呈现 | 依托原生 OMP SDK 工具执行沙箱与审批机制，在终端 TUI 提供清晰的可视化审批确认。*(注：M1.2 架构重构中移除了自定义 4 层 Below-the-Prompt 拦截器与强制 deny 注入，全面回归并复用 OMP 原生审批体系)* | 兼顾操作安全与上游引擎原生兼容性，不破坏原生能力。 | P0 | M0/M1.2 | `FEAT-CORE-003` | 1. 呈现原生审批人机交互；<br>2. 用户确认后放行。 | **OMP Native & TUI** |
| `FEAT-SEC-002` | 自定义拦截器移除与原生回归 | 移除自定义 4 层 Below-the-Prompt 工具拦截、`tools.approval: deny` 强制注入、`task.disabledAgents` 人工禁用与 `tool_execution_start` 硬中止。 | 消除对上游 API 的破坏性修改与脆弱补丁，回归薄适配器架构。 | P0 | M1.2 | `FEAT-ENG-002` | 1. 移除自定义硬拦截代码；<br>2. 恢复原生 OMP 完整代理能力。 | **REMOVED (M1.2)** |
| `FEAT-SEC-004` | 敏感密钥脱敏展示 | 在日志输出、UI 调试面板与错误提示中，自动屏蔽敏感密钥。 | 防范截屏分享、录屏演示或日志上传时发生密钥无意泄露。 | P0 | M1 | `FEAT-MOD-004` | 1. 诊断接口仅返回 `hasAuth: true`；<br>2. 绝不在任何 public 字段打印 raw key。 | **Implemented** |

---

## 7. 苍穹动效与微交互系统 (`FEAT-MOT`)

| 特性编号 | 功能名称 | 功能描述 | 用户与架构价值 | 优先级 | 目标里程碑 | 依赖项 | 验收标准 (Acceptance Criteria) | 状态 |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| `FEAT-MOT-001` | 微光地平线启航与字标拂动 | 冷启动时微光地平线在 150ms 内展开并拂亮 ASCII 品牌字标 (`ANIM-START-001/002`)。 | 营造专属的苍穹启航仪式感，任何击键立即跳过，绝不阻塞用户。 | P2 | M4 | `FEAT-UI-002` | 1. 严格 150ms 内完成；<br>2. 用户输入瞬间跳过。 | **Planned** |
| `FEAT-MOT-002` | 思考推演微光正弦呼吸 | 思考中呈现定宽 1 字符微动指示灯与平滑正弦色彩呼吸 (`ANIM-THINK-001`)。 | 消除长时间等待的焦虑感，真实反映思考节律，定宽无横向抖动。 | P0 | M2 | `FEAT-UI-001` | 1. 严格限制在 10-15 FPS；<br>2. 首字到来时立即定格销毁。 | **Planned** |
| `FEAT-MOT-003` | 瞬态发光游标跳跃微动 | 流式文本末尾随行发光强调色方块 `█` 并在完成时静默隐去 (`ANIM-STREAM-002`)。 | 给予用户极度流畅的文本生成伴随感，指示当前流式活跃位置。 | P1 | M2 | `FEAT-UI-001` | 1. 随 Token 流动平滑跟随；<br>2. done 事件触发时瞬间清理。 | **Planned** |
| `FEAT-MOT-004` | 星图协同接力流转微动 | 本地与云端智能体成果交接时的字符连线与状态转移动画 (`ANIM-AGENT-001/002`)。 | 直观表达多模型接力与数据流转，强化本地隐私安全感知。 | P1 | M3 | `FEAT-UI-010` | 1. 耗时 120-150ms；<br>2. 减弱动效下瞬间切换。 | **Planned** |
| `FEAT-MOT-005` | 工具审批等待与落盘确认微闪 | 破坏性操作等待审批时边框警示色呼吸，落盘成功时浅绿微闪 150ms (`ANIM-TOOL-002/003`)。 | 醒目提示人机决策关卡，操作成功时给予确定、安心的微反馈。 | P0 | M2 | `FEAT-SEC-001` | 1. 边框警示色平滑呼吸；<br>2. 写入成功后浅绿确认。 | **Planned** |
| `FEAT-MOT-006` | 模型切换胶囊微滑与回退通知 | 活跃模型改变时胶囊背景微亮，触发回退时浮现非侵入式 Toast (`ANIM-MODEL-001/002`)。 | 帮助用户清晰感知模型变更与底层回退，避免暗度陈仓的消耗。 | P1 | M3 | `FEAT-ROUT-003` | 1. 徽标滑动耗时 100ms；<br>2. Toast 3 秒后平滑隐去。 | **Planned** |
| `FEAT-MOT-007` | 苍穹主题无闪烁热重配微管线 | 敲击快捷键切换主题时，15ms 内全量更新语义 Token 且无全屏闪烁 (`ANIM-THEME-001`)。 | 打造行云流水般的视觉环境切换体验，深夜与白昼无缝变换。 | P0 | M2 | `FEAT-UI-006` | 1. 切换耗时 <15ms；<br>2. 无白屏、无光标跳跃。 | **Planned** |
| `FEAT-MOT-008` | 减弱动效自适应与无动效回退 | 配置 `motion: "off"` 时停用所有非必要动画定时器，耗时降为 0ms。 | 满足极端性能环境、弱算力设备与前庭觉敏感用户的无障碍诉求。 | P0 | M2 | 无 | 1. 彻底停用计时器与动画循环；<br>2. 保持 100% 完整功能。 | **Planned** |
| `FEAT-MOT-009` | 终端抗抖动与帧率极限评估管线 | 自动化探测终端重绘延迟、CPU 波动与布局横纵抖动指标。 | 为未来高频微交互提供科学严谨的性能基准守护，防止性能劣化。 | P1 | M3 | 无 | 1. 帧率严格 $\le 15$ FPS；<br>2. 屏幕抖动率 0。 | **Research Required** |

---

## 8. 新手向导与体验进阶 (`FEAT-EXP`)

| 特性编号 | 功能名称 | 功能描述 | 用户与架构价值 | 优先级 | 目标里程碑 | 依赖项 | 验收标准 (Acceptance Criteria) | 状态 |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| `FEAT-EXP-001` | 交互式渐进新手引导向导流 | 首次启动自动进入分步引导向导，引导选择模式、主题与就绪模型。 | 降低初次上手门槛，消除小白对于命令行界面的恐惧感。 | P0 | M2 | `FEAT-UI-007` | 1. 3 步完成初始化；<br>2. 零 API Key 时可直通演示。 | **Planned** |
| `FEAT-EXP-002` | 本地推理端点自动嗅探 | 自动向 8000 (oMLX) 与 11434 (Ollama) 发起只读探针并提供快捷连接。 | 极致简化本地 AI 极客的接入体验，1 键完成隐私模型配置。 | P0 | M2 | `FEAT-MOD-001` | 1. 200ms 内完成探测；<br>2. 安全处理 HTTP 401 凭证。 | **Planned** |
| `FEAT-EXP-003` | 键盘优先与 Vim 键位映射支持 | 在列表、Diff 与视口切换中支持 `j/k`、`g/G`、`Ctrl+D/U` 等 Vim 键位。 | 迎合资深工程师与键盘流的物理肌肉记忆，实现极速操控。 | P1 | M3 | `FEAT-UI-007` | 1. 纯键盘完成全部工作流；<br>2. 输入框聚焦时按键隔离良好。 | **Planned** |

---

## 6. 配置中心与安全防护 (`FEAT-CFG` & `FEAT-SEC`)

| 特性编号 | 功能名称 | 功能描述 | 用户与架构价值 | 优先级 | 目标里程碑 | 依赖项 | 验收标准 (Acceptance Criteria) | 状态 |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| `FEAT-CFG-001` | 多 Provider 与路由配置结构 | 扩展 `NightglideConfig`，原生包含 `providers` 映射表与 `routing` 策略配置。 | 规范化持久化存储用户的所有模型偏好、角色绑定与云端开关。 | P0 | M1 | 无 | 1. 自动兼容旧版配置；<br>2. 结构自愈与校验。 | **Implemented** |
| `FEAT-CFG-005` | 凭据安全提取与无明文 | 从环境变量（如 `OPENAI_API_KEY`）安全解析 Key，绝不在诊断或输出打印明文。 | 彻底杜绝用户误将包含密钥的配置文件提交到公共 Git 仓库。 | P0 | M0/M1 | `FEAT-CFG-001` | 1. 配置文件 Schema 默认不含明文 Key；<br>2. 日志脱敏保护。 | **Implemented** |
| `FEAT-SEC-001` | 原生工具审批集成与 TUI 呈现 | 依托原生 OMP SDK 工具执行沙箱与审批机制，在终端 TUI 提供清晰的可视化审批确认。*(注：M1.2 架构重构中移除了自定义 4 层 Below-the-Prompt 拦截器与强制 deny 注入，全面回归并复用 OMP 原生审批体系)* | 兼顾操作安全与上游引擎原生兼容性，不破坏原生能力。 | P0 | M0/M1.2 | `FEAT-CORE-003` | 1. 呈现原生审批人机交互；<br>2. 用户确认后放行。 | **OMP Native & TUI** |
| `FEAT-SEC-002` | 自定义拦截器移除与原生回归 | 移除自定义 4 层 Below-the-Prompt 工具拦截、`tools.approval: deny` 强制注入、`task.disabledAgents` 人工禁用与 `tool_execution_start` 硬中止。 | 消除对上游 API 的破坏性修改与脆弱补丁，回归薄适配器架构。 | P0 | M1.2 | `FEAT-ENG-002` | 1. 移除自定义硬拦截代码；<br>2. 恢复原生 OMP 完整代理能力。 | **REMOVED (M1.2)** |
| `FEAT-SEC-004` | 敏感密钥脱敏展示 | 在日志输出、UI 调试面板与错误提示中，自动屏蔽敏感密钥。 | 防范截屏分享、录屏演示或日志上传时发生密钥无意泄露。 | P0 | M1 | `FEAT-MOD-004` | 1. 诊断接口仅返回 `hasAuth: true`；<br>2. 绝不在任何 public 字段打印 raw key。 | **Implemented** |

---
*(本矩阵作为 Nightglide 全版本研发周期的总需求看板与功能追溯基准)*
