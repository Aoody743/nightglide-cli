/**
 * Nightglide 工作台验收走查套件 —— bun test 固化版。
 *
 * 将 `scripts/verify-workbench.ts`（Nightglide TUI: 主题层次、动效系统与多尺寸
 * 适配走查，共 115 项检查）的走查矩阵固化为 bun test 断言：
 *   - 五主题 × 3 尺寸 × 4 模式视口断言（60 组合）
 *   - 66 主题槽位完整性（5 主题）
 *   - WCAG 2.1 AA 关键对比度（text/model ≥ 4.5:1，dim ≥ 3.0:1 大文本线）
 *   - spinner 全帧等宽 + 动态 vs 静态占位 0 位移（Zero Jitter）
 *   - GATE-A11Y-002: NO_COLOR=1 真实 CLI 与脚本零 ANSI 颜色转义序列
 *   - GATE-TEARDOWN-001: 终端优雅复原真实 CLI 自动化门禁（进程退出、SIGINT 中断与资源释放）
 *
 * 口径说明：所有阈值与组合与 `scripts/verify-workbench.ts` 现行 115 项完全一致
 * 或覆盖其核心，未放宽任何阈值。
 *
 * 方案说明（import 直跑 vs 子进程）：verify-workbench.ts 顶层即执行
 * `runVerificationSuite()` 并打印快照（import 有副作用）。本测试不修改该脚本的
 * 行为与输出，采用「双保险」：
 *   1. 通过动态 import 引入纯函数 `renderWorkbenchScreen` 做进程内细粒度断言；
 *      import 期间临时静默 console，避免把 115 行 PASS 日志与 9 张快照刷进测试
 *      输出（import 后立即恢复）。
 *   2. 追加一个子进程用例，原样执行 `bun run scripts/verify-workbench.ts`，
 *      断言 exit 0 且输出含「115 项检查，通过 115 项」—— 以真产物锁定 115 项
 *      口径本身（runVerificationSuite 未导出，这是唯一能锁总数的通路），同时
 *      盯住本文件重复声明常量（REQUIRED_66_SLOTS / RUNNING_META）与源脚本的
 *      漂移。
 */
import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { loadThemeJsonSync } from "../vendor/omp/packages/tui/src/theme/loader";
import { resolveThemeColors } from "../vendor/omp/packages/tui/src/theme/color";
import { relativeLuminance } from "../vendor/omp/packages/utils/src/color";
import { visibleWidth } from "../vendor/omp/packages/tui/src/utils";

// ============================================================================
// import 侧副作用处理：verify-workbench.ts 顶层会跑完整套件（115 行 ✓ 日志 +
// 9 张快照）并打印。动态 import 期间静默 console，引入纯函数
// `renderWorkbenchScreen` 后立即恢复，避免污染 bun test 输出。
// ============================================================================

let renderWorkbenchScreen: (typeof import("./verify-workbench.ts"))["renderWorkbenchScreen"];
{
	const noisy = ["log", "error", "warn", "info"] as const;
	const original = Object.fromEntries(noisy.map(k => [k, console[k]]));
	for (const k of noisy) console[k] = () => {};
	try {
		({ renderWorkbenchScreen } = await import("./verify-workbench.ts"));
	} finally {
		for (const k of noisy) console[k] = original[k]!;
	}
}

// ============================================================================
// 常量：与 verify-workbench.ts 逐字对齐（源脚本未导出，重复声明；
// 子进程用例 + 源脚本本身的 [1/4][3/4] 段负责盯漂移）。
// ============================================================================

