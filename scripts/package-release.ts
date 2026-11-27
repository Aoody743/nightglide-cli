#!/usr/bin/env bun
/**
 * Release packager for Nightglide CLI.
 *
 * Compiles standalone Nightglide executables via the vendored OMP binary pipeline,
 * packages release tarballs, Debian `.deb` packages and a static APT repository,
 * computes `SHA256SUMS.txt`, and renders the Homebrew tap formula.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export type ReleaseTargetId = "darwin-arm64" | "darwin-x64" | "linux-x64" | "linux-arm64";
export type DebArch = "amd64" | "arm64";

export interface ReleaseTargetConfig {
	readonly id: ReleaseTargetId;
	readonly platform: "darwin" | "linux";
	readonly arch: "arm64" | "x64";
	readonly bunTarget: Bun.Build.CompileTarget;
	readonly debArch?: DebArch;
}

export const RELEASE_TARGETS: Readonly<Record<ReleaseTargetId, ReleaseTargetConfig>> = Object.freeze({
	"darwin-arm64": {
		id: "darwin-arm64",
		platform: "darwin",
		arch: "arm64",
		bunTarget: "bun-darwin-arm64",
	},
	"darwin-x64": {
		id: "darwin-x64",
		platform: "darwin",
		arch: "x64",
		bunTarget: "bun-darwin-x64",
	},
	"linux-x64": {
		id: "linux-x64",
		platform: "linux",
		arch: "x64",
		bunTarget: "bun-linux-x64-baseline",
		debArch: "amd64",
	},
	"linux-arm64": {
		id: "linux-arm64",
		platform: "linux",
		arch: "arm64",
		bunTarget: "bun-linux-arm64",
		debArch: "arm64",
	},
});

export const ALL_TARGET_IDS: readonly ReleaseTargetId[] = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64"];
export const GITHUB_REPO_SLUG = "Aoody743/nightglide-cli";
export const GITHUB_RELEASE_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO_SLUG}/releases/download`;
export const NIGHTGLIDE_HOMEPAGE = `https://github.com/${GITHUB_REPO_SLUG}`;
export const PACKAGE_DESCRIPTION = "Terminal AI coding agent CLI (built on Oh My Pi)";
export const DEB_MAINTAINER = "Nightglide Contributors <maintainers@nightglide.dev>";

const TAR_BLOCK_SIZE = 512;
const AR_MAGIC = "!<arch>\n";
const SHA256_PLACEHOLDER = "0".repeat(64);
const VERSION_PATTERN = /^[0-9A-Za-z._+-]+$/;

export interface PackageReleaseOptions {
	readonly version: string;
	readonly targets: readonly ReleaseTargetId[];
	readonly fetchCrossNatives: boolean;
	readonly deb: boolean;
	readonly assembleOnly: boolean;
	readonly strictFormula: boolean;
	readonly dryRun: boolean;
	readonly help: boolean;
	readonly outDir: string;
	readonly aptDir: string;
	readonly formulaOut: string;
}

export interface TarEntryInput {
	readonly name: string;
	readonly type: "file" | "dir";
	readonly mode: number;
	readonly content?: Uint8Array;
	readonly mtime?: number;
}

export interface ParsedTarEntry {
	readonly name: string;
	readonly type: "file" | "dir" | "other";
	readonly mode: number;
	readonly content: Uint8Array;
}

export interface ArMember {
	readonly name: string;
	readonly content: Uint8Array;
	readonly mode?: number;
	readonly mtime?: number;
}

export interface DebPackageOptions {
	readonly version: string;
	readonly debArch: DebArch;
	readonly binaryBytes: Uint8Array;
	readonly licenseBytes: Uint8Array;
	readonly noticesBytes: Uint8Array;
}

export interface ChecksumEntry {
	readonly name: string;
	readonly sha256: string;
}

export interface AptRepoResult {
	readonly poolFiles: readonly string[];
	readonly architectures: readonly DebArch[];
	readonly releasePath: string;
}

export function normalizeVersion(raw: string): string {
	const trimmed = raw.trim().replace(/^v/, "");
	if (!trimmed || !VERSION_PATTERN.test(trimmed)) {
		throw new Error(`Invalid release version "${raw}"`);
	}
	return trimmed;
}

export function parseTargetsCsv(raw: string): ReleaseTargetId[] {
	const parts = raw
		.split(",")
		.map(part => part.trim())
		.filter(Boolean);
	if (parts.length === 0) {
		throw new Error("--targets requires at least one target");
	}
	const unique: ReleaseTargetId[] = [];
	for (const part of parts) {
		if (!(part in RELEASE_TARGETS)) {
			throw new Error(`Unsupported target "${part}". Supported targets: ${ALL_TARGET_IDS.join(", ")}`);
		}
		const targetId = part as ReleaseTargetId;
		if (!unique.includes(targetId)) {
			unique.push(targetId);
		}
	}
	return unique;
}

export function parseCliArgs(
	argv: readonly string[],
	defaults: { version: string; repoRoot: string },
): PackageReleaseOptions {
	let version = normalizeVersion(defaults.version);
	let targets: ReleaseTargetId[] = ["darwin-arm64"];
	let fetchCrossNatives = false;
	let deb = false;
	let assembleOnly = false;
	let strictFormula = false;
	let dryRun = false;
	let help = false;
	let outDir = path.join(defaults.repoRoot, "dist", "release");
	let aptDir = path.join(defaults.repoRoot, "dist", "apt");
	let formulaOut = path.join(defaults.repoRoot, "packaging", "homebrew", "nightglide.rb");

	const requireValue = (flag: string, index: number): string => {
		const value = argv[index + 1];
		if (!value || value.startsWith("-")) {
			throw new Error(`${flag} requires a value`);
		}
		return value;
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "-h" || arg === "--help") {
			help = true;
		} else if (arg === "--fetch-cross-natives") {
			fetchCrossNatives = true;
		} else if (arg === "--deb") {
			deb = true;
		} else if (arg === "--assemble-only") {
			assembleOnly = true;
		} else if (arg === "--strict-formula") {
			strictFormula = true;
		} else if (arg === "--dry-run") {
			dryRun = true;
		} else if (arg === "--version") {
			version = normalizeVersion(requireValue("--version", i));
			i++;
		} else if (arg.startsWith("--version=")) {
			version = normalizeVersion(arg.slice("--version=".length));
		} else if (arg === "--targets") {
			targets = parseTargetsCsv(requireValue("--targets", i));
			i++;
		} else if (arg.startsWith("--targets=")) {
			targets = parseTargetsCsv(arg.slice("--targets=".length));
		} else if (arg === "--out-dir") {
			outDir = path.resolve(requireValue("--out-dir", i));
			i++;
		} else if (arg.startsWith("--out-dir=")) {
			outDir = path.resolve(arg.slice("--out-dir=".length));
		} else if (arg === "--apt-dir") {
			aptDir = path.resolve(requireValue("--apt-dir", i));
			i++;
		} else if (arg.startsWith("--apt-dir=")) {
			aptDir = path.resolve(arg.slice("--apt-dir=".length));
		} else if (arg === "--formula-out") {
			formulaOut = path.resolve(requireValue("--formula-out", i));
			i++;
		} else if (arg.startsWith("--formula-out=")) {
			formulaOut = path.resolve(arg.slice("--formula-out=".length));
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return {
		version,
		targets,
		fetchCrossNatives,
		deb,
		assembleOnly,
		strictFormula,
		dryRun,
		help,
		outDir,
		aptDir,
		formulaOut,
	};
}

function usageText(): string {
	return `Usage: bun scripts/package-release.ts [options]

Options:
  --version <ver>         Release version (default: root package.json version)
  --targets <csv>         Comma-separated targets (default: darwin-arm64)
                          Supported: ${ALL_TARGET_IDS.join(", ")}
  --fetch-cross-natives   Download missing cross-target @oh-my-pi/pi-natives-* addons
                          via npm pack into a temp stage dir (cleaned up after build)
  --deb                   Build .deb packages for Linux targets and generate dist/apt/
  --assemble-only         Skip binary compilation; assemble checksums, formula, and APT repo
  --strict-formula        Fail if any Homebrew target tarball is missing
  --dry-run               Print planned operations and render template outputs without building
  --out-dir <dir>         Release output directory (default: dist/release)
  --apt-dir <dir>         APT repository output directory (default: dist/apt)
  --formula-out <path>    Homebrew formula path (default: packaging/homebrew/nightglide.rb)
  -h, --help              Show this help
`;
}

function splitTarPath(fullPath: string): { name: string; prefix: string } {
	const nameBytes = Buffer.byteLength(fullPath, "utf8");
	if (nameBytes <= 100) {
		return { name: fullPath, prefix: "" };
	}
	for (let splitAt = fullPath.lastIndexOf("/"); splitAt > 0; splitAt = fullPath.lastIndexOf("/", splitAt - 1)) {
		const prefix = fullPath.slice(0, splitAt);
		const name = fullPath.slice(splitAt + 1);
		if (Buffer.byteLength(prefix, "utf8") <= 155 && Buffer.byteLength(name, "utf8") <= 100) {
			return { name, prefix };
		}
	}
	throw new Error(`Tar path exceeds POSIX USTAR limits: ${fullPath}`);
}

function writeAsciiField(buf: Uint8Array, offset: number, length: number, value: string): void {
	const encoded = Buffer.from(value, "utf8");
	if (encoded.length > length) {
		throw new Error(`Value "${value}" exceeds ${length}-byte tar field`);
	}
	buf.set(encoded, offset);
}

function writeOctalField(buf: Uint8Array, offset: number, length: number, value: number): void {
	const octal = value.toString(8);
	if (octal.length >= length) {
		throw new Error(`Octal value ${value} (${octal}) does not fit in ${length} bytes`);
	}
	buf.fill(0x30, offset, offset + length - 1);
	buf.set(Buffer.from(octal, "ascii"), offset + length - 1 - octal.length);
	buf[offset + length - 1] = 0;
}

/** Build a deterministic POSIX USTAR tar archive owned by root:root. */
export function buildTar(entries: readonly TarEntryInput[]): Uint8Array {
	const chunks: Uint8Array[] = [];

	for (const entry of entries) {
		const isDir = entry.type === "dir";
		const content = isDir ? new Uint8Array(0) : (entry.content ?? new Uint8Array(0));
		const normalizedName = isDir && !entry.name.endsWith("/") ? `${entry.name}/` : entry.name;
		const { name, prefix } = splitTarPath(normalizedName);

		const header = new Uint8Array(TAR_BLOCK_SIZE);
		writeAsciiField(header, 0, 100, name);
		writeOctalField(header, 100, 8, entry.mode);
		writeOctalField(header, 108, 8, 0);
		writeOctalField(header, 116, 8, 0);
		writeOctalField(header, 124, 12, content.byteLength);
		writeOctalField(header, 136, 12, entry.mtime ?? 0);
		header.fill(0x20, 148, 156);
		header[156] = isDir ? 0x35 : 0x30;
		writeAsciiField(header, 257, 6, "ustar");
		writeAsciiField(header, 263, 2, "00");
		writeAsciiField(header, 265, 32, "root");
		writeAsciiField(header, 297, 32, "root");
		writeOctalField(header, 329, 8, 0);
		writeOctalField(header, 337, 8, 0);
		if (prefix) {
			writeAsciiField(header, 345, 155, prefix);
		}

		let checksum = 0;
		for (const byte of header) checksum += byte;
		const checksumOctal = checksum.toString(8).padStart(6, "0");
		header.set(Buffer.from(checksumOctal, "ascii"), 148);
		header[154] = 0;
		header[155] = 0x20;
		chunks.push(header);

		if (content.byteLength > 0) {
			chunks.push(content);
			const rem = content.byteLength % TAR_BLOCK_SIZE;
			if (rem !== 0) {
				chunks.push(new Uint8Array(TAR_BLOCK_SIZE - rem));
			}
		}
	}

	chunks.push(new Uint8Array(TAR_BLOCK_SIZE * 2));
	return Buffer.concat(chunks);
}

