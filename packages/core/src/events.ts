/**
 * Standardized typed event definitions for Nightglide Agent Engines.
 * Used across Mock Engine, OMP Adapter, and UI Subscribers.
 */

export type AgentStatus =
  | "idle"
  | "thinking"
  | "executing_tool"
  | "streaming"
  | "cancelling"
  | "error"
  | "completed";

export type AgentEvent =
  | { readonly type: "text_delta"; readonly delta: string }
  | {
      readonly type: "tool_start";
      readonly toolName: string;
      readonly toolCallId: string;
      readonly input: Record<string, unknown>;
    }
  | {
      readonly type: "tool_end";
      readonly toolName: string;
      readonly toolCallId: string;
      readonly result?: unknown;
      readonly error?: string;
    }
  | {
      readonly type: "status";
      readonly status: AgentStatus;
      readonly message?: string;
    }
  | {
      readonly type: "error";
      readonly error: string;
      readonly code?: string;
      readonly recoverable?: boolean;
    }
  | {
      readonly type: "done";
      readonly summary?: string;
      readonly totalTokens?: number;
    };

export type AgentEventHandler = (event: AgentEvent) => void;
