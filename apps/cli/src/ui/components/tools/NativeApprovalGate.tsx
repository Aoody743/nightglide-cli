import React from "react";
import {
  ApprovalPromptView,
  type ApprovalPromptViewProps,
  handleApprovalKey,
} from "./ApprovalPromptView.js";

export type NativeApprovalGateProps = ApprovalPromptViewProps;

/**
 * NativeApprovalGate is the canonical approval gate UI component for OMP tool calls.
 * Displays approval requirements, diff previews, and handles keyboard permissions.
 */
export function NativeApprovalGate(props: NativeApprovalGateProps) {
  return <ApprovalPromptView {...props} />;
}

export { handleApprovalKey };