function readTarString(header: Uint8Array, offset: number, length: number): string {
	return Buffer.from(header.subarray(offset, offset + length))
		.toString("utf8")
		.replace(/\0.*$/, "");
}

function readTarOctal(header: Uint8Array, offset: number, length: number): number {
	const raw = readTarString(header, offset, length).trim();
	return raw ? Number.parseInt(raw, 8) : 0;
}

/** Parse a POSIX USTAR tar buffer into its entries. */
export function parseTar(tarBytes: Uint8Array): ParsedTarEntry[] {
	const entries: ParsedTarEntry[] = [];
	let offset = 0;
	while (offset + TAR_BLOCK_SIZE <= tarBytes.length) {
		const header = tarBytes.subarray(offset, offset + TAR_BLOCK_SIZE);
		if (header.every(byte => byte === 0)) {
			break;
		}
		const name = readTarString(header, 0, 100);
		const prefix = readTarString(header, 345, 155);
		const fullName = prefix ? `${prefix}/${name}` : name;
		const mode = readTarOctal(header, 100, 8);
		const size = readTarOctal(header, 124, 12);
		const typeFlag = header[156];
		const type: ParsedTarEntry["type"] = typeFlag === 0x35 ? "dir" : typeFlag === 0x30 || typeFlag === 0 ? "file" : "other";
		offset += TAR_BLOCK_SIZE;
		if (offset + size > tarBytes.length) {
			throw new Error(`Truncated tar entry payload for ${fullName}`);
		}
		const content = tarBytes.slice(offset, offset + size);
		entries.push({ name: fullName, type, mode, content });
		offset += Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
	}
	return entries;
}

