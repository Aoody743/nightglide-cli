/**
 * Render the real Glide shell to PNG contact sheets (truecolor and 256-color),
 * one per theme, across thinking-effort levels and two scene-clock values.
 * Each terminal cell becomes a CW×CH pixel block: background fill, `▀` drawn
 * as a top-half foreground, other glyphs as a small foreground mark (text is
 * not rasterized — the sheets are for judging the scene and colors).
 *
 *   bun scripts/glide-spike/scene-png.ts [outDir] [width] [height]
 */
import * as path from "node:path";
import { deflateSync } from "node:zlib";
import { TranscriptContainer } from "../../vendor/omp/packages/tui/src/chrome/transcript-container";
import { NightglideShell } from "../../vendor/omp/packages/tui/src/components/nightglide-shell";
import { setTheme, theme } from "../../vendor/omp/packages/tui/src/theme/theme";

const OUT = process.argv[2] ?? path.join(import.meta.dir, "shots", "g2-preview");
const WIDTH = Number(process.argv[3] ?? 140);
const HEIGHT = Number(process.argv[4] ?? 40);
const CW = 4;
const CH = 8;
const GAP = 12;
const THEMES = [
  "nightglide-flight",
  "nightglide-cloudlight",
  "nightglide-abyss",
  "nightglide-daybreak",
];
const LEVELS: (string | undefined)[] = [undefined, "low", "high", "xhigh"];
const MODES = ["truecolor", "256color"] as const;
type Mode = (typeof MODES)[number];
/** Terminal environments whose capability detection yields each color mode. */
const MODE_ENV: Record<Mode, Record<string, string>> = {
  truecolor: { WT_SESSION: "preview", COLORTERM: "truecolor" },
  "256color": {
    TERM_PROGRAM: "Apple_Terminal",
    TERM: "xterm-256color",
    COLORTERM: "",
    WT_SESSION: "",
  },
};
const TIMES = [0, 60];

type RGB = [number, number, number];

const XTERM: RGB[] = (() => {
  const base = [
    0x000000, 0x800000, 0x008000, 0x808000, 0x000080, 0x800080, 0x008080, 0xc0c0c0, 0x808080,
    0xff0000, 0x00ff00, 0xffff00, 0x0000ff, 0xff00ff, 0x00ffff, 0xffffff,
  ].map((v) => [(v >> 16) & 255, (v >> 8) & 255, v & 255] as RGB);
  const steps = [0, 95, 135, 175, 215, 255];
  for (let r = 0; r < 6; r++)
    for (let g = 0; g < 6; g++)
      for (let b = 0; b < 6; b++) base.push([steps[r]!, steps[g]!, steps[b]!]);
  for (let i = 0; i < 24; i++) base.push([8 + i * 10, 8 + i * 10, 8 + i * 10]);
  return base;
})();

interface Cell {
  ch: string;
  fg: RGB;
  bg: RGB;
}

