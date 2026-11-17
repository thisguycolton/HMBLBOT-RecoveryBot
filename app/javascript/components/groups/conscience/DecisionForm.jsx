import React, { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import Markdown from "../../book/Markdown";
import Toggle from "../../ui/Toggle";
import FilterPick from "../../ui/FilterPick";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import { api } from "../lib";
import { Card, ErrorNote, primaryButton, quietButton } from "../ui";
import { CATEGORIES, NAMES_REMINDER, REQUIRED_VOTE_LABELS, VOTE_METHOD_LABELS, kindFacts, motionOptions, statusOptions } from "./lib";
import { below } from "./threads";

const today = () => new Date().toLocaleDateString("en-CA");
const blank = () => ({
  kind: "main", parent_id: "", title: "", text: "", category: "other", status: "passed", decided_on: today(),
  moved_by_name: "", seconded_by_name: "", vote_method: "", required_vote: "", previous_notice: false,
  votes_for: "", votes_against: "", abstentions: "", committee: "", postponed_to: "", amended_text: "", note: "",
  minority_opinion: "", supersedes_id: "", visibility: "members", business_meeting_id: "", agenda_item_id: "", ignore_rules: false, one_time: false,
});
const GROUP_ORDER = ["main", "subsidiary", "privileged", "incidental", "bring_back"];

// Recording a motion (record keepers), or changing one, as the group ran it by Robert's Rules. The
// vote happened in the room; this notes what was moved, by whom, how it was voted and how it came
// out, and says where that doesn't follow the rules. `motions` are the group's others (what it
// applies to or replaces); `kinds` the rules, from the server; `preset` fills it in for a motion
// made at a business meeting (its agenda item, its date).
export default function DecisionForm({ group, motion = null, motions, kinds, groups = {}, preset = null, onSaved, onCancel }) {
  const [form, setForm] = useState(() => (motion
    ? Object.fromEntries(Object.keys(blank()).map((k) => {
        const source = { moved_by_name: motion.moved_by, seconded_by_name: motion.seconded_by, text: motion.text, amended_text: motion.amended_text, note: motion.note }[k] ?? motion[k];
        return [k, source ?? blank()[k]];
      }))
    : { ...blank(), ...preset }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState(motion?.warnings || []);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const kind = kinds.find((k) => k.key === form.kind) || kinds[0];
  const decision = ["main", "rescind"].includes(kind.key);
  const needsDate = ["passed", "failed", "tabled", "referred", "postponed", "postponed_indefinitely"].includes(form.status);
  const replaceable = motions.filter((m) => m.id !== motion?.id && m.status === "passed" && ["main", "rescind"].includes(m.kind));
  const noVote = kind.vote === "none";
  const requiredNow = form.required_vote || (kind.vote === "rescind" ? (form.previous_notice ? "majority" : "two_thirds") : kind.vote === "tie_sustains" ? "majority" : noVote ? null : kind.vote);

  // What it can apply to: at a meeting, the motions pending there; a tabled one to take from the
  // table; a decided one to reconsider. Typed in from the log afterwards, any motion (an amendment
  // to an amendment picks the amendment), but never one that's already under this one.
  const parentChoices = useMemo(() => {
    const under = motion ? below(motions, motion.id) : new Set();
    const atMeeting = preset?.business_meeting_id;
    return motions.filter((m) => m.id !== motion?.id && !under.has(m.id) && (
      m.id === Number(form.parent_id) ||
      (kind.key === "take_from_table" ? m.status === "tabled"
        : kind.key === "reconsider" ? ["passed", "failed"].includes(m.status) && (!atMeeting || m.business_meeting_id === atMeeting)
        : !atMeeting || (m.status === "proposed" && m.business_meeting_id === atMeeting))
    ));
  }, [motions, kind.key, form.parent_id, preset, motion]);

  // The rules' view of it, as it's typed
  useEffect(() => {
    const t = setTimeout(() => {
      api(`/groups/${group.slug}/motions/check`, { method: "POST", body: { id: motion?.id, motion: form } }).then((d) => setWarnings(d.warnings)).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [form, group.slug, motion?.id]);

  const pickKind = (e) => setForm((f) => ({ ...f, kind: e.target.value, parent_id: "", status: f.status === "proposed" ? f.status : "passed" }));
  const pickParent = (value) => {
    const parent = motions.find((m) => String(m.id) === String(value));
    setForm((f) => ({ ...f, parent_id: value, title: f.title || (parent ? parent.title : f.title), amended_text: f.amended_text || (kind.key === "amend" && parent ? parent.amended_text || parent.text : f.amended_text) }));
  };

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
      {/* Sized by its own width, so it fits in the decisions side pane as well as a full page */}
      <form onSubmit={save} className="@container space-y-4">
        <h3 className="!text-base font-semibold text-slate-900 dark:text-white">{motion ? "Change this motion" : "Record a motion"}</h3>
        <p className="-mt-2 text-xs text-slate-500 dark:text-neutral-400">The vote is taken in the room; this is the record of it.</p>
        <ErrorNote error={error} />

        {field("m-kind", "What kind of motion", (
          <select id="m-kind" className={selectClass} value={form.kind} onChange={pickKind}>
            {GROUP_ORDER.map((g) => (
              <optgroup key={g} label={groups[g] || g}>{kinds.filter((k) => k.group === g).map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</optgroup>
            ))}
          </select>
        ), `${kind.help ? `${kind.help}. ` : ""}${kindFacts(kind)}.`)}

        {(kind.pending) && field("m-parent", "It applies to", (
          <FilterPick id="m-parent" value={form.parent_id ?? ""} onChange={pickParent} placeholder="Type to find the motion" empty="No motion matches"
            options={motionOptions(parentChoices, "Choose the motion")} />
        ), parentChoices.length === 0 ? "Nothing is pending here. Record the main motion first."
          : `It's listed in that motion's thread.${kind.key === "amend" ? " Amending an amendment? Pick the amendment." : ""}`)}

        {field("m-title", decision ? "What was moved" : "In short", <input id="m-title" required autoFocus maxLength={160} className={inputClass} value={form.title} onChange={set("title")} placeholder={decision ? "e.g. Send 7th Tradition 60/30/10" : "e.g. Table the urn until next month"} />)}
        {field("m-text", "As worded", (
          <div className="grid gap-3 @2xl:grid-cols-2">
            <textarea id="m-text" rows={4} maxLength={10000} className={`${inputClass} font-mono !text-[13px]`} value={form.text} onChange={set("text")} placeholder="Markdown works." />
            {form.text.trim() && <div className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:ring-neutral-800"><Markdown source={form.text} className="ev-md text-sm text-slate-800 dark:text-neutral-200" /></div>}
          </div>
        ), NAMES_REMINDER)}

        {kind.key === "amend" && field("m-amended", "The motion as it now reads", <textarea id="m-amended" rows={3} maxLength={10000} className={`${inputClass} font-mono !text-[13px]`} value={form.amended_text} onChange={set("amended_text")} />, "If the amendment passes, this becomes what the main motion says.")}

        <div className="grid gap-3 @md:grid-cols-2">
          {field("m-moved", "Moved by", <input id="m-moved" maxLength={80} className={inputClass} value={form.moved_by_name} onChange={set("moved_by_name")} placeholder="First name, last initial" />)}
          {field("m-seconded", "Seconded by", <input id="m-seconded" maxLength={80} className={inputClass} value={form.seconded_by_name} onChange={set("seconded_by_name")} placeholder={kind.second ? "First name, last initial" : "Not needed"} />)}
        </div>

        <div className="grid gap-3 @lg:grid-cols-3">
          {field("m-status", noVote ? "Ruling" : "How it came out", <select id="m-status" className={selectClass} value={form.status} onChange={set("status")}>{statusOptions(kind).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>)}
          {field("m-date", "On", <input id="m-date" type="date" required={needsDate} className={inputClass} value={form.decided_on} onChange={set("decided_on")} />)}
          {decision && field("m-category", "Kind of decision", <select id="m-category" className={selectClass} value={form.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>)}
        </div>

        {(kind.key === "commit" || form.status === "referred") && field("m-committee", "Referred to", <input id="m-committee" maxLength={120} className={inputClass} value={form.committee} onChange={set("committee")} placeholder="Committee, to report at the next meeting" />)}
        {(kind.key === "postpone_definitely" || form.status === "postponed") && field("m-postponed", "Postponed to", <input id="m-postponed" maxLength={120} className={inputClass} value={form.postponed_to} onChange={set("postponed_to")} placeholder="e.g. the next business meeting, or 8:30 PM" />)}

        {!noVote && (
          <fieldset className="space-y-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">The vote</legend>
            <div className="grid gap-3 @lg:grid-cols-4">
              {field("m-method", "Taken by", <select id="m-method" className={selectClass} value={form.vote_method ?? ""} onChange={set("vote_method")}><option value="">Not noted</option>{Object.entries(VOTE_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>)}
              {field("m-for", "For", <input id="m-for" type="number" min="0" max="9999" className={inputClass} value={form.votes_for ?? ""} onChange={set("votes_for")} />)}
              {field("m-against", "Against", <input id="m-against" type="number" min="0" max="9999" className={inputClass} value={form.votes_against ?? ""} onChange={set("votes_against")} />)}
              {field("m-abstain", "Abstained", <input id="m-abstain" type="number" min="0" max="9999" className={inputClass} value={form.abstentions ?? ""} onChange={set("abstentions")} />)}
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              {requiredNow ? <>Needs <strong>{REQUIRED_VOTE_LABELS[requiredNow].toLowerCase()}</strong>{form.required_vote ? " (set by your bylaws)" : " by Robert's Rules"}. </> : null}
              Abstentions aren't votes cast. Leave the counts blank for a voice vote nobody counted.
            </p>
            {["rescind", "discharge_committee"].includes(kind.key) && <Toggle checked={!!form.previous_notice} onChange={(v) => setForm((f) => ({ ...f, previous_notice: v }))} label="Previous notice was given" description="With notice a majority is enough; without it, two thirds." />}
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 dark:text-neutral-400">Do the bylaws ask for a different vote?</summary>
              <div className="mt-2 max-w-sm">
                <select aria-label="Vote the bylaws require" className={selectClass} value={form.required_vote ?? ""} onChange={set("required_vote")}>
                  <option value="">As Robert's Rules says</option>
                  {Object.entries(REQUIRED_VOTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </details>
          </fieldset>
        )}

        {(form.kind === "main" || form.kind === "rescind") && <Toggle checked={!!form.one_time} onChange={(v) => setForm((f) => ({ ...f, one_time: v }))} label="One-time decision"
          description="Something done once, like a change to the script or a purchase. It stays in the log but isn't listed with the group's standing decisions." />}

        {group.follows_roberts_rules !== false && <Toggle checked={!!form.ignore_rules} onChange={(v) => setForm((f) => ({ ...f, ignore_rules: v }))} label="Don't hold this one to Robert's Rules"
          description="For a decision the group made its own way: no warnings about seconds, counts or the vote needed." />}

        {warnings.length > 0 && (
          <ul role="status" className="space-y-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            {warnings.map((w) => <li key={w}>{w}</li>)}
            <li className="text-xs opacity-80">You can still save it. This only notes where the record doesn't follow the rules.</li>
          </ul>
        )}

        {field("m-note", "Notes", <textarea id="m-note" rows={2} maxLength={2000} className={inputClass} value={form.note} onChange={set("note")} placeholder={noVote ? "What the chair ruled, and why" : "Anything the record should say"} />)}

        {decision && field("m-replaces", "It replaces", (
          <FilterPick id="m-replaces" value={form.supersedes_id ?? ""} onChange={(v) => setForm((f) => ({ ...f, supersedes_id: v }))} placeholder="Type to find the decision" empty="No decision matches"
            options={motionOptions(replaceable, "Nothing (a new decision)")} />
        ), "It's listed in that decision's thread. Once this passes, the one it replaces shows as replaced.")}
        {decision && field("m-minority", "Minority opinion (optional)", <textarea id="m-minority" rows={3} maxLength={5000} className={inputClass} value={form.minority_opinion} onChange={set("minority_opinion")} />, "Anyone in the minority may have theirs heard and recorded here before a re-vote (Concept V).")}
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
