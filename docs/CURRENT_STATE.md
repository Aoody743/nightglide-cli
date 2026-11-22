# Nightglide 项目现状

更新时间：2026-11-21。本文是工作区快照，不是完整功能或安全审计；代码变化后须同步更新。

## 结构

仓库已精简为单一主线：`vendor/omp`（OMP v18.20.2 基线 `7c49c11aa5bbaf3f418406583096168ad5b8c6dc` 的 fork，分支 `codex/nightglide`）+ 根目录启动器、安装脚本和门禁。旧 OpenTUI 原型（`apps/cli`、`packages`、`tests`）、两条 P1 并行样板（`scripts/p1-prototype`、`scripts/p1-zcode`）、协作日志和标为历史的规范文档已于 2026-11-20 删除，可在 git 历史中查阅。`./nightglide` 不再有 `--legacy` 入口。

## 界面

**Glide 全屏模式（默认；`--classic` 或设置 `nightglide.layout = classic` 改用经典模式，F2 随时切换）**：在 alt-screen 中自管整窗布局——顶栏、上下像素场景带、对话面板（应用内滚动）、信息栏（模型／强度／子智能体／状态，读真实数据；侧栏显示时底部状态栏不再重复模型）、输入卡片、状态行。已在 Terminal.app 实测流式回复、面板内滚轮回看、140×40→80×24 缩放降级、`/exit` 与 SIGTERM 干净恢复（退出时对话写回原生 scrollback）。选择它的原因见 [视觉差距审计](reviews/visual-gap-audit.md)，细节与已知问题见 [Glide 验证记录](reviews/glide-spike.md)。

**经典 inline 模式**：OMP 原生的 inline 渲染，保留终端原生 scrollback。此前为它加的底部 3 行场景带和 `Ctrl+N` 侧栏已随 Glide 取代而删除（2026-11-20）。

## 下一步（G1–G6，详见 glide-spike.md）

1. ~~**G1 收尾**~~：已完成（2026-11-20）——回看锚定、End／点击回到底部、全屏动画帧、`/copy`、`nightglide.layout` 与 `--glide`/`--classic`、screen provider 测试。
2. ~~**G2 场景精修**~~：已完成（2026-11-21，fork 未提交）——飞行近远两层视差与细光带、潜水光柱／水草／气泡、按实际生效强度联动、四主题 256 色专用配色、`--motion none` 静帧。真彩只做了渲染预览，未在真彩终端实测（见 glide-spike.md“G2 结果”）。
3. **G3 内容卡片**：用户消息卡、回复标题、工具 chip、diff 卡片、审批框统一。
4. **G4 机器人与信息栏**：像素机器人三态、强度彩条、子智能体实时状态、任务总结入口。
5. **G5 四主题定稿**：映射待定（flight / cloudlight / abyss / daybreak，aurora 额外保留），亮暗截图矩阵。
6. **G6 稳定性**：长会话性能、tmux、中文输入法候选框位置。

## 主题

只内置 Nightglide 的五套主题：nightglide-flight（默认暗色）、nightglide-cloudlight（默认亮色）、nightglide-abyss、nightglide-daybreak、nightglide-aurora。OMP 原有的 dark、light 和 100 套主题包已于 2026-11-20 删除；`dark`／`light` 等旧名称作为不列出的别名，分别加载 Flight／Cloudlight，旧配置与扩展不会因此报错。用户自定义主题（`~/.omp/agent/themes/*.json`）仍然可用。同轮修复：五套主题的代码块标题行对比度过低（约 1.5:1，提高到 3.5–4.3:1）；ASCII 符号模式下主题自带的 Unicode 转圈不再覆盖 ASCII。

## 待决

- ~~是否把 Glide 设为默认界面~~：已定为默认（2026-11-20）。
- 四主题映射。
- 五档思考强度现场展示需要支持可调 thinking level 的模型凭据（本地 `omlx/endless` 不支持）。

## 验证边界

- 启动器测试：`bun test ./scripts` 覆盖 NO_COLOR、退出与 SIGINT 复原、bunfig 隔离。Glide 有 shell／screen provider／布局参数测试。
- 本地 oMLX（`127.0.0.1:8000`）在 Glide 验证时未运行，Glide 下的本地模型流式与工具调用尚未实测。
- 云端调用、MCP／扩展／LSP 真实加载与 fork 全量测试未在本轮重新验证。
- Glide 真实终端截图见 `scripts/glide-spike/shots/`（G2 在 `shots/g2/`，渲染预览在 `shots/g2-preview/`）；本机无真彩终端，真彩场景只有渲染预览；更早轮次的证据、验收记录和样板已清理，可在 git 历史中查阅。

## 安全

见 [安全现状](SECURITY.md)。要点：审批默认 `yolo`；LOCAL 路由只约束聊天模型；凭据沿用 OMP 体系。
