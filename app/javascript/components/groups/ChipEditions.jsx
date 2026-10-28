import React, { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { FlatChip, SpinningChip } from "../recovery/ChipModal";
import SceneControls from "../chips/SceneControls";
import MeetingPartForm from "../chips/MeetingPartForm";
import { storedDesign } from "../chips/lib";
import { api } from "./lib";
import { Card, ErrorNote, Loading, Pill, dangerButton, primaryButton, quietButton } from "./ui";

const segment = "overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700";
const MILESTONES = [["24h", "24 hours"], ["30d", "30 days"], ["60d", "60 days"], ["90d", "90 days"], ["6m", "6 months"], ["9m", "9 months"], ["18m", "18 months"], ["year", "Years"]];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const nthWeekday = (year, month, weekday, n) => { const d = new Date(year, month, 1); d.setDate(1 + ((weekday - d.getDay() + 7) % 7) + 7 * (n - 1)); return iso(d); };

// Holidays an edition can be for (the day itself; the dates can be stretched after)
const HOLIDAYS = [
  { key: "new_year", label: "New Year's", on: (y) => [`${y - 1}-12-31`, `${y}-01-01`] },
  { key: "founders", label: "Founders' Day (June 10)", on: (y) => [`${y}-06-10`, `${y}-06-10`] },
  { key: "thanksgiving", label: "Thanksgiving", on: (y) => { const d = nthWeekday(y, 10, 4, 4); return [d, d]; } },
  { key: "christmas", label: "Christmas", on: (y) => [`${y}-12-24`, `${y}-12-25`] },
];

const today = () => iso(new Date());
const blank = (kind) => {
  const y = new Date().getFullYear();
  return { name: kind === "milestone" ? `${y} Edition` : "", kind, window: kind === "milestone" ? "year" : "month", starts_on: `${y}-01-01`, ends_on: `${y}-12-31`,
    milestones: [], meeting_ids: [], target_count: 30, how_many: "everyone", limit: 50, numbered: true };
};

function status(e) {
  if (!e.published) return <Pill>Draft</Pill>;
  if (e.sold_out) return <Pill tone="amber">All out</Pill>;
  if (e.ends_on < today()) return <Pill>Ended</Pill>;
  if (e.starts_on > today()) return <Pill tone="accent">Starts {e.starts_on}</Pill>;
  return <Pill tone="green">Running</Pill>;
}

// A chip as it'll look, for previews: the edition's design, with its mark on the back
function sample(e, design) {
  const mark = [e.name, e.numbered ? `No. 001${e.how_many !== "everyone" ? ` of ${e.limit}` : ""}` : null].filter(Boolean).join(" · ").toUpperCase();
  const base = { id: `edition-preview-${e.id || "new"}`, design, on: e.starts_on, edition: { name: e.name, mark }, group: {} };
  if (e.kind === "meeting_maker") {
    const sides = design.meeting.sides;
    const d = { ...design, meeting: { ...design.meeting, sides: [sides[0], sides[1], sides[2] || e.name] } };
    return { ...base, design: d, kind: "meeting", shape: design.meeting.shape, count: e.target_count, label: `${e.target_count} meetings` };
  }
  return { ...base, kind: "round", shape: "round", label: "1 year", milestone: { key: "year", years: 1, label: "1 year" } };
}

// Group dashboard > Chips > Special Editions (Api::GroupChipEditionsController): limited chips
// the group makes for a year, a month, a week or a holiday, for milestones members reach then
// (claimed with a tap, or given by hosts) or for making meetings (given on their own). Each is
// numbered. Once the first one is out, its design is fixed: minted chips never change.
export default function ChipEditions({ group, data, templates, onTemplates }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => api(`/groups/${group.slug}/chip_editions`).then(setList).catch((e) => setError(e.message)), [group.slug]);
  useEffect(() => { load(); }, [load]);

  const start = (kind) => setEditing({ ...blank(kind), design: data.design });
  const duplicate = async (e) => {
    try {
      const d = await api(`/groups/${group.slug}/chip_editions/${e.id}/duplicate`, { method: "POST" });
      await load();
      setEditing(d.edition);
    } catch (err) { setError(err.message); }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Sparkles className="size-4" /> Special Editions</h2>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            Limited chips for a year, a month, a week or a holiday. Milestone editions are for milestones members reach while it runs: they claim it with a tap, any time after, and hosts can give it too.
            Meeting Maker editions go to members who make enough meetings while it runs. Each one is numbered.
          </p>
        </div>
        {list?.open && !editing && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={quietButton} onClick={() => start("milestone")}><Plus className="size-4" /> Milestone edition</button>
            <button type="button" className={quietButton} onClick={() => start("meeting_maker")}><Plus className="size-4" /> Meeting Maker edition</button>
          </div>
        )}
      </div>
      <ErrorNote error={error} />
      {!list ? <Loading /> : editing ? (
        <EditionForm group={group} data={data} meetings={list.meetings} templates={templates} onTemplates={onTemplates} edition={editing}
          onDone={() => { setEditing(null); load(); }} />
      ) : list.editions.length === 0 ? (
        <Card className="p-5 text-sm text-slate-500 dark:text-neutral-400">No Special Editions yet.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.editions.map((e) => (
            <Card key={e.id} className="flex gap-4 p-4">
              <FlatChip chip={sample(e, e.design)} size={84} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-white">{e.name} {status(e)}</div>
                <p className="text-sm text-slate-500 dark:text-neutral-400">
                  {e.kind === "milestone" ? "Milestones" : `${e.target_count} meetings`}, {e.window_label}
                  <br />{e.issued.toLocaleString()}{e.limit ? ` of ${e.limit.toLocaleString()}` : ""} out{e.how_many === "given_n" ? ", given by hosts" : ""}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" className={quietButton} onClick={() => setEditing(e)}>{e.locked ? "Open" : "Edit"}</button>
                  {list.open && <button type="button" className={quietButton} onClick={() => duplicate(e)}><Copy className="size-4" /> Duplicate</button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function EditionForm({ group, data, meetings, templates, onTemplates, edition, onDone }) {
  const [e, setE] = useState(() => {
    const m = edition.design.meeting;
    return { ...edition, design: { ...edition.design, meeting: { ...m, sides: [m.sides[0], m.sides[1], m.sides[2] === edition.name ? "" : m.sides[2]] } } };
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setE((x) => ({ ...x, ...patch }));
  const setRound = (patch) => setE((x) => ({ ...x, design: { ...x.design, round: { ...x.design.round, ...patch } } }));
  const setMeeting = (patch) => setE((x) => ({ ...x, design: { ...x.design, meeting: { ...x.design.meeting, ...patch } } }));
  const locked = e.locked;
  const milestone = e.kind === "milestone";
  const year = Number((e.starts_on || today()).slice(0, 4));

  const preset = (window) => {
    const y = new Date().getFullYear();
    if (window === "year") set({ window, starts_on: `${y}-01-01`, ends_on: `${y}-12-31` });
    else if (window === "month") { const d = new Date(); const s = iso(new Date(d.getFullYear(), d.getMonth(), 1)); set({ window, starts_on: s, ends_on: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }); }
    else if (window === "week") set({ window, starts_on: today(), ends_on: addDays(today(), 6) });
    else if (window === "holiday") { const [s, en] = HOLIDAYS[2].on(y); set({ window, holiday: "thanksgiving", starts_on: s, ends_on: en }); }
    else set({ window });
  };

  const body = () => ({
    edition: { name: e.name, kind: e.kind, starts_on: e.starts_on, ends_on: e.ends_on, window: e.window, milestones: e.milestones, meeting_ids: e.meeting_ids,
      target_count: e.target_count, how_many: e.how_many, limit: e.limit, numbered: e.numbered, ...(locked ? {} : { design: storedDesign(e.design) }) },
  });
  const save = async (publish = false) => {
    setBusy(true);
    setError(null);
    try {
      const d = e.id
        ? await api(`/groups/${group.slug}/chip_editions/${e.id}`, { method: "PATCH", body: body() })
        : await api(`/groups/${group.slug}/chip_editions`, { method: "POST", body: body() });
      if (publish) {
        if (!window.confirm(`Publish ${d.edition.name}? ${group.title}'s members get a notification about it.`)) { set({ id: d.edition.id }); setBusy(false); return; }
        await api(`/groups/${group.slug}/chip_editions/${d.edition.id}/publish`, { method: "POST" });
      }
      onDone();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${e.name}?`)) return;
    try { await api(`/groups/${group.slug}/chip_editions/${e.id}`, { method: "DELETE" }); onDone(); } catch (err) { setError(err.message); }
  };
  const toggle = (key, value) => set({ [key]: e[key].includes(value) ? e[key].filter((x) => x !== value) : [...e[key], value] });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="min-w-0 space-y-4 p-4 sm:p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white">{milestone ? "Milestone edition" : "Meeting Maker edition"}</h3>
        {locked && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">{e.issued} of these are out, so its look and name stay as they are. You can still move the end date or allow more.</p>}
        <div>
          <label htmlFor="ed-name" className={labelClass}>Name</label>
          <input id="ed-name" maxLength={40} disabled={locked} className={inputClass} value={e.name} placeholder={milestone ? "2027 Edition" : "30 in 30"} onChange={(x) => set({ name: x.target.value })} />
          <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Goes on the back with its number, like "{(e.name || "2027 Edition").toUpperCase()} · NO. 014{e.how_many !== "everyone" ? ` OF ${e.limit}` : ""}".</p>
        </div>

        <div>
          <div className={labelClass}>When</div>
          <div className={segment}>
            <SegmentedControl value={e.window} onChange={preset} options={[{ value: "year", label: "A year" }, { value: "month", label: "A month" }, { value: "week", label: "A week" }, { value: "holiday", label: "A holiday" }, { value: "custom", label: "Custom" }]} />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {e.window === "year" && (
              <div><label htmlFor="ed-year" className={labelClass}>Year</label>
                <input id="ed-year" type="number" min={2000} max={2100} disabled={locked} className={inputClass} value={year} onChange={(x) => set({ starts_on: `${x.target.value}-01-01`, ends_on: `${x.target.value}-12-31` })} /></div>
            )}
            {e.window === "month" && (
              <div><label htmlFor="ed-month" className={labelClass}>Month</label>
                <input id="ed-month" type="month" disabled={locked} className={inputClass} value={e.starts_on.slice(0, 7)}
                  onChange={(x) => { const [y, m] = x.target.value.split("-").map(Number); if (y) set({ starts_on: iso(new Date(y, m - 1, 1)), ends_on: iso(new Date(y, m, 0)) }); }} /></div>
            )}
            {e.window === "holiday" && (
              <div><label htmlFor="ed-holiday" className={labelClass}>Holiday</label>
                <select id="ed-holiday" disabled={locked} className={selectClass} value={e.holiday || ""}
                  onChange={(x) => { const h = HOLIDAYS.find((v) => v.key === x.target.value); const [s, en] = h.on(year); set({ holiday: h.key, starts_on: s, ends_on: en }); }}>
                  <option value="" disabled>Pick one</option>
                  {HOLIDAYS.map((h) => <option key={h.key} value={h.key}>{h.label}</option>)}
                </select></div>
            )}
            <div><label htmlFor="ed-start" className={labelClass}>Starts</label>
              <input id="ed-start" type="date" disabled={locked} className={inputClass} value={e.starts_on} onChange={(x) => set({ starts_on: x.target.value, ...(e.window === "week" ? { ends_on: addDays(x.target.value, 6) } : {}) })} /></div>
            <div><label htmlFor="ed-end" className={labelClass}>Ends</label>
              <input id="ed-end" type="date" min={e.starts_on} className={inputClass} value={e.ends_on} onChange={(x) => set({ ends_on: x.target.value })} /></div>
          </div>
        </div>

        {milestone ? (
          <fieldset disabled={locked}>
            <legend className={labelClass}>For</legend>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-neutral-200 dark:ring-neutral-700">
                <input type="checkbox" checked={e.milestones.length === 0} onChange={() => set({ milestones: [] })} className="accent-[var(--color-accent)]" /> Every milestone
              </label>
              {MILESTONES.map(([k, l]) => (
                <label key={k} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-neutral-200 dark:ring-neutral-700">
                  <input type="checkbox" checked={e.milestones.includes(k)} onChange={() => toggle("milestones", k)} className="accent-[var(--color-accent)]" /> {l}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Reached between the start and end dates.</p>
          </fieldset>
        ) : (
          <fieldset disabled={locked} className="space-y-2">
            <div className="w-40">
              <label htmlFor="ed-count" className={labelClass}>Meetings to make</label>
              <input id="ed-count" type="number" min={1} max={1000} className={inputClass} value={e.target_count} onChange={(x) => set({ target_count: Number(x.target.value) })} />
            </div>
            <div>
              <div className={labelClass}>At</div>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-neutral-200 dark:ring-neutral-700">
                  <input type="checkbox" checked={e.meeting_ids.length === 0} onChange={() => set({ meeting_ids: [] })} className="accent-[var(--color-accent)]" /> Any of the group's meetings
                </label>
                {meetings.map((m) => (
                  <label key={m.id} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-neutral-200 dark:ring-neutral-700">
                    <input type="checkbox" checked={e.meeting_ids.includes(m.id)} onChange={() => toggle("meeting_ids", m.id)} className="accent-[var(--color-accent)]" /> {m.name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Clicking Join in the half hour before it starts, as for Meeting Maker chips. It's given on its own.</p>
            </div>
          </fieldset>
        )}

        <div>
          <div className={labelClass}>How many</div>
          <fieldset disabled={locked} className={segment}>
            <SegmentedControl value={e.how_many} onChange={(v) => set({ how_many: v })}
              options={[{ value: "everyone", label: "Everyone who qualifies" }, { value: "first_n", label: milestone ? "The first to claim" : "The first to earn" },
                ...(milestone ? [{ value: "given_n", label: "Given by hosts" }] : [])]} />
          </fieldset>
          {e.how_many !== "everyone" && (
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
              Only <input type="number" min={Math.max(1, e.issued || 0)} max={100000} aria-label="How many" className={`${inputClass} !w-28`} value={e.limit || ""} onChange={(x) => set({ limit: Number(x.target.value) })} />
              {e.how_many === "given_n" ? "chips, and only hosts give them (Give a chip)." : "chips. When they're gone, they're gone."}
            </div>
          )}
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
            <input type="checkbox" disabled={locked} checked={e.numbered} onChange={(x) => set({ numbered: x.target.checked })} className="size-4 accent-[var(--color-accent)]" />
            Number each one, in the order they're claimed, earned or given
          </label>
        </div>

        <fieldset disabled={locked} className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <legend className="sr-only">Its look</legend>
          <div className="font-semibold text-slate-900 dark:text-white">Its look</div>
          {milestone ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="ed-top" className={labelClass}>Around the top</label>
                  <input id="ed-top" maxLength={40} className={inputClass} value={e.design.round.top_text} onChange={(x) => setRound({ top_text: x.target.value })} /></div>
                <div><label htmlFor="ed-bottom" className={labelClass}>Around the bottom</label>
                  <input id="ed-bottom" maxLength={40} className={inputClass} value={e.design.round.bottom_text} onChange={(x) => setRound({ bottom_text: x.target.value })} /></div>
              </div>
              <div><label htmlFor="ed-back" className={labelClass}>On the back</label>
                <textarea id="ed-back" rows={3} maxLength={240} className={inputClass} value={e.design.round.back_text} onChange={(x) => setRound({ back_text: x.target.value })} /></div>
              <div>
                <div className={labelClass}>In the middle</div>
                <div className={segment}>
                  <SegmentedControl value={e.design.round.emblem === "scene" ? "scene" : "group"}
                    onChange={(v) => setRound(v === "scene" ? { emblem: "scene" } : { emblem: data.design.round.emblem === "scene" ? "triangle" : data.design.round.emblem, scene: undefined })}
                    options={[{ value: "group", label: "Like the group's chips" }, { value: "scene", label: "Illustration" }]} />
                </div>
              </div>
              {e.design.round.emblem === "scene" && !locked && (
                <SceneControls slug={group.slug} base={data.default} templates={templates} onTemplates={onTemplates} fits="round" part={e.design.round} onChange={setRound} />
              )}
            </>
          ) : (
            <MeetingPartForm id="edition" slug={group.slug} base={data.default} templates={templates} onTemplates={onTemplates} part={e.design.meeting} set={setMeeting} />
          )}
        </fieldset>

        <ErrorNote error={error} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {e.id && !locked ? <button type="button" className={dangerButton} onClick={remove}><Trash2 className="size-4" /> Delete</button> : <span />}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={quietButton} onClick={onDone} disabled={busy}>Cancel</button>
            <button type="button" className={e.published ? primaryButton : quietButton} onClick={() => save(false)} disabled={busy}>{e.published ? "Save" : "Save draft"}</button>
            {!e.published && <button type="button" className={primaryButton} onClick={() => save(true)} disabled={busy}><Send className="size-4" /> Publish</button>}
          </div>
        </div>
      </Card>
      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl bg-gradient-to-b from-stone-800 to-stone-950 py-5 text-center text-white">
          <SpinningChip key={`${e.kind}-${e.design.meeting.shape}`} chip={{ ...sample(e, e.design), group: { title: group.title, logo_url: group.logo_url || data.logo_url } }} size={190} />
          <div className="mt-1 text-xs opacity-60">Drag to spin it. Its number goes on the back.</div>
        </div>
      </aside>
    </div>
  );
}