/** Build a standard UNIX `ar` archive compatible with Debian `dpkg-deb` and BSD `ar`. */
export function buildArArchive(members: readonly ArMember[]): Uint8Array {
	const chunks: Uint8Array[] = [Buffer.from(AR_MAGIC, "ascii")];
	for (const member of members) {
		if (Buffer.byteLength(member.name, "ascii") > 15) {
			throw new Error(`ar member name "${member.name}" exceeds 15-char short header limit`);
		}
		const headerLine =
			member.name.padEnd(16, " ") +
			String(member.mtime ?? 0).padEnd(12, " ") +
			"0".padEnd(6, " ") +
			"0".padEnd(6, " ") +
			(member.mode ?? 0o100644).toString(8).padEnd(8, " ") +
			String(member.content.byteLength).padEnd(10, " ") +
			"`\n";
		const header = Buffer.from(headerLine, "ascii");
		if (header.length !== 60) {
			throw new Error(`Internal error: ar header length ${header.length} != 60`);
		}
		chunks.push(header);
		chunks.push(member.content);
		if (member.content.byteLength % 2 === 1) {
			chunks.push(Uint8Array.from([0x0a]));
		}
	}
	return Buffer.concat(chunks);
}

/** Parse a UNIX `ar` archive into its members. */
export function parseArArchive(arBytes: Uint8Array): ArMember[] {
	const magic = Buffer.from(arBytes.subarray(0, AR_MAGIC.length)).toString("ascii");
	if (magic !== AR_MAGIC) {
		throw new Error(`Invalid ar archive magic: ${JSON.stringify(magic)}`);
	}
	const members: ArMember[] = [];
	let offset = AR_MAGIC.length;
	while (offset < arBytes.length) {
		if (offset + 60 > arBytes.length) {
			throw new Error("Truncated ar member header");
		}
		const header = Buffer.from(arBytes.subarray(offset, offset + 60)).toString("ascii");
		if (!header.endsWith("`\n")) {
			throw new Error(`Invalid ar member header trailer: ${JSON.stringify(header)}`);
		}
		const rawName = header.slice(0, 16).trimEnd();
		const name = rawName.endsWith("/") && rawName.length > 1 ? rawName.slice(0, -1) : rawName;
		const mtime = Number.parseInt(header.slice(16, 28).trim(), 10);
		const mode = Number.parseInt(header.slice(40, 48).trim(), 8);
		const size = Number.parseInt(header.slice(48, 58).trim(), 10);
		offset += 60;
		if (offset + size > arBytes.length) {
			throw new Error(`Truncated ar member payload for ${name}`);
		}
		members.push({ name, mtime, mode, content: arBytes.slice(offset, offset + size) });
		offset += size + (size % 2);
	}
	return members;
}

