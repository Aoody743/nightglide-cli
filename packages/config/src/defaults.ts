import type { NightglideConfig } from "./schema.js";

export const DEFAULT_CONFIG: NightglideConfig = {
  version: 1,
  theme: "midnight-flight",
  interactionMode: "guided",
  provider: "local",
  model: "",
  providers: {
    local: {
      type: "openai-compatible",
      baseUrl: "http://127.0.0.1:8000/v1",
      defaultModel: "",
    },
  },
  permissions: {
    readOnly: true,
    requireToolConfirmation: true,
    allowShellExecution: false,
  },
};
