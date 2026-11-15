import { describe, test, expect } from "bun:test";
import { getThemeManager } from "@nightglide/themes";
import {
  resolveProviderVendor,
  VENDOR_SIGNATURES,
  ANTHROPIC_SIGNATURE,
  OPENAI_SIGNATURE,
  GOOGLE_SIGNATURE,
  XAI_SIGNATURE,
  OMP_SIGNATURE,
  LOCAL_SIGNATURE,
} from "../../apps/cli/src/ui/motion/vendors.js";
import {
  getStringWidth,
  reserveSlot,
} from "../../apps/cli/src/ui/motion/slots.js";
import { isValidHex } from "../../apps/cli/src/ui/motion/color.js";
import {
  getThinkingPresentation,
  ThinkingIndicator,
} from "../../apps/cli/src/ui/components/motion/ThinkingIndicator.js";
import {
  formatModelPill,
  formatModelBadge,
} from "../../apps/cli/src/ui/components/Header.js";

describe("Provider Vendor Signatures - Identification & Assets", () => {
  test("resolves Anthropic Claude vendor signature and brand assets", () => {
    const claudeModels = [
      "claude-3-5-sonnet",
      "claude-3-opus",
      "anthropic/claude-3-haiku",
      "anthropic",
      "claude",
    ];

    for (const model of claudeModels) {
      const vendor = resolveProviderVendor(model);
      expect(vendor.id).toBe("anthropic");
      expect(vendor.name).toBe("Anthropic Claude");
      expect(vendor.brandColor).toBe("#D97757");
      expect(vendor.miniGlyph).toBe("✶");
      expect(vendor.defaultSlotWidth).toBe(2);
      expect(vendor.frames).toEqual(["✶", "✷", "✸", "✹", "✺", "✹", "✸", "✷"]);
      expect(vendor.asciiLogo).toContain("▄██▄");
      expect(vendor.asciiLogo).toContain("▀██████████▀");
    }
  });

  test("resolves OpenAI vendor signature and brand assets", () => {
    const openaiModels = [
      "gpt-4o",
      "gpt-4-turbo",
      "openai/gpt-4o-mini",
      "o1-preview",
      "o3-mini",
      "chatgpt-4o",
      "openai",
    ];

    for (const model of openaiModels) {
      const vendor = resolveProviderVendor(model);
      expect(vendor.id).toBe("openai");
      expect(vendor.name).toBe("OpenAI");
      expect(vendor.brandColor).toBe("#10A37F");
      expect(vendor.miniGlyph).toBe("✢");
      expect(vendor.defaultSlotWidth).toBe(2);
      expect(vendor.frames).toEqual(["✢", "✤", "✥", "✦", "✧", "✦", "✥", "✤"]);
      expect(vendor.asciiLogo).toContain("⢀⣴⣶⣦⡀");
      expect(vendor.asciiLogo).toContain("⠘⣿⣤⣤⣿⠃");
    }
  });

  test("resolves Google Gemini vendor signature and brand assets", () => {
    const geminiModels = [
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "google/gemini-2.0-flash",
      "gemini",
      "google",
      "bard",
    ];

    for (const model of geminiModels) {
      const vendor = resolveProviderVendor(model);
      expect(vendor.id).toBe("google");
      expect(vendor.name).toBe("Google Gemini");
      expect(vendor.brandColor).toBe("#4E75F6");
      expect(vendor.secondaryColor).toBe("#8AB4F8");
      expect(vendor.miniGlyph).toBe("✦");
      expect(vendor.defaultSlotWidth).toBe(4);
      expect(vendor.frames).toEqual(["✦ ✧", "✧ ✦", "✶ ✦", "✦ ✶", "✦ ✧"]);
      expect(vendor.asciiLogo).toContain("✦");
      expect(vendor.asciiLogo).toContain("✧");
    }
  });

  test("resolves xAI Grok vendor signature and brand assets", () => {
    const grokModels = [
      "grok-2",
      "grok-2-mini",
      "xai/grok-beta",
      "grok",
      "xai",
    ];

    for (const model of grokModels) {
      const vendor = resolveProviderVendor(model);
      expect(vendor.id).toBe("xai");
      expect(vendor.name).toBe("xAI Grok");
      expect(vendor.brandColor).toBe("#FFFFFF");
      expect(vendor.miniGlyph).toBe("／");
      expect(vendor.defaultSlotWidth).toBe(3);
      expect(vendor.frames).toEqual(["／", "─", "＼", "│", "／", "─", "＼", "│"]);
      expect(vendor.asciiLogo).toContain("／");
    }
  });

  test("resolves Oh My Pi (OMP) vendor signature and brand assets", () => {
    const ompModels = [
      "omp",
      "omp/sonic",
      "oh-my-pi",
      "ohmypi",
    ];

    for (const model of ompModels) {
      const vendor = resolveProviderVendor(model);
      expect(vendor.id).toBe("omp");
      expect(vendor.name).toBe("Oh My Pi (OMP)");
      expect(vendor.brandColor).toBe("#A6A0FF");
      expect(vendor.miniGlyph).toBe("π");
      expect(vendor.defaultSlotWidth).toBe(3);
      expect(vendor.frames).toEqual(["π·", "·π", "π·", "·π"]);
      expect(vendor.asciiLogo).toContain("████████");
    }
  });

  test("resolves Local / Submarine Sonar / oMLX / Endless vendor signature", () => {
    const localModels = [
      "omlx/endless",
      "omlx/qwen2.5-coder",
      "local",
      "sonar",
      "submarine",
      "ollama/llama3",
      "qwen2.5-coder:7b",
      "mock",
    ];

    for (const model of localModels) {
      const vendor = resolveProviderVendor(model);
      expect(vendor.id).toBe("local");
      expect(vendor.name).toBe("Local / Submarine Sonar");
      expect(vendor.brandColor).toBe("#00F0FF");
      expect(vendor.secondaryColor).toBe("#FFB800");
      expect(vendor.miniGlyph).toBe("◎");
      expect(vendor.defaultSlotWidth).toBe(2);
      expect(vendor.frames).toEqual(["◌", "◯", "◎", "◉", "◎", "◯"]);
      expect(vendor.asciiLogo).toContain("╭───╮");
      expect(vendor.asciiLogo).toContain("│ ◎ │");
    }
  });

  test("resolves default fallback to Local / Submarine Sonar for undefined or unknown input", () => {
    expect(resolveProviderVendor(undefined).id).toBe("local");
    expect(resolveProviderVendor("").id).toBe("local");
    expect(resolveProviderVendor("   ").id).toBe("local");
    expect(resolveProviderVendor("unregistered-custom-runtime").id).toBe("local");
  });

  test("VENDOR_SIGNATURES exports accessible dictionary with common alias keys", () => {
    expect(VENDOR_SIGNATURES.anthropic).toBe(ANTHROPIC_SIGNATURE);
    expect(VENDOR_SIGNATURES.claude).toBe(ANTHROPIC_SIGNATURE);
    expect(VENDOR_SIGNATURES.openai).toBe(OPENAI_SIGNATURE);
    expect(VENDOR_SIGNATURES.google).toBe(GOOGLE_SIGNATURE);
    expect(VENDOR_SIGNATURES.gemini).toBe(GOOGLE_SIGNATURE);
    expect(VENDOR_SIGNATURES.xai).toBe(XAI_SIGNATURE);
    expect(VENDOR_SIGNATURES.grok).toBe(XAI_SIGNATURE);
    expect(VENDOR_SIGNATURES.omp).toBe(OMP_SIGNATURE);
    expect(VENDOR_SIGNATURES.local).toBe(LOCAL_SIGNATURE);
  });
});

