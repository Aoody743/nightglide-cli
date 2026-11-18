# Nightglide Stage 0（补充）/ 2 / 3 验收记录

**验收日期**：2026-11-18（自主开发迭代，subagent 并行实现 + 主会话审查）
**代码基线**：`vendor/omp` 子模块 `codex/nightglide` 分支，`v18.20.2` + Stage 1（`accccd9…5ae02bf`）+ Stage 2（`da9728e…b16f0c7`）+ Stage 3（`660b741…8e768d4`）+ 审计加固与 UI 精修（`2345400`→`f3b42d7`，见第六、七、八节）
**验证环境**：macOS 15.7.9 arm64，Bun 1.4.4，nightly Rust，本地 oMLX（127.0.0.1:8000，模型 `endless`）

---

## 一、Stage 0 补充验证（基线）

### 1. 干净环境重复构建 ✅
从私有 fork 全新克隆 `/tmp/ng-clean-clone`（保留供复用）：

| 步骤 | 结果 |
|---|---|
| `git clone` + `git submodule update --init --recursive` | 成功（55s），子模块检出 `5ae02bf`，`.gitmodules` 指向私有 fork，gh 认证可用 |
| `bun install --frozen-lockfile` | 成功（991ms，298 包，零警告） |
| `bun run build:native` | 成功（504s，0 错误，仅预期的 Swift 6.4+/macOS 27 SDK stub 警告） |
| 入口验证 | `bun run dev -- --version` / 根目录 `bun run omp --version` / `bun run ng --version` 全部输出 `nightglide/18.20.2`；`--smoke-test` ok |
| 快速测试子集 | composer-shape-preview 4 pass / 0 fail |

结论：**干净克隆 → 可构建 → 入口可用全链路成立**。注意版本横幅为品牌化后的 `nightglide/18.20.2`（OMP_BASELINE 旧记录 `omp/18.20.2` 是品牌化前所写）。

### 2. 真实模型端到端 ✅（本地链路）
提供商凭据来自用户既有 OMP 原生配置（`~/.omp/agent/models.yml`），全程未打印任何 key。

| 项 | 结果 | 证据 |
|---|---|---|
| 单轮对话 | ✅ | `omlx/endless` 真实回复，token 统计完整，cost $0 |
| 多轮会话 | ✅ | `-c` 续接后模型精确复述第一轮植入的代号；session JSONL 落盘 |
| 工具调用 | ✅ | read（指出测试文件里 "3 items" 与实际 2 项不符——真实读取的强证据）、write、bash 自验证 |
| 长内容 | ✅ | 411 行输出（69 个 interface），完整闭合无截断 |
| 流式 | ✅ | `--mode json` 事件级验证：thinking_delta×7 → text_delta×8 渐进到达（非整块输出）；json 带 ttft/duration |
| 品牌入口 | ✅ | `ng` 与 `omp` 行为一致（Stage 1 已把默认名改为 nightglide，`PI_RAW_BIN` 实际冗余但无害） |
| oMLX 注册冲突 | ✅ 无冲突 | 用户 models.yml 已有 omlx 时与 Stage 1 动态探测并存归一，`omp models` 单一 omlx section |
| 审批机制 | ✅ | print + `--approval-mode always-ask`：write/bash/edit/eval 全部拦截并返回明确错误，文件未被修改 |
| 云端 anthropic-messages 网关 | ❌ 外部限制 | 网关按客户端白名单（仅允许 Claude Code/Desktop）拦截 `GET /v1/models` 与 `POST /v1/messages`（直接 curl 亦 403）。**未尝试任何客户端伪装绕过**——这是第三方服务访问策略问题，需用户自行决策（网关侧放行，或更换端点） |
| 本地网关 57321 | ✅ | `codexplus/gpt-6.1-terra` 回复 OK，cost $0.006；⚠️ TTFT ~79s（外部服务质量） |
| TUI 交互 | ✅ 部分 | expect 驱动真实 pty：品牌标出现 ✅、审批对话框出现 ✅、防误触 arm 窗口后 Enter 批准 → `write` 真实执行、文件落盘内容精确匹配 ✅、`/exit` 干净退出 ✅；**取消（Esc）自动化检测不确定**、滚动/resize 未测，需人工确认 |

