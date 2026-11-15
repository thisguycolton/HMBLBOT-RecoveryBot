import React, { useState } from "react";
import { Plus } from "lucide-react";
import { inputClass, selectClass } from "../../ui/styles";
import { api } from "../lib";
import { ErrorNote, Pill, primaryButton } from "../ui";
import { AGENDA_KINDS, AGENDA_KIND_LABELS } from "./lib";

const TONES = { suggested: "amber", on_agenda: "slate", tabled: "amber", done: "green" };

export function ItemPill({ item }) {
  if (item.status === "on_agenda") return null;
  return <Pill tone={TONES[item.status]}>{{ suggested: "Suggested", tabled: "Tabled", done: "Done" }[item.status]}</Pill>;
}

// An agenda for reading: numbered, with each item's kind and what it's about
export function AgendaList({ items, empty = "Nothing on the agenda yet." }) {
  if (!items?.length) return <p className="text-sm italic text-slate-500 dark:text-neutral-400">{empty}</p>;
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={item.id} className="flex gap-3">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-semibold text-accent">{i + 1}</span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`font-medium text-slate-900 dark:text-white ${item.status === "done" ? "line-through decoration-slate-400" : ""}`}>{item.title}</span>
              <ItemPill item={item} />
            </span>
            <span className="block text-xs text-slate-500 dark:text-neutral-400">{AGENDA_KIND_LABELS[item.kind]}{item.submitted_by ? ` · from ${item.submitted_by}` : ""}</span>
            {item.details && <span className="mt-0.5 block whitespace-pre-line text-sm text-slate-600 dark:text-neutral-300">{item.details}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const PRINT_HEADINGS = { report: "Reports", old_business: "Old business", new_business: "New business", other: "Other" };
// Business that gets voted on has room beside it to write the motion's outcome
const VOTED = new Set(["old_business", "new_business"]);

// The paper agenda: one lettered section per kind (reports, old business, new business, other),
// each item numbered from 1 within its section, with blanks to fill in the room for the ones voted on
const numeral = (n) => ROMAN[n] || String(n + 1);

// The elected offices' sections (from the server's officer_sections): the office, then its lines
function OfficerSections({ offices }) {
  return offices.map((o, n) => (
    <section key={`o${o.id}`} className="agenda-print__section">
      <h2>{numeral(n)}. {o.title}</h2>
      {o.lines.length > 0 && <ul>{o.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </section>
  ));
}

export function PrintAgenda({ items, offices = [] }) {
  const sections = AGENDA_KINDS.map((k) => ({ ...k, items: items.filter((i) => i.kind === k.key) })).filter((s) => s.items.length);
  if (!sections.length && !offices.length) return <p>Nothing on the agenda yet.</p>;
  return [<OfficerSections key="offices" offices={offices} />, ...sections.map((s, n) => (
    <section key={s.key} className="agenda-print__section">
      <h2>{numeral(n + offices.length)}. {offices.length && s.key === "report" ? "Other reports" : PRINT_HEADINGS[s.key]}</h2>
      <ol>
        {s.items.map((item, i) => (
          <li key={item.id}>
            <div className="agenda-print__title"><span>{i + 1}.</span> {item.title}{item.status === "done" ? " (done)" : item.status === "tabled" ? " (tabled)" : ""}</div>
            {item.submitted_by && item.kind !== "report" && <div className="agenda-print__by">Brought by {item.submitted_by}</div>}
            {item.details && <div className="meeting-print__wording">{item.details}</div>}
            {VOTED.has(s.key) && (
              <div className="agenda-print__blanks">
                <span>Moved</span><span>Seconded</span><span className="agenda-print__short">Yes</span><span className="agenda-print__short">No</span><span className="agenda-print__short">Abst.</span><span>Carried / Lost / Tabled</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  ))];
}

// The agenda as plain text, to paste into an email, a chat or a document: the same sections as
// the paper copy, with who brought each item
export function agendaText({ groupTitle, when, items, offices = [] }) {
  const lines = [groupTitle, "Group conscience agenda", when, ""];
  const sections = AGENDA_KINDS.map((k) => ({ ...k, items: items.filter((i) => i.kind === k.key) })).filter((s) => s.items.length);
  if (!sections.length && !offices.length) lines.push("Nothing on the agenda yet.");
  offices.forEach((o, n) => {
    lines.push(`${numeral(n)}. ${o.title}`);
    o.lines.forEach((l) => lines.push(`   • ${l}`));
    lines.push("");
  });
  sections.forEach((s, n) => {
    lines.push(`${numeral(n + offices.length)}. ${offices.length && s.key === "report" ? "Other reports" : PRINT_HEADINGS[s.key]}`);
    s.items.forEach((item, i) => {
      lines.push(`   ${i + 1}. ${item.title}${item.status === "done" ? " (done)" : item.status === "tabled" ? " (tabled)" : ""}`);
      if (item.submitted_by && item.kind !== "report") lines.push(`      Brought by ${item.submitted_by}`);
      if (item.details) item.details.split("\n").forEach((l) => lines.push(l.trim() ? `      ${l}` : ""));
    });
    lines.push("");
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Anyone in the group can suggest an item for a meeting that's coming up; record keepers are told
// and put it on the agenda. `onAdded` runs after it's sent.
export function SuggestForm({ slug, meetingId, onAdded, compact = false, keeper = false }) {
  const blank = { title: "", details: "", kind: "new_business", brought_by: "" };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setSent(false); };

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !form.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { brought_by, ...rest } = form;
      await api(`/groups/${slug}/business_meetings/${meetingId}/agenda_items`, { method: "POST", body: { agenda_item: keeper ? form : rest } });
      setForm(blank);
      setSent(true);
      onAdded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <ErrorNote error={error} />
      <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
        <input aria-label="Agenda item" required maxLength={160} className={inputClass} placeholder={keeper ? "Add an agenda item" : "Suggest an agenda item"} value={form.title} onChange={set("title")} />
        <select aria-label="Kind of item" className={`${selectClass} ${compact ? "" : "sm:!w-44"}`} value={form.kind} onChange={set("kind")}>
          {AGENDA_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
      </div>
      {form.title && keeper && <input aria-label="Brought by" maxLength={80} className={inputClass} placeholder="Brought by (first name, last initial). Leave blank if it was you." value={form.brought_by} onChange={set("brought_by")} />}
      {form.title && <textarea aria-label="Details" rows={2} maxLength={2000} className={inputClass} placeholder="A little about it (optional). First names and last initials only." value={form.details} onChange={set("details")} />}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !form.title.trim()} className={primaryButton}><Plus className="size-4" /> {keeper ? "Add it" : "Suggest it"}</button>
        {sent && <span role="status" className="text-xs text-emerald-700 dark:text-emerald-300">{keeper ? "Added to the agenda." : "Sent. The record keepers will see it."}</span>}
      </div>
    </form>
  );
}
