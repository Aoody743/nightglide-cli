# Nightglide 项目现状

更新时间：2026-11-23。本文是工作区快照，不是完整功能或安全审计；代码变化后须同步更新。

## 结构

仓库已精简为单一主线：`vendor/omp`（OMP v18.20.2 基线 `7c49c11aa5bbaf3f418406583096168ad5b8c6dc` 的 fork，分支 `codex/nightglide`）+ 根目录启动器、安装脚本和门禁。旧 OpenTUI 原型（`apps/cli`、`packages`、`tests`）、两条 P1 并行样板（`scripts/p1-prototype`、`scripts/p1-zcode`）、协作日志和标为历史的规范文档已于 2026-11-20 删除，可在 git 历史中查阅。`./nightglide` 不再有 `--legacy` 入口。

## 界面

**Glide 全屏界面（唯一的交互界面）**：在 alt-screen 中自管整窗布局——顶栏、上下像素场景带、对话面板（应用内滚动）、信息栏（模型／强度／子智能体／状态，读真实数据；侧栏显示时底部状态栏不再重复模型）、输入卡片、状态行。已在 Terminal.app 实测流式回复、面板内滚轮回看、140×40→80×24 缩放降级、`/exit` 与 SIGTERM 干净恢复（退出时对话写回原生 scrollback）。选择它的原因见 [视觉差距审计](reviews/visual-gap-audit.md)，细节与已知问题见 [Glide 验证记录](reviews/glide-spike.md)。

**经典 inline 模式**：已于 2026-11-22 移除入口（F2、`--classic`、`nightglide.layout`、`NIGHTGLIDE_LAYOUT`）。旧配置里的 `nightglide.layout` 仍可加载，但不再生效。print／RPC 等非交互模式不受影响。

**品牌**：窗口标题与状态栏的标识为 `✦`（ASCII 符号集为 `ng`）；帮助、提示、报错和示例中的命令名为 `nightglide`。`~/.omp` 数据目录、`@oh-my-pi/*` 包名、`OMP_*` 环境变量、日志文件名 `omp.*.log` 保留不变。启动时不再弹出上游 OMP 更新日志；`nightglide update` 只提示用 git 更新。

**版本**：产品版本从 v1.0 起算，当前为 **v1.0 beta1**（`1.0.0-beta.1`，见根 `package.json` 与 fork 的 `PRODUCT_VERSION`），用于 `--version`、帮助标题和欢迎横幅。fork 内部的 `VERSION` 仍是上游 18.20.2，浏览器扩展、插件兼容和更新日志比较依赖它，不改。

**字体**：推荐 NeoX Mono；终端程序不能自选字体，由 `scripts/terminal-profile.sh` 建立 Terminal.app 的 “Nightglide” 描述文件（NeoX Mono 14pt），截图脚本会自动使用它。见 [安装说明](INSTALL.md)。

## 菜单与设置

- **`/` 菜单**：只输入 `/` 时列出常用命令（默认 19 个，含 `/more`），按“会话／模型／外观／工作／其他”分组的中文说明，命令有实时状态时附在括号里（如“模型 · 切换模型（omlx/endless）”）。清单是设置 `nightglide.commonCommands`，改后即时生效；输入名字时仍搜索全部命令（含扩展、技能、模板）。
- **`/more`**：列出全部命令及说明，选中后把 `/命令名 ` 填入输入框。
- **`/settings`**：默认打开“常用”页（14 项：主题、动效、图标字符、输入框样式、思考强度、路由模式、本地模型、隐藏思考内容、审批策略、三种通知、常用命令），标签、说明和取值都是中文；这些是其他标签页里同一设置的另一种显示，保存方式不变。原有英文标签页全部保留，搜索不重复列出常用页。

## 提供商

- **`/login` 和设置向导只列账号登录**（OAuth、设备码等，约 20 项，如 ChatGPT、Claude、Gemini、GitHub Copilot、Cursor、OpenRouter）。原来 67 个“粘贴 API Key”的条目和 5 个实为填 Key 表单的条目（阿里 ×2、Cloudflare ×2、小米）不再列出，但没有删除，仍可通过环境变量或 models.yml 使用；退出登录列表仍包含全部。
- **自定义提供商**：`/login` 第一项“＋ 添加自定义提供商”或命令 `/provider`，填写名称、Base URL、接口类型（OpenAI 兼容 / Anthropic 兼容）和 API Key（输入时遮掩）。配置写入 `~/.omp/agent/models.yml`（首次改写前备份为 `models.yml.bak`），Key 存入 OMP 凭据库（agent.db），自带模型列表的条目按 OMP 要求仍内联保存 Key。保存后自动拉取 `/models` 并显示发现的模型数或失败提示。`/provider` 可编辑、删除已有条目。
- **`/model` 只列可用的提供商**，不再显示“Not signed in”的锁定列表。
- 已在 Ghostty 中用本地模拟服务实测添加流程；截图在 `scripts/glide-spike/shots/providers/`。用户现有的 omlx、claude-proxy、codexplus 未改动。

## 下一步

按 [开发计划](DEVELOPMENT_PLAN.md) 的顺序：~~品牌化~~（已完成，截图验收待补）→ ~~P3.3 审批策略~~（默认已改为 `write`，`~/.omp` 默认受限；三档中文名随菜单简化、审批框中文化随 G3，见 [P3.3](reviews/p3.3-approval-policy.md)）→ ~~菜单与设置简化~~（见下“菜单与设置”）→ **G3**（下一项） → G4 → P3.1／3.2 → G5 → 交互基线与 G6 → P4。

