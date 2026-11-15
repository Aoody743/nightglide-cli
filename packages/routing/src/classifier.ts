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
      /\b(plan|planning|architect\w*|design\w*|proposal|roadmap|rfc|strategy)\b/i,
      /(规划|架构|方案|设计|重构方案|重构计划|路线图)/i,
    ],
    capabilities: ["planning", "reasoning"],
    weight: 1.3,
  },
  {
    category: "review",
    patterns: [
      /\b(review|audit|critique|check quality|inspect diff|pr review)\b/i,
      /(审查|评审|代码审查|安全检查|走查)/i,
    ],
    capabilities: ["reasoning", "coding"],
    weight: 1.1,
  },
  {
    category: "explore",
    patterns: [
      /\b(find|search|explore|locate|structure|list files|grep|where is)\b/i,
      /(搜索|查找|定位|浏览|结构|探查|查一下)/i,
    ],
    capabilities: ["fast", "tool_call"],
    weight: 1.0,
  },
  {
    category: "explain",
    patterns: [
      /\b(explain|what does|how does|clarify|understand|describe|meaning)\b/i,
      /(解释|说明|介绍|为什么|怎么理解|含义)/i,
    ],
    capabilities: ["reasoning"],
    weight: 1.0,
  },
  {
    category: "debug",
    patterns: [
      /\b(debug|error|exception|fail\w*|crash|bug|stack trace|why is failing)\b/i,
      /(排查|调试|报错|异常|崩溃|故障|定位bug)/i,
    ],
    capabilities: ["reasoning", "coding"],
    weight: 1.1,
  },
  {
    category: "test",
    patterns: [
      /\b(test\w*|unit test|integration test|verify|coverage|mock|suite)\b/i,
      /(测试|单元测试|验证|集成测试|测一下)/i,
    ],
    capabilities: ["coding", "tool_call"],
    weight: 1.0,
  },
  {
    category: "summarize",
    patterns: [
      /\b(summarize|summary|overview|tl;dr|recap|digest|brief)\b/i,
      /(总结|概括|简要|汇报|汇总|一句话概括)/i,
    ],
    capabilities: ["fast"],
    weight: 0.9,
  },
  {
    category: "implement",
    patterns: [
      /\b(implement|write|create|build|add feature|code|generate|develop|fix)\b/i,
      /(实现|编写|写代码|创建|开发|修改|修复|添加功能)/i,
    ],
    capabilities: ["coding", "reasoning"],
    weight: 1.0,
  },
];

const COMPLEXITY_INDICATORS = [
  /\b(refactor\w*|architect\w*|complete overhaul|full migration|distributed|concurrency)\b/i,
  /(重构|大规模|系统级|多模块|高并发|跨服务|架构)/i,
];

/**
 * Deterministic heuristic task classifier.
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
  const explanation = `Heuristic classification matched '${bestCategory}' with confidence ${(confidence * 100).toFixed(0)}% (Complexity: ${isComplex ? "high" : "normal"}).`;

  return {
    category: bestCategory,
    confidence,
    requiredCapabilities: matchedCapabilities,
    isComplex,
    explanation,
  };
}
