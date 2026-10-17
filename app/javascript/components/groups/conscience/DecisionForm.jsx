import React, { useState } from "react";
import { Save } from "lucide-react";
import Markdown from "../../book/Markdown";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import { api } from "../lib";
import { Card, ErrorNote, primaryButton, quietButton } from "../ui";
import { CATEGORIES, MOTION_STATUSES, NAMES_REMINDER, countLabel, dateLabel } from "./lib";

const today = () => new Date().toLocaleDateString("en-CA");
const blank = () => ({
  title: "", text: "", category: "other", status: "passed", decided_on: today(), moved_by_name: "", seconded_by_name: "",
  votes_for: "", votes_against: "", abstentions: "", minority_opinion: "", supersedes_id: "", visibility: "members",
  business_meeting_id: "", agenda_item_id: "",
});

// Recording a decision (record keepers), or changing one. `motions` are the group's other
// decisions, for "what it replaces". `preset` fills it in for a decision made at a business
// meeting (its agenda item, its date).
export default function DecisionForm({ group, motion = null, motions, preset = null, onSaved, onCancel }) {
  const [form, setForm] = useState(() => (motion
    ? Object.fromEntries(Object.keys(blank()).map((k) => {
        const source = { moved_by_name: motion.moved_by, seconded_by_name: motion.seconded_by }[k] ?? motion[k];
        return [k, source ?? ""];
      }))
    : { ...blank(), ...preset }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const needsDate = ["passed", "failed", "tabled"].includes(form.status);
  const replaceable = motions.filter((m) => m.id !== motion?.id && m.status === "passed");

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (form.visibility === "public" && motion?.visibility !== "public" && !window.confirm("This will be visible to anyone who opens the group's page. Save it as Public?")) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await api(`/groups/${group.slug}/motions${motion ? `/${motion.id}` : ""}`, { method: motion ? "PATCH" : "POST", body: { motion: form } });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const field = (id, label, input, hint) => (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {input}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={save} className="space-y-4">
        <h3 className="!text-base font-semibold text-slate-900 dark:text-white">{motion ? "Change this decision" : "Record a decision"}</h3>
        <ErrorNote error={error} />
        {field("m-title", "What was decided", <input id="m-title" required autoFocus maxLength={160} className={inputClass} value={form.title} onChange={set("title")} placeholder="e.g. Send 7th Tradition 60/30/10" />)}
        {field("m-text", "The motion, as worded", (
          <div className="grid gap-3 lg:grid-cols-2">
            <textarea id="m-text" rows={5} maxLength={10000} className={`${inputClass} font-mono !text-[13px]`} value={form.text} onChange={set("text")} placeholder="Markdown works." />
            {form.text.trim() && <div className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800"><Markdown source={form.text} className="ev-md text-sm text-slate-800 dark:text-neutral-200" /></div>}
          </div>
        ), NAMES_REMINDER)}
        <div className="grid gap-3 sm:grid-cols-3">
          {field("m-status", "Outcome", <select id="m-status" className={selectClass} value={form.status} onChange={set("status")}>{MOTION_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>)}
          {field("m-date", "Decided on", <input id="m-date" type="date" required={needsDate} className={inputClass} value={form.decided_on} onChange={set("decided_on")} />)}
          {field("m-category", "Kind of decision", <select id="m-category" className={selectClass} value={form.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("m-moved", "Moved by", <input id="m-moved" maxLength={80} className={inputClass} value={form.moved_by_name} onChange={set("moved_by_name")} placeholder="First name, last initial" />)}
          {field("m-seconded", "Seconded by", <input id="m-seconded" maxLength={80} className={inputClass} value={form.seconded_by_name} onChange={set("seconded_by_name")} placeholder="First name, last initial" />)}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {field("m-for", "For", <input id="m-for" type="number" min="0" max="9999" className={inputClass} value={form.votes_for} onChange={set("votes_for")} />)}
          {field("m-against", "Against", <input id="m-against" type="number" min="0" max="9999" className={inputClass} value={form.votes_against} onChange={set("votes_against")} />)}
          {field("m-abstain", "Abstained", <input id="m-abstain" type="number" min="0" max="9999" className={inputClass} value={form.abstentions} onChange={set("abstentions")} />)}
        </div>
        <p className="-mt-2 text-xs text-slate-500 dark:text-neutral-400">As counted in the room. Leave them blank for a past decision nobody wrote the count of.</p>
        {field("m-replaces", "It replaces", (
          <select id="m-replaces" className={selectClass} value={form.supersedes_id ?? ""} onChange={set("supersedes_id")}>
            <option value="">Nothing (a new decision)</option>
            {replaceable.map((m) => <option key={m.id} value={m.id}>{m.title}{m.decided_on ? ` (${dateLabel(m.decided_on)})` : ""}</option>)}
          </select>
        ), "Once this passes, the decision it replaces shows as replaced.")}
        {field("m-minority", "Minority opinion (optional)", <textarea id="m-minority" rows={3} maxLength={5000} className={inputClass} value={form.minority_opinion} onChange={set("minority_opinion")} />, "Anyone in the minority may have theirs heard and recorded here before a re-vote (Concept V).")}
        {field("m-visibility", "Who can see it", (
          <select id="m-visibility" className={selectClass} value={form.visibility} onChange={set("visibility")}>
            <option value="members">Members</option>
            <option value="public">Public (anyone who opens the group's page, once it passed)</option>
          </select>
        ))}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <button type="button" onClick={onCancel} className={quietButton}>Cancel</button>
          <button type="submit" disabled={saving || !form.title.trim()} className={primaryButton}><Save className="size-4" /> {saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Card>
  );
}
