import React, { useEffect, useState } from "react";
import { Check, ChevronDown, Lock, Users, X } from "lucide-react";
import { inputClass } from "../ui/styles";
import { showToast } from "../../lib/toast";
import { AUDIENCE_LABELS, api, primaryClass, when } from "./lib";

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Voting and live results for one poll. Used on the poll's own page, and meant to sit inside a
// reading or a motion too. `poll` comes from usePoll; onChange gets the poll after a vote.
export default function PollCard({ poll, onChange, onRemoveBallot }) {
  const mine = poll.my_ballot?.option_ids || [];
  const [picks, setPicks] = useState(mine);
  const [name, setName] = useState(poll.my_ballot?.voter_name || "");
  const [editing, setEditing] = useState(!poll.my_ballot);
  const [saving, setSaving] = useState(false);
  const [openVoters, setOpenVoters] = useState(null);

  // A vote from another tab or device (or after signing in) shows here too
  useEffect(() => {
    if (!editing) setPicks(poll.my_ballot?.option_ids || []);
    if (!poll.my_ballot) setEditing(true);
  }, [poll.my_ballot, editing]);

  const voted = !!poll.my_ballot;
  const canVote = !poll.vote_problem && !poll.closed;
  const choosing = canVote && editing;
  const single = poll.max_choices === 1;
  const total = poll.options.reduce((sum, o) => sum + (o.count || 0), 0);
  const top = Math.max(1, ...poll.options.map((o) => o.count || 0));

  const toggle = (id) => {
    if (!choosing) return;
    if (single) return setPicks([id]);
    if (picks.includes(id)) setPicks(picks.filter((p) => p !== id));
    else if (picks.length < poll.max_choices) setPicks([...picks, id]);
    else showToast(`You can pick up to ${poll.max_choices}.`);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const data = await api(`/${poll.token}/ballot`, { method: "PUT", body: { option_ids: picks, voter_name: name } });
      onChange(data);
      setEditing(false);
      showToast(voted ? "Your vote is updated." : "Your vote is in. Thanks!", { tone: "success" });
    } catch (e) {
      showToast(e.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const unvote = async () => {
    if (!window.confirm("Take back your vote?")) return;
    try {
      onChange(await api(`/${poll.token}/ballot`, { method: "DELETE" }));
      setPicks([]);
      setEditing(true);
      showToast("Your vote was removed.", { tone: "success" });
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  return (
    <div className="space-y-3">
      {poll.details && <div className="whitespace-pre-line text-sm text-slate-600 dark:text-neutral-300">{poll.details}</div>}

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-neutral-400">
        <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{poll.ballots_count} {poll.ballots_count === 1 ? "vote" : "votes"}</span>
        <span>{single ? "Pick one" : `Pick up to ${poll.max_choices}`}</span>
        <span>{AUDIENCE_LABELS[poll.audience]}{poll.audience === "members" && poll.group ? ` (${poll.group.name})` : ""}</span>
        {poll.closed ? (
          <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-neutral-200"><Lock className="size-3.5" /> Closed</span>
        ) : poll.closes_at && <span>Closes {when(poll.closes_at)}</span>}
        {poll.show_results && !poll.closed && <span className="inline-flex items-center gap-1"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Live</span>}
      </p>

      <ul className="space-y-2" role={choosing ? (single ? "radiogroup" : "group") : undefined} aria-label={poll.question}>
        {poll.options.map((o) => {
          const picked = choosing ? picks.includes(o.id) : mine.includes(o.id);
          const pct = poll.show_results && total > 0 ? Math.round(((o.count || 0) / Math.max(1, poll.ballots_count)) * 100) : 0;
          const width = poll.show_results ? `${((o.count || 0) / top) * 100}%` : "0%";
          return (
            <li key={o.id}>
              <button
                type="button"
                role={choosing ? (single ? "radio" : "checkbox") : undefined}
                aria-checked={choosing ? picked : undefined}
                disabled={!choosing}
                onClick={() => toggle(o.id)}
                className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 text-left text-sm transition-colors !bg-white dark:!bg-neutral-900 disabled:cursor-default ${
                  picked ? "border-accent ring-1 ring-accent" : "border-neutral-200 dark:border-neutral-700"
                } ${choosing ? "hover:border-accent/60" : ""}`}
              >
                <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-accent/10 transition-[width] duration-500 dark:bg-accent/25" style={{ width }} />
                <span aria-hidden="true" className={`relative grid size-5 shrink-0 place-items-center border ${single ? "rounded-full" : "rounded-md"} ${
                  picked ? "border-accent bg-accent text-white" : "border-neutral-300 dark:border-neutral-600"}`}>
                  {picked && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="relative min-w-0 flex-1 font-medium text-slate-900 dark:text-white">{o.label}</span>
                {poll.show_results && (
                  <span className="relative shrink-0 tabular-nums text-slate-600 dark:text-neutral-300">
                    {o.count} <span className="text-xs text-slate-400">· {pct}%</span>
                  </span>
                )}
              </button>
              {o.voters && o.voters.length > 0 && (
                <div className="px-2 pt-1">
                  <button type="button" onClick={() => setOpenVoters(openVoters === o.id ? null : o.id)}
                    className="inline-flex items-center gap-1 !bg-transparent text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white">
                    Who voted for this <ChevronDown className={`size-3.5 transition-transform ${openVoters === o.id ? "rotate-180" : ""}`} />
                  </button>
                  {openVoters === o.id && (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {o.voters.map((v) => (
                        <li key={v.id} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-slate-700 dark:bg-neutral-800 dark:text-neutral-200">
                          {v.name}{v.guest && <span className="text-slate-400">(guest)</span>}
                          {onRemoveBallot && (
                            <button type="button" aria-label={`Remove ${v.name}'s vote`} onClick={() => onRemoveBallot(v)}
                              className="-mr-1 grid size-4 place-items-center rounded-full !bg-transparent text-slate-400 hover:text-red-600"><X className="size-3" /></button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!poll.show_results && (
        <p className="text-xs text-slate-500 dark:text-neutral-400">
          {poll.results_visibility === "after_vote" ? "Results show once you vote." : "Results show when the poll closes."}
        </p>
      )}

      {choosing && (
        <div className="flex flex-wrap items-end gap-2">
          {!poll.signed_in && poll.guest_names !== "off" && (
            <label className="min-w-[12rem] flex-1">
              <span className="mb-1 block text-xs text-slate-500 dark:text-neutral-400">
                Your name{poll.guest_names === "required" ? "" : " (optional)"}, shown {poll.voters_visibility === "everyone" ? "with your vote" : "to the people running this poll"}
              </span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} placeholder="First name and last initial" required={poll.guest_names === "required"} />
            </label>
          )}
          <button type="button" className={primaryClass} disabled={saving || picks.length === 0 || (!poll.signed_in && poll.guest_names === "required" && !name.trim()) || (voted && sameSet(picks, mine) && name === (poll.my_ballot?.voter_name || ""))} onClick={submit}>
            {saving ? "Saving…" : voted ? "Update my vote" : "Vote"}
          </button>
          {voted && (
            <button type="button" className="px-2 py-2 text-sm !bg-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400" onClick={() => { setEditing(false); setPicks(mine); }}>Cancel</button>
          )}
        </div>
      )}

      {voted && !editing && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-neutral-300">
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400"><Check className="size-4" /> You voted{!poll.signed_in && poll.my_ballot.voter_name ? ` as ${poll.my_ballot.voter_name}` : ""}</span>
          {!poll.closed && (
            <>
              <button type="button" onClick={() => setEditing(true)} className="!bg-transparent text-accent hover:underline">Change my vote</button>
              <button type="button" onClick={unvote} className="!bg-transparent text-slate-500 hover:underline">Take it back</button>
            </>
          )}
        </p>
      )}

      {!voted && poll.vote_problem && (
        <p className="rounded-xl bg-neutral-100 px-3 py-2 text-sm text-slate-700 dark:bg-neutral-800 dark:text-neutral-200">
          {poll.vote_problem}
          {!poll.signed_in && poll.audience !== "anyone" && (
            <> <a href={`/users/sign_in`} className="font-medium text-accent hover:underline">Sign in</a></>
          )}
        </p>
      )}
    </div>
  );
}
