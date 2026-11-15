import type { FileDiffData } from "@nightglide/core";

export type DiffLineType =
  | "add"
  | "delete"
  | "context"
  | "hunk_header"
  | "header"
  | "comment";

export interface DiffLine {
  readonly type: DiffLineType;
  readonly content: string;
  readonly raw: string;
  readonly oldLineNumber?: number;
  readonly newLineNumber?: number;
}

export interface DiffHunk {
  readonly header: string;
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly section?: string;
  readonly lines: readonly DiffLine[];
}

export interface ParsedDiff {
  readonly filePath?: string;
  readonly oldPath?: string;
  readonly newPath?: string;
  readonly additions: number;
  readonly deletions: number;
  readonly hunks: readonly DiffHunk[];
  readonly allLines: readonly DiffLine[];
  readonly rawDiff: string;
}

const HUNK_HEADER_REGEX = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/;

/**
 * Formats a standard unified diff hunk header string.
 */
export function formatHunkHeader(
  oldStart: number,
  oldCount: number,
  newStart: number,
  newCount: number,
  section?: string
): string {
  const oldPart = oldCount === 1 ? `-${oldStart}` : `-${oldStart},${oldCount}`;
  const newPart = newCount === 1 ? `+${newStart}` : `+${newStart},${newCount}`;
  const sectionPart = section ? ` ${section.trim()}` : "";
  return `@@ ${oldPart} ${newPart} @@${sectionPart}`;
}

/**
 * Formats change statistics as `(+X, -Y)` or `(+X)` or `(-Y)`.
 */
export function formatChangeStats(additions: number, deletions: number): string {
  const parts: string[] = [];
  if (additions > 0 || (additions === 0 && deletions === 0)) {
    parts.push(`+${additions}`);
  }
  if (deletions > 0) {
    parts.push(`-${deletions}`);
  }
  return `(${parts.join(", ")})`;
}

/**
 * Safely truncates a line to maximum width with an ellipsis indicator.
 */
export function truncateLine(text: string, maxWidth: number, ellipsis = "…"): string {
  if (maxWidth <= 0) return "";
  if (text.length <= maxWidth) return text;
  if (maxWidth <= ellipsis.length) return text.slice(0, maxWidth);
  return text.slice(0, maxWidth - ellipsis.length) + ellipsis;
}

/**
 * Wraps a line into chunks of maximum width without horizontal blowout.
 */
export function wrapLine(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [""];
  if (text.length <= maxWidth) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxWidth) {
    chunks.push(text.slice(i, i + maxWidth));
  }
  return chunks;
}

/**
 * Formats line numbers for diff gutters with consistent right-aligned padding.
 */
export function formatGutterLineNumber(lineNum?: number, width = 4): string {
  if (lineNum === undefined || lineNum === null || isNaN(lineNum)) {
    return " ".repeat(width);
  }
  const str = String(lineNum);
  if (str.length >= width) return str;
  return " ".repeat(width - str.length) + str;
}

/**
 * Parses unified diff text into structured hunks and lines with line numbers.
 */
