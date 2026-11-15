import React, { useState } from "react";
import type { ToolCardProps } from "./toolTypes.js";
import { CompactToolCard } from "./CompactToolCard.js";
import { ExpandedToolCard } from "./ExpandedToolCard.js";

/**
 * Universal Native Tool Card component.
 * Automatically delegates to Compact or Expanded representations based on mode,
 * and allows interactive toggle between them.
 */
export function ToolCard(props: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(props.mode === "expanded");

  const effectiveMode = props.mode !== undefined ? props.mode : isExpanded ? "expanded" : "compact";

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
    if (props.onToggleExpand) {
      props.onToggleExpand();
    }
  };

  if (effectiveMode === "compact") {
    return <CompactToolCard {...props} onToggleExpand={handleToggle} />;
  }

  return <ExpandedToolCard {...props} onToggleExpand={handleToggle} />;
}
