# Nightglide M1 智能工作负载与模型路由技术规范 (M1 Agent Routing Spec)

**版本：** 1.1.0 (M1.1 Audit Remediation)  
**模块命名空间：** `@nightglide/routing`, `@nightglide/config`, `@nightglide/providers`  
**语言规范：** 简体中文 (核心类型标识与代码接口遵循英文技术标识)  

---

## 1. 架构目标与设计原则

Nightglide 的核心价值主张在于**基于策略的工作负载感知模型路由 (Policy-Based Workload Routing)** 与 **本地/云端协同 (Local + Cloud Agent Collaboration)**。

不同于传统单一模型助手盲目将所有任务提交给同一个模型，也区别于不可预测的人工智能黑盒自适应机器学习，Nightglide 路由器采用**确定性、可解释、高透明的策略规则引擎**，根据任务类别、上下文特征、复杂度启发式规则以及严格的用户隐私与授权边界，将任务精准派发给匹配的模型。

### 核心安全与隐私公理 (Privacy & Security Axioms)
1. **网络物理位置绝对优先 (Physical Locality Invariance)：** 模型的 Local / Remote 属性严格依据解析后的网络端点地址（回环地址 `127.0.0.1`, `localhost`, `[::1]`, `127.0.0.0/8` 为 `local`，其余所有外网域名及内网 IP 均强制为 `remote`），绝不轻信 Provider 的 Display Name。
2. **LOCAL 模式绝对禁止云端外发 (Zero Cloud Leakage in LOCAL)：** 当运行于 `LOCAL` 模式时，路由器禁止任何云端模型参与，且 Fallback 链中仅能包含经认证的可用本地模型。若本地模型不可用，系统立即抛出显式 `ProviderUnavailableError`，严禁静默回退到云端。
3. **BALANCED 模式授权闸门 (Authorization Gate in BALANCED)：** 仅当用户显式开启 `routing.allowCloud: true` 时，规划或高复杂度任务方可路由至云端强模型；未经授权时，系统降级至本地最强模型并明确在决策原因中注明隐私限制。
4. **MANUAL 模式严禁静默代换 (Deterministic MANUAL Zero-Substitution)：** 当运行于 `MANUAL` 模式时，路由器严格执行用户在 `routing.roleAssignments` 中对各角色的显式绑定。若目标角色未显式绑定模型，立即抛出 `ManualRoleNotAssignedError`，严禁任何形式的静默替补或隐式回退。
5. **成本与用量透明 (Cost Transparency)：** 在缺乏精确计费数据时标记为 `"Unknown"`，本地模型标注为 `"Free (Local)"`，绝不捏造虚假价格或评分。

---

## 2. 任务分类体系 (Task Classification Hierarchy)

### 2.1 任务类别 (`TaskCategory`)
系统定义了 8 种强类型任务类别：

```typescript
export type TaskCategory =
  | "explore"    // 代码库侦察、文件结构检索、符号定位
  | "explain"    // 逻辑释义、函数解读、架构解析
  | "plan"       // 重构方案、架构设计、技术路线图设计
  | "implement"  // 代码编写、Bug 修复、功能增加
  | "debug"      // 异常堆栈分析、失败原因排查
  | "review"     // 代码质量审查、安全隐患审计、Diff 走查
  | "test"       // 单元测试与集成测试编写、Mock 验证
  | "summarize"; // 跨 Agent 执行成果汇总、简报输出
```

### 2.2 智能体角色映射矩阵 (`AgentRole Mapping`)
每个任务类别在缺省状态下自动映射到最适宜的 Agent 角色。如果用户在调用路由时提供了 `explicitRole` 参数，则该角色**绝对覆盖**分类器推断的角色：

| TaskCategory | 默认目标 AgentRole | 典型能力需求 (`ModelCapability`) | 推荐承接模型类型 |
|---|---|---|---|
| `explore` | `explore` / `scout` | `["fast", "tool_call"]` | 本地轻量模型 (如 Qwen 2.5 Coder 7B / Ollama) |
| `explain` | `main` | `["reasoning"]` | 本地通用模型 |
| `plan` | `plan` | `["planning", "reasoning"]` | 强推理云端模型 (如 Claude 3.7 / GPT-4o) 或本地大模型 |
| `implement` | `implement` | `["coding", "reasoning"]` | 本地代码模型或云端编码模型 |
| `debug` | `main` | `["reasoning", "coding"]` | 本地/云端混合推理模型 |
| `review` | `review` | `["reasoning", "coding"]` | 独立审查模型 (避免自我评审偏见) |
| `test` | `main` | `["coding", "tool_call"]` | 具备结构化输出的代码模型 |
| `summarize` | `main` | `["fast"]` | 低时延、经济型模型 |

### 2.3 中英双语与混合提示词模式匹配
分类器支持纯英文、纯中文及中英双语混合提示词（如 *"帮我 review 一下 PR 代码"*、*"设计 high-level 架构 plan"*、*"debug 排查 crash 异常"*），各匹配模式具有加权命中机制，结合代码行数与多步骤标记综合推导复杂性 (`isComplex`)。

