/**
 * Nightglide 工作台终端视觉与交互验收脚本
 * 覆盖 80x24, 100x30, 120x36 尺寸与五套主题
 * （夜航 Flight / 深潜 Abyss / 极光 Aurora / 云光 Cloudlight / 晨曦 Daybreak）
 */
import { WelcomeComponent } from "../vendor/omp/packages/tui/src/prompt/welcome";
import { setThemeInstance, theme } from "../vendor/omp/packages/tui/src/theme/theme";
import { loadThemeSync, loadThemeJsonSync } from "../vendor/omp/packages/tui/src/theme/loader";
import { resolveThemeColors } from "../vendor/omp/packages/tui/src/theme/color";
import { relativeLuminance } from "../vendor/omp/packages/utils/src/color";
import { nightglideComposerStyle } from "../vendor/omp/packages/tui/src/components/composer/nightglide";
import { resolveComposerHint } from "../vendor/omp/packages/tui/src/prompt/composer-hints";
import { renderOutputBlock } from "../vendor/omp/packages/tui/src/render/output-block";
import { visibleWidth } from "../vendor/omp/packages/tui/src/utils";

interface ViewportSnapshot {
  themeName: string;
  width: number;
  height: number;
  mode: "empty" | "active-dialogue" | "approval" | "low-motion";
  renderedLines: string[];
}

function stripAnsi(str: string): string {
  return Bun.stripANSI(str);
}

function contrastRatio(colorA: string | number, colorB: string | number): number {
  const l1 = relativeLuminance(colorA);
  const l2 = relativeLuminance(colorB);
  if (l1 === undefined || l2 === undefined) return NaN;
  const max = Math.max(l1, l2);
  const min = Math.min(l1, l2);
  return (max + 0.05) / (min + 0.05);
}

/** 规范定义的 66 个全量主题槽位（59 个 ThemeColor + 7 个 ThemeBg） */
const REQUIRED_66_SLOTS = [
  // 7 Backgrounds
  "selectedBg", "userMessageBg", "customMessageBg", "toolPendingBg", "toolSuccessBg", "toolErrorBg", "statusLineBg",
  // 59 Colors
  "accent", "border", "borderAccent", "borderMuted", "success", "error", "warning", "muted", "dim", "text",
  "thinkingText", "userMessageText", "customMessageText", "customMessageLabel", "toolTitle", "toolOutput",
  "mdHeading", "mdLink", "mdLinkUrl", "mdCode", "mdCodeBlock", "mdCodeBlockBorder", "mdQuote", "mdQuoteBorder",
  "mdHr", "mdListBullet", "toolDiffAdded", "toolDiffRemoved", "toolDiffContext",
  "syntaxComment", "syntaxKeyword", "syntaxFunction", "syntaxVariable", "syntaxString", "syntaxNumber", "syntaxType", "syntaxOperator", "syntaxPunctuation",
  "thinkingOff", "thinkingMinimal", "thinkingLow", "thinkingMedium", "thinkingHigh", "thinkingXhigh",
  "bashMode", "pythonMode",
  "statusLineSep", "statusLineModel", "statusLinePath", "statusLineGitClean", "statusLineGitDirty", "statusLineContext",
  "statusLineSpend", "statusLineStaged", "statusLineDirty", "statusLineUntracked", "statusLineOutput", "statusLineCost", "statusLineSubagents"
] as const;

/** 各主题「进行中」工具卡片的动效文案，反映各自的动效身份。 */
const RUNNING_META: Record<string, { dynamic: string; static: string }> = {
  flight: {
    dynamic: "━╾─ 正在滑行检索...",
    static: "─ 正在滑行检索 (静态)...",
  },
  abyss: {
    dynamic: "● 正在检索深海符号...",
    static: "· 正在检索深海符号 (静态)...",
  },
  aurora: {
    dynamic: "≈✦ 极光涟漪检索中...",
    static: "✦ 极光涟漪检索中 (静态)...",
  },
  cloudlight: {
    dynamic: "░▒▓ 云影漂移检索中...",
    static: "░ 云影漂移检索中 (静态)...",
  },
  daybreak: {
    dynamic: "◎ 晨光晕染检索中...",
    static: "· 晨光晕染检索中 (静态)...",
  },
};