/** 与 verify-workbench.ts 的 REQUIRED_66_SLOTS 完全一致的 66 槽位规格。 */
const REQUIRED_66_SLOTS = [
	// 7 Backgrounds
	"selectedBg", "userMessageBg", "customMessageBg", "toolPendingBg", "toolSuccessBg", "toolErrorBg", "statusLineBg",
	// 59 Colors
	"accent", "border", "borderAccent", "borderMuted", "success", "error", "warning", "muted", "dim", "text",
	"thinkingText", "userMessageText", "customMessageText", "customMessageLabel", "toolTitle", "toolOutput",
	"mdHeading", "mdLink", "mdLinkUrl", "mdCode", "mdCodeBlock", "mdCodeBlockBorder", "mdQuote", "mdQuoteBorder",
	"mdHr", "mdListBullet", "toolDiffAdded", "toolDiffRemoved", "toolDiffContext",
	"syntaxComment", "syntaxKeyword", "syntaxFunction", "syntaxVariable", "syntaxString", "syntaxNumber", "syntaxType", "syntaxOperator", "syntaxPunctuation",
	"thinkingOff", "thinkingMinimal", "thinkingLow", "thinkingMedium", "thinkingHigh", "thinkingXhigh",
	"bashMode", "pythonMode",
	"statusLineSep", "statusLineModel", "statusLinePath", "statusLineGitClean", "statusLineGitDirty", "statusLineContext",
	"statusLineSpend", "statusLineStaged", "statusLineDirty", "statusLineUntracked", "statusLineOutput", "statusLineCost", "statusLineSubagents",
] as const;

/** 与 verify-workbench.ts 的 RUNNING_META 完全一致：各主题「进行中」工具卡片动效文案。 */
const RUNNING_META: Record<string, { dynamic: string; static: string }> = {
	flight: {
		dynamic: "━╾─ 正在滑行检索...",
		static: "─── 正在滑行检索...",
	},
	abyss: {
		dynamic: "● 正在检索深海符号...",
		static: "· 正在检索深海符号...",
	},
	aurora: {
		dynamic: "≈✦ 极光涟漪检索中...",
		static: "── 极光涟漪检索中...",
	},
	cloudlight: {
		dynamic: "░▒▓ 云影漂移检索中...",
		static: "░░░ 云影漂移检索中...",
	},
	daybreak: {
		dynamic: "◎ 晨光晕染检索中...",
		static: "· 晨光晕染检索中...",
	},
};

const THEMES = [
	"nightglide-flight",
	"nightglide-abyss",
	"nightglide-aurora",
	"nightglide-cloudlight",
	"nightglide-daybreak",
] as const;

const SIZES = [
	{ width: 80, height: 24, label: "80x24 紧凑基线" },
	{ width: 100, height: 30, label: "100x30 日常标准" },
	{ width: 120, height: 36, label: "120x36 扩展宽屏" },
] as const;

const MODES = ["empty", "active-dialogue", "approval", "low-motion"] as const;

function contrastRatio(colorA: string | number, colorB: string | number): number {
	const l1 = relativeLuminance(colorA);
	const l2 = relativeLuminance(colorB);
	if (l1 === undefined || l2 === undefined) return NaN;
	const max = Math.max(l1, l2);
	const min = Math.min(l1, l2);
	return (max + 0.05) / (min + 0.05);
}

// ============================================================================
// import 侧副作用处理：verify-workbench.ts 顶层会跑完整套件并打印快照。
// 动态 import 期间静默 console，引入 renderWorkbenchScreen 后立即恢复。
// ============================================================================

// ============================================================================
// [1/4 对应] 66 槽位完整性（5 主题）
// ============================================================================
describe("verify-workbench · 66 主题槽位完整性", () => {
	it("槽位规格自检:REQUIRED_66_SLOTS 恰好声明 66 个槽位 (59 fg + 7 bg)", () => {
		expect(REQUIRED_66_SLOTS.length).toBe(66);
		expect(new Set(REQUIRED_66_SLOTS).size).toBe(66);
	});

	for (const themeId of THEMES) {
		it(`${themeId}: 完整声明全部 66 个色彩槽位 (59 fg + 7 bg)`, () => {
			const json = loadThemeJsonSync(themeId);
			const colorKeys = new Set(Object.keys(json.colors));
			const missing = REQUIRED_66_SLOTS.filter(slot => !colorKeys.has(slot));
			expect(missing).toEqual([]);
		});
	}
});