---

## 3. 运行模式与决策矩阵 (Routing Modes)

### 3.1 模式定义 (`RoutingMode`)
- `LOCAL`: 纯本地模式。仅使用本机端点 (oMLX, Ollama, LM Studio)。绝对无外部网络请求。
- `BALANCED`: 平衡模式 (推荐默认)。常规/日常任务使用本地模型 (极速且零费用)；高复杂度任务在获得用户显式授权 (`allowCloud: true`) 时无缝协同云端强模型。
- `PERFORMANCE`: 性能优先模式。以模型推理与编码能力为第一优先级，云端模型优先，但依然严格遵循 `allowCloud: true` 权限拦截，未授权时降级至本地最强模型。
- `MANUAL`: 手动指定模式。严格执行 `routing.roleAssignments` 中用户显式指定的每个角色的模型 ID。无静默替补，无隐式回退。

### 3.2 路由决策算法规范与伪代码

```typescript
function routeTask(prompt, options): RoutingDecision {
  const { category, isComplex, requiredCapabilities } = classifyTask(prompt, options);
  const role = resolveRoleForCategory(category, options.explicitRole);

  // 1. MANUAL 模式：严格确定性检验
  if (mode === "MANUAL") {
    const explicitModelId = config.roleAssignments[role];
    if (!explicitModelId || !explicitModelId.trim()) {
      throw new ManualRoleNotAssignedError(role);
    }
    const model = registry.getModel(explicitModelId);
    if (!model) {
      throw new ModelNotConfiguredError(`Model '${explicitModelId}' not found in registry`);
    }
    const provider = registry.get(model.providerId);
    if (!provider || provider.enabled === false || (provider.lastCheck && !provider.lastCheck.connected)) {
      throw new ProviderUnavailableError(model.providerId);
    }
    if (model.locality === "remote" && !config.allowCloud) {
      throw new CloudAuthorizationRequiredError(model.id, model.providerId);
    }
    const missingCaps = requiredCapabilities.filter(c => !model.capabilities.includes(c));
    if (missingCaps.length > 0) {
      throw new ModelCapabilityMismatchError(model.id, missingCaps);
    }
    const fallbacks = config.fallbackAssignments?.[role] ?? [];
    return createDecision(model, "MANUAL", { fallbackChain: fallbacks });
  }

  // 2. LOCAL 模式：纯本地隔离
  if (mode === "LOCAL") {
    const availableLocalModels = filterActiveModels(localModels);
    if (availableLocalModels.length === 0) {
      throw new ProviderUnavailableError("local", "LOCAL mode requires active local model");
    }
    const matched = findBestModel(availableLocalModels, requiredCapabilities) || availableLocalModels[0];
    const fallbackChain = availableLocalModels.filter(m => m.id !== matched.id).map(m => m.id);
    return createDecision(matched, "LOCAL", { fallbackChain });
  }

  // 3. BALANCED 模式：动静分流与云端授权
  if (mode === "BALANCED") {
    const isHeavy = category === "plan" || category === "review" || isComplex;
    if (isHeavy && cloudModels.length > 0 && config.allowCloud) {
      return createDecision(bestCloudModel, "BALANCED", { fallbackChain: localModels.map(m => m.id) });
    }
    if (localModels.length > 0) {
      const matched = findBestModel(localModels, requiredCapabilities) || localModels[0];
      const fallbackChain = config.allowCloud
        ? [...localModels.filter(m => m.id !== matched.id).map(m => m.id), ...cloudModels.map(m => m.id)]
        : localModels.filter(m => m.id !== matched.id).map(m => m.id);
      return createDecision(matched, "BALANCED", { fallbackChain });
    }
    if (cloudModels.length > 0) {
      if (!config.allowCloud) throw new CloudAuthorizationRequiredError(cloudModels[0].id, cloudModels[0].providerId);
      return createDecision(cloudModels[0], "BALANCED");
    }
    throw new ProviderUnavailableError("any", "No models available");
  }

  // 4. PERFORMANCE 模式：最高能力优先
  if (mode === "PERFORMANCE") {
    if (cloudModels.length > 0) {
      if (!config.allowCloud) {
        if (localModels.length > 0) {
          const topLocal = findBestModel(localModels, requiredCapabilities) || localModels[0];
          return createDecision(topLocal, "PERFORMANCE", { fallbackChain: localModels.filter(m => m.id !== topLocal.id).map(m => m.id) });
        }
        throw new CloudAuthorizationRequiredError(cloudModels[0].id, cloudModels[0].providerId);
      }
      return createDecision(bestCloudModel, "PERFORMANCE", { fallbackChain: otherModels });
    }
    if (localModels.length > 0) {
      return createDecision(localModels[0], "PERFORMANCE", { fallbackChain: localModels.slice(1).map(m => m.id) });
    }
    throw new ProviderUnavailableError("any", "No models available for PERFORMANCE mode");
  }
}
```

