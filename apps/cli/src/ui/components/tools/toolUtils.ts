import type { Theme } from "@nightglide/themes";
import type { ToolCategory, ToolStatus } from "./toolTypes.js";

/**
 * Maps a tool name to a standardized semantic category.
 */
export function getToolCategory(toolName: string): ToolCategory {
  const name = (toolName || "").toLowerCase().trim();
  switch (name) {
    case "read":
    case "read_file":
    case "cat":
    case "view":
      return "read";
    case "write":
    case "write_file":
    case "create_file":
    case "save":
      return "write";
    case "edit":
    case "edit_file":
    case "replace":
    case "patch":
      return "edit";
    case "bash":
    case "exec":
    case "run_command":
    case "sh":
    case "shell":
    case "cmd":
      return "bash";
    case "task":
    case "delegate":
    case "subagent":
    case "agent":
      return "task";
    case "glob":
    case "find":
    case "list_files":
    case "ls":
      return "glob";
    case "grep":
    case "search":
    case "find_in_files":
      return "grep";
    case "todo":
    case "checklist":
    case "task_list":
      return "todo";
    default:
      return "custom";
  }
}

/**
 * Returns distinct visual icon for tools with Unicode support.
 */
export function getToolIcon(toolName: string): string {
  const category = getToolCategory(toolName);
  switch (category) {
    case "read":
      return "📖";
    case "write":
      return "✍️";
    case "edit":
      return "✂️";
    case "bash":
      return "💻";
    case "task":
      return "⚙️";
    case "glob":
      return "🔍";
    case "grep":
      return "🔎";
    case "todo":
      return "📝";
    default:
      return "🛠";
  }
}

/**
 * Returns status badge metadata with label, icon symbol, and semantic theme color.
 */
export function getToolBadge(
  status: ToolStatus,
  theme: Theme
): { label: string; icon: string; color: string } {
  switch (status) {
    case "completed":
      return {
        label: "COMPLETED",
        icon: "✔",
        color: theme.colors.success,
      };
    case "error":
      return {
        label: "ERROR",
        icon: "✖",
        color: theme.colors.error,
      };
    case "running":
    default:
      return {
        label: "EXECUTING",
        icon: "●",
        color: theme.colors.warning,
      };
  }
}

/**
 * Formats tool input arguments cleanly into human-readable target strings.
 */
export function formatToolSummary(
  toolName: string,
  input: Record<string, unknown> = {}
): string {
  const category = getToolCategory(toolName);
  switch (category) {
    case "read": {
      const p = input.path || input.filePath || input.file || input.target;
      return p ? String(p) : "read file";
    }
    case "write": {
      const p = input.path || input.filePath || input.file;
      return p ? String(p) : "write file";
    }
    case "edit": {
      const p = input.path || input.filePath || input.file;
      return p ? String(p) : "edit file";
    }
    case "bash": {
      const cmd = input.command || input.cmd || input.script;
      return cmd ? `$ ${String(cmd)}` : "shell command";
    }
    case "task": {
      const taskDesc = input.prompt || input.description || input.task || "";
      const targetRole = input.subagent || input.role || "subagent";
      return taskDesc ? `[${targetRole}] ${String(taskDesc)}` : `delegated to ${targetRole}`;
    }
    case "glob": {
      const pat = input.pattern || input.glob || input.path;
      return pat ? `pattern: ${String(pat)}` : "find files";
    }
    case "grep": {
      const query = input.query || input.pattern;
      const path = input.path || ".";
      return query ? `search "${String(query)}" in ${path}` : "search text";
    }
    case "todo": {
      const act = input.action || input.task;
      return act ? `action: ${String(act)}` : "manage todos";
    }
    default: {
      const keys = Object.keys(input);
      if (keys.length === 0) return "execute";
      if (keys.length === 1 && typeof input[keys[0]] === "string") {
        return `${keys[0]}: ${input[keys[0]]}`;
      }
      return JSON.stringify(input);
    }
  }
}

/**
 * Concisely formats tool execution results.
 */
export function formatToolResultSummary(
  toolName: string,
  result: unknown,
  maxLength = 50
): string {
  if (result === undefined || result === null) return "";
  if (typeof result === "string") {
    const singleLine = result.trim().replace(/\s+/g, " ");
    return singleLine.length > maxLength
      ? singleLine.slice(0, maxLength - 3) + "..."
      : singleLine;
  }
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (obj.output && typeof obj.output === "string") {
      const out = obj.output.trim().replace(/\s+/g, " ");
      return out.length > maxLength ? out.slice(0, maxLength - 3) + "..." : out;
    }
    if (obj.stdout && typeof obj.stdout === "string") {
      const out = obj.stdout.trim().replace(/\s+/g, " ");
      return out.length > maxLength ? out.slice(0, maxLength - 3) + "..." : out;
    }
    if (obj.bytes !== undefined) {
      return `${obj.bytes} bytes` + (obj.lines !== undefined ? `, ${obj.lines} lines` : "");
    }
    const str = JSON.stringify(result);
    return str.length > maxLength ? str.slice(0, maxLength - 3) + "..." : str;
  }
  return String(result);
}

/**
 * Formats duration in milliseconds into human-readable timing string (e.g. `14ms`, `1.5s`).
 */
export function formatToolDuration(durationMs?: number): string {
  if (durationMs === undefined || durationMs === null || isNaN(durationMs)) {
    return "";
  }
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

/**
 * Detects whether a tool execution is potentially destructive or high-risk.
 */
export function isDestructiveOrHighRisk(
  toolName: string,
  input: Record<string, unknown> = {}
): boolean {
  const cat = getToolCategory(toolName);
  if (cat === "bash" || cat === "write" || cat === "edit") {
    return true;
  }
  if (input.dangerouslySkipPermissions || input.force || input.destructive) {
    return true;
  }
  return false;
}
