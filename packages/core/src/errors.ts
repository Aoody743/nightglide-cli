/**
 * Standardized typed error hierarchy for Nightglide.
 */

export class NightglideError extends Error {
  readonly code: string;
  readonly recoverable: boolean;

  constructor(message: string, code = "NIGHTGLIDE_ERROR", recoverable = false) {
    super(message);
    this.name = "NightglideError";
    this.code = code;
    this.recoverable = recoverable;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EngineError extends NightglideError {
  constructor(message: string, code = "ENGINE_ERROR", recoverable = false) {
    super(message, code, recoverable);
    this.name = "EngineError";
  }
}

export class ModelNotConfiguredError extends EngineError {
  constructor(message = "No model configured. Please run setup or configure provider settings.") {
    super(message, "MODEL_NOT_CONFIGURED", true);
    this.name = "ModelNotConfiguredError";
  }
}

export class SessionDisposedError extends EngineError {
  constructor(message = "Agent session has already been disposed.") {
    super(message, "SESSION_DISPOSED", false);
    this.name = "SessionDisposedError";
  }
}

export class ConfigurationError extends NightglideError {
  constructor(message: string, code = "CONFIGURATION_ERROR") {
    super(message, code, false);
    this.name = "ConfigurationError";
  }
}

export class SecurityPermissionError extends NightglideError {
  readonly operation: string;

  constructor(operation: string, message = `Permission denied for operation: ${operation}`) {
    super(message, "SECURITY_PERMISSION_DENIED", false);
    this.name = "SecurityPermissionError";
    this.operation = operation;
  }
}

export class ProviderUnavailableError extends EngineError {
  readonly providerId: string;

  constructor(providerId: string, message = `Provider '${providerId}' is unreachable or unavailable.`) {
    super(message, "PROVIDER_UNAVAILABLE", true);
    this.name = "ProviderUnavailableError";
    this.providerId = providerId;
  }
}

export class RoutingPolicyViolationError extends SecurityPermissionError {
  readonly policy: string;

  constructor(policy: string, message = `Task routing violated privacy or security policy: ${policy}`) {
    super("ROUTING_POLICY", message);
    this.name = "RoutingPolicyViolationError";
    this.policy = policy;
  }
}

export class CloudAuthorizationRequiredError extends SecurityPermissionError {
  readonly modelId: string;
  readonly providerId: string;

  constructor(
    modelId: string,
    providerId: string,
    message = `Cloud model '${modelId}' on provider '${providerId}' requires explicit user authorization.`
  ) {
    super("CLOUD_AUTHORIZATION", message);
    this.name = "CloudAuthorizationRequiredError";
    this.modelId = modelId;
    this.providerId = providerId;
  }
}
