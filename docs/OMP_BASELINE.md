# OMP 基线与迁移说明

## 基线

`vendor/omp` 是完整 OMP 源码的 Git 子模块，来自 `https://github.com/can1357/oh-my-pi.git`，固定于 **v18.20.2**，提交 `7c49c11aa5bbaf3f418406583096168ad5b8c6dc`。选这个版本是为了与旧原型现有的 OMP 依赖一致，便于建立可比基线；这不表示它一定是最新版本。之后升级必须单独验证。

子模块使上游来源和版本可追溯。本机已在子模块中建立 `codex/nightglide` 开发分支（Stage 1 工作：主题、品牌、composer 形状、oMLX 提供商，见 `STAGE_1_VERIFICATION.md`）。2026-11-18 起该分支已推送到私有 fork `https://github.com/Aoody743/nightglide-omp.git`（子模块内 `origin`，上游源另存为 `upstream` remote），主仓库 `.gitmodules` 已指向该 fork；修改 OMP 源码后应推送该分支并更新主仓库子模块引用。

## 开发环境

```sh
git submodule update --init --recursive
cd vendor/omp
bun install --frozen-lockfile
bun run build:native
bun run dev -- --version
bun run dev
```

完整 OMP 源码需要 Bun 及 Rust 工具链。上游 `bun setup` 还会创建全局 `omp` 命令链接；为避免覆盖机器现有的全局命令，上述步骤只准备当前项目。源码安装、原生构建和真实对话的验证状态以执行记录为准；仅检查已安装的 OMP 二进制不代表源码构建已经通过。

## 迁移边界

- `vendor/omp` 是新实现基础；原生交互、工具链、会话管理和上游许可应保留。
- 当前 `apps/cli` 和 `packages` 是旧的独立 SDK 原型，暂时保留供迁移。它的模拟回退和硬编码模型不应移入新主线。
- 旧设计文档和四套主题是视觉输入；旧路线图和审计报告中的“已完成”“完整支持”“已实测”等历史结论不作为当前事实。
- 暂不删除仍被旧原型引用的源代码或依赖。等新主线具备对应功能并通过验证后，再按引用关系清理。
- 旧 `dist` 是可再生的构建产物，可以清理；用户数据、配置、凭据、会话和未确认来源的文件不属于此类。

## 验证记录

- 2026-11-16：上游提交与本项目 `@oh-my-pi/pi-coding-agent` 18.20.2 版本一致；本项目已安装的 OMP CLI `--version` 输出 `omp/18.20.2`。
- 2026-11-16：本机完成 `bun install --frozen-lockfile` 和 `bun run build:native`；源码入口的版本、帮助和 `--smoke-test` 通过。构建警告本机缺少 Swift 6.4+ / macOS 27 SDK，Apple Foundation Models 支持为 stub，未验证该功能。
- 真实模型对话及干净环境重复构建仍需单独验证；不将旧测试或模拟响应作为证明。
- 2026-11-18：Stage 1 全部改动在子模块 `codex/nightglide` 分支落成 5 个提交（`accccd9`…`5ae02bf`），核心回归套件 121 pass / 0 fail（含修正品牌化后的 composer shape preview 测试期望）。
- 2026-11-18：发现子模块原为浅克隆（仅含 v18.20.2 单提交深度，无法推送），已 `git fetch --unshallow upstream` 补全上游历史后推送 `codex/nightglide` 与 `v18.20.2` 标签到私有 fork；`.gitmodules` 同步指向该 fork。