function parseLine(line: string, width: number): Cell[] {
  const cells: Cell[] = [];
  let fg: RGB = [200, 200, 200];
  let bg: RGB = [0, 0, 0];
  const re = /\x1b\[([0-9;:]*)m|\x1b\][^\x07]*\x07|\x1b\[[0-9;?]*[A-Za-z]|(.)/gsu;
  for (const m of line.matchAll(re)) {
    if (m[2] !== undefined) {
      const w = Bun.stringWidth(m[2]);
      for (let i = 0; i < Math.max(1, w); i++) cells.push({ ch: i === 0 ? m[2] : " ", fg, bg });
      continue;
    }
    if (m[1] === undefined) continue;
    const p = m[1] === "" ? [0] : m[1].split(/[;:]/).map(Number);
    for (let i = 0; i < p.length; i++) {
      const c = p[i]!;
      if (c === 0)
        [fg, bg] = [
          [200, 200, 200],
          [0, 0, 0],
        ];
      else if ((c === 38 || c === 48) && p[i + 1] === 2) {
        const rgb: RGB = [p[i + 2] ?? 0, p[i + 3] ?? 0, p[i + 4] ?? 0];
        if (c === 38) fg = rgb;
        else bg = rgb;
        i += 4;
      } else if ((c === 38 || c === 48) && p[i + 1] === 5) {
        const rgb = XTERM[p[i + 2] ?? 0]!;
        if (c === 38) fg = rgb;
        else bg = rgb;
        i += 2;
      }
    }
  }
  while (cells.length < width) cells.push({ ch: " ", fg, bg });
  return cells.slice(0, width);
}

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function png(w: number, h: number, rgb: Uint8Array): Uint8Array {
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++)
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// Color mode is detected from the environment, so each mode renders in its own child process.
const childMode = process.env.G2_SCENE_MODE as Mode | undefined;
if (!childMode) {
  for (const mode of MODES) {
    const env: Record<string, string | undefined> = {
      ...process.env,
      ...MODE_ENV[mode],
      G2_SCENE_MODE: mode,
    };
    for (const [k, v] of Object.entries(MODE_ENV[mode])) if (v === "") delete env[k];
    const child = Bun.spawnSync(["bun", import.meta.path, ...process.argv.slice(2)], {
      env,
      stdout: "inherit",
      stderr: "inherit",
    });
    if (child.exitCode !== 0) process.exit(child.exitCode ?? 1);
  }
  process.exit(0);
}

async function frame(themeName: string, mode: Mode, level: string | undefined, time: number) {
  const res = await setTheme(themeName);
  if (!res.success) throw new Error(res.error);
  if (theme.getColorMode() !== mode)
    throw new Error(`expected ${mode}, theme resolved ${theme.getColorMode()}`);
  const shell = new NightglideShell({
    transcript: new TranscriptContainer(),
    dock: () => [{ render: () => ["❯ "], invalidate() {} }],
    status: () => undefined,
    state: () => ({ model: "preview", thinkingLevel: level, subagents: [], streaming: false }),
    focusTargets: () => [],
    rows: () => HEIGHT,
    requestRender: () => {},
  });
  shell.setSceneTime(time);
  const lines = shell.render(WIDTH);
  shell.dispose();
  return lines.map((l) => parseLine(l, WIDTH));
}

/** Draw a sheet of tiles (rows = effort levels, columns = clock values). */
async function sheet(file: string, tiles: Cell[][][][], cw: number, ch: number): Promise<void> {
  const tileW = tiles[0]![0]![0]!.length * cw;
  const tileH = tiles[0]![0]!.length * ch;
  const cols = tiles[0]!.length;
  const rows = tiles.length;
  const W = cols * tileW + (cols + 1) * GAP;
  const H = rows * tileH + (rows + 1) * GAP;
  const img = new Uint8Array(W * H * 3).fill(40);
  const put = (x: number, y: number, c: RGB) => img.set(c, (y * W + x) * 3);
  tiles.forEach((row, r) =>
    row.forEach((grid, k) => {
      const ox = GAP + k * (tileW + GAP);
      const oy = GAP + r * (tileH + GAP);
      grid.forEach((line, cy) =>
        line.forEach((cell, cx) => {
          for (let py = 0; py < ch; py++) {
            for (let px = 0; px < cw; px++) {
              let c = cell.bg;
              if (cell.ch === "▀") c = py < ch / 2 ? cell.fg : cell.bg;
              else if (cell.ch === "▄") c = py >= ch / 2 ? cell.fg : cell.bg;
              else if (cell.ch === "█") c = cell.fg;
              else if (
                cell.ch.trim() &&
                py >= ch / 4 &&
                py < ch - ch / 4 &&
                px >= cw / 4 &&
                px < cw - cw / 4
              )
                c = cell.fg;
              put(ox + cx * cw + px, oy + cy * ch + py, c);
            }
          }
        }),
      );
    }),
  );
  await Bun.write(file, png(W, H, img));
  console.log(file);
}

/** Columns kept in the zoomed scene sheet. */
const SCENE_COLS = Math.min(WIDTH, 100);
for (const themeName of THEMES) {
  const full: Cell[][][][] = [];
  const scene: Cell[][][][] = [];
  for (const level of LEVELS) {
    const fullRow: Cell[][][] = [];
    const sceneRow: Cell[][][] = [];
    for (const time of TIMES) {
      const grid = await frame(themeName, childMode, level, time);
      fullRow.push(grid);
      // Scene bands: rows under the header and above the bottom edge (sizes from the shell at 40 rows).
      const band = [
        ...grid.slice(1, 6),
        grid[0]!.map(() => ({ ch: " ", fg: [40, 40, 40] as RGB, bg: [40, 40, 40] as RGB })),
        ...grid.slice(-4),
      ];
      sceneRow.push(band.map((line) => line.slice(0, SCENE_COLS)));
    }
    full.push(fullRow);
    scene.push(sceneRow);
  }
  await sheet(path.join(OUT, `${themeName}-${childMode}.png`), full, CW, CH);
  await sheet(path.join(OUT, `${themeName}-${childMode}-scene.png`), scene, 6, 12);
}