describe("Provider Vendor Kinetic Frames - Anti-Jitter & Slot Width Stability", () => {
  const vendors = [
    ANTHROPIC_SIGNATURE,
    OPENAI_SIGNATURE,
    GOOGLE_SIGNATURE,
    XAI_SIGNATURE,
    OMP_SIGNATURE,
    LOCAL_SIGNATURE,
  ];

  test("all kinetic animation frames for every vendor maintain strictly identical reserved slot widths", () => {
    for (const vendor of vendors) {
      const targetWidth = vendor.defaultSlotWidth;

      for (const frame of vendor.frames) {
        const formatted = reserveSlot(frame, targetWidth);
        expect(getStringWidth(formatted)).toBe(targetWidth);
      }

      // Reduced-motion fallback glyph also occupies identical slot width
      const reducedFormatted = reserveSlot(vendor.miniGlyph, targetWidth);
      expect(getStringWidth(reducedFormatted)).toBe(targetWidth);
    }
  });

  test("custom slotWidth overrides scale cleanly without jitter across all vendor frames", () => {
    const wideSlot = 6;
    for (const vendor of vendors) {
      for (const frame of vendor.frames) {
        const formatted = reserveSlot(frame, wideSlot);
        expect(getStringWidth(formatted)).toBe(wideSlot);
      }

      const reduced = reserveSlot(vendor.miniGlyph, wideSlot);
      expect(getStringWidth(reduced)).toBe(wideSlot);
    }
  });
});

