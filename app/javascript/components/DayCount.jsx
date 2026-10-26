import React, { useEffect, useRef, useState } from "react";
import { confetti } from "../lib/confetti";
import { milestoneStatus } from "../lib/milestones";
import { soberFor } from "./groups/lib";
import "../styles/day-count.css";

// The member's day count, in a modal when they sign in (the server marks a fresh sign-in:
// config/initializers/day_count.rb, and the toasts partial passes it in data-day-count-login
// with their sobriety date). On a milestone day it also opens on their first page of the day
// if they stayed signed in, with confetti. Plain CSS (day-count.css), since this mounts with
// the toasts on the older Bootstrap pages too.
const SEEN_KEY = "hb-day-count-seen"; // the local date it last opened, "YYYY-MM-DD"

const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function seenToday() {
  try { return localStorage.getItem(SEEN_KEY) === localDate(); } catch { return false; }
}

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, localDate()); } catch { /* private mode */ }
}

export default function DayCount({ since, signedIn }) {
  const [status] = useState(() => milestoneStatus(since));
  const [open, setOpen] = useState(() => Boolean(status && (signedIn || (status.today && !seenToday()))));
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    markSeen();
    closeRef.current?.focus();
    const timer = status.today ? setTimeout(() => confetti(), 250) : null;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const { days, today, next } = status;
  const close = () => setOpen(false);
  const sinceLabel = new Date(`${since}T00:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="hb-daycount" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-labelledby="hb-daycount-title" className={`hb-daycount__panel ${today ? "hb-daycount__panel--milestone" : ""}`}>
        <button type="button" aria-label="Close" className="hb-daycount__close" onClick={close}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="hb-daycount__head">
          <div className="hb-daycount__meta">{today ? "Milestone" : "Your day count"}</div>
          {today && <h2 id="hb-daycount-title" className="hb-daycount__title">Happy {today.label}!</h2>}
          <div className="hb-daycount__number" {...(today ? {} : { id: "hb-daycount-title" })}>
            {days === 0 ? "Day one" : days.toLocaleString()}
            {days > 0 && <span className="hb-daycount__unit">{days === 1 ? " day" : " days"}</span>}
          </div>
          <div className="hb-daycount__since">
            {days >= 90 && <>{soberFor(since)} · </>}since {sinceLabel}
          </div>
        </div>
        <div className="hb-daycount__body">
          {today ? (
            <p>Today you celebrate {today.label}. Congratulations, and thank you for showing the way for the rest of us.</p>
          ) : days === 0 ? (
            <p>Today is day one. One day at a time, and we're glad you're here.</p>
          ) : (
            <p>One day at a time. Keep coming back.</p>
          )}
          {next && (
            <p className="hb-daycount__next">
              Next milestone: <strong>{next.label}</strong> {next.inDays === 1 ? "tomorrow" : `in ${next.inDays.toLocaleString()} days`}
            </p>
          )}
        </div>
        <div className="hb-daycount__foot">
          <a className="hb-daycount__link" href="/users/edit">Change my sobriety date</a>
          {today && <button type="button" className="hb-daycount__button" onClick={() => confetti()}>Celebrate again</button>}
          <button ref={closeRef} type="button" className="hb-daycount__button hb-daycount__button--primary" onClick={close}>Thanks</button>
        </div>
      </div>
    </div>
  );
}
