# Nightglide

> **"Build beyond the horizon." / "漫翔苍穹，构筑所想。"**

Nightglide is an independent AI-assisted coding CLI crafted for elegance, agency, and creative freedom. Built upon the **Oh My Pi (OMP) SDK** and powered by **OpenTUI**, Nightglide combines deep agentic coding capabilities with a welcoming, cinematic terminal experience for beginners and experienced developers alike.

Nightglide 是一款优雅、灵动且高度可控的独立终端 AI 编程助手（AI Coding CLI）。它基于 **Oh My Pi (OMP) SDK** 并采用 **OpenTUI** 打造极具视觉美感的现代终端界面，旨在让初学者轻松构筑软件，同时为资深工程师提供极致掌控力与深度代理能力。

---

## 🌟 Core Philosophy / 核心理念

1. **Effortless Flight / 灵动无界:** Advanced AI coding without requiring users to memorize complex flags and commands upfront.
2. **Deterministic & Safe / 严格可控与安全沙箱:** Granular tool permissions, explicit approval gates, and prompt-independent safety boundaries.
3. **Local & Cloud Freedom / 本地优先与云端自由:** Seamless support for local inference (oMLX, Ollama, OpenAI-compatible) and cloud providers.
4. **Cinematic Aesthetics / 苍穹美感:** Deep celestial themes (Midnight Flight, Aurora, Cloudlight, Daybreak) designed for long, comfortable coding sessions.

---

## 🏗️ Monorepo Architecture / 仓库架构

```
nightglide/
├── apps/
│   └── cli/                 # Nightglide CLI entrypoint & OpenTUI React interface
├── packages/
│   ├── core/                # Shared contracts, typed event streams, and error classes
│   ├── engine/              # Isolated OMP SDK Adapter & Deterministic Mock Engine
│   ├── config/              # Cross-platform JSON configuration & schema validation
│   └── themes/              # Celestial semantic theme token system & runtime manager
├── tests/
│   ├── engine/              # Engine adapter & mock streaming tests
│   ├── config/              # Configuration validation & schema tests
│   ├── themes/              # Theme contrast & token integrity tests
│   └── integration/         # CLI commands & lifecycle integration tests
└── docs/                    # Complete product specifications, roadmap, and standards
```

---

## 🚀 Getting Started / 快速上手

### Prerequisites / 前置要求

- **macOS** (Apple Silicon recommended) / Linux / Windows
- **Bun 1.4.4+** (`https://bun.sh`)
- Node.js v20+ (optional tooling)

### Installation / 安装依赖

```bash
bun install
```

### Common Commands / 常用命令

| Command / 命令 | Description (EN) | 说明 (中文) |
| :--- | :--- | :--- |
| `bun run dev` | Launch the Nightglide interactive TUI | 启动 Nightglide 交互式终端应用 |
| `bun run demo` | Launch interactive safe UI demonstration | 启动免 API Key 的确定性流式演示模式 |
| `bun run doctor` | Run system, toolchain, and provider diagnostics | 执行环境、上游 SDK 与模型连接诊断 |
| `bun run typecheck` | Run strict TypeScript compiler verification | 执行严格 TypeScript 类型检查 |
| `bun test` | Execute unit and integration tests | 执行单元测试与集成测试套件 |
| `bun run build` | Compile standalone binary distribution | 构建独立分发可执行文件 |

---

## 🎨 Themes / 主题系统

Nightglide comes with four built-in celestial theme presets:
- **Midnight Flight (深空夜翔)** [Dark]: Deep, cinematic celestial night sky (`#090F20`).
- **Aurora (极光变奏)** [Dark]: Dreamlike, vibrant polar atmospheric glow (`#100C25`).
- **Cloudlight (云隙轻光)** [Light]: Soft daylight, clean and welcoming airy sky (`#F8FAFF`).
- **Daybreak (破晓之光)** [Light]: Warm, optimistic morning horizon (`#FFFAF2`).

Switch themes dynamically in the TUI or persist via `~/.config/nightglide/config.json`.

---

## 📚 Documentation / 完整规范文档

- [Product Specification (产品详细规范)](docs/PRODUCT_SPEC.md)
- [Feature Matrix (全量功能特性矩阵)](docs/FEATURE_MATRIX.md)
- [Architecture Design (架构设计文档)](docs/ARCHITECTURE.md)
- [Design System & UI/UX (设计系统规范)](docs/DESIGN_SYSTEM.md)
- [UX Flows (交互流程规范)](docs/UX_FLOWS.md)
- [Engineering Standards (工程开发标准)](docs/ENGINEERING_STANDARDS.md)
- [Security & Isolation Policy (安全与权限防护规范)](docs/SECURITY.md)
- [License & Intellectual Property Policy (开源许可合规政策)](docs/LICENSE_POLICY.md)
- [Upstream Integration Strategy (上游 SDK 集成规范)](docs/UPSTREAM.md)
- [Environment Baseline (环境基线记录)](docs/ENVIRONMENT.md)
- [Development Guide (开发指南)](docs/DEVELOPMENT.md)
- [Milestone Roadmap (里程碑路线图)](docs/ROADMAP.md)

---

## 📄 License & Attribution / 许可证与致谢

- Nightglide is released under the **MIT License**.
- Built with upstream [Oh My Pi (OMP) SDK](https://github.com/can1357/oh-my-pi) (MIT License).
- Rendered with upstream [OpenTUI Core & React](https://github.com/anomalyco/opentui) (MIT License).
