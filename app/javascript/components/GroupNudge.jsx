import React, { useState } from "react";
import { ArrowRight, Users, X } from "lucide-react";

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

// "You're not in a group yet": shown on the home page to signed-in people Groups is open
// to who aren't in one (User#needs_group?). Dismissing it keeps it away for 30 days.
export default function GroupNudge() {
  const [shown, setShown] = useState(document.body.dataset.needsGroup === "true");
  if (!shown) return null;

  const dismiss = () => {
    setShown(false);
    fetch("/api/groups/dismiss_prompt", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": csrfToken() } });
  };

  return (
    <div className="border-b border-sky-100 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-600 text-white"><Users className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="sans !text-left font-semibold text-slate-900 dark:text-white">You're not in a group yet</p>
          <p className="sans !text-left !hyphens-none text-sm text-slate-600 dark:text-neutral-300">
            Find your home group to see its meetings, readings and the people in it.
          </p>
        </div>
        <a href="/groups/find" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-700 px-3.5 py-2 text-sm font-semibold !text-white hover:bg-sky-800">
          Find your group <ArrowRight className="h-4 w-4" />
        </a>
        <button type="button" onClick={dismiss} className="!bg-transparent p-1 text-slate-400 hover:text-slate-700" aria-label="Not now">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
