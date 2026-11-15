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
  EngineError,
  ModelNotConfiguredError,
  SessionDisposedError,
} from "@nightglide/core";

export interface OmpAgentEngineOptions {
  defaultWorkspacePath?: string;
  defaultAgentDir?: string;
  defaultModel?: string;
  model?: string;
  baseUrl?: string;
}

type OmpSessionInstance = Awaited<ReturnType<typeof createAgentSession>>["session"];

/**
 * Adapter session wrapping an isolated OMP AgentSession and mapping its internal
 * stream deltas and lifecycle events to standardized @nightglide/core AgentEvents.
 */
export class OmpAgentSession implements AgentSession {
  readonly id: string;
  readonly model: string;
  readonly workspacePath: string;

  private readonly ompSession: OmpSessionInstance;
  private status: AgentStatus = "idle";
  private disposed = false;
  private messageHistoryCount = 0;
  private readonly subscribers = new Set<AgentEventHandler>();
  private unsubscribeOmp: (() => void) | null = null;

  constructor(
    ompSession: OmpSessionInstance,
    workspacePath: string,
    model: string,
    sessionId?: string
  ) {
    this.ompSession = ompSession;
    this.workspacePath = workspacePath;
    this.model = model;
    this.id = sessionId ?? ompSession.sessionManager.getSessionId?.() ?? `omp_session_${Date.now()}`;

    // Subscribe to internal OMP session events and map them to normalized AgentEvents
    this.unsubscribeOmp = this.ompSession.subscribe((event) => {
      this.handleOmpEvent(event);
    });
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
   * Public for testing event normalization in isolation.
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

      case "agent_end": {
        this.setStatus("completed");
        this.emit({
          type: "done",
          summary: "Agent turn completed successfully.",
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
            error: event.finalError ?? "Auto-retry failed",
            recoverable: false,
          });
        }
        break;
      }

      case "notice": {
        if (event.level === "error") {
          this.emit({
            type: "error",
            error: event.message,
          });
        }
        break;
      }
    }
  }

  async sendMessage(prompt: string): Promise<void> {
    if (this.disposed || Boolean(this.ompSession.isDisposed)) {
      throw new SessionDisposedError("Cannot send message to a disposed OMP session.");
    }

    this.messageHistoryCount++;
    this.setStatus("thinking");

    try {
      await this.ompSession.prompt(prompt);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus("error");
      this.emit({
        type: "error",
        error: message,
      });

      const lower = message.toLowerCase();
      if (lower.includes("no model") || lower.includes("api key")) {
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
    if (this.disposed || Boolean(this.ompSession.isDisposed)) {
      return;
    }

    this.setStatus("cancelling");
    try {
      await this.ompSession.abort();
    } catch {
      // Abort may be a no-op if session is already idle
    } finally {
      this.setStatus("idle");
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    if (this.unsubscribeOmp) {
      try {
        this.unsubscribeOmp();
      } catch {
        // Safe disposal
      }
      this.unsubscribeOmp = null;
    }
    this.subscribers.clear();
    this.status = "idle";

    try {
      await this.ompSession.dispose();
    } catch {
      // Safe disposal
    }
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
    };
  }
}

/**
 * Production AgentEngine implementation backed by Oh-My-Pi (OMP).
 * Enforces strict memory isolation, disabled extensions/MCP/LSP, and tool whitelisting.
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

    const sessionResult = await createAgentSession({
      cwd: options.workspacePath,
      agentDir,
      sessionManager: SessionManager.inMemory(),
      settings: Settings.isolated(),
      disableExtensionDiscovery: true,
      enableMCP: false,
      enableLsp: false,
      restrictToolNames: true,
      toolNames: ["read", "find", "grep"],
      modelPattern: options.model ?? this.options.model ?? this.options.defaultModel,
      systemPrompt: options.systemPrompt,
    });

    const resolvedModel =
      sessionResult.session.model?.id ??
      options.model ??
      this.options.model ??
      this.options.defaultModel ??
      "omp-default";

    return new OmpAgentSession(
      sessionResult.session,
      options.workspacePath,
      resolvedModel
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
        toolNames: ["read", "find", "grep"],
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
          ? `OMP runtime operational. ${availableModels.length} models authenticated and ready.`
          : "OMP runtime initialized, but no authenticated providers or API keys configured.";

        return {
          ready,
          engineId: this.id,
          isMock: this.isMock,
          message,
          details: {
            availableModelsCount: availableModels.length,
            hasConcreteAuth: hasAuth,
            toolsRestricted: true,
            allowedTools: ["read", "find", "grep"],
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