function renderMockTimeline(width: number, themeId: string, isStaticMotion = false): string[] {
  const shortId = themeId.replace("nightglide-", "");
  const metaObj = RUNNING_META[shortId] ?? RUNNING_META.flight;
  const runningHeaderMeta = isStaticMotion ? metaObj.static : metaObj.dynamic;

  // 用户消息气泡
  const userHead = theme.bold(theme.fg("text", "你  ")) + theme.fg("text", "帮我检查登录流程，并解释发现的问题。");
  
  // 助手消息
  const botHead = theme.fg("accent", "✦  ") + theme.fg("text", "我会先追踪登录请求，再检查错误处理与会话状态。");
  
  // 工具执行卡片 (已完成)
  const cardWidth = Math.min(width - 6, 74);
  const readToolBlock = renderOutputBlock({
    header: "read  src/auth/session.ts",
    headerMeta: "已完成 (42 行)",
    state: "success",
    width: cardWidth,
    sections: [
      {
        lines: [
          theme.fg("dim", " 1 │ export interface UserSession {"),
          theme.fg("dim", " 2 │   token: string;"),
          theme.fg("dim", " 3 │   expiresAt: number;"),
          theme.fg("dim", " 4 │ }"),
        ],
      },
    ],
  }, theme);

  // 正在进行的工具
  const searchToolBlock = renderOutputBlock({
    header: "search  login / refresh token",
    headerMeta: runningHeaderMeta,
    state: "running",
    width: cardWidth,
    sections: [
      {
        lines: [
          theme.fg("dim", "  ↳ 匹配 src/auth/login.ts:24 (handleTokenRefresh)"),
          theme.fg("dim", "  ↳ 匹配 src/auth/middleware.ts:18 (verifySession)"),
        ],
      },
    ],
  }, theme);

  return [
    "",
    "  " + userHead,
    "",
    "  " + botHead,
    "",
    ...readToolBlock.map(l => "    " + l),
    "",
    ...searchToolBlock.map(l => "    " + l),
    "",
    "  " + theme.fg("text", "发现两处需要关注的问题："),
    "  " + theme.fg("dim", "1. 令牌过期时，界面没有保留用户正在填写的内容。"),
    "  " + theme.fg("dim", "2. 会话中间件缺少重试间隔退避机制。"),
  ];
}

function renderMockApproval(width: number): string[] {
  const cardWidth = Math.min(width - 6, 74);
  const approvalBlock = renderOutputBlock({
    header: "⚠ 工具执行审批: 写入文件",
    headerMeta: "需要确认操作",
    state: "warning",
    borderColor: "warning",
    width: cardWidth,
    sections: [
      {
        lines: [
          theme.bold(theme.fg("warning", "操作: ")) + theme.fg("text", "修改 src/auth/session.ts 以修复过期重试"),
          theme.fg("dim", "差异预览 (Diff):"),
          theme.fg("toolDiffRemoved", "-   retryCount: 0,"),
          theme.fg("toolDiffAdded",   "+   retryCount: Math.min(maxRetries, current + 1),"),
          "",
          theme.fg("accent", "按 [Enter] 批准本次  |  [Ctrl+O] 查看完整差异  |  [Esc] 拒绝"),
        ],
      },
    ],
  }, theme);

  return [
    "",
    ...approvalBlock.map(l => "    " + l),
  ];
}

