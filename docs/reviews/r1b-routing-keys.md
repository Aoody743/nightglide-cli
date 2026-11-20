# R1b 只读审查：3.2 四模式路由语义 + 2.1 ctrl+n 键位枚举

- 日期：2026-11-20
- 范围：只读审查包，前置 P2.1（侧栏）与 P3（路由/权限）。除本文件外未写入任何仓库文件。
- 路径约定：下列引用中 `routing` 指 `vendor/omp/packages/coding-agent/src/config/nightglide-routing.ts`；其余 `packages/...` 均相对 fork 根 `/Users/aoody743/Documents/Nightglide CLI/vendor/omp/`。
- 参照原文：`docs/DEVELOPMENT_PLAN.md` §3.2（真实路由与多智能体配置，L78-83）与 §2.1（主界面和侧栏，L57-62）。

---

## 审查一：manual / local / balanced / performance 四模式语义差异表

### 1.1 基础机制（逐行核对结论）

- 模式枚举与默认值：`routing:22-29`（`NightglideRoutingMode = "manual"|"local"|"balanced"|"performance"`，默认 `manual`）。仅通过 settings 键 `nightglide.routingMode` 配置（`routing:25-60`）；**无 CLI 旗标、无 slash 命令、无运行中切换路径**（全库检索仅 `sdk.ts:2279` 一处调用）。
- 应用时机：仅**全新会话**应用一次，恢复（resume）的会话不动（`sdk.ts:2274-2284`）；同一 settings 实例不重复应用（WeakMap 缓存，`routing:244-249, 271`）。
- 实现方式：全部复用现有原语——`settings` 的 session-scoped 覆盖（`cfgModelRoles.override` + `cfgRetryFallbackChains.override`，`packages/coding-agent/src/session/retry-fallback-chains.ts:215-234`），不落盘、不改用户配置（`retry-fallback-chains.ts:213` 注释）。
- 本地模型判定：provider id ∈ 已知本地集合（omlx/ollama/lm-studio/lmstudio/vllm/llamacpp/llama.cpp/jan/gpustack/localai，`routing:77-88`）或 baseUrl 为 loopback（localhost/127.0.0.1/::1，`routing:123-132`）；二者取并（`routing:135-137`）。
- 本地模型解析：`nightglide.localModel` 显式选择器优先（须同时匹配可用目录且 isLocalModel，`routing:167-189`）；否则按"已知本地 provider 优先于 loopback-only，各组内目录序"排序（`routing:191-208`）。
- 冷缓存刷新：**仅 LOCAL** 在无缓存本地模型时，对本地可发现 provider 做**一次**有界刷新（`online-if-uncached`，只碰 loopback，绝不抓云端目录，`routing:278-285`）；BALANCED/PERFORMANCE 从不刷新（`routing:276-277` 注释）。

### 1.2 角色清单与会话内职责（routing:91-115 + model-roles.ts:56-91）

