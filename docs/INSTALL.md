# Nightglide CLI 安装、构建、终端配置与验证指南 (INSTALL)

> **"Build beyond the horizon." / "漫翔苍穹，构筑所想。"**

本文覆盖 **Nightglide CLI v1.0.0** 的全部安装方式（Homebrew、APT / `.deb`、预编译二进制、源码构建与 `scripts/install.sh`）、推荐终端与 IDE 字体配置，以及安装后冒烟验证。

Nightglide 沿用 `~/.omp` 数据目录（配置、模型凭据与历史会话完全兼容），并且**绝不创建、覆盖或修改任何全局 `omp` 命令**。

---

## 1. 一键包管理器与预编译安装 (v1.0.0)

### 1.1 macOS / Linux via Homebrew

```bash
brew tap Aoody743/nightglide
brew install nightglide
```

或者直接用单行命令安装：

```bash
brew install Aoody743/nightglide/nightglide
```

验证：

```bash
nightglide --version   # 预期输出: nightglide/1.0.0
```

### 1.2 Debian / Ubuntu via APT

**方式 A：通过 GitHub Pages APT 仓库安装（便于 `apt upgrade` 更新）**

```bash
echo "deb [trusted=yes] https://aoody743.github.io/nightglide-cli/apt stable main" | sudo tee /etc/apt/sources.list.d/nightglide.list
sudo apt update && sudo apt install nightglide
```

**方式 B：直接安装 GitHub Releases 提供的 `.deb` 包**

```bash
# x86_64 (amd64)
sudo apt install ./nightglide_1.0.0_amd64.deb

# ARM64 (arm64)
sudo apt install ./nightglide_1.0.0_arm64.deb
```

### 1.3 独立预编译包 (GitHub Releases)

从 GitHub Releases 下载对应平台（`darwin-arm64`、`darwin-x64`、`linux-x64`、`linux-arm64` 等）的 `v1.0.0` 归档包与校验文件：

```bash
tar -xzf nightglide-v1.0.0-<platform>.tar.gz
install -m 0755 nightglide ~/.local/bin/nightglide
nightglide --version   # 预期输出: nightglide/1.0.0
```

---

## 2. 源码模式构建与安装 (`./nightglide` / `scripts/install.sh`)

Nightglide 主仓库通过 Git 子模块 `vendor/omp` 跟踪 vendored OMP fork（分支 `codex/nightglide`），并以源码方式直接运行或通过 `scripts/install.sh` 生成本地启动器。

### 2.1 前置条件

