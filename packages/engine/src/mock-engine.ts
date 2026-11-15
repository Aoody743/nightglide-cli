import {
  type AgentEngine,
  type AgentSession,
  type CreateSessionOptions,
  type EngineHealthResult,
  type AgentEvent,
  type AgentEventHandler,
  type SessionState,
  type AgentStatus,
  SessionDisposedError,
} from "@nightglide/core";

/**
 * Deterministic celestial flight greeting chunks used for realistic demo streaming.
 */
export const DEFAULT_MOCK_GREETING_CHUNKS: readonly string[] = [
  "Welcome aboard Nightglide. ",
  "Entering the midnight flight corridor with optimal celestial alignment.\n\n",
  "Telemetry check: Altitude 35,000 ft | Cruising speed Mach 0.85 | Sky conditions: Clear starlight.\n",
  "All celestial sensors and agent runtime subsystems are nominal.\n\n",
  "Standing by for your flight directives. How may I assist your mission today?",
];

export interface MockEngineOptions {
  stepDelayMs?: number;
  greetingChunks?: readonly string[];
  mockToolResult?: unknown;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new Error("Aborted"));
      }
      setImmediate(resolve);
    });
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error("Aborted"));
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Aborted"));
    };

    signal?.addEventListener("abort", onAbort);
  });
}

/**
 * Deterministic mock agent session simulating realistic agent lifecycle events,
 * tool invocation, celestial greeting streaming, and cancellation.
 */
export class MockAgentSession implements AgentSession {
  readonly id: string;
  readonly model: string;
  readonly workspacePath: string;

  private status: AgentStatus = "idle";
  private disposed = false;
  private messageCount = 0;
  private isCancelled = false;
  private readonly subscribers = new Set<AgentEventHandler>();
  private currentAbortController: AbortController | null = null;
  private readonly stepDelayMs: number;
  private readonly greetingChunks: readonly string[];
  private readonly mockToolResult: unknown;

  constructor(options: CreateSessionOptions, engineOptions?: MockEngineOptions) {
    this.id = `mock_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.model = options.model ?? "celestial-mock-v1";
    this.workspacePath = options.workspacePath;
    this.stepDelayMs = engineOptions?.stepDelayMs ?? 10;
    this.greetingChunks = engineOptions?.greetingChunks ?? DEFAULT_MOCK_GREETING_CHUNKS;
    this.mockToolResult = engineOptions?.mockToolResult ?? {
      status: "verified",
      flightPlan: "FL350-STAR-01",
      clearance: "APPROVED",
      corridor: "midnight-skyway",
    };
  }

  private emit(event: AgentEvent): void {
    if (this.disposed) return;
    for (const handler of this.subscribers) {
      try {
        handler(event);
      } catch (err) {
        console.error("MockAgentSession handler error:", err);
      }
    }
  }

  private setStatus(status: AgentStatus, message?: string): void {
    this.status = status;
    this.emit({ type: "status", status, message });
  }

  async sendMessage(prompt: string): Promise<void> {
    if (this.disposed) {
      throw new SessionDisposedError("Cannot send message to a disposed MockAgentSession.");
    }

    this.messageCount++;
    this.isCancelled = false;
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    const waitStep = async (ms: number) => {
      if (this.isCancelled || abortController.signal.aborted) {
        throw new Error("Aborted");
      }
      await delay(ms, abortController.signal);
    };

    try {
      // 1. Thinking phase
      this.setStatus("thinking", "Analyzing flight telemetry and celestial coordinates...");
      await waitStep(this.stepDelayMs);

      // 2. Simulated "read" tool call
      const toolCallId = `call_mock_${Date.now()}`;
      this.setStatus("executing_tool", "Executing tool: read");
      this.emit({
        type: "tool_start",
        toolName: "read",
        toolCallId,
        input: { path: "flight-plan.md" },
      });
      await waitStep(this.stepDelayMs);

      this.emit({
        type: "tool_end",
        toolName: "read",
        toolCallId,
        result: this.mockToolResult,
      });
      await waitStep(this.stepDelayMs);

      // 3. Streaming celestial flight greeting response
      this.setStatus("streaming");
      for (const chunk of this.greetingChunks) {
        if (this.isCancelled || abortController.signal.aborted) {
          throw new Error("Aborted");
        }
        this.emit({ type: "text_delta", delta: chunk });
        await waitStep(this.stepDelayMs);
      }

      // 4. Completed phase
      this.setStatus("completed");
      this.emit({
        type: "done",
        summary: "Celestial flight greeting stream completed successfully.",
        totalTokens: 64,
      });
      this.setStatus("idle");
    } catch (err: unknown) {
      if (
        this.isCancelled ||
        (err instanceof Error && (err.name === "AbortError" || err.message === "Aborted"))
      ) {
        this.setStatus("cancelling");
        this.setStatus("idle", "Flight sequence cancelled by user.");
      } else {
        this.setStatus("error");
        this.emit({
          type: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      this.currentAbortController = null;
    }
  }

  subscribe(handler: AgentEventHandler): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  async cancel(): Promise<void> {
    if (this.disposed) return;
    this.isCancelled = true;
    if (this.currentAbortController) {
      this.setStatus("cancelling");
      this.currentAbortController.abort();
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await this.cancel();
    this.subscribers.clear();
    this.status = "idle";
  }

  getState(): SessionState {
    return {
      id: this.id,
      status: this.status,
      model: this.model,
      workspacePath: this.workspacePath,
      messageHistoryCount: this.messageCount,
      isDisposed: this.disposed,
    };
  }
}

/**
 * Deterministic mock engine implementation for offline development,
 * UI previews, and automated testing.
 */
export class MockAgentEngine implements AgentEngine {
  readonly id = "mock-engine";
  readonly isMock = true;

  constructor(private readonly options: MockEngineOptions = {}) {}

  async createSession(options: CreateSessionOptions): Promise<AgentSession> {
    return new MockAgentSession(options, this.options);
  }

  async checkHealth(): Promise<EngineHealthResult> {
    return {
      ready: true,
      engineId: this.id,
      isMock: true,
      message: "Mock engine is operational and ready for simulated celestial flight.",
      details: {
        mode: "simulation",
        status: "ready",
        supportedTools: ["read"],
      },
    };
  }
}
