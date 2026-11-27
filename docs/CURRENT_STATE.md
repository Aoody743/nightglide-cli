# Nightglide 项目现状

更新时间：2026-11-27。本文是工作区快照，不是完整功能或安全审计；代码变化后须同步更新。

## 结构

仓库已精简为单一主线：`vendor/omp`（OMP v18.20.2 基线 `7c49c11aa5bbaf3f418406583096168ad5b8c6dc` 的 fork，分支 `codex/nightglide`）+ 根目录启动器、安装脚本和门禁。旧 OpenTUI 原型（`apps/cli`、`packages`、`tests`）、两条 P1 并行样板（`scripts/p1-prototype`、`scripts/p1-zcode`）、协作日志和标为历史的规范文档已于 2026-11-20 删除，可在 git 历史中查阅。`./nightglide` 不再有 `--legacy` 入口。

## 界面

**Glide 全屏界面（唯一的交互界面）**：在 alt-screen 中自管整窗布局——顶底双侧像素场景带、对话面板（应用内滚动，G3 统一用户卡与 `✦ Nightglide` 回复头、工具/Diff 卡片配色及中英双语审批框）、**默认收起的可折叠侧边栏**（`Ctrl+N` 或顶部 `[ ▸ 详情 ^N ]` / `[ ▾ 收起 ]` 切换；展开后顶部呈现 10×5 像素伙伴与 `Nightglide` 实时状态、无多余横线的紧凑参数行：模型与路由、思考强度条、上下文用量（无模型时显示 `—`，不显示 `7.2K/?`）、尾部优先保留的 `工作目录`、可展开子智能体列表与底部 `/summary` 胶囊按钮；扩展与窄屏自适应回退）、输入卡片、默认状态栏（已移除默认 `path` 与 `context_pct` 杂讯，改用几何符号替换 Windows/废纸篓图标）。已在 Ghostty（`1.4.0`，真彩）与 Terminal.app（NeoX Mono 14pt，256 色）140×40 下完成静帧实测，截图在 `scripts/glide-spike/shots/verify-ghostty/` 与 `scripts/glide-spike/shots/verify/`。选择原因见 [视觉差距审计](reviews/visual-gap-audit.md)，细节与历史记录见 [Glide 验证记录](reviews/glide-spike.md)。

**经典 inline 模式**：已于 2026-11-22 移除入口（F2、`--classic`、`nightglide.layout`、`NIGHTGLIDE_LAYOUT`）。旧配置里的 `nightglide.layout` 仍可加载，但不再生效。print／RPC 等非交互模式不受影响。

**品牌**：窗口标题与状态栏的标识为 `✦`（ASCII 符号集为 `ng`）；帮助、提示、报错和示例中的命令名为 `nightglide`。`~/.omp` 数据目录、`@oh-my-pi/*` 包名、`OMP_*` 环境变量、日志文件名 `omp.*.log` 保留不变。启动时不再弹出上游 OMP 更新日志；`nightglide update` 只提示用 git 更新。

**版本**：产品版本为 **v1.0.0**（`nightglide/1.0.0`，见根 [package.json](../package.json) 与 fork 的 `PRODUCT_VERSION`），用于 `--version`、`--help` 标题与欢迎信息。fork 内部的 `VERSION` 仍是上游 18.20.2，浏览器扩展、插件兼容与导出器版本比较依赖它，不改。

**Web 面板与导出页**：`nightglide stats` 本地统计网页面板已重做为 **Nightglide Stats** 品牌界面（几何翼型 `N` 徽标、Flight Dark / Cloudlight 双主题、核心中英 `中 / EN` 切换），并在 Chromium 实机浏览器完成暗/亮/中英交互及零控制台报错验证；`/export` 离线 HTML 会话导出同步切换为 Flight Dark / Cloudlight 主题配色。

