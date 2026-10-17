import React, { useMemo } from "react";
import { DynamicIcon, iconNames } from "lucide-react/dynamic";

// Any Lucide icon by its kebab-case name ("party-popper"), loaded on demand so pages don't
// bundle the whole library. Unknown or empty names show `fallback` (a Lucide component).
export const ICON_NAMES = iconNames;
const KNOWN = new Set(iconNames);

export default function LucideIcon({ name, fallback: Fallback = null, size = 16, className = "", ...props }) {
  // hold the icon's space while it loads, so rows don't jump
  const Placeholder = useMemo(() => () => <span aria-hidden="true" className={`inline-block ${className}`} style={{ width: size, height: size }} />, [size, className]);
  if (!name || !KNOWN.has(name)) return Fallback ? <Fallback size={size} className={className} {...props} /> : <Placeholder />;
  return <DynamicIcon name={name} size={size} className={className} fallback={Placeholder} {...props} />;
}
