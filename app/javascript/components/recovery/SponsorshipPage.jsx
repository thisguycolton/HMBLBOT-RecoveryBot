import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Copy, HeartHandshake, Link2, Lock, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { api } from "../groups/lib";
import { Card, ErrorNote, Loading, Pill, Tray, dangerButton, linkButton, primaryButton, quietButton } from "../groups/ui";
import Avatar from "../groups/Avatar";
import { inputClass, labelClass } from "../ui/styles";
import { showToast } from "../../lib/toast";
import { FindSponsor, OfferToSponsor } from "./SponsorAvailability";

const since = (iso) => iso && new Date(`${iso}T12:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
const when = (iso) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Person({ person, children, to }) {
  const inner = (
    <>
      <Avatar person={person} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-slate-900 dark:text-white">{person.name}</div>
        {children && <div className="text-sm text-slate-500 dark:text-neutral-400">{children}</div>}
      </div>
    </>
  );
  return to
    ? <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 !text-inherit hover:opacity-80">{inner}<ChevronRight className="size-4 shrink-0 text-slate-400" /></Link>
    : <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>;
}

const endText = (s) => (s.role === "sponsor"
  ? `End your sponsorship with ${s.person.name}? They won't be notified, and you'll no longer see anything they sent you.`
  : `End your sponsorship with ${s.person.name}? They won't be notified, and everything you sent them will be gone from their view. You keep your own lists.`);

// Sponsorship (/recovery/sponsorship, Api::SponsorshipsController): a member's sponsors and
// sponsees. A sponsee asks someone by username or says yes to a sponsor's invite link; a
// sponsor can't ask anyone. Nothing is shared by being linked: the sponsee sends things one
// at a time (Send in Share on a gratitude list or 10th step), and either of them can end it.
export default function SponsorshipPage() {
  const { id } = useParams();
  return id ? <Sponsorship id={id} /> : <Overview />;
}

function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [params, setParams] = useSearchParams();
  const invite = params.get("invite");
  const load = useCallback(() => api("/sponsorships").then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const act = async (path, opts, done) => {
    setError(null);
    try { await api(path, opts); if (done) done(); load(); } catch (e) { setError(e.message); }
  };
  const end = (s) => window.confirm(endText(s)) && act(`/sponsorships/${s.id}`, { method: "DELETE" }, () => showToast("Ended."));

  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  const nobody = !data.sponsors.length && !data.sponsees.length && !data.asking_me.length;

  return (
    <div className="mx-auto max-w-3xl space-y-8 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Sponsorship</h1>
        <p className="mt-1 text-slate-600 dark:text-neutral-400">
          Link up with your sponsor, or the people you sponsor. Being linked doesn't share anything by itself: a sponsee sends their
          gratitude lists and 10th steps one at a time, and the sponsor can leave a short note on each.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-neutral-400"><Lock className="size-4 shrink-0" /> Either of you can end it any time. Nobody is told, and what was sent goes with it.</p>
      </header>
      <ErrorNote error={error} />

      {invite && <InviteCard token={invite} onDone={() => { setParams({}, { replace: true }); load(); }} />}

      {data.asking_me.length > 0 && (
        <Tray label="Asking you to sponsor them">
          <div className="space-y-1.5">
            {data.asking_me.map((s) => (
              <Card key={s.id} className="space-y-3 p-4">
                <Person person={s.person}>Asked {when(s.created_at)}</Person>
                {s.note && <p className="whitespace-pre-wrap rounded-xl bg-neutral-50 px-3 py-2 text-sm text-slate-700 dark:bg-neutral-950 dark:text-neutral-200">{s.note}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className={quietButton} onClick={() => act(`/sponsorships/${s.id}/decline`, { method: "POST" })}>Not right now</button>
                  <button type="button" className={primaryButton} onClick={() => act(`/sponsorships/${s.id}/accept`, { method: "POST" }, () => showToast(`You're ${s.person.name}'s sponsor.`, { tone: "success" }))}><Check className="size-4" /> Yes, I'll sponsor them</button>
                </div>
                <p className="text-xs text-slate-500 dark:text-neutral-400">If you say not right now, they aren't notified. They'll see you're not available right now.</p>
              </Card>
            ))}
          </div>
        </Tray>
      )}

      <Tray label="Your sponsors">
        <div className="space-y-1.5">
          {data.sponsors.map((s) => (
            <Card key={s.id} className="flex items-center gap-2 p-3">
              <Person person={s.person} to={`/sponsorship/${s.id}`}>Since {since(s.started_on)}</Person>
              <button type="button" className={dangerButton} onClick={() => end(s)}>End</button>
            </Card>
          ))}
          <AskCard data={data} onAsked={load} />
        </div>
      </Tray>

      <FindSponsor onAsked={load} />

      <Tray label="People you sponsor">
        <div className="space-y-1.5">
          {data.sponsees.map((s) => (
            <Card key={s.id} className="flex items-center gap-2 p-3">
              <Person person={s.person} to={`/sponsorship/${s.id}`}>
                Since {since(s.started_on)}{s.unseen > 0 && <> · <Pill tone="accent">{s.unseen} new</Pill></>}
              </Person>
              <button type="button" className={dangerButton} onClick={() => end(s)}>End</button>
            </Card>
          ))}
          <InviteLink url={data.invite_url} onMade={load} />
        </div>
      </Tray>

      <OfferToSponsor />

      {nobody && !invite && (
        <p className="text-sm text-slate-500 dark:text-neutral-400">
          Once you're linked, use <strong>Share</strong> on a <Link to="/gratitude">gratitude list</Link> or <Link to="/inventory">10th step</Link> to send it to your sponsor.
        </p>
      )}
    </div>
  );
}

// Asking someone to be your sponsor, and the asks still waiting (or turned down)
function AskCard({ data, onAsked }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const ask = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api("/sponsorships", { method: "POST", body: { username, note } });
      showToast(`Asked ${d.sponsorship.person.name}.`, { tone: "success" });
      setUsername(""); setNote(""); setOpen(false);
      onAsked();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const remove = async (s) => {
    try { await api(`/sponsorships/${s.id}`, { method: "DELETE" }); onAsked(); } catch (err) { setError(err.message); }
  };

  return (
    <Card className="space-y-3 p-4">
      {data.my_asks.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <Person person={s.person}>{s.status === "pending" ? `Asked ${when(s.created_at)}, waiting to hear` : "Not available right now"}</Person>
          <button type="button" className={quietButton} onClick={() => remove(s)}>{s.status === "pending" ? "Take back" : "Clear"}</button>
        </div>
      ))}
      {open ? (
        <form onSubmit={ask} className="space-y-3">
          <div>
            <label htmlFor="sponsor-username" className={labelClass}>Their username</label>
            <input id="sponsor-username" className={inputClass} value={username} required autoComplete="off" autoCapitalize="none"
              placeholder="the name after /people/ on their page" onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label htmlFor="sponsor-note" className={labelClass}>A note (optional)</label>
            <textarea id="sponsor-note" className={inputClass} rows={3} maxLength={data.note_max} value={note}
              placeholder="Hi, it's Sam from the Tuesday night meeting…" onChange={(e) => setNote(e.target.value)} />
          </div>
          <ErrorNote error={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className={quietButton} onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className={primaryButton} disabled={busy || !username.trim()}>{busy ? "Asking…" : "Ask them"}</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600 dark:text-neutral-400">{data.sponsors.length ? "Have another sponsor too?" : "Already have a sponsor here, or someone in mind?"} If your sponsor gave you their invite link, just open it.</p>
          <button type="button" className={quietButton} onClick={() => setOpen(true)}><UserPlus className="size-4" /> Ask someone</button>
        </div>
      )}
      {!open && <ErrorNote error={error} />}
    </Card>
  );
}

// A sponsor's invite link: the only way to become someone's sponsor without being asked
function InviteLink({ url, onMade }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const make = async (reset) => {
    if (reset && !window.confirm("Make a new link? The old one will stop working (anyone already linked stays linked).")) return;
    setBusy(true);
    try { await api("/sponsorships/invite", { method: "POST", body: { reset } }); onMade(); } catch { /* shown on reload */ }
    setBusy(false);
  };
  const copy = () => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm text-slate-600 dark:text-neutral-400">
        Sponsoring someone? Give them your invite link, in person or by text. When they open it and say yes, you're linked. Nobody can be
        made your sponsee without saying yes themselves.
      </p>
      {url ? (
        <>
          <input readOnly value={url} aria-label="Your invite link" onFocus={(e) => e.target.select()} className={`${inputClass} font-mono text-sm`} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={quietButton} disabled={busy} onClick={() => make(true)}><RefreshCw className="size-4" /> New link</button>
            <button type="button" className={primaryButton} onClick={copy}>{copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy link</>}</button>
          </div>
        </>
      ) : (
        <div className="flex justify-end">
          <button type="button" className={quietButton} disabled={busy} onClick={() => make(false)}><Link2 className="size-4" /> Get my invite link</button>
        </div>
      )}
    </Card>
  );
}

