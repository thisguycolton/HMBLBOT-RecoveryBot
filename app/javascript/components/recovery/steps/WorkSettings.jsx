import React, { useEffect, useState } from "react";
import { Bell, Send } from "lucide-react";
import { Card } from "../../groups/ui";
import { inputClass } from "../../ui/styles";
import Toggle from "../../ui/Toggle";
import { timeLabel } from "../ReminderSetting";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// A worksheet's own settings: a reminder (a time, every day or on the days picked, skipped on
// a day they already worked on it; RecoveryReminders.remind_work) and sending it to their
// sponsors automatically as they write (off unless they turn it on)
export default function WorkSettings({ work, save }) {
  const [at, setAt] = useState(work.remind_at || "19:00");
  useEffect(() => { if (work.remind_at) setAt(work.remind_at); }, [work.remind_at]);
  const days = work.remind_days || [];
  const on = !!work.remind_at;
  const toggleDay = (d) => save({ remind_days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort() });

  return (
    <Card className="divide-y divide-neutral-200/70 print:hidden dark:divide-neutral-800">
      <div className="space-y-3 p-4">
        <Toggle checked={on} onChange={(v) => save({ remind_at: v ? at : "" })} label={<span className="inline-flex items-center gap-1.5 font-medium"><Bell className="size-4" /> Remind me to work on this</span>} />
        {on && (
          <div className="flex flex-wrap items-center gap-3">
            <input type="time" aria-label="Time" className={`${inputClass} max-w-[9rem]`} value={at}
              onChange={(e) => setAt(e.target.value)} onBlur={() => at && at !== work.remind_at && save({ remind_at: at })} />
            <div role="group" aria-label="Days" className="flex flex-wrap gap-1">
              {DAYS.map((d, n) => (
                <button key={d} type="button" aria-pressed={days.includes(n)} onClick={() => toggleDay(n)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${days.includes(n) ? "!bg-accent !text-white ring-accent" : "!bg-white text-slate-600 ring-neutral-200 dark:!bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700"}`}>{d}</button>
              ))}
            </div>
            <p className="w-full text-xs text-slate-500 dark:text-neutral-400">
              {days.length ? "On the days picked" : "Every day"} at {timeLabel(work.remind_at)}, unless you've already worked on it that day. Stops when it's marked done.
            </p>
          </div>
        )}
      </div>
      <div className="p-4">
        <Toggle checked={!!work.auto_send} onChange={(v) => save({ auto_send: v })}
          label={<span className="inline-flex items-center gap-1.5 font-medium"><Send className="size-4" /> Send to my sponsor as I write</span>}
          description={work.auto_send
              ? `Your sponsors get the latest version as you save${work.auto_sent_at ? `; last sent ${new Date(work.auto_sent_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}. They're told once, not on every change.`
            : "Off: nothing goes to your sponsor unless you press Send."} />
      </div>
    </Card>
  );
}