**字体**：推荐 NeoX Mono；终端程序不能自选字体，由 `scripts/terminal-profile.sh` 建立 Terminal.app 的 “Nightglide” 描述文件（NeoX Mono 14pt），截图脚本会自动使用它。见 [安装说明](INSTALL.md)。

## 菜单与设置

- **语言**（S1，2026-11-24）：设置 `nightglide.language` 可选中文（默认）、English、跟随系统（按 `LANG`／`LC_ALL`），在 `/settings` 图形页“语言”分类，改后不用重启。Nightglide 自己的界面文字（菜单、图形设置页、标签名、提供商流程、侧栏、提示）都有中英两版；OMP 原有的高级设置条目、命令实时状态、启动警告和设置向导仍是英文。
- **`/` 菜单**（S2，2026-11-25）：93 个内置命令分三层。只输入 `/` 时列出常用命令（默认 20 个，含 `/more`，清单是 `nightglide.commonCommands`）；输入名字时搜索常用和标准命令；高级命令（重复和实验性的，如 `/switch`、`/quit`、`/vibe`，清单是 `nightglide.hiddenCommands`）要输入完整名字或别名才出现，照样能运行。每个内置命令都显示“分组 · 说明”，有实时状态时附在括号里，语言跟随界面语言。扩展、技能、模板命令照常可搜索。
- **`/more`**（S3，2026-11-25）：按分组列出常用和标准命令，以及扩展、技能和模板，说明跟随界面语言；第一行“＋ 显示高级命令”展开全部命令（高级命令在最后一组）。可输入文字筛选，选中后把 `/命令名 ` 填入输入框。
- **`/settings`**（S4–G5，2026-11-27 更新）：默认打开 Glide 风格的图形化设置页（`nightglide-settings.ts`）：宽屏（≥100 列）左分类栏 + 右控件 + 底部双语按键提示，窄于 100 列单栏。外观分类覆盖 7 套内置主题卡片（3 亮 + 3 暗 + 1 极光）、动效、图标字符、输入框样式及 **G4 像素伙伴形象选择**（`nightglide.robotStyle`：`auto` 跟随主题 / `glider` 夜航机甲 / `cat` 星云猫耳 / `owl` 夜鸮领航 / `diver` 深海潜航 / `prism` 极光星灵，附 10×5 实时预览与双语简介）。
- **启动画面与向导**（S5，2026-11-27 收尾）：`NIGHTGLIDE_WORDMARK` 重绘为 46×5 实心方块大写字母 `NIGHTGLIDE`，修复 NeoX Mono 回退字体下的断笔与错位问题；跳过提示改用独立空格文本（`按 Enter 跳过` / `Press Enter to skip`）。`SelectList` 完成中英双语化，向导包含 P3.1/P3.2 路由与自定义提供商引导（`CURRENT_SETUP_VERSION = 4`）。
- **任务总结（G4 `/summary`）**：侧边栏底部按钮或 `/summary` 命令打开 `TaskSummaryComponent`，先离线展示真实会话、工具、文件与子智能体事实，并明确提示上下文范围与潜在费用；仅在用户主动触发时调用当前模型，生成失败/取消/无凭据均不篡改原会话历史。

## 提供商

- **`/login` 和设置向导只列账号登录**（OAuth、设备码等，约 20 项，如 ChatGPT、Claude、Gemini、GitHub Copilot、Cursor、OpenRouter）。原来 67 个“粘贴 API Key”的条目和 5 个实为填 Key 表单的条目（阿里 ×2、Cloudflare ×2、小米）不再列出，但没有删除，仍可通过环境变量或 models.yml 使用；退出登录列表仍包含全部。
- **自定义提供商**：`/login` 第一项“＋ 添加自定义提供商”或命令 `/provider`，填写名称、Base URL、接口类型（OpenAI 兼容 / Anthropic 兼容）和 API Key（输入时遮掩）。配置写入 `~/.omp/agent/models.yml`（首次改写前备份为 `models.yml.bak`），Key 存入 OMP 凭据库（agent.db），自带模型列表的条目按 OMP 要求仍内联保存 Key。保存后自动拉取 `/models` 并显示发现的模型数或失败提示。`/provider` 可编辑、删除已有条目。
- **`/model` 只列可用的提供商**，不再显示“Not signed in”的锁定列表。
- 已在 Ghostty 中用本地模拟服务实测添加流程；截图在 `scripts/glide-spike/shots/providers/`。用户现有的 omlx、claude-proxy、codexplus 未改动。

