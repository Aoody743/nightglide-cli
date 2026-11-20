# Nightglide 获取、构建、安装与验证 (INSTALL)

> **"Build beyond the horizon." / "漫翔苍穹，构筑所想。"**

Nightglide CLI 直接以源码方式运行 vendored OMP fork（`vendor/omp` 子模块），并叠加 Nightglide 品牌、路由与主题定制。

---

## 1. 前置条件

| 依赖 | 要求 | 说明 |
| :--- | :--- | :--- |
| [Bun](https://bun.sh) | **>= 1.4.4**（强制） | 运行时与包管理；上游 `packageManager: bun@>=1.4.4` |
| Git | 2.40+ | 含 submodule 支持 |
| Rust 工具链（cargo） | 上游默认后端所需 | 仅在构建/重建原生插件 `pi_natives` 时需要；改 Rust crates 或换平台后需重跑 |

> 本仓库当前验证环境：macOS arm64 + Bun，原生产物 `packages/natives/native/pi_natives.darwin-arm64.node` 已构建。

## 2. 获取源码

```bash
git clone <主仓库地址> "Nightglide CLI"
cd "Nightglide CLI"

# 拉起 vendored OMP 子模块（指向 nightglide-omp fork，见 .gitmodules）
git submodule update --init vendor/omp
```

`vendor/omp` 是上游 [oh-my-pi](https://github.com/can1357/oh-my-pi) 的 Nightglide fork，包含 Nightglide 品牌化（`nightglide` bin、nightglide-* 主题、nightglide-routing 等）。

## 3. 安装依赖与构建原生插件

```bash
cd vendor/omp
bun install          # 安装 Bun 工作区依赖
bun run build:native # 构建 pi_natives 原生插件（默认 Cargo/N-API 后端）
```

- 原生产物落在 `packages/natives/native/pi_natives.<platform>.node`（如 `pi_natives.darwin-arm64.node`）。
- 修改了 Rust crates 或更换了平台后需重跑 `bun run build:native`。
- 一步到位替代：上游提供 `bun setup`（= install → natives 构建 → 全局链接 `omp`），但其"链接全局 omp"一步面向上游开发流，Nightglide 不依赖它；Nightglide 使用下一节的 `scripts/install.sh`。

## 4. 安装（scripts/install.sh）

```bash
# 在主仓库根目录执行；默认安装到 ~/.local/bin/nightglide
bash scripts/install.sh

# 或自定义前缀
bash scripts/install.sh --prefix /usr/local
```

行为说明：

- 安装内容 = 一个 sh launcher（`<prefix>/bin/nightglide`），语义与仓库根目录 `./nightglide` wrapper 等价：设置 `PI_RAW_BIN=nightglide`、`OMP_APP_NAME=nightglide`，然后把真实 cwd 存入 `OMP_LAUNCH_CWD`、cd 到 bunfig-free 目录（`~/.omp/.dev-cwd`）后 `bun --preload <repo>/vendor/omp/packages/coding-agent/scripts/omp.ts <repo>/vendor/omp/packages/coding-agent/src/cli.ts "$@"`（仓库绝对路径在安装时固化）。
- **绝不创建或修改任何 `omp` 命令**——已存在的全局 `omp` 不受影响。
- 幂等：重复执行会重新生成同一 launcher；若目标位置已存在**非本脚本生成**的文件则拒绝覆盖（失败即停，`set -euo pipefail`）。
- 前置校验：bun 在 PATH、`vendor/omp` 子模块已初始化、`vendor/omp/node_modules` 已安装、`pi_natives` 原生插件已按当前平台构建——任一不满足即报错并给出补救命令。

验证安装：

```bash
nightglide --version   # 预期输出: nightglide/18.20.2
```

## 5. 冒烟验证

```bash
# 1. 版本与帮助
nightglide --version
nightglide --help

# 2. 上游自带冒烟套件（可选，在 vendor/omp 内）
cd vendor/omp && bun run ci:test:smoke
# = cli.ts --version / --help / stats --help / --smoke-test
```

launcher 语义（2026-11-18 已修复）：根 wrapper 与本 launcher 均采用上游 `packages/coding-agent/scripts/omp` 的机制——`OMP_LAUNCH_CWD` 记录用户真实目录、cd 到 bunfig-free 目录启动、`omp.ts` preload shim 在 import 前恢复 cwd。此前 `bun --cwd` 方式会把进程 cwd 固定在 vendored 源码目录，导致 `getProjectDir()`（`packages/utils/src/dirs.ts:234` 起）把项目解析到 vendor/omp 而非用户所在目录（已实测复现并修复：会话目录名以启动目录命名）。

## 6. 上游官方分发方式（记录）

上游 OMP 的分发面（供对照，Nightglide 当前不使用）：

1. **预编译二进制脚本安装**：`curl -fsSL https://omp.sh/install | sh`（从 `build.stencil.so` 拉取二进制并校验 SHA-256；`--source` 改为 bun 安装）；Windows 为 `irm https://omp.sh/install.ps1 | iex`。二进制由 `bun scripts/ci-release-build-binaries.ts`（`bun --compile`，目标 darwin-arm64/x64、linux-x64/arm64/musl 等）产出。
2. **npm 包**：`bun install -g @oh-my-pi/pi-coding-agent`（bin: `omp` / `ng` / `nightglide`；`files` 携带 `src`、`dist/cli.js`、`dist/*.node`（编译好的原生插件）与 `dist/*.json-*.zst` 数据文件），发布走 `npm publish -ws --access public`。
3. **Homebrew**：`brew install can1357/tap/omp`；**Nix flake**：`packages.<system>.omp` 等。
4. **源码开发模式**：`bun setup`（见第 3 节），或直接 `bun --cwd=packages/coding-agent src/cli.ts`。

## 7. 开放项：单文件二进制打包（未验证）

**状态：未验证，本文不宣称可用。**

上游具备 `bun --compile` 单文件二进制流水线（`packages/coding-agent/scripts/build-binary.ts` → `compile-binary.ts`，经 `COMPILED_EXTERNAL_DEPENDENCIES` 与 `natives/scripts/embed-native.ts` 把 `pi_natives` 的 `.node` 原生库与 `.json-*.zst` 数据文件嵌入二进制；Release 产物在 `packages/coding-agent/binaries/omp-*`）。未在 Nightglide fork 上验证的原因：

- `.node` 原生插件的嵌入与运行期解包路径依赖上游 release 工具链的组合（bazel/cargo 产物命名、embed-native 目标表、`getPackageDir()` 在 compiled 模式下的回退逻辑，见 `extensibility/legacy-pi-coding-agent-shim.ts` 中 issue #1423 的处理），需要针对 fork 完整跑一遍 `bun run build` + 各平台目标才能确认。
- fork 的 `nightglide` bin 命名与品牌化 env 尚未在 compiled 模式下验证（上游二进制以 `omp` 身份自检）。
- 若后续启用，需补充：fork 的 release 构建脚本入口、SHA-256 校验、以及 `nightglide --smoke-test` 在 compiled 模式下的验收。

在此之前，Nightglide 的官方安装形态是本文第 4 节的**源码模式 launcher**。