export function renderWorkbenchScreen(
  themeId: string,
  width: number,
  height: number,
  mode: "empty" | "active-dialogue" | "approval" | "low-motion"
): ViewportSnapshot {
  const t = loadThemeSync(themeId);
  setThemeInstance(t);

  const welcome = new WelcomeComponent("18.20.2");
  const welcomeLines = welcome.render(width, { project: "nightglide-cli", model: "omlx/endless" });

  let middleLines: string[] = [];
  if (mode === "empty") {
    // 空会话状态：整洁干净的留白
    middleLines = [];
  } else if (mode === "active-dialogue") {
    middleLines = renderMockTimeline(width, themeId, false);
  } else if (mode === "low-motion") {
    middleLines = renderMockTimeline(width, themeId, true);
  } else if (mode === "approval") {
    middleLines = renderMockApproval(width);
  }

  // 底部输入区与状态栏
  const topRule = nightglideComposerStyle.renderTop({
    box: theme.boxRound,
    width: width - 2,
    borderColor: (s: string) => theme.fg("borderAccent", s),
    topBorder: { content: theme.fg("statusLineModel", " endless [oMLX] "), width: 16 },
  });

  const promptGutter = theme.fg("accent", "❯ ");
  const hintText = resolveComposerHint({
    runningAgents: 0,
    focusedOnAgent: false,
    conversationStarted: mode !== "empty",
    keybindings: { getKeys: () => [] } as any,
    uses: () => 0,
  }) || "";

  const promptInput = mode === "empty" 
    ? theme.fg("dim", "输入指令、问答或输入 / 查看全部命令...") 
    : theme.fg("text", "继续追问，或输入下一步任务");
  const padLen = Math.max(2, width - 4 - visibleWidth(promptGutter) - visibleWidth(promptInput) - visibleWidth(hintText));
  const promptLine = "  " + promptGutter + promptInput + " ".repeat(padLen) + hintText;

  const motionIndicator = mode === "low-motion" ? theme.fg("dim", " [motion:off] ") + theme.fg("statusLineSep", "│") : "";
  const statusLineLeft = theme.fg("dim", " ⎇ main ") + theme.fg("statusLineSep", "│") + theme.fg("dim", " Nightglide CLI ") + theme.fg("statusLineSep", "│") + motionIndicator + theme.fg("statusLineModel", " endless (127.0.0.1:8000) ");
  const statusLineRight = theme.fg("dim", "0 tokens · $0.00 ");
  const statusPad = Math.max(1, width - 2 - visibleWidth(statusLineLeft) - visibleWidth(statusLineRight));
  const statusLine = "  " + statusLineLeft + " ".repeat(statusPad) + statusLineRight;

  const chromeLines = [
    "  " + topRule,
    promptLine,
    statusLine,
  ];

  // 垂直布局合成：底部 chromeLines 始终固定在屏幕底部，内容区按终端滚动规则保留可见视口
  const availableContentHeight = Math.max(0, height - chromeLines.length);
  const rawContentLines = [...welcomeLines, ...middleLines];

  let visibleContentLines: string[];
  let slackLines: string[];

  if (rawContentLines.length <= availableContentHeight) {
    visibleContentLines = rawContentLines;
    const slack = availableContentHeight - rawContentLines.length;
    slackLines = Array(slack).fill("");
  } else {
    // 终端向上滚动，保留最新视口内容，紧随底部输入框
    visibleContentLines = rawContentLines.slice(-availableContentHeight);
    slackLines = [];
  }

  const allLines = [...visibleContentLines, ...slackLines, ...chromeLines];

  return {
    themeName: themeId,
    width,
    height,
    mode,
    renderedLines: allLines,
  };
}

// ============================================================================
// 自动化验证套件
// ============================================================================

const THEMES = [
  "nightglide-flight",
  "nightglide-abyss",
  "nightglide-aurora",
  "nightglide-cloudlight",
  "nightglide-daybreak",
] as const;

