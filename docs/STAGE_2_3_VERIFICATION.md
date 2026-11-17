# Nightglide Stage 0（补充）/ 2 / 3 验收记录

**验收日期**：2026-11-18（自主开发迭代，subagent 并行实现 + 主会话审查）
**代码基线**：`vendor/omp` 子模块 `codex/nightglide` 分支，`v18.20.2` + Stage 1（`accccd9…5ae02bf`）+ Stage 2（`da9728e…b16f0c7`）+ Stage 3（`660b741…8e768d4`）
**验证环境**：macOS 15.7.9 arm64，Bun 1.4.4，nightly Rust，本地 oMLX（127.0.0.1:8000，模型 `endless`）

---

## 一、Stage 0 补充验证（基线）

### 1. 干净环境重复构建 ✅
从私有 fork 全新克隆 `/tmp/ng-clean-clone`（保留供复用）：

| 步骤 | 结果 |
|---|---|
| `git clone` + `git submodule update --init --recursive` | 成功（55s），子模块检出 `5ae02bf`，`.gitmodules` 指向私有 fork，gh 认证可用 |
| `bun install --frozen-lockfile` | 成功（991ms，298 包，零警告） |
| `bun run build:native` | 成功（504s，0 错误，仅预期的 Swift 6.4+/macOS 27 SDK stub 警告） |
| 入口验证 | `bun run dev -- --version` / 根目录 `bun run omp --version` / `bun run ng --version` 全部输出 `nightglide/18.20.2`；`--smoke-test` ok |
| 快速测试子集 | composer-shape-preview 4 pass / 0 fail |

结论：**干净克隆 → 可构建 → 入口可用全链路成立**。注意版本横幅为品牌化后的 `nightglide/18.20.2`（OMP_BASELINE 旧记录 `omp/18.20.2` 是品牌化前所写）。

### 2. 真实模型端到端 ✅（本地链路）
提供商凭据来自用户既有 OMP 原生配置（`~/.omp/agent/models.yml`），全程未打印任何 key。

| 项 | 结果 | 证据 |
|---|---|---|
| 单轮对话 | ✅ | `omlx/endless` 真实回复，token 统计完整，cost $0 |
| 多轮会话 | ✅ | `-c` 续接后模型精确复述第一轮植入的代号；session JSONL 落盘 |
| 工具调用 | ✅ | read（指出测试文件里 "3 items" 与实际 2 项不符——真实读取的强证据）、write、bash 自验证 |
| 长内容 | ✅ | 411 行输出（69 个 interface），完整闭合无截断 |
| 流式 | ✅ | `--mode json` 事件级验证：thinking_delta×7 → text_delta×8 渐进到达（非整块输出）；json 带 ttft/duration |
| 品牌入口 | ✅ | `ng` 与 `omp` 行为一致（Stage 1 已把默认名改为 nightglide，`PI_RAW_BIN` 实际冗余但无害） |
| oMLX 注册冲突 | ✅ 无冲突 | 用户 models.yml 已有 omlx 时与 Stage 1 动态探测并存归一，`omp models` 单一 omlx section |
| 审批机制 | ✅ | print + `--approval-mode always-ask`：write/bash/edit/eval 全部拦截并返回明确错误，文件未被修改 |
| 云端 anthropic-messages 网关 | ❌ 外部限制 | 网关按客户端白名单（仅允许 Claude Code/Desktop）拦截 `GET /v1/models` 与 `POST /v1/messages`（直接 curl 亦 403）。**未尝试任何客户端伪装绕过**——这是第三方服务访问策略问题，需用户自行决策（网关侧放行，或更换端点） |
| 本地网关 57321 | ✅ | `codexplus/gpt-6.1-terra` 回复 OK，cost $0.006；⚠️ TTFT ~79s（外部服务质量） |
| TUI 交互 | ✅ 部分 | expect 驱动真实 pty：品牌标出现 ✅、审批对话框出现 ✅、防误触 arm 窗口后 Enter 批准 → `write` 真实执行、文件落盘内容精确匹配 ✅、`/exit` 干净退出 ✅；**取消（Esc）自动化检测不确定**、滚动/resize 未测，需人工确认 |

集成注意：程序化 spawn OMP 时必须立即 close 子进程 stdin（EOF），否则 print 模式在 `readPipedInput` 永久阻塞。

---

## 二、Stage 2 主题 ✅

**交付**：`nightglide-aurora`（暗，紫罗兰/青绿，Aurora Ripple 帧）、`nightglide-cloudlight`（浅，冷蓝，Cloud Drift 帧）、`nightglide-daybreak`（浅，陶土红/晨青，Dawn Bloom 帧）三套完整 66 槽主题 + welcome 微光轨迹浅色适配 + `theme.light` 默认改为 `nightglide-cloudlight`。

