# OMP 基线与迁移说明

## 基线

`vendor/omp` 是完整 OMP 源码的 Git 子模块，来自 `https://github.com/can1357/oh-my-pi.git`，固定于 **v18.20.2**，提交 `7c49c11aa5bbaf3f418406583096168ad5b8c6dc`。选这个版本是为了与旧原型现有的 OMP 依赖一致，便于建立可比基线；这不表示它一定是最新版本。之后升级必须单独验证。

子模块使上游来源和版本可追溯。本机已在子模块中建立 `codex/nightglide` 开发分支。将来修改 OMP 源码后，应在有可用远程仓库时推送该分支，再更新主仓库的子模块引用；仅在本机修改或提交子模块而不发布，其他人无法获取这些改动。新克隆默认检出固定提交，需自行创建或检出对应开发分支。

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
