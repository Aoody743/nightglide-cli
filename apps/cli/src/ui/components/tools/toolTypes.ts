import type { Theme } from "@nightglide/themes";
import type { FileDiffData } from "@nightglide/core";
import type { TerminalDimensions } from "../../dimensions.js";

export type ToolStatus = "running" | "completed" | "error";

export type ToolCategory =
  | "read"
  | "write"
  | "edit"
  | "bash"
  | "task"
  | "glob"
  | "grep"
  | "todo"
  | "custom";

export interface ToolEventItem {
  readonly id: string;
  readonly toolName: string;
  readonly input: Record<string, unknown>;
  readonly result?: unknown;
  readonly error?: string;
  readonly diff?: FileDiffData;
  readonly status: ToolStatus;
  readonly durationMs?: number;
}

export interface ToolCardProps {
  readonly id?: string;
  readonly toolName: string;
  readonly toolCallId?: string;
  readonly input: Record<string, unknown>;
  readonly result?: unknown;
  readonly error?: string;
  readonly diff?: FileDiffData;
  readonly status: ToolStatus;
  readonly durationMs?: number;
  readonly mode?: "compact" | "expanded";
  readonly theme: Theme;
  readonly dimensions?: TerminalDimensions;
  readonly isPendingApproval?: boolean;
  readonly onToggleExpand?: () => void;
}
