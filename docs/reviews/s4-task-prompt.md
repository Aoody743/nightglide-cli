# 任务：Nightglide S4 — 图形化设置页

你在 `/Users/aoody743/Documents/Nightglide CLI` 工作。这是 Nightglide CLI：一个基于 OMP（oh-my-pi）fork 的终端编程助手。你的任务是开发计划里的 **S4 图形化设置页**。完成后会有另一位审查者逐项检查代码、测试和截图，所以请如实记录做了什么、没做什么、哪里和计划不一样。

## 一、先读这些（按顺序）

1. `docs/DEVELOPMENT_PLAN.md` 的“设置与命令重做（S1–S5）”整节，尤其是 **S4** 的要求，以及 S1–S3 的“完成记录”。
2. `docs/PRODUCT_DIRECTION.md`、`docs/IMPLEMENTATION_RULES.md`：产品原则。要点：功能行为沿用 OMP，只改默认值、文字和入口；**只隐藏、不删除**；配置路径和保存方式不变。
3. `vendor/omp/AGENTS.md`：fork 的代码规范（必须遵守，见下文“代码规范”）。
4. 现有实现：
   - `vendor/omp/packages/tui/src/i18n.ts`：中英文本表，`t(key, values)`、`getLanguage()`、`setLanguage()`、`onLanguageChange()`。**所有 Nightglide 新增的界面文字都必须放进这张表，中英两版都要有。**
   - `vendor/omp/packages/tui/src/overlays/settings-common.ts`：现在的“常用”页（S1 初版）。它列出了常用设置的路径、中英标签和取值标签，新页面可以复用这份清单和文字。
   - `vendor/omp/packages/tui/src/overlays/settings-defs.ts`：标签页定义，以及 `SettingsHost`（`get` / `set` / `unset` / `entries`）。
   - `vendor/omp/packages/tui/src/overlays/settings-selector.ts`：OMP 原有的标签页设置（约 2000 行）。要看懂它如何处理按键、SGR 鼠标（`#handleMouse`）、主题预览（`onThemePreview`）和关闭（`onCancel`），以及 S1 加的语言切换后重绘（`#relabel`）。
   - `vendor/omp/packages/coding-agent/src/modes/controllers/selector-controller.ts` 中的 `showSettingsSelector()`（约 329–426 行）：`/settings` 在这里打开，全屏 overlay 通过 `#showFullscreenMenu` 挂载；全屏 overlay 会开启鼠标跟踪。
   - `vendor/omp/packages/tui/src/components/nightglide-shell.ts` 和 `nightglide-pixel-scene.ts`：Glide 界面和像素场景渲染（`renderPixelScene`），可用于主题卡片的小预览。
   - `vendor/omp/packages/coding-agent/src/config/nightglide-menu.ts`、`nightglide-routing.ts`：Nightglide 自己注册的设置。
   - `scripts/glide-spike/lang-shot.sh`、`menu-shot.sh`、`more-shot.sh`：在 Terminal.app 中用独立配置目录实测并截图的脚本，照着写新的截图脚本。

## 二、要做什么

`/settings` 改为打开一个 **Glide 风格的全屏图形化设置页**（新组件，建议放在 `packages/tui/src/overlays/nightglide-settings.ts`），取代当前标签页设置里的“常用”标签。OMP 原有的标签页设置保留，作为“高级设置”。

### 1. 布局
- **宽屏（≥ 100 列）**：左侧分类栏，右侧是当前分类的控件，底部一行按键提示（双语）。
- **窄屏（< 100 列）**：改为单栏，先选分类，Enter 进入分类页，Esc 返回分类列表。
- 必须在 80×24 下完整可用（可以滚动，但不能截断控件或让光标所在行跑出屏幕）。
- 分类：**外观、模型、审批、通知、会话、语言、高级设置**。“高级设置”是一个入口，不是页面。

