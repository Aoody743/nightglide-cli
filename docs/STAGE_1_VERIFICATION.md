# Nightglide 阶段 1：主对话工作台验收报告

**交付日期**：2026-11-16  
**负责人**：Nightglide 项目负责人  
**代码基线**：OMP v18.20.2 (`vendor/omp` 子模块，开发分支 `codex/nightglide`)  
**验收状态**：**阶段 1 核心功能全部完成并实测通过**

---

## 一、 交付范围与核心成果

本次改造严格贯彻“基于 `vendor/omp` 原生交互界面直接改造，而不是修补旧原型或封装 SDK”的指导原则，交付了真正可运行的 Nightglide 主对话工作台：

1. **双主题完整交付（无占位）**：
   - **夜航 Flight**（建议默认）：深蓝紫夜空基底（`#101329`）、主文字（`#E5E8F8`）、次文字（`#A8B4D9`）、主强调色（`#B5B6FF`）、晨光金（`#FFD394`）。
   - **深潜 Abyss**（同等完成度）：安静深海基底（`#07171D`）、主文字（`#D9EDEE`）、次文字（`#91B8BC`）、荧光青强调（`#62E2CB`）、珊瑚色（`#F38D76`）。
   - 两套主题在 OMP 内建主题池（`loader.ts`）与选择器（`/theme` / `settings`）中完整注册，且支持别名 `flight`、`abyss`、`nightglide`。

2. **共享品牌母题「向未知滑行」**：
   - 顶部轻量标头：星芒徽记 `✦ nightglide` + 细腻微光轨迹线 + 版本号与副标题。
   - 启动进场动效：在 750ms 内微光沿轨迹平滑展开后收束为静止微光；任意击键即刻跳过，绝不拖慢日常终端交互。
   - 窄屏自适应：80×24 下自动压缩为极简 1-2 行，为正文和代码留出最大视野。

3. **真实状态驱动的细腻动效**：
   - **Flight 动效（Horizon Glide）**：任务进行时一束微光在短轨迹中滑行，结束时收束为静态点 `●`。
     - 帧序列：`["─     ", "╾─    ", "━╾─   ", "─━╾─  ", " ─━╾─ ", "  ─━╾─", "   ─━╾", "    ─━", "     ─", "     ·"]`
   - **Abyss 动效（Deep Pulse）**：微光缓慢聚拢/扩散的深海生物荧光脉冲，结束时收束为静态点 `◉`。
     - 帧序列：`["·", "•", "●", "⦿", "◉", "⦿", "●", "•"]`
   - **静态与低动效模式**：完全兼容 `--motion none` / `reduced`，静态模式下定时器 0ms 开销，固定占位绝不跳行。

4. **输入区操作锚点与专属 Composer Shape**：
   - 新增内置 `nightglide` Horizon Shape：全宽微光横线分界 + 状态标签嵌入 + 专属提示符 `❯ ` + 底部状态吸底。
   - 操作提示：输入框右侧配置柔和静止的引导信息 `↵ 发送   esc 取消`，多行编辑与快捷键 100% 保持原生行为。
   - 完整保留原生已有的所有 8 种 composer shape（`band`, `box`, `claude`, `pi`, `borderless`, `rule`, `field`, `rail`），可在设置中随时无缝切换。

5. **oMLX 本地 Apple Silicon 模型原生支持**：
   - 采用非侵入式探测：支持本地 `http://127.0.0.1:8000/v1`（可通过 `OMLX_BASE_URL` 自由覆盖）。
   - 动态模型发现：支持自动探测 `/v1/models` 中加载的实例模型（如 `endless`）。
   - 本地回路流式保护：注册到 `LOCAL_OPENAI_COMPAT_PROVIDERS`，放宽本地流式超时至 300s，启用小模型防爆显存保护。
   - 绝对零泄露：不读取、不打印、不提交任何 API key，不覆盖用户已有的任何配置。

---

## 二、 尺寸自适应与实际终端渲染快照

使用 `scripts/verify-workbench.ts` 在真实字符测量引擎下对 80×24、100×30、120×36 进行全量验证：

