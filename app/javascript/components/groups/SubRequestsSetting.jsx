import React, { useState } from "react";
import { BellRing } from "lucide-react";
import { api } from "./lib";
import { Card, ErrorNote } from "./ui";

const CHOICES = [
  { value: "members", label: "All members", note: "Everyone in the group sees \"A sub is needed\", hears about it and can take it." },
  { value: "hosts", label: "Only people who can host", note: "Only members marked Can host (and host coordinators, record keepers and admins) see it and can take it." },
  { value: "off", label: "Off", note: "Nobody else sees sub requests. The host coordinators fill each place." },
];

// Manage > Meetings setup: who sees a "Need a sub" request (groups.sub_requests_audience). Host
// coordinators always see the requests for their own time slots, whatever's picked here.
export default function SubRequestsSetting({ group, setGroup }) {
  const [value, setValue] = useState(group.sub_requests_audience || "members");
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const pick = async (next) => {
    if (next === value) return;
    const was = value;
    setValue(next);
    setError(null);
    setSaved(false);
    try {
      const updated = await api(`/groups/${group.slug}`, { method: "PATCH", body: { group: { sub_requests_audience: next } } });
      setGroup?.(updated);
      setSaved(true);
    } catch (e) {
      setValue(was);
      setError(e.message);
    }
  };

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-accent" />
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900 dark:text-white">Who sees sub requests</h2>
          <p className="text-sm text-slate-600 dark:text-neutral-300">When a host can't make a date, who sees "A sub is needed". Host coordinators always see the requests for their own time slots.</p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Who sees sub requests" className="grid gap-2 sm:grid-cols-3">
        {CHOICES.map((c) => (
          <button key={c.value} type="button" role="radio" aria-checked={value === c.value} onClick={() => pick(c.value)}
            className={`rounded-xl p-3 text-left ring-1 transition-colors ${value === c.value
              ? "!bg-accent/10 ring-2 !ring-accent dark:!bg-accent/20"
              : "!bg-white ring-neutral-200 hover:!bg-neutral-50 dark:!bg-neutral-900 dark:ring-neutral-700"}`}>
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">{c.label}{c.value === "members" && <span className="font-normal text-slate-500"> (default)</span>}</span>
            <span className="mt-1 block text-xs text-slate-600 dark:text-neutral-400">{c.note}</span>
          </button>
        ))}
      </div>
      {saved && <p className="text-xs text-emerald-700 dark:text-emerald-400" role="status">Saved.</p>}
      <ErrorNote error={error} />
    </Card>
  );
}
