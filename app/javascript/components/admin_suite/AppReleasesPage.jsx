import React, { useEffect, useState } from "react";
import { Check, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass } from "../ui/styles";
import { DateField, todayValue } from "../ui/DateFields";
import Markdown from "../book/Markdown";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import Skeleton from "../ui/Skeleton";

const PLATFORMS = [
  { value: "ios", label: "iPhone" },
  { value: "android", label: "Android" },
];
const NAME = { ios: "iPhone", android: "Android" };

const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Site Admin > App releases: each build of the iPhone and Android apps (AppRelease) with its
// release notes. Account settings > App info shows the ones marked out, and Site notices starts
// "how to update" notices from the newest one out.
export default function AppReleasesPage({ notify }) {
  const [releases, setReleases] = useState(null);
  const [editing, setEditing] = useState(null); // release id, or "new"

  async function load() {
    try {
      setReleases((await api("/app_releases")).app_releases);
    } catch (e) {
      notify(e.message, "error");
    }
  }
  useEffect(() => { load(); }, []);

  async function save(id, values, message) {
    try {
      if (id === "new") await api("/app_releases", { method: "POST", body: { app_release: values } });
      else await api(`/app_releases/${id}`, { method: "PATCH", body: { app_release: values } });
      setEditing(null);
      notify(message || "Build saved.");
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  async function destroy(release) {
    if (!window.confirm(`Delete ${NAME[release.platform]} build ${release.build}?`)) return;
    try {
      await api(`/app_releases/${release.id}`, { method: "DELETE" });
      notify("Build deleted.");
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  if (!releases) return <Skeleton variant="list" className="max-w-3xl" />;

  // A new build starts one past the newest of that platform
  const next = (platform) => {
    const newest = releases.filter((r) => r.platform === platform)[0];
    return { platform, build: newest ? newest.build + 1 : 1, version: newest?.version || "1.0", notes: "", released_on: null };
  };

  return (
    <Shell className="max-w-3xl">
      <ShellBand
        icon={Rocket}
        title="App releases"
        subtitle="Builds of the apps and their notes. Members see the ones marked out in Account settings > App info."
      />
      {PLATFORMS.map(({ value: platform, label }) => (
        <React.Fragment key={platform}>
          <ShellPanel position="middle" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400 !font-sans">
            {label}
          </ShellPanel>
          {releases.filter((r) => r.platform === platform).map((release) => (
            <ShellPanel key={release.id} position="middle" className="p-4">
              {editing === release.id ? (
                <ReleaseForm release={release} onSave={(v) => save(release.id, v)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1 min-w-0 !font-sans">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">Build {release.build}</div>
                      <span className="text-xs text-slate-500 dark:text-neutral-400">version {release.version}</span>
                      {release.released ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">Out {day(release.released_on)}</span>
                      ) : (
                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">Not out yet</span>
                      )}
                    </div>
                    {release.notes && <div className="mt-1 text-sm text-slate-600 dark:text-neutral-400 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"><Markdown source={release.notes} /></div>}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {!release.released && (
                      <button type="button" className={buttonClass.secondary} onClick={() => save(release.id, { released_on: todayValue() }, `Build ${release.build} marked out.`)}>
                        Mark out today
                      </button>
                    )}
                    <button type="button" className={buttonClass.secondary} onClick={() => setEditing(release.id)} aria-label={`Edit build ${release.build}`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className={buttonClass.danger} onClick={() => destroy(release)} aria-label={`Delete build ${release.build}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </ShellPanel>
          ))}
        </React.Fragment>
      ))}
      <ShellPanel position="bottom" className="p-4">
        {editing === "new" ? (
          <ReleaseForm release={next("ios")} nextFor={next} onSave={(v) => save("new", v, "Build added.")} onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" className={buttonClass.primary} onClick={() => setEditing("new")}>
            <Plus className="w-4 h-4" strokeWidth={2.5} /> New build
          </button>
        )}
      </ShellPanel>
    </Shell>
  );
}

function ReleaseForm({ release, nextFor, onSave, onCancel }) {
  const [v, setV] = useState({ ...release, notes: release.notes || "", released_on: release.released_on || "" });
  const isNew = !release.id;
  const set = (key) => (e) => setV((p) => ({ ...p, [key]: e?.target ? e.target.value : e }));

  const submit = (e) => {
    e.preventDefault();
    onSave({ platform: v.platform, build: v.build, version: v.version, notes: v.notes, released_on: v.released_on || null });
  };

  return (
    <form className="grid gap-4 !font-sans" onSubmit={submit}>
      {isNew && (
        <div>
          <span className={labelClass}>App</span>
          <div className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
            <SegmentedControl options={PLATFORMS} value={v.platform} onChange={(platform) => setV((p) => ({ ...p, ...nextFor(platform), notes: p.notes }))} />
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={labelClass}>Build number</span>
          <input type="number" min="1" step="1" className={inputClass} value={v.build} onChange={(e) => setV((p) => ({ ...p, build: parseInt(e.target.value, 10) || "" }))} required />
        </label>
        <label className="block">
          <span className={labelClass}>Version</span>
          <input className={inputClass} value={v.version} onChange={set("version")} maxLength={20} required placeholder="1.0.5" />
        </label>
        <label className="block">
          <span className={labelClass}>Out to testers on</span>
          <DateField clearable placeholder="Not out yet" value={v.released_on} onChange={(value) => setV((p) => ({ ...p, released_on: value }))} />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>What's new (Markdown)</span>
        <textarea className={`${inputClass} min-h-32 font-mono`} value={v.notes} onChange={set("notes")} maxLength={4000}
          placeholder={"- New: lock the app with Face ID\n- Fixed the widget saying \"Can't load widget\""} />
      </label>
      <p className="text-xs text-slate-500 dark:text-neutral-400">
        The build number is the one TestFlight or Play Console shows (iPhone CURRENT_PROJECT_VERSION, Android versionCode).
        Until it's marked out, nobody is told to update to it.
      </p>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass.primary} disabled={!v.build || !v.version.trim()}>
          <Check className="w-4 h-4" strokeWidth={2.5} /> {isNew ? "Add build" : "Save"}
        </button>
        <button type="button" className={buttonClass.secondary} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