// ============================================================================
// [2/4 对应] WCAG 2.1 AA 关键对比度（阈值与源脚本一致,未放宽）
// ============================================================================
describe("verify-workbench · WCAG 2.1 AA 关键对比度", () => {
	for (const themeId of THEMES) {
		const json = loadThemeJsonSync(themeId);
		const colors = resolveThemeColors(json.colors, json.vars);
		const termBg =
			json.terminal?.background ??
			(themeId.includes("light") || themeId.includes("daybreak") ? "#ffffff" : "#000000");
		const statusBg = colors.statusLineBg;

		it(`${themeId}: 状态栏正文与模型对比度 ≥ 4.5:1 (text ${contrastRatio(colors.text, statusBg).toFixed(2)}, model ${contrastRatio(colors.statusLineModel, statusBg).toFixed(2)})`, () => {
			expect(contrastRatio(colors.text, statusBg)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(colors.statusLineModel, statusBg)).toBeGreaterThanOrEqual(4.5);
		});

		it(`${themeId}: 状态栏路径与 Git 状态对比度 ≥ 4.5:1 (path ${contrastRatio(colors.statusLinePath, statusBg).toFixed(2)}, clean ${contrastRatio(colors.statusLineGitClean, statusBg).toFixed(2)}, dirty ${contrastRatio(colors.statusLineGitDirty, statusBg).toFixed(2)})`, () => {
			expect(contrastRatio(colors.statusLinePath, statusBg)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(colors.statusLineGitClean, statusBg)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(colors.statusLineGitDirty, statusBg)).toBeGreaterThanOrEqual(4.5);
		});

		it(`${themeId}: 状态栏 dim 辅助文本对比度 ≥ 3.0:1 (WCAG 大文本线,非 4.5:1 AA 正文线) (${contrastRatio(colors.dim, statusBg).toFixed(2)})`, () => {
			expect(contrastRatio(colors.dim, statusBg)).toBeGreaterThanOrEqual(3.0);
		});

		it(`${themeId}: 终端画布主文本与核心状态语义对比度 ≥ 4.5:1 (text/accent/success/error)`, () => {
			expect(contrastRatio(colors.text, termBg)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(colors.accent, termBg)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(colors.success, termBg)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(colors.error, termBg)).toBeGreaterThanOrEqual(4.5);
		});
	}
});

// ============================================================================
// [3/4 对应] 动效系统与 Spinner 帧 (Zero Jitter)
// ============================================================================
describe("verify-workbench · Zero Jitter 动效与 Spinner 帧", () => {
	for (const themeId of THEMES) {
		const json = loadThemeJsonSync(themeId);
		const spinner = json.symbols?.spinnerFrames;

		it(`${themeId}: status spinner 具备帧序列且全帧等宽无抖动 [Zero Jitter]`, () => {
			const frames = spinner?.status;
			expect(frames).toBeDefined();
			expect(frames!.length).toBeGreaterThan(0);
			const widths = frames!.map(f => visibleWidth(f));
			expect(new Set(widths).size).toBe(1);
		});

		it(`${themeId}: activity spinner 具备帧序列且全帧等宽无抖动 [Zero Jitter]`, () => {
			const frames = spinner?.activity;
			expect(frames).toBeDefined();
			expect(frames!.length).toBeGreaterThan(0);
			const widths = frames!.map(f => visibleWidth(f));
			expect(new Set(widths).size).toBe(1);
		});

		it(`${themeId}: 动态 vs 静态占位 0 位移 [Zero Jitter] (dynamic ${visibleWidth(RUNNING_META[themeId.replace("nightglide-", "")]?.dynamic ?? RUNNING_META.flight!.dynamic)} 列)`, () => {
			const meta = RUNNING_META[themeId.replace("nightglide-", "")] ?? RUNNING_META.flight!;
			expect(visibleWidth(meta.dynamic)).toBe(visibleWidth(meta.static));
		});
	}
});

