import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Compass, Search, Sparkles } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass } from "../ui/styles";
import { DAYS, ZONES, api, fromTimeValue } from "./lib";
import { Card, ErrorNote, Pill, Tray, primaryButton, quietButton } from "./ui";

const viewerZone = () => {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return ZONES.some(([z]) => z === zone) ? zone : "America/Phoenix";
};

// /groups/find: "Which meeting do you go to?" Searches the groups here, and AA Intergroup's
// directory to recognize the meeting; a meeting with no group here yet can start one.
export default function FindGroup() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("name");
  const [q, setQ] = useState("");
  const [day, setDay] = useState(String(new Date().getDay()));
  const [time, setTime] = useState("");
  const [zone, setZone] = useState(viewerZone);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const search = async (e) => {
    e?.preventDefault();
    setError(null);
    const params = new URLSearchParams();
    if (mode === "name") {
      if (!q.trim()) return;
      params.set("q", q.trim());
    } else {
      const minute = fromTimeValue(time);
      if (minute == null) return;
      params.set("day", day);
      params.set("start_minute", minute);
      params.set("time_zone", zone);
    }
    try {
      setResults(await api(`/groups/find?${params}`));
    } catch (err) {
      setError(err.message);
    }
  };

  // searching by day and time runs as soon as both are set
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (mode === "time" && time) search(); }, [mode, day, time, zone]);

  const join = async (slug) => {
    setBusy(slug);
    setError(null);
    try {
      await api(`/groups/${slug}/join`, { method: "POST" });
      navigate(`/${slug}`);
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  const start = async (listing) => {
    if (!window.confirm(`Start “${listing.group_name || listing.name}” here? You'll be its admin once a site admin approves it.`)) return;
    setBusy(listing.slug);
    setError(null);
    try {
      const group = await api("/groups/start", { method: "POST", body: { oiaa_slug: listing.slug } });
      navigate(`/${group.slug}`);
    } catch (err) {
      if (err.data?.slug) navigate(`/${err.data.slug}`);
      setError(err.message);
      setBusy(null);
    }
  };

  const notNow = async () => {
    await api("/groups/dismiss_prompt", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <div>
        <Link to="/" className="text-sm text-slate-500 hover:text-accent dark:text-neutral-400">← Groups</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Find your group</h1>
        <p className="text-sm text-slate-600 dark:text-neutral-400">
          Which meeting do you go to? Look it up by name or Zoom link, or by when it meets.
        </p>
      </div>

      <Shell>
        <ShellBand icon={Compass} title="Which meeting do you go to?" />
        <ShellPanel position="middle">
          <SegmentedControl
            options={[{ value: "name", label: "Name or link" }, { value: "time", label: "Day and time" }]}
            value={mode}
            onChange={(m) => { setMode(m); setResults(null); }}
          />
        </ShellPanel>
        <ShellPanel position="bottom" className="p-4">
          {mode === "name" ? (
            <form onSubmit={search} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input autoFocus className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Meeting name, or a Zoom link or meeting ID" />
              </div>
              <button type="submit" className={primaryButton}>Search</button>
            </form>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="f-day" className={labelClass}>Day</label>
                <select id="f-day" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)}>
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="f-time" className={labelClass}>Starts at</label>
                <input id="f-time" type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div>
                <label htmlFor="f-zone" className={labelClass}>Your time zone</label>
                <select id="f-zone" className={inputClass} value={zone} onChange={(e) => setZone(e.target.value)}>
                  {ZONES.map(([z, label]) => <option key={z} value={z}>{label}</option>)}
                </select>
              </div>
            </div>
          )}
        </ShellPanel>
      </Shell>

      <ErrorNote error={error} />

      {results && (
        <>
          <Tray label="Groups on RecoveryBot">
            {results.groups.length === 0 ? (
              <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">No group here matches yet.</Card>
            ) : (
              <div className="space-y-1.5">
                {results.groups.map((g) => (
                  <Card key={g.slug} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-white">{g.title}</p>
                      <p className="text-xs text-slate-500 dark:text-neutral-400">{g.next_meeting ? g.next_meeting.schedule_label : "No meetings listed"}</p>
                    </div>
                    <GroupAction status={g.membership_status} slug={g.slug} busy={busy === g.slug} onJoin={() => join(g.slug)} />
                  </Card>
                ))}
              </div>
            )}
          </Tray>

          <Tray label="On AA Intergroup">
            {results.oiaa.length === 0 ? (
              <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">
                {results.oiaa_ready ? "No AA Intergroup meeting matches that." : "AA Intergroup's list is loading. Try again in a minute."}
              </Card>
            ) : (
              <div className="space-y-1.5">
                {results.oiaa.map((m) => (
                  <Card key={m.slug} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {m.name}{m.group_name && m.group_name !== m.name ? <span className="font-normal text-slate-500"> · {m.group_name}</span> : null}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-neutral-400">{m.schedule_label}</p>
                    </div>
                    {m.group ? (
                      <>
                        <Pill tone="green">{m.group.title} is here</Pill>
                        <GroupAction status={m.group.status} slug={m.group.slug} busy={busy === m.group.slug} onJoin={() => join(m.group.slug)} />
                      </>
                    ) : (
                      <button type="button" disabled={busy === m.slug} onClick={() => start(m)} className={quietButton}>
                        <Sparkles className="h-4 w-4" /> Start this group
                      </button>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </Tray>
        </>
      )}

      {document.body.dataset.needsGroup === "true" && (
        <p className="text-center text-sm text-slate-500 dark:text-neutral-400">
          Not in a group right now?{" "}
          <button type="button" onClick={notNow} className="!bg-transparent p-0 font-medium text-accent hover:underline">Not now</button>
        </p>
      )}
    </div>
  );
}

function GroupAction({ status, slug, busy, onJoin }) {
  if (status === "active") return <Link to={`/${slug}`} className={quietButton}>Open</Link>;
  if (status === "requested") return <Pill tone="amber">Request sent</Pill>;
  return <button type="button" disabled={busy} onClick={onJoin} className={primaryButton}>Ask to join</button>;
}
