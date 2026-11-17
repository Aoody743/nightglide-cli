# Stage 4 · M2 资产迁移评估与可复现安装准备 (STAGE 4 ASSET ASSESSMENT)

> **"Build beyond the horizon." / "漫翔苍穹，构筑所想。"**

评估对象：`feat_m2_coding_experience` 分支（基线 `3630414` 之上 5 个提交，worktree 已于 2026-11-18 移除）上标记为高/中价值的 M2 资产；对照新主线 `vendor/omp`（子模块，夜游 fork，HEAD `8e768d41c7`，版本 18.20.2）。全程只读分支（`git show feat_m2_coding_experience:<path>`），未 checkout、未删改任何文件。配套交付：`scripts/install.sh`（已验证）、`docs/INSTALL.md`（新建）、`docs/DEVELOPMENT.md`（加历史声明）。

**一句话总结：** 四组高/中价值资产在新主线均已有等价或更强的原生实现，全部**有据不迁**；唯一确认的缺口在**测试面**——旧 routing 测试矩阵中有 5 个 role-based 语义场景未被新 `nightglide-routing.test.ts` 覆盖，建议补测（另附勘误：M2 盘点对 diffParser 的「CJK 宽度感知」描述不属实，宽度感知实际位于 motion/slots.ts，而新主线的宽度处理是 UAX#11 原生实现，远强于原型）。

---

## 1 · diffParser（apps/cli/src/ui/components/diff/diffParser.ts，324 行）

### 1.1 资产实况（branch 实读，非盘点转述）

- `parseUnifiedDiff()`（diffParser.ts:186 起）：解析标准 unified diff 文本（`@@ -a,b +c,d @@` hunk 头正则 :28、行分类 add/delete/context/hunk_header/header/comment、旧行号新行号 gutter、增删统计）；`parseFileDiff()` 支持 `FileDiffData` 对象或原始字符串双入口。
- **勘误——「CJK 宽度感知的截断/换行」不属实：** `truncateLine`（diffParser.ts:75）与 `wrapLine`（diffParser.ts:85）均按 `text.length`（UTF-16 code unit 数）切片，对双宽 CJK 字符不感知，宽字符行仍会水平溢出。盘点文档（M2_WORKTREE_INVENTORY.md 第 2 节）将 slots.ts 的宽度能力误记到了 diffParser 名下；真正的宽度感知在 `apps/cli/src/ui/motion/slots.ts`（`getCharWidth`/`getStringWidth`/`reserveSlot`，手写宽区段表）。配套 `tests/ui/diff.test.ts`（498 行）覆盖解析边界，但其断言同样建立在 `length` 语义上。

### 1.2 新主线等价物（vendor/omp）

| 能力 | vendor/omp 实现 | file:line |
| :--- | :--- | :--- |
| diff 行分类 + 增删统计 | `getDiffStats`（加/删/hunk 计数） | `packages/tui/src/render/render-utils.ts:694` |
| 增删摘要渲染 | `formatDiffStats`（主题化 `+a / -r / n hunks`） | `packages/tui/src/render/render-utils.ts:721` |
| hunk 边界截断/预算 | `truncateDiffByHunk`（头/尾模式，隐藏计数） | `packages/tui/src/render/render-utils.ts:760` |
| diff 全量渲染（行号 gutter、词级行内 diff、缩进可视化、语法高亮） | `renderDiff` + `nativeDiff`（终端原生的 `diff` TSP 节点，gutter/词强调/hunk 间距由终端侧绘制） | `packages/tui/src/chrome/diff.ts:177` / `:121` |
| git 级 diff 工作台（split/inline/hunk/file 四视图、hunk 级 stage/unstage/discard 补丁、`@@` 头解析、行对齐与 gutter 宽度） | `buildDiffDocument` / `HunkBlock`（git TUI app） | `packages/tui/src/apps/git/diff-pane.ts:193` / `:51` |
| 原始 unified git diff 文本 → 文件级结构（文件名、增删计数、binary/renamed 状态） | `parsePromptDiff` | `packages/coding-agent/src/commit/conventional/diff.ts:191` |
| **真·宽度感知截断/换行**（UAX#11 East Asian width，Rust 原生） | `truncate_to_width`（含 ellipsis 策略）、`wrapTextWithAnsi`、`visible_width_u16`，基于 `unicode-width` crate | `crates/pi-natives/src/text.rs:9/:33/:978` |
| TS 侧宽度（Bun.stringWidth + OSC66/APC/Hangul Jamo 修正，带缓存） | `visibleWidth` | `packages/tui/src/utils.ts:352` |
| 宽度绑定的组件级重排 | `WidthAwareText`（按实际渲染宽度重跑 formatter） | `packages/tui/src/render/width-aware-text.ts` |

