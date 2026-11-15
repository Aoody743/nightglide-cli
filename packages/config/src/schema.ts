/**
 * Nightglide Configuration Schema and Types.
 */

import type { AgentRole, ProviderLocality, RoutingMode } from "@nightglide/core";

export type InteractionMode = "guided" | "expert";

export type ProviderType = "openai-compatible" | "ollama" | "omlx" | "custom";

export interface ProviderEndpointConfig {
  type: ProviderType;
  baseUrl: string;
  displayName?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  locality?: ProviderLocality;
  enabled?: boolean;
  defaultModel?: string;
}

export interface RoutingConfig {
  mode: RoutingMode;
  allowCloud: boolean;
  roleAssignments: Partial<Record<AgentRole, string>>;
  maxConcurrency?: number;
}

export interface SecurityPermissionConfig {
  readOnly: boolean;
  requireToolConfirmation: boolean;
  allowShellExecution: boolean;
}

export interface NightglideConfig {
  version: number;
  theme: string;
  interactionMode: InteractionMode;
  provider: string;
  model: string;
  providers: Record<string, ProviderEndpointConfig>;
  routing: RoutingConfig;
  permissions: SecurityPermissionConfig;
}
