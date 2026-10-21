import React, { useEffect, useState } from "react";
import { Bell, CheckCircle2, Download, EllipsisVertical, Laptop, MonitorDown, Share, Smartphone, SquarePlus, Tablet } from "lucide-react";
import PushSettings from "../profile/PushSettings";
import { getInstallPrompt, isStandalone, needsInstallForPush, onInstallPrompt, platform } from "../../lib/push";

// How to put RecoveryBot on your home screen and turn on notifications (/install,
// InstallController). Opens on the steps for the device it's viewed on.
const TABS = [
  { key: "ios", label: "iPhone & iPad", icon: Tablet },
  { key: "android", label: "Android", icon: Smartphone },
  { key: "computer", label: "Computer", icon: Laptop },
];

const STEPS = {
  ios: {
    intro: "Use Safari (on iOS 16.4 or later, Chrome and Edge work too).",
    steps: [
      [Share, <>Tap the <strong>Share</strong> button: the square with an arrow, at the bottom of the screen on iPhone or at the top on iPad. If you only see <strong>•••</strong>, tap that first, then Share.</>],
      [SquarePlus, <>Scroll down the list and tap <strong>Add to Home Screen</strong>.</>],
      [CheckCircle2, <>Leave <strong>Open as Web App</strong> on if you see it, and tap <strong>Add</strong>. RecoveryBot is now on your Home Screen.</>],
      [Bell, <>Open RecoveryBot from the Home Screen, sign in, and turn on notifications below. iPhone and iPad only show notifications for sites added this way.</>],
    ],
  },
  android: {
    intro: "Use Chrome (Samsung Internet, Edge and Firefox work too).",
    steps: [
      [EllipsisVertical, <>Tap the <strong>⋮</strong> menu at the top right. In Samsung Internet it's <strong>≡</strong> at the bottom.</>],
      [Download, <>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>, then <strong>Install</strong>. In Samsung Internet: <strong>Add page to</strong> &gt; <strong>Home screen</strong>.</>],
      [CheckCircle2, <>RecoveryBot shows up on your home screen and in your apps, and opens without the browser bars.</>],
      [Bell, <>Open it, sign in, and turn on notifications below.</>],
    ],
  },
  computer: {
    intro: "Chrome and Edge install it as its own window; Safari on a Mac adds it to the Dock.",
    steps: [
      [MonitorDown, <><strong>Chrome or Edge:</strong> click the install icon at the right end of the address bar (a screen with an arrow). Or open the menu: Chrome's <strong>Cast, save and share</strong> &gt; <strong>Install page as app</strong>, Edge's <strong>Apps</strong> &gt; <strong>Install this site as an app</strong>.</>],
      [SquarePlus, <><strong>Safari on a Mac</strong> (macOS Sonoma or later): <strong>File</strong> &gt; <strong>Add to Dock</strong>.</>],
      [Bell, <><strong>Firefox</strong> doesn't install sites, but notifications work in a normal tab. Turn them on below.</>],
    ],
  },
};

const tabFor = (p) => (p === "ios" || p === "android" ? p : "computer");

export default function InstallPage({ push = false }) {
  const [tab, setTab] = useState(() => tabFor(platform()));
  const [prompt, setPrompt] = useState(() => getInstallPrompt());
  const [installed, setInstalled] = useState(() => isStandalone());
  const signedIn = document.body.dataset.currentUser === "true";

  useEffect(() => onInstallPrompt((e) => { setPrompt(e); if (!e) setInstalled(true); }), []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  const { intro, steps } = STEPS[tab];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 px-4 py-10 !font-sans dark:bg-neutral-950 sm:py-14 [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-tint text-accent dark:bg-accent/30 dark:text-white">
            <Smartphone className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div>
            <h1 className="!m-0 !text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:!text-3xl">Get the RecoveryBot app</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-neutral-400">
              Add RecoveryBot to your home screen and it opens like an app, full screen, and can send you notifications. Nothing to download from an app store.
            </p>
          </div>
        </header>

        {installed ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> You're using the RecoveryBot app.
          </p>
        ) : prompt ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-panel dark:bg-neutral-900">
            <p className="text-sm text-slate-700 dark:text-neutral-300">Your browser can install it in one step.</p>
            <button type="button" onClick={install} className="inline-flex items-center gap-1.5 rounded-xl !bg-accent px-3.5 py-2 text-sm font-semibold !text-white hover:opacity-90">
              <Download className="h-4 w-4" /> Install RecoveryBot
            </button>
          </div>
        ) : null}

        <section>
          <div role="tablist" aria-label="Your device" className="mb-3 inline-flex rounded-xl bg-white p-1 shadow-panel dark:bg-neutral-900">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${tab === key ? "!bg-accent/10 text-accent dark:!bg-accent/25 dark:text-white" : "!bg-transparent text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="rounded-xl bg-white p-5 shadow-panel dark:bg-neutral-900">
            <p className="mb-4 text-sm text-slate-500 dark:text-neutral-400">{intro}</p>
            <ol className="!m-0 list-none space-y-4 !p-0">
              {steps.map(([Icon, text], i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent dark:bg-accent/25 dark:text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="!m-0 pt-1 text-sm leading-relaxed text-slate-700 dark:text-neutral-300">
                    <span className="mr-1 font-semibold text-slate-900 dark:text-white">{i + 1}.</span>{text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="notifications" className="scroll-mt-20 space-y-3">
          <h2 className="!m-0 flex items-center gap-2 !text-lg font-semibold text-slate-900 dark:text-white"><Bell className="h-5 w-5 text-accent" /> Notifications</h2>
          <p className="text-sm text-slate-600 dark:text-neutral-400">
            Get what shows in the bell (group news, replies to your notes, host reminders) on your phone or computer, even with RecoveryBot closed.
            Turn it on for each device you use, and off any time.
          </p>
          {!push ? (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-panel dark:bg-neutral-900 dark:text-neutral-400">Notifications aren't switched on for the site yet. Check back soon.</p>
          ) : !signedIn ? (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-700 shadow-panel dark:bg-neutral-900 dark:text-neutral-300">
              <a href="/users/sign_in" className="font-medium text-accent hover:underline">Sign in</a>
              {needsInstallForPush() ? " from the RecoveryBot app on your Home Screen" : ""}, then come back here or open <strong>Profile &amp; account</strong> to turn them on.
            </p>
          ) : (
            <PushSettings bare />
          )}
        </section>
      </div>
    </div>
  );
}