### 1.3 结论：**有据不迁**

- 新主线 diff 能力是原型的严格超集：渲染走原生 TSP 节点 + ANSI 双通道，宽度处理下沉到 Rust `unicode-width`（比 slots.ts 的手写表更正确，还覆盖 grapheme、ANSI/OSC 剥离、tab 展开）。
- 迁移会产生无消费者代码：原消费者 `DiffViewer.tsx`/`NativeDiffView.tsx` 属退役的 OpenTUI React 架构，新主线无对应挂载点。
- 记录在案的差距（非当下缺口）：新主线没有一个「把任意 unified diff **文本**（含 `@@` 头与行号）解析为 hunk/行号结构」的通用入口——`parsePromptDiff` 只到文件级、`diff-pane.ts` 从新旧文本构造而非解析文本。若后续 Stage 出现「渲染外部 git diff 文本」的真实消费者，应参照 `diff-pane.ts` 的 `walkHunk` 模式新写，而不是搬 diffParser（其行号推算未处理 `\ No newline` 与 hunk 头 count 缺省为 1 的歧义，测试亦未覆盖多文件 diff）。**现无消费者，不动。**

---

## 2 · Celestial Kinetics 动效预算（apps/cli/src/ui/motion/）

### 2.1 资产实况（branch）

- `constants.ts`：帧率预算 `FPS_AMBIENT=10` / `FPS_MICRO=15` / `INTERVAL_AMBIENT=100` / `INTERVAL_MICRO=66`；T0–T3 时序分层（`TIMING_TIERS` INSTANT=0 / MICRO=100 / TRANSITION=150 / AMBIENT=1000）；6 帧 Celestial Pulse spinner、reduced-motion 静态回退 `✦`、各 ANIM-* 常量。
- `slots.ts`：防抖固定 slot（`stripAnsi`、`getCharWidth`/`getStringWidth`、`reserveSlot`/`createFixedSlotFormatter`——保证动态元素每帧严格等宽）。
- `reducedMotion.ts` / `engine.ts` / `hooks.ts`：零计时器降级与 React hooks 绑定（@opentui 专用）。

### 2.2 新主线等价物（vendor/omp）

| 原型能力 | vendor/omp 实现 | file:line |
| :--- | :--- | :--- |
| 全局帧率上限（预算纪律） | `tui.maxFps` 渲染调度器天花板：`DEFAULT_MAX_FPS=30`，可配 1–120（CLI flag / env / setting 三入口），`minFrameIntervalMs()` 生效于调度器 | `packages/tui/src/frame-rate.ts:8/:20` |
| spinner 统一时钟（防抖） | `tui.spinnerInterval`：全 TUI 所有 spinner 共享一个周期与相位（默认 80ms ≈ 12.5 FPS，最小 50ms，`SPINNER_INTERVAL_STATIC=0` 全静止）——同一机制天然防止多动画错拍抖动 | `packages/tui/src/spinner-clock.ts:8/:10` |
| 装饰性动效总开关（≈ reduced-motion） | `motionEffectsEnabled` / `setMotionEffects`：status-line 闪烁/品牌淡出/编辑器魔法词扫光等统一由宿主 `tui.motion` preset 驱动 | `packages/tui/src/motion-effects.ts:10/:15` |
| spinner 帧序列 | 主题驱动：`theme.getSpinnerFrames("activity")`，由共享时钟取帧 | `packages/tui/src/theme/theme-class.ts:841`、`packages/tui/src/status-line/segments.ts:250` |
| 开场动画（对标 Horizon Reveal） | splash 场景：确定性星场（`renderStarfield`，帧哈希取星）+ 水波纹扩散，随 `tui.motion` 关停 | `packages/tui/src/setup/scenes/splash.ts:34/:42` |
| 等宽 slot / 宽度防抖 | `visibleWidth` + 原生 `truncate_to_width`（UAX#11）覆盖 slots.ts 全部能力且更严谨 | `packages/tui/src/utils.ts:352`、`crates/pi-natives/src/text.rs` |
| 状态栏帧对齐（避免无效重绘） | status-line ticker 周期对齐 spinner 帧的整数倍，静帧不动画 | `packages/tui/src/status-line/component.ts:1484-1502` |