### 2. 每个分类的内容（设置路径必须用现有的，不要新增或改名）
- **外观**：主题（`theme.dark` / `theme.light`，用**主题卡片**展示，见下）、动效 `tui.motion`（分段选择：完整｜减弱｜关闭）、图标字符 `symbolPreset`（分段选择）、输入框样式 `composer.shape`。
- **模型**：顶部是只读的“当前模型 + 实际生效的思考强度”卡片；下面依次是：思考强度 `defaultThinkingLevel`（**等级条**，只列当前模型支持的档位，取 `availableThinkingLevels`）、路由模式 `nightglide.routingMode`（分段选择）、本地模型 `nightglide.localModel`、隐藏思考内容 `hideThinkingBlock`（开关）。最后放三个**入口按钮**：登录（打开 `/login`）、自定义提供商（打开 `/provider`）、切换模型（打开 `/model`）。按下入口按钮时，先关闭设置页再执行命令。命令怎么从这里触发，请在 `selector-controller.ts` / `InteractiveModeContext` 里找现成的方式（比如 controller 已有的 `showOAuthSelector`、`showModelSelector`，以及 `builtin-nightglide.ts` 的 `manageCustomProviders`），不要伪造输入框按键。
- **审批**：`tools.approvalMode` 用**三张说明卡片**表示，分别是全部询问 / 高风险询问 / 自动执行（取值 `always-ask` / `write` / `yolo`）。每张卡片写明哪些操作会询问、哪些会直接执行（文字可参考 `settings-common.ts` 和 `docs/reviews/p3.3-approval-policy.md`）。如果当前值是其他模式（比如 `always-ask-cached`），要如实显示“其他模式（在高级设置中）”，不要强行改成三档之一。
- **通知**：`completion.notify`、`ask.notify`、`error.notify`，都用开关。注意它们的取值是 `"on"` / `"off"` 字符串，不是布尔值；先确认每个设置的实际类型再写。
- **会话**：从下面挑 3–5 个最常用、对普通用户有意义的设置，并在完成报告里说明你挑了哪些、为什么。候选：`autoResume`、`compaction.enabled`、`compaction.thresholdPercent`、`display.showTokenUsage`、`display.showTurnTime`、`retry.enabled`。只能用已经注册的设置，先在 `packages/coding-agent/src/**/settings.ts` 里确认每个设置的 id、类型和默认值。
- **语言**：`nightglide.language`（中文 / English / 跟随系统）。改了立即生效，整个设置页马上换语言（参考 S1 的 `#relabel`）。
- **高级设置**：打开 OMP 原有的标签页设置（`SettingsSelectorComponent`），并**去掉“常用”标签**（`SETTING_TABS` 里的 `"common"` 和相关代码要清理干净，不要留下死代码；也可以整个删掉 `settings-common.ts`，前提是它的清单和文字已经搬到新页面）。从高级设置按 Esc 回到图形化设置页，而不是直接关掉。

### 3. 控件
- **开关**：`● 开` / `○ 关`（ASCII 符号集下改用 `[x]` / `[ ]`）。
- **分段选择**：`[ 完整 │ 减弱 │ 关闭 ]`，当前值高亮；←→ 切换。
- **等级条**：思考强度，例如 `▰▰▰▱▱ 高`；←→ 调整。可以参考 `nightglide-shell.ts` 侧栏里的强度条画法和 `chat/effort-ladder.ts`。
- **说明卡片**：审批三档，用带边框的卡片，当前选中的卡片高亮。
- **主题卡片**：每个 Nightglide 主题一张（`availableThemes` 里的 nightglide-flight / cloudlight / abyss / daybreak / aurora，用户自定义主题也要列出）。卡片上有主题名、几块主题配色色块，空间够时加一个场景小预览（`renderPixelScene`，几行高即可）。暗色和亮色主题分开选，对应 `theme.dark` / `theme.light`。
- **键盘**：↑↓ 移动选项，←→ 改值，Enter 确认或打开，Esc 返回或关闭，Tab 在分类栏和内容区之间切换。
- **鼠标**：点击分类、开关、分段选项、卡片和入口按钮都能操作；滚轮可以滚动内容。照 `settings-selector.ts` 的 `#handleMouse` 处理 SGR 鼠标上报，并记录上一帧的几何位置用来判断点到了哪里。
- **改即保存**：和 OMP 一致，值一改就写入 `SettingsHost.set` 并调用 `onChange`；Esc 不撤销已保存的值。主题和动效改了要立刻在后面的界面上看到效果（主题沿用 `onThemePreview` 和现有的主题提交逻辑，先读懂 `settings-selector.ts` 里主题是怎么处理的）。
- **颜色**：全部取自当前主题（`theme.fg(...)` / 主题色槽），不能写死颜色。256 色终端和 `NO_COLOR` 下要有可读的降级样式；ASCII 符号集下所有控件都改用 ASCII 字符。