界面各阶段（G1–G6，详见 glide-spike.md）：

1. ~~**G1 收尾**~~：已完成（2026-11-20）——回看锚定、End／点击回到底部、全屏动画帧、`/copy`、布局设置（`--classic` 等入口已随品牌化移除）、screen provider 测试。
2. ~~**G2 场景精修**~~：已完成（2026-11-21）——飞行近远两层视差与细光带、潜水光柱／水草／气泡、按实际生效强度联动、四主题 256 色专用配色、`--motion none` 静帧。真彩只做了渲染预览，未在真彩终端实测（见 glide-spike.md“G2 结果”）。
3. **G3 内容卡片**：用户消息卡、回复标题、工具 chip、diff 卡片、审批框统一。
4. **G4 机器人与信息栏**：像素机器人三态、强度彩条、子智能体实时状态、任务总结入口。
5. **G5 四主题定稿**：映射待定（flight / cloudlight / abyss / daybreak，aurora 额外保留），亮暗截图矩阵。
6. **G6 稳定性**：长会话性能、tmux、中文输入法候选框位置。

## 主题

只内置 Nightglide 的五套主题（Aurora 有自己的场景和启动动画，见下）：nightglide-flight（默认暗色）、nightglide-cloudlight（默认亮色）、nightglide-abyss、nightglide-daybreak、nightglide-aurora。OMP 原有的 dark、light 和 100 套主题包已于 2026-11-20 删除；`dark`／`light` 等旧名称作为不列出的别名，分别加载 Flight／Cloudlight，旧配置与扩展不会因此报错。用户自定义主题（`~/.omp/agent/themes/*.json`）仍然可用。同轮修复：五套主题的代码块标题行对比度过低（约 1.5:1，提高到 3.5–4.3:1）；ASCII 符号模式下主题自带的 Unicode 转圈不再覆盖 ASCII。

**飞行与潜水场景**（2026-11-24 重做）：飞行——顶部是夜空（Cloudlight 为白天），有月亮（太阳）和柔和光晕、高空薄云与星星；底部是三层漂移的云海，云团圆顶、受光边缘和暗部，近层漂得最快，思考强度越高云团越高、边缘越亮。潜水——顶部是从水下看到的水面：闪动的水面线、游移的焦散光斑和斜射光束；底部是礁石、沙地、摇曳的海草、珊瑚和上升的气泡。真彩下平滑渐变，256 色终端用克制的网格配色。

**Aurora 场景**（2026-11-24，第二版）：顶部是平滑渐变的极光帘幕——下缘最亮、光束高低不一、向上由绿转紫，帘幕之间只变暗不断开，下方有柔和光晕；底部是两层山脉（远山亮脊线、近山剪影）和地平线光晕，配少量星星。启动或切换到 Aurora 时，帘幕从左向右被点亮（约 3.5 秒）；关闭动效时直接显示完整画面。256 色终端用一套更克制的配色。

**界面顶部**：不再有“✦ Nightglide ··· [主题名]”标题行，顶部场景从窗口最上沿开始。

**场景像素**：默认每格上下两个像素（`▀` 半格）。Terminal.app 用字体自带的方块字符，NeoX Mono 下像素之间有缝，所以在 Terminal.app 中自动改为每格一个像素（只填背景色，清晰但较粗）；`NIGHTGLIDE_SCENE_PIXELS=1|2` 可覆盖。iTerm2、Ghostty 自己绘制方块且支持真彩，效果最精细（见 [安装说明](INSTALL.md)）。截图与预览在 `scripts/glide-spike/shots/aurora-v2/` 和 `shots/scenes-v2/`。Ghostty（真彩、自绘方块）实测了 Flight、Abyss、Aurora；Terminal.app 实测了 Flight、Aurora；其余主题在两种终端中只有渲染预览。

## 待决

- ~~是否把 Glide 设为默认界面~~：已定为默认（2026-11-20）。
- 四主题映射。
- 五档思考强度现场展示需要支持可调 thinking level 的模型凭据（本地 `omlx/endless` 不支持）。

## 验证边界

- 启动器测试：`bun test ./scripts` 覆盖 NO_COLOR、退出与 SIGINT 复原、bunfig 隔离。Glide 有 shell／screen provider／布局参数测试。
- 本地 oMLX（`omlx/endless`）在 Glide 下流式回复与推理显示已实测（2026-11-22）；工具调用未测。启动器会把本机地址加入 `NO_PROXY`，避免 shell 代理拦截本地模型请求。
- `/theme <名称>` 可直接切换主题（保存到当前背景对应的 `theme.dark`/`theme.light`）。
- 云端调用、MCP／扩展／LSP 真实加载与 fork 全量测试未在本轮重新验证。
- Glide 真实终端截图见 `scripts/glide-spike/shots/`（G2 在 `shots/g2/`，渲染预览在 `shots/g2-preview/`）；本机无真彩终端，真彩场景只有渲染预览；更早轮次的证据、验收记录和样板已清理，可在 git 历史中查阅。

## 安全

见 [安全现状](SECURITY.md)。要点：审批默认 `write`（高风险询问），`~/.omp` 默认受限，项目配置不能放宽审批；LOCAL 路由只约束聊天模型；凭据沿用 OMP 体系。
