# Glide 全屏模式验证（2026-11-20）

接 [视觉差距审计](visual-gap-audit.md)。目标：验证在 OMP fork 自带的 pi-tui 引擎上做整窗布局是否可行。结论：**可行**，核心风险项已在 Terminal.app 真机验证。

## 已实现（fork `codex/nightglide`）

| 文件 | 内容 |
|---|---|
| `packages/tui/src/tui.ts` | 新增 `setScreenProvider()`：复用全屏 overlay 的 alt-screen 路径，但不算 overlay、不抢焦点，所有快捷键照常；滚轮捕获；光标/IME 归属 |
| `packages/tui/src/components/nightglide-shell.ts` | 整窗布局：顶栏、上下场景带、对话面板（真实 transcript）、信息栏（Model/Effort/Agents/Status，读真实状态）、输入卡片（真实编辑器）、状态行；四主题配色；按终端色彩模式（真彩/256 色）输出 |
| `packages/tui/src/components/nightglide-pixel-scene.ts` | 半块像素场景：`▀` 上下双色，平滑噪声云层/水体、光带、星点、气泡、水草 |
| `packages/coding-agent/src/modes/interactive-mode.ts` | 按 `nightglide.layout` 启动 Glide（默认）；F2 切换；滚轮/PgUp/PgDn 回看，End/Enter/点击标签回到底部 |
| `packages/tui/src/app-keybindings.ts` | `app.nightglide.glide`（F2） |

测试工具：`scripts/glide-spike/`（真实 Terminal 窗口 + PTY 注入 + 截图），截图在 `scripts/glide-spike/shots/`。

## 已验证（Terminal.app，真实运行）

- 流式回复在面板内显示，CJK、代码高亮正常；信息栏实时显示 Thinking/空闲。
- 滚轮在面板内滚动，不再滚动整个终端；回看时有提示，顶栏/场景/输入不动（用户已确认）。
- 140×40 → 100×30 → 80×24：先收场景，再收信息栏，输入与对话始终可用。
- `/exit` 退出码 0，终端恢复；退出时整段对话写回终端原生 scrollback。SIGTERM 也能干净恢复。
- 类型检查通过；tui 测试 4860 通过，1 个失败（`tools-native-github` run-watch，单独运行通过，与本改动无关）。

## 已知问题 / 未验证

1. ~~本地模型未运行~~：2026-11-22 已用 oMLX 实测流式回复，见文末“本地模型实测”。工具调用仍未测。
2. 开启鼠标捕获后，Terminal.app 中选中文字需按住 **Option(⌥) 拖动**；应用内复制用 OMP 自带的 `/copy`（G1 已确认在 Glide 下可用）。
3. ~~回看时视图随新内容漂移~~ —— G1 已修复（锚定）。
4. ~~transcript 内部动画在全屏下不刷新~~ —— G1 已确认并修复（renderTail 复用旧动画帧，工具计时与转圈停住）。
8. `!` 命令运行期间，键盘输入（含 PgUp/End）转发给该进程，这是 OMP 原有行为；此时回看只能用滚轮，回到底部可用滚轮或点击标签。
5. 长会话性能：每帧从尾部重渲染可见区，未做缓存；未压测几百轮的会话。
6. 亮色主题由 macOS 外观自动选择；潜水两套主题和亮色在本轮只看了配色，没有完整走查。
7. Terminal.app 只有 256 色。本机没有 iTerm2/Ghostty，真彩场景只用渲染预览（`scene-png.ts`）检查过，**真彩终端真机截图仍未做**。

## 后续计划

按依赖顺序，每步结束都在真实终端截图并和概念图并排对照。

**G1 收尾：把验证版变成可用版** —— 已完成（2026-11-20），见下方“G1 结果”
- 回看锚定（新内容不打乱回看位置）、`End`/点击“回到底部”。
- 修复全屏下 transcript 动画帧推进（转圈、计时）。
- 应用内复制：选中模式或 `/copy` 最近回复。
- 设置项 `nightglide.layout = glide | classic`，默认 glide；`--classic` 命令行开关；F2 保留。
- 测试：screen provider 进出、焦点归属、滚轮路由、resize 的单元测试。
- 提交：先把 fork 与主仓现有改动分批提交到分支（需你确认）。

