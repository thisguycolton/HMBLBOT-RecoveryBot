import React, { useEffect, useState } from "react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { Icon } from "lucide-react";

// Any Lucide icon by its kebab-case name ("party-popper"), loaded on demand so pages don't
// bundle the whole library. Unknown or empty names, and icons that can't be loaded, show
// `fallback` (a Lucide component).
export const ICON_NAMES = Object.keys(dynamicIconImports);
const KNOWN = new Set(ICON_NAMES);

// name -> the icon's drawing, once loaded, so every later use draws right away
const loaded = new Map();
// name -> the load in flight, shared by everyone waiting on the same icon
const loading = new Map();

function loadIcon(name) {
  if (!loading.has(name)) {
    const load = dynamicIconImports[name]()
      .then((mod) => {
        loaded.set(name, mod.__iconNode);
        return mod.__iconNode;
      })
      .catch((error) => {
        loading.delete(name); // forget the failure, so a later page can try again
        throw error;
      });
    loading.set(name, load);
  }
  return loading.get(name);
}

export default function LucideIcon({ name, fallback: Fallback = null, size = 16, className = "", ...props }) {
  const known = !!name && KNOWN.has(name);
  const node = known ? loaded.get(name) : undefined;
  const [, redraw] = useState(0);
  const [failed, setFailed] = useState(null); // the name that couldn't be loaded

  useEffect(() => {
    if (!known || loaded.has(name)) return undefined;
    let live = true;
    loadIcon(name).then(
      () => live && redraw((n) => n + 1),
      (error) => {
        console.warn(`[LucideIcon] couldn't load "${name}"`, error);
        if (live) setFailed(name);
      },
    );
    return () => { live = false; };
  }, [name, known]);

  if (node) return <Icon iconNode={node} size={size} className={className} {...props} />;
  if ((!known || failed === name) && Fallback) return <Fallback size={size} className={className} {...props} />;
  // hold the icon's space while it loads, so rows don't jump
  return <span aria-hidden="true" className={`inline-block ${className}`} style={{ width: size, height: size }} />;
}
