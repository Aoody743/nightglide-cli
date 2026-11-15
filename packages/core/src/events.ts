/**
 * Standardized typed event definitions for Nightglide Agent Engines.
 * Used across Mock Engine, OMP Adapter, and UI Subscribers.
 */

import type { AgentRole, ProviderLocality, RoutingDecision } from "./contracts.js";

export type AgentStatus =
  | "idle"
  | "thinking"
  | "executing_tool"
  | "streaming"
  | "cancelling"
  | "error"
  | "completed";

/**
 * Structured diff representation for file changes.
 */
export interface FileDiffData {
  readonly filePath: string;
  readonly diff: string;
  readonly additions: number;
  readonly deletions: number;
}

export type ApprovalAnswer = "once" | "session" | "deny";

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
      readonly diff?: FileDiffData;
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
    }
  | {
      readonly type: "routing_decision";
      readonly decision: RoutingDecision;
    }
  | {
      readonly type: "subagent_start";
      readonly subagentId: string;
      readonly role: AgentRole;
      readonly model: string;
      readonly task: string;
      readonly providerId?: string;
      readonly locality: ProviderLocality;
    }
  | {
      readonly type: "subagent_delta";
      readonly subagentId: string;
      readonly delta: string;
    }
  | {
      readonly type: "subagent_end";
      readonly subagentId: string;
      readonly result?: unknown;
      readonly error?: string;
      readonly totalTokens?: number;
    }
  | {
      readonly type: "approval_request";
      readonly id: string;
      readonly toolName: string;
      readonly prompt: {
        readonly full: string;
        readonly compact: string;
        readonly session?: string;
      };
      readonly resolve: (answer: ApprovalAnswer) => void;
    }
  | {
      readonly type: "approval_resolved";
      readonly id: string;
      readonly answer: ApprovalAnswer;
    };

export type AgentEventHandler = (event: AgentEvent) => void;
