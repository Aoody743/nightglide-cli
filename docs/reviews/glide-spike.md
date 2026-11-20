# Glide 全屏模式验证（2026-11-20）

接 [视觉差距审计](visual-gap-audit.md)。目标：验证在 OMP fork 自带的 pi-tui 引擎上做整窗布局是否可行。结论：**可行**，核心风险项已在 Terminal.app 真机验证。

## 已实现（fork 工作区，未提交）

| 文件 | 内容 |
|---|---|
| `packages/tui/src/tui.ts` | 新增 `setScreenProvider()`：复用全屏 overlay 的 alt-screen 路径，但不算 overlay、不抢焦点，所有快捷键照常；滚轮捕获；光标/IME 归属 |
| `packages/tui/src/components/nightglide-shell.ts` | 整窗布局：顶栏、上下场景带、对话面板（真实 transcript）、信息栏（Model/Effort/Agents/Status，读真实状态）、输入卡片（真实编辑器）、状态行；四主题配色；按终端色彩模式（真彩/256 色）输出 |
| `packages/tui/src/components/nightglide-pixel-scene.ts` | 半块像素场景：`▀` 上下双色，平滑噪声云层/水体、光带、星点、气泡、水草 |
| `packages/coding-agent/src/modes/interactive-mode.ts` | `NIGHTGLIDE_GLIDE=1` 启动即全屏；F2 切换；滚轮/PgUp/PgDn 回看，Enter 回到底部 |
| `packages/tui/src/app-keybindings.ts` | `app.nightglide.glide`（F2） |

测试工具：`scripts/glide-spike/`（真实 Terminal 窗口 + PTY 注入 + 截图），截图在 `scripts/glide-spike/shots/`。

## 已验证（Terminal.app，真实运行）

- 流式回复在面板内显示，CJK、代码高亮正常；信息栏实时显示 Thinking/空闲。
- 滚轮在面板内滚动，不再滚动整个终端；回看时有提示，顶栏/场景/输入不动（用户已确认）。
- 140×40 → 100×30 → 80×24：先收场景，再收信息栏，输入与对话始终可用。
- `/exit` 退出码 0，终端恢复；退出时整段对话写回终端原生 scrollback。SIGTERM 也能干净恢复。
- 类型检查通过；tui 测试 4860 通过，1 个失败（`tools-native-github` run-watch，单独运行通过，与本改动无关）。

## 已知问题 / 未验证

1. **本地模型未运行**：oMLX（`127.0.0.1:8000`）没有在监听，后半段只能用 `--resume` 载入旧会话测试；本地模型的流式与工具调用需在 oMLX 启动后再测。
2. 开启鼠标捕获后，Terminal.app 中选中文字需按住 **Option(⌥) 拖动**；后续要做应用内复制。
3. 回看时有新内容到达，视图会随之漂移（按“距底部行数”记位置），需改为锚定。
4. 输出中的转圈/计时等 transcript 内部动画在全屏下可能不刷新（renderTail 不推进动画帧）——待查。
5. 长会话性能：每帧从尾部重渲染可见区，未做缓存；未压测几百轮的会话。
6. 亮色主题由 macOS 外观自动选择；潜水两套主题和亮色在本轮只看了配色，没有完整走查。
7. Terminal.app 只有 256 色，场景在 iTerm2/Ghostty（真彩）下会更细腻，尚未在这些终端截图。

## 后续计划

按依赖顺序，每步结束都在真实终端截图并和概念图并排对照。

**G1 收尾：把验证版变成可用版**
- 回看锚定（新内容不打乱回看位置）、`End`/点击“回到底部”。
- 修复全屏下 transcript 动画帧推进（转圈、计时）。
- 应用内复制：选中模式或 `/copy` 最近回复。
- 设置项 `nightglide.layout = glide | classic`，默认 glide；`--classic` 命令行开关；F2 保留。
- 测试：screen provider 进出、焦点归属、滚轮路由、resize 的单元测试。
- 提交：先把 fork 与主仓现有改动分批提交到分支（需你确认）。

**G2 场景精修**
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

## 需要你决定

1. 是否把 Glide 设为默认界面（经典 inline 模式保留为选项）。
2. 四主题映射是否按上面的方案。
3. 是否现在把 fork 与主仓的现有改动分批提交到分支。
4. 启动 oMLX 后我再用本地模型补测流式和工具调用。
