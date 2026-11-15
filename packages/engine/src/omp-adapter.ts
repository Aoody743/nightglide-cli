import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAgentSession,
  SessionManager,
  Settings,
} from "@oh-my-pi/pi-coding-agent";
import {
  type AgentEngine,
  type AgentSession,
  type CreateSessionOptions,
  type EngineHealthResult,
  type AgentEvent,
  type AgentEventHandler,
  type SessionState,
  type AgentStatus,
  type SubagentMonitorItem,
  type AgentRole,
  type ProviderLocality,
  type FileDiffData,
  type ApprovalAnswer,
  EngineError,
  ModelNotConfiguredError,
  SessionDisposedError,
} from "@nightglide/core";
import type { ProviderRegistry } from "@nightglide/providers";

export interface OmpAgentEngineOptions {
  defaultWorkspacePath?: string;
  defaultAgentDir?: string;
  defaultModel?: string;
  model?: string;
  baseUrl?: string;
  providerRegistry?: ProviderRegistry;
}

type OmpSessionInstance = Awaited<ReturnType<typeof createAgentSession>>["session"];
type OmpEventBus = Awaited<ReturnType<typeof createAgentSession>>["subagentEventBus"];

/**
 * Computes additions and deletions count from a unified or line-numbered diff string.
 */
export function parseDiffStats(diffText: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  const lines = diffText.split("\n");
  for (const line of lines) {
    if (/^\s*\+(?!\+\+)/.test(line)) {
      additions++;
    } else if (/^\s*-(?!--)/.test(line)) {
      deletions++;
    }
  }
  return { additions, deletions };
}

/**
 * Generates a unified diff between two text versions of a file.
 */
export function generateUnifiedDiff(filePath: string, oldText: string, newText: string): string {
  const oldLines = oldText.length > 0 ? oldText.split("\n") : [];
  const newLines = newText.length > 0 ? newText.split("\n") : [];

  if (oldLines.length === 0 && newLines.length === 0) {
    return "";
  }
  if (oldLines.length === 0) {
    const body = newLines.map((l) => `+${l}`).join("\n");
    return `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${newLines.length} @@\n${body}`;
  }
  if (newLines.length === 0) {
    const body = oldLines.map((l) => `-${l}`).join("\n");
    return `--- a/${filePath}\n+++ /dev/null\n@@ -1,${oldLines.length} +0,0 @@\n${body}`;
  }

  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }

  const removed = oldLines.slice(prefix, oldLines.length - suffix);
  const added = newLines.slice(prefix, newLines.length - suffix);

  if (removed.length === 0 && added.length === 0) {
    return "";
  }

  const contextBefore = oldLines.slice(Math.max(0, prefix - 3), prefix);
  const contextAfter = oldLines.slice(
    oldLines.length - suffix,
    Math.min(oldLines.length, oldLines.length - suffix + 3)
  );

  const hunkLines: string[] = [];
  for (const line of contextBefore) hunkLines.push(` ${line}`);
  for (const line of removed) hunkLines.push(`-${line}`);
  for (const line of added) hunkLines.push(`+${line}`);
  for (const line of contextAfter) hunkLines.push(` ${line}`);

  const oldStart = Math.max(1, prefix - contextBefore.length + 1);
  const oldCount = contextBefore.length + removed.length + contextAfter.length;
  const newStart = Math.max(1, prefix - contextBefore.length + 1);
  const newCount = contextBefore.length + added.length + contextAfter.length;

  return `--- a/${filePath}\n+++ b/${filePath}\n@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n${hunkLines.join("\n")}`;
}

/**
 * Adapter session wrapping an isolated OMP AgentSession, normalizing internal
 * stream deltas, tool calls, and subagent lifecycle events into standardized @nightglide/core AgentEvents.
 */
export class OmpAgentSession implements AgentSession {
  readonly id: string;
  readonly model: string;
  readonly workspacePath: string;
  readonly readOnly: boolean;

