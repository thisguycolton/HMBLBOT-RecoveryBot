import React, { useEffect, useState } from "react";
import { Check, Flag, HandHeart, Search } from "lucide-react";
import { api } from "../groups/lib";
import { Card, ErrorNote, Pill, Tray, primaryButton, quietButton } from "../groups/ui";
import Avatar from "../groups/Avatar";
import ReportDialog from "../groups/chat/ReportDialog";
import { inputClass, labelClass } from "../ui/styles";
import { showToast } from "../../lib/toast";
import SponsorCheck from "../ui/SponsorCheck";

// Find a sponsor (Api::SponsorProfilesController#find): people in your groups who said they're
// available to sponsor, with what they wrote and picked, and Ask. Only ever people you share
// a group with; nobody else sees these.
// `group` (a slug): just that group's, on its Members tab, and nothing at all when nobody there is offering
export function FindSponsor({ onAsked, group }) {
  const [data, setData] = useState(null);
  const [asking, setAsking] = useState(null); // a card's id
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [reporting, setReporting] = useState(null);
  const load = () => api(`/sponsor_profile/find${group ? `?group=${encodeURIComponent(group)}` : ""}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const ask = async (s) => {
    setError(null);
    try {
      await api("/sponsorships", { method: "POST", body: { username: s.person.username, note } });
      showToast(`Asked ${s.person.name}.`, { tone: "success" });
      setAsking(null); setNote("");
      load(); onAsked?.();
    } catch (e) { setError(e.message); }
  };

  if (!data || (group && !data.sponsors.length)) return null;
  return (
    <Tray label={<span className="inline-flex items-center gap-1"><Search className="size-3.5" /> {group ? "Sponsors in this group" : "Find a sponsor"}</span>}>
      <div className="space-y-1.5">
        {data.sponsors.map((s) => (
          <Card key={s.id} className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <span className="relative h-fit shrink-0"><Avatar person={s.person} size={44} /><SponsorCheck on size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-white">{s.person.name} <SponsorCheck badge /></div>
                <div className="text-sm text-slate-500 dark:text-neutral-400">{[s.time_sober && `${s.time_sober} sober`, s.languages, s.groups.join(", ")].filter(Boolean).join(" · ")}</div>
              </div>
              {s.status === "active" ? <Pill tone="green">Your sponsor</Pill> : s.status === "pending" ? <Pill>Asked</Pill> : null}
            </div>
            {s.note && <p className="whitespace-pre-wrap text-slate-700 dark:text-neutral-200">{s.note}</p>}
            {s.picks.length > 0 && <div className="flex flex-wrap gap-1.5">{s.picks.map((p) => <Pill key={p}>{p}</Pill>)}</div>}
            {asking === s.id ? (
              <div className="space-y-2">
                <label htmlFor={`ask-${s.id}`} className={labelClass}>A note (optional)</label>
                <textarea id={`ask-${s.id}`} className={inputClass} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Hi, I'm Sam from the Tuesday meeting. I'm looking for a sponsor…" />
                <ErrorNote error={error} />
                <div className="flex justify-end gap-2">
                  <button type="button" className={quietButton} onClick={() => setAsking(null)}>Cancel</button>
                  <button type="button" className={primaryButton} onClick={() => ask(s)}>Ask {s.person.name}</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="inline-flex items-center gap-1 !bg-transparent p-0 text-xs text-slate-400 hover:text-rose-600" onClick={() => setReporting(s)}><Flag className="size-3.5" /> Report</button>
                {!s.status && <button type="button" className={primaryButton} onClick={() => { setAsking(s.id); setError(null); }}>Ask them to sponsor me</button>}
              </div>
            )}
          </Card>
        ))}
        {!data.sponsors.length && (
          <Card className="p-4 text-sm text-slate-600 dark:text-neutral-400">
            {data.in_groups
              ? "Nobody in your groups has said they're available to sponsor yet. Ask around at your meeting too; most sponsors are found in person."
              : "When you're in a group here, people in it who are available to sponsor show up here."}
          </Card>
        )}
      </div>
      {reporting && <ReportDialog subject={{ type: "sponsor_profile", id: reporting.id }} person={reporting.person} onClose={() => setReporting(null)} />}
    </Tray>
  );
}

// Your own offer: off until you turn it on, with your own words and picks
export function OfferToSponsor() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { api("/sponsor_profile").then((d) => { setData(d); setForm(d.profile); }).catch((e) => setError(e.message)); }, []);
  if (!data || !form) return null;
  const p = data.profile;
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setSaved(false); };
  const save = async (patch = {}) => {
    setSaving(true);
    setError(null);
    try {
      const d = await api("/sponsor_profile", { method: "PATCH", body: { ...form, ...patch } });
      setData(d); setForm(d.profile); setSaved(true);
    } catch (e) { setError(e.message); }
    setSaving(false);
  };
  const toggle = (pick) => set({ picks: form.picks.includes(pick) ? form.picks.filter((x) => x !== pick) : [...form.picks, pick] });

  return (
    <Tray label={<span className="inline-flex items-center gap-1"><HandHeart className="size-3.5" /> Available to sponsor</span>}>
      <Card className="space-y-4 p-4">
        {p.stopped ? (
          <p className="text-sm text-slate-600 dark:text-neutral-400">A site admin has turned this off for your account. If you think that's a mistake, use Contact at the bottom of the page.</p>
        ) : !p.old_enough ? (
          <p className="text-sm text-slate-600 dark:text-neutral-400">You can offer to sponsor once your account is a week old (from {new Date(`${p.can_start_on}T12:00:00`).toLocaleDateString([], { month: "long", day: "numeric" })}).</p>
        ) : (
          <>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" checked={!!form.available} onChange={(e) => { set({ available: e.target.checked }); save({ available: e.target.checked }); }} />
              <span>
                <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-white"><SponsorCheck size={18} className={form.available ? "" : "!bg-neutral-300 dark:!bg-neutral-600"} /> I'm available to sponsor</span>
                <span className="block text-sm text-slate-500 dark:text-neutral-400">
                  People in your groups see a green check by your name, like in the Zoom rooms, and find you under Find a sponsor. They can ask you. Nobody outside your groups does. You can say yes or not right now to each ask.
                </span>
              </span>
            </label>
            {p.full && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">You have {p.active_sponsees} sponsees, your limit, so you're not showing right now.</p>}
            <div>
              <label htmlFor="offer-note" className={labelClass}>In your own words</label>
              <textarea id="offer-note" className={inputClass} rows={3} maxLength={data.note_max} value={form.note || ""} onChange={(e) => set({ note: e.target.value })}
                placeholder="How you like to work the steps, how often you like to talk…" />
            </div>
            {Object.entries(data.picks).map(([group, options]) => (
              <div key={group} className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{group === "Who" ? "Who I'll sponsor" : group}</div>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((o) => (
                    <button key={o} type="button" aria-pressed={form.picks.includes(o)} onClick={() => toggle(o)}
                      className={`rounded-full px-3 py-1 text-sm ring-1 ${form.picks.includes(o) ? "!bg-accent !text-white ring-accent" : "!bg-white text-slate-700 ring-neutral-200 dark:!bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700"}`}>{o}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="offer-langs" className={labelClass}>Languages (optional)</label>
                <input id="offer-langs" className={inputClass} maxLength={120} value={form.languages || ""} placeholder="English, Spanish" onChange={(e) => set({ languages: e.target.value })} />
              </div>
              <div>
                <label htmlFor="offer-max" className={labelClass}>Most sponsees at once (optional)</label>
                <input id="offer-max" type="number" min={1} max={50} className={inputClass} value={form.max_sponsees ?? ""} onChange={(e) => set({ max_sponsees: e.target.value })} />
              </div>
            </div>
            {p.has_sobriety_date && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.show_time_sober} onChange={(e) => set({ show_time_sober: e.target.checked })} />
                Show how long I've been sober{p.time_sober ? ` (${p.time_sober})` : ""}
              </label>
            )}
            <ErrorNote error={error} />
            <div className="flex items-center justify-end gap-3">
              {saved && <span role="status" className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300"><Check className="size-4" /> Saved</span>}
              <button type="button" className={primaryButton} disabled={saving} onClick={() => save()}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </>
        )}
      </Card>
    </Tray>
  );
}