集成注意：程序化 spawn OMP 时必须立即 close 子进程 stdin（EOF），否则 print 模式在 `readPipedInput` 永久阻塞。

---

## 二、Stage 2 主题 ✅

**交付**：`nightglide-aurora`（暗，紫罗兰/青绿，Aurora Ripple 帧）、`nightglide-cloudlight`（浅，冷蓝，Cloud Drift 帧）、`nightglide-daybreak`（浅，陶土红/晨青，Dawn Bloom 帧）三套完整 66 槽主题 + welcome 微光轨迹浅色适配 + `theme.light` 默认改为 `nightglide-cloudlight`。

**验证**：
- 结构校验（一次性脚本，未入仓库）：3 主题 × 9 类检查共 45 项全过（66 必填槽、luma 分类、vars 无循环、帧等宽、terminal.ansi 16 项、createTheme 构造）。
- 对比度（WCAG，bg / statusLineBg）：Cloudlight text 11.85/10.53、accent 6.28/5.58、success 5.20/4.62、warning 6.31/5.61、error 6.20/5.50；Daybreak text 10.19/8.73、accent 5.66/4.85、success 6.20/5.31、warning 6.65/5.70、error 6.23/5.34；dim 加深至 3.47/3.55 达标。Aurora text 16.85、accent 9.74。
- 渲染快照：`scripts/verify-workbench.ts` 扩展至五主题 × 3 尺寸 × 3 状态 = **45 张快照全过**（EXIT 0）。
- 独立复跑（主会话）：9 个主题相关测试文件 **49 pass / 0 fail**；loader 实载三主题 isLight 分类正确。
- 既有套件基线：tui 全量 4,663 用例中 9 个失败均为既有问题（8 个 notify 测试品牌漂移**已修复**（`8e768d4`），1 个偶发）。
- typecheck：tui 1,448 文件 + coding-agent 4,975 文件 0 错误。
- 主题切换不丢状态：代码审读（previewTheme/setTheme 仅换渲染实例 + epoch）+ 既有 `theme-epoch-fallback`/`theme-islight` 测试覆盖。
- 降级：256 色量化实测正确（aurora accent→183、cloudlight→25、daybreak→131）；NO_COLOR/16 色为代码推论（chalk level=0 路径），物理 VT100 未测。

**未验证**：真机终端的最终观感（仅渲染器 + 数学验证）；CJK ambiguous-width 终端下 `✦≈░◎` 可能按 2 格渲染（帧内字符同类、无 W/F 宽字，与既有主题同一假设）。

---

## 三、Stage 3 路由 ✅（LOCAL 真实验证，BALANCED/PERFORMANCE 单测覆盖）

**交付**：`nightglide.routingMode`（`manual` 默认 = 完全 no-op）+ `nightglide.localModel`（显式本地模型）；LOCAL/BALANCED/PERFORMANCE 三模式经 `overrideModelRoles` + `installRetryFallbackRole` 在会话层生效（不落盘）；子智能体 `@role` 经 model-resolver 自动传播（测试证实，executor 零改动）；LOCAL 下 per-call 云端模型拒绝（`invalidModelSelectorReason`）；status line 新增回退指示（serving 模型 ≠ 主选时 ` ↩ <model>` + 链路说明）与可选 `routing` 段（只显示真实生效模式，manual 不渲染，未进默认 preset）；print 模式 yolo 默认 stderr 警告。