export function renderDebControl(input: {
	readonly version: string;
	readonly debArch: DebArch;
	readonly installedSizeKiB: number;
}): string {
	return [
		"Package: nightglide",
		`Version: ${input.version}`,
		`Architecture: ${input.debArch}`,
		`Maintainer: ${DEB_MAINTAINER}`,
		`Installed-Size: ${input.installedSizeKiB}`,
		"Section: utils",
		"Priority: optional",
		"License: MIT",
		`Homepage: ${NIGHTGLIDE_HOMEPAGE}`,
		`Description: ${PACKAGE_DESCRIPTION}`,
		" Nightglide CLI is a fast terminal coding agent built on Oh My Pi.",
		"",
	].join("\n");
}

/** Package a Debian `.deb` archive without requiring `dpkg-deb` on the host. */
export function buildDebBytes(options: DebPackageOptions): Uint8Array {
	const totalPayloadBytes =
		options.binaryBytes.byteLength + options.licenseBytes.byteLength + options.noticesBytes.byteLength;
	const installedSizeKiB = Math.max(1, Math.ceil(totalPayloadBytes / 1024));
	const controlText = renderDebControl({
		version: options.version,
		debArch: options.debArch,
		installedSizeKiB,
	});

	const controlTar = buildTar([
		{ name: ".", type: "dir", mode: 0o755 },
		{ name: "./control", type: "file", mode: 0o644, content: Buffer.from(controlText, "utf8") },
	]);
	const controlTarGz = Bun.gzipSync(controlTar, { level: 9 });

	const dataTar = buildTar([
		{ name: ".", type: "dir", mode: 0o755 },
		{ name: "./usr", type: "dir", mode: 0o755 },
		{ name: "./usr/bin", type: "dir", mode: 0o755 },
		{ name: "./usr/bin/nightglide", type: "file", mode: 0o755, content: options.binaryBytes },
		{ name: "./usr/share", type: "dir", mode: 0o755 },
		{ name: "./usr/share/doc", type: "dir", mode: 0o755 },
		{ name: "./usr/share/doc/nightglide", type: "dir", mode: 0o755 },
		{ name: "./usr/share/doc/nightglide/copyright", type: "file", mode: 0o644, content: options.licenseBytes },
		{
			name: "./usr/share/doc/nightglide/THIRD-PARTY-NOTICES.txt",
			type: "file",
			mode: 0o644,
			content: options.noticesBytes,
		},
	]);
	const dataTarGz = Bun.gzipSync(dataTar, { level: 9 });

	return buildArArchive([
		{ name: "debian-binary", content: Buffer.from("2.0\n", "ascii"), mode: 0o100644 },
		{ name: "control.tar.gz", content: controlTarGz, mode: 0o100644 },
		{ name: "data.tar.gz", content: dataTarGz, mode: 0o100644 },
	]);
}

/** Extract the `./control` text and `Architecture` field from any `.deb` archive bytes. */
export function readDebControl(debBytes: Uint8Array): { controlText: string; architecture: DebArch } {
	const members = parseArArchive(debBytes);
	const controlArchive = members.find(member => member.name === "control.tar.gz");
	if (!controlArchive) {
		throw new Error("Invalid .deb package: missing control.tar.gz");
	}
	const controlTar = Bun.gunzipSync(controlArchive.content);
	const tarEntries = parseTar(controlTar);
	const controlEntry = tarEntries.find(
		entry => entry.type === "file" && (entry.name === "./control" || entry.name === "control"),
	);
	if (!controlEntry) {
		throw new Error("Invalid .deb package: control.tar.gz missing ./control");
	}
	const controlText = Buffer.from(controlEntry.content).toString("utf8");
	const archMatch = /^Architecture:\s*(amd64|arm64)\s*$/m.exec(controlText);
	if (!archMatch) {
		throw new Error(`Unsupported or missing Architecture field in .deb control:\n${controlText}`);
	}
	return { controlText, architecture: archMatch[1] as DebArch };
}