| 角色 | routing 中的归属 | 职责（证据） | 未配置时的内建解析 |
|---|---|---|---|
| default | LOCAL 全改；BALANCED 加链；PERFORMANCE 加链 | 主会话模型（`sdk.ts:2296-2330`） | 目录启动兜底（`routing:432-439`） |
| smol | LOCAL 全改；BALANCED 本地优先；PERFORMANCE 提强 | 快速辅助：commit 文案（`packages/coding-agent/src/utils/commit-message-generator.ts:96`）、cleanse（`packages/coding-agent/src/cleanse/index.ts:21`）、prewalk 目标（`packages/coding-agent/src/config/model-resolver.ts:1406`）、skill 描述（`packages/coding-agent/src/extensibility/skill-descriptions.ts:75`） | 目录内建链（`model-resolver.ts:1184-1187` 同组） |
| slow | 仅 LOCAL 全改 | Thinking 模型（eval completion bridge `packages/coding-agent/src/eval/completion-bridge.ts:65`） | 同上 |
| plan | 仅 LOCAL 全改 | Architect 规划 | 同上 |
| task | LOCAL 全改；BALANCED 本地优先；PERFORMANCE 提强 | 子智能体默认角色（内置 task agent `model: "@task"`，`packages/coding-agent/src/task/agents.ts:56`） | 同上 |
| advisor | LOCAL 全改；PERFORMANCE 提强（BALANCED 不动） | 二次意见评审，别名解析到 slow（`model-resolver.ts:1184, 1197`） | configuredOnly：slow 未配置则不继承 default（`model-resolver.ts:1190-1199`） |
| memory | LOCAL 全改；BALANCED 本地优先；PERFORMANCE 提强 | 记忆管线总结；别名 tiny→smol（`model-resolver.ts:1185, 1191`） | 同上 |
| tiny | LOCAL 全改；BALANCED 本地优先；PERFORMANCE 提强 | 在线标题/分类器、TTS 增强、judge 候选（`packages/coding-agent/src/tts/speech-enhancer.ts:83`、`packages/coding-agent/src/config/settings.ts:3868`）；别名 smol（`model-resolver.ts:1186`） | 同上 |
| widget | LOCAL 全改；BALANCED 本地优先；PERFORMANCE 提强 | 后台任务 widget 规格与图注（`packages/coding-agent/src/config/settings.ts:1090`、`packages/coding-agent/src/job-widgets/author.ts:174`）；别名 smol（`model-resolver.ts:1187`） | 同上 |
| commit | 仅 LOCAL 全改 | /commit 命令的模型选择（`packages/coding-agent/src/commit/model-selection.ts:46`，回退序 `["commit","smol",...]`） | 同上 |
| vision/image/web/speech/dictation/judge | **四模式均不触碰**（kind 类角色，`routing:90` 注释；测试 `test/nightglide-routing.test.ts:170,186`） | vision 图像输入；image 生成；web 搜索；speech TTS；dictation 语音转写（`model-roles.ts:83-90`）；judge 评判 | 各自 kind 目录 |

### 1.3 四模式 × 角色行为矩阵

安装原语两种：`installRetryFallbackRole`（改主模型 + 装链，`retry-fallback-chains.ts:215-234`）与 `installRoleChainOnly`（只装链不改主模型，`routing:400-407`）。

| 角色 | manual（默认） | local | balanced | performance |
|---|---|---|---|---|
| default | 原样（`routing:270` 直接返回 undefined） | 主模型→本地；链=全部本地模型（`routing:321-330`）。**例外**：CLI `--model` 钉定时主模型保留，仅装本地链，并记 `defaultNonLocal`（`routing:322-328`） | 主模型不动；链=本地 + 用户已配置项前置插入（`routing:359-360`） | 主模型不动；链=[strongest, 本地?, …用户配置]（`routing:374-384`） |
| smol | 原样 | 本地（`routing:321-331`） | 主→本地；链=[本地, 原配置]；无配置则严格本地（`routing:343-356`） | 主→strongest；链=[strongest, 本地?, …default 用户链]（`routing:379-381`） |
| slow / plan / commit | 原样 | 本地 | **原样，无本地回退**（不在 `NIGHTGLIDE_BALANCED_LOCAL_ROLES`，`routing:105`） | **原样**（不在 `NIGHTGLIDE_PERFORMANCE_STRONG_ROLES`，`routing:108-115`） |
| task | 原样 | 本地（`@task` 别名随之本地） | 本地优先（`@task` 先本地后原配置） | strongest |
| advisor | 原样 | 本地 | 原样（仍别名 slow） | strongest |
| memory / tiny / widget | 原样 | 本地 | 本地优先 | strongest |
| kind 类（vision/image/web/speech/dictation/judge） | 原样 | 原样 | 原样 | 原样 |
| 用户自建角色（非上述清单） | 原样 | 继承 default 链=本地链（`retry-fallback-chains.ts:170-181` 的 default 链扩散；测试 `test/nightglide-routing.test.ts:310`）；自身已有链保留 | 继承 default 链（含本地前置） | 继承 default 链（strongest+本地） |
| 用户模型键/通配链（`provider/...` 键） | 原样 | **session 内丢弃**，防止把 LOCAL 失败路由上云（`routing:332-338, 419-425`；测试 :335） | 原样（installRoleChainOnly/installRetryFallbackRole 只覆盖被装角色自身键） | 原样 |
| 无本地模型时 | — | **抛错拒启**（`routing:297-303`，见 1.5） | 降级：全部角色保持已配置值，不装任何链（`routing:304-314`，:311-314 提前返回） | 继续：小角色仍提 strongest，链里无本地项（`routing:304-310, 374-378`）；无 strongest 则整体不动（`routing:367-371`） |

