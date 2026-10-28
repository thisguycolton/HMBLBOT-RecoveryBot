import React, { useCallback, useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, Gift, Mail, Trash2, UserCheck } from "lucide-react";
import { api } from "../groups/lib";
import { Card, ErrorNote, Loading, Pill, dangerButton, primaryButton } from "../groups/ui";
import Avatar from "../groups/Avatar";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { SpinningChip } from "./ChipModal";
import { dayLabel, localDate } from "./lib";

// The round chips a host can give (ChipAward::ROUND_KEYS)
const MILESTONES = [
  ["24h", "24 hours"], ["30d", "30 days"], ["60d", "60 days"], ["90d", "90 days"],
  ["6m", "6 months"], ["9m", "9 months"], ["year", "Years"], ["18m", "18 months"],
];
const blank = { to: "", user_id: "", milestone_key: "30d", years: 1, on: localDate(), note: "" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Give a chip (/recovery/give): for the hosts, host coordinators, record keepers and admins of a
// group (Api::ChipAwardsController). A round chip in the group's design, to a member or to an
// email address: someone with an account gets it at once with a notification, anyone else an
// email with a link to claim it. Below, the chips given so far, which can be taken back. Each
// group's folder in the sidebar links here with ?group=, the group it gives for.
export default function GivePage() {
  const [data, setData] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const slug = searchParams.get("group");
  const setSlug = (value) => setSearchParams({ group: value }, { replace: true });
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const load = useCallback(() => api("/chip_awards").then(setData).catch((e) => setError(e.message)), []);
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
      if (!form.user_id && !EMAIL.test(form.to.trim())) throw new Error("Pick someone from the list, or type their whole email address.");
      const body = { group_slug: group.slug, milestone_key: form.milestone_key, years: form.years, on: form.on, note: form.note,
        ...(form.user_id ? { user_id: form.user_id } : { email: form.to.trim() }) };
      const d = await api("/chip_awards", { method: "POST", body });
      setDone(d.emailed ? `We emailed ${d.award.to} a link to claim their ${d.award.label} chip.` : `${d.award.to} has their ${d.award.label} chip. We let them know.`);
      setForm(blank);
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
                <select id="g-group" className={selectClass} value={group.slug} onChange={(e) => { setSlug(e.target.value); set({ user_id: "", to: "" }); }}>
                  {data.groups.map((g) => <option key={g.slug} value={g.slug}>{g.title}</option>)}
                </select>
              </div>
            )}
            <ToField group={group} form={form} set={set} />
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

// To: type a name or an email address. People in the group show as you type (Api::ChipAwards
// Controller#lookup); pick one, or finish an email address: with an account it goes straight to
// them, without one we email them a link to claim it.
function ToField({ group, form, set }) {
  const [found, setFound] = useState({ members: [], account: null });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const q = form.to.trim();
  useEffect(() => {
    if (form.user_id || q.length < 2) { setFound({ members: [], account: null }); return undefined; }
    const timer = setTimeout(() => {
      api(`/chip_awards/lookup?group_slug=${encodeURIComponent(group.slug)}&q=${encodeURIComponent(q)}`).then(setFound).catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [q, group.slug, form.user_id]);

  const choose = (m) => { set({ user_id: m.id, to: m.name }); setOpen(false); };
  const list = open && !form.user_id ? found.members : [];
  const email = EMAIL.test(q);
  return (
    <div>
      <label htmlFor="g-to" className={labelClass}>To</label>
      <div className="relative">
        <input id="g-to" required autoComplete="off" role="combobox" aria-expanded={list.length > 0} aria-controls={listId} aria-autocomplete="list"
          className={inputClass} placeholder={`A name in ${group.title}, or an email address`} value={form.to}
          onChange={(e) => { set({ to: e.target.value, user_id: "" }); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!list.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); choose(list[active]); }
            if (e.key === "Escape") setOpen(false);
          }} />
        {list.length > 0 && (
          <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
            {list.map((m, i) => (
              <li key={m.id} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(m); }} onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === active ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}>
                <Avatar person={m} size={24} /> {m.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400">
        {form.user_id ? <><UserCheck className="size-3.5 text-emerald-600" /> In {group.title}. It goes straight to them, with a notification.</>
          : email && found.account ? <><UserCheck className="size-3.5 text-emerald-600" /> {found.account.name} has an account with this address. It goes straight to them, with a notification.</>
            : email ? <><Mail className="size-3.5" /> No account with this address yet. We'll email them a link to make one and claim it.</>
              : "Start typing a name to find someone in the group, or enter an email address."}
      </p>
    </div>
  );
}
