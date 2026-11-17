import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { api } from "../lib";
import { Card, primaryButton } from "../ui";
import { STEPS, setupProgress } from "./SetupGuide";

// On the group page, for its admins until the setup guide is finished or put away
export default function SetupBanner({ group, setGroup }) {
  const [hiding, setHiding] = useState(false);
  if (!group.can_manage || !group.setup || group.setup.finished_at) return null;
  const done = setupProgress(group);
  const hide = async () => {
    setHiding(true);
    try {
      const setup = await api(`/groups/${group.slug}/setup`, { method: "POST", body: { finished: true } });
      setGroup((g) => ({ ...g, setup }));
    } catch { setHiding(false); }
  };
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent dark:bg-accent/25 dark:text-white"><Sparkles className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{done === 0 ? `Set up ${group.title}` : `Finish setting up ${group.title}`}</p>
        <p className="text-xs text-slate-500 dark:text-neutral-400">Meetings, offices and inviting the group, a step at a time. {done} of {STEPS.length} done.</p>
      </div>
      <Link to={`/${group.slug}/setup`} className={primaryButton}>{done === 0 ? "Start" : "Continue"} <ArrowRight className="size-4" /></Link>
      <button type="button" disabled={hiding} onClick={hide} aria-label="Hide the setup guide" title="Hide (it stays in Manage)"
        className="grid size-9 place-items-center rounded-xl !bg-transparent text-slate-400 hover:!bg-neutral-100 hover:text-slate-600 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
    </Card>
  );
}
