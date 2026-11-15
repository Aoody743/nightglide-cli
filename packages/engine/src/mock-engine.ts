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
  type RoutingDecision,
  SessionDisposedError,
} from "@nightglide/core";

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
  forceMultiAgent?: boolean;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error("Aborted"));
      setImmediate(resolve);
    });
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Aborted"));
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
 * Deterministic mock agent session simulating single-agent streaming as well as
 * realistic multi-agent (Local Explorer + Cloud Planner) collaboration.
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
  private readonly forceMultiAgent: boolean;
  private readonly subagents = new Map<string, SubagentMonitorItem>();

  constructor(
    private readonly sessionOptions: CreateSessionOptions,
    engineOptions?: MockEngineOptions
  ) {
    this.id = `mock_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.model = sessionOptions.model ?? "celestial-mock-v1";
    this.workspacePath = sessionOptions.workspacePath;
    this.stepDelayMs = engineOptions?.stepDelayMs ?? 10;
    this.greetingChunks = engineOptions?.greetingChunks ?? DEFAULT_MOCK_GREETING_CHUNKS;
    this.forceMultiAgent = Boolean(engineOptions?.forceMultiAgent);
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

    const isCollabPrompt =
      this.forceMultiAgent ||
      /\b(plan|refactor|collaborat\w*|multi-agent|workflow)\b/i.test(prompt) ||
      /(规划|架构|多智能体|协同|重构)/i.test(prompt);

    try {
      if (isCollabPrompt) {
        await this.runMultiAgentWorkflow(prompt, waitStep);
      } else {
        await this.runSingleAgentWorkflow(waitStep);
      }
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

  private async runSingleAgentWorkflow(waitStep: (ms: number) => Promise<void>): Promise<void> {
    // 1. Thinking
    this.setStatus("thinking", "Analyzing flight telemetry and celestial coordinates...");
    await waitStep(this.stepDelayMs);

    // 2. Simulated tool call
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

    // 3. Streaming response
    this.setStatus("streaming");
    for (const chunk of this.greetingChunks) {
      this.emit({ type: "text_delta", delta: chunk });
      await waitStep(this.stepDelayMs);
    }

    // 4. Done
    this.setStatus("completed");
    this.emit({
      type: "done",
      summary: "Celestial flight greeting stream completed successfully.",
      totalTokens: 64,
    });
    this.setStatus("idle");
  }

  private async runMultiAgentWorkflow(
    prompt: string,
    waitStep: (ms: number) => Promise<void>
  ): Promise<void> {
    // Step 1: Director Thinking & Task Routing
    this.setStatus("thinking", "Nightglide Task Director analyzing task and dispatching workers...");
    await waitStep(this.stepDelayMs);

    const exploreModel = this.sessionOptions.roleModelOverrides?.explore || "omlx/qwen2.5-coder-7b";
    const planModel = this.sessionOptions.roleModelOverrides?.plan || "openai/gpt-4o";

    const routingDecision: RoutingDecision = {
      taskCategory: "plan",
      agentRole: "plan",
      providerId: planModel.split("/")[0] || "openai",
      modelId: planModel,
      locality: planModel.includes("omlx") || planModel.includes("local") ? "local" : "remote",
      mode: this.sessionOptions.routingMode || "BALANCED",
      reason: "Multi-agent collaboration: Local explorer inspects repository; Cloud planner drafts architecture.",
      requiresCloud: true,
      requiresApproval: false,
      fallbackChain: [exploreModel],
      estimatedCost: "Unknown",
    };
    this.emit({ type: "routing_decision", decision: routingDecision });
    await waitStep(this.stepDelayMs);

    // Step 2: Local Explorer Subagent
    const explorerId = `subagent_explore_${Date.now()}`;
    const explorerItem: SubagentMonitorItem = {
      id: explorerId,
      role: "explore",
      model: exploreModel,
      providerId: exploreModel.split("/")[0] || "omlx",
      locality: "local",
      task: "Inspect codebase architecture and extract key component symbols",
      status: "thinking",
      startedAt: Date.now(),
    };
    this.subagents.set(explorerId, explorerItem);

    this.emit({
      type: "subagent_start",
      subagentId: explorerId,
      role: "explore",
      model: exploreModel,
      providerId: explorerItem.providerId,
      locality: "local",
      task: explorerItem.task,
    });
    await waitStep(this.stepDelayMs);

    this.emit({
      type: "subagent_delta",
      subagentId: explorerId,
      delta: "[Local Explorer]: Scanned 12 source files in packages/core and packages/engine. Found key modules: AgentSession, ProviderRegistry, WorkloadRouter.",
    });
    await waitStep(this.stepDelayMs);

    this.subagents.set(explorerId, {
      ...explorerItem,
      status: "completed",
      result: "Context summary generated (12 files inspected).",
      totalTokens: 256,
      endedAt: Date.now(),
    });

    this.emit({
      type: "subagent_end",
      subagentId: explorerId,
      result: "Context summary generated (12 files inspected).",
      totalTokens: 256,
    });
    await waitStep(this.stepDelayMs);

    // Step 3: Cloud Planner Subagent
    const plannerId = `subagent_plan_${Date.now()}`;
    const plannerItem: SubagentMonitorItem = {
      id: plannerId,
      role: "plan",
      model: planModel,
      providerId: planModel.split("/")[0] || "openai",
      locality: "remote",
      task: "Synthesize explorer context and produce safe refactoring plan",
      status: "thinking",
      startedAt: Date.now(),
    };
    this.subagents.set(plannerId, plannerItem);

    this.emit({
      type: "subagent_start",
      subagentId: plannerId,
      role: "plan",
      model: planModel,
      providerId: plannerItem.providerId,
      locality: "remote",
      task: plannerItem.task,
    });
    await waitStep(this.stepDelayMs);

    this.emit({
      type: "subagent_delta",
      subagentId: plannerId,
      delta: "[Cloud Planner]: Drafting architectural plan:\n1. Phase 1: Multi-provider abstraction.\n2. Phase 2: Privacy boundary enforcement.\n3. Phase 3: Verification with test doubles.",
    });
    await waitStep(this.stepDelayMs);

    this.subagents.set(plannerId, {
      ...plannerItem,
      status: "completed",
      result: "Architectural plan approved and verified.",
      totalTokens: 512,
      endedAt: Date.now(),
    });

    this.emit({
      type: "subagent_end",
      subagentId: plannerId,
      result: "Architectural plan approved and verified.",
      totalTokens: 512,
    });
    await waitStep(this.stepDelayMs);

    // Step 4: Main Agent Synthesizes Result
    this.setStatus("streaming");
    const summaryHeader = `### Collaborative Multi-Agent Execution Complete\n\n`;
    this.emit({ type: "text_delta", delta: summaryHeader });
    await waitStep(this.stepDelayMs);

    const summaryBody =
      `• **Local Explorer** (${exploreModel}): Inspected repository context locally with zero cloud data transmission.\n` +
      `• **Cloud Planner** (${planModel}): Synthesized minimal context into a verified implementation roadmap.\n\n` +
      `All tasks successfully coordinated and aggregated.`;
    this.emit({ type: "text_delta", delta: summaryBody });
    await waitStep(this.stepDelayMs);

    this.setStatus("completed");
    this.emit({
      type: "done",
      summary: "Multi-agent collaboration workflow finished successfully.",
      totalTokens: 768,
    });
    this.setStatus("idle");
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
      activeSubagents: Array.from(this.subagents.values()),
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
        supportedTools: ["read", "task"],
      },
    };
  }
}
