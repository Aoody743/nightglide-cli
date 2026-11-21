/**
 * Launcher gates: run the real `./nightglide` entry and check what a user's
 * terminal sees — NO_COLOR output, clean exits and SIGINT recovery, and
 * isolation from a foreign bunfig preload in the calling directory.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

// ============================================================================
// [GATE-A11Y-002] NO_COLOR=1 真实 CLI 零转义序列自动化门禁
// ============================================================================
describe("launcher · GATE-A11Y-002: NO_COLOR=1 真实 CLI 零转义序列自动化门禁", () => {
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
});

// ============================================================================
// [GATE-TEARDOWN-001] 终端优雅复原真实 CLI 自动化门禁
// ============================================================================
describe("launcher · GATE-TEARDOWN-001: 终端优雅复原真实 CLI 自动化门禁", () => {
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

	it("./nightglide --smoke-test: 正常自检退出码 0 且终端环境完好", async () => {
		const proc = Bun.spawn(["./nightglide", "--smoke-test"], {
			cwd: repoRoot,
			// The smoke test fetches a local stats server; a shell http_proxy must not intercept it.
			env: { ...process.env, NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" },
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		expect(exitCode).toBe(0);
		expect(stdout).toContain("smoke-test: ok");
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
});

// ============================================================================
// [GATE-LAUNCH-002] 启动器外来 bunfig preload 防护真实 CLI 自动化门禁
// Bun 会读取调用目录的 bunfig.toml 并在其 preload 中执行外来代码；./nightglide
// 必须先 cd 到 bunfig-free 目录再启动，使调用目录声明的 preload 不可能执行。
// ============================================================================
describe("launcher · GATE-LAUNCH-002: 启动器隔离调用目录外来 bunfig preload", () => {
	it("./nightglide --version 从携带会 exit(9) 的 poison bunfig 目录调用：poison 不执行且退出码 0", async () => {
		const repoRoot = path.resolve(import.meta.dir, "..");
		const poisonDir = await fs.mkdtemp(path.join(os.tmpdir(), "ng-poison-bunfig-"));
		try {
			await Bun.write(path.join(poisonDir, "bunfig.toml"), 'preload = ["./poison.ts"]\n');
			await Bun.write(
				path.join(poisonDir, "poison.ts"),
				'process.stdout.write("POISON-PRELOAD-EXECUTED\\n");\nprocess.exit(9);\n',
			);
			const proc = Bun.spawn([path.join(repoRoot, "nightglide"), "--version"], {
				cwd: poisonDir,
				stdout: "pipe",
				stderr: "pipe",
			});
			const stdout = await new Response(proc.stdout).text();
			const exitCode = await proc.exited;

			expect(exitCode).toBe(0);
			expect(stdout).toContain("nightglide/");
			expect(stdout).not.toContain("POISON-PRELOAD-EXECUTED");
		} finally {
			await fs.rm(poisonDir, { recursive: true, force: true });
		}
	});
});