回退链方向小结：LOCAL 链是**闭集**（本地模型列表，`routing:318`）；BALANCED 链是**本地在前、原配置在后**（`routing:351`）；PERFORMANCE 链是 **strongest 在前、本地随后、用户配置垫底**（`routing:374-378`）。

### 1.4 对照计划 §3.2"区分会话角色、子智能体、回退、其他工具和扩展的范围"

**已覆盖**（有代码 + 测试证据）：

1. 会话角色：10 个 chat 角色全部入路由面（`routing:91-115`），kind 角色显式排除并有测试（`test/nightglide-routing.test.ts:170,186`）。
2. 子智能体：三条通路全部被路由覆盖——
   - 覆盖传递：子智能体 settings 经 `baseSettings.overlay(...)` 读透父级 live settings（`packages/coding-agent/src/task/executor.ts:1263` "Every other setting reads through to the parent live"），session-scoped 角色覆盖随之生效；
   - `@role` 别名展开走同一解析器（`model-resolver.ts:1310`+；task=`@task`、sonic=`@smol`，`task/agents.ts:56,70`；测试 `test/nightglide-routing.test.ts:195`）；
   - 子智能体专属回退：`subagent:<id>` 钉定角色继承其来源角色的链（`task/executor.ts:322-345`）。
   - 附带约束：LOCAL 下子智能体按调用传云模型会被拒（`packages/coding-agent/src/task/structured-subagent.ts:413-424`；测试 :517,531）。
3. 回退：LOCAL 本地闭集 + 丢弃选择器键；BALANCED 本地前置；PERFORMANCE strongest+本地；降级路径有测试（:451,500）。
4. 无可用模型：三模式行为各异且有测试（LOCAL 抛错 :212；BALANCED 降级 :451；PERFORMANCE 兜底 :488,500）。
5. 状态呈现基础件：`agent-session.ts:7255-7267` 暴露实际生效模式与"非本地 default"选择器；`retry-fallback-chains.ts:55-87` 的 `ServingModel.served` 门保证回退未产出前不被计入（"回退和失败不得隐瞒"的机制基础）。

**未定义 / 未覆盖**（需 P3 决策或补实现）：

1. **状态行尚未接线**：`getNightglideRoutingMode()`/`getNightglideRoutingNonLocalDefault()`（`agent-session.ts:7255-7267`）在全 TUI/modes 无任何调用方——"简洁状态呈现"目前只有 API 无 UI。
2. **LOCAL 的"仅本地"承诺有侧门**：kind 类角色不受路由约束——LOCAL 会话中 dictation（语音转写，`stt/stt-controller.ts:164-165`）、speech/image/web/judge 仍可走云端 kind 模型。代码注释只承诺"chat 角色不分配云选择器"（`routing:35, 90`），产品文案若宣称"全本地"则与实际不符，需明示边界。
3. **子智能体显式选模的模式差**：LOCAL 拒绝非本地 per-call model（`structured-subagent.ts:413-424`），BALANCED/PERFORMANCE 对 per-call model **不做任何限制**（可显式点名云模型绕过路由）。这是嵌入代码里的产品决策，未见文档说明。
4. **MCP**：MCP 管线只暴露 tools/prompts/resources，**不消费模型**（`sdk.ts:6018-6040`），四模式对 MCP 无影响——范围澄清项，非缺口。
5. **LSP**：语言服务器非 LLM，`packages/coding-agent/src/lsp/` 全目录无 role/routing 引用——不受四模式影响，范围澄清项。
6. **扩展**：`ctx.models` 门面只读（list/current/resolve/family，`packages/coding-agent/src/extensibility/extensions/types.ts:568-587`），`resolve()` 走与核心相同的 settings 别名解析（`model-api.ts:19-39`）→ 扩展的角色查询**跟随路由**；扩展注册的自定义 provider 进入同一目录（`sdk.ts:1254-1277, 3182-3196`），loopback 的可被选为本地模型。**未定义**：无任何文档承诺扩展兼容路由语义；扩展若缓存了解析结果也不存在失效通知（当前模式本身不能中途切换，暂无实际暴露）。
7. **模式切换**：无运行中切换、无 CLI 旗标、无 slash 命令；改模式必须起新会话（WeakMap 挡重放，`routing:271`；resume 不路由，`sdk.ts:2274-2284`）。计划 §3.2 "增加手动选择与按用户配置自动调度"的"手动选择"目前只能改配置文件/设置 UI。
8. **BALANCED 的 slow/plan/commit 无本地回退**：云端失败直接走用户自配链，与"Balanced keeps your default, thinking and architect roles"（`routing:35`）一致，但 commit 角色未在描述中提及，实际也不在本地角色集（`routing:105`）——文案与实现的一致性可再核对。

