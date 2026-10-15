import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, CalendarClock, Check, Copy, Flame, Lock, LockOpen, Pencil, Trash2, Users, X } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import { showToast } from "../../lib/toast";
import WeekGrid, { buildHeat } from "./WeekGrid";
import { VISIBILITY_LABELS, api, clock, dayParts, describeStart, makeNow, parseStart } from "./lib";

const REFRESH_MS = 20_000;

const closesLabel = (value) => {
  const p = parseStart(value);
  return p ? `${dayParts(p.date).long} at ${clock(p.minute)}` : value;
};

const buttonClass =
  "inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-panel hover:bg-neutral-50 disabled:opacity-50 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";

export default function PollPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [poll, setPoll] = useState(null);
  const [error, setError] = useState(null);
  const [picks, setPicks] = useState([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHeat, setShowHeat] = useState(true);
  const dirty = useRef(false);

  const apply = useCallback((data, { resetPicks = false } = {}) => {
    setPoll(data);
    if (resetPicks || !dirty.current) {
      setPicks(data.my_ballot?.choices || []);
      setName(data.my_ballot?.voter_name || "");
      dirty.current = false;
    }
  }, []);

  useEffect(() => {
    api(`/${token}`).then((d) => apply(d, { resetPicks: true })).catch((e) => setError(e.message));
  }, [token, apply]);

  // Keep the results and heat map current while the page is open
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) api(`/${token}`).then((d) => apply(d)).catch(() => {});
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [token, apply]);

  const now = useMemo(() => (poll ? makeNow(poll.now_local) : null), [poll?.now_local]);
  const nowValue = now?.();
  const heat = useMemo(() => (poll && showHeat ? buildHeat(poll, poll.results) : null), [poll, showHeat]);

  if (error) return <Message title="Couldn't open this poll" text={error} />;
  if (!poll) return <p className="py-16 text-center !font-sans text-sm text-slate-500">Loading…</p>;

  const voted = !!poll.my_ballot;
  const open = !poll.closed;
  const changed = JSON.stringify(picks) !== JSON.stringify(poll.my_ballot?.choices || []) || (name || "") !== (poll.my_ballot?.voter_name || "");

  const edit = (next) => {
    dirty.current = true;
    setPicks(next);
  };
  const toggle = (start) => {
    if (!open) return;
    if (picks.includes(start)) edit(picks.filter((p) => p !== start));
    else if (picks.length < poll.choices_count) edit([...picks, start]);
  };
  const move = (i, by) => {
    const next = [...picks];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    edit(next);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const data = await api(`/${token}/ballot`, { method: "PUT", body: { choices: picks, voter_name: name } });
      apply(data, { resetPicks: true });
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
      apply(await api(`/${token}/ballot`, { method: "DELETE" }), { resetPicks: true });
      showToast("Your vote was removed.", { tone: "success" });
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  const manage = async (path, method = "POST", message) => {
    try {
      apply(await api(`/${token}${path}`, { method }));
      if (message) showToast(message, { tone: "success" });
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${poll.title}” and all its votes? This can't be undone.`)) return;
    try {
      await api(`/${token}`, { method: "DELETE" });
      showToast("Poll deleted.", { tone: "success" });
      navigate("/");
    } catch (e) {
      showToast(e.message, { tone: "error" });
    }
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => showToast("Link copied.", { tone: "success" }));
  };

  const results = poll.results;
  const top = results?.slice(0, 5) || [];
  const maxPoints = top[0]?.points || 1;

  return (
    <div className="space-y-4 !font-sans [&_*]:!font-sans">
      <Shell>
        <ShellBand
          icon={CalendarClock}
          title={poll.title}
          subtitle={`${poll.organizer.name} · ${poll.duration_minutes} minutes · ${dayParts(poll.starts_on).long} – ${dayParts(poll.ends_on).long}`}
        />
        <ShellPanel position="bottom" className="space-y-3 p-4">
          {poll.description && <p className="whitespace-pre-line text-sm text-slate-700 dark:text-neutral-300">{poll.description}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-neutral-400">
            <span className={`inline-flex items-center gap-1 font-medium ${open ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>
              {open ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {open ? `Voting closes ${closesLabel(poll.closes_at)}` : "Voting is closed"}
            </span>
            <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {poll.ballots_count} vote{poll.ballots_count === 1 ? "" : "s"}</span>
            <span>Times are {poll.time_zone.replace("America/", "").replace("_", " ")} time ({poll.zone_label})</span>
          </div>
          {poll.can_manage && (
            <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
              <Link to={`/${token}/edit`} className={buttonClass}><Pencil className="h-4 w-4" /> Edit</Link>
              <button type="button" className={buttonClass} onClick={copyLink}><Copy className="h-4 w-4" /> Copy link</button>
              {open ? (
                <button type="button" className={buttonClass} onClick={() => manage("/close", "POST", "Voting is closed.")}><Lock className="h-4 w-4" /> Close voting</button>
              ) : poll.closed_early ? (
                <button type="button" className={buttonClass} onClick={() => manage("/reopen", "POST", "Voting is open again.")}><LockOpen className="h-4 w-4" /> Reopen voting</button>
              ) : null}
              {poll.can_delete && (
                <button type="button" className={`${buttonClass} !text-red-600`} onClick={remove}><Trash2 className="h-4 w-4" /> Delete</button>
              )}
            </div>
          )}
        </ShellPanel>
      </Shell>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500 dark:text-neutral-400">
            <span>
              {open
                ? `Tap a start time to pick it. Pick up to ${poll.choices_count}, best first.`
                : "Voting has closed."}
            </span>
            <span className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-neutral-300 dark:bg-neutral-600" /> Doesn't work</span>
              {results && (
                <label className="inline-flex cursor-pointer items-center gap-1">
                  <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} className="accent-[var(--color-accent)]" />
                  <Flame className="h-3.5 w-3.5 text-accent" /> Heat map
                </label>
              )}
            </span>
          </div>
          <WeekGrid poll={poll} now={nowValue} picks={picks} onToggle={toggle} heat={heat} interactive={open} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[calc(var(--nav-h,56px)+16px)]">
          <Shell>
            <ShellBand icon={Check} title={voted ? "Your vote" : "Your picks"} subtitle={`Rank your top ${poll.choices_count}`} />
            <ShellPanel position="bottom" className="space-y-3 p-4">
              <ol className="space-y-2">
                {Array.from({ length: poll.choices_count }, (_, i) => {
                  const start = picks[i];
                  return (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${start ? "bg-accent text-white" : "bg-neutral-100 text-slate-400 dark:bg-neutral-800"}`}>{i + 1}</span>
                      {start ? (
                        <>
                          <span className="min-w-0 flex-1 text-slate-800 dark:text-neutral-100">{describeStart(start, poll.duration_minutes)}</span>
                          {open && (
                            <span className="flex shrink-0 items-center">
                              <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
                              <IconButton label="Move down" disabled={i === picks.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
                              <IconButton label="Remove" onClick={() => toggle(start)}><X className="h-3.5 w-3.5" /></IconButton>
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 dark:text-neutral-500">{open ? "Tap a time on the calendar" : "—"}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
              {open && (
                <>
                  {!poll.signed_in && (
                    <div>
                      <label htmlFor="voter-name" className={labelClass}>Your name (optional)</label>
                      <input id="voter-name" className={inputClass} value={name} maxLength={60} placeholder="So the organizer knows who voted"
                        onChange={(e) => { dirty.current = true; setName(e.target.value); }} />
                    </div>
                  )}
                  <button type="button" onClick={submit} disabled={saving || picks.length === 0 || (voted && !changed)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl !bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-panel hover:opacity-90 disabled:opacity-50">
                    <Check className="h-4 w-4" /> {saving ? "Saving…" : voted ? (changed ? "Update my vote" : "Vote saved") : "Submit my vote"}
                  </button>
                  {voted && (
                    <button type="button" onClick={unvote} className="w-full !bg-transparent text-center text-xs text-slate-500 hover:underline dark:text-neutral-400">Take back my vote</button>
                  )}
                </>
              )}
            </ShellPanel>
          </Shell>

          <Shell>
            <ShellBand icon={Flame} title="Results" subtitle={VISIBILITY_LABELS[poll.results_visibility]} />
            <ShellPanel position="bottom" className="p-4">
              {!results ? (
                <p className="text-sm text-slate-500 dark:text-neutral-400">
                  {poll.results_visibility === "after_close" ? "Results show when voting closes." : "Vote to see how everyone else voted."}
                </p>
              ) : top.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-neutral-400">No votes yet.</p>
              ) : (
                <ol className="space-y-3">
                  {top.map((row, i) => (
                    <li key={row.start} className="text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-slate-800 dark:text-neutral-100 ${i === 0 ? "font-semibold" : ""}`}>{describeStart(row.start, poll.duration_minutes)}</span>
                        <span className="shrink-0 text-xs text-slate-500">{row.points} pt{row.points === 1 ? "" : "s"}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(row.points / maxPoints) * 100}%` }} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-neutral-400">
                        {row.votes} voter{row.votes === 1 ? "" : "s"} · {row.firsts} first choice{row.firsts === 1 ? "" : "s"}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              {results && results.length > 0 && (
                <p className="mt-3 text-[11px] text-slate-400 dark:text-neutral-500">
                  A first choice is worth {poll.choices_count} point{poll.choices_count === 1 ? "" : "s"}{poll.choices_count > 1 ? `, a last choice 1` : ""}.
                </p>
              )}
            </ShellPanel>
          </Shell>

          {poll.voters && (
            <Shell>
              <ShellBand icon={Users} title="Who voted" subtitle="Only organizers see this" />
              <ShellPanel position="bottom" className="p-4">
                {poll.voters.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-neutral-400">Nobody yet. Share the link to get votes.</p>
                ) : (
                  <ul className="space-y-3">
                    {poll.voters.map((v) => (
                      <li key={v.id} className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-800 dark:text-neutral-100">{v.name}</span>
                          <IconButton label={`Remove ${v.name}'s vote`} onClick={() => window.confirm(`Remove ${v.name}'s vote?`) && manage(`/ballots/${v.id}`, "DELETE", "Vote removed.")}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                        <ol className="mt-0.5 list-decimal pl-5 text-xs text-slate-500 dark:text-neutral-400">
                          {v.choices.map((c) => <li key={c}>{describeStart(c, poll.duration_minutes)}</li>)}
                        </ol>
                      </li>
                    ))}
                  </ul>
                )}
              </ShellPanel>
            </Shell>
          )}
        </aside>
      </div>
    </div>
  );
}

function IconButton({ label, children, ...props }) {
  return (
    <button type="button" aria-label={label} title={label} className="rounded-md !bg-transparent p-1 text-slate-500 hover:!bg-neutral-100 hover:text-slate-800 disabled:opacity-30 dark:hover:!bg-neutral-800 dark:hover:text-white" {...props}>
      {children}
    </button>
  );
}

export function Message({ title, text, children }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center !font-sans">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
      {text && <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400">{text}</p>}
      {children}
    </div>
  );
}
