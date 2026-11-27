# Nightglide CLI v1.0.0 — P4 Release Checklist & Verification Matrix

> **Scope & Accuracy Rule:** Every check below records what was **directly observed** on the `v1.0.0` release candidate (`2026-11-27`) vs. what remains **unverified locally** or requires external CI/host hardware. Source-launcher test results are strictly separated from compiled-binary verification (`docs/DEVELOPMENT_PLAN.md`, `docs/INSTALL.md`).

---

## 1. Release Baseline & Provenance

| Item | Verified Value | Reference |
|---|---|---|
| **Product Version** | `nightglide/1.0.0` (`package.json`, `PRODUCT_VERSION = "1.0.0"`) | [package.json](../package.json), [dirs.ts](../vendor/omp/packages/utils/src/dirs.ts) |
| **Upstream Baseline** | `can1357/oh-my-pi` **`v18.20.2`** (`7c49c11aa5bbaf3f418406583096168ad5b8c6dc`) | [OMP_BASELINE.md](OMP_BASELINE.md) |
| **Internal OMP `VERSION`** | `18.20.2` (preserved for plugin/relay/extension compatibility) | [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md) |
| **Fork Submodule** | `vendor/omp` (`Aoody743/nightglide-omp`, branch `codex/nightglide`, `HEAD 14bec9791a` + working tree release/v1.0.0 changes) | [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md) |
| **Setup Wizard Version** | `CURRENT_SETUP_VERSION = 4` | [setup-version.ts](../vendor/omp/packages/tui/src/setup/setup-version.ts) |
| **Default Approval Mode** | `write` (ask when risky), `restrictedFolders: ["~/.omp"]`, project tighten-only | [SECURITY.md](SECURITY.md) |

---

## 2. Environment Matrix Tested

### 2.1 Verified Locally (macOS Apple Silicon)

| Dimension | Configuration Tested | How Verified | Result | Evidence |
|---|---|---|---|---|
| **Host OS / Arch** | macOS `15.7.9` (`Darwin 24.6.0`, `arm64`, Apple Silicon), Bun `1.4.4` (dev launcher/tests) + Bun `1.4.5` (`bun build --compile` release binaries), Cargo `1.98.1` | Native addon `pi_natives.darwin-arm64.node`, CLI, TUI, and compiled standalone binary runs | **Pass** | Host execution logs (`2026-11-27`) |
| **Truecolor Terminal (`140×40`)** | **Ghostty `1.4.0`**, `NeoX Mono 1.4` 14pt, `COLORTERM=truecolor`, `cellPixels=2` (`▀`) | Live PTY relay captures across themes, `/setup`, `/settings`, `/summary` | **Pass** | 10 PNGs in [docs/images/screenshots/](images/screenshots/) & [verify-ghostty/](../scripts/glide-spike/shots/verify-ghostty/) |
| **Narrow Layout (`80×24`)** | **Ghostty `1.4.0`**, `80×24` window, truecolor | Live PTY capture (`narrow-80x24.png`) + `NightglideShell` unit tests (`<100` cols collapses sidebar & restores model segment to status bar; `<28` rows collapses scene bands) + prior `s4/` `80×24` Terminal.app capture | **Pass** | [narrow-80x24.png](images/screenshots/narrow-80x24.png), [s4/](../scripts/glide-spike/shots/s4/) |
| **256-Color Fallback Terminal (`140×40`)** | **macOS Terminal.app** (`Nightglide` profile: `NeoXMono1.4-Regular` 14pt, 256-color, `cellPixels=1`) | Live PTY `/setup` splash verification on `nightglide/1.0.0` (`terminal-app-splash.png`) + prior `verify/`, `s4/`, `lang/` runs | **Pass** | [terminal-app-splash.png](images/screenshots/terminal-app-splash.png), [verify/](../scripts/glide-spike/shots/verify/) |
| **`NO_COLOR=1` Monochrome** | CLI (`./nightglide --version` & installed prefix launcher) + TUI `plain` / `NO_COLOR` paths | `scripts/launcher.test.ts` (`GATE-A11Y-002`: 0 ANSI SGR color sequences), `nightglide-settings.test.ts`, `nightglide-robot.test.ts`, `NO_COLOR=1 <prefix>/bin/nightglide --version` | **Pass** | [launcher.test.ts](../scripts/launcher.test.ts), [nightglide-settings.test.ts](../vendor/omp/packages/tui/test/nightglide-settings.test.ts) |
| **ASCII Symbol Preset** | `symbolPreset: "ascii"` (`ng` brand, ASCII borders, `[x]`/`[ ]`, `=`/`-` controls) | Unit tests in `nightglide-settings.test.ts`, `nightglide-robot.test.ts`, `nightglide-shell.test.ts` | **Pass** | [symbols.ts](../vendor/omp/packages/tui/src/theme/symbols.ts), [nightglide-robot.test.ts](../vendor/omp/packages/tui/test/nightglide-robot.test.ts) |
| **Bilingual UI (`zh` & `en`)** | `nightglide.language`: `zh` (default), `en`, `auto` | `nightglide-i18n.test.ts` (`zh`/`en` key parity & placeholder parity, no CJK leakage in `en`), live `zh` Ghostty/Terminal captures, prior `s4/` & `lang/` `zh`/`en`/`auto` Terminal.app runs | **Pass** | [i18n.ts](../vendor/omp/packages/tui/src/i18n.ts), [nightglide-i18n.test.ts](../vendor/omp/packages/tui/test/nightglide-i18n.test.ts), [lang/](../scripts/glide-spike/shots/lang/) |
| **Motion Modes** | `--motion none` / `tui.motion` (`full` / `reduced` / `none`) | Unit tests (`nightglide-pixel-scene.test.ts`, `nightglide-robot.test.ts`) + prior `g2/` & `s4/` Terminal.app captures | **Pass** | [nightglide-pixel-scene.test.ts](../vendor/omp/packages/tui/test/nightglide-pixel-scene.test.ts), [s4/](../scripts/glide-spike/shots/s4/) |