function hashBytes(algorithm: "md5" | "sha1" | "sha256", bytes: Uint8Array): string {
	return new Bun.CryptoHasher(algorithm).update(bytes).digest("hex");
}

/** Generate a static APT repository under `aptDir` from a set of `.deb` files. */
export async function generateAptRepo(options: {
	readonly debPaths: readonly string[];
	readonly aptDir: string;
	readonly date?: Date;
}): Promise<AptRepoResult> {
	const poolRelDir = "pool/main/n/nightglide";
	const poolAbsDir = path.join(options.aptDir, poolRelDir);
	await fs.rm(options.aptDir, { recursive: true, force: true });
	await fs.mkdir(poolAbsDir, { recursive: true });

	const stanzasByArch: Record<DebArch, string[]> = { amd64: [], arm64: [] };
	const poolFiles: string[] = [];
	const sortedDebPaths = [...options.debPaths].sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

	for (const debPath of sortedDebPaths) {
		const debBytes = await fs.readFile(debPath);
		const basename = path.basename(debPath);
		const poolDest = path.join(poolAbsDir, basename);
		await fs.writeFile(poolDest, debBytes);
		poolFiles.push(poolDest);

		const { controlText, architecture } = readDebControl(debBytes);
		const stanza = [
			controlText.trimEnd(),
			`Filename: ${poolRelDir}/${basename}`,
			`Size: ${debBytes.byteLength}`,
			`MD5sum: ${hashBytes("md5", debBytes)}`,
			`SHA1: ${hashBytes("sha1", debBytes)}`,
			`SHA256: ${hashBytes("sha256", debBytes)}`,
		].join("\n");
		stanzasByArch[architecture].push(stanza);
	}

	const releaseFiles: Array<{ relPath: string; bytes: Uint8Array }> = [];
	const arches: readonly DebArch[] = ["amd64", "arm64"];
	for (const arch of arches) {
		const binRelDir = `main/binary-${arch}`;
		const binAbsDir = path.join(options.aptDir, "dists", "stable", binRelDir);
		await fs.mkdir(binAbsDir, { recursive: true });
		const stanzas = stanzasByArch[arch];
		const packagesText = stanzas.length > 0 ? `${stanzas.join("\n\n")}\n` : "";
		const packagesBytes = Buffer.from(packagesText, "utf8");
		const packagesGzBytes = Bun.gzipSync(packagesBytes, { level: 9 });

		await fs.writeFile(path.join(binAbsDir, "Packages"), packagesBytes);
		await fs.writeFile(path.join(binAbsDir, "Packages.gz"), packagesGzBytes);

		releaseFiles.push({ relPath: `${binRelDir}/Packages`, bytes: packagesBytes });
		releaseFiles.push({ relPath: `${binRelDir}/Packages.gz`, bytes: packagesGzBytes });
	}

	const utcDate = (options.date ?? new Date()).toUTCString().replace(/GMT$/, "UTC");
	const formatChecksums = (algorithm: "md5" | "sha1" | "sha256"): string[] =>
		releaseFiles.map(
			file => ` ${hashBytes(algorithm, file.bytes)} ${String(file.bytes.byteLength).padStart(16, " ")} ${file.relPath}`,
		);

	const releaseText = [
		"Origin: Nightglide",
		"Label: Nightglide",
		"Suite: stable",
		"Codename: stable",
		`Date: ${utcDate}`,
		"Architectures: amd64 arm64",
		"Components: main",
		"Description: Nightglide CLI APT Repository",
		"MD5Sum:",
		...formatChecksums("md5"),
		"SHA1:",
		...formatChecksums("sha1"),
		"SHA256:",
		...formatChecksums("sha256"),
		"",
	].join("\n");

	const releasePath = path.join(options.aptDir, "dists", "stable", "Release");
	await fs.writeFile(releasePath, releaseText, "utf8");
	return {
		poolFiles,
		architectures: arches,
		releasePath,
	};
}

export function buildReleaseTarballBytes(input: {
	readonly binaryBytes: Uint8Array;
	readonly licenseBytes: Uint8Array;
	readonly noticesBytes: Uint8Array;
	readonly readmeBytes?: Uint8Array | null;
}): Uint8Array {
	const entries: TarEntryInput[] = [
		{ name: "nightglide", type: "file", mode: 0o755, content: input.binaryBytes },
		{ name: "LICENSE", type: "file", mode: 0o644, content: input.licenseBytes },
		{ name: "THIRD-PARTY-NOTICES.txt", type: "file", mode: 0o644, content: input.noticesBytes },
	];
	if (input.readmeBytes) {
		entries.push({ name: "README.md", type: "file", mode: 0o644, content: input.readmeBytes });
	}
	return Bun.gzipSync(buildTar(entries), { level: 9 });
}