export function parseUnifiedDiff(diffText: string, fallbackPath?: string): ParsedDiff {
  const rawDiff = diffText || "";
  const lines = rawDiff.split(/\r?\n/);

  let filePath: string | undefined = fallbackPath;
  let oldPath: string | undefined;
  let newPath: string | undefined;

  let totalAdditions = 0;
  let totalDeletions = 0;

  const hunks: DiffHunk[] = [];
  const allLines: DiffLine[] = [];

  let currentHunkLines: DiffLine[] = [];
  let currentOldStart = 1;
  let currentOldCount = 0;
  let currentNewStart = 1;
  let currentNewCount = 0;
  let currentSection: string | undefined;
  let currentHunkHeader = "";

  let oldCurrentLine = 1;
  let newCurrentLine = 1;
  let insideHunk = false;

  const flushHunk = () => {
    if (insideHunk && (currentHunkLines.length > 0 || currentHunkHeader)) {
      hunks.push({
        header: currentHunkHeader,
        oldStart: currentOldStart,
        oldCount: currentOldCount,
        newStart: currentNewStart,
        newCount: currentNewCount,
        section: currentSection,
        lines: [...currentHunkLines],
      });
      currentHunkLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect git / diff file headers
    if (line.startsWith("--- ")) {
      const p = line.slice(4).trim();
      oldPath = p.replace(/^[ab]\//, "");
      allLines.push({
        type: "header",
        content: line,
        raw: line,
      });
      continue;
    }
    if (line.startsWith("+++ ")) {
      const p = line.slice(4).trim();
      newPath = p.replace(/^[ab]\//, "");
      if (!filePath || filePath === fallbackPath) {
        filePath = newPath;
      }
      allLines.push({
        type: "header",
        content: line,
        raw: line,
      });
      continue;
    }
    if (line.startsWith("diff --git ") || line.startsWith("index ")) {
      allLines.push({
        type: "header",
        content: line,
        raw: line,
      });
      continue;
    }

    // Check for Hunk Header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(HUNK_HEADER_REGEX);
    if (hunkMatch) {
      flushHunk();
      insideHunk = true;
      currentHunkHeader = line;
      currentOldStart = parseInt(hunkMatch[1], 10);
      currentOldCount = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
      currentNewStart = parseInt(hunkMatch[3], 10);
      currentNewCount = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;
      currentSection = hunkMatch[5]?.trim() || undefined;

      oldCurrentLine = currentOldStart;
      newCurrentLine = currentNewStart;

      const hunkLine: DiffLine = {
        type: "hunk_header",
        content: line,
        raw: line,
      };
      allLines.push(hunkLine);
      continue;
    }

    // Handle lines inside or outside hunks
    if (line.startsWith("+") && !line.startsWith("+++")) {
      totalAdditions++;
      const diffLine: DiffLine = {
        type: "add",
        content: line.slice(1),
        raw: line,
        newLineNumber: newCurrentLine++,
      };
      if (insideHunk) {
        currentHunkLines.push(diffLine);
      } else {
        currentHunkLines.push(diffLine);
        insideHunk = true;
      }
      allLines.push(diffLine);
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      totalDeletions++;
      const diffLine: DiffLine = {
        type: "delete",
        content: line.slice(1),
        raw: line,
        oldLineNumber: oldCurrentLine++,
      };
      if (insideHunk) {
        currentHunkLines.push(diffLine);
      } else {
        currentHunkLines.push(diffLine);
        insideHunk = true;
      }
      allLines.push(diffLine);
    } else if (line.startsWith(" ")) {
      const diffLine: DiffLine = {
        type: "context",
        content: line.slice(1),
        raw: line,
        oldLineNumber: oldCurrentLine++,
        newLineNumber: newCurrentLine++,
      };
      if (insideHunk) {
        currentHunkLines.push(diffLine);
      }
      allLines.push(diffLine);
    } else if (line.startsWith("\\")) {
      // E.g. "\ No newline at end of file"
      const diffLine: DiffLine = {
        type: "comment",
        content: line,
        raw: line,
      };
      if (insideHunk) {
        currentHunkLines.push(diffLine);
      }
      allLines.push(diffLine);
    } else if (line.trim().length > 0) {
      // Context or un-prefixed line fallback
      const diffLine: DiffLine = {
        type: "context",
        content: line,
        raw: line,
        oldLineNumber: insideHunk ? oldCurrentLine++ : undefined,
        newLineNumber: insideHunk ? newCurrentLine++ : undefined,
      };
      if (insideHunk) {
        currentHunkLines.push(diffLine);
      }
      allLines.push(diffLine);
    }
  }

  flushHunk();

  return {
    filePath: filePath || fallbackPath,
    oldPath,
    newPath,
    additions: totalAdditions,
    deletions: totalDeletions,
    hunks,
    allLines,
    rawDiff,
  };
}

/**
 * Parses either a FileDiffData object or a raw unified diff string.
 */
export function parseFileDiff(
  diffInput: FileDiffData | string | undefined | null,
  fallbackPath?: string
): ParsedDiff {
  if (!diffInput) {
    return {
      filePath: fallbackPath,
      additions: 0,
      deletions: 0,
      hunks: [],
      allLines: [],
      rawDiff: "",
    };
  }

  if (typeof diffInput === "string") {
    return parseUnifiedDiff(diffInput, fallbackPath);
  }

  const parsed = parseUnifiedDiff(diffInput.diff, diffInput.filePath || fallbackPath);
  return {
    ...parsed,
    filePath: diffInput.filePath || parsed.filePath || fallbackPath,
    additions: diffInput.additions !== undefined ? diffInput.additions : parsed.additions,
    deletions: diffInput.deletions !== undefined ? diffInput.deletions : parsed.deletions,
  };
}