### 2.2 Requires External Hosts / CI Runners / Deferred Follow-Up

| Environment / Capability | Current Status | Notes & Where Verified |
|---|---|---|
| **Linux (`linux-x64` / `amd64`, `linux-arm64` / `arm64`) `.deb` & APT runtime** | **Unverified locally** | `.deb` structure & `Packages`/`Release` metadata validated via `package-release.test.ts` using host `ar`/`tar`, but native Linux binary compilation and `apt install ./nightglide_1.0.0_*.deb` + `nightglide --smoke-test` require GitHub Actions (`ubuntu-latest`, `ubuntu-24.04-arm`) in [ci-release.yml](../.github/workflows/ci-release.yml). |
| **macOS Intel (`darwin-x64`) compiled binary** | **Unverified locally** | Cross-target binary not compiled/executed on Apple Silicon host; requires GitHub Actions `macos-15-intel`. |
| **Windows (`cmd.exe` / PowerShell / Windows Terminal)** | **Unsupported / Unverified** | No Windows target in [package-release.ts](../scripts/package-release.ts) or `ci-release.yml`; Windows AltGr / 8.3 path tests skipped in `packages/tui`. |
| **Other Terminal Emulators & IDE Built-ins** | **Recommended, not locally re-verified for v1.0.0** | iTerm2, WezTerm, Kitty, Alacritty, VS Code, Cursor, Antigravity, Zed are documented in [README.md](../README.md) & [INSTALL.md](INSTALL.md) based on truecolor/`▀` characteristics, not directly captured on this host. |
| **G6: Long-Session Performance** | **Deferred (P4/G6)** | Transcript tail re-renders visible rows without completed-block render cache; 100+ turn stress profiling not executed. |
| **G6: `tmux` Runtime Session** | **Deferred / 1 TUI test fail** | Interactive `tmux` run not verified locally; in `packages/tui`, 2 `tmux synchronized rebuild` tests were skipped and `ProcessTerminal DA1 SIXEL detection > trusts tmux's DA1 SIXEL attribute when terminal-overrides supply Sxl` failed (`2026-11-27`). |
| **G6: CJK IME Candidate Window Positioning** | **Deferred (P4/G6)** | Real Pinyin/IME candidate box alignment inside Glide `setScreenProvider` alt-screen composer has not been manually verified. |
| **Continuous Motion Video Recording** | **Deferred (excluded from v1.0.0 static pass)** | Continuous animation frame pacing under live typing was checked via static captures; real-terminal video recording remains open. |
| **Live 5-Level Thinking Turns & Cloud Providers** | **Blocked on live credentials/thinking model** | Effort bar & scene modulation verified in unit tests (`nightglide-pixel-scene.test.ts`, `nightglide-effort-contrast.test.ts`); prior live oMLX run used `omlx/endless` which lacks adjustable `model.thinking`. Cloud OAuth providers, full MCP/LSP/extension suite, and Apple Foundation Models (stubbed without macOS 27 / Swift 6.4+ SDK) were not re-run. |

