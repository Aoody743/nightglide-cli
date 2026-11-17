# Nightglide 安全模型与权限防护规范 (SECURITY & ISOLATION POLICY)

> **"Build beyond the horizon." / "漫翔苍穹，构筑所想。"**  
> *安全评级: 最高安全防护规范 | 适用范围: 全平台客户端、上游适配器与模型交互层*

> **历史文档声明（2026-11-18）：**第 2-7 节描述的是**旧原型架构**（`@nightglide/routing` 路由器、`apps/cli` 表现层、`~/.config/nightglide` 配置、`resolveEndpointLocality` 拦截器等）。新主线已改为 OMP 原生架构，这些组件大多不存在；本文旧内容仅作设计思想与历史记录，其中"已完成/已实现"表述不作为当前事实。**当前主线的真实安全状态见下方「0. 新主线安全现状」**。

---

## 0. 新主线安全现状 (OMP-Native Mainline — Current Facts, 2026-11-18)

### 0.1 工具审批（已实测）
- 审批由 OMP 原生引擎执行，模式 `always-ask` / `always-ask-cached` / `write` / `yolo`（`--approval-mode` 或 `tools.approvalMode`）。
- **schema 默认值为 `yolo`**：无任何配置时写入/命令直接放行。TUI 与 headless 皆然。
- TUI 审批对话框有防误触 arm 窗口（挂载后短时间忽略 Enter，防止提交 prompt 的按键误当审批）——已在真实终端验证：`write` 工具经 Approve → 文件真实落盘、内容精确匹配。
- **headless（print/-p）提示**：当生效值为 yolo 且用户没有任何显式审批配置（旗标/env/任意层设置/per-tool 条目）时，stderr 输出一行警告并给出收紧方法；已实测两种路径。
- print 模式在显式 `always-ask` 下：write/bash/edit/eval 全部被拦截并向模型返回明确的"需要审批但无交互 UI"错误（已实测）。是否将 headless 默认改为更严格模式是**未决产品问题**（当前保持上游 yolo 默认 + 警告）。

### 0.2 模型路由与隐私（LOCAL 模式已实测）
- `nightglide.routingMode`（默认 `manual` = 不改变任何行为）：`local` 将 10 个会话角色与子智能体 `@role` 解析绑定到本地模型（回环 baseUrl 或已知本地 provider），回退链仅含本地模型；无本地模型时启动快速失败；per-call 云端模型被拒绝。已在真实会话验证主会话与 task 子智能体均落在 `omlx/endless`。
- **保证范围如实限定**：LOCAL 约束覆盖会话与子智能体的聊天模型选择；kind roles（image/web/speech/dictation）、用户显式配置的 vision 角色、以及扩展程序不在覆写范围内。状态栏 `routing` 段只显示真实生效的模式。
- 凭据：全部存于 OMP 原生体系（`~/.omp/agent` 下 models.yml / agent.db）；Nightglide 不读取、不存储、不转存任何 API key。

### 0.3 未验证项
- 旧文档第 3/4/6 节描述的路径越界校验、凭据脱敏、SSRF/重定向防护等机制**未在新主线上逐项验证**——它们是上游 OMP 的职责边界；对上游安全机制的审计未做。
- 零遥测承诺未对新主线重新验证（上游有 usage attribution 等机制）。

---

## 1. 威胁建模与安全目标 (Threat Model)

在 AI 智能体直接拥有读写本地磁盘、执行终端命令等系统特权的场景下，安全边界的设计直接决定了用户的资产安全。Nightglide 的安全架构首要防范以下四大现实威胁：

```mermaid
flowchart TD
    Threats["🛡️ 核心威胁模型 (Threat Vectors)"]
    T1["威胁 1: 恶意提示词注入\n(Prompt Injection & Jailbreak)"]
    T2["威胁 2: 未知与不可逆的文件破坏\n(Destructive Overwriting / Escape)"]
    T3["威胁 3: 宿主凭据与私钥泄漏\n(Credential Theft & Secret Leakage)"]
    T4["威胁 4: 恶意命令与逃逸执行\n(Arbitrary Remote / Bash Execution)"]

    Threats --> T1
    Threats --> T2
    Threats --> T3
    Threats --> T4
```

