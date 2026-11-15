import React from "react";
import type { Theme } from "@nightglide/themes";
import type { FileDiffData } from "@nightglide/core";
import type { TerminalDimensions } from "../../dimensions.js";
import {
  parseFileDiff,
  formatChangeStats,
  truncateLine,
  wrapLine,
  formatGutterLineNumber,
  type ParsedDiff,
  type DiffLine,
} from "./diffParser.js";
import { NativeDiffView } from "./NativeDiffView.js";

export interface DiffViewerProps {
  diff: FileDiffData | string;
  filePath?: string;
  theme: Theme;
  dimensions?: TerminalDimensions;
  width?: number;
  maxHeight?: number;
  showLineNumbers?: boolean;
  compact?: boolean;
  useOpenTuiDiff?: boolean;
  wrapMode?: "truncate" | "wrap";
}

/**
 * Terminal Diff Viewer component adhering to Nightglide Celestial Flight design system.
 * Supports FileDiffData or unified diff strings, responsive narrow-terminal fallback (<80 cols),
 * colored line changes, line number gutters, and change stats headers.
 */
export function DiffViewer({
  diff,
  filePath,
  theme,
  dimensions,
  width: propWidth,
  maxHeight,
  showLineNumbers = true,
  compact = false,
  useOpenTuiDiff = false,
  wrapMode = "truncate",
}: DiffViewerProps) {
  // If native OpenTUI diff component is requested and available
  if (useOpenTuiDiff) {
    return (
      <NativeDiffView
        diff={diff}
        theme={theme}
        showLineNumbers={showLineNumbers}
      />
    );
  }

  const effectiveWidth =
    propWidth ?? dimensions?.width ?? (process.stdout?.columns && process.stdout.columns > 0 ? process.stdout.columns : 100);
  const isNarrow = effectiveWidth < 80;

  const parsed: ParsedDiff = parseFileDiff(diff, filePath);
  const targetFile = parsed.filePath || filePath || "Unknown File";

  // Calculate available width for line content
  // Narrow gutter: ` 42 │ + │ ` (~10 cols)
  // Wide gutter: ` 42 │ 42 │ + │ ` (~16 cols)
  const gutterCols = !showLineNumbers ? 4 : isNarrow ? 10 : 16;
  const contentWidth = Math.max(20, effectiveWidth - gutterCols - 4);

  // Flatten lines or slice according to maxHeight if provided
  let linesToRender = parsed.allLines;
  if (maxHeight && maxHeight > 0 && linesToRender.length > maxHeight) {
    linesToRender = linesToRender.slice(0, maxHeight);
  }

  return (
    <box
      flexDirection="column"
      width="100%"
      backgroundColor={theme.colors.surface}
      borderColor={theme.colors.border}
      borderStyle="single"
      paddingX={1}
      paddingY={0}
    >
      {/* Diff Header Bar */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        width="100%"
        backgroundColor={theme.colors.surfaceElevated}
        paddingX={1}
      >
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.accent}>Target File:</text>
          <text fg={theme.colors.textPrimary}>
            {isNarrow ? truncateLine(targetFile, effectiveWidth - 25) : targetFile}
          </text>
        </box>
        <box flexDirection="row" alignItems="center" gap={1}>
          <text fg={theme.colors.textSecondary}>Changes:</text>
          <text fg={theme.colors.success}>+{parsed.additions}</text>
          <text fg={theme.colors.error}>-{parsed.deletions}</text>
          <text fg={theme.colors.textMuted}>
            {formatChangeStats(parsed.additions, parsed.deletions)}
          </text>
        </box>
      </box>

      {/* Empty State */}
      {linesToRender.length === 0 && (
        <box paddingY={1} paddingX={1}>
          <text fg={theme.colors.textMuted}>No changes detected in file diff.</text>
        </box>
      )}

      {/* Diff Body Lines */}
      {linesToRender.map((line: DiffLine, idx: number) => {
        // Hunk Header (e.g. @@ -1,5 +1,7 @@)
        if (line.type === "hunk_header") {
          return (
            <box
              key={`hunk-${idx}`}
              flexDirection="row"
              width="100%"
              backgroundColor={theme.colors.surfaceElevated}
              paddingX={1}
            >
              <text fg={theme.colors.info}>
                {isNarrow ? truncateLine(line.raw, effectiveWidth - 6) : line.raw}
              </text>
            </box>
          );
        }

        // File Header comments / git lines
        if (line.type === "header" || line.type === "comment") {
          return (
            <box key={`hdr-${idx}`} flexDirection="row" width="100%" paddingX={1}>
              <text fg={theme.colors.textMuted}>
                {isNarrow ? truncateLine(line.raw, effectiveWidth - 6) : line.raw}
              </text>
            </box>
          );
        }

        // Add, Delete, Context Lines
        const isAdd = line.type === "add";
        const isDelete = line.type === "delete";
        const sign = isAdd ? "+" : isDelete ? "-" : " ";
        const signColor = isAdd
          ? theme.colors.success
          : isDelete
          ? theme.colors.error
          : theme.colors.textMuted;
        const textColor = isAdd
          ? theme.colors.success
          : isDelete
          ? theme.colors.error
          : theme.colors.textPrimary;
        const rowBg = isAdd || isDelete ? theme.colors.surfaceElevated : "transparent";

        const oldNumStr = formatGutterLineNumber(line.oldLineNumber, 4);
        const newNumStr = formatGutterLineNumber(line.newLineNumber, 4);

        // Format line content respecting narrow-terminal wrapping/truncation
        const formattedContents =
          wrapMode === "wrap"
            ? wrapLine(line.content, contentWidth)
            : [truncateLine(line.content, contentWidth)];

        return (
          <box
            key={`line-${idx}`}
            flexDirection="column"
            width="100%"
            backgroundColor={rowBg}
          >
            {formattedContents.map((chunk, chunkIdx) => (
              <box
                key={`chunk-${chunkIdx}`}
                flexDirection="row"
                alignItems="center"
                width="100%"
              >
                {/* Line Number Gutters */}
                {showLineNumbers && (
                  <box flexDirection="row" alignItems="center">
                    {!isNarrow ? (
                      <>
                        <text fg={theme.colors.textMuted}>{chunkIdx === 0 ? oldNumStr : "    "}</text>
                        <text fg={theme.colors.border}> │ </text>
                        <text fg={theme.colors.textMuted}>{chunkIdx === 0 ? newNumStr : "    "}</text>
                        <text fg={theme.colors.border}> │ </text>
                      </>
                    ) : (
                      <>
                        <text fg={theme.colors.textMuted}>
                          {chunkIdx === 0 ? (isDelete ? oldNumStr : newNumStr) : "    "}
                        </text>
                        <text fg={theme.colors.border}> │ </text>
                      </>
                    )}
                  </box>
                )}

                {/* Sign Column */}
                <box width={2}>
                  <text fg={signColor}>{chunkIdx === 0 ? sign : " "}</text>
                </box>

                {/* Line Code Content */}
                <box flexGrow={1}>
                  <text fg={textColor}>{chunk}</text>
                </box>
              </box>
            ))}
          </box>
        );
      })}

      {/* Overflow Truncation Indicator */}
      {maxHeight && parsed.allLines.length > maxHeight && (
        <box paddingX={1} backgroundColor={theme.colors.surfaceElevated}>
          <text fg={theme.colors.textMuted}>
            … and {parsed.allLines.length - maxHeight} more lines (diff truncated)
          </text>
        </box>
      )}
    </box>
  );
}