## 下一步

按 [开发计划](DEVELOPMENT_PLAN.md) 的顺序：~~品牌化~~ → ~~P3.3 审批策略~~ → ~~设置与命令重做（S1–S5）~~ → ~~G3 内容卡片与双语审批框~~ → ~~G4 像素伙伴、折叠侧栏与 `/summary`~~ → ~~P3.1／3.2 向导与路由界面~~ → ~~G5 七套主题定稿与双侧云海~~ → ~~Web 统计面板与 `/export` 视觉重做~~ → ~~v1.0.0 打包与独立二进制自检~~ 均已完成验证（详见 [v1.0.0 发布清单](P4_RELEASE_CHECKLIST.md)）；P4 仅保留无录屏要求的静态截图矩阵与多平台安装包/Homebrew/APT 交付，G6 长会话压测、tmux 与中文输入法候选框实测继续在后续版本跟踪。

界面各阶段（G1–G6，详见 glide-spike.md）：

1. ~~**G1 收尾**~~：已完成（2026-11-20）——回看锚定、End／点击回到底部、全屏动画帧、`/copy`、screen provider 测试。
2. ~~**G2 场景精修**~~：已完成（2026-11-21），2026-11-27 已补全顶底双侧云海与真彩 Ghostty 实机截图。
3. ~~**G3 内容卡片**~~：已完成（2026-11-27）——用户消息卡、`✦ Nightglide` 回复标题、工具与 diff 卡片、双语审批框（修复 `[y]`/`[s]`/`[n]` 误触发与失效提示）。
4. ~~**G4 伙伴与信息栏**~~：已完成（2026-11-27）——5 种可切换像素伙伴 + `"auto"` 跟随、默认收起的可折叠重设计侧栏、实时思考条/上下文/`工作目录`/子智能体及 `/summary` 任务总结弹窗。
5. ~~**G5 七主题定稿**~~：已完成（2026-11-27）——7 套内置主题（3 亮 + 3 暗 + 1 极光）及外框/导出/场景色同步映射。
6. **P4 发布收尾与 G6 后续**：v1.0.0 静态截图、清单、LICENSE/THIRD-PARTY-NOTICES、Bun `1.4.5` 四平台打包（`.tar.gz`/`.deb`/APT/Homebrew）与 GitHub Release 流水线已就绪；Linux `.deb` 实机运行依赖 GitHub Actions runner 验收，G6 长会话性能、tmux、中文输入法候选框与视频录屏留待后续版本。

## 主题

内置 Nightglide **7 套主题（3 亮色、3 暗色、1 极光）**：
- **暗色（3 套）**：`nightglide-flight`（默认暗色，顶底双侧云海与月辉）、`nightglide-abyss`（深海潜水光柱与海草）、`nightglide-abyss-trench`（高对比深渊荧光青绿）。
- **亮色（3 套）**：`nightglide-cloudlight`（默认亮色，晴空顶底双侧流云）、`nightglide-daybreak`（温润日光象牙底 `#fffaf2` 与浅海光柱）、`nightglide-iris`（虹彩柔云浅色，柔和粉彩彩虹波纹）。
- **极光（1 套）**：`nightglide-aurora`（平滑渐变的绿紫极光帘幕与山脊剪影）。

`/theme <名称>` 支持直接切换并持久化对应槽位。G5 起 Glide 外框与导出配色直接基于主题 JSON 推导（`nightglide-theme-families.ts` `resolveFramePalette`）。`dark`/`light` 旧名作为未列出的兼容别名分别映射至 Flight/Cloudlight，用户自定义主题（`~/.omp/agent/themes/*.json`）仍可用。

