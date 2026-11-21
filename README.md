# Nightglide

Nightglide 是基于 Oh My Pi（OMP）的终端 AI 编程助手。产品只运行在终端中，以保留 OMP 功能为基础，逐步建设飞行与潜水主题、可配置的模型和智能体工作流。

## 仓库结构

| 路径 | 内容 |
|---|---|
| `vendor/omp` | OMP 18.20.2 的 Nightglide fork（子模块，分支 `codex/nightglide`），全部产品代码在这里 |
| `nightglide` | 启动器：执行 fork 源码 CLI，带工作目录保护和外来 bunfig preload 防护 |
| `scripts/install.sh` | 把启动器安装到 `~/.local/bin/nightglide` |
| `scripts/verify-workbench*.ts` | 主题、对比度、视口矩阵与真实 CLI 门禁 |
| `scripts/glide-spike/` | Glide 全屏模式的真实终端测试工具与截图 |
| `docs/` | 产品方向、开发计划、执行规范、现状、审查与证据 |

## 运行

首次获取与构建见 [INSTALL.md](docs/INSTALL.md)。之后在任意项目目录运行：

```bash
./nightglide
```

- **Glide 全屏模式（默认）**：直接运行即进入；`--classic` 单次改用经典模式，设置 `nightglide.layout = classic` 可长期切换；运行中按 `F2` 切换。滚轮、`PgUp`/`PgDn` 回看，`End`、`Enter` 或点击“回看中”标签回到底部；`/copy` 复制对话内容。
- **经典模式**：终端宽度至少 100 列时，`Ctrl+N` 依次切换精简侧栏、详细侧栏和收起；更窄时侧栏自动让位。
- `./nightglide --motion none` 关闭动效。
- **主题**：只内置 Nightglide 的五套主题（飞行 Flight／Cloudlight，潜水 Abyss／Daybreak，以及 Aurora），默认随终端明暗在 Flight 与 Cloudlight 之间自动切换。OMP 原有的 100 多套主题已移除；旧配置里的 `dark`／`light` 会自动对应到 Flight／Cloudlight。

## 测试

```bash
bun test ./scripts
```

`--smoke-test` 门禁会访问本机统计服务；如果 shell 设置了 `http_proxy` 而 `NO_PROXY` 为空，该项会因代理返回 502 而失败。

## 文档

1. [产品与设计规范](docs/PRODUCT_DIRECTION.md)：已确认的产品方向、主题、动效、界面与交互。
2. [开发计划](docs/DEVELOPMENT_PLAN.md)：有依赖顺序的任务、验收条件与待决事项。
3. [工程执行规范](docs/IMPLEMENTATION_RULES.md)：执行、测试与证据要求。
4. [项目现状](docs/CURRENT_STATE.md)：现有实现、验证状态与下一步。
5. [安全现状](docs/SECURITY.md)：当前可确认的审批、路由与凭据事实。
6. [飞行](docs/reference/flight-concept.png) / [潜水](docs/reference/dive-concept.png) 概念图：方向参考，不是实现承诺。

旧 OpenTUI 原型、并行样板和历史规范已于 2026-11-20 删除，需要时可在 git 历史中查阅。

## 许可

OMP 使用 MIT 许可；发布衍生版本时还须保留适用的上游版权、许可及第三方通知，见 [LICENSE_POLICY.md](docs/LICENSE_POLICY.md) 与 `vendor/omp` 中的文件。
