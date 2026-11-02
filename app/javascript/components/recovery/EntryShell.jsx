import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { api } from "../groups/lib";
import { Card, ErrorNote, Loading, linkButton } from "../groups/ui";
import { showToast } from "../../lib/toast";
import ChipModal from "./ChipModal";
import ChipShare from "./ChipShare";
import { DailyReminder } from "./ReminderSetting";
import { Streak } from "./ChipsPage";
import { dayLabel, localDate, nightLabel, shiftDay } from "./lib";

// What the 10th step and gratitude pages share: the day they're writing for (/recovery/<base>
// for today, /recovery/<base>/YYYY-MM-DD for another), loading and saving that day's entry at
// /api/<endpoint>/:on, the list of past days below, the streak (days in a row, sent with the
// list), and the chip a save just earned. `unit` names a day: ["night", "nights"].
export function useEntry(endpoint, unit) {
  const params = useParams();
  const today = localDate();
  const on = params.on && /^\d{4}-\d{2}-\d{2}$/.test(params.on) && params.on <= today ? params.on : today;
  const [entry, setEntry] = useState(undefined); // undefined while loading, null for none yet
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [earned, setEarned] = useState(null); // { chip, design, title, text }

  useEffect(() => {
    setEntry(undefined);
    setSaved(false);
    api(`/${endpoint}/${on}`).then((d) => setEntry(d.entry)).catch((e) => setError(e.message));
  }, [endpoint, on]);

  const loadList = useCallback((before) => api(`/${endpoint}?today=${today}${before ? `&before=${before}` : ""}`)
    .then((d) => setList((was) => (before && was ? { ...d, entries: [...was.entries, ...d.entries] } : d)))
    .catch((e) => setError(e.message)), [endpoint, today]);
  useEffect(() => { loadList(); }, [loadList]);

  const save = async (body, chipText) => {
    setSaving(true);
    setError(null);
    try {
      const before = list?.streak?.current || 0;
      const d = await api(`/${endpoint}/${on}?today=${today}`, { method: "PUT", body });
      setEntry(d.entry);
      setSaved(true);
      loadList();
      if (d.new_chip) {
        const r = await api(`/recovery?today=${today}`);
        setEarned({ chip: d.new_chip, design: r.design, celebrate: true, ...chipText(d.new_chip) });
      } else if (d.entry && d.streak.current > before && d.streak.current > 1) {
        showToast(`${d.streak.current} ${unit[1]} in a row. Keep it going!`, { tone: "success" });
      }
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return { on, today, entry, setEntry, list, error, saving, saved, setSaved, save, loadList, earned, unit, closeEarned: () => setEarned(null) };
}

// The page around the form: title, the day with arrows to the days before and after, and
// the past days below. `reminder` names its daily reminder (ReminderSetting).
// `printable`, when given, is what prints in place of the page (PrintableEntry).
export function EntryShell({ base, title, intro, state, summary, reminder, printable, children }) {
  const navigate = useNavigate();
  const { on, today, entry, list, error, earned, closeEarned, loadList, unit } = state;
  const go = (day) => navigate(day === today ? `/${base}` : `/${base}/${day}`);
  useEffect(() => { document.title = `${title} | RecoveryBot`; }, [title]);

  return (
    <>
    <div className={`mx-auto max-w-3xl space-y-8 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none ${printable ? "print:hidden" : ""}`}>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-slate-600 dark:text-neutral-400">{intro}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-neutral-400"><Lock className="size-4" /> Private. Only you can ever read this here, unless you send it to your sponsor (Share), and it goes when you delete your account.</p>
        {reminder && <div className="mt-4"><DailyReminder which={reminder} /></div>}
      </header>

      {list?.streak && <Streak streak={list.streak} total={list.total} unit={unit} done={list.entries[0]?.on === today} />}

      <div className="flex items-center gap-2">
        <button type="button" aria-label="The day before" onClick={() => go(shiftDay(on, -1))}
          className="inline-flex size-9 items-center justify-center rounded-xl !bg-white ring-1 ring-neutral-200 hover:!bg-neutral-50 dark:!bg-neutral-900 dark:ring-neutral-700"><ChevronLeft className="size-4" /></button>
        <div className="min-w-0 flex-1 text-center">
          <div className="font-semibold text-slate-900 dark:text-white">{on === today ? "Today" : nightLabel(on)}</div>
          <div className="text-xs text-slate-500 dark:text-neutral-400">{dayLabel(on)}</div>
        </div>
        <button type="button" aria-label="The day after" disabled={on >= today} onClick={() => go(shiftDay(on, 1))}
          className="inline-flex size-9 items-center justify-center rounded-xl !bg-white ring-1 ring-neutral-200 hover:!bg-neutral-50 disabled:opacity-40 dark:!bg-neutral-900 dark:ring-neutral-700"><ChevronRight className="size-4" /></button>
      </div>

      <ErrorNote error={error} />
      {entry === undefined ? <Loading /> : children}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
          Past days{list ? ` · ${list.total.toLocaleString()} written` : ""}
        </h2>
        {!list ? <Loading /> : list.entries.length === 0 ? (
          <Card className="p-5 text-sm text-slate-500 dark:text-neutral-400">Nothing yet. What you save shows up here.</Card>
        ) : (
          <Card className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
            {list.entries.map((e) => (
              <Link key={e.on} to={e.on === today ? `/${base}` : `/${base}/${e.on}`}
                className={`block p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${e.on === on ? "bg-accent/5" : ""}`}>
                <div className="font-semibold text-slate-900 dark:text-white">{nightLabel(e.on)}</div>
                <div className="mt-0.5 text-sm text-slate-600 dark:text-neutral-400">{summary(e)}</div>
              </Link>
            ))}
          </Card>
        )}
        {list?.more && <button type="button" className={linkButton} onClick={() => loadList(list.entries[list.entries.length - 1].on)}>Show older days</button>}
      </section>

      {earned && <ChipModal {...earned} onClose={closeEarned}><ChipShare chip={earned.chip} /></ChipModal>}
    </div>
    {printable && <div className="hidden print:block">{printable}</div>}
    </>
  );
}
