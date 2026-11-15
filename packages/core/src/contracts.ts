import type { AgentEvent, AgentEventHandler, AgentStatus } from "./events.js";

/**
 * Physical network locality classification of a provider or model.
 */
export type ProviderLocality = "local" | "remote";

/**
 * Functional capabilities advertised by a model.
 */
export type ModelCapability =
  | "coding"
  | "reasoning"
  | "planning"
  | "vision"
  | "tool_call"
  | "fast";

/**
 * Provider-qualified model descriptor.
 */
export interface ModelDescriptor {
  readonly id: string; // e.g. "omlx/qwen2.5-coder-7b" or "openai/gpt-4o"
  readonly name: string;
  readonly providerId: string;
  readonly locality: ProviderLocality;
  readonly contextWindow?: number;
  readonly capabilities: readonly ModelCapability[];
  readonly isDefault?: boolean;
}

/**
 * High-level provider diagnostics and metadata.
 */
export interface ProviderInfo {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly locality: ProviderLocality;
  readonly requiresAuth: boolean;
  readonly hasAuth: boolean;
  readonly isConnected: boolean;
  readonly models: readonly ModelDescriptor[];
  readonly error?: string;
}

/**
 * Typed task classification categories for intelligent routing.
 */
export type TaskCategory =
  | "explore"
  | "explain"
  | "plan"
  | "implement"
  | "debug"
  | "review"
  | "test"
  | "summarize";

/**
 * Distinct agent roles participating in collaborative workflows.
 */
export type AgentRole =
  | "main"
  | "explore"
  | "plan"
  | "implement"
  | "review"
  | "scout";

/**
 * Operational routing modes determining model placement policies.
 */
export type RoutingMode = "LOCAL" | "BALANCED" | "PERFORMANCE" | "MANUAL";

/**
 * Comprehensive result of a workload-aware routing decision.
 */
export interface RoutingDecision {
  readonly taskCategory: TaskCategory;
  readonly agentRole: AgentRole;
  readonly providerId: string;
  readonly modelId: string;
  readonly locality: ProviderLocality;
  readonly mode: RoutingMode;
  readonly reason: string;
  readonly requiresCloud: boolean;
  readonly requiresApproval: boolean;
  readonly fallbackChain: readonly string[];
  readonly estimatedCost?: string;
}

/**
 * Subagent monitor item representing an active or completed delegated worker.
 */
export interface SubagentMonitorItem {
  readonly id: string;
  readonly role: AgentRole;
  readonly model: string;
  readonly providerId: string;
  readonly locality: ProviderLocality;
  readonly task: string;
  readonly status: AgentStatus;
  readonly result?: unknown;
  readonly error?: string;
  readonly totalTokens?: number;
  readonly startedAt: number;
  readonly endedAt?: number;
}

/**
 * Session runtime state view.
 */
export interface SessionState {
  readonly id: string;
  readonly status: AgentStatus;
  readonly model: string;
  readonly workspacePath: string;
  readonly messageHistoryCount: number;
  readonly isDisposed: boolean;
  readonly activeSubagents?: readonly SubagentMonitorItem[];
}

/**
 * Common options for creating an agent session.
 */
export interface CreateSessionOptions {
  workspacePath: string;
  model?: string;
  systemPrompt?: string;
  readOnly?: boolean;
  agentDir?: string;
  routingMode?: RoutingMode;
  allowCloud?: boolean;
  roleModelOverrides?: Partial<Record<AgentRole, string>>;
}

/**
 * Engine health and readiness probe result.
 */
export interface EngineHealthResult {
  readonly ready: boolean;
  readonly engineId: string;
  readonly isMock: boolean;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Active session handle controlling conversation lifecycle.
 */
export interface AgentSession {
  readonly id: string;
  readonly model: string;
  readonly workspacePath: string;

  sendMessage(prompt: string): Promise<void>;
  subscribe(handler: AgentEventHandler): () => void;
  cancel(): Promise<void>;
  dispose(): Promise<void>;
  getState(): SessionState;
}

/**
 * Primary engine abstraction decoupling UI from execution backend.
 */
export interface AgentEngine {
  readonly id: string;
  readonly isMock: boolean;

  createSession(options: CreateSessionOptions): Promise<AgentSession>;
  checkHealth(): Promise<EngineHealthResult>;
}