describe("ThinkingIndicator - Vendor Dynamic Kinetic Presentation", () => {
  const tm = getThemeManager();
  const theme = tm.getActiveTheme();

  test("getThinkingPresentation animates through vendor kinetic frames with vendor color oscillation", () => {
    const testCases = [
      { vendor: ANTHROPIC_SIGNATURE, expectedFrames: 8, slotWidth: 2 },
      { vendor: OPENAI_SIGNATURE, expectedFrames: 8, slotWidth: 2 },
      { vendor: GOOGLE_SIGNATURE, expectedFrames: 5, slotWidth: 4 },
      { vendor: XAI_SIGNATURE, expectedFrames: 8, slotWidth: 3 },
      { vendor: OMP_SIGNATURE, expectedFrames: 4, slotWidth: 3 },
      { vendor: LOCAL_SIGNATURE, expectedFrames: 6, slotWidth: 2 },
    ];

    for (const { vendor, expectedFrames, slotWidth } of testCases) {
      for (let i = 0; i < expectedFrames; i++) {
        const pres = getThinkingPresentation(
          theme,
          i,
          false,
          "Synthesizing...",
          slotWidth,
          vendor
        );

        expect(pres.symbol).toBe(vendor.frames[i]!);
        expect(getStringWidth(pres.formattedSlot)).toBe(slotWidth);
        expect(isValidHex(pres.symbolColor)).toBe(true);
        expect(pres.label).toBe("Synthesizing...");
      }
    }
  });

  test("getThinkingPresentation resolves vendor dynamically by model string", () => {
    const claudePres = getThinkingPresentation(
      theme,
      0,
      false,
      "Thinking...",
      undefined,
      "claude-3-5-sonnet"
    );
    expect(claudePres.symbol).toBe("✶");
    expect(getStringWidth(claudePres.formattedSlot)).toBe(2);

    const geminiPres = getThinkingPresentation(
      theme,
      0,
      false,
      "Thinking...",
      undefined,
      "gemini-1.5-pro"
    );
    expect(geminiPres.symbol).toBe("✦ ✧");
    expect(getStringWidth(geminiPres.formattedSlot)).toBe(4);

    const grokPres = getThinkingPresentation(
      theme,
      0,
      false,
      "Thinking...",
      undefined,
      "grok-2"
    );
    expect(grokPres.symbol).toBe("／");
    expect(getStringWidth(grokPres.formattedSlot)).toBe(3);
  });

  test("getThinkingPresentation provides static vendor glyph in reduced-motion mode with brand color", () => {
    const testCases = [
      { vendor: ANTHROPIC_SIGNATURE, expectedGlyph: "✶", brandColor: "#D97757", slotWidth: 2 },
      { vendor: OPENAI_SIGNATURE, expectedGlyph: "✢", brandColor: "#10A37F", slotWidth: 2 },
      { vendor: GOOGLE_SIGNATURE, expectedGlyph: "✦", brandColor: "#4E75F6", slotWidth: 4 },
      { vendor: XAI_SIGNATURE, expectedGlyph: "／", brandColor: "#FFFFFF", slotWidth: 3 },
      { vendor: OMP_SIGNATURE, expectedGlyph: "π", brandColor: "#A6A0FF", slotWidth: 3 },
      { vendor: LOCAL_SIGNATURE, expectedGlyph: "◎", brandColor: "#00F0FF", slotWidth: 2 },
    ];

    for (const { vendor, expectedGlyph, brandColor, slotWidth } of testCases) {
      const pres = getThinkingPresentation(
        theme,
        3, // arbitrary frame index
        true, // isReduced
        "Deliberating...",
        slotWidth,
        vendor
      );

      expect(pres.symbol).toBe(expectedGlyph);
      expect(pres.symbolColor).toBe(brandColor);
      expect(getStringWidth(pres.formattedSlot)).toBe(slotWidth);
      expect(pres.label).toBe("Deliberating...");
    }
  });

  test("ThinkingIndicator React element renders box and text nodes with modelId / providerId", () => {
    const element = ThinkingIndicator({
      theme,
      modelId: "claude-3-5-sonnet",
      label: "Synthesizing answer...",
    });

    expect(element).not.toBeNull();
    expect(element?.type).toBe("box");
    expect(element?.props.flexDirection).toBe("row");
    expect(element?.props.children).toBeDefined();

    // Inactive mode returns null (zero render footprint)
    const inactiveElement = ThinkingIndicator({
      theme,
      modelId: "claude-3-5-sonnet",
      active: false,
    });
    expect(inactiveElement).toBeNull();
  });
});