### 2.3 结论：**有据不迁**

- OMP 已有等价的预算/防抖机制，且形态不同：原型是「写死的 10/15 FPS 常量 + 自研引擎」，OMP 是「可配置的全局调度器天花板 + 共享 spinner 时钟 + 动效总开关」。若 Nightglide 要落实 10/15 FPS 纪律，正确动作是把 `tui.maxFps`/`tui.spinnerInterval` 的 Nightglide 默认值写进主题/配置层（一次性配置项，非代码迁移）。
- T0–T3 时序分层是旧 React hooks 体系的规范常量，OMP 无此分层也无消费者；迁移即死代码。设计思想已在 `docs/MOTION_SYSTEM.md`（历史声明已加）留档。
- slots.ts 的手写宽度表不要搬：`utils.ts:352` 的 UAX#11 实现是唯一可信宽度源，混入第二套宽度语义反而破坏一致性。

---

## 3 · vendors.ts / dimensions.ts / auth.ts（逐项）

### 3.1 厂商签名与动效帧数据（apps/cli/src/ui/motion/vendors.ts，244 行）→ **有据不迁（留分支待消费者）**

- 资产：anthropic/openai/google/xai/omp/local 六家的品牌色、miniGlyph、8 帧动画序列、ASCII logo，纯数据无渲染依赖。
- 新主线：主题体系为 JSON 驱动（`packages/tui/src/theme/nightglide-{abyss,aurora,cloudlight,daybreak,flight}.json` 共 5 套 + `theme-schema.json`），spinner 帧从主题取（theme-class.ts:841）；status-line 以 model 名与 `tui.motion` 品牌淡出呈现，**没有** per-vendor 动画签名系统，也**没有**任何消费它的挂载点（官方 dev 环境是 omp，Nightglide 身份靠 `OMP_APP_NAME`/`PI_RAW_BIN` 注入）。
- 判断：现在搬入 = 无消费者的死数据。数据不会过期（纯品牌常量），留在分支上（分支引用已保留、已推送远端备份），待 Stage 5+ 若立项「厂商签名状态条/启动画面」再取，届时还应改造成 OMP 主题 JSON/glyph-bundle 形态而非 TS 常量。

### 3.2 终端尺寸分级（apps/cli/src/ui/dimensions.ts）→ **有据不迁**

- 资产：small(80×24)/medium(100×30)/large(120×36+) 三档 `getTerminalTier`、`isCompactWidth`(<100)/`isUltraCompact`(<85) 阈值、`computeViewportCapacity`（消息时间线高度预算）、`useResponsiveTerminalDimensions` hook（绑定 `@opentui/react`）。
- 新主线：渲染模型不同——OMP 是原生布局引擎（TSP 节点 + 终端侧排版），组件按实际渲染宽度自适应（`WidthAwareText`，width-aware-text.ts），长行截断/换行由原生 `truncate_to_width`/`wrapTextWithAnsi` 按真实列宽执行，不存在需要人工分档的 React box 布局；status-line 以**用户可配 preset**（`compact`/`full` 等，`packages/tui/src/status-line/presets.ts:26` 起）控制密度，而非自动三档。
- 判断：三档分级服务的是旧 `ChatScreen`/`Header`/`StatusBar` 的视口预算，新主线无对应布局层。迁移即无消费者。`computeViewportCapacity` 的「紧凑终端少显示消息」思想由 OMP 原生滚动/commit 机制天然覆盖。

### 3.3 OMP 原生认证封装（packages/providers/src/auth.ts，306 行）→ **有据不迁（其原则已在新主线落地）**