export function formatSha256Sums(entries: readonly ChecksumEntry[]): string {
	return entries
		.slice()
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(({ sha256, name }) => `${sha256}  ${name}\n`)
		.join("");
}

export async function computeSha256(filePath: string): Promise<string> {
	const hasher = new Bun.CryptoHasher("sha256");
	for await (const chunk of Bun.file(filePath).stream()) {
		hasher.update(chunk);
	}
	return hasher.digest("hex");
}

export function renderHomebrewFormula(input: {
	readonly version: string;
	readonly sha256ByTarget: Partial<Record<ReleaseTargetId, string>>;
	readonly strict?: boolean;
}): string {
	const resolveTarget = (target: ReleaseTargetId): { url: string; shaLine: string } => {
		const url = `${GITHUB_RELEASE_DOWNLOAD_URL}/v${input.version}/nightglide-v${input.version}-${target}.tar.gz`;
		const sha256 = input.sha256ByTarget[target];
		if (!sha256) {
			if (input.strict) {
				throw new Error(`Missing tarball SHA256 for Homebrew formula target: ${target}`);
			}
			return {
				url,
				shaLine: `sha256 "${SHA256_PLACEHOLDER}" # placeholder until ${target} tarball is built`,
			};
		}
		return { url, shaLine: `sha256 "${sha256}"` };
	};

	const darwinArm = resolveTarget("darwin-arm64");
	const darwinIntel = resolveTarget("darwin-x64");
	const linuxArm = resolveTarget("linux-arm64");
	const linuxIntel = resolveTarget("linux-x64");

	return `class Nightglide < Formula
  desc "${PACKAGE_DESCRIPTION}"
  homepage "${NIGHTGLIDE_HOMEPAGE}"
  version "${input.version}"
  license "MIT"

  on_macos do
    on_arm do
      url "${darwinArm.url}"
      ${darwinArm.shaLine}
    end

    on_intel do
      url "${darwinIntel.url}"
      ${darwinIntel.shaLine}
    end
  end

  on_linux do
    on_arm do
      url "${linuxArm.url}"
      ${linuxArm.shaLine}
    end

    on_intel do
      url "${linuxIntel.url}"
      ${linuxIntel.shaLine}
    end
  end

  def install
    bin.install "nightglide"
    prefix.install "LICENSE"
    prefix.install "THIRD-PARTY-NOTICES.txt"
    prefix.install "README.md" if File.exist?("README.md")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/nightglide --version")
  end
end
`;
}

async function runChecked(command: string[], cwd: string): Promise<void> {
	const proc = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" });
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		throw new Error(`Command failed (exit ${exitCode}): ${command.join(" ")}`);
	}
}

function expectedNativeAddons(target: ReleaseTargetConfig): string[] {
	return target.arch === "x64"
		? [`pi_natives.${target.id}-modern.node`, `pi_natives.${target.id}-baseline.node`]
		: [`pi_natives.${target.id}.node`];
}

async function prepareCrossNatives(input: {
	readonly ompRoot: string;
	readonly targets: readonly ReleaseTargetId[];
	readonly fetchCrossNatives: boolean;
}): Promise<() => Promise<void>> {
	const nativeDir = path.join(input.ompRoot, "packages", "natives", "native");
	const nativesPkg = (await Bun.file(path.join(input.ompRoot, "packages", "natives", "package.json")).json()) as {
		version: string;
	};
	const nativesVersion = nativesPkg.version;

	const existing = new Set(await fs.readdir(nativeDir));
	const missingTargets = input.targets.filter(targetId => {
		const expected = expectedNativeAddons(RELEASE_TARGETS[targetId]);
		return !expected.some(filename => existing.has(filename));
	});

	if (missingTargets.length === 0) {
		return async () => {};
	}

	if (!input.fetchCrossNatives) {
		throw new Error(
			`Missing native addon(s) for target(s): ${missingTargets.join(", ")} in ${nativeDir}. ` +
				`Build natively via \`bun --cwd=vendor/omp run build:native\` or pass --fetch-cross-natives.`,
		);
	}

	const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "nightglide-cross-natives-"));
	const placedFiles: string[] = [];

	const cleanup = async (): Promise<void> => {
		for (const file of placedFiles) {
			await fs.rm(file, { force: true }).catch(() => {});
		}
		await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
	};

	try {
		for (const targetId of missingTargets) {
			const pkgSpec = `@oh-my-pi/pi-natives-${targetId}@${nativesVersion}`;
			const targetStage = path.join(stageDir, targetId);
			await fs.mkdir(targetStage, { recursive: true });
			console.log(`Fetching cross-target native addon: ${pkgSpec}`);

			const packProc = Bun.spawn(["npm", "pack", pkgSpec, "--silent"], {
				cwd: targetStage,
				stdout: "pipe",
				stderr: "pipe",
			});
			const [exitCode, stdout, stderr] = await Promise.all([
				packProc.exited,
				new Response(packProc.stdout).text(),
				new Response(packProc.stderr).text(),
			]);
			if (exitCode !== 0) {
				throw new Error(`npm pack ${pkgSpec} failed (exit ${exitCode}): ${stderr.trim()}`);
			}
			const tgzName = stdout
				.trim()
				.split(/\r?\n/)
				.filter(Boolean)
				.at(-1);
			if (!tgzName) {
				throw new Error(`npm pack ${pkgSpec} produced no tarball name`);
			}

			const extractDir = path.join(targetStage, "extracted");
			await fs.mkdir(extractDir, { recursive: true });
			await runChecked(["tar", "-xzf", path.join(targetStage, tgzName), "-C", extractDir], targetStage);

			const packageDir = path.join(extractDir, "package");
			const entries = await fs.readdir(packageDir);
			const nodeFiles = entries.filter(entry => entry.endsWith(".node"));
			if (nodeFiles.length === 0) {
				throw new Error(`Package ${pkgSpec} contained no .node addon files`);
			}

			for (const nodeFile of nodeFiles) {
				const destPath = path.join(nativeDir, nodeFile);
				if (!existing.has(nodeFile)) {
					await fs.copyFile(path.join(packageDir, nodeFile), destPath);
					placedFiles.push(destPath);
					existing.add(nodeFile);
				}
			}
		}
	} catch (error) {
		await cleanup();
		throw error;
	}

	return cleanup;
}