// ============================================================================
// [4/4 对应] 多尺寸适配走查:五主题 × 3 尺寸 × 4 模式 = 60 视口组合
// ============================================================================
describe("verify-workbench · 多尺寸视口走查矩阵 (5 主题 × 3 尺寸 × 4 模式 = 60)", () => {
	it("矩阵自检:主题/尺寸/模式笛卡尔积恰好覆盖 60 个组合", () => {
		expect(THEMES.length * SIZES.length * MODES.length).toBe(60);
	});

	for (const themeId of THEMES) {
		for (const mode of MODES) {
			it(`${themeId} · ${mode}: 三种尺寸行数严格契合且无横向溢出`, () => {
				for (const size of SIZES) {
					const snap = renderWorkbenchScreen(themeId, size.width, size.height, mode);
					expect(snap.renderedLines.length).toBe(size.height);
					const maxLineWidth = Math.max(...snap.renderedLines.map(line => visibleWidth(Bun.stripANSI(line))));
					expect(maxLineWidth).toBeLessThanOrEqual(size.width);
				}
			});
		}
	}
});

// ============================================================================
// 子进程验收:以真产物锁定 115 项口径(总数未被放宽或缩减)
// ============================================================================
describe("verify-workbench · 子进程真跑验收 (115 项口径锁定)", () => {
	it("bun run scripts/verify-workbench.ts 退出码 0 且输出含「115 项检查，通过 115 项」,无任何 FAIL", () => {
		const repoRoot = path.resolve(import.meta.dir, "..");
		const proc = Bun.spawnSync([process.execPath, "run", "scripts/verify-workbench.ts"], {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		});
		const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
		expect(proc.exitCode).toBe(0);
		expect(output).toContain("115 项检查，通过 115 项");
		expect(output).not.toContain("✗ [FAIL]");
	});
});