### 1.5 待用户决策：LOCAL 无本地模型启动抛错（routing:297-303）

- 现状：LOCAL 模式解析不到任何本地模型时**抛错、拒绝启动**（`routing:297-303`），错误消息给出补救路径（起本地服务 / 设 `nightglide.localModel`）；此前已对本地 provider 做过一次有界刷新（`routing:278-285`）。测试断言该行为（`test/nightglide-routing.test.ts:212`）。
- 支持抛错的理由：LOCAL 的卖点是"会话与子智能体全部本地"（`routing:35, 45-46`）；静默降级会让用户以为在本地实则上云，违背"回退和失败不得隐瞒"。
- 支持回退的理由：BALANCED/PERFORMANCE 都选择降级继续（`routing:304-315`）；用户可能在无本地服务的机器上仍想进会话处理历史/文本任务，直接拒启体验偏硬；错误发生在启动期、无交互确认机会。
- 折中选项（供决策，均需改代码 + 测试）：(a) 保持抛错；(b) 抛错但提供一次性降级确认（交互模式下询问、headless 需旗标）；(c) 降级到 BALANCED 并在状态/日志显著标注"local 不可用"。
- 本审查不改行为，仅列为**待用户决策问题 P3-D1**。

---

## 审查二：2.1 ctrl+n 全量键位枚举（P2.1 侧栏接线前置）

### 2.1 按键处理面穷举

枚举原则：不止全局绑定表，凡 `handleInput`/listener 内对按键（含裸字符比较）做出反应的组件都计入。逐面如下（n = 存在对 ctrl+n 或 n/N 的消费）：

