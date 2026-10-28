import React, { useEffect, useState } from "react";
import { Paintbrush, RotateCcw, Upload } from "lucide-react";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass } from "../ui/styles";
import { RoundChip } from "../recovery/Chip";
import { FlatChip, SpinningChip } from "../recovery/ChipModal";
import SceneControls from "../chips/SceneControls";
import MeetingPartForm, { ColorField } from "../chips/MeetingPartForm";
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

const segment = "overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700";

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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="c-top" className={labelClass}>Around the top</label>
              <input id="c-top" maxLength={40} className={inputClass} value={design.round.top_text} onChange={(e) => round({ top_text: e.target.value })} />
            </div>
            <div>
              <label htmlFor="c-bottom" className={labelClass}>Around the bottom</label>
              <input id="c-bottom" maxLength={40} className={inputClass} value={design.round.bottom_text} onChange={(e) => round({ bottom_text: e.target.value })} />
            </div>
          </div>
          <div>
            <label htmlFor="c-back" className={labelClass}>On the back</label>
            <textarea id="c-back" rows={5} maxLength={240} className={inputClass} value={design.round.back_text} onChange={(e) => round({ back_text: e.target.value })} />
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Each line here is a line on the chip. Around it go the words below, or the group's name and the day the chip was earned.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="c-ring-top" className={labelClass}>Around the back, top</label>
              <input id="c-ring-top" maxLength={40} className={inputClass} placeholder={group.title} value={design.round.back_ring_top || ""} onChange={(e) => round({ back_ring_top: e.target.value })} />
            </div>
            <div>
              <label htmlFor="c-ring-bottom" className={labelClass}>Around the back, bottom</label>
              <input id="c-ring-bottom" maxLength={40} className={inputClass} placeholder="The day it was earned" value={design.round.back_ring_bottom || ""} onChange={(e) => round({ back_ring_bottom: e.target.value })} />
            </div>
          </div>
          <div>
            <div className={labelClass}>In the middle</div>
            <div className={segment}>
              <SegmentedControl value={design.round.emblem} onChange={(v) => round({ emblem: v })}
                options={[{ value: "triangle", label: "Circle and triangle" }, { value: "scene", label: "Illustration" }, { value: "logo", label: "Group logo" }, { value: "relief", label: "Raised logo" }, { value: "none", label: "Just the number" }]} />
            </div>
            {design.round.emblem === "logo" && !logoUrl && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">The group has no logo yet, so chips show the circle and triangle. Add one in Group settings.</p>}
            {design.round.emblem === "relief" && <ReliefUpload slug={group.slug} relief={design.round.relief} onChange={(relief) => round({ relief })} />}
            {design.round.emblem === "relief" && design.round.relief && <ReliefControls r={design.round} set={round} />}
            {design.round.emblem === "scene" && (
              <div className="mt-3">
                <SceneControls slug={group.slug} base={data.default} templates={templates} onTemplates={setTemplates} fits="round" part={design.round} onChange={round} />
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {design.round.emblem !== "scene" && <div>
              <div className={labelClass}>Finish</div>
              <div className={segment}>
                <SegmentedControl value={design.round.finish} onChange={(v) => round({ finish: v })}
                  options={[{ value: "classic", label: "Classic" }, { value: "plastic", label: "Colored" }, { value: "metal", label: "Metal" }]} />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Classic: colored chips for the months, metal medallions for the years.</p>
            </div>}
            <div>
              <div className={labelClass}>Years</div>
              <div className={segment}>
                <SegmentedControl value={design.round.numerals} onChange={(v) => round({ numerals: v })}
                  options={[{ value: "roman", label: "Roman (IV)" }, { value: "number", label: "Number (4)" }]} />
              </div>
            </div>
          </div>
          {design.round.emblem !== "scene" && <div>
            <div className={labelClass}>Colors</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ROUND.map((m) => (
                <ColorField key={m.key} label={m.label} value={design.round.colors[m.key]} fallback={data.default.round.colors[m.key]}
                  onChange={(v) => round({ colors: { ...design.round.colors, [m.key]: v } })} />
              ))}
            </div>
          </div>}
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


// The raised logo: an SVG the group uploads, turned into outlines on the server (ChipRelief) and
// pressed into the chip in its own color. Dark parts stand highest, lighter ones lower, white
// none. Saved with the rest of the design.
function ReliefUpload({ slug, relief, onChange }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const d = await api(`/groups/${slug}/chips/relief`, { method: "POST", body: { svg: await file.text() } });
      onChange(d.relief);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return (
    <div className="mt-2 space-y-2">
      <label className={`${quietButton} cursor-pointer`}>
        <Upload className="size-4" /> {busy ? "Reading…" : relief ? "Upload a different SVG" : "Upload an SVG"}
        <input type="file" accept=".svg,image/svg+xml" className="sr-only" onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
      </label>
      <p className="text-xs text-slate-500 dark:text-neutral-400">
        Your logo, pressed into the chip like a stamped coin. The darker a part of the SVG, the higher it stands; white parts stay flat.
        Turn any text into outlines first. {!relief && "Until there's one, chips show the circle and triangle."}
      </p>
      <ErrorNote error={error} />
    </div>
  );
}

// How the raised logo sits: raised or cut in, how big, and on metal chips how high (or deep)
// and how sharply it rises from the coin (ChipDesign relief_* settings)
function ReliefControls({ r, set }) {
  const slider = (key, label, min, max, low, high) => (
    <label className="block">
      <span className="flex items-baseline justify-between text-xs font-medium text-slate-600 dark:text-neutral-300">
        {label} <span className="tabular-nums text-slate-400">{r[key]}</span>
      </span>
      <input type="range" min={min} max={max} value={r[key]} onChange={(e) => set({ [key]: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
      <span className="flex justify-between text-[11px] text-slate-400"><span>{low}</span><span>{high}</span></span>
    </label>
  );
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900/60">
      <div className={segment}>
        <SegmentedControl value={r.relief_depth} onChange={(v) => set({ relief_depth: v })} options={[{ value: "raised", label: "Raised" }, { value: "inset", label: "Cut in" }]} />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
        <input type="checkbox" checked={!!r.relief_badge} onChange={(e) => set({ relief_badge: e.target.checked, ...(e.target.checked && r.relief_size < 72 ? { relief_size: 84 } : {}) })} className="size-4 accent-[var(--color-accent)]" />
        A circle over the middle of the logo with the time in it
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {slider("relief_size", "Size", 40, r.relief_badge ? 96 : 84, "Small", "Large")}
        {slider("relief_height", r.relief_depth === "inset" ? "Depth" : "Height", 1, 10, "Shallow", "Deep")}
        {slider("relief_sharpness", "Sharpness", 1, 10, "Soft slope", "Sharp edge")}
      </div>
      <p className="text-xs text-slate-500 dark:text-neutral-400">
        Height and sharpness shape metal chips, where the logo is struck into the coin. Colored chips get a slight print of it in one color.
      </p>
    </div>
  );
}
