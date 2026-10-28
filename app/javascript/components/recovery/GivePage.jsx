import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Gift, Trash2 } from "lucide-react";
import { api } from "../groups/lib";
import { Card, ErrorNote, Loading, Pill, dangerButton, primaryButton } from "../groups/ui";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { SpinningChip } from "./ChipModal";
import { dayLabel, localDate } from "./lib";

// The round chips a host can give (ChipAward::ROUND_KEYS)
const MILESTONES = [
  ["24h", "24 hours"], ["30d", "30 days"], ["60d", "60 days"], ["90d", "90 days"],
  ["6m", "6 months"], ["9m", "9 months"], ["year", "Years"], ["18m", "18 months"],
];
const blank = { to: "member", user_id: "", email: "", milestone_key: "30d", years: 1, on: localDate(), note: "" };

// Give a chip (/recovery/give): for the hosts, host coordinators, record keepers and admins of a
// group (Api::ChipAwardsController). A round chip in the group's design, to a member or to an
// email address: someone with an account gets it at once with a notification, anyone else an
// email with a link to claim it. Below, the chips given so far, which can be taken back.
export default function GivePage() {
  const [data, setData] = useState(null);
  const [slug, setSlug] = useState(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const load = useCallback(() => api("/chip_awards").then((d) => { setData(d); setSlug((s) => s || d.groups[0]?.slug); }).catch((e) => setError(e.message)), []);
  useEffect(() => { document.title = "Give a chip | RecoveryBot"; load(); }, [load]);

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  if (data.groups.length === 0) {
    return <Card className="mx-auto max-w-xl p-6 text-sm text-slate-600 dark:text-neutral-300">Giving chips is for a group's hosts, host coordinators and admins. When you host for a group, you can give its chips here.</Card>;
  }
  const group = data.groups.find((g) => g.slug === slug) || data.groups[0];
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setDone(null); };
  const label = form.milestone_key === "year" ? `${form.years} year${Number(form.years) === 1 ? "" : "s"}` : MILESTONES.find(([k]) => k === form.milestone_key)[1];
  const preview = { id: "preview", shape: "round", kind: "round", label, on: form.on, design: group.design, group: { title: group.title, logo_url: group.logo_url },
    milestone: { key: form.milestone_key, years: Number(form.years) || 1, label } };

  const give = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { group_slug: group.slug, milestone_key: form.milestone_key, years: form.years, on: form.on, note: form.note,
        ...(form.to === "member" ? { user_id: form.user_id } : { email: form.email }) };
      const d = await api("/chip_awards", { method: "POST", body });
      setDone(d.emailed ? `We emailed ${d.award.to} a link to claim their ${d.award.label} chip.` : `${d.award.to} has their ${d.award.label} chip. We let them know.`);
      setForm({ ...blank, to: form.to });
      load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const takeBack = async (a) => {
    if (!window.confirm(`Take back the ${a.label} chip given to ${a.to}?`)) return;
    try { await api(`/chip_awards/${a.id}`, { method: "DELETE" }); load(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <header>
        <Link to="/" className="mb-2 inline-flex items-center gap-1 text-sm !text-slate-500 hover:!text-accent"><ChevronLeft className="size-4" /> Chips</Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Give a chip</h1>
        <p className="mt-1 text-slate-600 dark:text-neutral-400">For someone celebrating a milestone with your group. It comes in your group's design, alongside the plain one they earn themselves.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <form onSubmit={give} className="min-w-0 space-y-4">
          <Card className="space-y-4 p-4 sm:p-5">
            {data.groups.length > 1 && (
              <div>
                <label htmlFor="g-group" className={labelClass}>From</label>
                <select id="g-group" className={selectClass} value={group.slug} onChange={(e) => { setSlug(e.target.value); set({ user_id: "" }); }}>
                  {data.groups.map((g) => <option key={g.slug} value={g.slug}>{g.title}</option>)}
                </select>
              </div>
            )}
            <div>
              <div className={labelClass}>To</div>
              <div className="overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700">
                <SegmentedControl value={form.to} onChange={(v) => set({ to: v })} options={[{ value: "member", label: `Someone in ${group.title}` }, { value: "email", label: "An email address" }]} />
              </div>
            </div>
            {form.to === "member" ? (
              <select aria-label="Who" required className={selectClass} value={form.user_id} onChange={(e) => set({ user_id: e.target.value })}>
                <option value="">Pick someone…</option>
                {group.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            ) : (
              <div>
                <input type="email" required aria-label="Email address" className={inputClass} placeholder="name@example.com" value={form.email} onChange={(e) => set({ email: e.target.value })} />
                <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">If they have an account with this address, the chip is theirs right away. If not, we email them a link to make one and claim it.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem_1fr]">
              <div>
                <label htmlFor="g-milestone" className={labelClass}>Chip</label>
                <select id="g-milestone" className={selectClass} value={form.milestone_key} onChange={(e) => set({ milestone_key: e.target.value })}>
                  {MILESTONES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="g-years" className={labelClass}>Years</label>
                <input id="g-years" type="number" min={1} max={99} disabled={form.milestone_key !== "year"} className={inputClass} value={form.years} onChange={(e) => set({ years: e.target.value })} />
              </div>
              <div>
                <label htmlFor="g-on" className={labelClass}>Celebrated on</label>
                <input id="g-on" type="date" max={localDate()} className={inputClass} value={form.on} onChange={(e) => set({ on: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="g-note" className={labelClass}>A note (optional)</label>
              <textarea id="g-note" rows={2} maxLength={500} className={inputClass} value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="Keep coming back!" />
            </div>
          </Card>
          <ErrorNote error={error} />
          <div className="flex flex-wrap items-center justify-end gap-3">
            {done && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{done}</span>}
            <button type="submit" disabled={busy} className={primaryButton}><Gift className="size-4" /> {busy ? "Giving…" : "Give the chip"}</button>
          </div>
        </form>

        <aside className="rounded-2xl bg-gradient-to-b from-stone-800 to-stone-950 py-6 text-center text-white lg:self-start">
          <SpinningChip key={`${group.slug}-${form.milestone_key}-${form.years}`} chip={preview} size={190} />
          <div className="mt-1 text-xs opacity-60">How it'll look. Drag to spin it.</div>
        </aside>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Given</h2>
        {data.given.length === 0 ? (
          <Card className="p-5 text-sm text-slate-500 dark:text-neutral-400">No chips given yet.</Card>
        ) : (
          <Card className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
            {data.given.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 dark:text-white">{a.label} for {a.to} {!a.claimed && <Pill tone="amber">Not claimed yet</Pill>}</div>
                  <div className="text-sm text-slate-500 dark:text-neutral-400">{dayLabel(a.on, { month: "short", day: "numeric", year: "numeric" })} · {a.group_title}{a.given_by && ` · given by ${a.given_by}`}</div>
                </div>
                <button type="button" className={dangerButton} onClick={() => takeBack(a)}><Trash2 className="size-4" /> Take back</button>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