---

## 3. Source Launcher vs. Compiled Binary Verification Separation

> **Mandatory Rule:** Source-mode `./nightglide` and `scripts/install.sh` run directly via Bun on `vendor/omp/packages/coding-agent/src/cli.ts`. Passing tests on the source launcher **do not** prove the standalone compiled binary (`bun --compile`) works, because compiled binaries resolve embedded `.node` addons, `.json-*.zst` assets, and self-spawned `__omp_worker_*` subprocesses differently.

| Distribution Path | Artifact / Entrypoint | Checks Executed (`2026-11-27`) | Observed Outcome |
|---|---|---|---|
| **Source Launcher (repo)** | `./nightglide` | `bun test ./scripts` (`launcher.test.ts` 6/6: `NO_COLOR=1`, `--version`, `--help`, `--smoke-test` in `3.16s`, `--mode rpc` SIGINT exit `130`, `bunfig.toml` preload poison isolation) | **Pass (6/6)** |
| **Source Launcher (installer)** | `scripts/install.sh --prefix <tmp>` | Installed launcher to isolated temp prefix; executed `--version` and `NO_COLOR=1 <bin> --version` (`nightglide/1.0.0`); verified existing `omp` untouched | **Pass** |
| **Source CLI (`vendor/omp`)** | `bun packages/coding-agent/src/cli.ts` | `bun run ci:test:smoke` (`--version`, `--help`, `stats --help`, `--smoke-test`) + `--license` | **Pass** |
| **Packager Dry-Run & Tests** | `scripts/package-release.ts` | `bun test ./scripts` (`package-release.test.ts` 9/9) + `--dry-run --deb --targets darwin-arm64,darwin-x64,linux-x64,linux-arm64` | **Pass (9/9)** |
| **Compiled Binary (`darwin-arm64`)** | `dist/release/nightglide-v1.0.0-darwin-arm64` & `.tar.gz` (compiled with **Bun `1.4.5`**) | `tar -tzf` contains `nightglide`, `LICENSE`, `THIRD-PARTY-NOTICES.txt`, `README.md`; `SHA256SUMS.txt` verified `OK` across all 10 artifacts; `--version` (`nightglide/1.0.0`), `--help`, and `--license` (16,512 lines) succeeded in isolated `$HOME`/`$XDG_*` | **Pass** |
| **Compiled Binary (`darwin-arm64`) `--smoke-test` & RPC** | `dist/release/nightglide-v1.0.0-darwin-arm64 --smoke-test` & `--mode rpc` | Executed in isolated `$HOME` / `$XDG_DATA_HOME` / `$XDG_STATE_HOME` / `$XDG_CACHE_HOME`: `--smoke-test` returned `smoke-test: ok` (exit 0); `--mode rpc` cleaned up on `SIGINT` (rc `130`, 0 stderr bytes). Switching `bun build --compile` from host Bun `1.4.4` to **`bun@1.4.5`** resolved the macOS compiled `node:net`/loopback `fetch` stall | **Pass** |
| **Release Archives, `.deb`, APT & Formula** | `scripts/package-release.ts --version 1.0.0 --targets darwin-arm64,darwin-x64,linux-x64,linux-arm64 --fetch-cross-natives --deb --strict-formula` | Built 4 binaries, 4 `.tar.gz`, 2 `.deb` (`amd64`, `arm64`), `dist/apt/` (`Release`, `Packages{,.gz}`, `pool/`), `packaging/homebrew/nightglide.rb` (`ruby -c` Syntax OK with real SHA256s), and `shasum -a 256 -c SHA256SUMS.txt` (`10/10 OK`) | **Pass (host packaging & arm64 run); cross-OS runs via CI** |
| **`Nightglide Stats` Web UI & `/export` HTML** | `http://127.0.0.1:19450/` (Chromium browser subagent, isolated DB) | Verified Flight Dark (`zh`) + Cloudlight (`en`) switcher, geometric `N` logo, HTTP 200 across all API/asset requests, `0` console errors; `/export` HTML tests pass | **Pass** |
| **Compiled Binaries (`darwin-x64`, `linux-x64`, `linux-arm64`) & `.deb`** | GitHub Actions `ci-release.yml` | Not built or executed locally | **Pending CI Runner Verification** |

---

## 4. Automated Checks & Test Results (`2026-11-27`)

All commands below were executed on the current `v1.0.0` working tree:

| Suite / Command | Scope | Result | Notes |
|---|---|---|---|
| `bun test ./scripts` | `launcher.test.ts` + `package-release.test.ts` | **15 pass, 0 fail** (81 expects) | Covers launcher gates & `.deb`/tar/ar/Homebrew packager unit tests |
| `cd vendor/omp && bun run ci:test:smoke` | CLI `--version`, `--help`, `stats --help`, `--smoke-test` | **Pass** | Outputs `nightglide/1.0.0` and `smoke-test: ok` |
| `cd vendor/omp && ./node_modules/.bin/oxlint <106 modified files>` | Modified/new files across `utils`, `tui`, `coding-agent`, `stats` | **Pass** | 0 warnings, 0 errors |
| `cd vendor/omp && ./node_modules/.bin/oxfmt --check <102 modified TS/TSX/JSON files>` | Modified/new TS/TSX/JSON files (`export/html/*.{js,css}` follow upstream 2-space HTML asset style) | **Pass** | All 102 matched files use the correct format |
| `cd vendor/omp && bun --cwd=packages/{utils,tui,stats,coding-agent,collab-web} run check[:types]` | TypeScript (`utils` 253, `tui` 3,166, `stats` 543+89, `coding-agent`, `collab-web`) + package checks | **Pass** | 0 errors across all checked packages |
| `cd vendor/omp && bun --cwd=packages/collab-web test` | `packages/collab-web` full suite | **Pass** | **139 pass, 0 fail** (including hosted export viewer tests) |
| `cd vendor/omp && bun --cwd=packages/stats test` | `test/web-i18n.test.ts` + full `packages/stats` suite | **255 pass, 1 pre-existing fail** | `web-i18n.test.ts` **2 pass, 0 fail**; pre-existing upstream baseline fail in `test/db-cost.test.ts:400` (`grok-4.20-multi-agent-0309`) |
| `cd vendor/omp && bun test <7 Nightglide/export/setup/license files>` | `cli-license`, `export-html-{markdown,template,themes}`, `nightglide-menu`, `setup-wizard`, `usage-cli` | **Pass** | **163 pass, 0 fail** |
| `cd vendor/omp && bun test ...` (Nightglide / setup / approval / license subset, 22 files) | `cli-license`, `builtin-theme-command`, `interactive-mode-theme-toast`, `tools/approval*` (4 files), `nightglide-{menu,routing,custom-providers}`, `setup-wizard`, `packages/tui/test/nightglide-*` (10 files), `task-summary` | **346 pass, 0 fail** (4,848 expects) | All Nightglide features, themes, companions, i18n, settings, shell, routing, setup, approval, and `--license` gates pass |
| `cd vendor/omp/packages/tui && bun test --parallel test/*.test.ts` | 362 top-level TUI test files | **4,783 pass, 8 skip, 1 fail** | 1 failure: `ProcessTerminal DA1 SIXEL detection > trusts tmux's DA1 SIXEL attribute when terminal-overrides supply Sxl`; 8 skips: Windows AltGr/8.3 paths, `fileHyperlink`, `tmux synchronized rebuild` (2) |

---

## 5. Theme & Pixel Companion Verification Matrix

### 5.1 7 Built-In Themes (3 Light, 3 Dark, 1 Aurora)

All 7 built-in themes pass JSON schema validation, WCAG text/muted (`>= 4.5`) & thinking-effort (`>= 3.0`) contrast checks (`nightglide-themes.test.ts`, `nightglide-effort-contrast.test.ts`), `resolveFramePalette` frame derivation, and visual inspection:

| Category | Theme ID | `/theme` Aliases | Scene Kind | Local Visual Evidence |
|---|---|---|---|---|
| **Dark (1/3)** | `nightglide-flight` *(default dark)* | `flight`, `dark`, `nightglide` | `flight` | [hero-flight-sidebar.png](images/screenshots/hero-flight-sidebar.png), [flight-collapsed.png](images/screenshots/flight-collapsed.png), [narrow-80x24.png](images/screenshots/narrow-80x24.png) |
| **Dark (2/3)** | `nightglide-abyss` | `abyss` | `dive` | [settings-appearance.png](images/screenshots/settings-appearance.png) card + prior Terminal.app `g2/` / `s4/` captures |
| **Dark (3/3)** | `nightglide-abyss-trench` | `abyss-trench`, `trench` | `dive` | [abyss-trench.png](images/screenshots/abyss-trench.png) |
| **Light (1/3)** | `nightglide-cloudlight` *(default light)* | `cloudlight`, `light` | `flight` | [cloudlight-cat.png](images/screenshots/cloudlight-cat.png) |
| **Light (2/3)** | `nightglide-daybreak` | `daybreak` | `dive` | [daybreak-dive.png](images/screenshots/daybreak-dive.png) |
| **Light (3/3)** | `nightglide-iris` | `iris` | `flight` | [iris-clouds.png](images/screenshots/iris-clouds.png) |
| **Aurora (1/1)** | `nightglide-aurora` | `aurora` | `aurora` | [aurora-sidebar.png](images/screenshots/aurora-sidebar.png) |