- 资产：包装 OMP 自身 `AuthStorage` / `discoverAuthStorage` / `SqliteAuthCredentialStore` / `isAuthenticated`，外加 `normalizeSubscriptionProviderId`、`STANDARD_ENV_KEYS`、`openBrowserUrl`、`login.ts` 命令。
- 新主线（这些 API 本体就在 vendored 源码里，Nightglide 定制直接落在其上）：
  - `AuthStorage`：`packages/coding-agent/src/extensibility/legacy-pi-coding-agent-shim.ts:1491`
  - `discoverAuthStorage`（含 auth-broker 不可达的 actionable 报错）：`packages/coding-agent/src/session/auth-broker-config.ts:256`
  - `SqliteAuthCredentialStore`：`packages/ai/src/auth/sqlite-credential-store.ts:401`
  - `isAuthenticated`：`packages/coding-agent/src/config/model-provider-discovery.ts:51`
  - provider 的 `apiKeyEnv` 映射由上游 provider 配置/catalog 承担；登录流为 OMP 原生 `omp auth` 族命令；配置解析统一走 `resolveConfigValue`（auth-broker-config.ts）。
- 判断：M2 封装的历史意义是「不另建第二套凭据体系」，而新主线里 Nightglide 定制**本身就住在 vendor/omp 内**（如 `nightglide-routing.ts` 直接 import `./model-resolver`），包装层在结构上已多余；再迁一层 `packages/providers/src/auth.ts` 只会复活旧原型的工作区分层，与「不重建冗余层」原则相悖。

---

## 4 · 旧 tests/routing 场景矩阵 vs 新 nightglide-routing.test.ts

基线对比：旧 `tests/routing/routing.test.ts` **28 用例**（Classifier 8 + Router 20，针对 `@nightglide/routing` 运行时逐任务路由）；新 `vendor/omp/packages/coding-agent/test/nightglide-routing.test.ts` **23 用例**（针对启动期 role 绑定：`applyNightglideRouting` 写 `settings.overrideModelRoles` + `installRetryFallbackRole`，`manual` 模式零动作）。

**架构前提（影响「哪些旧场景仍适用」）：** 新主线没有 per-task classifier——旧 8 个分类用例（含中英混合分类）连同 `classifyTask` 一起退役，**不再适用**；旧的 `allowCloud` 布尔授权边界在新架构中由「LOCAL 模式构造上不产生云端 selector」+ per-call 校验（`invalidModelSelectorReason`，新测试 370-421 行）接管。新测试已覆盖：resolveLocalModel 排序/显式 selector/未命中原因、manual 无动作、LOCAL 全角色绑定+纯本地链、kind/vision 角色豁免、@task/@smol 别名传播、无本地模型启动报错、冷缓存一次刷新、CLI --model pin、balanced 强角色保留+本地链前置+降级、performance 小角色上探+首个已授权回退+无默认时不动作、LOCAL 下 per-call 云模型拒绝、headless 审批告警（含端到端 stderr）。

### 4.1 新测试未覆盖、且对 role-based 语义仍然成立的场景（建议补 5 个，未动手写）

1. **LOCAL 断连错误路径**（旧 :149「local provider marked disconnected → ProviderUnavailableError」的等价物）：`resolveLocalModel`（nightglide-routing.ts:163）只看 `getAvailable("chat")` 的 provider/baseUrl，不查连通性——一个 stale 缓存的死端点本地模型会被正常绑定，首呼才失败。需要一条测试**钉死预期语义**：绑定前是否应跳过/降级已标记断连的 provider，还是显式接受「首呼失败落入 retry-fallback 链」。（新实现与 23 用例中均无 `disconnected`/`lastCheck` 语义，grep 证实。）
2. **resolveLocalModel 忽略认证状态的边界**：`hasModelAuth` 仅在 performance 的 `resolveStrongestModel`（nightglide-routing.ts:397）使用；LOCAL 模式可把一个**无凭据**的本地模型绑为全角色主模型。建议补测并决策：`resolveLocalModel` 是否应按 `hasModelAuth` 过滤或在 reasons 中提示。
3. **MANUAL 无效 role 值的启动报错**（旧 :370「nonexistent/model → ModelNotConfiguredError」）：新架构 manual 零动作，无效 selector 的报错 deferred 给 OMP resolver；`invalidModelSelectorReason` 已存在但新测试只覆盖了 per-call 场景（:370-421）。补一条「manual 模式下用户配置了不存在模型的角色」的测试，钉住启动/首呼时的报错可达性。
4. **MANUAL 空白字符串 role 值**（旧 :355「`main: "   "` → ManualRoleNotAssignedError」）：新实现中 `getModelRole(role)?.trim()` 只在 balanced/performance 判空（nightglide-routing.ts:328），manual 语义下空白值究竟是「未配置」还是「无效配置」无测试钉住。
5. **重复应用幂等**：`applyNightglideRouting` 用 `appliedRouting` WeakMap 去重（nightglide-routing.ts:231/258），但 23 用例中没有「对同一 Settings 第二次调用返回相同结果且不重复叠加 fallback 链」的断言——这是 role-based 语义下防止链路翻倍的回归防线。