// Opened someone's invite link (/sponsor/:token sends them here with ?invite=)
function InviteCard({ token, onDone }) {
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api(`/sponsorships/invite/${encodeURIComponent(token)}`).then(setInvite).catch((e) => setError(e.message)); }, [token]);
  const accept = async () => {
    try {
      await api(`/sponsorships/invite/${encodeURIComponent(token)}`, { method: "POST" });
      showToast(`${invite.sponsor.name} is your sponsor.`, { tone: "success" });
      onDone();
    } catch (e) { setError(e.message); }
  };

  if (error) return <Card className="space-y-3 p-4"><ErrorNote error={error} /><div className="flex justify-end"><button type="button" className={quietButton} onClick={onDone}>OK</button></div></Card>;
  if (!invite) return null;
  return (
    <Card className="space-y-3 p-4 ring-2 ring-accent/40">
      <Person person={invite.sponsor}>
        {invite.own ? "This is your own invite link. Give it to someone you're sponsoring." : invite.already ? "Already your sponsor." : "Invited you to link up as your sponsor."}
      </Person>
      {!invite.own && !invite.already && (
        <p className="text-sm text-slate-600 dark:text-neutral-400">
          Saying yes doesn't share anything. You choose what to send them, one list at a time, and you can end it whenever you like.
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={quietButton} onClick={onDone}>{invite.own || invite.already ? "OK" : "Not now"}</button>
        {!invite.own && !invite.already && <button type="button" className={primaryButton} onClick={accept}><HeartHandshake className="size-4" /> Yes, they're my sponsor</button>}
      </div>
    </Card>
  );
}

// One sponsorship (/recovery/sponsorship/:id): what the sponsee sent, newest first. The sponsor
// reads it and can leave one short note on each; the sponsee sees the notes and can take
// something back.
function Sponsorship({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api(`/sponsorships/${id}/shares`).then(setData).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const back = <Link to="/sponsorship" className="inline-flex items-center gap-1 text-sm"><ChevronLeft className="size-4" /> Sponsorship</Link>;
  if (!data) return <div className="mx-auto max-w-3xl space-y-4 !font-sans">{back}{error ? <ErrorNote error={error} /> : <Loading />}</div>;
  const { sponsorship: s, shares } = data;
  const sponsor = s.role === "sponsor";

  return (
    <div className="mx-auto max-w-3xl space-y-6 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      {back}
      <header className="flex items-center gap-3">
        <Avatar person={s.person} size={48} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{s.person.name}</h1>
          <p className="text-sm text-slate-500 dark:text-neutral-400">{sponsor ? "You sponsor them" : "Your sponsor"} · since {since(s.started_on)}</p>
        </div>
      </header>
      <ErrorNote error={error} />
      {shares.length === 0 && (
        <p className="text-slate-600 dark:text-neutral-400">
          {sponsor
            ? `Nothing yet. When ${s.person.name} sends you a gratitude list or 10th step, it shows up here.`
            : <>Nothing sent yet. Use <strong>Share</strong> on a <Link to="/gratitude">gratitude list</Link> or <Link to="/inventory">10th step</Link> and pick Send to {s.person.name}.</>}
        </p>
      )}
      {shares.map((sh) => <ShareCard key={sh.id} share={sh} sponsor={sponsor} name={s.person.name} onChange={load} setError={setError} />)}
    </div>
  );
}

function ShareCard({ share, sponsor, name, onChange, setError }) {
  const [reply, setReply] = useState(share.reply || "");
  const [editing, setEditing] = useState(sponsor && !share.reply);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api(`/sponsorship_shares/${share.id}`, { method: "PATCH", body: { reply } }); setEditing(false); onChange(); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const takeBack = async () => {
    if (!window.confirm(`Take this back? ${name} won't see it any more.`)) return;
    try { await api(`/sponsorship_shares/${share.id}`, { method: "DELETE" }); onChange(); } catch (err) { setError(err.message); }
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">{share.title}</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">Sent {when(share.sent_at)}{!sponsor && (share.seen ? " · Read" : " · Not read yet")}</p>
        </div>
        {sponsor && !share.seen && <Pill tone="accent">New</Pill>}
        {!sponsor && <button type="button" className={dangerButton} onClick={takeBack}><Trash2 className="size-4" /> Take back</button>}
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800 dark:text-neutral-100">{share.body}</p>
      {sponsor && editing ? (
        <form onSubmit={save} className="space-y-2 border-t border-neutral-200/70 pt-3 dark:border-neutral-800">
          <label htmlFor={`reply-${share.id}`} className={labelClass}>A short note back (optional)</label>
          <textarea id={`reply-${share.id}`} className={inputClass} rows={2} maxLength={500} value={reply} onChange={(e) => setReply(e.target.value)}
            placeholder="Proud of you. Let's talk about the resentment on Thursday." />
          <div className="flex justify-end gap-2">
            {share.reply && <button type="button" className={quietButton} onClick={() => { setReply(share.reply); setEditing(false); }}>Cancel</button>}
            <button type="submit" className={primaryButton} disabled={busy || (!reply.trim() && !share.reply)}>{busy ? "Saving…" : "Save note"}</button>
          </div>
        </form>
      ) : share.reply ? (
        <div className="rounded-xl bg-accent/10 px-3 py-2 text-sm dark:bg-accent/20">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">{sponsor ? "Your note" : `${name}'s note`}</span>
            {sponsor && <button type="button" className={linkButton} onClick={() => setEditing(true)}>Change</button>}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-neutral-100">{share.reply}</p>
        </div>
      ) : null}
    </Card>
  );
}
