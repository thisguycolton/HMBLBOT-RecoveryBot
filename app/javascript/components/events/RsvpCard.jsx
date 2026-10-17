import React, { useState } from "react";
import { BellRing, Check, FileImage, HelpCircle, X } from "lucide-react";
import { inputClass } from "../ui/styles";
import { api, STATUS_LABEL } from "./lib";
import Lightbox from "./Lightbox";

const CHOICES = [
  { status: "going", label: "Going", icon: Check },
  { status: "maybe", label: "Maybe", icon: HelpCircle },
  { status: "not_going", label: "Can't go", icon: X },
];

// RSVP for the event, with an account or just a name and email (for updates). Also the
// flyer, when there is one.
export default function RsvpCard({ event, setEvent, preview = false }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [flyer, setFlyer] = useState(false);
  const mine = event.my_rsvp;
  const draft = event.status !== "published";

  const send = async (status) => {
    if (preview || draft) return;
    setBusy(true);
    setError(null);
    try {
      const body = event.signed_in ? { status } : { status, name: name || mine?.name, email: email || mine?.email };
      setEvent(await api(`/events/${event.token}/rsvp`, { method: "PUT", body }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      setEvent(await api(`/events/${event.token}/rsvp`, { method: "DELETE" }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const needsEmail = !event.signed_in && !mine;
  const choice = (c) => {
    const active = mine?.status === c.status;
    const Icon = c.icon;
    return (
      <button key={c.status} type="button" disabled={busy || draft || preview} onClick={() => send(c.status)} aria-pressed={active}
        className={`inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-2 py-2 text-sm font-semibold disabled:opacity-60 ${
          active ? "!bg-accent !text-white shadow-panel" : "!bg-neutral-100 text-slate-700 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:text-neutral-200 dark:hover:!bg-neutral-700"
        }`}>
        <Icon className="size-4" /> {c.label}
      </button>
    );
  };

  return (
    <aside className="flex w-full flex-col justify-center rounded-3xl bg-white p-5 shadow-panel dark:bg-neutral-800/70 dark:ring-1 dark:ring-white/5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {draft ? "RSVPs open once it's published" : mine ? (mine.status === "following" ? "You're following this event" : `You're ${STATUS_LABEL[mine.status].toLowerCase()}`) : "Are you coming?"}
          </p>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            {event.counts.going} going{event.counts.maybe ? ` · ${event.counts.maybe} maybe` : ""}
          </p>
        </div>
        {event.flyer_url && (
          <button type="button" onClick={() => setFlyer(true)} className="group relative shrink-0 overflow-hidden rounded-lg !bg-transparent !p-0 ring-1 ring-neutral-200 dark:ring-neutral-700" title="See the flyer">
            <img src={event.flyer_url} alt="Flyer" className="h-16 w-12 object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 group-hover:bg-black/40 group-hover:opacity-100"><FileImage className="size-4" /></span>
          </button>
        )}
      </div>

      {needsEmail && !draft && (
        <div className="mt-3 space-y-2">
          <input className={inputClass} placeholder="Your first name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          <input className={inputClass} type="email" placeholder="Email, for updates" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            No account needed. <a href="/users/sign_in" className="text-accent hover:underline">Log in</a> to RSVP as yourself.
          </p>
        </div>
      )}

      <div className="mt-3 flex gap-2">{CHOICES.map(choice)}</div>

      {mine && mine.status !== "not_going" && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-neutral-400">
          <BellRing className="size-3.5" /> You'll get updates{mine.email ? ` at ${mine.email}` : ""}.
          <button type="button" onClick={withdraw} disabled={busy} className="ml-auto !bg-transparent !p-0 text-xs text-slate-500 underline hover:text-rose-600">Remove my RSVP</button>
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
      {flyer && <Lightbox photos={[{ url: event.flyer_url, caption: `${event.title} flyer` }]} index={0} onClose={() => setFlyer(false)} />}
    </aside>
  );
}
