import React, { useEffect, useState } from "react";
import { BellOff, BellRing, Check, Laptop, Send, Smartphone, X } from "lucide-react";
import Toggle from "../ui/Toggle";
import { api } from "../groups/lib";
import { Card, ErrorNote, Pill, Tray, quietButton } from "../groups/ui";
import { currentSubscription, needsInstallForPush, platform, pushSupported, turnOffPush, turnOnPush } from "../../lib/push";

// Where to unblock notifications once they've been turned down
const UNBLOCK = {
  ios: "Open the Settings app, tap Notifications, find RecoveryBot and allow notifications.",
  android: "Tap the icon left of the address (or long-press the RecoveryBot icon and pick App info), open Notifications and allow them.",
  mac: "In Safari, open Settings > Websites > Notifications; in Chrome, click the icon left of the address. Allow RecoveryBot.",
  windows: "Click the icon left of the address, open Site settings and allow Notifications.",
  other: "Open this site's settings in your browser (usually the icon left of the address) and allow notifications.",
};

const DeviceIcon = ({ label }) => (/iPhone|iPad|Android/.test(label) ? <Smartphone className="h-4 w-4 shrink-0 text-slate-400" /> : <Laptop className="h-4 w-4 shrink-0 text-slate-400" />);

// Account settings > Notifications on this device (also on /install once the app is on the
// home screen): turn Web Push on or off for this browser, send a test, pick which kinds of
// notification are pushed (to all their devices), and remove other devices.
// Hidden when the server has no VAPID keys (WebPushSender.configured?).
export default function PushSettings({ bare = false }) {
  const [state, setState] = useState(null); // { available, public_key, devices }
  const [endpoint, setEndpoint] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [tested, setTested] = useState(false);
  const [permission, setPermission] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "default"));

  useEffect(() => {
    (async () => {
      const sub = await currentSubscription().catch(() => null);
      setEndpoint(sub?.endpoint || null);
      const q = sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : "";
      setState(await api(`/push_subscriptions${q}`));
    })().catch((e) => setError(e.message));
  }, []);

  if (!state) return error ? <ErrorNote error={error} /> : null;
  if (!state.available) return null;

  const here = state.devices.find((d) => d.this_device);
  const others = state.devices.filter((d) => !d.this_device);

  const toggle = async (on) => {
    setBusy("toggle");
    setError(null);
    setTested(false);
    try {
      if (on) {
        const next = await turnOnPush(state.public_key);
        const sub = await currentSubscription();
        setEndpoint(sub?.endpoint || null);
        setState(next);
      } else {
        const next = await turnOffPush();
        setEndpoint(null);
        if (next) setState(next);
      }
    } catch (e) {
      if (e.code === "denied") setPermission("denied");
      else if (e.code === "default") setError("Notifications weren't allowed. Try again and pick Allow.");
      // The browser itself couldn't reach its push service (Brave, for one, has it off until "Use Google services for push messaging" is on)
      else if (["NotAllowedError", "AbortError", "InvalidStateError"].includes(e.name)) setError("This browser couldn't set up notifications. If you use Brave, turn on “Use Google services for push messaging” in its settings; otherwise try Chrome, Edge, Firefox or Safari.");
      else setError(e.message);
    } finally {
      setBusy(null);
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
    }
  };

  const test = async () => {
    setBusy("test");
    setError(null);
    try {
      await api("/push_subscriptions/test", { method: "POST", body: { endpoint } });
      setTested(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  // Optimistic, so the switch moves right away; put back if the save fails
  const setCategory = async (key, on) => {
    setError(null);
    setState((s) => ({ ...s, categories: s.categories.map((c) => (c.key === key ? { ...c, on } : c)) }));
    try {
      setState(await api(`/push_subscriptions/categories${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ""}`, { method: "PATCH", body: { key, on } }));
    } catch (e) {
      setState((s) => ({ ...s, categories: s.categories.map((c) => (c.key === key ? { ...c, on: !on } : c)) }));
      setError(e.message);
    }
  };

  const remove = async (id) => {
    setBusy(`remove-${id}`);
    try {
      setState(await api(`/push_subscriptions/${id}${endpoint ? `?current_endpoint=${encodeURIComponent(endpoint)}` : ""}`, { method: "DELETE" }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  let body;
  if (needsInstallForPush()) {
    body = (
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <p className="text-sm text-slate-700 dark:text-neutral-300">
          On iPhone and iPad, notifications work once RecoveryBot is on your Home Screen. Add it, open it from there, and turn them on here.
          {!bare && <>{" "}<a href="/install" className="font-medium text-accent hover:underline">Show me how</a></>}
        </p>
      </div>
    );
  } else if (!pushSupported()) {
    body = <p className="text-sm text-slate-600 dark:text-neutral-400">This browser can't show notifications. Chrome, Edge, Firefox and Safari can.</p>;
  } else if (permission === "denied" && !here) {
    body = (
      <div className="flex items-start gap-3">
        <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-sm text-slate-700 dark:text-neutral-300">
          <p className="font-medium">Notifications are blocked for RecoveryBot on this device.</p>
          <p className="mt-1 text-slate-600 dark:text-neutral-400">{UNBLOCK[platform()]} Then come back and reload this page.</p>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        <Toggle checked={Boolean(here)} disabled={busy === "toggle"} onChange={toggle}
          label={<span className="inline-flex items-center gap-2">Send notifications to this device {busy === "toggle" && <span className="text-xs text-slate-400">…</span>}</span>}
          description="What shows in the bell (group news, replies to your notes, host reminders) pops up here too, even with RecoveryBot closed." />
        {here && (
          <div className="flex flex-wrap items-center gap-3 pl-12">
            <button type="button" className={quietButton} onClick={test} disabled={busy === "test"}>
              <Send className="h-4 w-4" /> {busy === "test" ? "Sending…" : "Send a test"}
            </button>
            {tested && <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" /> Sent. It should show in a few seconds.</span>}
          </div>
        )}
      </div>
    );
  }

  const content = (
    <Card className="space-y-4 p-4">
      {body}
      <ErrorNote error={error} />
      {state.devices.length > 0 && state.categories?.length > 0 && (
        <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">What to send</p>
          <p className="mb-3 text-xs text-slate-500 dark:text-neutral-400">For all your devices. What you turn off still shows in the bell.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {state.categories.map((c) => (
              <Toggle key={c.key} checked={c.on} onChange={(on) => setCategory(c.key, on)} label={c.label} description={c.description} />
            ))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Your other devices</p>
          <ul className="space-y-1">
            {others.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm">
                <DeviceIcon label={d.label} />
                <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-neutral-200">{d.label}</span>
                <span className="hidden text-xs text-slate-400 sm:inline">since {new Date(d.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                <button type="button" onClick={() => remove(d.id)} disabled={busy === `remove-${d.id}`} aria-label={`Stop notifications to ${d.label}`} title="Stop notifications there"
                  className="rounded-lg !bg-transparent p-1 text-slate-400 hover:!bg-neutral-100 hover:text-rose-600 dark:hover:!bg-neutral-800">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );

  if (bare) return content;
  return (
    <section id="notifications" className="scroll-mt-20">
      <Tray label="Notifications on this device" action={here ? <Pill tone="green"><BellRing className="h-3 w-3" />On</Pill> : null}>
        {content}
      </Tray>
    </section>
  );
}