**场景像素与终端验证**：支持真彩双像素半块（`▀`）与 Terminal.app 单像素（`cellPixels=1`）降级。2026-11-27 已在 **Ghostty（1.4.0，140×40）** 与 **Terminal.app（NeoX Mono 14pt，140×40）** 完成静态实机截图（`scripts/glide-spike/shots/verify-ghostty/`、`scripts/glide-spike/shots/verify/` 及场景预览 `scripts/glide-spike/shots/verify-preview/`），确认 `NIGHTGLIDE` 启动画面完整、无 Windows/废纸篓与 `7.2K/?` 杂讯、7 套主题云海/潜水/极光及重设计侧边栏与 `/settings`/`/summary` 正常渲染。持续动效录屏随 **P4** 阶段进行。

## 待决

- G6（长会话性能、tmux、中文输入法候选框）及 P4 平台兼容/发布前终端实机录屏验收。
- 五档思考强度在实时会话中的逐步联动仍需支持可调 thinking level 的模型凭据实测。

## 验证边界

- **静态检查与类型（2026-11-27）**：`vendor/omp` 内对全部 106 个改动文件运行 `oxlint` 0 警告 0 错误，对 102 个改动 `.ts`/`.tsx`/`.json` 文件运行 `oxfmt --check` 全部通过（导出 HTML 内嵌样式/脚本 `export/html/*.{js,css}` 沿用上游两空格格式规范）；`packages/utils`（253 文件）、`packages/tui`（3,166 文件）、`packages/stats`（543 + 89 文件 + `oxlint`/`oxfmt` 147 文件）、`packages/coding-agent`（`oxlint`+`check:types`）与 `packages/collab-web` `check` 全部 0 错误。
- **自动化测试（2026-11-27）**：
  - 根目录启动器与打包门禁：`bun test ./scripts`（15 pass, 0 fail，含 `launcher.test.ts` 6/6 与 `package-release.test.ts` 9/9）。
  - 独立编译产物（Bun `1.4.5`，`nightglide-v1.0.0-darwin-arm64`）：隔离 `$HOME`/`$XDG_*` 实测 `--version`（`nightglide/1.0.0`）、`--help`、`--license`、`--smoke-test`（`smoke-test: ok`）与 `--mode rpc` SIGINT（退出码 `130`）。
  - `packages/tui` 全量：`bun test`（4,960 pass, 8 skip；1 个上游已有 macOS 键帽基线失败 `GitHub run-watch renderer` 期望字面 `Ctrl+O` 而 macOS 下渲染 `⌃O`）。
  - `packages/collab-web` 全量：`bun test`（139 pass, 0 fail）。
  - `packages/coding-agent` Nightglide/导出/向导/许可子集（7 文件）：163 pass, 0 fail。
  - `packages/stats`：`web-i18n.test.ts` 2 pass, 0 fail；全量 `bun test` 255 pass, 1 个上游基线失败（`test/db-cost.test.ts:400`）。
  - `Nightglide Stats` Web 面板 Chromium 实机验证：Flight Dark（中文）与 Cloudlight（英文）零控制台错误，所有资源与接口均返回 HTTP 200（截图见 `docs/images/screenshots/stats-web-{dark,light}.png`）。
- **未在本轮重跑 / 待 CI 覆盖**：`darwin-x64`（Intel Mac）与 `linux-x64`/`linux-arm64` `.deb` 实机运行由 GitHub Actions `ci-release.yml` 执行；云端实连模型、MCP/LSP 全量、长会话压测、`tmux`、中文输入法候选框与视频录屏保留为后续跟踪项。

## 安全

见 [安全现状](SECURITY.md)。要点：审批默认 `write`（高风险询问），`~/.omp` 默认受限，项目配置不能放宽审批；LOCAL 路由只约束聊天模型；凭据沿用 OMP 体系。