**G2 场景精修** —— 已完成（2026-11-21），见下方“G2 结果”
- 飞行：云层分前后两层视差，金色光带更细更柔；潜水：光柱、水草摆动、气泡上升节奏。
- 思考强度联动：强度越高，场景层次/速度/亮点越多（只读真实生效值，未知时不加戏）。
- iTerm2/Ghostty 真彩截图，与 Terminal.app 256 色分别调参；`--motion none` 静态帧。

**G3 内容卡片（向概念图靠拢）**
- 用户消息卡（`> you` + 正文）、助手区标题行（`✦ Nightglide` + 强度条）。
- 工具 chip 行 `[✎ edit] [⚗ test] [⌕ search]`（来自真实工具调用）。
- Diff 卡片：文件名标题栏 + 行号 + 增删底色。
- 只换外观，不改 OMP 行为；审批框在全屏下的样式统一。

**G4 机器人与信息栏**
- 约 10×5 格的半块像素机器人：飞行/潜水两种造型 × 亮暗配色；空闲/思考/完成三种状态；空间不足时缩成单行图标。
- 信息栏：模型图标、强度分段彩条（已有雏形）、子智能体真实状态与当前工具、按需展开详情。
- 任务总结入口（是否调用模型、范围与费用先给你确认方案）。

**G5 四主题定稿**
- 定映射：flight / cloudlight / abyss / daybreak（aurora 作为额外主题保留）——需你确认。
- 亮暗分别调对比度；四主题 × 空会话/长对话/思考中/工具/审批/错误/无动效 截图矩阵。

**G6 稳定性与收尾**
- 长会话性能（缓存已完成块的渲染结果）、多次 resize、tmux 内运行、中文输入法候选框位置。
- 文档：更新 `CURRENT_STATE.md` 与产品规范中关于 inline/全屏的取舍。

## G1 结果（2026-11-20）

| 项 | 实现 | 验证 |
|---|---|---|
| 回看锚定 | 回看时记录视图顶部 3 行，每帧在 tail 中重新定位并修正滚动量；新输出不再把视图往前推 | 单测（去掉修复即失败）；Terminal.app：滚回后 4 秒内持续输出，视图顶部不动（`shots/g1-anchor-1/2`） |
| 回到底部 | `End`（仅回看时接管）、点击“↑ 回看中”标签、`Enter` | 单测；Terminal.app 点击与 End 均回到实时尾部（`g1-anchor-3-click-bottom`） |
| 动画帧 | `renderTail` 接受调用方的动画帧，Glide 每次绘制传入新帧 | 单测（去掉修复即失败）；Terminal.app 转圈字形逐帧变化（`g1-spinner-frame-a/b`） |
| 应用内复制 | 沿用 OMP `/copy`（选择器 / `code` / `cmd`），空状态提示加入 `/copy` | Terminal.app：`/copy` 在 Glide 上全屏打开，Esc 回到 Glide（`g1-copy-picker`） |
| 布局设置 | `nightglide.layout = classic \| glide`（现默认 glide，环境变量 `NIGHTGLIDE_LAYOUT`）；`--glide` / `--classic` 单次覆盖；F2 本次会话切换 | 参数单测；Terminal.app 以 `--glide` 启动（`g1-start`），F2 往返正常，`/exit` 退出码 0 |
| 测试 | `nightglide-shell.test.ts`、`nightglide-screen-provider.test.ts`（进出 alt-screen、不抢焦点、resize）、`cli-layout-flag.test.ts` | tui 4867 pass / 1 fail（既有 run-watch 抖动，单独运行通过） |

## 需要你决定

1. ~~是否把 Glide 设为默认界面~~ —— 已定：Glide 为默认（2026-11-20），经典模式用 `--classic` 或设置切换。
2. 四主题映射是否按上面的方案。
3. 是否现在把 fork 与主仓的现有改动分批提交到分支。
4. 启动 oMLX 后我再用本地模型补测流式和工具调用。

## G2 结果（2026-11-21）

fork 基于 `23258c3ffb`（未提交），改动在 `nightglide-pixel-scene.ts`、`nightglide-shell.ts`、`effort-ladder.ts`（导出 `effortRung`）。