| # | 处理面 | 位置 | 消费的键 | ctrl+n (\x0e) | n / N |
|---|---|---|---|---|---|
| 1 | TUI 全局绑定表 `TUI_KEYBINDINGS` | `packages/tui/src/keybindings.ts:58-142` | 光标/词跳/删除/undo/拼写（ctrl+b,f,a,e,],w,k,u,y,.,-,d,j 等）、select 五键 | **无** | **无** |
| 2 | 应用级绑定表 `KEYBINDINGS`（含 TUI 合并） | `packages/tui/src/app-keybindings.ts:95-296` | esc/ctrl+c/ctrl+d/ctrl+z/alt+l/shift+tab/ctrl+t/ctrl+p/shift+ctrl+p/alt+m/alt+p/ctrl+o/ctrl+shift+o/alt+h/**n+alt+n(ask.note)**/ctrl+enter+ctrl+q/ctrl+g/alt+g/alt+i/ctrl+v/ctrl+shift+v/alt+shift+l/alt+shift+c/alt+a/ctrl+s/ctrl+r/alt+k/alt+shift+k/alt+shift+p/alt+o/f5/alt+up+shift+up/ctrl+l 等 | **无** | **n 在 `app.ask.note` 默认键内**（:155） |
| 3 | 编辑器可配置动作 `DEFAULT_ACTION_KEYS` | `packages/tui/src/prompt/custom-editor.ts:137-155` | 上述 app 动作子集（interrupt/clear/exit/suspend/cycle/model/dequeue/retry/paste/copy） | **无** | **无** |
| 4 | Editor（composer 本体） | `packages/tui/src/components/editor.ts:2100-2175` 及全文 | 打印字符插入正文（:2125 bulk 路径，单字符走同一插入级联）；绑定探查走 `KeybindingsManager`（无 ctrl+n 项）；vim 模式 opt-in（`tui.vimMode`，:849,1120-1126） | **无**（canonical "ctrl+n" 无绑定命中，最终被忽略不插入） | **n/N 在 composer 聚焦时插入文本**；vim normal 模式下 n/N 未实现、被吞（`packages/tui/src/vim.ts` 无 `case "n"`） |
| 5 | TUI 内部（tui.ts） | `packages/tui/src/tui.ts:2990-3130` | TSP/CPR/细胞尺寸应答（非击键）、hold 队列、capture 预检（`capturesInput` 仅 editor spaceHold/input/btw/context-viewer 实现）、input listeners（先于焦点组件）、`shift+ctrl+d` 调试（:3116）、ctrl+c/esc 双击窗 | **无** | **无**（listener 见 #9） |
| 6 | ask 对话框 | `packages/tui/src/overlays/ask-dialog.ts:1447-1450`（提示 :1065,1386） | 上下/enter/space/**n,N=备注** | **无** | **消费 n/N（备注）** |
| 7 | 审批对话框 | `packages/tui/src/overlays/approval-dialog.ts:400-410` | y/Y=一次、s/S=会话、**n/N=拒绝**、上下/page/enter | **无** | **消费 n/N（拒绝）** |
| 8 | 扩展 html-form ask | `packages/tui/src/html-form/dialog.ts:991-998, 1432, 1872` | `app.ask.note` 全部键（含 **alt+n 与 n**；下拉时滤掉单字符只留 alt+n） | **无** | **条件消费 n / alt+n** |
| 9 | input-controller 全局 listeners | `packages/coding-agent/src/modes/controllers/input-controller.ts:373-533` | link-hint 字母模式（:375）、left（聚焦 agent，:379-387）、**b**（btw 分支，:389）、**f/c**（btw 跟进/复制，:395-411）、pasteImage、ctrl+t/ctrl+r/ctrl+g/alt+g/ctrl+shift+o/alt+l、**ctrl+o**（工具展开，无视焦点，:516-533）、内联鼠标 | **无** | **无**（b/f/c 有条件消费，n 未用） |
| 10 | composer-hints | `packages/tui/src/prompt/composer-hints.ts:37-64` | **纯渲染**：←← 手势与 `app.thinking.cycle`（shift+tab）提示 | **无** | **无** |
| 11 | git-tui 全屏应用 | `packages/tui/src/apps/git/git-tui.ts:663-760`、`apps/git/sidebar.ts:903-904`、`apps/git/help.ts:80` | **q**（退出）、[]/v/1-4/w/b/r/?/c、k/j/h/l/g/G/s/u/x/space/delete/enter、pageUp/Down、alt+up/down、shift+up/down | **无** | **无**（q 消费属实，n 不消费） |
| 12 | 其他全屏 apps | `apps/ps-top.ts:254-262`（q/k/j/a/i/l/r/s/x）、`apps/shell-visualizer.ts:31-80`（q/k/j/v/i/e/d/r/s/u/c/-/./+/=、[]）、`apps/autoresearch-dashboard.ts:206`（q/g/G） | — | **无** | **无** |
| 13 | agent-hub（observe 面板） | `packages/tui/src/overlays/agent-hub.ts:631-666` | hubKeys、**1/2** 切区、活动搜索输入、表格导航 | **无** | **无** |
| 14 | agents-hub | `packages/tui/src/overlays/agents-hub.ts:709-760` | esc、enter、**space**、**ctrl+r** 重载、tab/shift+tab、搜索/create 输入 | **无** | **无** |
| 15 | model-browser | `packages/tui/src/overlays/model-browser.ts:1421-1466` | select 五键、home/end、enter；**其余全部进搜索框** | **无** | **n 打字入搜索（条件性）** |
| 16 | model-hub Roles 视图 | `packages/tui/src/overlays/model-hub.ts:286-299, 2256-2258` | x/f/c/[/]/**n=新建角色**/t/k/s/p/P 打印键 | **无** | **消费 n（新建角色）** |
| 17 | session-selector | `packages/tui/src/overlays/session-selector.ts:1471` + app 绑定 | **f2** 重命名、ctrl+r、backspace/delete、alt+k/alt+shift+k、ctrl+s/ctrl+p（排序/路径）、搜索 | **无** | **无** |
| 18 | select-list 搜索 type-ahead | `packages/tui/src/components/select-list.ts:758-772` | 搜索启用时所有打印字符（含 n）进过滤框 | **无** | **条件消费（打字）** |
| 19 | 其余 overlay 直比字符 | `overlays/copy-selector.ts`（a/A/o/O）、`rewind-selector.ts`（a/A）、`plan-review-overlay.ts`（a/d/g/G/c/e/u）、`annotation-overlay.ts`（a/e/g/G/u、[]）、`agent-transcript-viewer.ts`（g/G）、`setup/scenes/updates.ts`（1/2） | — | **无** | **无** |
| 20 | 控制台/其他 | `packages/coding-agent/src/stream/console-tui.ts:109`（ctrl+c）、`agent-session.ts:8587`（`\u000e` 仅出现在控制字符清洗正则，非输入消费） | — | **无** | **无** |