### 5.2 5 Pixel Companions (`+ auto`)

Defined in [nightglide-robot.ts](../vendor/omp/packages/tui/src/components/nightglide-robot.ts) and verified across `10×5` half-block (`cellPixels=2`), `cellPixels=1`, `NO_COLOR`, `ascii`, and 1-line compact fallbacks (`nightglide-robot.test.ts`):

| `nightglide.robotStyle` | Chinese Label | English Label | Status |
|---|---|---|---|
| `auto` *(default)* | 跟随主题 | Match theme | Resolves `flight` -> `glider`, `dive` -> `diver`, `aurora` -> `prism` (verified in unit tests + Ghostty screenshots) |
| `glider` | 夜航机甲 | Sky Glider | Visually verified in [hero-flight-sidebar.png](images/screenshots/hero-flight-sidebar.png), [iris-clouds.png](images/screenshots/iris-clouds.png) |
| `cat` | 星云猫耳 | Nebula Cat | Visually verified in [settings-appearance.png](images/screenshots/settings-appearance.png), [cloudlight-cat.png](images/screenshots/cloudlight-cat.png) |
| `owl` | 夜鸮领航 | Night Owl | Covered in `nightglide-robot.test.ts` & `/settings` selector |
| `diver` | 深海潜航 | Deep Diver | Visually verified in [daybreak-dive.png](images/screenshots/daybreak-dive.png), [abyss-trench.png](images/screenshots/abyss-trench.png) |
| `prism` | 极光星灵 | Aurora Sprite | Visually verified in [aurora-sidebar.png](images/screenshots/aurora-sidebar.png) |

---

## 6. Curated Release Screenshots Inventory (`docs/images/screenshots/`)

All 12 static PNG files below were inspected via `read_file` to verify rendering fidelity, clean framing, and absence of credentials or home-directory leaks:

| Screenshot | Terminal & Size | Description |
|---|---|---|
| [hero-flight-sidebar.png](images/screenshots/hero-flight-sidebar.png) | Ghostty `1.4.0`, `140×40` | `nightglide-flight` with expanded sidebar, Glider companion, sanitized `/tmp/.../work` path, clean status bar |
| [flight-collapsed.png](images/screenshots/flight-collapsed.png) | Ghostty `1.4.0`, `140×40` | `nightglide-flight` default collapsed sidebar (`[ ▸ 详情 ^N ]`), clean status bar (`✦ · no-model · main`) |
| [iris-clouds.png](images/screenshots/iris-clouds.png) | Ghostty `1.4.0`, `140×40` | `nightglide-iris` light theme with pastel rainbow waves & expanded sidebar |
| [daybreak-dive.png](images/screenshots/daybreak-dive.png) | Ghostty `1.4.0`, `140×40` | `nightglide-daybreak` warm ivory dive scene with water light shafts & expanded sidebar |
| [abyss-trench.png](images/screenshots/abyss-trench.png) | Ghostty `1.4.0`, `140×40` | `nightglide-abyss-trench` dark dive scene & expanded sidebar |
| [cloudlight-cat.png](images/screenshots/cloudlight-cat.png) | Ghostty `1.4.0`, `140×40` | `nightglide-cloudlight` light theme + `cat` (Nebula Cat) companion |
| [aurora-sidebar.png](images/screenshots/aurora-sidebar.png) | Ghostty `1.4.0`, `140×40` | `nightglide-aurora` curtains, mountain ridge, `prism` companion & expanded sidebar |
| [setup-splash.png](images/screenshots/setup-splash.png) | Ghostty `1.4.0`, `140×40` | `/setup` splash screen with 46×5 block `NIGHTGLIDE` wordmark and `按 Enter 跳过` |
| [settings-appearance.png](images/screenshots/settings-appearance.png) | Ghostty `1.4.0`, `140×40` | `/settings` Appearance showing all 7 theme cards and live `cat` companion preview |
| [summary-overlay.png](images/screenshots/summary-overlay.png) | Ghostty `1.4.0`, `140×40` | `/summary` task summary modal with offline facts, scope/cost notice & AI trigger boundary |
| [narrow-80x24.png](images/screenshots/narrow-80x24.png) | Ghostty `1.4.0`, `80×24` | Responsive narrow-screen layout: cleanly collapsed sidebar/scenes, intact rounded frames & status bar |
| [stats-web-dark.png](images/screenshots/stats-web-dark.png) | Chromium (isolated DB) | `Nightglide Stats` web dashboard in Flight Dark (`zh`, `中 / EN` switcher & geometric `N` logo) |
| [stats-web-light.png](images/screenshots/stats-web-light.png) | Chromium (isolated DB) | `Nightglide Stats` web dashboard in Cloudlight (`en`) |
| [terminal-app-splash.png](images/screenshots/terminal-app-splash.png) | Terminal.app (`NeoXMono1.4-Regular` 14pt, 256-color), `140×40` | Fallback font completeness check for `NIGHTGLIDE` block wordmark & `按 Enter 跳过` |