| 项 | 实现 | 验证 |
|---|---|---|
| 飞行视差 | 近层云快、远层云慢（速度比约 3:1）且只用淡色；越靠近对话区越稀 | 渲染预览；Terminal.app 两帧相隔 1.2 秒，约移 4 列（`shots/g2/flight-high-a/b`） |
| 金色光带 | 改为 1 像素细线，大部分是与底色的柔和混色，只有短促亮点 | 渲染预览；Terminal.app |
| 潜水 | 水面斜光柱随深度变淡；水草间距和高度随机、叶尖摆动大于根部，少数带珊瑚色叶尖；气泡各列速度不同并左右轻摆；缓慢下沉的微粒 | 渲染预览；Terminal.app（`abyss-high-a`、`daybreak-high-a`） |
| 思考强度联动 | 只读会话实际生效的强度（`effortRung`：minimal→xhigh，max 同 xhigh）；off、未知、未解析的 auto 一律为 0，不加效果。强度越高：场景时钟越快（1×→1.8×，改强度不跳帧）、近层云更密、星点和气泡更多、光带更连续、光柱更亮 | 单测（各场景强度 1 比 0 点亮更多像素；未知级别为 0）；Terminal.app `flight-off-a` 对比 `flight-xhigh-a` |
| 256 色调参 | 混色在 256 色下会被量化成灰／褐，故四套主题各加 `scene256`，用 `blends` 指定光带、光柱、远层云、微粒的实际网格色 | 渲染预览（`shots/g2-preview/*-256color*.png`）；Terminal.app |
| 真彩 | 沿用原调色板 | **仅渲染预览**（`*-truecolor*.png`），无真彩终端真机截图 |
| 无动效 | `--motion none` 时场景时钟固定为 0，强度仍体现为密度（静态） | 单测（时钟不同、画面相同）；Terminal.app 两帧肉眼一致（`abyss-motion-none-a/b`） |
| 尺寸 | 沿用 G1 的收缩顺序 | Terminal.app 100×30 场景缩为 3+2 行（`flight-100x30-a`），80×24 场景收起、输入和对话完整（`abyss-80x24-a`） |

测试：新增 `test/nightglide-pixel-scene.test.ts`（静帧与运动、强度单调、行宽、无动效）；tui 全量 4869 pass / 1 fail（既有 run-watch 抖动）；`bun run check`（oxlint、oxfmt、类型）通过。

工具：`scripts/glide-spike/scene-png.ts` 把真实 Glide 外框按真彩／256 色渲染成 PNG（每套主题一张整窗图和一张放大的场景带图，行为强度、列为时钟）；`scripts/glide-spike/g2-shot.sh` 在 Terminal.app 用隔离配置目录截图（只写主题和默认模型角色，不复制凭据，不发送消息）。替换了上一轮留下的 HTML 预览：它用 `setThemeInstance` 时主题名会变成 `<in-memory>`，所以一直只画出 Flight，页面也大到浏览器打不开。

环境：macOS 15（Darwin 24.6），Terminal.app 256 色，140×40／100×30／80×24，Bun 1.4.4。

遗留：
- ~~无模型时强度栏仍显示配置值~~：已在侧栏改版中修复（见下）。
- 亮色潜水（Daybreak）的光柱在白底上表现为浅灰斜带，像阴影而不是光；留到 G5 亮色对比度定稿。
- 真彩终端真机截图、录屏（持续动效与输入不中断）未做；Abyss／Cloudlight／Daybreak 的整窗配色仍是写死的（G5）。

## 侧栏改版（2026-11-21，G2 之后，用户提出）

- **样式**：侧栏顶边带“会话”标签；四个分区（模型／思考强度／子智能体／状态）各有图标和延伸到边缘的标题线，内容缩进两格；空间够时分区之间空一行，不够时自动去掉空行。子智能体显示“运行中/总数”，状态用 ●／✓／✕ 区分。
- **模型信息只显示一处**：侧栏显示时，底部状态栏不再显示模型段；窗口窄于 100 列侧栏收起时，模型段自动回到状态栏。实现为状态栏新增 `setHostedElsewhere()`，由 Glide 在侧栏出现／消失时调用，退出 Glide 时恢复。
- **原来只在状态栏模型段里的信息搬进侧栏**：提供商、重试回退（`↩ 回退 …`）、快速模式（⚡）、advisor 状态（◉，颜色表示正常／额度用尽或错误／暂停）、Anthropic 用量阶段提示。
- **强度改读实际生效值**：侧栏与场景改用状态栏同一个 `thinkingLevelWord`，模型不支持思考或未选模型时显示“此模型不支持”／“—”，不再显示 `--thinking` 的配置值，场景也不再按它加效果。
- 检查时发现：状态栏底部这一路的上下文总带时间戳，`publishAmbientEffort` 在这条路径上本来就不发布强度（上游既有行为），所以隐藏模型段不改变对话区思考动画的取色。

