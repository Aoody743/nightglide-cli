import type { AgentEvent, AgentEventHandler, AgentStatus } from "./events.js";

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