function runVerificationSuite() {
  console.log("================================================================================");
  console.log("            NIGHTGLIDE TUI: 主题层次、动效系统与多尺寸适配走查套件              ");
  console.log("================================================================================");

  let totalTests = 0;
  let passedTests = 0;

  function assert(title: string, ok: boolean, detail?: string) {
    totalTests++;
    if (ok) {
      passedTests++;
      console.log(`  ✓ [PASS] ${title}`);
    } else {
      console.error(`  ✗ [FAIL] ${title} - ${detail ?? "assertion failed"}`);
    }
  }

  // 1. 检查 66 个主题槽位完整性
  console.log("\n[1/4] 检查五套主题的槽位完整性 (66 Slots Specification)");
  for (const themeId of THEMES) {
    const json = loadThemeJsonSync(themeId);
    const colorKeys = new Set(Object.keys(json.colors));
    const missing = REQUIRED_66_SLOTS.filter(s => !colorKeys.has(s));
    assert(
      `${themeId}: 完整声明全部 66 个色彩槽位 (59 fg + 7 bg)`,
      missing.length === 0,
      `缺失槽位: ${missing.join(", ")}`
    );
  }

  // 2. 检查 WCAG 2.1 AA 对比度算法一致性
  console.log("\n[2/4] 检查 WCAG 2.1 AA 对比度一致性 (重点：浅色主题与 statusLineBg)");
  for (const themeId of THEMES) {
    const json = loadThemeJsonSync(themeId);
    const colors = resolveThemeColors(json.colors, json.vars);
    const termBg = json.terminal?.background ?? (themeId.includes("light") || themeId.includes("daybreak") ? "#ffffff" : "#000000");
    const statusBg = colors.statusLineBg;

    // 状态栏关键文字槽位对 statusLineBg
    const statusTextC = contrastRatio(colors.text, statusBg);
    const statusModelC = contrastRatio(colors.statusLineModel, statusBg);
    const statusPathC = contrastRatio(colors.statusLinePath, statusBg);
    const statusGitCleanC = contrastRatio(colors.statusLineGitClean, statusBg);
    const statusGitDirtyC = contrastRatio(colors.statusLineGitDirty, statusBg);
    const statusDimC = contrastRatio(colors.dim, statusBg);

    // 浅色主题专项判定：正文与模型名达到 WCAG AA (>= 4.5:1), 次要 dim 达到大文本/次级阈值 (>= 3.0:1)
    const isLight = themeId === "nightglide-cloudlight" || themeId === "nightglide-daybreak";
    assert(
      `${themeId}: 状态栏正文与模型对比度 (text: ${statusTextC.toFixed(2)}:1, model: ${statusModelC.toFixed(2)}:1)`,
      statusTextC >= 4.5 && statusModelC >= 4.5,
      `低于 4.5:1 阈值`
    );

    assert(
      `${themeId}: 状态栏路径与 Git 状态对比度 (path: ${statusPathC.toFixed(2)}:1, clean: ${statusGitCleanC.toFixed(2)}:1, dirty: ${statusGitDirtyC.toFixed(2)}:1)`,
      statusPathC >= 4.5 && statusGitCleanC >= 4.5 && statusGitDirtyC >= 4.5,
      `低于 4.5:1 阈值`
    );

    assert(
      `${themeId}: 状态栏 dim 辅助文本对比度 (${statusDimC.toFixed(2)}:1 >= 3.0:1)`,
      statusDimC >= 3.0,
      `低于 3.0:1 阈值`
    );

    // 终端主背景对比度
    const termTextC = contrastRatio(colors.text, termBg);
    const termAccentC = contrastRatio(colors.accent, termBg);
    const termSuccessC = contrastRatio(colors.success, termBg);
    const termErrorC = contrastRatio(colors.error, termBg);
    const termWarningC = contrastRatio(colors.warning, termBg);

    assert(
      `${themeId}: 终端画布主文本与核心状态语义 (text: ${termTextC.toFixed(2)}:1, accent: ${termAccentC.toFixed(2)}:1, success: ${termSuccessC.toFixed(2)}:1, error: ${termErrorC.toFixed(2)}:1)`,
      termTextC >= 4.5 && termAccentC >= 4.5 && termSuccessC >= 4.5 && termErrorC >= 4.5,
      `低于 4.5:1 阈值`
    );
  }

  // 3. 检查动效系统与 Spinner 帧 (Zero Jitter 验证)
  console.log("\n[3/4] 检查动效系统与 Spinner 帧 (Zero Jitter 字符网格绝对零位移)");
  for (const themeId of THEMES) {
    const json = loadThemeJsonSync(themeId);
    const spinner = json.symbols?.spinnerFrames;
    assert(`${themeId}: 定义 symbols.spinnerFrames`, !!spinner);

    if (spinner) {
      // 检查 status spinner
      const statusFrames = spinner.status;
      assert(`${themeId}: status spinner 具备帧序列 (${statusFrames?.length ?? 0} 帧)`, !!statusFrames && statusFrames.length > 0);
      if (statusFrames && statusFrames.length > 0) {
        const widths = statusFrames.map(f => visibleWidth(f));
        const uniform = widths.every(w => w === widths[0]);
        assert(
          `${themeId}: status spinner 全帧等宽无抖动 [Zero Jitter] (每帧 ${widths[0]} 字符列)`,
          uniform,
          `帧宽度不一致: ${widths.join(", ")}`
        );
      }

      // 检查 activity spinner
      const activityFrames = spinner.activity;
      assert(`${themeId}: activity spinner 具备帧序列 (${activityFrames?.length ?? 0} 帧)`, !!activityFrames && activityFrames.length > 0);
      if (activityFrames && activityFrames.length > 0) {
        const widths = activityFrames.map(f => visibleWidth(f));
        const uniform = widths.every(w => w === widths[0]);
        assert(
          `${themeId}: activity spinner 全帧等宽无抖动 [Zero Jitter] (每帧 ${widths[0]} 字符列)`,
          uniform,
          `帧宽度不一致: ${widths.join(", ")}`
        );
      }
    }
  }

  // 4. 多尺寸适配走查 (80x24, 100x30, 120x36)
  console.log("\n[4/4] 检查多尺寸适配走查与视口边界 (80x24, 100x30, 120x36)");
  const targets = [
    { width: 80, height: 24, label: "80x24 (紧凑基线 Compact)" },
    { width: 100, height: 30, label: "100x30 (日常标准 Baseline)" },
    { width: 120, height: 36, label: "120x36 (扩展宽屏 Expanded)" },
  ];

  const modes = ["empty", "active-dialogue", "approval", "low-motion"] as const;

  for (const themeId of THEMES) {
    for (const target of targets) {
      for (const mode of modes) {
        const snap = renderWorkbenchScreen(themeId, target.width, target.height, mode);
        // 验证行数严格契合
        const rowMatch = snap.renderedLines.length === target.height;
        // 验证每行无横向溢出
        const maxLineWidth = Math.max(...snap.renderedLines.map(l => visibleWidth(stripAnsi(l))));
        const noColOverflow = maxLineWidth <= target.width;

        assert(
          `${themeId} | ${target.label} | ${mode}: 视口匹配 (${snap.renderedLines.length}/${target.height} 行, 最大列宽 ${maxLineWidth}/${target.width})`,
          rowMatch && noColOverflow,
          `溢出或行数不匹配: rows=${snap.renderedLines.length}, maxCol=${maxLineWidth}`
        );
      }
    }
  }

  console.log(`\n================================================================================`);
  console.log(`验收测试结果汇总: 全部 ${totalTests} 项检查，通过 ${passedTests} 项，失败 ${totalTests - passedTests} 项`);
  console.log("================================================================================");
}