async function compileTargetBinaries(input: {
	readonly repoRoot: string;
	readonly ompRoot: string;
	readonly version: string;
	readonly targets: readonly ReleaseTargetId[];
	readonly outDir: string;
	readonly fetchCrossNatives: boolean;
}): Promise<Map<ReleaseTargetId, string>> {
	const { compileCodingAgent } = await import("../vendor/omp/packages/coding-agent/scripts/compile-binary");
	const codingAgentDir = path.join(input.ompRoot, "packages", "coding-agent");
	const entrypoint = path.join(codingAgentDir, "src", "cli.ts");
	const entitlementsPath = path.join(input.ompRoot, "scripts", "macos-entitlements.plist");

	const cleanupCrossNatives = await prepareCrossNatives({
		ompRoot: input.ompRoot,
		targets: input.targets,
		fetchCrossNatives: input.fetchCrossNatives,
	});

	const builtBinaries = new Map<ReleaseTargetId, string>();
	try {
		await runChecked(["bun", "--cwd=packages/stats", "run", "gen:stats"], input.ompRoot);
		await runChecked(["bun", "--cwd=packages/collab-web", "run", "gen:export-viewer", "--check"], input.ompRoot);

		for (const targetId of input.targets) {
			const config = RELEASE_TARGETS[targetId];
			const binaryPath = path.join(input.outDir, `nightglide-v${input.version}-${targetId}`);
			const shouldAdhocSign = process.platform === "darwin" && config.platform === "darwin";

			console.log(`Compiling Nightglide CLI (${targetId}) -> ${binaryPath}`);
			await compileCodingAgent({
				repoRoot: input.ompRoot,
				entrypoint,
				outfile: binaryPath,
				native: { platform: config.platform, arch: config.arch },
				target: config.bunTarget,
				minifyIdentifiers: true,
				skipBuiltinCodesign: shouldAdhocSign,
			});

			if (shouldAdhocSign) {
				await runChecked(
					["codesign", "--force", "--sign", "-", "--entitlements", entitlementsPath, binaryPath],
					input.repoRoot,
				);
			}
			await fs.chmod(binaryPath, 0o755);
			builtBinaries.set(targetId, binaryPath);
		}
	} finally {
		await runChecked(["bun", "--cwd=packages/stats", "run", "gen:stats:reset"], input.ompRoot).catch(err => {
			console.warn(`Warning: failed to reset stats bundle: ${err instanceof Error ? err.message : String(err)}`);
		});
		await cleanupCrossNatives();
	}

	return builtBinaries;
}

async function readOptionalBytes(filePath: string): Promise<Uint8Array | null> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) return null;
	return file.bytes();
}

