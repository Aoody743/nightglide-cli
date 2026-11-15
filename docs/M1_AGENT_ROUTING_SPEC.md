# Nightglide M1 智能工作负载与模型路由技术规范 (M1 Agent Routing Spec)

**版本：** 1.0.0 (M1)  
**模块命名空间：** `@nightglide/routing`, `@nightglide/providers`  
**语言规范：** 简体中文 (核心类型标识与代码接口遵循英文技术标识)  

---

## 1. 架构目标与设计原则

Nightglide 的核心价值主张在于**工作负载感知的多提供商智能模型路由 (Workload-Aware Model Routing)** 与 **本地/云端协同 (Local + Cloud Agent Collaboration)**。

不同于传统单一模型助手盲目将所有任务提交给同一个模型，Nightglide 路由器根据任务的类型、上下文规模、系统复杂性以及严格的用户数据隐私边界，将子任务动态派发给最适宜的模型实体。

### 核心安全与隐私公理 (Privacy & Security Axioms)
1. **网络物理位置绝对优先 (Physical Locality Invariance)：** 模型的 Local / Remote 属性严格依据解析后的网络端点地址（回环地址 `127.0.0.1`, `localhost`, `[::1]`, `127.0.0.0/8` 为 `local`，其余所有外网域名及内网 IP 均强制为 `remote`），绝不轻信 Provider 的 Display Name。
2. **LOCAL 模式绝对禁止云端外发 (Zero Cloud Leakage in LOCAL)：** 当运行于 `LOCAL` 模式时，路由器禁止任何云端模型参与，且 Fallback 链中仅能包含经认证的本地模型。若本地模型不可用，系统立即抛出显式异常，严禁静默回退到云端。
3. **BALANCED 模式授权闸门 (Authorization Gate in BALANCED)：** 仅当用户显式开启 `routing.allowCloud: true` 时，规划或高复杂度任务方可路由至云端强模型；未经授权时，系统降级至本地最强模型并标注隐私限制。
4. **成本与用量透明 (Cost Transparency)：** 在缺乏精确计费数据时标记为 `"Unknown"`，绝不捏造为 0。

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
每个任务类别在缺省状态下自动映射到最适宜的 Agent 角色：

| TaskCategory | 目标 AgentRole | 典型能力需求 (`ModelCapability`) | 推荐承接模型类型 |
|---|---|---|---|
| `explore` | `explore` / `scout` | `["fast", "tool_call"]` | 本地轻量模型 (如 Qwen 2.5 Coder 7B / Ollama) |
| `explain` | `main` | `["reasoning"]` | 本地通用模型 |
| `plan` | `plan` | `["planning", "reasoning"]` | 强推理云端模型 (如 Claude 3.7 / GPT-4o) 或本地大模型 |
| `implement` | `implement` | `["coding", "reasoning"]` | 本地代码模型或云端编码模型 |
| `debug` | `main` | `["reasoning", "coding"]` | 本地/云端混合推理模型 |
| `review` | `review` | `["reasoning", "coding"]` | 独立审查模型 (避免自我评审偏见) |
| `test` | `main` | `["coding", "tool_call"]` | 具备结构化输出的代码模型 |
| `summarize` | `main` | `["fast"]` | 低时延、经济型模型 |

---

## 3. 运行模式与决策矩阵 (Routing Modes)

### 3.1 模式定义 (`RoutingMode`)
- `LOCAL`: 纯本地模式。仅使用本机端点 (oMLX, Ollama, LM Studio)。绝对无外部流量。
- `BALANCED`: 平衡模式 (默认推荐)。轻量/常规任务使用本地模型；高复杂度任务在获得用户授权 (`allowCloud: true`) 时无缝协同云端强模型。
- `PERFORMANCE`: 性能优先模式。以模型质量为首要考量，云端模型优先，但必须满足用户隐私与预算授权。
- `MANUAL`: 手动模式。严格执行 `routing.roleAssignments` 中用户显式指定的每个角色的模型 ID。

### 3.2 路由决策算法伪代码
```typescript
function routeTask(prompt, options): RoutingDecision {
  const { category, isComplex, requiredCapabilities } = classifyTask(prompt);
  const role = resolveRoleForCategory(category, options.explicitRole);

  if (mode === "MANUAL") {
    const assigned = config.roleAssignments[role] ?? fallbackModel;
    verifyCloudAuthorization(assigned);
    return createDecision(assigned, "MANUAL");
  }

  if (mode === "LOCAL") {
    const localModel = findBestModel(localModels, requiredCapabilities);
    if (!localModel) throw new ProviderUnavailableError("LOCAL mode requires active local model");
    return createDecision(localModel, "LOCAL", { fallbackChain: otherLocalModels });
  }

  if (mode === "BALANCED") {
    const isHeavy = category === "plan" || category === "review" || isComplex;
    if (isHeavy && cloudModels.length > 0 && config.allowCloud) {
      return createDecision(bestCloudModel, "BALANCED", { fallbackChain: localModels });
    }
    return createDecision(bestLocalModel || bestAuthorizedCloudModel, "BALANCED");
  }

  if (mode === "PERFORMANCE") {
    if (cloudModels.length > 0 && config.allowCloud) {
      return createDecision(topCloudModel, "PERFORMANCE");
    }
    return createDecision(topLocalModel, "PERFORMANCE");
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
  /** 目标执行角色 */
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
  /** 预估成本描述 (如 "Free (Local)" 或 "Unknown") */
  readonly estimatedCost?: string;
}
```

---

## 5. 跨 Agent 上下文交接与隐私规约 (Privacy & Context Handoff)

在本地与云端模型协同工作流中（例如：本地 Explorer 扫描源码 -> 云端 Planner 编制规划）：
1. **最小上下文原则 (Least Privilege Context)：** Explorer 只返回经提炼的结构大纲、关键符号及摘要，禁止将未授权的源码完整 dump 直接投递至云端。
2. **硬拦截器集成 (`assertDispatchModel`)：** 在每次向 OMP 底层驱动请求前，Nightglide 会触发 `assertDispatchModel(model)` 钩子，校验选定模型是否完全符合当前会话的隐私许可。