### 核心安全目标
1. **指令意图与执行权限逻辑隔离:** 大模型的推理与文本生成仅仅产生“意图请求”，在架构设计上绝对不赋予大模型对底层操作系统的直接物理执行特权。
2. **原生执行引擎与工具审批机制 (Native Engine & Tool Approval):** 底层工具执行与沙箱审批完全由 OMP 原生驱动与保障，绝不依赖大模型的文本自律，亦无需构建脆弱的多余自定义拦截层。
3. **数据主权与严密隐私防护 (Privacy-First Data Sovereignty):** 用户代码与敏感私钥默认不出机，严禁隐式遥测上传。

---

## 2. 提示词注入防御与执行边界 (Prompt Injection Defense)

### 2.1 传统“提示词安全”的失效陷阱
许多传统 AI Agent 试图通过在 System Prompt 中写入“请不要删除用户文件”、“请不要执行危险命令”来保证安全。这种设计在面对恶意构建的代码注释（间接提示词注入，Indirect Prompt Injection）或越狱模板时极其脆弱。一旦大模型被攻击者绕过，便会发出危险的工具调用指令。

### 2.2 原生 OMP 工具审批与终端呈现流转 (Native Tool Approval & TUI Flow)

```mermaid
flowchart LR
    subgraph UntrustedZone ["不可信计算区 (Untrusted / Probabilistic)"]
        LLM["AI 大模型 (Cloud / Local)"]
        Prompt["Prompt & Context\n(可能包含恶意代码注入)"]
        ToolCall["工具调用请求\n(例如 edit, write, bash)"]
    end

    subgraph OMPNative ["原生 OMP 执行与审批层 (OMP SDK Engine)"]
        ApprovalEngine["OMP Approval Engine\n(原生工具审批决策)"]
        ToolSandbox["OMP Tool Execution\n(原生工具运行时)"]
    end

    subgraph UIZone ["Nightglide TUI 呈现层 (apps/cli)"]
        UserPrompt["终端人机确认卡片\n(Interactive Terminal UI)"]
    end

    subgraph ExecutionZone ["受保护物理系统 (Protected System)"]
        Disk["本地文件系统 (Disk)"]
        Shell["操作系统子进程 (Shell)"]
    end

    LLM --> ToolCall
    Prompt --> LLM
    ToolCall --> ApprovalEngine
    ApprovalEngine -- "触发审批" --> UserPrompt
    UserPrompt -- "用户按键 [y]" --> ToolSandbox
    UserPrompt -- "用户拒绝 [n]" --> LLM
    ToolSandbox --> Disk
    ToolSandbox --> Shell
```

- **原生审批机制与交互原则 (Native Approval & Deterministic UX):**
  - 底层工具的注册、调用执行与权限审批由 OMP 原生内核完全接管。
  - Nightglide 表现层不重新发明脆弱的“4层代码拦截器”，而是无缝接入 OMP 原生审批体系，在 TUI 中呈现高可读性的参数详情与确认卡片。
  - 即使大模型被完全越狱并坚称“用户已授权执行 `rm -rf /`”，OMP 原生审批与 Nightglide TUI 未收到物理按键确认前，任何高危工具均无法提交执行。

---

## 3. 工作空间沙箱与 Git 边界明确声明 (Workspace Protection)

### 3.1 关键事实阐明: Git Worktree 绝非操作系统级沙箱
> [!WARNING] 
> **必须明确界定:** Git 工作树（Git Worktree）或本地副本只是一种**代码版本层面的差异隔离机制**，**绝对不是 Linux Namespace、cgroups、Docker 容器或 macOS App Sandbox 级别的操作系统内核隔离！**  
> 在 Git Worktree 中执行的任意恶意脚本，依然拥有与当前用户完全相同的系统访问权限。

### 3.2 路径越界逃逸防护 (Path Traversal Protection)
为防止模型试图读取工作区之外的敏感文件（如 `/etc/passwd`, `~/.ssh/id_rsa`）：
1. **工作区根锚定 (Root Pinning):**
   - 每次会话启动时，`workspacePath` 经过 `path.resolve()` 规范化为绝对路径。
