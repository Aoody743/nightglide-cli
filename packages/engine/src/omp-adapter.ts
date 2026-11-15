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
  EngineError,
  ModelNotConfiguredError,
  SessionDisposedError,
  RoutingPolicyViolationError,
} from "@nightglide/core";
import {
  resolveEndpointLocality,
  type ProviderRegistry,
} from "@nightglide/providers";

export interface OmpAgentEngineOptions {
  defaultWorkspacePath?: string;
  defaultAgentDir?: string;
  defaultModel?: string;
  model?: string;
  baseUrl?: string;
  providerRegistry?: ProviderRegistry;
}

/** Mutating tool names strictly prohibited in read-only mode */
export const MUTATING_TOOL_NAMES = new Set(["write", "edit", "bash"]);

/** Subagent types that are guaranteed read-only and permitted to spawn in read-only mode */
export const READ_ONLY_PERMITTED_AGENTS = new Set([
  "scout",
  "security-reviewer",
  "seance",
]);

/**
 * Creates a strict privacy model assertion guard: validates provider locality,
 * endpoint URLs (WHATWG + RFC loopback/SSRF checks), and model selectors
 * before any outbound dispatch occurs.
 */
export function createModelDispatchGuard(
  options: CreateSessionOptions,
  providerRegistry?: ProviderRegistry
): (model: any) => void {
  return (model: any) => {
    const isLocalMode = options.routingMode === "LOCAL";
    const isCloudBlocked = options.allowCloud === false;

    if (isLocalMode || isCloudBlocked) {
      const providerName = String(model?.provider || "").toLowerCase().trim();
      const modelId = String(model?.id || "").toLowerCase().trim();
      const baseUrl = model?.baseUrl ? String(model.baseUrl).trim() : undefined;

      // 1. If an explicit endpoint baseUrl is present, strictly enforce locality via WHATWG + RFC checks
      if (baseUrl) {
        const locality = resolveEndpointLocality(baseUrl);
        if (locality !== "local") {
          throw new RoutingPolicyViolationError(
            `Strict privacy policy violation: model '${model?.id}' (${model?.provider}) targeted non-local endpoint '${baseUrl}' (resolved locality: '${locality}') while in ${options.routingMode || "LOCAL"} mode.`
          );
        }
      }

      // 2. Reject known public cloud providers outright
      const knownCloudProviders = new Set([
        "openai",
        "anthropic",
        "google",
        "azure",
        "cohere",
        "mistral",
        "together",
        "groq",
        "openrouter",
        "deepseek",
        "bedrock",
        "aws",
        "gemini",
      ]);

      if (knownCloudProviders.has(providerName)) {
        throw new RoutingPolicyViolationError(
          `Strict privacy policy violation: model '${model?.id}' (${model?.provider}) attempted unauthorized cloud transmission while in ${options.routingMode || "LOCAL"} mode.`
        );
      }

      // 3. Inspect model selector / ID for cloud provider prefixes
      for (const cloudP of knownCloudProviders) {
        if (modelId.startsWith(`${cloudP}/`) || modelId.startsWith(`${cloudP}:`)) {
          throw new RoutingPolicyViolationError(
            `Strict privacy policy violation: model '${model?.id}' targets cloud provider '${cloudP}' while in ${options.routingMode || "LOCAL"} mode.`
          );
        }
      }

      // 4. If a providerRegistry is supplied, verify against its registered locality
      if (providerRegistry) {
        const registered = providerRegistry.get(providerName);
        if (registered && registered.locality !== "local") {
          throw new RoutingPolicyViolationError(
            `Strict privacy policy violation: registered provider '${providerName}' has locality '${registered.locality}', violating ${options.routingMode || "LOCAL"} mode.`
          );
        }
      }

      // 5. Must be a recognized local provider or local selector
      const isRecognizedLocal =
        providerName === "local" ||
        providerName === "omlx" ||
        providerName === "ollama" ||
        providerName === "lmstudio" ||
        modelId.startsWith("omlx/") ||
        modelId.startsWith("local/") ||
        modelId.startsWith("ollama/") ||
        modelId.startsWith("lmstudio/");

      if (!isRecognizedLocal && !baseUrl) {
        throw new RoutingPolicyViolationError(
          `Strict privacy policy violation: unrecognized provider '${model?.provider}' (model '${model?.id}') cannot be verified as local while in ${options.routingMode || "LOCAL"} mode.`
        );
      }
    }
  };
}

