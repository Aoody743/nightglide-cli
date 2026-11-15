import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import type { MotionMode } from "./constants.js";

/**
 * Checks whether React has an active rendering dispatcher mounted.
 * Allows safe execution in headless test runners and non-React environments.
 */
export function hasReactDispatcher(): boolean {
  try {
    return (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?.H != null;
  } catch {
    return false;
  }
}

/**
 * Checks whether the specified motion mode constitutes reduced motion.
 * - "off" or "reduced": strictly reduced motion (0ms animation, zero timers, static fallbacks).
 * - "auto": enables motion unless terminal environment signals reduced motion (e.g. NO_COLOR or NIGHTGLIDE_REDUCED_MOTION).
 */
export function isReducedMotion(mode?: MotionMode): boolean {
  if (mode === "off" || mode === "reduced") {
    return true;
  }
  if (mode === "auto" || mode === undefined) {
    if (typeof process !== "undefined" && process?.env) {
      if (
        process.env.NIGHTGLIDE_REDUCED_MOTION === "1" ||
        process.env.NIGHTGLIDE_NO_MOTION === "1"
      ) {
        return true;
      }
    }
    return false;
  }
  return false;
}

export interface MotionContextValue {
  readonly motionMode: MotionMode;
  readonly isReduced: boolean;
}

export const MotionContext = createContext<MotionContextValue>({
  motionMode: "auto",
  isReduced: false,
});

export interface MotionProviderProps {
  mode?: MotionMode;
  children: ReactNode;
}

/**
 * React Provider distributing global motion preferences throughout the terminal UI tree.
 */
export function MotionProvider({ mode = "auto", children }: MotionProviderProps) {
  const value = useMemo<MotionContextValue>(() => {
    return {
      motionMode: mode,
      isReduced: isReducedMotion(mode),
    };
  }, [mode]);

  return React.createElement(MotionContext.Provider, { value }, children);
}

/**
 * Hook to access current motion settings, supporting optional per-component overrides.
 */
export function useMotionMode(overrideMode?: MotionMode): MotionContextValue {
  if (overrideMode !== undefined || !hasReactDispatcher()) {
    const effectiveMode = overrideMode ?? "auto";
    return {
      motionMode: effectiveMode,
      isReduced: isReducedMotion(effectiveMode),
    };
  }
  const ctx = useContext(MotionContext);
  const effectiveMode = ctx.motionMode;
  return {
    motionMode: effectiveMode,
    isReduced: isReducedMotion(effectiveMode),
  };
}