// 运行测试套件
runVerificationSuite();

// 打印具有代表性的典型快照供审查
console.log("\n================================================================================");
console.log("                       代表性典型视觉快照走查 (Visual Snapshots)                ");
console.log("================================================================================");

const representativeRuns = [
  // 1. 80x24 紧凑模式 - Flight (夜航，暗色默认) 空状态
  { themeId: "nightglide-flight", width: 80, height: 24, mode: "empty" as const, title: "夜航 Flight · 80x24 空状态" },
  // 2. 80x24 紧凑模式 - Flight (夜航，暗色默认) 活动对话状态
  { themeId: "nightglide-flight", width: 80, height: 24, mode: "active-dialogue" as const, title: "夜航 Flight · 80x24 活跃对话状态" },
  // 3. 80x24 紧凑模式 - Flight (夜航，暗色默认) 审批状态
  { themeId: "nightglide-flight", width: 80, height: 24, mode: "approval" as const, title: "夜航 Flight · 80x24 审批弹窗状态" },
  // 4. 100x30 标准模式 - Abyss (深潜，深海金) 活动对话
  { themeId: "nightglide-abyss", width: 100, height: 30, mode: "active-dialogue" as const, title: "深潜 Abyss · 100x30 活跃对话状态" },
  // 5. 100x30 标准模式 - Aurora (极光，极光青绿) 活动对话
  { themeId: "nightglide-aurora", width: 100, height: 30, mode: "active-dialogue" as const, title: "极光 Aurora · 100x30 活跃对话状态" },
  // 6. 100x30 标准模式 - Cloudlight (云光冷蓝，浅色) 活动对话
  { themeId: "nightglide-cloudlight", width: 100, height: 30, mode: "active-dialogue" as const, title: "云光 Cloudlight · 100x30 活跃对话 (浅色)" },
  // 7. 100x30 标准模式 - Daybreak (晨曦陶土，浅色) 活动对话
  { themeId: "nightglide-daybreak", width: 100, height: 30, mode: "active-dialogue" as const, title: "晨曦 Daybreak · 100x30 活跃对话 (浅色)" },
  // 8. 100x30 标准模式 - Daybreak (晨曦，静态低动效)
  { themeId: "nightglide-daybreak", width: 100, height: 30, mode: "low-motion" as const, title: "晨曦 Daybreak · 100x30 低动效/静态占位 (motion:off)" },
  // 9. 120x36 宽屏模式 - Flight 活跃对话与工具卡片
  { themeId: "nightglide-flight", width: 120, height: 36, mode: "active-dialogue" as const, title: "夜航 Flight · 120x36 宽屏工作台" },
];

for (const rep of representativeRuns) {
  const snap = renderWorkbenchScreen(rep.themeId, rep.width, rep.height, rep.mode);
  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`[SNAPSHOT] ${rep.title} (${rep.width}x${rep.height})`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log("┌" + "─".repeat(rep.width) + "┐");
  for (const line of snap.renderedLines) {
    const plain = stripAnsi(line);
    const pad = Math.max(0, rep.width - visibleWidth(plain));
    console.log("│" + plain + " ".repeat(pad) + "│");
  }
  console.log("└" + "─".repeat(rep.width) + "┘");
}
