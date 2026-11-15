/**
 * Policy-Based Workload Routing Classifier.
 *
 * Deterministic rule-based task classifier for Nightglide.
 * Evaluates prompts using explicit pattern matching and complexity heuristics
 * against predefined workload policies, capability requirements, and privacy boundaries.
 * This is a deterministic, policy-based engine—not an artificial adaptive machine learning model.
 */

import type { TaskCategory, ModelCapability } from "@nightglide/core";

export interface ClassificationResult {
  category: TaskCategory;
  confidence: number;
  requiredCapabilities: ModelCapability[];
  isComplex: boolean;
  explanation: string;
}

interface PatternRule {
  category: TaskCategory;
  patterns: RegExp[];
  capabilities: ModelCapability[];
  weight: number;
}

const RULES: PatternRule[] = [
  {
    category: "plan",
    patterns: [
      /\b(plan|planning|architect\w*|design\w*|proposal|roadmap|rfc|strategy|blueprint)\b/i,
      /(规划|架构|方案|设计|重构方案|重构计划|路线图|蓝图)/i,
    ],
    capabilities: ["planning", "reasoning"],
    weight: 1.3,
  },
  {
    category: "review",
    patterns: [
      /\b(review|audit|critique|check quality|inspect diff|pr review|code review)\b/i,
      /(审查|评审|代码审查|安全检查|走查|代码走查|质检)/i,
    ],
    capabilities: ["reasoning", "coding"],
    weight: 1.1,
  },
  {
    category: "explore",
    patterns: [
      /\b(find|search|explore|locate|structure|list files|grep|where is|lookup|browse)\b/i,
      /(搜索|查找|定位|浏览|结构|探查|查一下|找一下|检索)/i,
    ],
    capabilities: ["fast", "tool_call"],
    weight: 1.0,
  },
  {
    category: "explain",
    patterns: [
      /\b(explain|what does|how does|clarify|understand|describe|meaning|walk through|break down)\b/i,
      /(解释|说明|介绍|为什么|怎么理解|含义|讲解|导读)/i,
    ],
    capabilities: ["reasoning"],
    weight: 1.0,
  },
  {
    category: "debug",
    patterns: [
      /\b(debug|error|exception|fail\w*|crash|bug|stack trace|why is failing|diagnose|troubleshoot)\b/i,
      /(排查|调试|报错|异常|崩溃|故障|定位bug|排错|诊断)/i,
    ],
    capabilities: ["reasoning", "coding"],
    weight: 1.1,
  },
  {
    category: "test",
    patterns: [
      /\b(test\w*|unit test|integration test|verify|coverage|mock|suite|spec\w*)\b/i,
      /(测试|单元测试|验证|集成测试|测一下|用例|测试用例|覆盖率)/i,
    ],
    capabilities: ["coding", "tool_call"],
    weight: 1.0,
  },
  {
    category: "summarize",
    patterns: [
      /\b(summarize|summary|overview|tl;dr|recap|digest|brief|wrap up)\b/i,
      /(总结|概括|简要|汇报|汇总|一句话概括|纪要)/i,
    ],
    capabilities: ["fast"],
    weight: 0.9,
  },
  {
    category: "implement",
    patterns: [
      /\b(implement|write|create|build|add feature|code|generate|develop|fix|patch)\b/i,
      /(实现|编写|写代码|创建|开发|修改|修复|添加功能|补丁)/i,
    ],
    capabilities: ["coding", "reasoning"],
    weight: 1.0,
  },
];

const COMPLEXITY_INDICATORS = [
  /\b(refactor\w*|architect\w*|complete overhaul|full migration|distributed|concurrency|scalable|high throughput)\b/i,
  /(重构|大规模|系统级|多模块|高并发|跨服务|架构|分布式|高吞吐)/i,
];

/**
 * Returns the standard required model capabilities for a given task category.
 */
export function getRequiredCapabilitiesForCategory(category: TaskCategory): ModelCapability[] {
  const rule = RULES.find((r) => r.category === category);
  if (rule) {
    return [...rule.capabilities];
  }
  return ["coding"];
}

/**
 * Deterministic policy-based workload task classifier.
 * Evaluates task intent and context across English, Chinese, and mixed bilingual prompts.
 * Produces structured classification with confidence, capability requirements, and complexity estimation.
 */
export function classifyTask(
  prompt: string,
  context?: { filesCount?: number; isMultiStep?: boolean }
): ClassificationResult {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) {
    return {
      category: "explain",
      confidence: 0.5,
      requiredCapabilities: ["fast"],
      isComplex: false,
      explanation: "Empty prompt defaulted to explain.",
    };
  }

  let bestCategory: TaskCategory = "implement";
  let highestScore = 0;
  let matchedCapabilities: ModelCapability[] = ["coding"];

  for (const rule of RULES) {
    let matchesCount = 0;
    for (const pat of rule.patterns) {
      if (pat.test(cleanPrompt)) {
        matchesCount++;
      }
    }
    if (matchesCount > 0) {
      const score = matchesCount * rule.weight;
      if (score > highestScore) {
        highestScore = score;
        bestCategory = rule.category;
        matchedCapabilities = [...rule.capabilities];
      }
    }
  }

  // Calculate complexity
  let isComplex = false;
  if (cleanPrompt.length > 300) {
    isComplex = true;
  }
  if ((context?.filesCount ?? 0) > 10 || context?.isMultiStep) {
    isComplex = true;
  }
  for (const pat of COMPLEXITY_INDICATORS) {
    if (pat.test(cleanPrompt)) {
      isComplex = true;
      break;
    }
  }

  const confidence = Math.min(1.0, Math.max(0.6, highestScore > 0 ? 0.75 + (highestScore * 0.1) : 0.6));
  const explanation = `Policy-based workload classification matched '${bestCategory}' with confidence ${(confidence * 100).toFixed(0)}% (Complexity: ${isComplex ? "high" : "normal"}).`;

  return {
    category: bestCategory,
    confidence,
    requiredCapabilities: matchedCapabilities,
    isComplex,
    explanation,
  };
}
