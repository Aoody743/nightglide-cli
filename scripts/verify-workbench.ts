/**
 * Nightglide 工作台终端视觉与交互验收脚本
 * 覆盖 80x24, 100x30, 120x36 尺寸与五套主题
 * （夜航 Flight / 深潜 Abyss / 极光 Aurora / 云光 Cloudlight / 晨曦 Daybreak）
 */
import { WelcomeComponent } from "../vendor/omp/packages/tui/src/prompt/welcome";
import { setThemeInstance, theme } from "../vendor/omp/packages/tui/src/theme/theme";
import { loadThemeSync } from "../vendor/omp/packages/tui/src/theme/loader";
import { nightglideComposerStyle } from "../vendor/omp/packages/tui/src/components/composer/nightglide";
import { resolveComposerHint } from "../vendor/omp/packages/tui/src/prompt/composer-hints";
import { renderOutputBlock } from "../vendor/omp/packages/tui/src/render/output-block";
import { visibleWidth } from "../vendor/omp/packages/tui/src/utils";

interface ViewportSnapshot {
  themeName: string;
  width: number;
  height: number;
  mode: "empty" | "active-dialogue" | "approval";
  renderedLines: string[];
}

function stripAnsi(str: string): string {
  return Bun.stripANSI(str);
}

/** 各主题「进行中」工具卡片的动效文案，反映各自的动效身份。 */
const RUNNING_META: Record<string, string> = {
  flight: "━╾─ 正在滑行检索...",
  abyss: "● 正在检索深海符号...",
  aurora: "≈✦ 极光涟漪检索中...",
  cloudlight: "░▒▓ 云影漂移检索中...",
  daybreak: "◎ 晨光晕染检索中...",
};

function renderMockTimeline(width: number, themeId: string): string[] {

  // 用户消息气泡
  const userHead = theme.bold(theme.fg("text", "你  ")) + theme.fg("text", "帮我检查登录流程，并解释发现的问题。");
  
  // 助手消息
  const botHead = theme.fg("accent", "✦  ") + theme.fg("text", "我会先追踪登录请求，再检查错误处理与会话状态。");
  
  // 工具执行卡片
  const readToolBlock = renderOutputBlock({
    header: "read  src/auth/session.ts",
    headerMeta: "已完成 (42 行)",
    state: "success",
    width: Math.min(width - 4, 76),
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
    headerMeta: RUNNING_META[themeId.replace("nightglide-", "")] ?? RUNNING_META.flight,
    state: "running",
    width: Math.min(width - 4, 76),
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
  const approvalBlock = renderOutputBlock({
    header: "⚠ 工具执行审批: 写入文件",
    headerMeta: "需要确认操作",
    state: "warning",
    borderColor: "warning",
    width: Math.min(width - 4, 76),
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

function renderWorkbenchScreen(
  themeId: string,
  width: number,
  height: number,
  mode: "empty" | "active-dialogue" | "approval"
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
    middleLines = renderMockTimeline(width, themeId);
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

  const promptInput = mode === "empty" ? theme.fg("dim", "输入指令、问答或输入 / 查看全部命令...") : theme.fg("text", "继续追问，或输入下一步任务");
  const padLen = Math.max(2, width - 4 - visibleWidth(promptGutter) - visibleWidth(promptInput) - visibleWidth(hintText));
  const promptLine = "  " + promptGutter + promptInput + " ".repeat(padLen) + hintText;

  const statusLineLeft = theme.fg("dim", " ⎇ main ") + theme.fg("statusLineSep", "│") + theme.fg("dim", " Nightglide CLI ") + theme.fg("statusLineSep", "│") + theme.fg("statusLineModel", " endless (127.0.0.1:8000) ");
  const statusLineRight = theme.fg("dim", "0 tokens · $0.00 ");
  const statusPad = Math.max(1, width - 2 - visibleWidth(statusLineLeft) - visibleWidth(statusLineRight));
  const statusLine = "  " + statusLineLeft + " ".repeat(statusPad) + statusLineRight;

  const chromeLines = [
    "  " + topRule,
    promptLine,
    statusLine,
  ];

  // 垂直布局合成
  const usedRows = welcomeLines.length + middleLines.length + chromeLines.length;
  const slack = Math.max(0, height - usedRows);
  const slackLines = Array(slack).fill("");

  const allLines = [...welcomeLines, ...middleLines, ...slackLines, ...chromeLines].slice(0, height);

  return {
    themeName: themeId,
    width,
    height,
    mode,
    renderedLines: allLines,
  };
}

console.log("=== NIGHTGLIDE STAGE 1 WORKBENCH VERIFICATION ===");
const targets = [
  { width: 80, height: 24, label: "80x24 (Compact Target)" },
  { width: 100, height: 30, label: "100x30 (Daily Baseline Target)" },
  { width: 120, height: 36, label: "120x36 (Expanded Target)" },
];

for (const themeId of [
  "nightglide-flight",
  "nightglide-abyss",
  "nightglide-aurora",
  "nightglide-cloudlight",
  "nightglide-daybreak",
]) {
  console.log(`\n======================================================`);
  console.log(`  THEME: ${themeId.toUpperCase()}`);
  console.log(`======================================================`);
  for (const target of targets) {
    for (const mode of ["empty", "active-dialogue", "approval"] as const) {
      const snap = renderWorkbenchScreen(themeId, target.width, target.height, mode);
      console.log(`\n[SNAPSHOT] ${themeId} | ${target.label} | Mode: ${mode}`);
      console.log(`Dimensions: ${snap.width}x${snap.height}, Rendered rows: ${snap.renderedLines.length}`);
      // 输出纯净预览
      console.log("┌" + "─".repeat(target.width) + "┐");
      for (const line of snap.renderedLines) {
        const plain = stripAnsi(line);
        const pad = Math.max(0, target.width - visibleWidth(plain));
        console.log("│" + plain + " ".repeat(pad) + "│");
      }
      console.log("└" + "─".repeat(target.width) + "┘");
    }
  }
}
