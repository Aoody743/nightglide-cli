# Nightglide 全量功能特性矩阵 (FEATURE MATRIX)

> **"Build beyond the horizon." / "漫翔苍穹，构筑所想。"**  
> *状态标识说明:*  
> - `Implemented`: 核心代码已编写且通过全量自动化测试验证 (M0 / M1 阶段已完成)  
> - `In Progress`: 正在开发中或正在进行下一阶段联调 (M1 验收 / M2 前期)  
> - `Planned`: 已纳入里程碑规划，待后续版本开发 (M2 - M4)  
> - `Research Required`: 依赖前沿架构探索或技术可行性预研 (预研阶段)

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
| `FEAT-ENG-002` | 隔离 OMP SDK 适配器 | 封装 `@oh-my-pi/pi-coding-agent`，接入原生 `task` 工具与 `subagentEventBus`。 | 具备行业领先的编程智能体能力，同时确保上游类型不泄露。 | P0 | M0/M1 | `FEAT-CORE-001` | 1. 成功导入并初始化会话；<br>2. 捕获子智能体生命周期并归一化事件；<br>3. 配置模型角色映射。 | **Implemented** |
| `FEAT-ENG-003` | 内存会话管理隔离 | 强制使用 `SessionManager.inMemory()` 实例化会话层。 | 防止读取或污染宿主机上其他工具的历史 JSONL 会话记录。 | P0 | M0 | `FEAT-ENG-002` | 1. 退出后本地无历史记录泄露；<br>2. 杜绝宿主历史状态交叉污染。 | **Implemented** |
| `FEAT-ENG-004` | 工具严格白名单注入 | 初始化时开启 `restrictToolNames: true`，受控注入 `["read", "find", "grep", "task"]`。 | 防止模型意外执行任意破坏性指令，严格根据权限开放写入。 | P0 | M0/M1 | `FEAT-ENG-002` | 1. 严格限定受控工具集；<br>2. 未授权写工具调用直接拦截。 | **Implemented** |
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
| `FEAT-ROUT-004` | 请求前底层硬件守卫 | 通过 OMP `assertDispatchModel` 钩子在发送网络包前拦截非合规请求。 | 即使 Prompt 注入或上游意外切换，也无法突破物理安全防线。 | P0 | M1 | `FEAT-ENG-002` | 1. 违规外发时抛出 `RoutingPolicyViolationError`；<br>2. 物理阻断连接建立。 | **Implemented** |
| `FEAT-AGT-005` | 本地/云端跨模型协同工作流 | 实现本地 Explorer 扫码代码库 + 云端 Planner 制定架构方案的接力协同。 | 结合本地隐私零成本与云端高智商推理的最优解。 | P0 | M1 | `FEAT-ROUT-002` | 1. 本地生成摘要，最小必要上下文传云端；<br>2. 最终成果统一汇聚。 | **Implemented** |

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

---

## 6. 配置中心与安全防护 (`FEAT-CFG` & `FEAT-SEC`)

| 特性编号 | 功能名称 | 功能描述 | 用户与架构价值 | 优先级 | 目标里程碑 | 依赖项 | 验收标准 (Acceptance Criteria) | 状态 |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| `FEAT-CFG-001` | 多 Provider 与路由配置结构 | 扩展 `NightglideConfig`，原生包含 `providers` 映射表与 `routing` 策略配置。 | 规范化持久化存储用户的所有模型偏好、角色绑定与云端开关。 | P0 | M1 | 无 | 1. 自动兼容旧版配置；<br>2. 结构自愈与校验。 | **Implemented** |
| `FEAT-CFG-005` | 凭据安全提取与无明文 | 从环境变量（如 `OPENAI_API_KEY`）安全解析 Key，绝不在诊断或输出打印明文。 | 彻底杜绝用户误将包含密钥的配置文件提交到公共 Git 仓库。 | P0 | M0/M1 | `FEAT-CFG-001` | 1. 配置文件 Schema 默认不含明文 Key；<br>2. 日志脱敏保护。 | **Implemented** |
| `FEAT-SEC-001` | 底层防篡改权限看门狗 | 在 SDK 调用与系统执行层之间构建硬件级别的确定性逻辑拦截层。 | 无论大模型如何被 Prompt 注入，均无法绕过物理权限门禁。 | P0 | M0 | `FEAT-CORE-003` | 1. 逻辑不可被模型指令改写；<br>2. 权限未命中时抛出强类型异常。 | **Implemented** |
| `FEAT-SEC-004` | 敏感密钥脱敏展示 | 在日志输出、UI 调试面板与错误提示中，自动屏蔽敏感密钥。 | 防范截屏分享、录屏演示或日志上传时发生密钥无意泄露。 | P0 | M1 | `FEAT-MOD-004` | 1. 诊断接口仅返回 `hasAuth: true`；<br>2. 绝不在任何 public 字段打印 raw key。 | **Implemented** |

---
*(本矩阵作为 Nightglide 全版本研发周期的总需求看板与功能追溯基准)*