2. **规范化前缀校验:**
   - 任何工具传入的文件路径，必须经过解析并检验 `resolvedTarget.startsWith(workspacePath)`。
   - 若检测到 `../` 逃逸行为，拦截器立即阻断，不发起任何物理 I/O，并向会话返回标准权限错误。

### 3.3 工具分级授权与白名单边界
- **第一级: 只读探测 (Read-Only) - 默认受控放行**
  - 工具: `read`, `find`, `grep`
  - 限制: 仅限在工作区目录树内搜索与读取，单次读取设置最大字节上限，防止读取 GB 级别的大文件拖垮内存。
- **第二级: 代码修改 (Write-Back) - 强制 Diff 暂存与审批**
  - 工具: `edit`, `write`
  - 限制: 生成原子修改 Diff 并在终端渲染，只有用户物理按下 `y` 键后才执行写磁盘操作。
- **第三级: Shell 执行 (Command Execution) - 默认硬性禁用**
  - 工具: `bash`
  - 限制: M0 阶段全局禁用；未来版本开启时必须明确展示命令全貌，要求输入二次确认。

---

## 4. 凭证安全与无明文存储 (Credential Safety)

API Key 和模型凭据是开发者的核心资产，Nightglide 实施最高级别的凭据防护规范：

### 4.1 严禁明文持久化
- `~/.config/nightglide/config.json` 的标准 JSON Schema 中**严格不包含任何用于明文存储 API Key 的字段**。
- 严禁将 API Key 直接持久化在磁盘上的未加密 JSON 配置文件中。
- 提供商配置中若检测到 URL 内嵌凭据（如 `http://user:pass@host`），系统直接拒绝注册，并在错误消息与日志输出中强制脱敏。