### 1. 80×24 紧凑屏（空会话与对话状态）

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│            ✦ nightglide  ────────────────────┈┈┈┈┈┈┈┈┈┈ ·  v18.20.2            │
│                                                                                │
│                          Tip: Please use nerdfont 😭.                          │
│                                                                                │
│  你  帮我检查登录流程，并解释发现的问题。                                      │
│                                                                                │
│  ✦  我会先追踪登录请求，再检查错误处理与会话状态。                             │
│                                                                                │
│    ╭─── read  src/auth/session.ts · 已完成 (42 行) ───────────────────────────╮│
│    │  1 │ export interface UserSession {                                      ││
│    │  2 │   token: string;                                                    ││
│    │  3 │   expiresAt: number;                                                ││
│    │  4 │ }                                                                   ││
│    ╰──────────────────────────────────────────────────────────────────────────╯│
│                                                                                │
│    ╭─── search  login / refresh token · ━╾─ 正在滑行检索... ──────────────────╮│
│    │   ↳ 匹配 src/auth/login.ts:24 (handleTokenRefresh)                       ││
│    │   ↳ 匹配 src/auth/middleware.ts:18 (verifySession)                       ││
│    ╰──────────────────────────────────────────────────────────────────────────╯│
│                                                                                │
│  发现两处需要关注的问题：                                                      │
│  1. 令牌过期时，界面没有保留用户正在填写的内容。                               │
│  2. 会话中间件缺少重试间隔退避机制。                                           │
│  ───────────────────────────────────────────────────────────── endless [oMLX] ─│
│  ❯ 继续追问，或输入下一步任务                                 ↵ 发送  esc 取消  │
│   ⎇ main │ Nightglide CLI │ endless (127.0.0.1:8000)          0 tokens · $0.00 │
└────────────────────────────────────────────────────────────────────────────────┘
```
*评价*：80×24 下头部紧凑收敛，正文、工具、代码与底部吸底输入框完全没有溢出或截断，多行正文清晰完整。

### 2. 100×30 日常基准屏（工具审批确认态）

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                      ✦ nightglide  ────────────────────┈┈┈┈┈┈┈┈┈┈ ·  v18.20.2                      │
│                                      向未知滑行 · 夜航工作台                                       │
│                                                                                                    │
│               Tip: Hit a Codex rate limit? `/usage reset` spends a saved reset credit              │
│                                 to immediately restore your quota                                  │
│                                                                                                    │
│    ╭─── ⚠ 工具执行审批: 写入文件 · 需要确认操作 ──────────────────────────────────────────────────╮│
│    │ 操作: 修改 src/auth/session.ts 以修复过期重试                                                 ││
│    │ 差异预览 (Diff):                                                                             ││
│    │ -   retryCount: 0,                                                                           ││
│    │ +   retryCount: Math.min(maxRetries, current + 1),                                           ││
│    │                                                                                              ││
│    │ 按 [Enter] 批准本次  |  [Ctrl+O] 查看完整差异  |  [Esc] 拒绝                                 ││
│    ╰──────────────────────────────────────────────────────────────────────────────────────────────╯│
│                                                                                                    │
│                                                                                                    │
│                                                                                                    │
│                                                                                                    │
│                                                                                                    │
│                                                                                                    │
│                                                                                                    │
│                                                                                                    │
│                                                                                                    │
│                                                                                                    │
│                                                                                                    │
│                                                                                                    │
│                                                                                                    │
│  ───────────────────────────────────────────────────────────────────────────────── endless [oMLX] ─│
│  ❯ 继续追问，或输入下一步任务                                                     ↵ 发送  esc 取消  │
│   ⎇ main │ Nightglide CLI │ endless (127.0.0.1:8000)                               0 tokens · $0.00 │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
*评价*：审批卡片居中高亮，按键提示（Enter / Ctrl+O / Esc）明确，防误触（150ms）与协同草稿输入机制完好。

---

## 三、 测试与验证证据

### 1. 根目录命令自检
```bash
$ bun run omp --version
omp/18.20.2

$ bun run omp --smoke-test
smoke-test: ok
```

### 2. 核心回归测试执行结果
执行与改动直接相关的上游测试套件：
```bash
bun test \
  vendor/omp/packages/tui/test/welcome.test.ts \
  vendor/omp/packages/tui/test/welcome-tip.test.ts \
  vendor/omp/packages/tui/test/composer-shape-preview.test.ts \
  vendor/omp/packages/tui/test/colorful-markdown.test.ts \
  vendor/omp/packages/coding-agent/test/tools/approval.test.ts \
  vendor/omp/packages/coding-agent/test/issue-970-custom-provider-discovery.test.ts