**验证**：
- 新测试 29 个（routing 23 + status line 6）全过；独立复跑确认。
- 定向回归：retry-fallback、resume-model-fallback、session/approval/flags、fallback/model/settings/task/print 共 500+ 用例 0 失败。
- typecheck：coding-agent + tui 0 错误；oxlint 0 警告。
- **真实路由主会话**：沙箱项目层 `.omp/config.yml` 设 `routingMode: local` → 真实会话落 `omlx/endless`（用户全局默认为云端 `codexplus/gpt-6.1-terra`，路由覆写真实生效）。
- **真实路由子智能体**：同配置下让模型经 task 工具 spawn 子智能体 → transcript 全程仅 `omlx/endless`（task 工具真实执行）。
- **LOCAL 快速失败**：`localModel: "omlx/nonexistent-model"` → 启动即抛错，消息含 `nightglide.routingMode=local` + 原因 + 两种补救建议。
- **headless yolo 警告**：无任何审批配置时 stderr 警告出现；带 `--approval-mode always-ask` 时不出现（实测）。
- 已知行为（如实记录）：LOCAL 的启动期快速失败只在冷缓存或显式 localModel 不匹配时触发；发现缓存为热时绑定缓存端点，端点实际不可用则在首次请求时可见失败（符合 OMP 发现哲学，不在每次启动 ping）。

---

## 五、Stage 0 补充验证二（2026-11-18 第二轮，MCP/扩展/LSP/计划模式/TUI 交互）

沙箱隔离验证（`PI_CODING_AGENT_DIR` 指向 /tmp agentdir，models.yml 只读复制；未改动用户真实 `~/.omp` 与 vendor/omp）。真实模型走本地网关 `codexplus/gpt-6.1-terra`。

| 项 | 结果 | 证据 |
|---|---|---|
| MCP | ✅ | 手写 stdio JSON-RPC server（/tmp/ng-mcp-test/server.mjs）注册于沙箱 mcp.json；`-p --mode json` 真跑：模型发现 `mcp__ng_echo_echo` 并真实调用，toolResult 返回 `NG_ECHO_RESULT: stage0-mcp-probe`（会话 JSONL：/tmp/ng-stage0/mcp-session.jsonl）。配置格式 = 项目根 `mcp.json`/`.omp/mcp.json`（mcp-json discovery） |
| 扩展 | ✅ | 两条注册路径均真机验证：`.omp/extensions/` 自动发现（ng-toy-ext.ts，模型调用返回 `NG_EXT_TOOL_OK`）与 config.yml `extensions:` 数组（返回 `NG_CONFIG_EXT_OK`）；loaded.log 记录 session_start 事件 |
| LSP | ✅ | 本机真实 rust-analyzer + Cargo 项目：`lsp` 工具 symbols 列出函数、references 返回 3 处精确行号、hover 返回签名+文档（lsp-session.jsonl）。本机无 typescript-language-server/pyright/gopls（如实记录） |
| 计划模式 | ✅ | print 模式按设计忽略 plan.defaultOnStartup（stderr 明确提示，print-mode.ts issue #8272）；`--plan-yolo --plan-yolo-into` 真跑全流程：只读探查 → 计划写入 plan.md → propose → "Plan approved. Implementing" → 真实创建 plan-check.txt |
| TUI 取消 | ✅ | 流式中（~2000 字 delta）发 Esc：delta 归零、`⎋ Working…` 行消失、composer 恢复可输入；"Interrupted by user" 标签被有意抑制（shouldRenderAbortReason），持久化证据 = 会话文件 `stopReason:"aborted"` |
| TUI 滚动 | ⚠️ | 主 transcript 提交进**终端原生 scrollback**（interactive-mode.ts:4377，无 in-app 滚动键）——pty 无法从内部驱动宿主模拟器，无法端到端验证（结构性限制，非缺陷）；in-app overlay 滚动实测通过：alt+m 模型浏览器 77 项超屏，pageDown/pageUp 视口翻页真实生效 |
| TUI resize | ✅ | 两轮 stty pty 重设（80×24→120×40）：分隔线宽度 80→120 重绘、composer 可用（round1: agent C；round2: 分隔线 run 统计 2×≥118 + 1×80） |
| 主题真实切换 | ✅ | 真实 TUI 对比捕获（/tmp/ng-capture-flight.log vs cloud）：flight 特有色 `38;5;99`(4次)/`147`(3次) 在 cloud 捕获中为 0；cloudlight 特有色 `38;5;110`(4次)/`60`/`67` 在 flight 中为 0——主题在真实 TUI 中真实生效 |