### 4. 高级设置中隐藏已失效的设置
- `nightglide.layout` 已经没有 `ui`（本来就不显示），不用处理。
- 品牌化时已经关闭了上游的更新检查和更新日志。请检查 `startup.checkUpdate`、`update.channel`、`update.auto`、`startup.changelogMode` 在 Nightglide 里是否确实不再起作用（读代码确认，不要猜）。**确认失效**的设置，在高级设置里隐藏。做法：在 tui 的设置定义处加一份 Nightglide 隐藏清单（只影响显示，不改注册），不要删除注册、不要去掉上游的 `ui` 定义。没有确认失效的保持原样，并在报告里说明。

## 三、代码规范（来自 `vendor/omp/AGENTS.md` 和本项目惯例）
- 不用 `any`、不用 `ReturnType<>`、不用 inline import（`await import()`、`import("x").T`）。私有成员用 ES `#private`，不写 `private` / `public` 关键字。
- 不在 TUI 运行路径里用 `console.log`；要记录日志用 `logger`。
- 显示的文字要处理好：用 `truncateToWidth`、`visibleWidth`（`packages/tui/src/utils`），中文按双宽字符计算宽度。
- 新加的源码文件开头写一段注释，说明它是 Nightglide 的什么、为什么这样做。修改上游文件时，在改动处加 `// Nightglide:` 注释说明原因，尽量少动上游代码。
- 测试只测外部可观察的行为（见 AGENTS.md 的 Testing Guidance）：不要 grep 源码，不要写“能跑就行”的测试，不要用 `mock.module()`。
- **格式化**：fork 的 `.oxfmtrc.json` 把 `**/vendor/**` 整个排除了，所以在 `vendor/omp` 里直接跑 `oxfmt` 什么都不会格式化。请把改动的文件复制到一个临时目录（连同 `.oxfmtrc.json`），在那里跑 `bun x oxfmt <files>`，再复制回来；然后跑 `bun x oxlint <files>`。注意：macOS 自带的 bash 3 没有 `mapfile`；在 zsh 里 `$F` 不会按空格拆成多个参数，需要用 `bash -c` 或 `${=F}`。
- 类型检查：在 `packages/tui` 和 `packages/coding-agent` 各跑一次 `bun run check:types`，都必须 0 错误。

## 四、测试
- 新增测试（建议 `packages/tui/test/nightglide-settings.test.ts`），至少覆盖：
  - 每个控件读写的都是正确的设置路径，取值类型正确（布尔值、`"on"` / `"off"` 字符串、枚举）。
  - ←→ 改值后立即调用 `SettingsHost.set` 和 `onChange`。
  - 宽屏和窄屏的布局切换（比如 120 列有分类栏，80 列是单栏）；80×24 下光标所在行始终可见。
  - 语言切换后页面文字立即换成另一种语言。
  - 审批模式是三档以外的值时，显示“其他模式”，而且没有被改写。
  - 高级设置里不再有“常用”标签，确认失效的设置也不再显示。
  - ASCII 符号集下没有 Unicode 控件字符。