`parseKey` 层：裸 `\x0e` 由 native 表解析为 `"ctrl+n"`（`crates/pi-natives/src/keys.rs:215-221` CTRL_LETTERS），即 ctrl+n 在解析层有规范名、无消费者。

### 2.2 ctrl+n 与 n/N 结论

- **ctrl+n（\x0e）**：上述 20 个面逐一核对，无任何默认绑定或字面比较消费 `ctrl+n`（全库 grep `ctrl+n`/`\x0e` 仅命中 agent-session.ts:8587 的清洗正则与 keys.rs 的解析表）。用户可通过 `~/.omp/keybindings.yml` 把任意动作改绑到 ctrl+n（`app-keybindings.ts:254-291`），此时需按既有冲突提示处理（`keybindings.ts:144-147, 275-279` 仅检测用户配置内部冲突，不检测默认值占用）。
- **n/N**：非自由——composer 聚焦即打字（editor）；ask 对话框 n/N=备注（ask-dialog.ts:1447）、审批框 n/N=拒绝（approval-dialog.ts:407）、model-hub Roles 视图 n=新建角色（model-hub.ts:290）；搜索型列表把 n 当 type-ahead。**侧栏开关不能选裸 n/N**。
- 接线注意（P2.1）：tui.ts 的 input listeners 先于焦点组件（tui.ts:3058-3072），但 `capturesInput` 组件（editor spaceHold 等）可先吃掉按键；推荐把 ctrl+n 注册为 app keybinding（`KEYBINDINGS` 增加 `app.sidebar.toggle`，默认键 `ctrl+n`）并走 input-controller listener 模式，与 `app.tools.expand` 同构（input-controller.ts:516-533）。

### 2.3 次选方案对比

