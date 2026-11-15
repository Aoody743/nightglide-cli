import React from "react";
import type { Theme } from "@nightglide/themes";
import type { FileDiffData } from "@nightglide/core";

export interface NativeDiffViewProps {
  diff: FileDiffData | string;
  theme: Theme;
  viewMode?: "unified" | "split";
  showLineNumbers?: boolean;
  filetype?: string;
}

/**
 * Renders diff using OpenTUI React's native `<diff>` intrinsic element.
 */
export function NativeDiffView({
  diff,
  theme,
  viewMode = "unified",
  showLineNumbers = true,
  filetype,
}: NativeDiffViewProps) {
  const rawDiff = typeof diff === "string" ? diff : diff.diff;

  return (
    <diff
      diff={rawDiff}
      view={viewMode}
      showLineNumbers={showLineNumbers}
      filetype={filetype}
      addedSignColor={theme.colors.success}
      removedSignColor={theme.colors.error}
      lineNumberFg={theme.colors.textMuted}
      lineNumberBg={theme.colors.surface}
      contextBg={theme.colors.surface}
      addedBg={theme.colors.surfaceElevated}
      removedBg={theme.colors.surfaceElevated}
    />
  );
}
