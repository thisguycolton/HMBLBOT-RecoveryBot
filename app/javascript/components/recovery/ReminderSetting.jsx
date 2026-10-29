import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { api } from "../groups/lib";
import { inputClass } from "../ui/styles";
import Toggle from "../ui/Toggle";

// The daily reminders (RecoveryReminders): what each is called, and its time until they pick one
export const REMINDERS = {
  gratitude: { label: "Remind me to write my gratitude list", default: "12:00" },
  step: { label: "Remind me to do my 10th step", default: "18:00" },
};

const browserZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
};

// "18:00" -> "6:00 PM" in their own way of writing times
export const timeLabel = (at) => {
  const [h, m] = at.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

// One reminder's switch and, when it's on, its time of day. Saved as it's changed, with the
// browser's time zone, so the time is theirs. `value` is { on, at } from /api/profile's
// reminders; onSaved gets the new reminders.
export function ReminderSetting({ which, value, onSaved, description, className = "" }) {
  const [on, setOn] = useState(value.on);
  const [at, setAt] = useState(value.at || REMINDERS[which].default);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const timer = useRef(null);
  useEffect(() => { setOn(value.on); setAt(value.at || REMINDERS[which].default); }, [value.on, value.at, which]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = async (patch) => {
    setError(null);
    try {
      const p = await api("/profile", { method: "PATCH", body: { profile: { ...patch, time_zone: browserZone() } } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.(p.reminders);
    } catch (e) {
      setError(e.message);
    }
  };
  const toggle = (v) => { setOn(v); save({ [`${which}_reminder`]: v }); };
  // The time box changes a piece at a time, so wait for a whole time and a pause
  const changeAt = (v) => {
    setAt(v);
    clearTimeout(timer.current);
    if (/^\d{2}:\d{2}$/.test(v)) timer.current = setTimeout(() => save({ [`${which}_reminder_at`]: v }), 700);
  };

  return (
    <div className={`flex flex-wrap items-start gap-x-4 gap-y-2 ${className}`}>
      <Toggle className="min-w-0 flex-1" checked={on} onChange={toggle}
        label={<span className="inline-flex items-center gap-2">{REMINDERS[which].label} {saved && <Check className="h-3.5 w-3.5 text-emerald-600" />}</span>}
        description={error ? <span className="text-rose-600">{error}</span> : description ?? (on ? `Every day at ${timeLabel(at)}, unless you've already written today's.` : null)} />
      {on && (
        <input type="time" required step={300} aria-label="Reminder time" className={`${inputClass} !w-32 shrink-0`} value={at}
          onChange={(e) => changeAt(e.target.value)} />
      )}
    </div>
  );
}

// On the gratitude and 10th step pages: that page's reminder, loaded on its own
export function DailyReminder({ which }) {
  const [reminders, setReminders] = useState(null);
  useEffect(() => { api("/profile").then((p) => setReminders(p.reminders)).catch(() => {}); }, []);
  if (!reminders) return null;
  return <ReminderSetting which={which} value={reminders[which]} onSaved={setReminders} />;
}