### 4.2 凭证解析推荐优先级
1. **环境变量优先:**  
   从当前 Shell 环境读取（`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `NIGHTGLIDE_API_KEY`）。
2. **系统级加密凭据链 (Keychains):**  
   在支持的操作系统上使用系统原生安全存储（macOS Keychain / Linux Secret Service / Windows Credential Manager）。

### 4.3 内存与日志脱敏 (Secret Masking)
- 在所有对外输出的日志、终端 UI 渲染组件、错误堆栈以及 `AgentEvent` 事件流中，实施敏感词脱敏清洗。
- 自动检测常见 API Key 格式（如 `sk-...`），自动替换为前缀+掩码+后缀（如 `sk-ant••••••••abcd`），杜绝录屏与截屏导致泄露。
- 无论网络探测成功与否，所有抛出的错误及状态报告中均剥离原始密钥及明文认证串。

---

## 5. 遥测策略与本地隐私保障 (Telemetry & Local Privacy Guarantee)

Nightglide 践行纯粹的开源与隐私理念：

### 5.1 零默认遥测 (Zero Telemetry by Default)
- Nightglide **不内置任何后台埋点、行为追踪或匿名数据收集 SDK**。
- 不向任何中心化服务器上传用户的工作空间路径、文件名称、Git 提交记录或提问内容。

### 5.2 精准隐私保障 (Precise Privacy Guarantee)
- **应用层本地优先保证 (Application-Level Local-First Guarantee):**  
  当运行模式配置为 `LOCAL` 时，Nightglide 应用程序在代码逻辑层做出确定性承诺：所有的 Prompt、代码上下文、工具调用请求与推理数据，**仅定向发送至已严格判别为本地回环（Loopback）的网络端点**。Nightglide 绝不静默向任何第三方公网服务器发起数据外发请求。用户可断开公网连接验证：Nightglide 在纯离线断网模式下本地能力依然完整可用。

### 5.3 关键安全层级划分与回环地址边界
为避免安全认知的模糊与夸大，必须严谨区分以下三个安全概念层级：

| 安全层级 (Assurance Level) | 机制与技术实现 | Nightglide 范围与职责界定 |
| :--- | :--- | :--- |
| **1. 本地寻址 API<br>(Locally Addressed API)** | 客户端 HTTP 请求的目标 URL 解析为主机本地回环网络接口（`127.0.0.1`, `localhost`, `::1`）。 | **由 Nightglide 直接保证:** `resolveEndpointLocality` 严格校验端点，杜绝向公网域名或非回环地址派发数据包。 |
| **2. 已验证本地推理服务<br>(Verified Local Inference Service)** | 监听在本地端口上的进程确为本地原生推理引擎（如 oMLX, Ollama, llama.cpp），其模型权重完全加载于本机芯片（CPU/GPU/NPE）上，不向上游转发。 | **由外部模型服务实现:** Nightglide 探测服务端口的连通性，但不检查外部第三方后台守护进程的具体内部实现。 |
| **3. 操作系统级网络物理隔离<br>(OS-Enforced Network Isolation)** | 借助操作系统内核特性（如 macOS App Sandbox、Linux Network Namespaces `unshare -n`、iptables、断开物理网卡），物理阻断任何出站数据包。 | **由操作系统内核保证:** 属于系统底层基础设施保障，超越普通用户态 CLI 应用的控制范畴。 |

> [!IMPORTANT]
> **回环端点判定的局限性说明 (Loopback Locality Limitation):**  
> `resolveEndpointLocality` 对 `localhost` / `127.0.0.1` 的判定，**仅证明 Nightglide 客户端自身的 HTTP 请求发送给宿主机的本地回环接口**，而**不能单凭客户端代码证明该本地端口后面的服务一定在做纯本地推理**。  
> 例如：若用户本地自行运行了一个反向中继代理（如 ngrok, frp, 商业 API 转发代理）监听在 `127.0.0.1:8000` 并将流量转发至云端 OpenAI，Nightglide 作为客户端只能识别该目标地址为本地寻址，无法越权刺探宿主机第三方代理程序的跨网络转发行径。  
> 追求严密离线合规的企业或个人用户，建议在启用 `LOCAL` 模式的同时，结合操作系统的防火墙规则或纯物理断网环境运行。

---

## 6. 提供商网络判定与本地优先调度规约 (Provider Locality & Dispatch Policy)

在多模型与多提供商架构中，防止代码被意外上传至第三方云端是最高隐私红线：

### 6.1 物理网络端点严格判定 (Strict Network Endpoint Classification)
- **拒绝名称伪造:** 任何 Provider 的 Display Name 或配置别名（例如配置名称为 `"local-proxy"` 或 `"my-local-omlx"`）**绝对不能作为 Locality 判定依据**。
- **服务端绑定 (0.0.0.0) 与客户端目标端点的规范化区分:**
  - **网络规范语义差异:** 在网络编程中，`0.0.0.0`（`INADDR_ANY`）作为服务端监听绑定地址（Server Binding）时，意为监听宿主机所有网卡接口。但根据 RFC 1122 规范，`0.0.0.0` 并不是合法的客户端单播目标地址（Client Destination），跨平台网络栈（如 Windows vs macOS）在客户端向 `0.0.0.0` 发起 TCP 连接时可能产生行为分歧或报错。
  - **保留兼容性并实施确定性规范化:** 针对本地模型服务（如 oMLX, Ollama）日志常输出 `Listening on 0.0.0.0:8000` 的开发者实际使用习惯，Nightglide 做到了：
    1. **物理网络属性安全归类:** `resolveEndpointLocality("http://0.0.0.0:8000")` 严格判定为 `local`；
    2. **客户端分发确定性规范化:** 在注册提供商与发送实际 HTTP 请求前，`normalizeEndpointUrl` 自动将目标主机 `0.0.0.0` 规范化为 `127.0.0.1`，消除跨操作系统网络栈的连接异常隐患。
- **严格回环判定集合 (`local`):**
  - 主机名: `localhost`
  - IPv4 回环: `127.0.0.1` 及 `127.0.0.0/8`（必须严格满足 4 组十进制 0-255 数字，首段为 127）
  - IPv6 回环: `::1`, `[::1]` 及未压缩零表示 `0:0:0:0:0:0:0:1`
  - 规范化绑定地址: `0.0.0.0`
- **非回环地址一律视为远程 (`remote`):**
  - **RFC 1918 局域网私有地址:** `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` 强制分类为 `remote`。
  - **链路本地地址 (Link-Local):** `169.254.0.0/16`, `fe80::/10` 强制分类为 `remote`。
  - **公网 IP 与域名:** 所有外部公网 IPv4、IPv6 与域名（如 `api.openai.com`）。
  - **混淆与欺骗域名:** 形如 `127.example.com`, `localhost.attacker.com`, `127.0.0.1.nip.io` 严格归类为 `remote`。
  - **替代进制表示法防御:** 十六进制 IP（`0x7f000001`）、八进制 IP（`0177.0.0.1`）、无点整数 Dword（`2130706433`）等常用于绕过 SSRF 的非标表示法，`isValidEndpointUrl` 一律视为非法地址直接拒绝注册，`resolveEndpointLocality` 默认安全失败（Fail-Closed）归类为 `remote`。

### 6.2 探测时的跨区域重定向阻断 (Cross-Locality Redirect Guard)
在执行 `checkConnection` 探测端点可用性时，强制启用受控的手动重定向检测（`redirect: "manual"`）：
1. **本地向远程重定向拦截:** 本地提供商端点若返回 HTTP 3xx 重定向且其 `Location` 目标指向非本地远程地址，检测器立即阻断，严防私钥及数据被恶意服务借重定向外流；
2. **反向 SSRF 重定向拦截:** 远程端点若试图重定向至本地回环接口，视为 SSRF 探测攻击立即阻断；
3. **协议降级拦截:** 严禁从 HTTPS 重定向至未加密的 HTTP；
4. **重定向跳数与凭据保护:** 重定向最多允许 3 次同源跳转，跨源跳转时自动剥离 `Authorization` 请求头。

### 6.3 LOCAL 模式零云端外发调度守卫
- 当运行模式为 `LOCAL` 时：
  - 调度器仅从经物理判定为 `local` 的模型池中分派任务；
  - 任务失败时的 Fallback 回退链中**严禁包含任何 remote 云端模型**；
  - 若所有本地端点均不可用，系统立即抛出 `ProviderUnavailableError` 显式终止，绝不允许“善意”隐式降级至第三方云端。

### 6.4 路由策略优先判定与隐私合规分派 (Policy-Based Routing & Local Compliance)
在模型分派阶段，Nightglide 由 `@nightglide/routing` 中的 `WorkloadModelRouter` 实施严格的策略判定：
- 任务派发前，路由器根据当前激活模式严格筛选模型候选集；
- 当处于 `LOCAL` 模式或未开启云端授权（`allowCloud: false`）时，路由器仅允许经物理判定为 `local` 的端点参与；
- 若选定模型为 `remote` 物理端点但未获得云端授权，路由器立即抛出 `CloudAuthorizationRequiredError`；
- 在 M1.2 架构重构中，移除了脆弱的底层自定义 TS 网络拦截钩子 (`assertDispatchModel`)，完全依靠确定性的策略路由与端点物理 Locality 解析实现更健壮、无侵入的本地隐私保护。

---

## 7. 跨智能体上下文交接与脱敏规约 (Cross-Agent Context Handoff)

在多 Agent 协同工作流（例如本地 Explorer 与云端 Planner 接力）中：

1. **最小必要上下文原则 (Principle of Least Privilege Context):**
   - 本地 Explorer 在只读遍历代码库后，仅向上层返回提炼后的结构骨架、关键符号清单与模块调用依赖摘要。
   - 严禁将整个代码库的原始文件内容打包批量上传至云端。
2. **凭据预脱敏防泄漏:**
   - 上下文交接前，自动扫描并抹除代码上下文中的常见 API Key、Token 模式与敏感环境变量。
3. **可追溯与可撤回:**
   - 跨 Agent 的每一次上下文交接均产生审计记录并在 TUI 的 `AgentMonitor` 中实时可见，用户可随时按 `Ctrl+C` 立即阻断后续执行链。

---
*(本文档为 Nightglide 最高安全合规基准，任何破坏上述安全防护特性的代码变更均将被直接否决)*
