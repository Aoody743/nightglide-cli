/**
 * Nightglide Configuration Schema and Types.
 */

export type InteractionMode = "guided" | "expert";

export type ProviderType = "openai-compatible" | "ollama" | "omlx" | "custom";

export interface ProviderEndpointConfig {
  type: ProviderType;
  baseUrl: string;
  defaultModel?: string;
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
  permissions: SecurityPermissionConfig;
}