**验证**：
- 结构校验（一次性脚本，未入仓库）：3 主题 × 9 类检查共 45 项全过（66 必填槽、luma 分类、vars 无循环、帧等宽、terminal.ansi 16 项、createTheme 构造）。
- 对比度（WCAG，bg / statusLineBg）：Cloudlight text 11.85/10.53、accent 6.28/5.58、success 5.20/4.62、warning 6.31/5.61、error 6.20/5.50；Daybreak text 10.19/8.73、accent 5.66/4.85、success 6.20/5.31、warning 6.65/5.70、error 6.23/5.34；dim 加深至 3.47/3.55 达标。Aurora text 16.85、accent 9.74。
- 渲染快照：`scripts/verify-workbench.ts` 扩展至五主题 × 3 尺寸 × 3 状态 = **45 张快照全过**（EXIT 0）。
- 独立复跑（主会话）：9 个主题相关测试文件 **49 pass / 0 fail**；loader 实载三主题 isLight 分类正确。
- 既有套件基线：tui 全量 4,663 用例中 9 个失败均为既有问题（8 个 notify 测试品牌漂移**已修复**（`8e768d4`），1 个偶发）。
- typecheck：tui 1,448 文件 + coding-agent 4,975 文件 0 错误。
- 主题切换不丢状态：代码审读（previewTheme/setTheme 仅换渲染实例 + epoch）+ 既有 `theme-epoch-fallback`/`theme-islight` 测试覆盖。
- 降级：256 色量化实测正确（aurora accent→183、cloudlight→25、daybreak→131）；NO_COLOR/16 色为代码推论（chalk level=0 路径），物理 VT100 未测。

**未验证**：真机终端的最终观感（仅渲染器 + 数学验证）；CJK ambiguous-width 终端下 `✦≈░◎` 可能按 2 格渲染（帧内字符同类、无 W/F 宽字，与既有主题同一假设）。

---

## 三、Stage 3 路由 ✅（LOCAL 真实验证，BALANCED/PERFORMANCE 单测覆盖）

**交付**：`nightglide.routingMode`（`manual` 默认 = 完全 no-op）+ `nightglide.localModel`（显式本地模型）；LOCAL/BALANCED/PERFORMANCE 三模式经 `overrideModelRoles` + `installRetryFallbackRole` 在会话层生效（不落盘）；子智能体 `@role` 经 model-resolver 自动传播（测试证实，executor 零改动）；LOCAL 下 per-call 云端模型拒绝（`invalidModelSelectorReason`）；status line 新增回退指示（serving 模型 ≠ 主选时 ` ↩ <model>` + 链路说明）与可选 `routing` 段（只显示真实生效模式，manual 不渲染，未进默认 preset）；print 模式 yolo 默认 stderr 警告。

**验证**：
- 新测试 29 个（routing 23 + status line 6）全过；独立复跑确认。
- 定向回归：retry-fallback、resume-model-fallback、session/approval/flags、fallback/model/settings/task/print 共 500+ 用例 0 失败。
- typecheck：coding-agent + tui 0 错误；oxlint 0 警告。
- **真实路由主会话**：沙箱项目层 `.omp/config.yml` 设 `routingMode: local` → 真实会话落 `omlx/endless`（用户全局默认为云端 `codexplus/gpt-6.1-terra`，路由覆写真实生效）。
- **真实路由子智能体**：同配置下让模型经 task 工具 spawn 子智能体 → transcript 全程仅 `omlx/endless`（task 工具真实执行）。
- **LOCAL 快速失败**：`localModel: "omlx/nonexistent-model"` → 启动即抛错，消息含 `nightglide.routingMode=local` + 原因 + 两种补救建议。
- **headless yolo 警告**：无任何审批配置时 stderr 警告出现；带 `--approval-mode always-ask` 时不出现（实测）。
- 已知行为（如实记录）：LOCAL 的启动期快速失败只在冷缓存或显式 localModel 不匹配时触发；发现缓存为热时绑定缓存端点，端点实际不可用则在首次请求时可见失败（符合 OMP 发现哲学，不在每次启动 ping）。

---

## 四、剩余清单（按优先级）

1. **真实云端跨模型验证**：被 claude-proxy 网关客户端白名单阻塞（外部服务策略）。需要用户决策：网关侧放行 / 更换端点 / 显式 models 列表 + 客户端头（涉及第三方访问策略，项目侧不擅自绕过）。
2. **BALANCED/PERFORMANCE 真实双模型会话**：单测已覆盖语义；真实跑需云端可用（同阻塞 1）+ codexplus TTFT 排查。
3. **交互 TUI 人工确认**：取消（Esc）自动化检测不确定；滚动、resize、`/models` 视图、diff 展开待人工过一遍（expect 脚本 `/tmp/ng-tui-verify.exp`、`/tmp/ng-tui-cancel.exp` 可复用）。
4. **MCP / 扩展 / LSP / 计划模式**：未验证（Stage 0 清单剩余项）。
5. **Stage 4**：旧原型清理（引用检查后）、diffParser 等资产摘取（见 M2_WORKTREE_INVENTORY.md）、打包与发布准备。
6. **设计债务**：顶部安静导航线（NIGHTGLIDE_DIRECTION.md 构图）未实现；welcome 为块状品牌标。
7. **物理 VT100/无色终端**：未测（16 色/NO_COLOR 为代码推论）。
8. **print 默认审批模式**：是否从 yolo 改为更严格默认 = 未决产品问题（当前：上游默认 + stderr 警告 + 文档）。
