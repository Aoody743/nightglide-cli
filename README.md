# Nightglide

Nightglide 是一个以完整 Oh My Pi（OMP）为基础的终端编码助手。项目正从原先的独立 OpenTUI 原型迁移到 OMP 原生应用，在保留原生功能的基础上重新设计对话工作台，并逐步实现可信的本地优先与多模型体验。

**当前状态：迁移准备中。** 完整 OMP 源码已固定在 `vendor/omp`；它尚未改造成 Nightglide，原有 `apps/cli` 仍是旧原型。不要将旧原型的演示输出当作真实模型推理，也不要把历史报告中的“已完成”视为当前验收结论。

## 项目入口

- [开发路线图](docs/ROADMAP.md)：重建顺序、交付物和验收条件。
- [体验与视觉方向](docs/NIGHTGLIDE_DIRECTION.md)：新的工作台设计及终端尺寸要求。
- [OMP 基线与迁移说明](docs/OMP_BASELINE.md)：源码版本、启动方法与历史代码处置。
- `vendor/omp`：固定版本的完整上游源码，使用 Git 子模块管理。
- `apps/cli`、`packages`、`tests`：旧原型，暂留作设计资产与迁移参考，不是新主线的能力证明。

## 获取上游源码

克隆本项目后初始化子模块：

```sh
git submodule update --init --recursive
```

OMP 源码开发需要 Bun 工作区依赖和原生组件。安装及开发命令见 [OMP 基线与迁移说明](docs/OMP_BASELINE.md)。请勿使用旧原型的 `bun run dev` 来判断新主线是否完成。

本机完成源码准备后，在项目目录运行 `bun run omp` 可打开 OMP 源码版。它目前仍显示 OMP 原版界面。

## 许可

OMP 以 MIT 许可提供；上游源码和发布物中的第三方组件还包含各自的许可与通知。衍生版本需要保留适用的版权、许可和第三方通知，具体以 `vendor/omp` 中对应文件为准。