type OmpSessionInstance = Awaited<ReturnType<typeof createAgentSession>>["session"];
type OmpEventBus = Awaited<ReturnType<typeof createAgentSession>>["subagentEventBus"];

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
  private status: AgentStatus = "idle";
  private disposed = false;
  private messageHistoryCount = 0;
  private readonly subscribers = new Set<AgentEventHandler>();
  private unsubscribeOmp: (() => void) | null = null;
  private unsubscribeSubagent: (() => void) | null = null;
  private readonly subagents = new Map<string, SubagentMonitorItem>();

  constructor(
    ompSession: OmpSessionInstance,
    workspacePath: string,
    model: string,
    subagentEventBus?: OmpEventBus,
    sessionId?: string,
    readOnly = false
  ) {
    this.ompSession = ompSession;
    this.workspacePath = workspacePath;
    this.model = model;
    this.subagentEventBus = subagentEventBus;
    this.readOnly = readOnly;
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
        // Enforce below-the-prompt invariant: hard block on mutating tools in read-only mode
        if (this.readOnly && MUTATING_TOOL_NAMES.has(event.toolName)) {
          this.setStatus("error", `Security violation: mutating tool '${event.toolName}' blocked in read-only mode.`);
          this.emit({
            type: "error",
            error: `Security violation: mutating tool '${event.toolName}' is strictly prohibited in read-only mode.`,
            recoverable: false,
          });
          void this.ompSession.abort({ reason: "Read-only policy violation" } as any);
          break;
        }

        this.setStatus("executing_tool", `Executing tool: ${event.toolName}`);
        this.emit({
          type: "tool_start",
          toolName: event.toolName,
          toolCallId: event.toolCallId,
          input: (event.args as Record<string, unknown>) ?? {},
        });
        break;
      }

      case "tool_execution_end": {
        this.emit({
          type: "tool_end",
          toolName: event.toolName,
          toolCallId: event.toolCallId,
          result: event.result,
          error: event.isError
            ? typeof event.result === "string"
              ? event.result
              : "Tool execution encountered an error"
            : undefined,
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
        if (this.readOnly && MUTATING_TOOL_NAMES.has(innerEvent.toolName)) {
          this.emit({
            type: "error",
            error: `Security violation: Subagent '${subagentId}' attempted mutating tool '${innerEvent.toolName}' in read-only mode.`,
            recoverable: false,
          });
          void this.cancel();
          break;
        }
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
 * Features native subagent delegation via `task`, strict below-the-prompt permission isolation,
 * model dispatch validation via `assertDispatchModel`, and dynamic role-based model overrides.
 */
export class OmpAgentEngine implements AgentEngine {
  readonly id = "omp-adapter";
  readonly isMock = false;

  constructor(private readonly options: OmpAgentEngineOptions = {}) {}

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    const agentDir =
      options.agentDir ??
      this.options.defaultAgentDir ??
      path.join(os.tmpdir(), "nightglide-omp-isolated");

    // Configure isolated settings with permission invariants
    const baseOverrides: Record<string, unknown> = {};

    if (options.readOnly) {
      // 1. Settings-level deny for all mutating tools (inherited by subagents live)
      baseOverrides["tools.approval"] = {
        write: "deny",
        edit: "deny",
        bash: "deny",
      };
      // 2. Settings-level disable of mutating agents (task, reviewer, sonic)
      baseOverrides["task.disabledAgents"] = ["task", "reviewer", "sonic"];
    }

    const settings = Settings.isolated(baseOverrides);

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

    // Strict privacy model assertion guard: called before any model request on wire
    const assertDispatchModel = createModelDispatchGuard(
      options,
      this.options.providerRegistry
    );

    const allowedTools = options.readOnly
      ? ["read", "find", "grep", "task"]
      : ["read", "find", "grep", "task", "write", "edit", "bash"];

    const sessionResult = await createAgentSession({
      cwd: options.workspacePath,
      agentDir,
      sessionManager: SessionManager.inMemory(),
      settings,
      disableExtensionDiscovery: true,
      enableMCP: false,
      enableLsp: false,
      restrictToolNames: true,
      toolNames: allowedTools,
      modelPattern: options.model ?? this.options.model ?? this.options.defaultModel,
      systemPrompt: options.systemPrompt,
      assertDispatchModel,
    });

    // When readOnly is true, enforce below-the-prompt tool guard on the task tool
    if (options.readOnly) {
      const taskTool = sessionResult.session.getToolByName?.("task");
      if (taskTool && typeof taskTool.execute === "function") {
        const originalExecute = taskTool.execute.bind(taskTool);
        taskTool.execute = async (toolCallId: string, params: any, ...rest: any[]) => {
          const requestedAgent = String(params?.agent ?? "task").toLowerCase();
          if (!READ_ONLY_PERMITTED_AGENTS.has(requestedAgent)) {
            throw new EngineError(
              `Permission denied: Subagent '${requestedAgent}' requires mutating permissions (bash/write/edit) which are strictly prohibited in read-only mode. Only read-only subagents (such as 'scout') are permitted.`
            );
          }
          return originalExecute(toolCallId, params, ...rest);
        };
      }
    }

    const resolvedModel =
      sessionResult.session.model?.id ??
      options.model ??
      this.options.model ??
      this.options.defaultModel ??
      "omp-default";

    return new OmpAgentSession(
      sessionResult.session,
      options.workspacePath,
      resolvedModel,
      sessionResult.subagentEventBus,
      undefined,
      Boolean(options.readOnly)
    );
  }

  async checkHealth(): Promise<EngineHealthResult> {
    const probeAgentDir = path.join(os.tmpdir(), `nightglide-omp-probe-${Date.now()}`);

    try {
      const probeResult = await createAgentSession({
        cwd: this.options.defaultWorkspacePath ?? process.cwd(),
        agentDir: this.options.defaultAgentDir ?? probeAgentDir,
        sessionManager: SessionManager.inMemory(),
        settings: Settings.isolated(),
        disableExtensionDiscovery: true,
        enableMCP: false,
        enableLsp: false,
        restrictToolNames: true,
        toolNames: ["read", "find", "grep", "task"],
      });

      try {
        const discoverable = probeResult.session.modelRegistry.getDiscoverableProviders();
        const authedProviders = discoverable.filter((p) =>
          probeResult.session.modelRegistry.hasConcreteAuth(p)
        );
        const hasAuth = authedProviders.length > 0;
        const availableModels = probeResult.session.modelRegistry.getAvailable();
        const ready = hasAuth && availableModels.length > 0;
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
            taskToolEnabled: true,
            allowedTools: ["read", "find", "grep", "task"],
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
