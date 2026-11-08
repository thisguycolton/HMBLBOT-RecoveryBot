import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clapperboard, ExternalLink, Link2, Send, Unplug } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { Badge, shortDate } from "./UsersPage";
import Skeleton from "../ui/Skeleton";

const ZONES = ["America/Phoenix", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "Pacific/Honolulu", "America/Anchorage"];
const LOOK_LABELS = { paper: "Paper", marker: "Marker", night: "Night", sunrise: "Sunrise" };
const STATUS = {
  posted: { label: "Posted", tone: null },
  partial: { label: "Partly posted", tone: "warn" },
  failed: { label: "Didn't post", tone: "warn" },
};

// "6:00 AM" from "06:00"
const clock = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};
const when = (iso, zone) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: zone });

// The day's Daily Reflection posted to the RecoveryBot Facebook Page (and its Instagram) as a
// Story every morning (DailyStory): the Share this day video at the fastest pace, in clips of
// under a minute. Connect the Page with Facebook's sign-in (or paste a Page token), pick the
// time and look, and see how the last posts went.
export default function DailyStoryPage({ notify }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  async function load() {
    try {
      setData(await api("/daily_story"));
    } catch (e) {
      notify(e.message, "error");
    }
  }

  useEffect(() => {
    // Back from Facebook's sign-in: say how it went, then tidy the address
    const q = new URLSearchParams(window.location.search);
    if (q.get("connected")) notify("Facebook Page connected.");
    if (q.get("choose")) notify("That account manages several Pages. Pick the one to post to.");
    if (q.get("error")) notify(q.get("error"), "error");
    if ([...q.keys()].length) window.history.replaceState(null, "", window.location.pathname);
    load();
  }, []);

  // While a post is going, check back every few seconds
  useEffect(() => {
    if (!data?.connection.posting) return undefined;
    const timer = setTimeout(load, 5000);
    return () => clearTimeout(timer);
  }, [data]);

  async function act(name, path, options, message) {
    setBusy(name);
    try {
      setData(await api(path, options));
      if (message) notify(message);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  const save = (changes, message = "Saved.") => act("save", "/daily_story", { method: "PATCH", body: changes }, message);

  if (!data) {
    return (
      <Shell>
        <ShellBand icon={Clapperboard} title="Daily story" subtitle="Loading…" />
        <ShellPanel position="bottom" className="p-5 space-y-3"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-24" /></ShellPanel>
      </Shell>
    );
  }

  const c = data.connection;
  const subtitle = !c.connected
    ? "Not connected to a Facebook Page yet"
    : c.enabled
      ? `Posts every day at ${clock(c.post_at)} (${c.time_zone.replace("_", " ")})`
      : "Connected, turned off";

  return (
    <div className="space-y-6 !font-sans [&_*]:!font-sans">
      <Shell>
        <ShellBand icon={Clapperboard} title="Daily story" subtitle={subtitle} />
        <ShellPanel position="bottom" className="p-5 sm:p-6 space-y-5">
          <p className="text-sm text-slate-600 dark:text-neutral-300">
            Each morning the day's Daily Reflection goes to the RecoveryBot Facebook Page as a Story: the Share this day video at the fastest
            pace, in clips of under a minute. Nothing about members is sent.
          </p>
          {!c.app_configured && <SetupNote callbackUrl={data.callback_url} />}
          {c.choices.length > 0 && <ChoosePage choices={c.choices} busy={busy} act={act} />}
          {c.connected ? (
            <Connected c={c} data={data} busy={busy} act={act} save={save} />
          ) : (
            <Connect appConfigured={c.app_configured} busy={busy} act={act} />
          )}
        </ShellPanel>
      </Shell>
      {data.posts.length > 0 && <History posts={data.posts} zone={c.time_zone} />}
    </div>
  );
}

function SetupNote({ callbackUrl }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-100">
      <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Set up the Meta app first</div>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Make an app at <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="underline">developers.facebook.com</a> (the "Manage everything on your Page" use case, or a Business app with Facebook Login for Business).</li>
        <li>Add this as a valid OAuth redirect address: <code className="break-all">{callbackUrl}</code></li>
        <li>Put its FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in CapRover, and restart.</li>
      </ol>
      <p className="mt-2">Or paste a Page token below without setting up sign-in.</p>
    </div>
  );
}

function Connect({ appConfigured, busy, act }) {
  const [instagram, setInstagram] = useState(true);
  const [token, setToken] = useState("");
  return (
    <div className="space-y-4">
      {appConfigured && (
        <div className="flex flex-wrap items-center gap-4">
          <a href={`/admin_panel/facebook/connect${instagram ? "?instagram=1" : ""}`} className={buttonClass.primary}>
            <Link2 className="size-4" /> Connect Facebook Page
          </a>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-300">
            <input type="checkbox" checked={instagram} onChange={(e) => setInstagram(e.target.checked)} />
            Also ask for Instagram
          </label>
        </div>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-slate-600 dark:text-neutral-400">Paste a Page token instead</summary>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            act("token", "/daily_story/token", { method: "POST", body: { token } }, "Facebook Page connected.");
          }}
        >
          <input className={`${inputClass} flex-1 min-w-[16rem]`} value={token} onChange={(e) => setToken(e.target.value)} placeholder="EAAB…" autoComplete="off" />
          <button type="submit" className={buttonClass.secondary} disabled={!token.trim() || busy === "token"}>Connect</button>
        </form>
      </details>
    </div>
  );
}

function ChoosePage({ choices, busy, act }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-neutral-800">
      <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Which Page should the story go to?</div>
      <div className="flex flex-wrap gap-2">
        {choices.map((p) => (
          <button key={p.id} type="button" className={buttonClass.secondary} disabled={busy === "choose"}
            onClick={() => act("choose", "/daily_story/choose", { method: "POST", body: { page_id: p.id } }, `Posting to ${p.name}.`)}>
            {p.name}{p.instagram_username ? ` (+ @${p.instagram_username})` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function Connected({ c, data, busy, act, save }) {
  const [postAt, setPostAt] = useState(c.post_at);
  useEffect(() => setPostAt(c.post_at), [c.post_at]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-neutral-800/60">
        <CheckCircle2 className="size-5 text-emerald-600" />
        <div className="flex-1 min-w-0 text-sm">
          <div className="font-semibold text-slate-900 dark:text-white">
            <a href={`https://www.facebook.com/${c.page_id}`} target="_blank" rel="noreferrer" className="hover:underline">{c.page_name || "Facebook Page"}</a>
            {c.instagram_username && <span className="font-normal text-slate-500"> and @{c.instagram_username} on Instagram</span>}
          </div>
          {c.connected_by && <div className="text-slate-500">Connected by {c.connected_by}{c.connected_at ? ` on ${shortDate(c.connected_at)}` : ""}</div>}
        </div>
        <button type="button" className={buttonClass.danger} disabled={busy === "disconnect"}
          onClick={() => window.confirm("Disconnect the Page? Stories stop until it's connected again.") && act("disconnect", "/daily_story", { method: "DELETE" }, "Disconnected.")}>
          <Unplug className="size-4" /> Disconnect
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-3 text-sm text-slate-800 dark:text-neutral-200 sm:col-span-2">
          <input type="checkbox" checked={c.enabled} disabled={busy === "save"}
            onChange={(e) => save({ enabled: e.target.checked }, e.target.checked ? "Daily story turned on." : "Daily story turned off.")} />
          Post the Daily Reflection every day
        </label>
        {c.instagram && (
          <label className="flex items-center gap-3 text-sm text-slate-800 dark:text-neutral-200 sm:col-span-2">
            <input type="checkbox" checked={c.instagram_enabled} disabled={busy === "save"} onChange={(e) => save({ instagram_enabled: e.target.checked })} />
            Also post it to Instagram (@{c.instagram_username})
          </label>
        )}
        <div>
          <label className={labelClass}>Time</label>
          <input type="time" className={inputClass} value={postAt} onChange={(e) => setPostAt(e.target.value)}
            onBlur={() => postAt && postAt !== c.post_at && save({ post_at: postAt })} />
        </div>
        <div>
          <label className={labelClass}>Time zone</label>
          <select className={selectClass} value={c.time_zone} onChange={(e) => save({ time_zone: e.target.value })}>
            {[...new Set([c.time_zone, ...ZONES])].map((z) => <option key={z} value={z}>{z.replace("_", " ")}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Look</label>
          <select className={selectClass} value={c.look} onChange={(e) => save({ look: e.target.value })}>
            {data.looks.map((l) => <option key={l} value={l}>{LOOK_LABELS[l] || l}</option>)}
          </select>
        </div>
        <div className="text-sm text-slate-600 dark:text-neutral-400 self-end pb-2">
          {c.next_post_at ? <>Next: {when(c.next_post_at, c.time_zone)}</> : c.enabled ? null : "Turned off"}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass.primary} disabled={c.posting || busy === "post"}
          onClick={() => window.confirm(`Post today's story to ${c.page_name || "the Page"} now?`) && act("post", "/daily_story/post_now", { method: "POST" }, "Posting today's story…")}>
          <Send className="size-4" /> {c.posting ? "Posting…" : "Post now"}
        </button>
        {data.today && (
          <a href={data.today.preview_url} target="_blank" rel="noreferrer" className={buttonClass.secondary}>
            <ExternalLink className="size-4" /> Preview today's video ({data.today.title})
          </a>
        )}
      </div>
    </div>
  );
}

function History({ posts, zone }) {
  return (
    <Shell>
      <ShellBand title="Last posts" subtitle="Each day's story, and why one didn't post" />
      <ShellPanel position="bottom" className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {posts.map((p) => (
          <div key={p.id} className="px-5 py-3 sm:px-6 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS[p.status]?.tone}>{STATUS[p.status]?.label || p.status}</Badge>
              <span className="font-medium text-slate-900 dark:text-white">{p.chapter_title || p.on}</span>
              <span className="text-slate-500">
                {when(p.at, zone)} · {p.triggered_by === "admin" ? `Post now${p.by ? ` by ${p.by}` : ""}` : "on schedule"}
                {p.clips > 1 ? ` · ${p.clips} clips` : ""}
                {p.instagram_ids.length > 0 ? " · Instagram too" : ""}
              </span>
            </div>
            {p.error && <p className="mt-1 text-red-700 dark:text-red-300">{p.error}</p>}
          </div>
        ))}
      </ShellPanel>
    </Shell>
  );
}
