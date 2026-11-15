import {
  type AgentRole,
  type ModelDescriptor,
  type ProviderLocality,
  type RoutingDecision,
  type RoutingMode,
  type TaskCategory,
  ModelNotConfiguredError,
  ProviderUnavailableError,
  RoutingPolicyViolationError,
  CloudAuthorizationRequiredError,
} from "@nightglide/core";
import type { RoutingConfig } from "@nightglide/config";
import type { ProviderRegistry } from "@nightglide/providers";
import { classifyTask, type ClassificationResult } from "./classifier.js";

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
          requiredCapabilities: ["coding"],
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

    // Available models across providers
    const allModels = this.registry.listModels();
    const localModels = allModels.filter((m) => m.locality === "local");
    const cloudModels = allModels.filter((m) => m.locality === "remote");

    if (allModels.length === 0) {
      throw new ModelNotConfiguredError(
        "No models found in ProviderRegistry. Please configure at least one local or cloud provider."
      );
    }

    // 1. MANUAL MODE: Exact role assignments take absolute precedence
    if (mode === "MANUAL") {
      return this.routeManualMode(category, role, classification, localModels, cloudModels);
    }

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
    classification: ClassificationResult,
    localModels: ModelDescriptor[],
    cloudModels: ModelDescriptor[]
  ): RoutingDecision {
    const explicitModelId = this.routingConfig.roleAssignments[role];
    if (explicitModelId) {
      const model = this.registry.getModel(explicitModelId);
      if (!model) {
        throw new ModelNotConfiguredError(
          `MANUAL mode: model '${explicitModelId}' explicitly assigned to role '${role}' is not found in registry.`
        );
      }

      if (model.locality === "remote" && !this.routingConfig.allowCloud) {
        throw new CloudAuthorizationRequiredError(
          model.id,
          model.providerId,
          `MANUAL assignment of cloud model '${model.id}' requires 'routing.allowCloud: true'.`
        );
      }

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
        fallbackChain: [],
        estimatedCost: model.locality === "local" ? "Free (Local)" : "Unknown",
      };
    }

    // If not explicitly set for this role, use first local or cloud model
    const candidate = localModels[0] || cloudModels[0];
    return {
      taskCategory: category,
      agentRole: role,
      providerId: candidate.providerId,
      modelId: candidate.id,
      locality: candidate.locality,
      mode: "MANUAL",
      reason: `No explicit assignment for role '${role}'; falling back to default model.`,
      requiresCloud: candidate.locality === "remote",
      requiresApproval: candidate.locality === "remote" && !this.routingConfig.allowCloud,
      fallbackChain: [],
      estimatedCost: candidate.locality === "local" ? "Free (Local)" : "Unknown",
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
    // Determine whether this task benefits significantly from a cloud model
    const isHeavyTask =
      category === "plan" ||
      category === "review" ||
      classification.isComplex;

    if (isHeavyTask && cloudModels.length > 0 && allowCloud) {
      // Pick best cloud model
      const cloudCandidate =
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
        localModels.find((m) => classification.requiredCapabilities.some((cap) => m.capabilities.includes(cap))) ||
        localModels[0];

      const fallbackChain = allowCloud
        ? [...localModels.filter((m) => m.id !== selected.id).map((m) => m.id), ...cloudModels.map((m) => m.id)]
        : localModels.filter((m) => m.id !== selected.id).map((m) => m.id);

      return {
        taskCategory: category,
        agentRole: role,
        providerId: selected.providerId,
        modelId: selected.id,
        locality: "local",
        mode: "BALANCED",
        reason: `BALANCED mode: Routine task '${category}' kept on local model for speed and zero cost.`,
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

      return {
        taskCategory: category,
        agentRole: role,
        providerId: cloudModels[0].providerId,
        modelId: cloudModels[0].id,
        locality: "remote",
        mode: "BALANCED",
        reason: `BALANCED mode: No local models available; falling back to authorized cloud model.`,
        requiresCloud: true,
        requiresApproval: false,
        fallbackChain: [],
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
    // Performance mode prefers highest reasoning capability (cloud if authorized)
    if (cloudModels.length > 0) {
      const candidate = cloudModels[0];
      const requiresApproval = !allowCloud;

      if (requiresApproval) {
        // If cloud not authorized, check if user can fall back to local
        if (localModels.length > 0) {
          const localSelected = localModels[0];
          return {
            taskCategory: category,
            agentRole: role,
            providerId: localSelected.providerId,
            modelId: localSelected.id,
            locality: "local",
            mode: "PERFORMANCE",
            reason: `PERFORMANCE mode preferred cloud, but cloud is unauthorized; constrained to best local model.`,
            requiresCloud: false,
            requiresApproval: false,
            fallbackChain: [],
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
        reason: `PERFORMANCE mode: Dispatched to premier model '${candidate.id}'.`,
        requiresCloud: true,
        requiresApproval: false,
        fallbackChain: localModels.map((m) => m.id),
        estimatedCost: "Unknown",
      };
    }

    if (localModels.length > 0) {
      const selected = localModels[0];
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
        fallbackChain: localModels.slice(1).map((m) => m.id),
        estimatedCost: "Free (Local)",
      };
    }

    throw new ProviderUnavailableError("any", "No models available for PERFORMANCE mode.");
  }
}
