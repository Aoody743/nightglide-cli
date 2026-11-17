# Nightglide 开发与运行环境规范 (ENVIRONMENT)


> **历史原型记录。** 本文描述已退役的 OpenTUI 原型架构，其中的技术方案、完成度与结论不适用于 OMP 原生新主线；现状以 [新路线图](ROADMAP.md) 与 [验收记录](STAGE_2_3_VERIFICATION.md) 为准。本文仅作设计思想与历史参考。
本文档记录 Nightglide M0 阶段的真实开发与执行环境基线、硬件配置、工具链版本以及本地推理服务检测结果。

---

## 1. 宿主系统与硬件规格

- **操作系统:** macOS 15.7.9 (Build 24G830, Darwin Kernel 24.6.0)
- **系统架构:** `arm64` (Apple Silicon)
- **硬件平台:** Apple M1 Max / 64 GB 统一内存 (Unified Memory)
- **终端环境:** Zsh, 兼容 24 位真彩色 (TrueColor) 与 ANSI 控制序列

---

## 2. 核心运行时与工具链

| 工具 / 运行时 | 实测版本 | 路径 / 来源 | 状态与验证结论 |
| :--- | :--- | :--- | :--- |
| **Bun** | `1.4.4` | `/Users/aoody743/.local/bin/bun` | **已验证**。满足 upstream SDK 及 workspace 官方要求。 |
| **Node.js** | `v24.20.0` | `/Users/aoody743/.local/bin/node` | **已验证**。作为辅助脚本与构建环境。 |
| **npm** | `11.19.0` | `/Users/aoody743/.local/bin/npm` | **已验证**。 |
| **TypeScript** | `^5.8.0` / `5.9.3` | `node_modules/typescript` | **已验证**。采用严格模式 (`strict: true`)。 |
| **Git** | `2.50.1` | `/usr/bin/git` | **已验证**。项目已初始化独立仓库，用户身份已配置。 |

---

## 3. 上游核心依赖环境

| 依赖包名称 | 已安装版本 | 许可协议 | 模块导出与集成能力说明 |
| :--- | :--- | :--- | :--- |
| `@oh-my-pi/pi-coding-agent` | `18.20.2` | MIT | 成功导出 `createAgentSession`, `SessionManager`, `Settings`, `AuthStorage`, `ModelRegistry` 等。经实测隔离会话创建与销毁完全正常。 |
| `@opentui/core` | `0.9.0` | MIT | 成功导出 `createCliRenderer`, `CliRenderer` 等核心终端渲染器。 |
| `@opentui/react` | `0.9.0` | MIT | 成功导出 `createRoot`, `useKeyboard`, `useTerminalDimensions`, `useRenderer` 等，支持 React 19 JSX。 |
| `react` | `19.3.1` | MIT | OpenTUI React 渲染器依赖的底层声明式 UI 树。 |

---

## 4. 本地 AI 推理环境检测

开发机当前运行环境实测结果如下：

1. **oMLX 服务进程:**
   - 进程存在：`omlx-server` (PID 51158)，监听端口 `8000` (`TCP *:8000 (LISTEN)`)。
   - 接口格式：OpenAI 兼容协议接口 (`/v1/models`)。
   - 访问鉴权：经探针检测，当前接口返回 `401 / API key required`，未配置全局公开无凭证访问。
2. **安全隔离准则 (M0):**
   - 遵守工程安全要求，M0 不擅自读取外部应用未授权的 Key，不自动触发未授权的模型付费调用。
   - 提供 Deterministic `MockAgentEngine` 用于无依赖、零成本的安全 UI 演示与单元测试。
   - 提供 `nightglide doctor` 命令行诊断，当未配置有效 Model 时给出清晰友好的引导提示，并将真实 SDK 测试优雅标记为 `SKIPPED`，绝不伪造成功结果。
