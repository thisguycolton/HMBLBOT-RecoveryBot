import React, { useEffect, useState } from "react";
import { Paintbrush, RotateCcw } from "lucide-react";
import { RoundChip } from "../recovery/Chip";
import { FlatChip, SpinningChip } from "../recovery/ChipModal";
import MeetingPartForm from "../chips/MeetingPartForm";
import RoundPartForm from "../chips/RoundPartForm";
import ChipEditions from "./ChipEditions";
import { storedDesign as stored } from "../chips/lib";
import { api } from "./lib";
import { Card, ErrorNote, Loading, primaryButton, quietButton } from "./ui";

// The round chips, in order, as lib/milestones.js names them (ChipDesign::ROUND_KEYS)
const ROUND = [
  { key: "24h", label: "24 hours" },
  { key: "30d", label: "30 days" },
  { key: "60d", label: "60 days" },
  { key: "90d", label: "90 days" },
  { key: "6m", label: "6 months" },
  { key: "9m", label: "9 months" },
  { key: "year", years: 1, label: "Years" },
  { key: "18m", label: "18 months" },
];


// Group dashboard > Chips (group admins): how the round chips the group's hosts give look
// (Give a chip, /recovery/give), drawn as they'll get them, and each meeting's Meeting Maker
// chips. Saved to groups.chip_design and meetings.chip_design (Api::GroupChipsController); only
// what differs from RecoveryBot's design is kept. Chips members earn themselves stay plain.
export default function ChipDesigner({ group }) {
  const [data, setData] = useState(null);
  const [design, setDesign] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [pick, setPick] = useState({ kind: "round", milestone: { key: "year", years: 1, label: "1 year" } }); // the chip shown in 3D
  useEffect(() => {
    api(`/groups/${group.slug}/chips`).then((d) => { setData(d); setDesign(d.design); setTemplates(d.templates || []); }).catch((e) => setError(e.message));
  }, [group.slug]);

  if (!design) return error ? <ErrorNote error={error} /> : <Loading />;
  const round = (patch) => { setDesign((d) => ({ ...d, round: { ...d.round, ...patch } })); setSaved(false); };
  const logoUrl = group.logo_url || data.logo_url;

  const put = async (body) => {
    setSaving(true);
    setError(null);
    try {
      const d = await api(`/groups/${group.slug}/chips`, { method: "PUT", body });
      setData(d);
      setDesign((x) => ({ ...d.design, meeting: body.reset ? d.design.meeting : x.meeting }));
      setSaved(true);
    } catch (e) { setError(e.message); }
    setSaving(false);
  };
  const reset = () => window.confirm("Go back to RecoveryBot's chips? Your colors and words here are cleared.") && put({ reset: true });

  return (
    <div className="space-y-8">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form onSubmit={(e) => { e.preventDefault(); put({ design: stored({ ...design, meeting: data.design.meeting }) }); }} className="min-w-0 space-y-4">
        <p className="text-sm text-slate-600 dark:text-neutral-400">
          The chips {group.title}'s hosts give come in this design. Chips members earn on their own stay RecoveryBot's plain ones.
          Nobody else sees a member's chips, and you don't either.
        </p>

        <Card className="space-y-4 p-4 sm:p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white">Round chips</h2>
          <p className="-mt-2 text-sm text-slate-500 dark:text-neutral-400">For sobriety milestones: 24 hours, 30, 60 and 90 days, 6, 9 and 18 months, and every year.</p>
          <RoundPartForm design={design} set={round} base={data.default} templates={templates} onTemplates={setTemplates} slug={group.slug} logo logoUrl={logoUrl}
            ringTop={group.title} backNote="Around it go the words below, or the group's name and the day the chip was earned."
            uploadRelief={(svg) => api(`/groups/${group.slug}/chips/relief`, { method: "POST", body: { svg } })} />
        </Card>

        <ErrorNote error={error} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {data.customized ? <button type="button" className={quietButton} onClick={reset} disabled={saving}><RotateCcw className="size-4" /> Use RecoveryBot's chips</button> : <span />}
          <div className="flex items-center gap-3">
            {saved && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Saved.</span>}
            <button type="submit" disabled={saving} className={primaryButton}>{saving ? "Saving…" : "Save chips"}</button>
          </div>
        </div>
      </form>

      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <Card className="space-y-4 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">How they'll look</h2>
          <div className="rounded-xl bg-gradient-to-b from-stone-800 to-stone-950 py-5 text-center text-white">
            <SpinningChip key={`${pick.milestone.key}-${pick.milestone.years || 0}`} size={170}
              chip={{ id: "preview", shape: "round", kind: "round", milestone: pick.milestone, label: pick.milestone.label, on: new Date().toISOString().slice(0, 10), design, group: { title: group.title, logo_url: logoUrl } }} />
            <div className="mt-1 text-xs opacity-60">Drag to spin it. Tap a chip below to pick it up.</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[...ROUND.filter((m) => m.key !== "year"), { key: "year", years: 1, label: "1 year" }, { key: "year", years: 12, label: "12 years" }].map((m) => (
              <button type="button" key={`${m.key}-${m.years || 0}`} onClick={() => setPick({ kind: "round", milestone: m })} className="flex flex-col items-center gap-1 !bg-transparent">
                <RoundChip design={design} milestone={m} logoUrl={logoUrl} size={96} />
                <span className="text-[0.7rem] text-slate-500 dark:text-neutral-400">{m.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </aside>
    </div>
    <MeetingChips group={group} data={data} design={design} setDesign={setDesign} templates={templates} onTemplates={setTemplates} onSaved={setData} />
    <ChipEditions group={group} data={data} templates={templates} onTemplates={setTemplates} />
    </div>
  );
}

// Meeting Maker chips, for members who click a meeting's Join button in the half hour before
// it starts: the group's default (design.meeting, saved with the group's design), and each
// meeting's own when it wants one (meetings.chip_design; "Back to the group's default" clears it)
function MeetingChips({ group, data, design, setDesign, templates, onTemplates, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const part = design.meeting;
  const set = (patch) => { setDesign((d) => ({ ...d, meeting: { ...d.meeting, ...patch } })); setSaved(false); };
  // Saves only the Meeting Maker default, over the group's saved design
  const save = async (body) => {
    setBusy(true);
    setError(null);
    try {
      const d = await api(`/groups/${group.slug}/chips`, { method: "PUT", body: { design: stored({ ...data.design, ...body }) } });
      onSaved(d);
      setDesign((x) => ({ ...x, meeting: d.design.meeting }));
      setSaved(true);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold text-slate-900 dark:text-white">Meeting Maker chips</h2>
        <p className="text-sm text-slate-500 dark:text-neutral-400">
          Members earn these by clicking a meeting's Join button in the half hour before it starts, at 1, 5, 10, 25, 50 and 100 meetings, then every 100.
          Every meeting uses the group's default unless you give it its own. Chips already earned keep the look they were earned in.
        </p>
      </div>
      <Card className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_10rem] sm:p-5">
        <div className="min-w-0 space-y-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">The group's default</h3>
          <MeetingPartForm id="default" slug={group.slug} base={data.default} templates={templates} onTemplates={onTemplates} part={part} set={set} />
          <ErrorNote error={error} />
          <div className="flex flex-wrap items-center justify-end gap-3">
            {saved && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Saved.</span>}
            {data.meeting_customized && (
              <button type="button" className={quietButton} disabled={busy} onClick={() => save({ meeting: data.default.meeting })}><RotateCcw className="size-4" /> RecoveryBot's look</button>
            )}
            <button type="button" className={primaryButton} disabled={busy} onClick={() => save({ meeting: part })}>{busy ? "Saving…" : "Save the default"}</button>
          </div>
        </div>
        <MeetingPreview design={design} part={{ ...part, sides: [part.sides[0], part.sides[1], part.sides[2] || "Your meeting"] }} />
      </Card>
      {data.meetings.length === 0 && <Card className="p-5 text-sm text-slate-500">The group has no meetings listed yet.</Card>}
      {data.meetings.map((m) => (
        <MeetingChip key={m.id} group={group} data={data} meeting={m} templates={templates} onTemplates={onTemplates} onSaved={onSaved} />
      ))}
    </section>
  );
}

function MeetingChip({ group, data, meeting, templates, onTemplates, onSaved }) {
  const [part, setPart] = useState(meeting.design.meeting);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setPart((x) => ({ ...x, ...patch }));
  const put = async (body) => {
    setBusy(true);
    setError(null);
    try {
      const d = await api(`/groups/${group.slug}/chips/meetings/${meeting.id}`, { method: "PUT", body });
      onSaved(d);
      setPart(d.meetings.find((x) => x.id === meeting.id).design.meeting);
      setOpen(false);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const cancel = () => { setPart(meeting.design.meeting); setOpen(false); };
  return (
    <Card className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_10rem] sm:p-5">
      <div className="min-w-0 space-y-3">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{meeting.name}</h3>
          <p className="text-sm text-slate-500 dark:text-neutral-400">
            {meeting.schedule_label}{meeting.schedule_label && " · "}{meeting.customized ? "Its own chips" : "Uses the group's default"}
          </p>
        </div>
        {open && <MeetingPartForm id={meeting.id} slug={group.slug} base={data.default} templates={templates} onTemplates={onTemplates} part={part} set={set} />}
        <ErrorNote error={error} />
        <div className="flex flex-wrap items-center justify-end gap-3">
          {meeting.customized && !open && (
            <button type="button" className={quietButton} disabled={busy} onClick={() => put({ reset: true })}><RotateCcw className="size-4" /> Back to the group's default</button>
          )}
          {open ? (
            <>
              <button type="button" className={quietButton} disabled={busy} onClick={cancel}>Cancel</button>
              <button type="button" className={primaryButton} disabled={busy} onClick={() => put({ design: stored({ meeting: part }) })}>{busy ? "Saving…" : "Save"}</button>
            </>
          ) : (
            <button type="button" className={quietButton} onClick={() => setOpen(true)}><Paintbrush className="size-4" /> {meeting.customized ? "Change" : "Customize"}</button>
          )}
        </div>
      </div>
      <MeetingPreview design={meeting.design} part={part} />
    </Card>
  );
}

function MeetingPreview({ design, part }) {
  const chip = { id: "preview", shape: part.shape, kind: "meeting", count: 10, label: "10 meetings" };
  return (
    <div className="flex items-center justify-center">
      <FlatChip chip={chip} design={{ ...design, meeting: part }} size={140} />
    </div>
  );
}
