import React, { useCallback, useEffect, useState } from "react";
import { FileCheck2, HandHelping, MonitorPlay } from "lucide-react";
import { api } from "../groups/lib";
import { Card, ErrorNote, Loading, Pill, primaryButton, quietButton } from "../groups/ui";
import { refreshNav } from "../shell/useShell";

const when = (iso) => new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

// Hosting under "You" (/people/me/hosting): the dates you host or co-host in the next two
// weeks, each with its HostDeck, the "Need a sub" requests you could take (the count on the
// sidebar's badge), and the court verification form for the meetings you serve.
export default function HostingPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => api("/hosting").then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { document.title = "Hosting | RecoveryBot"; load(); }, [load]);

  const take = async (r) => {
    setBusy(r.id);
    setError(null);
    try {
      await api(`/groups/${r.group_slug}/host_sub_requests/${r.id}/take`, { method: "POST" });
      await load();
      refreshNav();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;

  return (
    <div className="mx-auto max-w-3xl space-y-8 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Hosting</h1>
        <p className="mt-1 text-slate-500 dark:text-neutral-400">Where you're serving, and where your groups need a hand.</p>
      </header>
      <ErrorNote error={error} />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500"><HandHelping className="size-4" /> Subs needed</h2>
        {data.open_requests.length === 0 ? (
          <Card className="p-5 text-sm text-slate-500 dark:text-neutral-400">Nobody needs a sub right now.</Card>
        ) : (
          <Card className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
            {data.open_requests.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 dark:text-white">{r.name} <Pill tone="amber">{r.place.replace(/^./, (c) => c.toUpperCase())}</Pill></div>
                  <div className="text-sm text-slate-500 dark:text-neutral-400">{day(r.on)} at {r.at} · {r.group_title}</div>
                  {r.note && <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">“{r.note}”{r.requested_by && ` — ${r.requested_by}`}</p>}
                </div>
                <button type="button" className={primaryButton} disabled={busy === r.id} onClick={() => take(r)}>I'll cover it</button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500"><MonitorPlay className="size-4" /> Your next two weeks</h2>
        {data.upcoming.length === 0 ? (
          <Card className="p-5 text-sm text-slate-500 dark:text-neutral-400">You're not on the host schedule in the next two weeks.</Card>
        ) : (
          <Card className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
            {data.upcoming.map((c) => (
              <div key={`${c.meeting_id}-${c.role}-${c.starts_at}`} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 dark:text-white">{c.name} <Pill tone="accent">{c.role_label}</Pill>{c.cover && <Pill>Covering</Pill>}</div>
                  <div className="text-sm text-slate-500 dark:text-neutral-400">{when(c.starts_at)} · {c.group_title}</div>
                </div>
                <a href={`/groups/${c.group_slug}/host/${c.meeting_id}`} className={quietButton}><MonitorPlay className="size-4" /> HostDeck</a>
              </div>
            ))}
          </Card>
        )}
      </section>

      {data.meetings.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500"><FileCheck2 className="size-4" /> Court verification</h2>
          <Card className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
            {data.meetings.map((m) => (
              <a key={`${m.group_slug}-${m.meeting_id}`} href={m.court_url} className="flex items-center gap-3 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900 dark:text-white">{m.name}</span>
                  <span className="block text-sm text-slate-500 dark:text-neutral-400">{m.label} · {m.group_title}</span>
                </span>
                <span className="text-sm font-semibold text-accent">Open the form</span>
              </a>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