（备选第 6 条：LOCAL + 显式 `nightglide.localModel` 未命中可解析本地模型时的 fatal 与否——`resolveLocalModel` 已测未命中 reason（:92-99），但未测其在 LOCAL 模式下是否同 :284 一样抛启动错误。）

---

## 5 · 可复现安装准备（任务 B 交付）

### 5.1 vendor/omp 打包面勘探结论

- **入口**：`packages/coding-agent/src/cli.ts`；bin 三名：`omp` / `ng` / `nightglide`（`packages/coding-agent/package.json` bin 字段，Nightglide fork 已注入 `nightglide`）。
- **npm 分发面**（`files` 字段）：`src`（TS 源）+ `dist/cli.js` + `dist/*.node`（预编译原生插件随包分发）+ `dist/*.json-*.zst`（数据文件）+ `dist/docs-index.generated.txt` 等；发布命令 `npm publish -ws --access public`（根 package.json scripts）。
- **原生依赖**：`packages/natives`（`@oh-my-pi/pi-natives`，N-API Rust 绑定），`main: ./native/index.js`；本仓构建命令 `bun run build:native`（根 scripts，= `bun --cwd=packages/natives run build`，默认 Cargo/N-API 后端，可选 `OMP_NATIVE_BUILD_BACKEND=bazel`）；产物如 `packages/natives/native/pi_natives.darwin-arm64.node`（本机已构建）。
- **上游官方分发方式（README.md:39-91）**：① `curl -fsSL https://omp.sh/install | sh`（预编译二进制 + SHA-256 校验，`build.stencil.so` 供源）；② Homebrew `can1357/tap/omp`；③ `bun install -g @oh-my-pi/pi-coding-agent`；④ Nix flake；⑤ Windows `install.ps1`；⑥ 源码开发 `bun setup`（= install → natives → coding-agent link → omp 全局链接，Windows 原生化处理见 scripts/setup.ts）。
- **单文件二进制**：`bun --compile` 流水线存在且上游 CI 在用——`packages/coding-agent/scripts/build-binary.ts` → `compile-binary.ts`（`COMPILED_EXTERNAL_DEPENDENCIES` 把 `.node`/`.zst` 嵌入），release 由 `scripts/ci-release-build-binaries.ts` 按 darwin-arm64/x64、linux-x64/arm64/musl 等目标产出 `packages/coding-agent/binaries/omp-*`；安装方法矩阵有 CI（`scripts/install-tests/run-ci.sh` + source/tarball/binary 三个 dockerfile）。**fork 未验证此路径**（详见 docs/INSTALL.md 第 7 节：.node 嵌入/解包与 compiled 模式 `getPackageDir()` 回退等组合未在 fork 跑通）。

### 5.2 scripts/install.sh（已实现并验证）

位置：`/Users/aoody743/Documents/Nightglide CLI/scripts/install.sh`。要点：`set -euo pipefail`；`--prefix`（默认 `~/.local`，相对路径转绝对）；前置校验四步（bun 存在 → 子模块/`src/cli.ts` 存在 → `vendor/omp/node_modules` 存在 → 按平台映射 `pi_natives.<os>-<arch>.node` 已构建，缺任一即停并给出补救命令）；只写 `<prefix>/bin/nightglide` launcher（语义等价根 wrapper：`PI_RAW_BIN`/`OMP_APP_NAME` + `bun --cwd=<repo>/vendor/omp/packages/coding-agent src/cli.ts`，repo 绝对路径安装时固化）；**绝不创建/修改 `omp`**（若 `<prefix>/bin/omp` 存在仅提示不动）；幂等——目标已存在但非本脚本生成则拒绝覆盖。

验证记录（2026-11-18，全部通过）：