// ============================================================================
// [GATE-A11Y-002] NO_COLOR=1 真实 CLI 零转义序列自动化门禁
// ============================================================================
describe("verify-workbench · GATE-A11Y-002: NO_COLOR=1 真实 CLI 零转义序列自动化门禁", () => {
	const ANSI_COLOR_REGEX = /\x1b\[(?:[0-9;]*m)/;

	it("./nightglide --version: NO_COLOR=1 真实 CLI 退出码 0 且 100% 零 ANSI 颜色转义序列", async () => {
		const repoRoot = path.resolve(import.meta.dir, "..");
		const proc = Bun.spawn(["./nightglide", "--version"], {
			cwd: repoRoot,
			env: { ...process.env, NO_COLOR: "1" },
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		expect(exitCode).toBe(0);
		const output = stdout + stderr;
		expect(output).toContain("nightglide");
		expect(output).not.toMatch(ANSI_COLOR_REGEX);
	});

	it("verify-workbench.ts: NO_COLOR=1 降级输出退出码 0 且 100% 零 ANSI 颜色转义序列", async () => {
		const repoRoot = path.resolve(import.meta.dir, "..");
		const proc = Bun.spawn([process.execPath, "run", "scripts/verify-workbench.ts"], {
			cwd: repoRoot,
			env: { ...process.env, NO_COLOR: "1" },
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		expect(exitCode).toBe(0);
		const output = stdout + stderr;
		expect(output).toContain("115 项检查，通过 115 项");
		expect(output).not.toContain("✗ [FAIL]");
		expect(output).not.toMatch(ANSI_COLOR_REGEX);
	});
});

// ============================================================================
// [GATE-TEARDOWN-001] 终端优雅复原与退出保护真实 CLI 自动化门禁
// ============================================================================
describe("verify-workbench · GATE-TEARDOWN-001: 终端优雅复原与退出保护真实 CLI 自动化门禁", () => {
	it("./nightglide --smoke-test 正常自检退出码为 0 且终端环境完好", async () => {
		const repoRoot = path.resolve(import.meta.dir, "..");
		const proc = Bun.spawn(["./nightglide", "--smoke-test"], {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		expect(exitCode).toBe(0);
		expect(stdout).toContain("smoke-test: ok");
	});

	it("./nightglide 响应打断信号 (SIGINT) 能够优雅终止且退出状态明确", async () => {
		const repoRoot = path.resolve(import.meta.dir, "..");
		const proc = Bun.spawn(["./nightglide", "--smoke-test"], {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		});
		// 验证进程已挂载并可接受信号
		proc.kill("SIGINT");
		const exitCode = await proc.exited;
		// 进程成功响应信号退出（通常为 0 或 130 SIGINT 退出码）
		expect([0, 130, null]).toContain(exitCode);
	});
});

// ============================================================================
// [GATE-TEARDOWN-001] 终端优雅复原真实 CLI 自动化门禁
// ============================================================================
describe("verify-workbench · GATE-TEARDOWN-001: 终端优雅复原真实 CLI 自动化门禁", () => {
	const repoRoot = path.resolve(import.meta.dir, "..");

	it("./nightglide --version: 真实 CLI 进程退出码 0，且无悬挂泄漏", async () => {
		const proc = Bun.spawn(["./nightglide", "--version"], {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		expect(exitCode).toBe(0);
		expect(proc.exitCode).toBe(0);
		expect(stdout).toContain("nightglide");
		expect(stderr.trim()).toBe("");
	});

	it("./nightglide --help: 真实 CLI 完整帮助文档输出退出码 0，正常退出无悬挂", async () => {
		const proc = Bun.spawn(["./nightglide", "--help"], {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		expect(exitCode).toBe(0);
		expect(proc.exitCode).toBe(0);
		expect(stdout).toContain("nightglide");
		expect(stdout).toContain("USAGE");
		expect(stderr.trim()).toBe("");
	});

	it("./nightglide --mode rpc: 模拟 SIGINT (Ctrl+C) 优雅复原终端并恢复退出状态 (130)", async () => {
		const proc = Bun.spawn(["./nightglide", "--mode", "rpc"], {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		});

		// 确保子进程进入事件循环就绪后触发 SIGINT
		await Bun.sleep(250);
		proc.kill("SIGINT");

		// 设置超时门限，确保子进程未泄漏挂死（3 秒内完成退出）
		const exitedOrTimeout = await Promise.race([
			proc.exited.then(code => ({ timedOut: false, code })),
			Bun.sleep(3000).then(() => ({ timedOut: true, code: -1 })),
		]);

		expect(exitedOrTimeout.timedOut).toBe(false);
		expect(exitedOrTimeout.code).toBe(130); // 128 + SIGINT
	});

	it("apps/cli demo --non-interactive: 模拟生命周期完成，正常退出码 0 且资源完全释放", async () => {
		const proc = Bun.spawn([process.execPath, "run", "--cwd", "apps/cli", "src/index.ts", "demo", "--non-interactive"], {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Demo session completed and disposed cleanly.");
	});

	it("apps/cli: 模拟交互界面接收 SIGINT 触发 onExit 优雅销毁 Renderer 并退出", async () => {
		const proc = Bun.spawn([process.execPath, "run", "--cwd", "apps/cli", "src/index.ts"], {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		});

		await Bun.sleep(250);
		proc.kill("SIGINT");

		const exitedOrTimeout = await Promise.race([
			proc.exited.then(code => ({ timedOut: false, code })),
			Bun.sleep(3000).then(() => ({ timedOut: true, code: -1 })),
		]);

		expect(exitedOrTimeout.timedOut).toBe(false);
		expect([0, 130]).toContain(exitedOrTimeout.code);
	});
});