  private readonly ompSession: OmpSessionInstance;
  private readonly subagentEventBus?: OmpEventBus;
  private readonly sessionOptions: CreateSessionOptions;
  private status: AgentStatus = "idle";
  private disposed = false;
  private messageHistoryCount = 0;
  private readonly subscribers = new Set<AgentEventHandler>();
  private unsubscribeOmp: (() => void) | null = null;
  private unsubscribeSubagent: (() => void) | null = null;
  private readonly subagents = new Map<string, SubagentMonitorItem>();
  private currentActiveToolName: string | null = null;
  private readonly activeToolCalls = new Map<
    string,
    { toolName: string; args: Record<string, unknown>; snapshot?: string }
  >();
  private readonly pendingApprovals = new Map<string, (answer: ApprovalAnswer) => void>();

  constructor(
    ompSession: OmpSessionInstance,
    workspacePath: string,
    model: string,
    subagentEventBus?: OmpEventBus,
    sessionId?: string,
    readOnly = false,
    sessionOptions?: CreateSessionOptions
  ) {
    this.ompSession = ompSession;
    this.workspacePath = workspacePath;
    this.model = model;
    this.subagentEventBus = subagentEventBus;
    this.readOnly = readOnly;
    this.sessionOptions = sessionOptions ?? { workspacePath, readOnly };
    this.id = sessionId ?? ompSession.sessionManager.getSessionId?.() ?? `omp_session_${Date.now()}`;

    // Subscribe to internal main OMP session events
    this.unsubscribeOmp = this.ompSession.subscribe((event) => {
      this.handleOmpEvent(event);
    });

    // Subscribe to root subagent event bus for native multi-agent observability
    if (this.subagentEventBus && typeof this.subagentEventBus.on === "function") {
      this.unsubscribeSubagent = this.subagentEventBus.on("task:subagent:event", (payload: any) => {
        this.handleSubagentEvent(payload);
      });
    }
  }

  private emit(event: AgentEvent): void {
    if (this.disposed) return;
    for (const handler of this.subscribers) {
      try {
        handler(event);
      } catch (err) {
        console.error("OmpAgentSession event handler error:", err);
      }
    }
  }

  private setStatus(status: AgentStatus, message?: string): void {
    this.status = status;
    this.emit({ type: "status", status, message });
  }

