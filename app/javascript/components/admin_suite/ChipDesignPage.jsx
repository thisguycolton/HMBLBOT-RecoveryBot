import React, { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { RoundChip } from "../recovery/Chip";
import { SpinningChip } from "../recovery/ChipModal";
import RoundPartForm from "../chips/RoundPartForm";
import { storedDesign } from "../chips/lib";
import { Card } from "./App";

const PREVIEWS = [
  { key: "24h", label: "24 hours" }, { key: "30d", label: "30 days" }, { key: "60d", label: "60 days" },
  { key: "90d", label: "90 days" }, { key: "6m", label: "6 months" }, { key: "9m", label: "9 months" },
  { key: "18m", label: "18 months" }, { key: "year", years: 1, label: "1 year" }, { key: "year", years: 5, label: "5 years" },
];

// Site Admin > Sobriety chips: how RecoveryBot's own round chips look, the ones every member
// earns on their own (ChipDesign.for_site, Api::Admin::ChipDesignsController). The same choices
// as a group's round chips (RoundPartForm), except a group's logo: there's no group. Saving changes chips earned from now on;
// chips already earned keep the look they were earned in.
export default function ChipDesignPage({ notify }) {
  const [data, setData] = useState(null);
  const [design, setDesign] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pick, setPick] = useState(PREVIEWS[7]);
  const load = (d) => { setData(d); setDesign(d.design); setTemplates(d.templates || []); setDirty(false); };
  useEffect(() => { api("/chip_design").then(load).catch((e) => notify(e.message, "error")); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!design) return <p className="py-16 text-center text-sm text-slate-500 !font-sans">Loading…</p>;
  const set = (patch) => { setDesign((d) => ({ ...d, round: { ...d.round, ...patch } })); setDirty(true); };
  const put = async (body, note) => {
    setBusy(true);
    try {
      load(await api("/chip_design", { method: "PUT", body }));
      notify(note);
    } catch (e) { notify(e.message, "error"); } finally { setBusy(false); }
  };
  const reset = () => window.confirm("Go back to the plain RecoveryBot chips? Chips already earned keep their look.")
    && put({ reset: true }, "Back to the plain chips.");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-slate-600 dark:text-neutral-300 !font-sans">
          The round chips every member earns for their sobriety milestones. Changes show on chips earned from now on; chips already earned keep their look.
        </p>
        {data.customized && <button type="button" className={buttonClass.secondary} disabled={busy} onClick={reset}><RotateCcw className="size-4" /> Plain chips</button>}
        <button type="button" className={buttonClass.primary} disabled={busy || !dirty} onClick={() => put({ design: storedDesign({ round: design.round }) }, "Saved. Chips earned from now on look like this.")}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Sobriety chips" subtitle="24 hours, 30, 60 and 90 days, 6, 9 and 18 months, and every year.">
          <div className="space-y-4">
            <RoundPartForm design={design} set={set} base={data.default} templates={templates} onTemplates={setTemplates}
              ringTop="Left blank" backNote="Around it go the words below, or the day the chip was earned."
              uploadRelief={(svg) => api("/chip_design/relief", { method: "POST", body: { svg } })} />
          </div>
        </Card>
        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <Card title="Preview">
            <div className="rounded-xl bg-gradient-to-b from-stone-800 to-stone-950 py-5 text-center text-white">
              <SpinningChip key={`${pick.key}-${pick.years || 0}`} size={170}
                chip={{ id: "preview", shape: "round", kind: "round", milestone: pick, label: pick.label, on: new Date().toISOString().slice(0, 10), design }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PREVIEWS.map((m) => (
                <button type="button" key={`${m.key}-${m.years || 0}`} onClick={() => setPick(m)} className="flex flex-col items-center gap-1 !bg-transparent">
                  <RoundChip design={design} milestone={m} size={84} />
                  <span className="text-[0.7rem] text-slate-500 !font-sans dark:text-neutral-400">{m.label}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