| 候选 | 占用情况（证据） | 终端兼容性 | 评价 |
|---|---|---|---|
| **ctrl+n** | 全 fork 零占用（2.1 表） | C0 控制字节 \x0e，所有终端原样送达（keys.rs:221 有规范解析） | **首选**；小代价：与 emacs/readline"下一行"肌肉记忆冲突，但 TUI 内无此语义 |
| alt+n | **已被 `app.ask.note` 占用**（app-keybindings.ts:155），html-form 对话框实际匹配（dialog.ts:991-998） | macOS Terminal.app 对 Option 键默认用于字符组合，仓内已注明 alt+up 因此不可达（app-keybindings.ts:186-189 注释） | 不可用：需重绑 ask.note，且 Terminal.app 兼容性差 |
| ctrl+o | **已被 `app.tools.expand` 占用**（app-keybindings.ts:141-144），且 listener 设计为"无视焦点生效"（input-controller.ts:516-533），ask/审批框内还兼展开详情（:523-531） | 与 ctrl+n 同级 | 不可用：占用面最广 |
| F 键（如 F2/F6） | f5=app.retry（app-keybindings.ts:179-185）；f2=session-selector 重命名（session-selector.ts:1471）；F1-F12 其余大多未占 | 仓内注释称 f5 "delivered verbatim by every terminal"（:180-182），但 macOS 默认 F 键须按 Fn，且 F3/F4/F9-F11 被系统占用；笔记本上体验差 | 备选而非首选：可达性依赖用户设置 |
| ctrl+b/ctrl+f 等 | 已被光标移动占用（keybindings.ts:61-67） | — | 不可用 |

### 2.4 结论（证据级）

**ctrl+n 可安全用于侧栏开关**：解析层有规范键名（keys.rs:221），四个绑定面（TUI_KEYBINDINGS / KEYBINDINGS / DEFAULT_ACTION_KEYS / 运行时直比字符）与全部 overlay/app/listener 面均零消费；送达性是 C0 字节、无终端差异风险。前提与注意：(1) 用户自定义 keybindings.yml 可能改绑，需复用既有冲突检测；(2) 接线走 app keybinding + input listener，避开 `capturesInput` 面板；(3) 裸 n/N 不可用（composer 打字/ask 备注/审批拒绝/model-hub 新建角色），alt+n 被 ask.note 占用，ctrl+o 被 tools.expand 占用。

---

## 附：证据文件清单

- `vendor/omp/packages/coding-agent/src/config/nightglide-routing.ts`（全文 462 行）
- `vendor/omp/packages/coding-agent/src/session/retry-fallback-chains.ts`（:130-133, 170-181, 195-234, 266-343）
- `vendor/omp/packages/coding-agent/src/sdk.ts`（:2268, 2274-2284, 2296-2330, 6018-6040）
- `vendor/omp/packages/coding-agent/src/task/structured-subagent.ts`（:396-424）
- `vendor/omp/packages/coding-agent/src/task/executor.ts`（:322-345, 1230-1263, 4619-4642, 4684）
- `vendor/omp/packages/coding-agent/src/task/agents.ts`（:56, 70）
- `vendor/omp/packages/coding-agent/src/session/agent-session.ts`（:7255-7267, 8587）
- `vendor/omp/packages/coding-agent/src/config/model-roles.ts`（:56-91）、`config/model-resolver.ts`（:1169-1211, 1310, 1385, 1406）
- `vendor/omp/packages/coding-agent/src/extensibility/extensions/model-api.ts`（:19-39）、`types.ts`（:568-587）
- `vendor/omp/packages/coding-agent/src/commit/model-selection.ts`（:46）、`stt/stt-controller.ts`（:164-165, 239）
- `vendor/omp/packages/coding-agent/test/nightglide-routing.test.ts`（:86-531 用例名见正文）
- `vendor/omp/packages/tui/src/keybindings.ts`、`app-keybindings.ts`、`prompt/custom-editor.ts`、`prompt/composer-hints.ts`、`components/editor.ts`、`components/select-list.ts`、`vim.ts`、`tui.ts`
- `vendor/omp/packages/tui/src/overlays/{ask-dialog,approval-dialog,agent-hub,agents-hub,model-browser,model-hub,session-selector,copy-selector,rewind-selector,plan-review-overlay,annotation-overlay,agent-transcript-viewer}.ts`、`html-form/dialog.ts`
- `vendor/omp/packages/tui/src/apps/{git/git-tui,git/sidebar,git/help,ps-top,shell-visualizer,autoresearch-dashboard}.ts`
- `vendor/omp/packages/tui/src/setup/scenes/updates.ts`、`modes/controllers/input-controller.ts`、`stream/console-tui.ts`
- `vendor/omp/crates/pi-natives/src/keys.rs`（:215-221）