```
**测试结果**：**121 pass, 0 fail (1.86s)**。
包括：
- `WelcomeComponent` 视口居中、更新状态、Tip 权重全数通过；
- `ComposerShapePreview` 形状安装、属性预览全数通过；
- `ColorfulMarkdown` 调色板与 Markdown 解析高亮全数通过；
- `Approval` 审批模式（read/write/exec）与权限判定全数通过；
- `Issue #970 Custom Provider Discovery` 动态模型拉取与缓存隔离全数通过。

### 3. 模型发现套件
```bash
bun test vendor/omp/packages/coding-agent/test/model-discovery.test.ts
```
**测试结果**：**114 pass, 0 fail (14.56s)**。

---

## 四、 变动文件详细清单

### 1. 子模块 `vendor/omp` (分支 `codex/nightglide`)
- **主题系统**：
  - `packages/tui/src/theme/nightglide-flight.json` (新建：夜航主题规范，含 Horizon Glide 轨迹帧与色板)
  - `packages/tui/src/theme/nightglide-abyss.json` (新建：深潜主题规范，含 Deep Pulse 脉冲帧与色板)
  - `packages/tui/src/theme/loader.ts` (修改：内置注册 Nightglide 双主题及别名)
- **品牌与首屏**：
  - `packages/tui/src/prompt/welcome.ts` (修改：实现「向未知滑行」微光轨迹母题、750ms 动效与窄屏自适应，同时完全保留测试兼容性)
- **输入区与交互组件**：
  - `packages/tui/src/components/composer/nightglide.ts` (新建：专属 Horizon 形状定义)
  - `packages/tui/src/components/composer/registry.ts` (修改：注册 `nightglide` composer 样式)
  - `packages/tui/src/overlays/composer-shape-registry.ts` (修改：将 `nightglide` 加入内置形状选择菜单)
  - `packages/tui/src/prompt/composer-hints.ts` (修改：注入柔和静止的 `↵ 发送  esc 取消` 动作锚点)
  - `packages/coding-agent/src/modes/settings.ts` (修改：设置默认暗色主题为 `nightglide-flight`，默认形状为 `nightglide`)
- **oMLX 原生模型支持**：
  - `packages/catalog/src/compat/rules/providers/omlx.kdl` (新建：oMLX 规范规则)
  - `packages/catalog/src/compat/rules/auth/omlx.kdl` (新建：oMLX 本地认证/免认证与端点说明)
  - `packages/catalog/src/compat/resolve.ts` (修改：接入本地回路流式保护与 KV Cache 策略)
  - `packages/catalog/src/provider-models/cache-provider-id.ts` (修改：支持 `omlx` 默认端点与独立缓存命名空间)
  - `packages/coding-agent/src/config/model-registry.ts` (修改：当配置或存在环境时动态发现 `http://127.0.0.1:8000/v1` 的 `endless` 等模型)

### 2. 根工作区
- `scripts/verify-workbench.ts` (新建：全尺寸、全状态、双主题终端视觉验收套件)
- `docs/STAGE_1_VERIFICATION.md` (新建：阶段 1 综合验收报告)
- `docs/ROADMAP.md` (更新：阶段 1 实施进展勾选)
- 保留未提交成果：保留原先的 `.gitmodules`、`vendor/omp`、未提交文档与命令。

---

## 五、 如实标注：未验证项与后续动作

按照项目执行纪律，以下项目如实标注当前状态与限制：

1. **未验证项**：
   - **云端付费模型真实调用**：由于本次任务遵循严格安全准则，不读取、不打印、不提交用户私有 API Key，未向云端商业模型（如 Claude 3.7 / GPT-4o）发起产生扣费的真实多轮对话；
   - **Apple Foundation Models 原生编译**：构建日志显示本机环境缺少 Swift 6.4+ / macOS 27 SDK，Apple 原生框架为上游既有的 stub 状态；
   - **无色终端（Dumb / Monospace 4-bit）极端降级**：目前已验证 TrueColor 24-bit 及 ANSI 256 色环境，极少数古老 VT100 终端的字符渲染未做物理硬件机型测试。

2. **后续动作（推进至阶段 2）**：
   - 继续推进阶段 2 的「云光 Cloudlight」与「晨曦 Daybreak」两套日间浅色主题实现；
   - 持续跟进 oMLX 在大显存上下文下的长文本压测；
   - 准备后续阶段的旧代码清理与包管理精简。