| 依赖 | 要求 | 说明 |
| :--- | :--- | :--- |
| [Bun](https://bun.sh) | **>= 1.4.4**（强制） | 运行时与包管理；`vendor/omp` `packageManager` 要求 `bun@>=1.4.4` |
| Git | 2.40+ | 含 submodule 支持 |
| Rust 工具链（cargo） | 上游默认后端所需 | 仅在构建/重建原生插件 `pi_natives` 时需要；改 Rust crates 或换平台后需重跑 |

### 2.2 获取源码

```bash
git clone https://github.com/Aoody743/nightglide-cli.git "Nightglide CLI"
cd "Nightglide CLI"

# 拉起 vendored OMP 子模块（指向 nightglide-omp fork，见 .gitmodules）
git submodule update --init vendor/omp
```

### 2.3 安装依赖与构建原生插件

```bash
cd vendor/omp
bun install          # 安装 Bun 工作区依赖
bun run build:native # 构建 pi_natives 原生插件（默认 Cargo/N-API 后端）
```

- 原生产物落在 `packages/natives/native/pi_natives.<platform>.node`（如 `pi_natives.darwin-arm64.node`、`pi_natives.linux-x64.node`）。
- 修改了 Rust crates 或更换了平台后需重跑 `bun run build:native`。
- 上游自带的 `bun setup` 会全局链接 `omp` 命令；Nightglide 不使用它，而是使用下一节的 `scripts/install.sh`。

### 2.4 安装源码启动器 (`scripts/install.sh`)

```bash
# 在主仓库根目录执行；默认安装到 ~/.local/bin/nightglide
bash scripts/install.sh

# 或自定义前缀
bash scripts/install.sh --prefix /usr/local
```

行为说明：

- 安装内容为一份 sh launcher（`<prefix>/bin/nightglide`），语义与仓库根目录 `./nightglide` 等价：设置 `PI_RAW_BIN=nightglide`、`OMP_APP_NAME=nightglide`，将真实目录存入 `OMP_LAUNCH_CWD`，切换到无 `bunfig.toml` 的目录（`~/.omp/.dev-cwd`）后再运行 `bun --preload <repo>/vendor/omp/packages/coding-agent/scripts/omp.ts <repo>/vendor/omp/packages/coding-agent/src/cli.ts "$@"`。
- **绝不创建或修改任何 `omp` 命令**——已存在的全局 `omp` 不受影响。
- **回环代理豁免**：根启动器 `./nightglide` 会将 `127.0.0.1,localhost,::1` 追加到 `NO_PROXY`/`no_proxy`（保留用户已有配置），避免系统代理劫持 oMLX、Ollama、LM Studio 等本地模型端点。
- **幂等且安全**：重复执行会更新脚本自身生成的 launcher；若目标路径存在非本脚本生成的文件则拒绝覆盖。
- **前置校验**：要求 `bun` 在 `PATH` 中、`vendor/omp` 已初始化、`vendor/omp/node_modules` 存在、且当前平台的 `pi_natives.<platform>.node` 已构建。

验证：

```bash
nightglide --version   # 预期输出: nightglide/1.0.0
```

---

## 3. 推荐终端、IDE 与字体配置 (Terminals, IDEs & Fonts)

Nightglide 顶部与底部场景带、像素伙伴和边框使用 **24-bit Truecolor** 与半格方块字符（`▀`）。终端程序无法由 CLI 自选字体，字形与抗锯齿由宿主的终端或 IDE 描述文件决定。

### 3.1 顶级真彩半块终端 (`cellPixels=2`)

以下终端均原生自绘方块字符（`▀` 上下两像素无接缝）并支持 24-bit Truecolor，推荐优先使用：

- **Ghostty（首选）**：
  ```bash
  brew install --cask ghostty
  ```
  在 `~/.config/ghostty/config` 中配置（示例使用推荐字体 `NeoX Mono 1.4` 或开源替代 `JetBrains Mono`）：
  ```ini
  font-family = "NeoX Mono 1.4"
  # 开源替代: font-family = "JetBrains Mono"
  font-size = 14
  window-width = 140
  window-height = 40
  ```
- **iTerm2**：Settings › Profiles › Text › Font 选择 `NeoX Mono 1.4` / `JetBrains Mono` / `Fira Code`；建议保留足够宽度（`>=100` 列可展开 `Ctrl+N` 侧边栏）。
- **WezTerm / Kitty / Alacritty**：均支持 Truecolor 与 `▀` 半块绘制，开箱即进入高精度模式。

### 3.2 AI 与代码 IDE 内置终端提示

在 **VS Code**、**Cursor**、**Antigravity**、**Zed** 的内置终端（或并排终端分屏）中运行 Nightglide 时，建议确认：

1. **开启 GPU 硬件加速与 24-bit 色彩**：确认环境中 `COLORTERM=truecolor`（VS Code / Cursor / Zed 默认提供）。
2. **关闭强制最小对比度改色**（如 VS Code / Cursor 的 `terminal.integrated.minimumContrastRatio: 1`），防止终端自动覆盖暗色/亮色主题的柔和边框与渐变色阶。
3. **字体与图标字符集**：建议使用 **NeoX Mono**、**JetBrains Mono**（Apache 2.0）或 **Fira Code**（SIL OFL 1.1）；若使用 Nerd Font 补丁字体，可在 `/settings` →「外观」把图标字符切换为 `nerd`。

### 3.3 macOS Terminal.app 专用说明与字体脚本

macOS 系统自带 Terminal.app 仅支持 256 色，且直接按字体绘制 `▀` 时容易在像素行之间产生细缝。因此 Nightglide 在检测到 `TERM_PROGRAM=Apple_Terminal` 时，会自动降级为 **整格背景像素模式（`cellPixels=1`）** 并使用专门调校的 `scene256` 网格色板。

- 如已安装 **NeoX Mono**（该字体版权保留所有权利，仓库不附带字体文件，需自行安装），可运行脚本创建/更新 `"Nightglide"` 描述文件（14pt，140×40）：
  ```bash
  # 新建或更新 Terminal.app 的 "Nightglide" 描述文件
  scripts/terminal-profile.sh

  # 同时设为 Terminal.app 默认与启动描述文件
  scripts/terminal-profile.sh --default
  ```
- 如需强制控制像素精度，可覆盖环境变量：
  - `NIGHTGLIDE_SCENE_PIXELS=2`：强制半格双像素（适合自绘 `▀` 的真彩终端）
  - `NIGHTGLIDE_SCENE_PIXELS=1`：强制整格单像素
- **划词复制提示**：Glide 全屏模式捕获滚轮事件；在 Terminal.app 等终端中使用系统鼠标划词时，请按住 **Option (`⌥`) 拖动**，或直接输入 `/copy`。

---

## 4. 冒烟验证与本地数据说明

### 4.1 安装后冒烟检查

```bash
# 1. 版本与帮助
nightglide --version   # 输出: nightglide/1.0.0
nightglide --help

# 2. 仓库根启动器门禁（源码模式下）
bun test ./scripts

# 3. 上游自带冒烟套件（源码模式下，在 vendor/omp 内）
cd vendor/omp && bun run ci:test:smoke
```

### 4.2 数据与配置目录兼容

- 所有配置（`config.yml`）、模型定义（`models.yml`）、凭据库（`agent.db`）、自定义主题（`themes/*.json`）与会话记录仍沿用 `~/.omp`（可通过 `PI_CONFIG_DIR` / `PI_CODING_AGENT_DIR` 或 `--profile` 覆盖）。
- `nightglide` 与既有 `omp` 命令互不覆盖，可安全并存。
- 有关单文件二进制构建与跨平台发布校验的完整清单，请参阅 [P4_RELEASE_CHECKLIST.md](P4_RELEASE_CHECKLIST.md) 与 [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md)。
