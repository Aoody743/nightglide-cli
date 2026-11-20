# Nightglide 安全现状

本文只记录当前主线（`vendor/omp` fork）可以确认的安全事实，不是安全承诺。旧原型的强制审批、隔离与隐私声明已随原型于 2026-11-20 删除，可在 git 历史中查阅。

## 1. 工具审批（已实测）
- 审批由 OMP 原生引擎执行，模式 `always-ask` / `always-ask-cached` / `write` / `yolo`（`--approval-mode` 或 `tools.approvalMode`）。
- **schema 默认值为 `yolo`**：无任何配置时写入/命令直接放行。TUI 与 headless 皆然。
- TUI 审批对话框有防误触 arm 窗口（挂载后短时间忽略 Enter，防止提交 prompt 的按键误当审批）——已在真实终端验证：`write` 工具经 Approve → 文件真实落盘、内容精确匹配。
- **headless（print/-p）提示**：当生效值为 yolo 且用户没有任何显式审批配置（旗标/env/任意层设置/per-tool 条目）时，stderr 输出一行警告并给出收紧方法；已实测两种路径。
- print 模式在显式 `always-ask` 下：write/bash/edit/eval 全部被拦截并向模型返回明确的"需要审批但无交互 UI"错误（已实测）。是否将 headless 默认改为更严格模式是**未决产品问题**（当前保持上游 yolo 默认 + 警告）。

## 2. 模型路由与隐私（LOCAL 模式已实测）
- `nightglide.routingMode`（默认 `manual` = 不改变任何行为）：`local` 将 10 个会话角色与子智能体 `@role` 解析绑定到本地模型（回环 baseUrl 或已知本地 provider），回退链仅含本地模型；无本地模型时启动快速失败；per-call 云端模型被拒绝。已在真实会话验证主会话与 task 子智能体均落在 `omlx/endless`。
- **保证范围如实限定**：LOCAL 约束覆盖会话与子智能体的聊天模型选择；kind roles（image/web/speech/dictation）、用户显式配置的 vision 角色、以及扩展程序不在覆写范围内。状态栏 `routing` 段只显示真实生效的模式。
- 凭据：全部存于 OMP 原生体系（`~/.omp/agent` 下 models.yml / agent.db）；Nightglide 不读取、不存储、不转存任何 API key。

## 3. 未验证项
- 旧原型文档描述的路径越界校验、凭据脱敏、SSRF/重定向防护等机制**未在新主线上逐项验证**——它们是上游 OMP 的职责边界；对上游安全机制的审计未做。
- 零遥测承诺未对新主线重新验证（上游有 usage attribution 等机制）。


## 4. 对外表述限制

- 用户期望的“高风险操作询问”是未来要求，不是当前默认行为（默认 `yolo`）。
- LOCAL 模式不等于所有联网功能、扩展或本地代理都不外发，不能宣传“绝对不出机”。
- fork 沿用 OMP 的配置、凭据和会话体系，不能宣称与现有 OMP 数据隔离。
