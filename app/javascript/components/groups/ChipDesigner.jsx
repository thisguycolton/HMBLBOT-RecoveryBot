import React, { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass, labelClass } from "../ui/styles";
import { RoundChip, TriangleChip } from "../recovery/Chip";
import { SpinningChip } from "../recovery/ChipModal";
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
const TRIANGLES = [["inventory", "10th steps", 30], ["gratitude", "Gratitude lists", 90]];

const segment = "overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700";

// Group dashboard > Chips (group admins): how the chips look for every member who calls this
// their home group, with the chips drawn as they'll get them. Saved to groups.chip_design
// (Api::GroupChipsController); only what differs from RecoveryBot's design is kept.
export default function ChipDesigner({ group }) {
  const [data, setData] = useState(null);
  const [design, setDesign] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pick, setPick] = useState({ kind: "round", milestone: { key: "year", years: 1, label: "1 year" } }); // the chip shown in 3D
  useEffect(() => {
    api(`/groups/${group.slug}/chips`).then((d) => { setData(d); setDesign(d.design); }).catch((e) => setError(e.message));
  }, [group.slug]);

  if (!design) return error ? <ErrorNote error={error} /> : <Loading />;
  const round = (patch) => { setDesign((d) => ({ ...d, round: { ...d.round, ...patch } })); setSaved(false); };
  const triangle = (patch) => { setDesign((d) => ({ ...d, triangle: { ...d.triangle, ...patch } })); setSaved(false); };
  const logoUrl = group.logo_url || data.logo_url;

  const put = async (body) => {
    setSaving(true);
    setError(null);
    try {
      const d = await api(`/groups/${group.slug}/chips`, { method: "PUT", body });
      setData(d);
      setDesign(d.design);
      setSaved(true);
    } catch (e) { setError(e.message); }
    setSaving(false);
  };
  const reset = () => window.confirm("Go back to RecoveryBot's chips? Your colors and words here are cleared.") && put({ reset: true });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form onSubmit={(e) => { e.preventDefault(); put({ design }); }} className="min-w-0 space-y-4">
        <p className="text-sm text-slate-600 dark:text-neutral-400">
          Members who call {group.title} their home group get their chips in this design, on their Chips page and on the day they reach a milestone.
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
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Each line here is a line on the chip. Around it go the group's name and the day the chip was earned.</p>
          </div>
          <div>
            <div className={labelClass}>In the middle</div>
            <div className={segment}>
              <SegmentedControl value={design.round.emblem} onChange={(v) => round({ emblem: v })}
                options={[{ value: "triangle", label: "Circle and triangle" }, { value: "logo", label: "Group logo" }, { value: "none", label: "Just the number" }]} />
            </div>
            {design.round.emblem === "logo" && !logoUrl && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">The group has no logo yet, so chips show the circle and triangle. Add one in Group settings.</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className={labelClass}>Finish</div>
              <div className={segment}>
                <SegmentedControl value={design.round.finish} onChange={(v) => round({ finish: v })}
                  options={[{ value: "classic", label: "Classic" }, { value: "plastic", label: "Colored" }, { value: "metal", label: "Metal" }]} />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Classic: colored chips for the months, metal medallions for the years.</p>
            </div>
            <div>
              <div className={labelClass}>Years</div>
              <div className={segment}>
                <SegmentedControl value={design.round.numerals} onChange={(v) => round({ numerals: v })}
                  options={[{ value: "roman", label: "Roman (IV)" }, { value: "number", label: "Number (4)" }]} />
              </div>
            </div>
          </div>
          <div>
            <div className={labelClass}>Colors</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ROUND.map((m) => (
                <ColorField key={m.key} label={m.label} value={design.round.colors[m.key]} fallback={data.default.round.colors[m.key]}
                  onChange={(v) => round({ colors: { ...design.round.colors, [m.key]: v } })} />
              ))}
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-4 sm:p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white">Triangle chips</h2>
          <p className="-mt-2 text-sm text-slate-500 dark:text-neutral-400">For writing 10th steps and gratitude lists: the 1st, 7th, 30th, 90th, 180th and 365th, then every 365 more.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Left side", "Right side", "Bottom"].map((label, i) => (
              <div key={label}>
                <label htmlFor={`c-side-${i}`} className={labelClass}>{label}</label>
                <input id={`c-side-${i}`} maxLength={24} className={inputClass} value={design.triangle.sides[i] || ""}
                  onChange={(e) => triangle({ sides: design.triangle.sides.map((s, j) => (j === i ? e.target.value : s)) })} />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className={labelClass}>Finish</div>
              <div className={segment}>
                <SegmentedControl value={design.triangle.finish} onChange={(v) => triangle({ finish: v })}
                  options={[{ value: "plastic", label: "Colored" }, { value: "metal", label: "Metal" }]} />
              </div>
            </div>
            <div>
              <div className={labelClass}>Colors</div>
              <div className="grid grid-cols-2 gap-2">
                {TRIANGLES.map(([kind, label]) => (
                  <ColorField key={kind} label={label} value={design.triangle.colors[kind]} fallback={data.default.triangle.colors[kind]}
                    onChange={(v) => triangle({ colors: { ...design.triangle.colors, [kind]: v } })} />
                ))}
              </div>
            </div>
          </div>
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
            <SpinningChip key={pick.kind + (pick.milestone?.key || "") + (pick.milestone?.years || "")} chip={{ ...pick, on: new Date().toISOString().slice(0, 10) }}
              design={design} logoUrl={logoUrl} groupTitle={group.title} size={170} />
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
          <div className="grid grid-cols-2 gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            {TRIANGLES.map(([kind, label, count]) => (
              <button type="button" key={kind} onClick={() => setPick({ kind, count })} className="flex flex-col items-center gap-1 !bg-transparent">
                <TriangleChip design={design} kind={kind} count={count} size={130} />
                <span className="text-[0.7rem] text-slate-500 dark:text-neutral-400">{count} {label.toLowerCase()}</span>
              </button>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}

function ColorField({ label, value, fallback, onChange }) {
  return (
    <label className="flex items-center gap-2 rounded-xl px-2 py-1.5 ring-1 ring-neutral-200 dark:ring-neutral-700">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-7 shrink-0 cursor-pointer rounded-md border-0 !bg-transparent p-0" />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-neutral-200">{label}</span>
      {value !== fallback && (
        <button type="button" title="Back to the usual color" aria-label={`${label}: back to the usual color`} onClick={() => onChange(fallback)}
          className="!bg-transparent p-0 text-slate-400 hover:text-slate-700"><RotateCcw className="size-3.5" /></button>
      )}
    </label>
  );
}