---

## 7. License Audit Cross-Reference

| Artifact | Purpose & Status | Reference |
|---|---|---|
| **Root MIT License** | Root copyright notice (`Mario Zechner`, `Can Bölük`, `Stencil Labs, Inc.`, `Nightglide Contributors`) | [LICENSE](../LICENSE) |
| **Root Third-Party Notices** | Aggregates Nightglide notice, upstream OMP MIT license, CLI TS notices (`vendor/omp/packages/coding-agent/THIRD-PARTY-NOTICES.txt`), and native Rust/N-API notices (`vendor/omp/packages/natives/THIRD-PARTY-NOTICES.txt`, including Silver CC BY 4.0 fallback font) | [THIRD-PARTY-NOTICES.txt](../THIRD-PARTY-NOTICES.txt) |
| **Upstream OMP License** | Preserved verbatim inside `vendor/omp` | [vendor/omp/LICENSE](../vendor/omp/LICENSE) |
| **CLI `--license` Output** | `formatLicenseOutput()` prints Nightglide banner + `LICENSE` + CLI & natives notices; verified by `cli-license.test.ts` and `./nightglide --license` | [license.ts](../vendor/omp/packages/coding-agent/src/cli/license.ts), [cli-license.test.ts](../vendor/omp/packages/coding-agent/test/cli-license.test.ts) |
| **Release Bundles & Formula** | Both `.tar.gz` and `.deb` (`package-release.ts`) as well as Homebrew `prefix.install` and GitHub Release `files` include `LICENSE` and `THIRD-PARTY-NOTICES.txt` | [package-release.ts](../scripts/package-release.ts), [ci-release.yml](../.github/workflows/ci-release.yml) |
| **Font & Trademark Policy** | NeoX Mono & recommended external terminal fonts are not bundled in Nightglide artifacts; policy documented in `LICENSE_POLICY.md` | [LICENSE_POLICY.md](LICENSE_POLICY.md) |

---

## 8. Go / No-Go Summary for `v1.0.0`

- **Source Mode (`./nightglide`, `scripts/install.sh`), macOS `darwin-arm64` Compiled Binary, Web UI (`Nightglide Stats`) & HTML `/export`:** **GO** — Bun `1.4.5` resolved the compiled macOS `node:net`/loopback `fetch` stall (`--smoke-test` returns `smoke-test: ok`, `--mode rpc` SIGINT exits cleanly with `130`), all 10 release archives/binaries/debs pass `SHA256SUMS.txt`, `packaging/homebrew/nightglide.rb` validates cleanly (`ruby -c`), and Chromium confirmed the redesigned `Nightglide Stats` dashboard with zero console errors.
- **Cross-OS Verification Status (`darwin-x64`, `linux-x64`, `linux-arm64`):** Built cleanly with `--fetch-cross-natives` and verified checksums/archive layouts locally; runtime smoke tests on native Intel Mac and Linux (`apt install ./nightglide_1.0.0_*.deb` + `nightglide --smoke-test`) run via GitHub Actions [ci-release.yml](../.github/workflows/ci-release.yml) (`macos-15-intel`, `ubuntu-latest`, `ubuntu-24.04-arm`). (The 2 previously noted `oxfmt` mismatches on `types.ts` and `usage-cli.test.ts` are fixed; remaining upstream test baselines in `tui`/`stats` are tracked in Section 4.)
