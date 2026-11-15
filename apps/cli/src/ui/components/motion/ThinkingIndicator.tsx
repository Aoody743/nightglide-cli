import React from "react";
import type { Theme } from "@nightglide/themes";
import {
  THINKING_SPINNER_FRAMES,
  REDUCED_MOTION_SPINNER,
  type MotionMode,
} from "../../motion/constants.js";
import {
  type VendorSignature,
  resolveProviderVendor,
} from "../../motion/vendors.js";
import { useMotionMode } from "../../motion/reducedMotion.js";
import { useSpinner } from "../../motion/hooks.js";
import { oscillateColors } from "../../motion/color.js";
import { reserveSlot } from "../../motion/slots.js";

export interface ThinkingIndicatorProps {
  theme: Theme;
  label?: string;
  slotWidth?: number;
  motionMode?: MotionMode;
  active?: boolean;
  modelId?: string;
  providerId?: string;
  vendor?: VendorSignature;
}

export interface ThinkingStatePresentation {
  symbol: string;
  formattedSlot: string;
  symbolColor: string;
  label: string;
  labelColor: string;
}

/**
 * Pure presentation helper for ANIM-THINK-001.
 * Ensures deterministic rendering, vendor kinetic styling, and slot width stability.
 */
export function getThinkingPresentation(
  theme: Theme,
  frameIndex: number,
  isReduced: boolean,
  label: string = "正在思考...",
  slotWidth?: number,
  vendorOrModel?: VendorSignature | string
): ThinkingStatePresentation {
  const vendor =
    typeof vendorOrModel === "string"
      ? resolveProviderVendor(vendorOrModel)
      : vendorOrModel;

  const effectiveSlotWidth =
    slotWidth !== undefined ? slotWidth : (vendor?.defaultSlotWidth ?? 2);

  if (isReduced) {
    const symbol = vendor?.miniGlyph ?? REDUCED_MOTION_SPINNER;
    return {
      symbol,
      formattedSlot: reserveSlot(symbol, effectiveSlotWidth),
      symbolColor: vendor ? vendor.brandColor : theme.colors.accent,
      label,
      labelColor: theme.colors.textSecondary,
    };
  }

  const frames = vendor?.frames ?? THINKING_SPINNER_FRAMES;
  const safeIndex = frameIndex % frames.length;
  const symbol = frames[safeIndex] ?? frames[0]!;

  const symbolColor = vendor
    ? oscillateColors(
        vendor.secondaryColor ?? theme.colors.textMuted,
        vendor.brandColor,
        safeIndex,
        frames.length
      )
    : oscillateColors(
        theme.colors.textMuted,
        theme.colors.accent,
        safeIndex,
        frames.length
      );

  return {
    symbol,
    formattedSlot: reserveSlot(symbol, effectiveSlotWidth),
    symbolColor,
    label,
    labelColor: theme.colors.textSecondary,
  };
}

/**
 * ANIM-THINK-001: Celestial Pulse Thinking Indicator
 *
 * Renders a fixed-width rotating spinner at 10 FPS with sinusoidal color oscillation.
 * When a vendor (modelId or providerId) is specified, uses the vendor's signature
 * frames and brand colors (e.g. Claude terracotta pulse, OpenAI rosette, Gemini constellation).
 *
 * When motion is "off" or "reduced":
 * - Displays static vendor mini glyph or "✦" indicator.
 * - Starts zero interval timers (zero CPU consumption).
 */
export function ThinkingIndicator({
  theme,
  label = "正在思考...",
  slotWidth,
  motionMode,
  active = true,
  modelId,
  providerId,
  vendor,
}: ThinkingIndicatorProps) {
  const vendorSignature =
    vendor ??
    (modelId || providerId
      ? resolveProviderVendor(modelId || providerId)
      : undefined);

  const effectiveSlotWidth =
    slotWidth !== undefined
      ? slotWidth
      : (vendorSignature?.defaultSlotWidth ?? 2);

  const { isReduced } = useMotionMode(motionMode);
  const { frameIndex } = useSpinner({
    fps: 10,
    active,
    motionMode,
    frames: vendorSignature?.frames,
    slotWidth: effectiveSlotWidth,
  });

  const presentation = getThinkingPresentation(
    theme,
    frameIndex,
    isReduced || !active,
    label,
    effectiveSlotWidth,
    vendorSignature
  );

  if (!active) {
    return null;
  }

  return (
    <box flexDirection="row" alignItems="center">
      <text fg={presentation.symbolColor}>{presentation.formattedSlot}</text>
      <text fg={presentation.labelColor}>{presentation.label}</text>
    </box>
  );
}

