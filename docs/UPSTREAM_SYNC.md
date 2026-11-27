# 上游同步指南 / Upstream Sync Guide (`vendor/omp` `codex/nightglide`)

本文档说明如何将 Nightglide 的 vendored OMP fork（`vendor/omp`，分支 `codex/nightglide`）与上游仓库 [`can1357/oh-my-pi`](https://github.com/can1357/oh-my-pi) 的新版本安全同步，并列明 Nightglide 的定制代码边界与合并后的回归门禁。

---

## 1. 仓库与分支基线

| 项目 | 值 |
|---|---|
| 主仓库子模块路径 | `vendor/omp` |
| 子模块 `origin`（私有 fork） | `https://github.com/Aoody743/nightglide-omp.git`（分支 `codex/nightglide`） |
| 上游 `upstream` | `https://github.com/can1357/oh-my-pi.git` |
| 当前上游基线版本 | **v18.20.2**（提交 `7c49c11aa5bbaf3f418406583096168ad5b8c6dc`） |
| Nightglide 产品版本 | `PRODUCT_VERSION = "1.0.0"`（内部 `VERSION` 保持上游版本号用于插件与兼容检查） |

首次检查 remotes（若尚未添加 `upstream`）：

```bash
git -C vendor/omp remote -v
# 若缺少 upstream：
git -C vendor/omp remote add upstream https://github.com/can1357/oh-my-pi.git
```

---

## 2. Nightglide 定制文件区域清单

在合并上游改动前，应重点关注以下由 Nightglide 修改或新增的区域（按包划分）：

### 2.1 Utils 与版本标识 (`packages/utils`)
- `packages/utils/src/dirs.ts`：`CLI_NAME`（默认 `"nightglide"`）、`PRODUCT_VERSION = "1.0.0"`；保留 `APP_NAME = "omp"`、`CONFIG_DIR_NAME = ".omp"` 与上游 `VERSION`。

### 2.2 AI 注册表与模型目录 (`packages/ai` & `packages/catalog`)
- `packages/ai/src/registry/*`、`packages/catalog/src/compat/*`：新增 `omlx` 本地提供商兼容规则（`rules/auth/omlx.kdl`、`rules/providers/omlx.kdl`、`rules.json`、`auth-ids.ts`、`provider-ids.ts`、`resolve.ts`、`cache-provider-id.ts`）以及 OAuth/可用性过滤调整。

### 2.3 TUI 引擎、Glide 壳层、像素伙伴与主题 (`packages/tui`)
- **全屏 Screen Provider 钩子**：`packages/tui/src/tui.ts`（`setScreenProvider`、滚轮与键盘焦点/IME 归属）。
- **Glide 壳层与视觉资产**：
  - `packages/tui/src/components/nightglide-shell.ts`（整窗布局、滚轮/锚定、默认收起侧边栏、`Ctrl+N` 切换、实时状态）
  - `packages/tui/src/components/nightglide-pixel-scene.ts`（Flight / Dive / Aurora 像素场景与 `cellPixels=1|2` 渲染）
  - `packages/tui/src/components/nightglide-robot.ts`（5 种 10×5 像素伙伴：`glider` / `cat` / `owl` / `diver` / `prism` + `auto`）
  - `packages/tui/src/components/nightglide-theme-families.ts`（7 套主题色板与 `resolveFramePalette`）
  - `packages/tui/src/components/composer/nightglide.ts` & `registry.ts`
- **7 套内置主题与主题系统**：`packages/tui/src/theme/nightglide-{flight,cloudlight,abyss,abyss-trench,daybreak,iris,aurora}.json`、`loader.ts`、`theme.ts`、`theme-class.ts`、`schema.ts`、`symbols.ts`、`tui-adapters.ts`。
- **双语、键位与欢迎页**：`packages/tui/src/i18n.ts`（统一 `TEXT` 双语表与 `nightglide.language`）、`app-keybindings.ts`（`app.sidebar.toggle` `Ctrl+N`）、`prompt/welcome.ts`、`status-line/*`（`setHostedElsewhere`、路由与回退展示）。
- **浮层、内容卡片与向导**：
  - `packages/tui/src/overlays/nightglide-settings.ts`（7 分类图形化设置页）
  - `packages/tui/src/overlays/task-summary.ts`（`/summary` 弹窗）
  - `packages/tui/src/overlays/{approval-dialog,oauth-selector,model-browser,settings-defs,settings-selector,toast,error-banner}.ts`
  - `packages/tui/src/chat/*`、`chrome/diff.ts`、`render/*`（G3 卡片样式）
  - `packages/tui/src/setup/scenes/{splash,sign-in,routing,custom-provider,theme,updates,outro,types}.ts` 与 `setup/{wizard,wizard-overlay,setup-version}.ts`（`CURRENT_SETUP_VERSION = 4`）。

### 2.4 Coding Agent 核心、路由、审批与命令 (`packages/coding-agent`)
- **CLI、主入口与启动**：`src/cli.ts`、`src/main.ts`、`src/sdk.ts`、`src/cli/*`、`src/commands/{launch-help,update,...}.ts`（品牌化、`--motion`、源码模式 `nightglide update` 提示、关闭上游更新弹窗）。
- **配置、路由与自定义提供商**：`src/config/{nightglide-menu,nightglide-routing,nightglide-custom-providers,all-settings,model-registry,model-resolver,settings}.ts`。
- **内置斜杠命令**：`src/slash-commands/{builtin-nightglide,builtin-summary,builtin-theme,builtin-registry}.ts`（`/provider`、`/more`、`/summary`、`/theme`）。
- **审批策略与安全边界**：`src/tools/{approval,settings}.ts`（默认 `write`、默认 `restrictedFolders: ["~/.omp"]`、项目配置只收紧不放宽）、`src/session/{agent-session,session-tools,turn-recovery}.ts`、`src/speculation/host.ts`、`src/task/structured-subagent.ts`（`local` 模式下拒绝非本地 per-call 模型）。
- **交互模式与控制器**：`src/modes/{interactive-mode,settings,setup,startup-composer,types}.ts`、`src/modes/controllers/*`。

### 2.5 测试与测试预加载
- `packages/tui/test/nightglide-*.test.ts`、`packages/tui/test/task-summary.test.ts`
- `packages/coding-agent/test/nightglide-*.test.ts`、`setup-wizard.test.ts`、`tools/approval*.test.ts`、`builtin-theme-command.test.ts`、`interactive-mode-theme-toast.test.ts`
- `scripts/nightglide-test-preload.ts`、`.github/workflows/tui.yml`

---

## 3. 同步操作步骤

### 步骤 1：确认干净的工作区并抓取上游

```bash
# 在主仓库根目录检查主仓与子模块均无未提交改动
git status
git -C vendor/omp status

# 拉取上游与 fork 最新状态
git -C vendor/omp fetch origin
git -C vendor/omp fetch upstream --tags
```

### 步骤 2：预览上游差异（建议先评估变更面）

```bash
# 将 <target-tag> 替换为目标上游 tag（例如 v19.x.y）
git -C vendor/omp log --oneline v18.20.2..<target-tag>
git -C vendor/omp diff --stat v18.20.2..<target-tag> -- \
  packages/tui/src/tui.ts \
  packages/coding-agent/src/modes/interactive-mode.ts \
  packages/coding-agent/src/tools/approval.ts \
  packages/tui/src/setup/ \
  packages/tui/src/theme/
```

### 步骤 3：在集成支线合并上游（推荐 `merge`，保留 fork 历史）

> **策略建议**：`codex/nightglide` 已推送至 `origin` 且被主仓库引用，建议使用 **`git merge`** 将目标 tag 并入 `codex/nightglide`（可清晰记录每次基线跃迁并避免破坏远端历史），仅在团队明确约定重整提交时使用 `rebase`。

```bash
git -C vendor/omp checkout -b sync/<target-tag> codex/nightglide
git -C vendor/omp merge --no-ff <target-tag>
```

### 步骤 4：解决冲突时必须守住的不变量

处理冲突时逐项核对以下产品与安全底线：

1. **审批与安全默认**：
   - `tools.approvalMode` 默认值必须保持 `"write"`（`packages/coding-agent/src/tools/settings.ts`）。
   - `tools.restrictedFolders` 默认必须包含 `["~/.omp"]`，且项目级 `.omp/config.yml` 只能收紧、不能放宽（`packages/coding-agent/src/tools/approval.ts`）。
2. **新增上游内置命令分类**：
   - 若上游新增了内置 slash command，`packages/coding-agent/test/nightglide-menu.test.ts` 会自动失败提示未归层；必须将其归入 `NIGHTGLIDE_COMMANDS`（`common` / `standard` / `advanced`）并在 `packages/tui/src/i18n.ts` 补齐 `cmd.<name>` 中英条目。
3. **双语文本完整性**：
   - `packages/tui/test/nightglide-i18n.test.ts` 会校对所有 `TEXT` 条目的 `zh`/`en` 完整性与占位符一致性。
4. **品牌、主题与设置隐藏清单**：
   - 保持 `PRODUCT_VERSION` 与 `VERSION` 分离、经典 inline 入口保持移除、`/login` 保持 OAuth-only + 自定义提供商入口、主题列表仅暴露 7 套 `nightglide-*` 内置主题。
   - 检查 `NIGHTGLIDE_HIDDEN_SETTINGS`（`settings-defs.ts`）是否需要屏蔽上游新增的自更新设置。
   - 检查 `CURRENT_SETUP_VERSION` 与 `ALL_SCENES` 一致性。
5. **依赖与原生插件**：
   - 若上游修改了 `package.json`、`bun.lock` 或 `crates/`，必须重新运行：
     ```bash
     cd vendor/omp
     bun install --frozen-lockfile || bun install
     bun run build:native
     ```

---

## 4. 合并后必跑回归门禁

所有代码冲突解决并完成构建后，按顺序执行以下验证门禁（全部通过后才可合并回 `codex/nightglide`）：

```bash
# 1. 静态检查、格式化与类型检查（在 vendor/omp 内）
cd vendor/omp
bun run check:ts
# 或分项运行:
# bunx oxlint .
# bun run --cwd packages/tui check:types
# bun run --cwd packages/coding-agent check:types

# 2. TUI 全量与 Nightglide 专项单测（在 vendor/omp/packages/tui 内）
cd packages/tui
bun test test/nightglide-*.test.ts test/task-summary.test.ts
bun test

# 3. Coding Agent 菜单、路由、向导与审批安全单测（在 vendor/omp/packages/coding-agent 内）
cd ../coding-agent
bun test \
  test/nightglide-menu.test.ts \
  test/nightglide-routing.test.ts \
  test/nightglide-custom-providers.test.ts \
  test/setup-wizard.test.ts \
  test/builtin-theme-command.test.ts \
  test/interactive-mode-theme-toast.test.ts \
  test/tools/approval.test.ts \
  test/tools/approval-mode.test.ts \
  test/tools/approval-cached-mode.test.ts \
  test/tools/approval-restricted-folders.test.ts

# 4. 上游自带 CLI 冒烟测试（在 vendor/omp 根目录）
cd ../..
bun run ci:test:smoke

# 5. 返回 Nightglide 主仓库执行根启动器门禁与 CLI 冒烟
cd ..
bun test ./scripts
./nightglide --version
./nightglide --help
./nightglide --smoke-test
```

### 视觉与交互抽查

- 触发 `scripts/glide-spike/` 截图或实机在真彩终端（Ghostty / iTerm2）与 Terminal.app（256 色）中核对：
  - 启动画面 wordmark、7 套主题顶底双侧场景带、`Ctrl+N` 侧边栏与 5 位像素伙伴
  - `/settings`、`/more`、`/summary`、`/provider` 与 80×24 窄屏回退
  - `NO_COLOR=1` 与 `--motion none` 输出

---

## 5. 推送 Fork 与更新主仓库子模块指针

验证全部通过后，把同步结果落盘到 `codex/nightglide` 并更新主仓库子模块引用：

```bash
# 1. 合并并推送 vendor/omp fork
git -C vendor/omp checkout codex/nightglide
git -C vendor/omp merge --ff-only sync/<target-tag>
git -C vendor/omp push origin codex/nightglide

# 2. 更新主仓库子模块指针与基线文档
git add vendor/omp docs/OMP_BASELINE.md docs/CURRENT_STATE.md CHANGELOG.md
git submodule status
git commit -m "chore(vendor): sync vendor/omp with upstream <target-tag>"
```

同步完成后，请同步更新 [docs/OMP_BASELINE.md](OMP_BASELINE.md) 中的基线版本/提交号以及 [docs/CURRENT_STATE.md](CURRENT_STATE.md) 中的验证记录。
