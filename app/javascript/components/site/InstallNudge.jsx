import React, { useState } from "react";
import { ArrowRight, Smartphone, X } from "lucide-react";
import { isStandalone, platform } from "../../lib/push";

const KEY = "installNudge.dismissed";

// "Add RecoveryBot to your home screen": on the home feed, for phones and tablets viewing it in
// the browser. Dismissing it is remembered on this device.
export default function InstallNudge() {
  const [shown, setShown] = useState(() => {
    if (!["ios", "android"].includes(platform()) || isStandalone()) return false;
    try { return !localStorage.getItem(KEY); } catch { return true; }
  });
  if (!shown) return null;

  const dismiss = () => {
    setShown(false);
    try { localStorage.setItem(KEY, "1"); } catch {}
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-panel dark:bg-neutral-800/70">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent dark:bg-accent/25 dark:text-sky-200"><Smartphone className="h-4 w-4" /></span>
      <a href="/install" className="min-w-0 flex-1 !no-underline">
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">Add RecoveryBot to your home screen</span>
        <span className="block text-xs text-slate-500 dark:text-neutral-400">It opens like an app and can send you notifications.</span>
      </a>
      <a href="/install" className="shrink-0 text-accent" aria-label="Show me how"><ArrowRight className="h-4 w-4" /></a>
      <button type="button" onClick={dismiss} className="shrink-0 !bg-transparent p-1 text-slate-400 hover:text-slate-700" aria-label="Not now">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
