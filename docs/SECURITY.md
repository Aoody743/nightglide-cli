# Nightglide 安全现状

本文只记录当前主线（`vendor/omp` fork）可以确认的安全事实，不是安全承诺。旧原型的强制审批、隔离与隐私声明已随原型于 2026-11-20 删除，可在 git 历史中查阅。

## 1. 工具审批（已实测）
- 审批由 OMP 原生引擎执行，模式 `always-ask` / `always-ask-cached` / `write` / `yolo`（`--approval-mode` 或 `tools.approvalMode`）。
- **默认值为 `write`（高风险询问，2026-11-24 起）**：读、写自动执行；命令（bash、`eval`）、`task`、危险命令要询问；没有界面时这些调用被拒绝。上游 OMP 默认是 `yolo`。
- **`~/.omp` 默认受限**（`tools.restrictedFolders: ["~/.omp"]`）：任何档位下对它的操作都每次询问、不能记住，防止智能体改自己的配置提权。
- **项目配置不能放宽审批**：`<项目>/.omp/config.yml` 里的 `tools.approvalMode`、`tools.approval`、`tools.restrictedFolders` 只能收紧。
- **`yolo` 下危险命令也不询问**（OMP 设计，上游 v19.1.1 相同；2026-11-23 已用代码调用验证）：bash 的危险命令判定（`rm -rf /`、`sudo rm`、`curl … | sh`、`mkfs` 等）在 `always-ask`／`write` 下每次询问，在 `yolo` 下直接放行。
- **子智能体以 `yolo` 运行**（OMP 设计）：父会话批准 `task` 即为授权边界。
- 详见 [P3.3 审批策略](reviews/p3.3-approval-policy.md)。
- TUI 审批对话框有防误触 arm 窗口（挂载后短时间忽略 Enter，防止提交 prompt 的按键误当审批），G3 已完成中英双语化并修复 `[y]`/`[s]`/`[n]` 快捷键冲突，已在单测与真实终端验证。
- `/summary` 任务总结优先离线展示脱敏本地事实总结，并明确提示即将发送的消息条数、字符估算与潜在费用；仅在用户主动按键触发时调用模型，不自动发起调用、不修改会话历史、并过滤凭据。
- **headless（print/-p、RPC、ACP）**：需要询问的调用直接拒绝，并向模型返回“需要审批但无交互 UI”的错误（2026-11-24 用本地模型实测）。要全自动运行，需传 `--auto-approve` 或 `--approval-mode yolo`。原先的 headless `yolo` 警告已删除。

## 2. 模型路由与隐私（LOCAL 模式已实测）
- `nightglide.routingMode`（默认 `manual` = 不改变任何行为）：`local` 将 10 个会话角色与子智能体 `@role` 解析绑定到本地模型（回环 baseUrl 或已知本地 provider），回退链仅含本地模型；无本地模型时启动快速失败；per-call 云端模型被拒绝。已在真实会话验证主会话与 task 子智能体均落在 `omlx/endless`。
- **保证范围如实限定**：LOCAL 约束覆盖会话与子智能体的聊天模型选择；kind roles（image/web/speech/dictation）、用户显式配置的 vision 角色、以及扩展程序不在覆写范围内。状态栏 `routing` 段只显示真实生效的模式。
- 凭据：全部存于 OMP 原生体系（`~/.omp/agent` 下 models.yml / agent.db）；Nightglide 不读取、不存储、不转存任何 API key。

## 3. 未验证项
- 旧原型文档描述的路径越界校验、凭据脱敏、SSRF/重定向防护等机制**未在新主线上逐项验证**——它们是上游 OMP 的职责边界；对上游安全机制的审计未做。
- 零遥测承诺未对新主线重新验证（上游有 usage attribution 等机制）。


## 4. 对外表述限制

- “高风险询问”是按规则判断，不是沙箱：工作区外的写入（`~/.omp` 除外）、MCP 工具、联网读取仍自动执行。
- LOCAL 模式不等于所有联网功能、扩展或本地代理都不外发，不能宣传“绝对不出机”。
- fork 沿用 OMP 的配置、凭据和会话体系，不能宣称与现有 OMP 数据隔离。