  /**
   * Handles approval requests initiated by native OMP tools via ExtensionUIContext.approve.
   */
  handleApprovalPrompt(prompt: {
    full: string;
    compact: string;
    session?: string;
  }): Promise<ApprovalAnswer> {
    const id = `approval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let toolName = this.currentActiveToolName;
    if (!toolName) {
      const match =
        prompt.compact?.match(/Allow tool:\s*([a-zA-Z0-9_-]+)/i) ||
        prompt.full?.match(/Allow tool:\s*([a-zA-Z0-9_-]+)/i) ||
        prompt.full?.match(/^([a-zA-Z0-9_-]+)/);
      toolName = match ? match[1] : "tool";
    }

    if (this.sessionOptions.approvalMode === "yolo") {
      return Promise.resolve("session");
    }
    if (this.sessionOptions.approvalMode === "auto") {
      return Promise.resolve("once");
    }

    return new Promise<ApprovalAnswer>((resolvePromise) => {
      let settled = false;
      const resolve = (answer: ApprovalAnswer) => {
        if (settled) return;
        settled = true;
        this.pendingApprovals.delete(id);
        this.emit({
          type: "approval_resolved",
          id,
          answer,
        });
        resolvePromise(answer);
      };

      this.pendingApprovals.set(id, resolve);

      const request = {
        id,
        toolName,
        prompt: {
          full: prompt.full,
          compact: prompt.compact,
          session: prompt.session,
        },
        resolve,
      };

      this.emit({
        type: "approval_request",
        ...request,
      });

      if (typeof this.sessionOptions.onApprovalRequest === "function") {
        try {
          this.sessionOptions.onApprovalRequest(request);
        } catch (err) {
          console.error("OmpAgentSession onApprovalRequest error:", err);
        }
      }
    });
  }

  /**
   * Normalizes an OMP internal session event into Nightglide's typed AgentEvents.
   */
  handleOmpEvent(event: any): void {
    if (this.disposed || !event) return;

    switch (event.type) {
      case "agent_start":
      case "turn_start": {
        this.setStatus("thinking");
        break;
      }

      case "message_update": {
        const assistantEvent = event.assistantMessageEvent;
        if (!assistantEvent) break;

        switch (assistantEvent.type) {
          case "text_start":
            this.setStatus("streaming");
            break;
          case "text_delta":
            if (this.status !== "streaming") {
              this.setStatus("streaming");
            }
            if (typeof assistantEvent.delta === "string" && assistantEvent.delta.length > 0) {
              this.emit({ type: "text_delta", delta: assistantEvent.delta });
            }
            break;
          case "thinking_start":
            this.setStatus("thinking");
            break;
          case "error":
            this.setStatus("error");
            this.emit({
              type: "error",
              error: assistantEvent.error?.message ?? "Stream delta error",
              recoverable: false,
            });
            break;
        }
        break;
      }

      case "tool_execution_start": {
        const toolName = event.toolName;
        const toolCallId = event.toolCallId;
        const args = (event.args as Record<string, unknown>) ?? {};
        this.currentActiveToolName = toolName;

        let snapshot: string | undefined = undefined;
        if (toolName === "write" || toolName === "edit") {
          const rawPath =
            typeof args.path === "string"
              ? args.path
              : typeof args.file_path === "string"
                ? args.file_path
                : undefined;
          if (rawPath) {
            const absPath = path.isAbsolute(rawPath)
              ? rawPath
              : path.resolve(this.workspacePath, rawPath);
            try {
              if (fsSync.existsSync(absPath)) {
                snapshot = fsSync.readFileSync(absPath, "utf8");
              }
            } catch {}
          }
        }

        this.activeToolCalls.set(toolCallId, { toolName, args, snapshot });

        this.setStatus("executing_tool", `Executing tool: ${toolName}`);
        this.emit({
          type: "tool_start",
          toolName,
          toolCallId,
          input: args,
        });
        break;
      }

      case "tool_execution_end": {
        const toolName = event.toolName;
        const toolCallId = event.toolCallId;
        const stored = this.activeToolCalls.get(toolCallId);
        this.activeToolCalls.delete(toolCallId);
        if (this.currentActiveToolName === toolName) {
          this.currentActiveToolName = null;
        }

        let diff: FileDiffData | undefined = undefined;
        if (toolName === "edit" || toolName === "write") {
          diff = this.extractDiffData(
            toolName,
            stored?.args ?? (event.args as Record<string, unknown>),
            event.result,
            stored?.snapshot
          );
        }

        this.emit({
          type: "tool_end",
          toolName,
          toolCallId,
          result: event.result,
          error: event.isError
            ? typeof event.result === "string"
              ? event.result
              : "Tool execution encountered an error"
            : undefined,
          diff,
        });
        break;
      }

      case "message_end": {
        const msg = event.message;
        if (msg && msg.role === "assistant") {
          if (msg.stopReason === "error" || msg.errorMessage) {
            this.setStatus("error");
            this.emit({
              type: "error",
              error: msg.errorMessage ?? "Assistant message ended with an error",
              recoverable: false,
            });
          }
        }
        break;
      }

      case "agent_end":
      case "turn_end": {
        this.setStatus("completed");
        this.emit({
          type: "done",
          summary: "OMP turn finished.",
          totalTokens: event.usage?.totalTokens,
        });
        this.setStatus("idle");
        break;
      }

      case "auto_retry_start": {
        this.setStatus("thinking", `Retrying: ${event.errorMessage}`);
        break;
      }

      case "auto_retry_end": {
        if (!event.success) {
          this.setStatus("error");
          this.emit({
            type: "error",
            error: event.finalError ?? "Auto retry failed",
            recoverable: false,
          });
        }
        break;
      }
    }
  }

  /**
   * Extracts or generates FileDiffData from tool execution results or filesystem state.
   */
  private extractDiffData(
    toolName: string,
    args: Record<string, unknown> | undefined,
    result: unknown,
    snapshot?: string
  ): FileDiffData | undefined {
    // 1. Direct FileDiffData object provided on result or args
    if (result && typeof result === "object" && "diff" in result) {
      const resDiff = (result as any).diff;
      if (
        resDiff &&
        typeof resDiff === "object" &&
        typeof resDiff.filePath === "string" &&
        typeof resDiff.diff === "string"
      ) {
        return resDiff as FileDiffData;
      }
    }
    if (args && typeof args === "object" && "diff" in args) {
      const argsDiff = (args as any).diff;
      if (
        argsDiff &&
        typeof argsDiff === "object" &&
        typeof argsDiff.filePath === "string" &&
        typeof argsDiff.diff === "string"
      ) {
        return argsDiff as FileDiffData;
      }
    }

    // 2. OMP edit tool details
    if (result && typeof result === "object" && "details" in result) {
      const details = (result as any).details;
      if (details && typeof details === "object") {
        if (typeof details.diff === "string" && details.diff.length > 0) {
          const stats = parseDiffStats(details.diff);
          const filePath =
            (args?.path as string) ??
            (args?.file_path as string) ??
            details.path ??
            details.perFileResults?.[0]?.path ??
            "unknown";
          return {
            filePath,
            diff: details.diff,
            additions: stats.additions,
            deletions: stats.deletions,
          };
        }

        if (
          typeof details.oldText === "string" ||
          typeof details.newText === "string"
        ) {
          const filePath =
            (args?.path as string) ??
            (args?.file_path as string) ??
            details.path ??
            details.perFileResults?.[0]?.path ??
            "unknown";
          const oldText = details.oldText ?? "";
          const newText = details.newText ?? "";
          const diffText = generateUnifiedDiff(filePath, oldText, newText);
          const stats = parseDiffStats(diffText);
          return {
            filePath,
            diff: diffText,
            additions: stats.additions,
            deletions: stats.deletions,
          };
        }
      }
    }

    // 3. String diff on result
    if (result && typeof result === "object" && typeof (result as any).diff === "string") {
      const diffStr = (result as any).diff;
      if (diffStr.length > 0) {
        const stats = parseDiffStats(diffStr);
        const filePath =
          (args?.path as string) ??
          (args?.file_path as string) ??
          (result as any).filePath ??
          "unknown";
        return {
          filePath,
          diff: diffStr,
          additions: stats.additions,
          deletions: stats.deletions,
        };
      }
    }

    // 4. File system inspection for write / edit if content or changes occurred
    const rawPath =
      (args?.path as string) ??
      (args?.file_path as string) ??
      (result && typeof result === "object" && (result as any).details?.resolvedPath
        ? (result as any).details.resolvedPath
        : undefined);

    if (rawPath) {
      const absPath = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(this.workspacePath, rawPath);
      let currentDiskContent: string | undefined = undefined;
      try {
        if (fsSync.existsSync(absPath)) {
          currentDiskContent = fsSync.readFileSync(absPath, "utf8");
        }
      } catch {}

      const content =
        typeof args?.content === "string"
          ? args.content
          : currentDiskContent;

      if (snapshot !== undefined && currentDiskContent !== undefined) {
        if (snapshot !== currentDiskContent) {
          const diffText = generateUnifiedDiff(rawPath, snapshot, currentDiskContent);
          const stats = parseDiffStats(diffText);
          return {
            filePath: rawPath,
            diff: diffText,
            additions: stats.additions,
            deletions: stats.deletions,
          };
        }
      } else if (content !== undefined) {
        const oldText = snapshot ?? "";
        const diffText = generateUnifiedDiff(rawPath, oldText, content);
        const stats = parseDiffStats(diffText);
        return {
          filePath: rawPath,
          diff: diffText,
          additions: stats.additions,
          deletions: stats.deletions,
        };
      }
    }

    return undefined;
  }

  /**
   * Normalizes raw subagent events from OMP's subagentEventBus into Nightglide subagent events.
   */
  handleSubagentEvent(payload: any): void {
    if (this.disposed || !payload || !payload.id || !payload.event) return;

    const subagentId = String(payload.id);
    const innerEvent = payload.event;
    const subItem = this.subagents.get(subagentId) ?? {
      id: subagentId,
      role: "scout" as AgentRole,
      model: "omp-subagent",
      providerId: "omp",
      locality: "local" as ProviderLocality,
      task: "Delegated subagent task",
      status: "thinking" as AgentStatus,
      startedAt: Date.now(),
    };

    switch (innerEvent.type) {
      case "tool_execution_start": {
        this.subagents.set(subagentId, { ...subItem, status: "executing_tool" });
        break;
      }

      case "tool_execution_end": {
        this.subagents.set(subagentId, { ...subItem, status: "thinking" });
        break;
      }

      case "agent_start":
      case "turn_start": {
        this.subagents.set(subagentId, { ...subItem, status: "thinking" });
        this.emit({
          type: "subagent_start",
          subagentId,
          role: subItem.role,
          model: subItem.model,
          providerId: subItem.providerId,
          locality: subItem.locality,
          task: subItem.task,
        });
        break;
      }

      case "message_update": {
        const assistantEvt = innerEvent.assistantMessageEvent;
        if (assistantEvt && assistantEvt.type === "text_delta" && assistantEvt.delta) {
          this.subagents.set(subagentId, { ...subItem, status: "streaming" });
          this.emit({
            type: "subagent_delta",
            subagentId,
            delta: assistantEvt.delta,
          });
        }
        break;
      }

      case "agent_end":
      case "turn_end": {
        const ended: SubagentMonitorItem = {
          ...subItem,
          status: "completed",
          totalTokens: innerEvent.usage?.totalTokens,
          endedAt: Date.now(),
        };
        this.subagents.set(subagentId, ended);
        this.emit({
          type: "subagent_end",
          subagentId,
          result: "Subagent completed.",
          totalTokens: innerEvent.usage?.totalTokens,
        });
        break;
      }
    }
  }

  async sendMessage(prompt: string): Promise<void> {
    if (this.disposed || Boolean(this.ompSession.isDisposed)) {
      throw new SessionDisposedError("Cannot send message to a disposed OmpAgentSession.");
    }

    this.messageHistoryCount++;
    try {
      await this.ompSession.prompt(prompt);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("No model configured") ||
        message.includes("No model selected") ||
        message.includes("Could not resolve model") ||
        message.includes("Model not found")
      ) {
        throw new ModelNotConfiguredError(message);
      }
      throw new EngineError(message);
    }
  }

  subscribe(handler: AgentEventHandler): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  async cancel(): Promise<void> {
    if (this.disposed || Boolean(this.ompSession.isDisposed)) return;
    this.setStatus("cancelling", "Cancelling session and active subagents...");

    for (const [id, resolver] of this.pendingApprovals.entries()) {
      try {
        resolver("deny");
      } catch {}
    }
    this.pendingApprovals.clear();

    try {
      await this.ompSession.abort({ reason: "User cancelled session" } as any);
    } catch {
      // Abort is safe no-op if session already idle
    } finally {
      // Cleanly terminate and transition any active subagents to terminal status
      for (const [subagentId, subagent] of this.subagents.entries()) {
        if (
          subagent.status === "thinking" ||
          subagent.status === "streaming" ||
          subagent.status === "executing_tool"
        ) {
          const ended: SubagentMonitorItem = {
            ...subagent,
            status: "completed",
            endedAt: Date.now(),
          };
          this.subagents.set(subagentId, ended);
          this.emit({
            type: "subagent_end",
            subagentId,
            result: "Subagent cancelled.",
            error: "Subagent execution halted by user cancellation.",
          });
        }
      }
      this.setStatus("idle", "Session cancelled.");
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    // Terminate any active work cleanly
    try {
      await this.cancel();
    } catch {}

    for (const [id, resolver] of this.pendingApprovals.entries()) {
      try {
        resolver("deny");
      } catch {}
    }
    this.pendingApprovals.clear();

    if (this.unsubscribeOmp) {
      try {
        this.unsubscribeOmp();
      } catch {}
      this.unsubscribeOmp = null;
    }

    if (this.unsubscribeSubagent) {
      try {
        this.unsubscribeSubagent();
      } catch {}
      this.unsubscribeSubagent = null;
    }

    this.subscribers.clear();
    this.status = "idle";

    // Ensure all subagents are marked completed
    for (const [subagentId, subagent] of this.subagents.entries()) {
      if (!subagent.endedAt) {
        this.subagents.set(subagentId, {
          ...subagent,
          status: "completed",
          endedAt: Date.now(),
        });
      }
    }

    try {
      await this.ompSession.dispose();
    } catch {}
  }

  getState(): SessionState {
    const isUnderlyingDisposed = Boolean(this.ompSession.isDisposed);
    return {
      id: this.id,
      status: this.status,
      model: this.ompSession.model?.id ?? this.model,
      workspacePath: this.workspacePath,
      messageHistoryCount: this.ompSession.state?.messages?.length ?? this.messageHistoryCount,
      isDisposed: this.disposed || isUnderlyingDisposed,
      activeSubagents: Array.from(this.subagents.values()),
    };
  }
}

/**
 * Production AgentEngine implementation backed by Oh-My-Pi (OMP).
 * Features native subagent delegation via `task`, native tool registration,
 * and dynamic role-based model overrides.
 */
export class OmpAgentEngine implements AgentEngine {
  readonly id = "omp-adapter";
  readonly isMock = false;

  constructor(private readonly options: OmpAgentEngineOptions = {}) {}

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    const agentDir =
      options.agentDir ??
      this.options.defaultAgentDir ??
      path.join(os.tmpdir(), `nightglide-omp-isolated-${Date.now()}`);

    const ompApprovalMode =
      options.approvalMode === "auto"
        ? "yolo"
        : options.approvalMode
          ? options.approvalMode
          : options.onApprovalRequest
            ? "always-ask"
            : "yolo";

    // Configure isolated settings with find.enabled on and approval mode configured
    const initialSettings: Record<string, unknown> = {
      "find.enabled": "on",
      "edit.mode": "replace",
      "tools.approvalMode": ompApprovalMode,
    };
    const settings = Settings.isolated(initialSettings);

    // Configure role-based model mappings in OMP settings
    if (options.roleModelOverrides) {
      const overrides: Record<string, string> = {};
      for (const [role, modelSelector] of Object.entries(options.roleModelOverrides)) {
        if (modelSelector && typeof modelSelector === "string") {
          settings.setModelRole(role, modelSelector);
          overrides[role] = modelSelector;
        }
      }
      try {
        settings.overrideModelRoles(overrides);
      } catch {
        // Safe fallback
      }
    }

    const sessionOptions: Parameters<typeof createAgentSession>[0] = {
      cwd: options.workspacePath,
      agentDir,
      sessionManager: SessionManager.inMemory(options.workspacePath),
      settings,
      disableExtensionDiscovery: true,
      enableMCP: false,
      enableLsp: false,
      modelPattern: options.model ?? this.options.model ?? this.options.defaultModel,
      systemPrompt: options.systemPrompt,
    };

    // If readOnly is explicitly opt-in true, restrict to native read-only tools
    if (options.readOnly) {
      sessionOptions.restrictToolNames = true;
      sessionOptions.toolNames = ["read", "find", "grep", "glob", "task", "wait", "todo", "web_search"];
    }

    const sessionResult = await createAgentSession(sessionOptions);

    const resolvedModel =
      sessionResult.session.model?.id ??
      options.model ??
      this.options.model ??
      this.options.defaultModel ??
      "omp-default";

    const session = new OmpAgentSession(
      sessionResult.session,
      options.workspacePath,
      resolvedModel,
      sessionResult.subagentEventBus,
      undefined,
      Boolean(options.readOnly),
      options
    );

    const uiContext = {
      supportsEditor: false,
      select: async (_title: string, optionsList: Array<{ label: string }>) =>
        optionsList[0]?.label,
      confirm: async () => true,
      input: async () => undefined,
      notify: () => {},
      onTerminalInput: () => () => {},
      rerenderMessage: () => {},
      refreshTranscript: () => {},
      getLinkClicksAvailable: () => false,
      approve: async (prompt: { full: string; compact: string; session?: string }) => {
        return session.handleApprovalPrompt(prompt);
      },
    };

    if (typeof sessionResult.setToolUIContext === "function") {
      sessionResult.setToolUIContext(uiContext as any, true);
    }

    const runner = (sessionResult.session as any).extensionRunner;
    if (runner && typeof runner.initialize === "function") {
      try {
        runner.initialize(
          {
            sendMessage: async (m: any, o: any) => {
              (sessionResult.session as any).sendCustomMessage?.(m, o);
            },
            sendUserMessage: (c: any, o: any) =>
              (sessionResult.session as any).sendUserMessage?.(c, o),
            appendEntry: (t: any, d: any) =>
              (sessionResult.session as any).sessionManager?.appendCustomEntry?.(t, d),
            getActiveTools: () => (sessionResult.session as any).getActiveToolNames?.() ?? [],
            getAllTools: () => (sessionResult.session as any).getAllToolInfos?.() ?? [],
            setActiveTools: async (n: any) =>
              (sessionResult.session as any).setActiveToolsByName?.(n),
            getCommands: () => [],
            setModel: async (m: any) => (sessionResult.session as any).setModel?.(m),
            getThinkingLevel: () => (sessionResult.session as any).thinkingLevel,
            setThinkingLevel: (l: any) => (sessionResult.session as any).setThinkingLevel?.(l),
            getSessionName: () => (sessionResult.session as any).sessionManager?.getSessionName?.(),
            setSessionName: async (n: any) =>
              (sessionResult.session as any).sessionManager?.setSessionName?.(n, "user"),
          },
          {
            getModel: () => sessionResult.session.model,
            isIdle: () => !sessionResult.session.isStreaming,
            abort: () => {
              sessionResult.session.abort({ reason: "User cancelled session" } as any);
            },
            hasPendingWork: () => false,
            shutdown: async () => {
              await sessionResult.session.dispose();
            },
            getContextUsage: () => undefined,
            compact: async () => undefined,
          },
          undefined,
          uiContext as any,
          "interactive"
        );
      } catch {
        // Safe fallback
      }
    }

    return session;
  }

  async checkHealth(): Promise<EngineHealthResult> {
    const probeAgentDir = path.join(os.tmpdir(), `nightglide-omp-probe-${Date.now()}`);

    try {
      const probeResult = await createAgentSession({
        cwd: this.options.defaultWorkspacePath ?? process.cwd(),
        agentDir: this.options.defaultAgentDir ?? probeAgentDir,
        sessionManager: SessionManager.inMemory(this.options.defaultWorkspacePath ?? process.cwd()),
        settings: Settings.isolated({ "find.enabled": "on" }),
        disableExtensionDiscovery: true,
        enableMCP: false,
        enableLsp: false,
      });

      try {
        const discoverable = probeResult.session.modelRegistry.getDiscoverableProviders();
        const authedProviders = discoverable.filter((p) =>
          probeResult.session.modelRegistry.hasConcreteAuth(p)
        );
        const hasAuth = authedProviders.length > 0;
        const availableModels = probeResult.session.modelRegistry.getAvailable();
        const ready = hasAuth && availableModels.length > 0;
        const activeTools = probeResult.session.getActiveToolNames?.() ?? [];
        const message = ready
          ? `OMP runtime operational. ${availableModels.length} models authenticated, native task delegation ready.`
          : "OMP runtime initialized, native task delegation enabled, but no authenticated providers or API keys configured.";

        return {
          ready,
          engineId: this.id,
          isMock: this.isMock,
          message,
          details: {
            availableModelsCount: availableModels.length,
            hasConcreteAuth: hasAuth,
            taskToolEnabled: activeTools.includes("task"),
            allowedTools: activeTools,
          },
        };
      } finally {
        await probeResult.session.dispose();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ready: false,
        engineId: this.id,
        isMock: this.isMock,
        message: `OMP runtime health check failed: ${message}`,
        details: {
          error: message,
        },
      };
    }
  }
}
