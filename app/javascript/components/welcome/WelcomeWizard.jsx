import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, BellRing, Check, Compass, PartyPopper, Sparkles, UserPlus } from "lucide-react";
import { api } from "../groups/lib";
import { primaryButton, quietButton } from "../groups/ui";
import GroupStep from "./GroupStep";
import Tour from "./Tour";

// The welcome wizard (/welcome): a new account's first stop after signing in. 1) Find your
// group (groups here first; AA Intergroup listings with no group here can be followed or
// started), 2) "You're all set", with an optional short tour of what people do most. Every
// screen can be skipped; finishing or skipping marks the account done (POST /api/welcome/finish)
// and goes on to `next` (where they were headed, or the home page).
// Each screen is a history entry, so the browser's and Android's back button step back.
export default function WelcomeWizard({ name, first_time: firstTime = true, start = "group", groups_open: groupsOpen, next = "/people", my_groups: myGroups = [] }) {
  const first = start === "tour" ? "tour" : groupsOpen ? "group" : "done";
  const [step, setStep] = useState(first);
  const [done, setDone] = useState({ joined: [], followed: [], started: [] });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    window.history.replaceState({ ...window.history.state, welcome: first }, "");
    const onPop = (e) => setStep(e.state?.welcome || first);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [first]);

  const go = (to) => {
    window.history.pushState({ ...window.history.state, welcome: to }, "");
    setStep(to);
    window.scrollTo({ top: 0 });
  };

  // Done or skipped: it won't come back by itself, then on to where they were headed
  const finish = useCallback(async (to = next) => {
    setLeaving(true);
    await api("/welcome/finish", { method: "POST" }).catch(() => {});
    window.location.href = to;
  }, [next]);

  const record = useCallback((kind, item) => setDone((d) => ({ ...d, [kind]: [...d[kind].filter((x) => x.slug !== item.slug), item] })), []);
  const unrecord = useCallback((kind, slug) => setDone((d) => ({ ...d, [kind]: d[kind].filter((x) => x.slug !== slug) })), []);

  const steps = groupsOpen && start !== "tour" ? ["group", "done"] : [];
  const index = steps.indexOf(step);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-var(--nav-h))] max-w-2xl flex-col px-4 pb-6 pt-4 !font-sans sm:px-6 sm:pt-8 [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      {step !== "tour" && (
        <div className="mb-5 flex items-center gap-3">
          {index >= 0 && (
            <div className="flex flex-1 items-center gap-1.5" aria-label={`Step ${index + 1} of ${steps.length}`}>
              {steps.map((s, i) => (
                <span key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= index ? "bg-accent" : "bg-neutral-200 dark:bg-neutral-800"}`} />
              ))}
            </div>
          )}
          <span className="flex-1" />
          <button type="button" onClick={() => finish()} disabled={leaving} className="!bg-transparent px-1 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white">
            {firstTime ? "Skip" : "Close"}
          </button>
        </div>
      )}

      {step === "group" && (
        <GroupStep name={name} myGroups={myGroups} done={done} record={record} unrecord={unrecord} onNext={() => go("done")} />
      )}
      {step === "done" && (
        <DoneStep name={name} groupsOpen={groupsOpen} done={done} myGroups={myGroups} leaving={leaving}
          onTour={() => go("tour")} onHome={() => finish()} />
      )}
      {step === "tour" && <Tour groupsOpen={groupsOpen} leaving={leaving} onFinish={finish} />}
    </div>
  );
}

// "You're all set": what they did on the group step, then the tour or straight home
function DoneStep({ name, groupsOpen, done, myGroups, leaving, onTour, onHome }) {
  const lines = [
    ...done.joined.map((g) => ({ icon: UserPlus, key: `j-${g.slug}`, text: <>You asked to join <b>{g.title}</b>. One of its admins lets you in, and you'll get a notification.</> })),
    ...done.followed.map((g) => ({ icon: BellRing, key: `f-${g.slug}`, text: <>You're following <b>{g.name}</b>. We'll tell you when it comes to RecoveryBot.</> })),
    ...done.started.map((g) => ({ icon: Sparkles, key: `s-${g.slug}`, text: <>You started <b>{g.title}</b>. Once a site admin approves it, you're its admin and can invite the group.</> })),
  ];
  const inGroup = myGroups.some((g) => g.status === "active");
  const nothing = lines.length === 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-accent-tint text-accent dark:bg-accent/30 dark:text-white">
          {nothing ? <PartyPopper className="size-8" /> : <Check className="size-8" strokeWidth={2.5} />}
        </span>
        <h1 className="!mt-4 !text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:!text-3xl">
          {nothing ? `Glad you're here${name ? `, ${name}` : ""}` : "You're all set"}
        </h1>
        <div className="mx-auto mt-2 max-w-md text-center text-slate-600 dark:text-neutral-300">
          {nothing && groupsOpen && !inGroup
            ? "No group yet? That's fine. You can find yours any time from Groups in the menu."
            : "RecoveryBot is yours to use however helps: your day count, the literature, your group and the people in it."}
        </div>
      </div>

      {lines.length > 0 && (
        <ul className="!mx-0 mt-6 space-y-2 !p-0">
          {lines.map(({ icon: Icon, key, text }) => (
            <li key={key} className="flex list-none gap-3 rounded-2xl bg-neutral-100 p-3 text-sm text-slate-700 dark:bg-neutral-800/70 dark:text-neutral-200">
              <Icon className="mt-0.5 size-4 shrink-0 text-accent dark:text-sky-300" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 rounded-3xl bg-gradient-to-br from-sky-100 to-sky-50 p-5 dark:from-sky-950/60 dark:to-neutral-900 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-accent shadow-panel dark:bg-neutral-900 dark:text-sky-300">
            <Compass className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="!text-lg font-semibold text-slate-900 dark:text-white">Want a quick tour?</h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-neutral-300">A minute on the things people do most here. You can skip it.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onTour} disabled={leaving} className={`${primaryButton} flex-1 py-2.5`}>
            Show me around <ArrowRight className="size-4" />
          </button>
          <button type="button" onClick={onHome} disabled={leaving} className={`${quietButton} flex-1 py-2.5`}>
            {leaving ? "Opening…" : "Skip, take me home"}
          </button>
        </div>
      </div>
    </div>
  );
}