describe("Header - Model Pill & Authentic Vendor Badges", () => {
  test("formatModelPill renders vendor mini glyph when includeVendorGlyph is enabled", () => {
    expect(formatModelPill("claude-3-5-sonnet", false, true)).toBe("[✶ claude-3-5-sonnet (CLOUD)]");
    expect(formatModelPill("openai/gpt-4o", false, true)).toBe("[✢ gpt-4o (CLOUD)]");
    expect(formatModelPill("google/gemini-1.5-pro", false, true)).toBe("[✦ gemini-1.5-pro (CLOUD)]");
    expect(formatModelPill("grok-2", false, true)).toBe("[／ grok-2 (CLOUD)]");
    expect(formatModelPill("omp", false, true)).toBe("[π omp (LOCAL)]");
    expect(formatModelPill("qwen2.5-coder:7b", false, true)).toBe("[◎ qwen2.5 (LOCAL)]");
    expect(formatModelPill("mock", true, true)).toBe("[◎ Mock (LOCAL)]");
  });

  test("formatModelPill maintains legacy output without glyph when includeVendorGlyph is omitted", () => {
    expect(formatModelPill("claude-3-5-sonnet", false)).toBe("[claude-3-5-sonnet (CLOUD)]");
    expect(formatModelPill("openai/gpt-4o", false)).toBe("[gpt-4o (CLOUD)]");
    expect(formatModelPill("qwen2.5-coder:7b", false)).toBe("[qwen2.5 (LOCAL)]");
    expect(formatModelPill("mock", true)).toBe("[Mock (LOCAL)]");
  });

  test("formatModelBadge returns complete vendor metadata and brand color", () => {
    const claudeBadge = formatModelBadge("claude-3-5-sonnet", false);
    expect(claudeBadge.pill).toBe("[✶ claude-3-5-sonnet (CLOUD)]");
    expect(claudeBadge.glyph).toBe("✶");
    expect(claudeBadge.brandColor).toBe("#D97757");
    expect(claudeBadge.vendor.id).toBe("anthropic");

    const openaiBadge = formatModelBadge("openai/gpt-4o", false);
    expect(openaiBadge.pill).toBe("[✢ gpt-4o (CLOUD)]");
    expect(openaiBadge.glyph).toBe("✢");
    expect(openaiBadge.brandColor).toBe("#10A37F");
    expect(openaiBadge.vendor.id).toBe("openai");

    const geminiBadge = formatModelBadge("gemini-1.5-pro", false);
    expect(geminiBadge.pill).toBe("[✦ gemini-1.5-pro (CLOUD)]");
    expect(geminiBadge.glyph).toBe("✦");
    expect(geminiBadge.brandColor).toBe("#4E75F6");
    expect(geminiBadge.vendor.id).toBe("google");

    const grokBadge = formatModelBadge("grok-2", false);
    expect(grokBadge.pill).toBe("[／ grok-2 (CLOUD)]");
    expect(grokBadge.glyph).toBe("／");
    expect(grokBadge.brandColor).toBe("#FFFFFF");
    expect(grokBadge.vendor.id).toBe("xai");

    const ompBadge = formatModelBadge("omp", false);
    expect(ompBadge.pill).toBe("[π omp (LOCAL)]");
    expect(ompBadge.glyph).toBe("π");
    expect(ompBadge.brandColor).toBe("#A6A0FF");
    expect(ompBadge.vendor.id).toBe("omp");

    const localBadge = formatModelBadge("qwen2.5-coder:7b", false);
    expect(localBadge.pill).toBe("[◎ qwen2.5 (LOCAL)]");
    expect(localBadge.glyph).toBe("◎");
    expect(localBadge.brandColor).toBe("#00F0FF");
    expect(localBadge.vendor.id).toBe("local");
  });
});
