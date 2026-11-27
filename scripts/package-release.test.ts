import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	buildArArchive,
	buildDebBytes,
	buildReleaseTarballBytes,
	buildTar,
	formatSha256Sums,
	generateAptRepo,
	parseArArchive,
	parseCliArgs,
	parseTar,
	readDebControl,
	renderHomebrewFormula,
} from "./package-release";

describe("package-release CLI parsing", () => {
	it("applies defaults and normalizes versions and targets", () => {
		const opts = parseCliArgs(["--version", "v1.2.3", "--targets=linux-x64,linux-arm64,linux-x64", "--deb"], {
			version: "1.0.0",
			repoRoot: "/tmp/nightglide-repo",
		});

		expect(opts.version).toBe("1.2.3");
		expect(opts.targets).toEqual(["linux-x64", "linux-arm64"]);
		expect(opts.deb).toBe(true);
		expect(opts.fetchCrossNatives).toBe(false);
		expect(opts.outDir).toBe(path.resolve("/tmp/nightglide-repo", "dist", "release"));
	});

	it("rejects unknown targets and flags", () => {
		expect(() =>
			parseCliArgs(["--targets", "win32-x64"], { version: "1.0.0", repoRoot: "/tmp/r" }),
		).toThrow(/Unsupported target/);
		expect(() =>
			parseCliArgs(["--unknown-flag"], { version: "1.0.0", repoRoot: "/tmp/r" }),
		).toThrow(/Unknown argument/);
	});
});