沙箱产物保留在 /tmp/ng-stage0、/tmp/ng-mcp-*、/tmp/ng-ext-test、/tmp/ng-lsp-test、/tmp/ng-tui-stage0。expect 脚本可复用（/tmp/ng-tui-stage0/*.exp）。

---

## 六、UI 精修迭代（2026-11-18 第三轮，subagent 并行 + 主会话整合）

按 NIGHTGLIDE_DIRECTION.md 落地两项完整可见改进（文件所有权分离，整合时合并验证）：

**1. 安静品牌导航线**（`cbd2b07d`，welcome.ts + interactive-mode.ts 调用点）：块状品牌标上方新增单行导航——左 `✦ nightglide`（accent 星标 + bold 品牌名），右对齐真实 project（会话 cwd basename）与真实 session 模型（`formatModelStringWithRouting`），下接 borderMuted 满宽发丝线。数据未知即省略、绝不编造；quiet 启动不受影响；`render(width, context?)` 向后兼容 + `setContext` 宿主钩子；窄屏先删/截右侧保单行（40 列仍成立）。
**2. 工具卡片与状态行视觉层次**（`3b6f6536`，output-block.ts + status-line segments.ts 样式级）：running=accent 框+dim meta、success=borderMuted 收束+text 标题、error/warning 关键色标题+dim meta（调用方显式 borderColor 或自带 ANSI 时不重样式，全部取主题槽位）；状态行 model 名保持 primary、thinking/fast 徽标降 dim、routing 限定词 dim 使 mode+model 连成一串 accent。

**验证**：welcome 相关 34 用例全过（含 4 个新用例）；output-block 11 pass（含 5 个新用例）；status-line 10 文件 70 pass；全量 tui 套件 4674 用例 4665 pass / 8 skip / 1 fail——唯一失败（tools-native-github run-watch）经 stash 对照与单独复跑确认为**套件顺序型既有 flake**（单独跑恒过），与本轮改动无关；tsc 两包 0 错误；`verify-workbench.ts` 已传入真实 context，45 张快照（5 主题 × 3 尺寸 × 3 状态）全部含导航线且无溢出；五主题三状态 ANSI 签名两两可区分、对比度 ≥3（标题层）/dim 3.47-4.31。

---

## 七、UI 精修迭代（2026-11-18 第四轮，subagent 并行 + 主会话整合审查）

交付 commit `f3b42d71`（`vendor/omp`）并增强自动化多尺寸走查套件 `scripts/verify-workbench.ts`：

### 1. 原生 TSP 卡片安静品牌导航线（`welcome.ts`，第五轮审计后含窄屏策略）
- `WelcomeComponent.prototype.describe(cx)` 原生节点树对齐 ANSI 布局（窄屏逐条镜像 `#renderNavLines`）：
  - 顶部导航行 `node("row", { justify: "between", align: "center", role: "omp.welcome.nav" }, [ brandText, contextText? ], "nav")`；
  - 左侧品牌文本：`✦ nightglide`（accent 星标 + bold 品牌名称，role: `omp.welcome.brand`）；
  - 右侧上下文文本：真实 project（`muted`）与 live model（`dim`），以 ` / ` 连接（role: `omp.welcome.context`）；无 context 或右侧空间 < 6 列时省略；超宽时降级为单 `muted` span 截断（与 ANSI 同口径）；
  - 窄屏：`room = cx.cols - 2` 小于品牌宽时导航行与分割线一并省略；tip 行与 ANSI 同门槛（`cols >= 50` 才渲染）；
  - 分割线：`node("rule", { role: "omp.welcome.rule" }, undefined, "nav-rule")`，位于导航行与 lockup 之间；
  - 节点缓存：`tip`/`context`/`cols` 三者全等时返回同一节点引用（宿主侧稳定）；`setContext` 或宽度变化使缓存失效后整体重建（非部分重构）。

### 2. 会话中途模型切换实时同步更新（`interactive-mode.ts` & `event-controller.ts`）
- 封装 `updateWelcomeContext()`，在启动初次挂载以及 `model_changed` / `retry_fallback_succeeded` 事件触发时，自动提取最新 serving/configured 模型通过 `welcome.setContext(...)` 同步更新，并触发 `ui.requestRender()` 局部重绘。事件侧由 `EventController` 单点负责（第五轮审计后移除 InteractiveMode 订阅中的重复触发，此前每次 model_changed 触发两遍）。
- 新增单元测试 `event-controller-welcome-context.test.ts` 验证协同流程。

### 3. 工具执行过程与卡片视觉层次精修（`output-block.ts`、`status-line.ts`、`tool-card.ts`、`read.ts`）
- 标题与 meta 中间的分隔圆点 ` · ` 统一派生 `dim` 语义色，杜绝 SGR reset 导致的圆点高亮晃眼。
- 底框与折行 footerMeta 自动淡化：对纯文本 footerMeta 自动添加 `dim` 着色，保持卡片底边沉静。
- 智能语义色彩派生：状态图标为 `error` / `warning` 时，未指定 titleColor 的卡片自动继承警示色彩，不再生硬回退至 accent。
- 窄屏自适应：长标题智能右截断（`…`）、底框 footerMeta 溢出时自动折入卡片内容行，极限 1~5 列视口严格边界截断无溢出。

### 4. 主题槽位、WCAG 对比度、动效 Zero Jitter 与多尺寸全量走查（`scripts/verify-workbench.ts`）
- **主题完整性**：5 套内置主题 100% 声明全部 66 个色彩槽位（59 fg + 7 bg）。
- **WCAG 对比度**：五套主题画布主文对比度 10.19 ~ 16.85:1（AA ≥4.5 达标）；浅色主题（Cloudlight / Daybreak）的 `statusLineBg` 文本对比度 8.73 ~ 10.53:1，模型名 4.85 ~ 6.29:1（AA ≥4.5 达标）；辅助 dim 文本 3.04 ~ 3.08:1（达到 ≥3.0 大文本线，非 AA 正文线 4.5；画布 dim 维持第三轮 ≥3.4 口径）。
- **动效 Zero Jitter**：五套主题专属 Spinner（Flight: `━╾─`, Abyss: `●`, Aurora: `≈✦`, Cloudlight: `░▒▓`, Daybreak: `◎`）帧序列全帧等宽，且低动效静态占位文案与动态文案实测等宽（位移 = 0 列；第五轮审计后补入真实断言，此前仅有序列内等宽检查）。
- **多尺寸自动化断言**：5 主题 × 3 尺寸 (80x24, 100x30, 120x36) × 4 模式 (empty, active-dialogue, approval, low-motion) 共 60 项视口断言；连同槽位 5、WCAG 20、Zero Jitter 30 合计 **115 项断言 100% 全部通过**（第五轮审计后：修走查脚本 low-motion 状态行 80 列溢出并补退出码门槛后复跑）。

### 5. 验收结果数据
- `bun test packages/tui/test/welcome.test.ts`：22/22 pass（第四轮 4 个原生导航线用例 + 第五轮 5 个原生窄屏/缓存用例）
- `bun test packages/tui/test/output-block.test.ts`：17/17 pass（含 6 个窄屏与色彩层次新增用例）
- `bun test packages/coding-agent/test/event-controller-welcome-context.test.ts`：2/2 pass
- `bun scripts/verify-workbench.ts`：115/115 pass（exit 0；失败时 exit 1 为第五轮新增）
- TypeScript 类型检查：`packages/tui`（1,449 文件）与 `packages/coding-agent`（4,978 文件）**0 错误**。
- `oxlint`：`packages/tui` 0 错误 0 警告；`packages/coding-agent` 0 错误、18 条警告——全部为上游既有文件（`src/thread/*`、`src/tools/browser/`、`test/tools/*` 等）的 `no-template-curly-in-string`/`no-useless-spread`，本轮未触碰，如实记录。
- `./nightglide --version` 与 `./nightglide --smoke-test`：正常输出 `nightglide/18.20.2`，smoke-test: ok。

---

## 八、第五轮审计加固（2026-11-18，复跑核对 + 修复）

主会话对第四轮交付做全量复跑审计（两个 subagent 分别复跑声明数字与逐行审查 diff），发现并修复：

- **P0 · 验收声明失实**：第四轮记录的 "110/110 全过" 实为 105/110——五主题 80x24×low-motion 视口全部 87/80 列溢出，根因是走查脚本自加的 ` [motion:off] `（14 列）使状态行超宽；且脚本失败时仍以 exit 0 结束，失败被静默吞掉（这正是失实未被提交前察觉的机制原因）。已修：状态行窄屏自动收缩模型段（100/120 列保持全量形态，与基线逐字节一致）；脚本按结果设置退出码（全过 0 / 有失败 1，负向验证确认失败仍完整打印快照）。修复后 **115/115**（含新增 5 条动静态等宽断言），80x24×low-motion 五主题 maxCol 全部 80/80。
- **P1 · 声明超出实际**：①dim 3.04~3.08:1 曾被记为 "WCAG AA 达标"，实际脚本阈值为 ≥3.0 大文本线（AA 正文线 4.5），已按真实口径改写（阈值保持 3.0，标题注明大文本线）；②"动态 vs 静态帧宽一致" 此前从未被断言，已补真实断言（RUNNING_META 静态占位改为与动态等宽的冻结字形）；③原生 TSP 导航线此前无窄屏处理、与 "对齐 ANSI 布局" 表述不符，已补齐窄屏等价策略（见第七节 1）并新增 5 个 `describe()` 窄屏/缓存用例。
- **P2 · 冗余与记录**：model_changed 的 welcome 同步此前双路径各触发一次（幂等但冗余），已收敛为 EventController 单点（测试不变）；`describe()` 缓存经复核为**活逻辑**（重复 describe 返回同一节点引用保持宿主侧稳定，invalidate 仅发生在 quiet 切换等显式路径），第四轮 "精确重构" 的措辞已订正；oxlint "0 警告" 订正为 tui 0 / coding-agent 18 条上游既有警告。
- **复跑通过**：welcome 22/22、output-block 17/17、event-controller-welcome-context 2/2、双包 typecheck 0 错误、verify-workbench 115/115 + exit 0、`nightglide --version`/`--smoke-test` ok。

---

## 九、第六轮 UI 优化（2026-11-19，方向文档驱动的未精修面，subagent 并行 ×3 + 主会话整合复验）

按 [NIGHTGLIDE_DIRECTION.md](NIGHTGLIDE_DIRECTION.md) 对高频可见面补精修（先盘点方向承诺 vs 实现，锁定六项，文件所有权分离）：

1. **diff 词级高亮降噪**（`theme/schema.ts` + `chrome/diff.ts` + 五主题）：新增**可选**槽 `toolDiffWordAdded`/`toolDiffWordRemoved`（渲染点 `hasColor` 回落行级色，仿 `assistantMessageText` 先例；不入 66 必填列表，verify-workbench 兼容）；`renderIntraLineDiff` 移除 `theme.inverse` 反色——大段改动不再满屏反色。五主题精修值：深色取本主题 ansi 亮色同值（flight `#86efac`/`#fca5a5`），浅色加深降饱和（cloudlight `#0d5c2c`/`#7f1d1d`）。
2. **审批警示态**（`overlays/approval-dialog.ts`）：写/执行类审批（bash/write/edit/ast_edit/memory_edit/eval/manage_skill）面板边框 warning 色（新增 `ApprovalOverlayPanel` 覆写渲染，divider 保持默认，静态常亮无动画）；read/grep 等只读审批维持原样。如实记录：对话框无结构化工具类型，按 prompt 首行工具名判定。
3. **composer nightglide 两态**（`components/composer/nightglide.ts` + `types.ts` + `editor.ts`/`custom-editor.ts`）：working（流式/工具执行中）顶线整体 accent + 左端 `✦ ` 徽标，idle 保持 borderMuted 原样；`ComposerChromeContext.working?` 为可选增量，其他 shape 与外部调用零破坏；无动画无定时器。
4. **markdown 标题字阶**（`theme/tui-adapters.ts`）：heading 适配消费 depth——H1 `mdHeading`（markdown.ts 另加 underline）/H2 `mdHeading`/H3 `text`/H4 `muted`/H5-6 `dim`，权重由 markdown.ts 统一处理不叠加；colorful 模式沿用原 ANSI 阶梯。
5. **Aurora glow 补齐**（`prompt/welcome.ts`）：新增 `AURORA_STOPS`（紫罗兰→青绿，取 aurora vars 四色，亮度中段凹陷节奏与既有四组一致），暗色分支 aurora 不再回落 Flight 色带。
6. **success 标题色统一**（`render/status-line.ts` + `render/tool-card.ts`）：success 落 `text`，与 output-block 三态基准一致（error/warning 不变，running/info 仍 accent，显式 titleColor 优先）；双路径 8 用例锁定。

**验证（主会话整合复验，全部亲跑）**：tui 全量 **4,526 pass / 8 skip / 0 fail**（338 文件）；双包 typecheck **0 错误**（tui 1,451 / coding-agent 4,978 文件）；tui oxlint **0 警告**（coding-agent 18 条上游既有不变）；`verify-workbench.ts` **115/115** + exit 0；`nightglide --version` 与 `--smoke-test` ok。测试增量：theme-diff-word-color 新 7、status-line-title-color 新 8、dialogs-native +1（23）、composer-shape-preview +4（8）、colorful-markdown 六档锁定、edit-renderer 更新（32）、welcome +1（23）。

---

## 四、剩余清单（按优先级，2026-11-19 第六轮 UI 后更新）

1. **真实云端跨模型验证**：被 claude-proxy 网关客户端白名单阻塞（外部服务策略）。需要用户决策：网关侧放行 / 更换端点 / 显式 models 列表 + 客户端头（涉及第三方访问策略，项目侧不擅自绕过）。
2. **BALANCED/PERFORMANCE 真实双模型会话**：单测已覆盖语义；真实跑需云端可用（同阻塞 1）+ codexplus TTFT 排查。
3. **主 transcript 原生滚动**：结构上由终端 scrollback 承载（见第五节），无法经 pty 端到端自动化；如需 in-app 滚动属产品决策。
4. **Stage 4**：打包二进制化（bun --compile 未验证）；旧原型清理（引用检查后）。
5. **物理 VT100/无色终端**：未测（16 色/NO_COLOR 为代码推论）。
6. **print 默认审批模式**：是否从 yolo 改为更严格默认 = 未决产品问题（当前：上游默认 + stderr 警告 + 文档）。
7. ~~原生 TSP 卡片导航线与动态模型同步更新~~：✅ 已全部实现并双轨验证（见第七、八节，含原生路径窄屏策略）。
8. ~~工具执行卡片视觉层次与窄屏精修~~：✅ 已全部完成并自动化验证（见第七节）。
9. ~~MCP / 扩展 / LSP / 计划模式~~：✅ 已全部真机验证（见第五节）。
10. **UI 优化后续批次**（按方向文档盘点）：错误横幅品牌化 + 恢复动作、`thinkingMax` 孤儿槽位收尾（批次 2 剩余）；120 列并排 diff、面内 toast、验收断言进 CI（批次 3，战略级）。
