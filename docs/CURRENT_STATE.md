# Nightglide 项目现状

更新时间：2026-11-20。本文是工作区快照，不是完整功能或安全审计；代码变化后须同步更新。

## 结构

仓库已精简为单一主线：`vendor/omp`（OMP v18.20.2 基线 `7c49c11aa5bbaf3f418406583096168ad5b8c6dc` 的 fork，分支 `codex/nightglide`）+ 根目录启动器、安装脚本和门禁。旧 OpenTUI 原型（`apps/cli`、`packages`、`tests`）、两条 P1 并行样板（`scripts/p1-prototype`、`scripts/p1-zcode`）、协作日志和标为历史的规范文档已于 2026-11-20 删除，可在 git 历史中查阅。`./nightglide` 不再有 `--legacy` 入口。

## 界面

**Glide 全屏模式（验证版，`NIGHTGLIDE_GLIDE=1` 或 F2）**：在 alt-screen 中自管整窗布局——顶栏、上下像素场景带、对话面板（应用内滚动）、信息栏（模型／强度／子智能体／状态，读真实数据）、输入卡片、状态行。已在 Terminal.app 实测流式回复、面板内滚轮回看、140×40→80×24 缩放降级、`/exit` 与 SIGTERM 干净恢复（退出时对话写回原生 scrollback）。选择它的原因见 [视觉差距审计](reviews/visual-gap-audit.md)，细节与已知问题见 [Glide 验证记录](reviews/glide-spike.md)。

**经典 inline 模式**：底部 3 行场景带 + 正文旁分栏侧栏（`Ctrl+N` 循环精简／详细／收起，窄于 100 列自动让位），保留终端原生 scrollback。

## 下一步（G1–G6，详见 glide-spike.md）

1. **G1 收尾**：回看锚定、全屏下 transcript 动画帧推进、应用内复制、`nightglide.layout = glide | classic` 设置与 `--classic`、screen provider 单元测试。
2. **G2 场景精修**：视差云层、潜水光柱水草气泡、思考强度联动、真彩终端调参。
3. **G3 内容卡片**：用户消息卡、回复标题、工具 chip、diff 卡片、审批框统一。
4. **G4 机器人与信息栏**：像素机器人三态、强度彩条、子智能体实时状态、任务总结入口。
5. **G5 四主题定稿**：映射待定（flight / cloudlight / abyss / daybreak，aurora 额外保留），亮暗截图矩阵。
6. **G6 稳定性**：长会话性能、tmux、中文输入法候选框位置。

## 待决

- 是否把 Glide 设为默认界面（经典模式保留为选项）。
- 四主题映射。
- 五档思考强度现场展示需要支持可调 thinking level 的模型凭据（本地 `omlx/endless` 不支持）。

## 验证边界

- 门禁：`bun test ./scripts` 70 pass / 0 fail（需去掉代理变量，见 README）；fork 场景／侧栏／输入器测试 48 pass。
- 本地 oMLX（`127.0.0.1:8000`）在 Glide 验证时未运行，Glide 下的本地模型流式与工具调用尚未实测。
- 云端调用、MCP／扩展／LSP 真实加载与 fork 全量测试未在本轮重新验证。[历史验收记录](STAGE_2_3_VERIFICATION.md) 只代表当时的提交与环境。
- 主线截图证据见 `docs/evidence/p1-mainline/`。

## 安全

见 [安全现状](SECURITY.md)。要点：审批默认 `yolo`；LOCAL 路由只约束聊天模型；凭据沿用 OMP 体系。