describe("POSIX tar & ar builders", () => {
	it("round-trips POSIX tar archives and preserves permissions", async () => {
		const tarBytes = buildTar([
			{ name: "nightglide", type: "file", mode: 0o755, content: Buffer.from("#!/bin/sh\necho ok\n") },
			{ name: "LICENSE", type: "file", mode: 0o644, content: Buffer.from("MIT\n") },
		]);
		const parsed = parseTar(tarBytes);
		expect(parsed).toHaveLength(2);
		expect(parsed[0].name).toBe("nightglide");
		expect(parsed[0].mode).toBe(0o755);
		expect(Buffer.from(parsed[0].content).toString("utf8")).toBe("#!/bin/sh\necho ok\n");

		const tgzBytes = buildReleaseTarballBytes({
			binaryBytes: Buffer.from("bin"),
			licenseBytes: Buffer.from("MIT"),
			noticesBytes: Buffer.from("NOTICES"),
			readmeBytes: Buffer.from("# Nightglide"),
		});
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ng-tar-test-"));
		try {
			const tgzPath = path.join(tmpDir, "test.tar.gz");
			await fs.writeFile(tgzPath, tgzBytes);
			const listProc = Bun.spawnSync(["tar", "-tzf", tgzPath]);
			expect(listProc.exitCode).toBe(0);
			const entries = listProc.stdout.toString("utf8").trim().split("\n");
			expect(entries).toEqual(["nightglide", "LICENSE", "THIRD-PARTY-NOTICES.txt", "README.md"]);
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});

	it("round-trips ar archives including odd-byte padding and validates with host `ar`", async () => {
		const archive = buildArArchive([
			{ name: "odd.txt", content: Buffer.from("12345", "ascii") },
			{ name: "even.txt", content: Buffer.from("1234", "ascii") },
		]);
		const members = parseArArchive(archive);
		expect(members.map(m => m.name)).toEqual(["odd.txt", "even.txt"]);
		expect(Buffer.from(members[0].content).toString("ascii")).toBe("12345");
		expect(Buffer.from(members[1].content).toString("ascii")).toBe("1234");

		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ng-ar-test-"));
		try {
			const arPath = path.join(tmpDir, "test.a");
			await fs.writeFile(arPath, archive);
			const proc = Bun.spawnSync(["ar", "-t", arPath]);
			expect(proc.exitCode).toBe(0);
			expect(proc.stdout.toString("utf8").trim().split("\n")).toEqual(["odd.txt", "even.txt"]);
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});
});

describe(".deb and APT repository packaging", () => {
	it("creates a valid .deb archive readable by `ar` and `tar` with required control fields and permissions", async () => {
		const debBytes = buildDebBytes({
			version: "1.0.0",
			debArch: "amd64",
			binaryBytes: Buffer.from("ELF-DUMMY-BINARY"),
			licenseBytes: Buffer.from("MIT License\n"),
			noticesBytes: Buffer.from("Third Party Notices\n"),
		});

		const { controlText, architecture } = readDebControl(debBytes);
		expect(architecture).toBe("amd64");
		expect(controlText).toContain("Package: nightglide\n");
		expect(controlText).toContain("Version: 1.0.0\n");
		expect(controlText).toContain("Architecture: amd64\n");
		expect(controlText).toContain("Maintainer: ");
		expect(controlText).toContain("License: MIT\n");
		expect(controlText).toContain("Installed-Size: ");
		expect(controlText).toContain("Description: ");

		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ng-deb-test-"));
		try {
			const debPath = path.join(tmpDir, "nightglide_1.0.0_amd64.deb");
			await fs.writeFile(debPath, debBytes);

			const arList = Bun.spawnSync(["ar", "-t", debPath]);
			expect(arList.exitCode).toBe(0);
			expect(arList.stdout.toString("utf8").trim().split("\n")).toEqual([
				"debian-binary",
				"control.tar.gz",
				"data.tar.gz",
			]);

			const debVer = Bun.spawnSync(["ar", "-p", debPath, "debian-binary"]);
			expect(debVer.exitCode).toBe(0);
			expect(debVer.stdout.toString("utf8")).toBe("2.0\n");

			const dataExtract = Bun.spawnSync(["sh", "-c", `ar -p "${debPath}" data.tar.gz | tar -tzvf -`]);
			expect(dataExtract.exitCode).toBe(0);
			const listing = dataExtract.stdout.toString("utf8");
			expect(listing).toContain("./usr/bin/nightglide");
			expect(listing).toContain("./usr/share/doc/nightglide/copyright");
			expect(listing).toContain("./usr/share/doc/nightglide/THIRD-PARTY-NOTICES.txt");
			expect(listing).toMatch(/rwxr-xr-x.*usr\/bin\/nightglide/);
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});

	it("generates APT repository structure with valid Packages, Packages.gz, Release, and pool/*.deb", async () => {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ng-apt-test-"));
		try {
			const amd64Path = path.join(tmpDir, "nightglide_1.0.0_amd64.deb");
			const arm64Path = path.join(tmpDir, "nightglide_1.0.0_arm64.deb");
			const amd64Bytes = buildDebBytes({
				version: "1.0.0",
				debArch: "amd64",
				binaryBytes: Buffer.from("amd64-bin"),
				licenseBytes: Buffer.from("MIT"),
				noticesBytes: Buffer.from("Notices"),
			});
			const arm64Bytes = buildDebBytes({
				version: "1.0.0",
				debArch: "arm64",
				binaryBytes: Buffer.from("arm64-bin"),
				licenseBytes: Buffer.from("MIT"),
				noticesBytes: Buffer.from("Notices"),
			});
			await fs.writeFile(amd64Path, amd64Bytes);
			await fs.writeFile(arm64Path, arm64Bytes);

			const aptDir = path.join(tmpDir, "apt");
			const result = await generateAptRepo({
				debPaths: [amd64Path, arm64Path],
				aptDir,
				date: new Date("2026-11-27T00:00:00Z"),
			});

			expect(result.poolFiles).toHaveLength(2);
			const amdPackages = await fs.readFile(path.join(aptDir, "dists/stable/main/binary-amd64/Packages"), "utf8");
			const armPackages = await fs.readFile(path.join(aptDir, "dists/stable/main/binary-arm64/Packages"), "utf8");
			const amdPackagesGz = await fs.readFile(path.join(aptDir, "dists/stable/main/binary-amd64/Packages.gz"));
			const release = await fs.readFile(path.join(aptDir, "dists/stable/Release"), "utf8");

			expect(amdPackages).toContain("Filename: pool/main/n/nightglide/nightglide_1.0.0_amd64.deb");
			expect(amdPackages).toContain(`Size: ${amd64Bytes.byteLength}`);
			expect(amdPackages).toContain(`SHA256: ${new Bun.CryptoHasher("sha256").update(amd64Bytes).digest("hex")}`);
			expect(armPackages).toContain("Filename: pool/main/n/nightglide/nightglide_1.0.0_arm64.deb");
			expect(Buffer.from(Bun.gunzipSync(amdPackagesGz)).toString("utf8")).toBe(amdPackages);

			expect(release).toContain("Suite: stable");
			expect(release).toContain("Codename: stable");
			expect(release).toContain("Architectures: amd64 arm64");
			expect(release).toContain("main/binary-amd64/Packages");
			expect(release).toContain("main/binary-amd64/Packages.gz");
			expect(release).toContain("main/binary-arm64/Packages");
			expect(release).toContain("main/binary-arm64/Packages.gz");
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true });
		}
	});
});

describe("Homebrew formula & checksums", () => {
	it("renders formula with real SHA256s and rejects missing SHA256s in strict mode", () => {
		const formula = renderHomebrewFormula({
			version: "1.0.0",
			sha256ByTarget: {
				"darwin-arm64": "a".repeat(64),
			},
		});
		expect(formula).toContain('class Nightglide < Formula');
		expect(formula).toContain(
			'url "https://github.com/Aoody743/nightglide-cli/releases/download/v1.0.0/nightglide-v1.0.0-darwin-arm64.tar.gz"',
		);
		expect(formula).toContain(`sha256 "${"a".repeat(64)}"`);
		expect(formula).toContain(`sha256 "${"0".repeat(64)}" # placeholder until darwin-x64 tarball is built`);
		expect(formula).toContain('bin.install "nightglide"');
		expect(formula).toContain('prefix.install "LICENSE"');
		expect(formula).toContain('prefix.install "THIRD-PARTY-NOTICES.txt"');
		expect(formula).toContain('shell_output("#{bin}/nightglide --version")');

		expect(() =>
			renderHomebrewFormula({
				version: "1.0.0",
				sha256ByTarget: { "darwin-arm64": "a".repeat(64) },
				strict: true,
			}),
		).toThrow(/Missing tarball SHA256/);
	});

	it("formats SHA256SUMS.txt sorted by basename", () => {
		const sums = formatSha256Sums([
			{ name: "z.tar.gz", sha256: "2".repeat(64) },
			{ name: "a.deb", sha256: "1".repeat(64) },
		]);
		expect(sums).toBe(`${"1".repeat(64)}  a.deb\n${"2".repeat(64)}  z.tar.gz\n`);
	});

	it("runs --dry-run cleanly without creating build artifacts", async () => {
		const repoRoot = path.resolve(import.meta.dir, "..");
		const proc = Bun.spawn(["bun", "run", "scripts/package-release.ts", "--dry-run", "--deb"], {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "pipe",
		});
		const [exitCode, stdout, stderr] = await Promise.all([
			proc.exited,
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
		]);
		expect(exitCode).toBe(0);
		expect(stderr).toBe("");
		expect(stdout).toContain("[dry-run] version=1.0.0");
		expect(stdout).toContain("class Nightglide < Formula");
	});
});
