import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Vote, X } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import Skeleton from "../ui/Skeleton";
import { showToast } from "../../lib/toast";
import { Message } from "./PollPage";
import { AUDIENCE_LABELS, RESULTS_LABELS, VOTERS_LABELS, api, buttonClass, primaryClass } from "./lib";

let nextKey = 0;
const blank = () => ({ key: `n${nextKey++}`, label: "" });
const pad = (n) => String(n).padStart(2, "0");
// <input type="datetime-local"> wants local wall time
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function Choice({ name, value, current, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
      <input type="radio" name={name} value={value} checked={current === value} onChange={() => onChange(value)} className="mt-0.5 accent-[var(--color-accent)]" />
      <span className="text-sm text-slate-800 dark:text-neutral-100">{label}{hint && <span className="block text-xs text-slate-500 dark:text-neutral-400">{hint}</span>}</span>
    </label>
  );
}

// Making or editing a poll
export default function PollForm() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    question: "", details: "", group_id: "", audience: "signed_in", max_choices: 1,
    results_visibility: "always", voters_visibility: "managers", closes_at: "",
    options: [blank(), blank()],
  });
  const [ballots, setBallots] = useState(0);
  const [loaded, setLoaded] = useState(!token);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    api("/groups").then((g) => {
      setGroups(g);
      if (!token && !g.site_admin && g.groups[0]) set({ group_id: String(g.groups[0].id) });
    }).catch((e) => setError(e.message));
    if (token) {
      api(`/${token}`).then((p) => {
        if (!p.can_manage) return setError("Only the people running this poll can edit it.");
        setBallots(p.ballots_count);
        setForm({
          question: p.question, details: p.details || "", group_id: p.group_id ? String(p.group_id) : "",
          audience: p.audience, max_choices: p.max_choices, results_visibility: p.results_visibility,
          voters_visibility: p.voters_visibility, closes_at: toLocalInput(p.closes_at),
          options: p.options.map((o) => ({ key: `o${o.id}`, id: o.id, label: o.label })),
          group: p.group,
        });
        setLoaded(true);
      }).catch((e) => setError(e.message));
    }
  }, [token]);

  if (error) return <Message title="Couldn't open this" text={error} />;
  if (!groups || !loaded) return <Skeleton variant="page" />;
  if (!token && !groups.site_admin && groups.groups.length === 0) {
    return <Message title="Polls are made for a group" text="Group admins, record keepers and hosts can make polls for their group." />;
  }

  const options = form.options;
  const setOption = (i, label) => set({ options: options.map((o, j) => (j === i ? { ...o, label } : o)) });
  const move = (i, by) => {
    const next = [...options];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    set({ options: next });
  };
  const removeOption = (i) => {
    const o = options[i];
    if (o.id && ballots > 0 && !window.confirm(`Remove “${o.label}”? Votes for it will be removed too.`)) return;
    set({ options: options.filter((_, j) => j !== i) });
  };
  const filled = options.filter((o) => o.label.trim());
  const multiple = form.max_choices > 1;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        poll: {
          question: form.question, details: form.details, audience: form.audience,
          max_choices: Math.min(Number(form.max_choices) || 1, Math.max(1, filled.length)),
          results_visibility: form.results_visibility, voters_visibility: form.voters_visibility,
          closes_at: form.closes_at ? new Date(form.closes_at).toISOString() : "",
          options: filled.map((o) => ({ id: o.id, label: o.label })),
          ...(token ? {} : { group_id: form.group_id }),
        },
      };
      const poll = await api(token ? `/${token}` : "", { method: token ? "PATCH" : "POST", body });
      showToast(token ? "Poll saved." : "Poll made. Share the link!", { tone: "success" });
      navigate(`/p/${poll.token}`);
    } catch (err) {
      showToast(err.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4 !font-sans [&_*]:!font-sans">
      <Shell>
        <ShellBand icon={Vote} title={token ? "Edit poll" : "New poll"} subtitle="One question, two or more answers" />
        <ShellPanel position="middle" className="space-y-4 p-4">
          <label className="block">
            <span className={labelClass}>Question</span>
            <input required maxLength={200} value={form.question} onChange={(e) => set({ question: e.target.value })} className={inputClass}
              placeholder="Which topic should we read next week?" autoFocus={!token} />
          </label>
          <label className="block">
            <span className={labelClass}>More about it (optional)</span>
            <textarea rows={2} maxLength={2000} value={form.details} onChange={(e) => set({ details: e.target.value })} className={inputClass} />
          </label>

          <div>
            <span className={labelClass}>Answers</span>
            <ol className="space-y-2">
              {options.map((o, i) => (
                <li key={o.key} className="flex items-center gap-1.5">
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
                  <input value={o.label} maxLength={200} onChange={(e) => setOption(i, e.target.value)} className={inputClass} placeholder={`Answer ${i + 1}`}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (i === options.length - 1 && options.length < 20) set({ options: [...options, blank()] }); } }} />
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-8 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="size-4" /></button>
                  <button type="button" aria-label="Move down" disabled={i === options.length - 1} onClick={() => move(i, 1)} className="grid size-8 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="size-4" /></button>
                  <button type="button" aria-label="Remove answer" disabled={options.length <= 2} onClick={() => removeOption(i)} className="grid size-8 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-400 hover:text-red-600 disabled:opacity-30"><X className="size-4" /></button>
                </li>
              ))}
            </ol>
            {options.length < 20 && (
              <button type="button" className={`${buttonClass} mt-2`} onClick={() => set({ options: [...options, blank()] })}><Plus className="size-4" /> Add an answer</button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-800 dark:text-neutral-100">
              <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={multiple} onChange={(e) => set({ max_choices: e.target.checked ? Math.max(2, Math.min(3, filled.length)) : 1 })} />
              People can pick more than one
            </label>
            {multiple && (
              <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-neutral-300">
                up to
                <input type="number" min={2} max={Math.max(2, filled.length)} value={form.max_choices} onChange={(e) => set({ max_choices: e.target.value })} className={`${inputClass} !w-20`} />
              </label>
            )}
          </div>
        </ShellPanel>

        <ShellPanel position="bottom" className="grid gap-4 p-4 sm:grid-cols-2">
          {token ? (
            form.group && <p className="text-sm text-slate-600 dark:text-neutral-300 sm:col-span-2">For <strong>{form.group.name}</strong></p>
          ) : (
            <label className="block sm:col-span-2">
              <span className={labelClass}>Group</span>
              <select value={form.group_id} onChange={(e) => set({ group_id: e.target.value, audience: !e.target.value && form.audience === "members" ? "signed_in" : form.audience })} className={selectClass}>
                {groups.site_admin && <option value="">No group (site-wide)</option>}
                {groups.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}

          <fieldset>
            <legend className={labelClass}>Who can vote</legend>
            {Object.entries(AUDIENCE_LABELS).filter(([v]) => v !== "members" || form.group_id).map(([v, label]) => (
              <Choice key={v} name="audience" value={v} current={form.audience} onChange={(audience) => set({ audience })} label={label}
                hint={v === "anyone" ? "No account needed. One guest vote per network." : null} />
            ))}
          </fieldset>
          <fieldset>
            <legend className={labelClass}>Show results</legend>
            {Object.entries(RESULTS_LABELS).map(([v, label]) => (
              <Choice key={v} name="results" value={v} current={form.results_visibility} onChange={(results_visibility) => set({ results_visibility })} label={label} />
            ))}
          </fieldset>
          <fieldset>
            <legend className={labelClass}>Who sees who voted for what</legend>
            {Object.entries(VOTERS_LABELS).map(([v, label]) => (
              <Choice key={v} name="voters" value={v} current={form.voters_visibility} onChange={(voters_visibility) => set({ voters_visibility })} label={label}
                hint={v === "managers" ? "Whoever made it, and the group's admins and record keepers" : null} />
            ))}
          </fieldset>
          <label className="block">
            <span className={labelClass}>Closes (optional)</span>
            <input type="datetime-local" value={form.closes_at} onChange={(e) => set({ closes_at: e.target.value })} className={`${inputClass} dark:[color-scheme:dark]`} />
            <span className="mt-1 block text-xs text-slate-500 dark:text-neutral-400">Leave empty to close it yourself.</span>
          </label>
        </ShellPanel>
      </Shell>

      <div className="flex justify-end gap-2">
        <button type="button" className={buttonClass} onClick={() => navigate(token ? `/p/${token}` : "/polls")}>Cancel</button>
        <button type="submit" className={primaryClass} disabled={saving || filled.length < 2 || !form.question.trim()}>{saving ? "Saving…" : token ? "Save" : "Make poll"}</button>
      </div>
    </form>
  );
}
