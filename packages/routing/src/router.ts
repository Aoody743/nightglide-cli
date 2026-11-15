import {
  type AgentRole,
  type ModelDescriptor,
  type ProviderLocality,
  type RoutingDecision,
  type RoutingMode,
  type TaskCategory,
  ModelNotConfiguredError,
  ProviderUnavailableError,
  CloudAuthorizationRequiredError,
  ManualRoleNotAssignedError,
  ModelCapabilityMismatchError,
} from "@nightglide/core";
import type { RoutingConfig } from "@nightglide/config";
import type { ProviderRegistry } from "@nightglide/providers";
import {
  classifyTask,
  getRequiredCapabilitiesForCategory,
  type ClassificationResult,
} from "./classifier.js";

export interface RouteTaskOptions {
  prompt: string;
  explicitRole?: AgentRole;
  explicitCategory?: TaskCategory;
  filesCount?: number;
  isMultiStep?: boolean;
}

/**
 * Workload-aware intelligent Model Router.
 * Assigns tasks to optimal local or cloud models based on task category,
 * complexity, operational mode, and strict privacy boundaries.
 */
export class WorkloadModelRouter {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly routingConfig: RoutingConfig
  ) {}

  /**
   * Determine the target agent role for a task category.
   * If an explicitRole is specified, it strictly overrides the category mapping.
   */
  resolveRoleForCategory(category: TaskCategory, explicitRole?: AgentRole): AgentRole {
    if (explicitRole) return explicitRole;
    switch (category) {
      case "explore":
        return "explore";
      case "plan":
        return "plan";
      case "review":
        return "review";
      case "implement":
        return "implement";
      case "explain":
      case "debug":
      case "test":
      case "summarize":
      default:
        return "main";
    }
  }

  /**
   * Main routing entry point. Produces a structured RoutingDecision.
   */
  routeTask(options: RouteTaskOptions): RoutingDecision {
    const classification: ClassificationResult = options.explicitCategory
      ? {
          category: options.explicitCategory,
          confidence: 1.0,
          requiredCapabilities: getRequiredCapabilitiesForCategory(options.explicitCategory),
          isComplex: false,
          explanation: `Explicitly categorized as '${options.explicitCategory}'.`,
        }
      : classifyTask(options.prompt, {
          filesCount: options.filesCount,
          isMultiStep: options.isMultiStep,
        });

    const category = classification.category;
    const role = this.resolveRoleForCategory(category, options.explicitRole);
    const mode = this.routingConfig.mode;
    const allowCloud = this.routingConfig.allowCloud;

    // 1. MANUAL MODE: Exact role assignments take absolute precedence
    // Evaluated immediately so unassigned roles fail fast with ManualRoleNotAssignedError
    if (mode === "MANUAL") {
      return this.routeManualMode(category, role, classification);
    }

    // Available models across providers
    const allModels = this.registry.listModels();
    if (allModels.length === 0) {
      throw new ModelNotConfiguredError(
        "No models found in ProviderRegistry. Please configure at least one local or cloud provider."
      );
    }

    const localModels = allModels.filter((m) => {
      if (m.locality !== "local") return false;
      const provider = this.registry.get(m.providerId);
      return provider && provider.enabled !== false && (!provider.lastCheck || provider.lastCheck.connected !== false);
    });

    const cloudModels = allModels.filter((m) => {
      if (m.locality !== "remote") return false;
      const provider = this.registry.get(m.providerId);
      return provider && provider.enabled !== false && (!provider.lastCheck || provider.lastCheck.connected !== false);
    });

    // 2. LOCAL MODE: Only local models permitted; cloud is strictly forbidden
    if (mode === "LOCAL") {
      return this.routeLocalMode(category, role, classification, localModels);
    }

    // 3. BALANCED MODE: Efficient local for simple/explore; strong cloud for complex/plan/review
    if (mode === "BALANCED") {
      return this.routeBalancedMode(category, role, classification, localModels, cloudModels, allowCloud);
    }

    // 4. PERFORMANCE MODE: Best capability first
    return this.routePerformanceMode(category, role, classification, localModels, cloudModels, allowCloud);
  }

  private routeManualMode(
    category: TaskCategory,
    role: AgentRole,
    classification: ClassificationResult
  ): RoutingDecision {
    const explicitModelId = this.routingConfig.roleAssignments?.[role];

    // Check if explicit assignment exists for this role
    if (!explicitModelId || !explicitModelId.trim()) {
      throw new ManualRoleNotAssignedError(
        role,
        `MANUAL mode requires an explicit model assignment for role '${role}'. Please configure 'routing.roleAssignments.${role}'.`
      );
    }

    const trimmedModelId = explicitModelId.trim();

    // Look up assigned model in the registry
    const model = this.registry.getModel(trimmedModelId);
    if (!model) {
      throw new ModelNotConfiguredError(
        `MANUAL mode: Model '${trimmedModelId}' assigned to role '${role}' is not found in registry.`
      );
    }

    // Verify provider existence and availability
    const provider = this.registry.get(model.providerId);
    if (!provider) {
      throw new ProviderUnavailableError(
        model.providerId,
        `Provider '${model.providerId}' for model '${model.id}' is not registered.`
      );
    }

    if (provider.enabled === false) {
      throw new ProviderUnavailableError(
        model.providerId,
        `Provider '${model.providerId}' for model '${model.id}' is disabled.`
      );
    }

    if (provider.lastCheck && provider.lastCheck.connected === false) {
      throw new ProviderUnavailableError(
        model.providerId,
        `Provider '${model.providerId}' for model '${model.id}' is unreachable or disconnected: ${provider.lastCheck.message}`
      );
    }

    // Verify cloud authorization
    if (model.locality === "remote" && !this.routingConfig.allowCloud) {
      throw new CloudAuthorizationRequiredError(
        model.id,
        model.providerId,
        `MANUAL assignment of cloud model '${model.id}' for role '${role}' requires 'routing.allowCloud: true'.`
      );
    }

    // Verify required capabilities
    if (classification.requiredCapabilities && classification.requiredCapabilities.length > 0) {
      const missingCapabilities = classification.requiredCapabilities.filter(
        (cap) => !model.capabilities.includes(cap)
      );
      if (missingCapabilities.length > 0) {
        throw new ModelCapabilityMismatchError(
          model.id,
          missingCapabilities,
          `Model '${model.id}' assigned to role '${role}' does not satisfy required capabilities: ${missingCapabilities.join(", ")}`
        );
      }
    }

    // Fallbacks in MANUAL mode may only be used if explicitly configured by the user
    const explicitFallbacks = this.routingConfig.fallbackAssignments?.[role] ?? [];
    const validFallbacks = explicitFallbacks.filter((fbId) => {
      const fbModel = this.registry.getModel(fbId);
      if (!fbModel) return false;
      if (fbModel.locality === "remote" && !this.routingConfig.allowCloud) return false;
      return true;
    });

    return {
      taskCategory: category,
      agentRole: role,
      providerId: model.providerId,
      modelId: model.id,
      locality: model.locality,
      mode: "MANUAL",
      reason: `Explicit user assignment for role '${role}'.`,
      requiresCloud: model.locality === "remote",
      requiresApproval: false,
      fallbackChain: validFallbacks,
      estimatedCost: model.locality === "local" ? "Free (Local)" : "Unknown",
    };
  }

  private routeLocalMode(
    category: TaskCategory,
    role: AgentRole,
    classification: ClassificationResult,
    localModels: ModelDescriptor[]
  ): RoutingDecision {
    if (localModels.length === 0) {
      throw new ProviderUnavailableError(
        "local",
        "LOCAL mode is active, but no local providers or models are available. Cloud fallback is strictly prohibited in LOCAL mode."
      );
    }

    // Choose best local model based on required capability
    const matched = localModels.find((m) =>
      classification.requiredCapabilities.some((cap) => m.capabilities.includes(cap))
    );
    const selected = matched || localModels[0];

    // Fallback chain contains other local models ONLY
    const fallbackChain = localModels
      .filter((m) => m.id !== selected.id)
      .map((m) => m.id);

    return {
      taskCategory: category,
      agentRole: role,
      providerId: selected.providerId,
      modelId: selected.id,
      locality: "local",
      mode: "LOCAL",
      reason: `LOCAL mode: Task '${category}' assigned to local model for strict on-device privacy.`,
      requiresCloud: false,
      requiresApproval: false,
      fallbackChain,
      estimatedCost: "Free (Local)",
    };
  }

  private routeBalancedMode(
    category: TaskCategory,
    role: AgentRole,
    classification: ClassificationResult,
    localModels: ModelDescriptor[],
    cloudModels: ModelDescriptor[],
    allowCloud: boolean
  ): RoutingDecision {
    // Determine whether this task is a complex planning/review task that benefits from cloud
    const isHeavyTask =
      category === "plan" ||
      category === "review" ||
      classification.isComplex;

    if (isHeavyTask && cloudModels.length > 0 && allowCloud) {
      // Pick best cloud model matching capabilities
      const cloudCandidate =
        cloudModels.find((m) =>
          classification.requiredCapabilities.some((cap) => m.capabilities.includes(cap))
        ) ||
        cloudModels.find((m) => m.capabilities.includes("reasoning") || m.capabilities.includes("planning")) ||
        cloudModels[0];

      const fallbackChain = localModels.map((m) => m.id);

      return {
        taskCategory: category,
        agentRole: role,
        providerId: cloudCandidate.providerId,
        modelId: cloudCandidate.id,
        locality: "remote",
        mode: "BALANCED",
        reason: `BALANCED mode: Complex task '${category}' routed to cloud model for superior reasoning capacity (User cloud authorized).`,
        requiresCloud: true,
        requiresApproval: false,
        fallbackChain,
        estimatedCost: "Unknown",
      };
    }

    // Otherwise prefer local model
    if (localModels.length > 0) {
      const selected =
        localModels.find((m) =>
          classification.requiredCapabilities.some((cap) => m.capabilities.includes(cap))
        ) || localModels[0];

      const fallbackChain = allowCloud
        ? [
            ...localModels.filter((m) => m.id !== selected.id).map((m) => m.id),
            ...cloudModels.map((m) => m.id),
          ]
        : localModels.filter((m) => m.id !== selected.id).map((m) => m.id);

      const reason = isHeavyTask
        ? `BALANCED mode: Complex task '${category}' kept on local model because cloud access is not authorized ('allowCloud: false').`
        : `BALANCED mode: Routine task '${category}' kept on local model for speed and zero cost.`;

      return {
        taskCategory: category,
        agentRole: role,
        providerId: selected.providerId,
        modelId: selected.id,
        locality: "local",
        mode: "BALANCED",
        reason,
        requiresCloud: false,
        requiresApproval: false,
        fallbackChain,
        estimatedCost: "Free (Local)",
      };
    }

    // If no local models, check if cloud is allowed
    if (cloudModels.length > 0) {
      if (!allowCloud) {
        throw new CloudAuthorizationRequiredError(
          cloudModels[0].id,
          cloudModels[0].providerId,
          `No local models available, and cloud access is not authorized for task '${category}'.`
        );
      }

      const cloudCandidate =
        cloudModels.find((m) =>
          classification.requiredCapabilities.some((cap) => m.capabilities.includes(cap))
        ) || cloudModels[0];

      return {
        taskCategory: category,
        agentRole: role,
        providerId: cloudCandidate.providerId,
        modelId: cloudCandidate.id,
        locality: "remote",
        mode: "BALANCED",
        reason: `BALANCED mode: No local models available; falling back to authorized cloud model '${cloudCandidate.id}'.`,
        requiresCloud: true,
        requiresApproval: false,
        fallbackChain: cloudModels.filter((m) => m.id !== cloudCandidate.id).map((m) => m.id),
        estimatedCost: "Unknown",
      };
    }

    throw new ProviderUnavailableError("any", "No local or cloud models available for routing.");
  }

  private routePerformanceMode(
    category: TaskCategory,
    role: AgentRole,
    classification: ClassificationResult,
    localModels: ModelDescriptor[],
    cloudModels: ModelDescriptor[],
    allowCloud: boolean
  ): RoutingDecision {
    // Performance mode prefers highest capability model (cloud if authorized)
    if (cloudModels.length > 0) {
      const candidate =
        cloudModels.find((m) =>
          classification.requiredCapabilities.some((cap) => m.capabilities.includes(cap))
        ) || cloudModels[0];

      if (!allowCloud) {
        // If cloud not authorized, constrained to top local model
        if (localModels.length > 0) {
          const localSelected =
            localModels.find((m) =>
              classification.requiredCapabilities.some((cap) => m.capabilities.includes(cap))
            ) || localModels[0];

          return {
            taskCategory: category,
            agentRole: role,
            providerId: localSelected.providerId,
            modelId: localSelected.id,
            locality: "local",
            mode: "PERFORMANCE",
            reason: `PERFORMANCE mode preferred cloud, but cloud is unauthorized; constrained to best local model '${localSelected.id}'.`,
            requiresCloud: false,
            requiresApproval: false,
            fallbackChain: localModels.filter((m) => m.id !== localSelected.id).map((m) => m.id),
            estimatedCost: "Free (Local)",
          };
        }

        throw new CloudAuthorizationRequiredError(
          candidate.id,
          candidate.providerId,
          "PERFORMANCE mode selected cloud model, but cloud access is not authorized."
        );
      }

      return {
        taskCategory: category,
        agentRole: role,
        providerId: candidate.providerId,
        modelId: candidate.id,
        locality: "remote",
        mode: "PERFORMANCE",
        reason: `PERFORMANCE mode: Dispatched to premier model '${candidate.id}' for highest capability.`,
        requiresCloud: true,
        requiresApproval: false,
        fallbackChain: [
          ...cloudModels.filter((m) => m.id !== candidate.id).map((m) => m.id),
          ...localModels.map((m) => m.id),
        ],
        estimatedCost: "Unknown",
      };
    }

    if (localModels.length > 0) {
      const selected =
        localModels.find((m) =>
          classification.requiredCapabilities.some((cap) => m.capabilities.includes(cap))
        ) || localModels[0];

      return {
        taskCategory: category,
        agentRole: role,
        providerId: selected.providerId,
        modelId: selected.id,
        locality: "local",
        mode: "PERFORMANCE",
        reason: `PERFORMANCE mode: Using top local model '${selected.id}'.`,
        requiresCloud: false,
        requiresApproval: false,
        fallbackChain: localModels.filter((m) => m.id !== selected.id).map((m) => m.id),
        estimatedCost: "Free (Local)",
      };
    }

    throw new ProviderUnavailableError("any", "No models available for PERFORMANCE mode.");
  }
}