export async function packageRelease(options: PackageReleaseOptions, repoRoot: string): Promise<void> {
	const ompRoot = path.join(repoRoot, "vendor", "omp");
	const licensePath = path.join(repoRoot, "LICENSE");
	const noticesPath = path.join(repoRoot, "THIRD-PARTY-NOTICES.txt");
	const readmePath = path.join(repoRoot, "README.md");

	if (options.dryRun) {
		console.log(`[dry-run] version=${options.version}`);
		console.log(`[dry-run] targets=${options.targets.join(",")}`);
		console.log(`[dry-run] fetchCrossNatives=${options.fetchCrossNatives} deb=${options.deb}`);
		console.log(`[dry-run] outDir=${options.outDir}`);
		console.log(`[dry-run] aptDir=${options.aptDir}`);
		console.log(`[dry-run] formulaOut=${options.formulaOut}`);
		for (const targetId of options.targets) {
			const cfg = RELEASE_TARGETS[targetId];
			console.log(`[dry-run] artifact: nightglide-v${options.version}-${targetId}`);
			console.log(`[dry-run] tarball:  nightglide-v${options.version}-${targetId}.tar.gz`);
			if (options.deb && cfg.debArch) {
				console.log(`[dry-run] deb:      nightglide_${options.version}_${cfg.debArch}.deb`);
			}
		}
		console.log("\n[dry-run] Homebrew formula preview:\n");
		console.log(renderHomebrewFormula({ version: options.version, sha256ByTarget: {}, strict: false }));
		return;
	}

	await fs.mkdir(options.outDir, { recursive: true });
	const [licenseBytes, noticesBytes, readmeBytes] = await Promise.all([
		Bun.file(licensePath).bytes(),
		Bun.file(noticesPath).bytes(),
		readOptionalBytes(readmePath),
	]);

	if (!options.assembleOnly) {
		const binaries = await compileTargetBinaries({
			repoRoot,
			ompRoot,
			version: options.version,
			targets: options.targets,
			outDir: options.outDir,
			fetchCrossNatives: options.fetchCrossNatives,
		});

		for (const [targetId, binaryPath] of binaries.entries()) {
			const binaryBytes = await fs.readFile(binaryPath);
			const tarballPath = path.join(options.outDir, `nightglide-v${options.version}-${targetId}.tar.gz`);
			const tarballBytes = buildReleaseTarballBytes({
				binaryBytes,
				licenseBytes,
				noticesBytes,
				readmeBytes,
			});
			await fs.writeFile(tarballPath, tarballBytes);
			console.log(`Packaged tarball -> ${tarballPath}`);

			const debArch = RELEASE_TARGETS[targetId].debArch;
			if (options.deb && debArch) {
				const debPath = path.join(options.outDir, `nightglide_${options.version}_${debArch}.deb`);
				const debBytes = buildDebBytes({
					version: options.version,
					debArch,
					binaryBytes,
					licenseBytes,
					noticesBytes,
				});
				await fs.writeFile(debPath, debBytes);
				console.log(`Packaged deb -> ${debPath}`);
			}
		}
	}

	// Collect tarballs across all targets present in outDir for SHA256SUMS + Homebrew formula.
	const sha256ByTarget: Partial<Record<ReleaseTargetId, string>> = {};
	for (const targetId of ALL_TARGET_IDS) {
		const tarballPath = path.join(options.outDir, `nightglide-v${options.version}-${targetId}.tar.gz`);
		if (await Bun.file(tarballPath).exists()) {
			sha256ByTarget[targetId] = await computeSha256(tarballPath);
		}
	}

	const formulaText = renderHomebrewFormula({
		version: options.version,
		sha256ByTarget,
		strict: options.strictFormula,
	});
	await fs.mkdir(path.dirname(options.formulaOut), { recursive: true });
	await fs.writeFile(options.formulaOut, formulaText, "utf8");
	console.log(`Wrote Homebrew formula -> ${options.formulaOut}`);

	if (options.deb) {
		const outEntries = await fs.readdir(options.outDir);
		const debPaths = outEntries
			.filter(name => name.endsWith(".deb"))
			.sort()
			.map(name => path.join(options.outDir, name));
		if (debPaths.length > 0) {
			const apt = await generateAptRepo({ debPaths, aptDir: options.aptDir });
			console.log(`Generated APT repo (${apt.poolFiles.length} .deb) -> ${apt.releasePath}`);
		} else {
			console.warn(`Warning: --deb requested, but no .deb files were found in ${options.outDir}`);
		}
	}

	const releaseFiles = (await fs.readdir(options.outDir))
		.filter(name => name !== "SHA256SUMS.txt" && !name.startsWith("."))
		.sort();
	const checksumEntries = await Promise.all(
		releaseFiles.map(async name => ({
			name,
			sha256: await computeSha256(path.join(options.outDir, name)),
		})),
	);
	if (checksumEntries.length > 0) {
		const sumsPath = path.join(options.outDir, "SHA256SUMS.txt");
		await fs.writeFile(sumsPath, formatSha256Sums(checksumEntries), "utf8");
		console.log(`Wrote ${checksumEntries.length} checksum(s) -> ${sumsPath}`);
	}
}

async function main(): Promise<void> {
	const repoRoot = path.resolve(import.meta.dir, "..");
	const rootPkg = (await Bun.file(path.join(repoRoot, "package.json")).json()) as { version?: string };
	const defaultVersion = rootPkg.version ?? "1.0.0";
	const options = parseCliArgs(process.argv.slice(2), { version: defaultVersion, repoRoot });
	if (options.help) {
		process.stdout.write(usageText());
		return;
	}
	await packageRelease(options, repoRoot);
}

if (import.meta.main) {
	main().catch(err => {
		console.error(`package-release error: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	});
}