- 现有测试：先在**改动前**跑一遍 tui 全量测试（`cd packages/tui && bun test`），以及 coding-agent 里和设置、斜杠命令相关的测试，记下哪些本来就失败（目前已知：tui 有 1 个 `GitHub run-watch renderer` 失败；coding-agent 有 `prompt-template autocomplete` 和 `OAuthSelectorComponent fuzzy-filters` 失败，都是改动前就有的）。改完再跑一遍，逐条对比，只允许出现改动前就有的失败。
  - **不要**在后台命令里用 `git stash` 做对比：如果命令中途被打断，stash 会留在那里，改动就“不见了”。如果要和改动前对比，就在开始写代码之前先跑一遍并保存结果。
  - 上游测试如果是因为界面语言变成中文而失败（它们检查的是英文文字），在那个测试文件里加 `beforeAll(() => setLanguage("en"))` / `afterAll(() => setLanguage("zh"))`，并写注释说明原因；不要改测试想验证的行为。如果上游测试检查的是被你有意改掉的行为（比如“常用”标签），改测试的期望值，并在报告里逐条列出。
- 不要为了让测试通过而改上游的业务逻辑。

## 五、真实终端实测（必须做）
- 写 `scripts/glide-spike/settings-shot.sh`，照 `lang-shot.sh` 的方式：用**独立的** `PI_CODING_AGENT_DIR`，配置里写 `setupVersion: 3` 来跳过首次启动向导。**不能读写用户自己的 `~/.omp`。**
- 在 Terminal.app 中截图，保存到 `scripts/glide-spike/shots/s4/`：
  - 120×36（或 140×40）和 80×24 两种尺寸，中文和英文各一套；
  - 每个分类页各一张；主题卡片；审批卡片；模型页的入口按钮；
  - 改动效或切主题后，后面界面立刻变化的效果；
  - 在设置页把语言切成 English 后立即换语言；
  - 进入高级设置（看不到“常用”标签）再按 Esc 回到图形化设置页；
  - 至少一次鼠标点击操作（可以用 relay 的 FIFO 发送 SGR 鼠标序列，例如 `\e[<0;列;行M` 加 `\e[<0;列;行m`）。
- 截图后**自己逐张查看**，有问题就修，再重新截图。
- 如果条件允许（比如装了 Ghostty），再在真彩终端补几张。没条件就在报告里写明。

## 六、文档与提交
- 更新 `docs/DEVELOPMENT_PLAN.md`：S4 标题加删除线并写上完成日期，后面加“完成记录”（照 S1–S3 的格式）、“与计划的出入”和“仍是英文 / 未做”。
- 更新 `docs/CURRENT_STATE.md` 的“菜单与设置”一节和“下一步”。
- 提交：先在 `vendor/omp` 里提交（分支 `codex/nightglide`，提交信息用 conventional 格式，比如 `feat(settings): ...`），再在根仓库提交 submodule 指针、文档、脚本和截图。两边的提交信息最后都加一行 `Co-Authored-By: <你的模型名> <noreply@...>`。**不要推送，不要开 PR。**
- 不要提交 `.claude/` 目录。

## 七、完成报告（最后输出，写给审查者）
请按下面的结构写：
1. 做了什么：每个分类里放了哪些设置、用了什么控件；“会话”分类挑了哪些设置、为什么。
2. 改了哪些文件（fork 和根仓库分开列），各改了什么。
3. 测试：新增了哪些测试；改动前后的失败对比（逐条列出）；改了哪些上游测试、为什么。
4. 实测：截图清单，每张对应什么；哪些情况没有实测。
5. 与计划的出入，以及仍未完成的部分（比如仍是英文的文字、没做的鼠标操作）。
6. 两个提交的哈希。

不要说“全部完成”“完美”之类笼统的话；没验证过的就写“未验证”。