---

## 4. 路由输出契约 (`RoutingDecision` Contract)

每次路由计算均产出如下强类型不可变对象：

```typescript
export interface RoutingDecision {
  /** 任务类型分类 */
  readonly taskCategory: TaskCategory;
  /** 目标执行角色 (用户 explicitRole 拥有绝对覆盖权) */
  readonly agentRole: AgentRole;
  /** 承接提供商 ID */
  readonly providerId: string;
  /** 提供商限定的模型全局唯一 ID，例如 "omlx/qwen2.5-coder-7b" */
  readonly modelId: string;
  /** 网络物理属性 ("local" | "remote") */
  readonly locality: ProviderLocality;
  /** 激活的路由模式 */
  readonly mode: RoutingMode;
  /** 面向用户/诊断的可解释性决策理由 */
  readonly reason: string;
  /** 是否涉及云端端点调用 */
  readonly requiresCloud: boolean;
  /** 是否需要等待用户显式确认 */
  readonly requiresApproval: boolean;
  /** 隐私保护的回退候选模型链 */
  readonly fallbackChain: readonly string[];
  /** 预估成本描述 ("Free (Local)" 或 "Unknown") */
  readonly estimatedCost?: string;
}
```

---

## 5. 跨 Agent 上下文交接与隐私规约 (Privacy & Context Handoff)

在本地与云端模型协同工作流中（例如：本地 Explorer 扫描源码 -> 云端 Planner 编制规划）：
1. **最小上下文原则 (Least Privilege Context)：** Explorer 只返回经提炼的结构大纲、关键符号及摘要，禁止将未授权的源码完整 dump 直接投递至云端。
2. **策略路由确定性隐私门禁 (Policy-Based Privacy Gate)：** 在任务派发阶段，`WorkloadModelRouter` 依据物理网络 Locality 严格执行合规约束。在 `LOCAL` 模式下仅分派物理本地模型，回退候选链中绝不包含云端模型；在 `BALANCED` 模式下若未经 `allowCloud: true` 授权，绝不分派云端模型并安全失败（Fail-Closed）。子智能体派发与执行完全由 OMP 原生驱动，Nightglide 专注于透明的路由决策与状态呈现。*(注：M1.2 架构重构移除了脆弱的自定义 TS 网络拦截钩子 `assertDispatchModel`，由路由层策略决策接管)*

---

## 6. 类型化异常体系与防御闸门矩阵 (Error Hierarchy & Gate Enforcement)

所有路由决策失败均抛出具有机器可读 `code` 与可恢复标记 `recoverable` 的标准强类型异常：

```
NightglideError (code, recoverable)
  ├── ConfigurationError (CONFIG_*)
  ├── SecurityPermissionError (SECURITY_*)
  │     ├── CloudAuthorizationRequiredError ("CLOUD_AUTHORIZATION", modelId, providerId)
  │     └── RoutingPolicyViolationError ("ROUTING_POLICY", policy)
  └── EngineError (ENGINE_*)
        ├── ModelNotConfiguredError ("MODEL_NOT_CONFIGURED")
        ├── ProviderUnavailableError ("PROVIDER_UNAVAILABLE", providerId)
        ├── ManualRoleNotAssignedError ("MANUAL_ROLE_NOT_ASSIGNED", role)
        ├── ModelCapabilityMismatchError ("MODEL_CAPABILITY_MISMATCH", modelId, requiredCapabilities)
        └── SessionDisposedError ("SESSION_DISPOSED")
```

| 异常类型 | 触发条件 | 恢复建议 / 修复动作 |
|---|---|---|
| `ManualRoleNotAssignedError` | `MANUAL` 模式下，当前执行角色未在 `routing.roleAssignments` 中绑定模型 ID | 在配置中设置 `routing.roleAssignments.<role> = "<provider>/<model>"` |
| `ModelNotConfiguredError` | 指定的模型全局 ID 不存在于 `ProviderRegistry` 中 | 检查 Provider 配置，通过 `models` 指令确认已注册的模型列表 |
| `ProviderUnavailableError` | 承接该模型的提供商处于未启用状态 (`enabled: false`) 或连接测试失败 (`connected: false`) | 检查本地推理服务 (如 oMLX / Ollama) 进程状态及 BaseURL |
| `CloudAuthorizationRequiredError` | 选定模型为 `remote` 物理端点，但当前会话或配置中 `routing.allowCloud: false` | 用户显式配置 `routing.allowCloud = true` 开启云端协同 |
| `ModelCapabilityMismatchError` | 分配的模型不具备该角色所需的必要能力标记 (如缺少 `planning` 或 `reasoning`) | 为该角色分配具备对应能力的模型，或降低任务能力约束 |
| `RoutingPolicyViolationError` | 违反会话安全策略 (如 LOCAL 模式尝试外部路由) | 保持 LOCAL 纯本地模式执行 |
