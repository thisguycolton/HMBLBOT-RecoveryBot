import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HandHeart, Lock, NotebookPen } from "lucide-react";
import { api } from "../groups/lib";
import { Card, ErrorNote, Loading, quietButton } from "../groups/ui";
import { selectClass } from "../ui/styles";
import { chipMilestones } from "../../lib/milestones";
import { RoundChip, TriangleChip } from "./Chip";
import ChipModal from "./ChipModal";
import { dayLabel, localDate } from "./lib";

const short = (iso) => dayLabel(iso, { month: "short", day: "numeric", year: "numeric" });

// Chips (/recovery): the round chips for every sobriety milestone reached, from the member's
// sobriety date, and the triangle chips for the 10th steps and gratitude lists they've written,
// all in the design of their home group (Group dashboard > Chips). The next one shows faded.
// Only they see this page.
export default function ChipsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // a chip shown big
  const load = useCallback(() => api(`/recovery?today=${localDate()}`).then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { document.title = "Chips | RecoveryBot"; load(); }, [load]);

  const pickGroup = async (slug) => {
    setError(null);
    try { setData(await api("/recovery", { method: "PATCH", body: { home_group: slug } })); } catch (e) { setError(e.message); }
  };

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  const { design, home_group: home } = data;
  const logoUrl = home?.logo_url;
  const round = data.sobriety_date ? chipMilestones(data.sobriety_date) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <header className="space-y-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Chips</h1>
          <p className="mt-1 flex items-center gap-1.5 text-slate-500 dark:text-neutral-400"><Lock className="size-4" /> Only you can see your chips.</p>
        </div>
        <HomeGroup data={data} onPick={pickGroup} />
      </header>
      <ErrorNote error={error} />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Sobriety</h2>
        {!round ? (
          <Card className="p-5 text-sm text-slate-600 dark:text-neutral-300">
            Add your sobriety date to <a href="/users/edit" className="font-medium text-accent hover:underline">your profile</a> and your chips show up here, from your 24 hours on.
            It stays private unless you choose to show it.
          </Card>
        ) : (
          <Card className="p-4 sm:p-6">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
              {round.earned.slice().reverse().map((m) => (
                <li key={m.label}>
                  <button type="button" className="group flex w-full flex-col items-center gap-2 !bg-transparent text-center"
                    onClick={() => setOpen({ chip: { kind: "round", milestone: m, on: m.on }, title: m.label, text: `You reached ${m.label} on ${dayLabel(m.on)}.` })}>
                    <RoundChip design={design} milestone={m} logoUrl={logoUrl} size={128} className="transition-transform group-hover:scale-105" />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{m.label}</span>
                    <span className="-mt-2 text-xs text-slate-500 dark:text-neutral-400">{short(m.on)}</span>
                  </button>
                </li>
              ))}
              {round.next && (
                <li className="flex flex-col items-center gap-2 text-center">
                  <RoundChip design={design} milestone={round.next} logoUrl={logoUrl} size={128} faded />
                  <span className="text-sm font-semibold text-slate-500 dark:text-neutral-400">{round.next.label}</span>
                  <span className="-mt-2 text-xs text-slate-500 dark:text-neutral-400">{round.next.inDays === 1 ? "Tomorrow" : `In ${round.next.inDays.toLocaleString()} days`}</span>
                </li>
              )}
            </ul>
            {round.earned.length === 0 && <p className="mt-4 text-center text-sm text-slate-500">Today is day one. Your 24 hour chip is waiting for you tomorrow.</p>}
          </Card>
        )}
      </section>

      <TriangleRow kind="inventory" icon={NotebookPen} info={data.triangles.inventory} design={design} done={data.today.inventory}
        to="/inventory" cta="Write tonight's inventory" doneText="Tonight's inventory is written." onOpen={setOpen} />
      <TriangleRow kind="gratitude" icon={HandHeart} info={data.triangles.gratitude} design={design} done={data.today.gratitude}
        to="/gratitude" cta="Write today's list" doneText="Today's list is written." onOpen={setOpen} />

      <p className="text-xs text-slate-500 dark:text-neutral-400">
        Triangle chips come at 1, 7, 30, 90, 180 and 365, then every 365 more. They count every one you've written, so a day you miss never takes a chip away.
      </p>

      {open && <ChipModal {...open} design={design} logoUrl={logoUrl} groupTitle={home?.title} onClose={() => setOpen(null)} />}
    </div>
  );
}

function HomeGroup({ data, onPick }) {
  const { groups, home_group: home } = data;
  if (groups.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-neutral-400">These are RecoveryBot's chips. When you join your home group here, you get its chips instead.</p>;
  }
  if (groups.length === 1) return <p className="text-sm text-slate-600 dark:text-neutral-400">Your chips from <strong className="text-slate-900 dark:text-white">{home.title}</strong>.</p>;
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-neutral-400">
      Your chips from your home group
      <select className={`${selectClass} !w-auto`} value={home?.slug} onChange={(e) => onPick(e.target.value)}>
        {groups.map((g) => <option key={g.slug} value={g.slug}>{g.title}</option>)}
      </select>
    </label>
  );
}

function TriangleRow({ kind, icon: Icon, info, design, done, to, cta, doneText, onOpen }) {
  const word = (n) => (n === 1 ? info.label : info.plural);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500"><Icon className="size-4" /> {kind === "inventory" ? "10th step" : "Gratitude"}</h2>
        {done ? <span className="text-sm text-emerald-700 dark:text-emerald-300">{doneText}</span> : <Link to={to} className={quietButton}>{cta}</Link>}
      </div>
      <Card className="p-4 sm:p-6">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
          {info.earned.slice().reverse().map((c) => (
            <li key={c.count}>
              <button type="button" className="group flex w-full flex-col items-center gap-2 !bg-transparent text-center"
                onClick={() => onOpen({ chip: { kind, count: c.count, on: c.on }, title: `${c.count.toLocaleString()} ${word(c.count)}`, text: `You wrote your ${ordinal(c.count)} ${info.label} on ${dayLabel(c.on)}.` })}>
                <TriangleChip design={design} kind={kind} count={c.count} size={136} className="transition-transform group-hover:scale-105" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{c.count.toLocaleString()} {word(c.count)}</span>
                <span className="-mt-2 text-xs text-slate-500 dark:text-neutral-400">{short(c.on)}</span>
              </button>
            </li>
          ))}
          <li className="flex flex-col items-center gap-2 text-center">
            <TriangleChip design={design} kind={kind} count={info.next} size={136} faded />
            <span className="text-sm font-semibold text-slate-500 dark:text-neutral-400">{info.next.toLocaleString()} {word(info.next)}</span>
            <span className="-mt-2 text-xs text-slate-500 dark:text-neutral-400">{(info.next - info.total).toLocaleString()} to go</span>
          </li>
        </ul>
      </Card>
    </section>
  );
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n.toLocaleString()}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
