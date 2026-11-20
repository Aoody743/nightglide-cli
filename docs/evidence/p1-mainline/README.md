# P1 主线 TUI 真实终端证据（A 面，2026-11-20 纠偏续接轮）

证据级别：**真实终端截图**（macOS Terminal.app 100×30，真实入口 `./nightglide` + 真实本地模型，单窗口纪律）。

- 环境：macOS darwin 24.6.0 arm64，Terminal.app，bun 1.4.4，fork 558af61917（零修改），默认配置模型
- 采集：`do script` PTY 注入（键盘模拟在本会话不可用，PTY 注入为等效通道）+ `screencapture -x -o -l <窗口id>`

## P1.2 状态证据（此前 A 面零截图缺口已补）

| 文件 | 状态 | 要点 |
|---|---|---|
| g3-working.png | 思考中/工作中 | Working… spinner + 流式开头 + 状态行（⏱ 计时 / ⬢ endless / 目录 3.3%/262K） |
| g3-done.png | 普通长对话 | 30 行清单正文完整渲染 |
| g4-tool.png | 工具执行 | `✓ Read /tmp/ng-g4.txt` 工具卡 + 精确回复 nightglide-g4 |
| g5-approval.png | 审批 | 橙色 "Allow tool: write" 对话框（Approve/Approve session/Deny + 键位提示） |
| g5-deny-*.png | 审批拒绝链 | ESC 进入 type-to-deny 子态（真实 UI 语义，与文档记载不同）→ 键入拒绝语 → 红色 ✗ 卡 "Tool call denied by user"；**/tmp/ng-g5.txt 确认未创建** |
| g6-error.png / g6-done-bonus.png | 错误 | 红色错误工具卡（不存在的文件）+ 模型继续处理 |

## P1.3 强度阶梯证据

| 文件 | 内容 |
|---|---|
| p13-effort-unavailable-endless.png | **核心阻塞实证**：`omlx/endless has no adjustable thinking level` |
| p13-switch-luna.png 等 9 张 | 逐一探测 8 个可用模型——全部 "no adjustable thinking level"（models.db 元数据 with_efforts=0） |
| p13-midstream-done-bonus.png（流式中注入后完成态）/ p13-switch-midstream.png（注入瞬间） | **流式中注入 /effort 不干扰流式**（清单 15/40 生成中，⏱ Working… 计时不中断；随后流到 40/40） |
| p13-motion-none-effort.png | `--motion none` 会话正常（rung 缺失=模型无 effort，同 B 组根因，非动效问题） |

## 阻塞与未验证（如实）

- **五档 glyph（·◦○◎✦）现场取证阻塞**：本环境所有可用模型均无可调节 thinking level（需具备 reasoning 元数据的模型/凭据）。fork 的 ladder 逻辑由 4 个单测文件覆盖（effort-ladder.test.ts / status-line-effort-glyph.test.ts / thinking-pulse-effort.test.ts / task-effort-badge.test.ts），显示链代码确认存在——"有实现、无现场模型可展示"
- 厂商可辨识图形未实现（状态行仅通用图标）
- 模型切换同步已探测（/switch 打开 33 模型选择器、切换成功截图），未做专项前后对比截图
- 有限色（TERM=xterm-16color）主线截图未采集

## 纠偏第四轮追加（主题×状态矩阵扩展 + 粘贴/焦点/回看 + 模型切换同步）

| 文件 | 内容 |
|---|---|
| ml2-abyss-working / ml2-abyss-tool | 潜水暗主题 × 工作中（流式 01-15）+ 工具卡 ✓ Read |
| ml2-aurora-working / ml2-aurora-tool | 极光暗主题（紫 accent，与 abyss 明显区分）× 同上 |
| ml2-cloudlight-READABILITY-LIMITED | 亮主题可读性受限实证：主题生效（accent 像素=cloudlight 蓝自适应亮化）但浅底未呈现（inline 空白背景=终端深色配置）——**需浅色终端配置**，本机无 |
| ml2-16color-working / ml2-16color-done | **有限色 TERM=xterm-16color**：flight 主题自带 16 色降级调色板渲染正常无乱码（仅计时器 glyph 点状变体） |
| ml2-switch-picker / ml2-switch-before / ml2-switch-after / ml2-switch-back | **模型切换同步**：/switch 33 模型选择器→切 codexplus/glm-5.3→状态行 ● glm-5.3 + 上下文 262K→1M + header 同步→切回 ● endless + 262K（session-only，无 API 调用） |
| scrollback-review.png | **长内容回看视觉证据**：窗口 30→55 行后 01: ok…40: ok 全部 40 行可见（01-15 自原生 scrollback 重现），TUI 视口锚定底部 |
| scrollback-back-bottom.png | 恢复 30 行后回底 |

**缺陷如实记录**：shift+pageup 系统级不可用（激活节流+frontmost 被占，6+ 次尝试画面不变）——回看视觉证据改用 resize-reveal 等效法取得；mainline 截图的 100×30 尺寸声明**无 stty 日志/标题栏双证**（workbench 有、mainline 无），静态不可复核，已如实标注。

## 纠偏第五轮：主题×状态矩阵扩展 + 模型切换同步（ml2 系列）

| 文件 | 内容 |
|---|---|
| ml2-abyss-working / ml2-abyss-tool | 潜水暗 × 工作中（流式 01-15）+ 工具卡 |
| ml2-aurora-working / ml2-aurora-tool | 极光暗（紫 accent）× 同上 |
| ml2-cloudlight-READABILITY-LIMITED | 亮主题可读性受限（需浅色终端配置，本机无） |
| ml2-16color-working / ml2-16color-done | 有限色 TERM=xterm-16color（主题自带 16 色降级调色板，正常无乱码） |
| ml2-switch-picker / before / after / back | 模型切换同步：/switch → glm-5.3 → 状态行+上下文 262K→1M 同步 → 切回（session-only） |