验证：单测 `status-line-hosted.test.ts`（隐藏与恢复）、`nightglide-shell.test.ts`（宽窄切换时上报侧栏可见性、无模型提示）；tui／coding-agent 类型检查通过；Terminal.app 140×40 底部状态栏无模型段、90×30 侧栏收起后模型段回到底部（`shots/g2/sidebar-flight-a`、`sidebar-narrow-90-a`、`sidebar-abyss-a`）。有真实模型、回退、子智能体时的侧栏只用模拟数据检查过排版，未在真实会话中截图（隔离目录无凭据）。

## 本地模型实测、代理修复与 `/theme`（2026-11-22）

**本地模型（oMLX `omlx/endless`，Terminal.app 140×40，用户真实配置）**
- 直接请求 oMLX：回复里带 `reasoning_content`（381 个输出 token 里有 375 个是推理），答案正确。
- 在 Nightglide 中：推理过程以斜体显示，答案正确（`391`、`144`），后续的 "hi"、"你好" 也正常回复（`shots/live/omlx-04`、`launcher-06`）。
- 强度：`endless` 是通过模型列表自动发现的，没有可调思考强度（`model.thinking` 为空），所以侧栏显示“此模型不支持”，场景不按强度加效果。此前在 auto 配置下侧栏会一直停在“auto · 本轮确定后显示”，已修复：只有支持思考控制的模型才显示 auto 待定。**按强度变化的动画仍需要一个支持可调强度的模型来实测**。
- 工具调用未测。

**根因：shell 代理拦截了本机请求**
- 用户的 shell 设置了 `HTTP(S)_PROXY`/`ALL_PROXY=127.0.0.1:17891`，`NO_PROXY` 为空。Bun 的 `fetch` 会读取这些变量，于是发往 `127.0.0.1` 的请求（oMLX、Ollama、LM Studio 的模型发现与对话）都经过了代理。代理连不到本机服务，表现为启动时模型发现超时、发消息后一直显示 “Working…”。用 curl 经同一代理请求 oMLX 同样超时；加上 `--noproxy` 则 0.02 秒返回。
- 修复：`./nightglide` 启动时把 `127.0.0.1,localhost,::1` 追加进 `NO_PROXY`/`no_proxy`，保留用户已有条目。修复后本机服务不再超时（没启动的服务立即返回连接被拒绝），按平时方式启动可以正常对话。
- 顺带：同一原因下，原版启动器的 `--smoke-test` 要 64 秒并以失败退出，修复后 3–6 秒成功；启动器测试中该用例的时限放宽到 20 秒（冷启动超过 bun 默认的 5 秒）。

**`/theme` 命令（fork 新增 `slash-commands/builtin-theme.ts`）**
- `/theme <名称>`：接受全名或 Nightglide 短名（`flight`、`cloudlight`、`abyss`、`daybreak`、`aurora`，可用 Tab 补全），也接受用户自定义主题的全名。写入当前终端背景对应的槽位（`theme.dark` 或 `theme.light`），与在 `/settings` 里修改的保存方式相同，并立即生效。
- `/theme`（不带参数）：列出可用主题并标出当前主题。
- 未知名称给出可用列表，并以失败状态结束（print 模式下退出码非 0）。
- 验证：单测（名称解析）；Terminal.app 隔离配置下 `/theme abyss` 从 Cloudlight 立即切换为 Abyss，配置文件写入 `theme.light: nightglide-abyss`（`shots/live/theme-02`）。

另：用户真实配置里的 `theme.dark: titanium` 是不存在的主题，日志显示会回退；Terminal.app 是亮色背景所以平时用的是 `theme.light`，不受影响。
