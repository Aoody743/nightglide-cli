# Changelog

All notable changes to **Nightglide CLI** are documented in this file.

> Nightglide CLI builds upon [Oh My Pi (OMP)](https://github.com/can1357/oh-my-pi) `v18.20.2` (`7c49c11aa5bbaf3f418406583096168ad5b8c6dc`) via the vendored `vendor/omp` fork (`codex/nightglide`), keeping `~/.omp` compatibility while adding Glide fullscreen UX, themes, pixel companions, bilingual settings, routing, and safer defaults.

---

## [1.0.0] - 2026-11-27

### Setup, Onboarding & Branding
- **Product Versioning & Identity**: Set `PRODUCT_VERSION` to `"1.0.0"` (`nightglide --version` reports `nightglide/1.0.0`), while preserving internal OMP `VERSION` (`18.20.2`) for plugin, relay, and compatibility checks (`packages/utils/src/dirs.ts`).
- **Brand Mark & Splash Wordmark (`S5`)**: Replaced `π` branding with `✦` (`ng` under ASCII symbols), redesigned `NIGHTGLIDE_WORDMARK` as a 46×5 solid-block bitmap so terminal fallback fonts avoid broken strokes, and fixed localized skip-hint spacing (`按 Enter 跳过` / `Press Enter to skip`) in `packages/tui/src/setup/scenes/splash.ts`.
- **Setup Wizard (`CURRENT_SETUP_VERSION = 4`)**: Integrated bilingual `SelectList`, OAuth-only sign-in selector with custom provider creation (`packages/tui/src/setup/scenes/sign-in.ts`, `custom-provider.ts`), interactive 4-mode routing selector with cloud-vs-local disclosure (`packages/tui/src/setup/scenes/routing.ts`), and Nightglide theme onboarding.
- **Update & Launcher Isolation**: Disabled upstream OMP changelog popups and update checks; `nightglide update` instructs git updates when run from a source checkout (`packages/coding-agent/src/commands/update.ts`). Added loopback `NO_PROXY` protection (`127.0.0.1`, `localhost`, `::1`), `OMP_LAUNCH_CWD` restoration, and `bunfig.toml` preload isolation in `./nightglide` and `scripts/install.sh`.

### Themes & Pixel Scenes (`G2` / `G5`)
- **7 Built-in Handcrafted Themes**: Replaced stock OMP theme pack with 7 curated themes while retaining `dark`/`light` compatibility aliases (`nightglide-flight` / `nightglide-cloudlight`) and custom `~/.omp/agent/themes/*.json` support:
  - **Dark (3)**: `nightglide-flight` (default dark), `nightglide-abyss`, `nightglide-abyss-trench`
  - **Light (3)**: `nightglide-cloudlight` (default light), `nightglide-daybreak`, `nightglide-iris`
  - **Aurora (1)**: `nightglide-aurora`
- **Top & Bottom Pixel Scenes (`nightglide-pixel-scene.ts`)**: Dual-edge half-block (`▀`, `cellPixels=2`) truecolor rendering for Flight parallax clouds and thin light bands (plus Iris spectral rainbow ripples), Dive slanted light shafts, swaying plants, bubbles, and motes, and Aurora curtains with launch sweep over a mountain ridge.
- **Terminal.app & Effort Integration**: Added automatic `cellPixels=1` whole-cell mode with quantized `scene256` grid palettes for 256-color terminals (`TERM_PROGRAM=Apple_Terminal`), `NIGHTGLIDE_SCENE_PIXELS=1|2` override, `--motion <full|reduced|none>` static/reduced modes, and dynamic effort modulation driven strictly by effective `thinkingLevel`.
- **Unified Frame Palette & `/theme` Command**: Added `resolveFramePalette` (`nightglide-theme-families.ts`) to derive shell and export colors directly from theme JSON, and implemented `/theme <name>` with short names and persistent `theme.dark` / `theme.light` slot saving.

### Glide Fullscreen UI & Bilingual UX (`G1`–`G5`, `S1`–`S5`)
- **Glide Fullscreen Shell (`G1`)**: Made `NightglideShell` (`TUI.setScreenProvider`) the sole interactive layout (classic inline mode `--classic`/`F2`/`nightglide.layout` removed); added scrollback anchoring (`ANCHOR_ROWS = 3`), `End`/click scrollback return pill, live animation frame progression in `renderTail`, and `/copy` support.
- **Content Cards & Bilingual Approval (`G3`)**: Unified user message cards, `✦ Nightglide` assistant reply headers, tool chips, diff cards, and bilingual approval dialogs, fixing `[y]`/`[s]`/`[n]` key leakage into the composer draft.
- **Collapsible Sidebar & 5 Pixel Companions (`G4`)**:
  - Added default-collapsed sidebar toggled via `Ctrl+N` (`app.sidebar.toggle`) or top border pill (`[ ▸ 详情 ^N ]` / `[ ▾ 收起 ]`), automatically collapsing below 100 columns and handing model info back to the status line (`setHostedElsewhere`).
  - Added 5 selectable 10×5 pixel companions (`glider`, `cat`, `owl`, `diver`, `prism`) plus `auto` theme matching in `nightglide-robot.ts`, strictly reflecting real session state (`idle`, `thinking`, `tools`, `done`) with `cellPixels=1`, `NO_COLOR`, ASCII, and 1-line compact fallbacks.
  - Updated sidebar telemetry: live effort bar, `—` placeholder when context window is unknown, tail-preserving `Workspace` path, expandable subagents section, and bottom `✦ 任务总结 /summary` pill.
- **`/summary` Task Summary Overlay (`G4`)**: Added offline factual session summary (turn counts, tools, touched files, subagents) with credential redaction, explicit scope & token cost notice, and user-triggered non-mutating AI summary generation (`Esc` cancellable).
- **Bilingual UI & Tiered Commands (`S1`–`S4`)**:
  - Added centralized `zh`/`en` text table (`packages/tui/src/i18n.ts`) and live `nightglide.language` setting (`zh` default, `en`, `auto`).
  - Categorized all 93 builtin slash commands into `common` (20), `standard` (21), and `advanced` (52) in `nightglide-menu.ts`, with grouped `/more` and a leading advanced-commands toggle.
  - Added graphical Glide `/settings` overlay (`nightglide-settings.ts`) across 7 categories (Appearance, Model, Approval, Notifications, Session, Language, Advanced) with live theme/companion previews, and streamlined `/login`, `/provider` (Base URL + key + auto `/models` discovery + `models.yml.bak` backup), and usable-only `/model`.

### Routing & Approval Safety (`P3.1`–`P3.3`)
- **4-Mode Model Routing (`nightglide-routing.ts`)**: Added `nightglide.routingMode` (`manual`, `local`, `balanced`, `performance`) and `nightglide.localModel` across 10 chat roles and `@role`/subagent inheritance, enforcing local-only fallback chains, bounded cold local-provider discovery, and per-call cloud model rejection under `local` mode while documenting honest kind-role exclusions.
- **Safer Default Approval (`P3.3`)**: Changed default `tools.approvalMode` from `yolo` to `write` (reads and writes auto-run; bash/`eval`, `task`, and dangerous commands require approval), defaulted `tools.restrictedFolders` to `["~/.omp"]` (always ask, never remembered), enforced tighten-only project `.omp/config.yml` overrides, and ensured headless (`-p`/RPC/ACP) runs safely reject unapproved tool calls unless `--auto-approve` or `--approval-mode yolo` is passed.

### Web Dashboard (`nightglide stats`) & HTML Export
- **Nightglide Stats Web UI (`packages/stats`)**: Redesigned dashboard branding with geometric delta-wing `N` SVG logo, `Nightglide Stats` header/favicon, **Flight Dark** & **Cloudlight** persistent theme palettes (`nightglide-stats-theme` with `omp-stats-theme` compatibility), core bilingual **中文 / EN** switcher (`packages/stats/src/client/webI18n.ts`), and theme-synced chart/trace colors while keeping all backend API endpoints and `X-Omp-*` / `X-OMP-*` headers compatible.
- **Branded HTML Session Export (`packages/coding-agent/src/export/html/`)**: Updated `/export` standalone viewer title (`Nightglide Session Export`), Flight Dark & Cloudlight palette variables, and hosted `share-loader.js` viewer title while preserving shared integrity-checked libraries and offline asset layout.

### Packaging & Distribution
- Added release packaging (`scripts/package-release.ts` built with Bun `1.4.5` to resolve the macOS `bun --compile` loopback socket/fetch hang), generating 4-target `.tar.gz` archives, pure-TypeScript Debian `.deb` packages (`amd64` / `arm64`), APT repository metadata (`dists/stable`, `pool/`), Homebrew tap formula (`packaging/homebrew/nightglide.rb`), `SHA256SUMS.txt`, and `.github/workflows/ci-release.yml`.
- Added root [LICENSE](LICENSE), [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt), [docs/P4_RELEASE_CHECKLIST.md](docs/P4_RELEASE_CHECKLIST.md), [docs/UPSTREAM_SYNC.md](docs/UPSTREAM_SYNC.md), Nightglide showcase screenshots (including `Nightglide Stats` web UI dark/light captures), and updated [README.md](README.md) & [docs/INSTALL.md](docs/INSTALL.md).