| 用例 | 命令/结果 |
| :--- | :--- |
| 主仓安装 + 版本 | `bash scripts/install.sh --prefix /tmp/ng-install-test` → `/tmp/ng-install-test/bin/nightglide --version` 输出 `nightglide/18.20.2` |
| 幂等重跑 | 二次执行成功，版本输出不变 |
| 非本脚本产物拒覆盖 | 预置异己文件 → exit 1 + 拒绝信息 |
| 既有 omp 不动 | 预置 `bin/omp` → 安装成功且该文件原样 |
| 源码就绪路径 | `/tmp/ng-clean-clone`（独立 clone，vendor/node_modules/natives 齐备）→ `--prefix /tmp/ng-clean-clone-test` 安装成功，`nightglide/18.20.2` |
| 缺 natives 失败路径 | /tmp 伪造仓库骨架 → exit 1 + 「先 build」提示 |
| 缺 node_modules | 校验分支已实现（同失败路径模式） |

验证过程未触碰真实 `~`，临时产物仅在 /tmp。

### 5.3 文档

- `docs/DEVELOPMENT.md`：确认为旧原型文档（描述 `apps/cli` + `@nightglide/*` 工作区与 `bun run dev`/`doctor` 等已退役命令流），已在标题下按既有风格加历史声明（指向 ROADMAP.md 与 INSTALL.md），正文未改。
- `docs/INSTALL.md`（新建）：获取（clone + submodule init，指向 nightglide-omp fork）→ 依赖（bun install）→ 原生构建（build:native）→ 安装（install.sh 行为契约）→ 冒烟验证（--version / ci:test:smoke）；如实记录上游 5 种分发方式；将 `bun --compile` 单文件打包标注为**未验证开放项**并写明原因（.node 嵌入 + compiled 模式 getPackageDir 回退等上游工具链组合未在 fork 验证）；记录 launcher 的已知 cwd 限制（见下）。

### 5.4 勘探中发现的独立问题（已实测，未修复，建议立项）

根 wrapper 与新 launcher 的 `bun --cwd=<coding-agent>` 语义会把进程 cwd 固定在 vendored 源码目录，而 OMP 项目目录解析 `getProjectDir()`（`packages/utils/src/dirs.ts:234`）按进程 cwd 快照——实测（在 /tmp 启动）`getProjectDir()` 返回 `vendor/omp/packages/coding-agent` 而非启动目录。上游官方 dev wrapper 用 `OMP_LAUNCH_CWD` + preload shim（`packages/coding-agent/scripts/omp` + `omp.ts`）在 import 前恢复用户目录；根 `nightglide` wrapper 未做该恢复。INSTALL.md 已如实标注为已知限制/待办（launcher 保持与根 wrapper 等价，未单方面偏离）。

---

## 6 · 结论速览

| # | 资产 | 新主线等价物（file:line） | 结论 |
| :--- | :--- | :--- | :--- |
| 1 | diffParser（324 行） | chrome/diff.ts:121/:177、render-utils.ts:694/:760、diff-pane.ts:193、conventional/diff.ts:191、pi-natives text.rs、utils.ts:352、width-aware-text.ts | **有据不迁**（OMP 严格超集；无消费者；盘点「CJK 感知」系误记） |
| 2 | Celestial Kinetics 预算/防抖 | frame-rate.ts:8、spinner-clock.ts:8/:10、motion-effects.ts:10、theme-class.ts:841、splash.ts、component.ts:1484 | **有据不迁**（等价机制以可配置形态存在；预算落法=配置默认值） |
| 3a | vendors.ts 品牌数据 | theme/nightglide-*.json ×5 + theme-class.ts:841 | **不迁**（无消费者；留分支待 Stage 5+） |
| 3b | dimensions.ts 分级 | 原生布局引擎 + width-aware-text.ts + presets.ts:26 | **不迁**（旧布局层专用） |
| 3c | auth.ts 封装 | shim.ts:1491、auth-broker-config.ts:256、sqlite-credential-store.ts:401、model-provider-discovery.ts:51 | **不迁**（API 本体即新主线；包装层结构性多余） |
| 4 | 旧 routing 28 用例 | nightglide-routing.test.ts 23 用例 + nightglide-routing.ts | **不迁用例，补 5 个场景**（§4.1；旧 classifier 类用例随架构退役） |
| B | 安装准备 | scripts/install.sh + docs/INSTALL.md + DEVELOPMENT.md 历史声明 | **已交付并验证**（binary 打包=未验证开放项） |
