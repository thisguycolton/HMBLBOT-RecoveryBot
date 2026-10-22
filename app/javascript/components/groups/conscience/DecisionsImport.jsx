import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { api } from "../lib";
import { Card, ErrorNote, Pill, primaryButton, quietButton } from "../ui";

// What importing a decisions file (Download JSON on this page, changed and brought back) would do,
// row by row, before anything is saved. The server checks every row the way saving would, so what's
// shown here is what happens.
const ACTIONS = { create: ["New", "green"], update: ["Changed", "accent"], delete: ["Deleted", "amber"], unchanged: ["Unchanged", "slate"] };
const FIELD_LABELS = {
  parent_id: "applies to", supersedes_id: "replaces", moved_by: "moved by", seconded_by: "seconded by", decided_on: "decided",
  votes_for: "for", votes_against: "against", one_time: "one-time", ignore_rules: "ignore the rules", needs_review: "to check",
};
const shown = (v) => (v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));

export default function DecisionsImport({ slug, file, preview, onDone, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { summary, rows, ok } = preview;
  const total = summary.create + summary.update + summary.delete;
  const parts = [summary.create && `${summary.create} new`, summary.update && `${summary.update} changed`, summary.delete && `${summary.delete} deleted`, summary.unchanged && `${summary.unchanged} unchanged`].filter(Boolean);

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api(`/groups/${slug}/motions/import`, { method: "POST", body: { file: file.text, dry_run: false } });
      if (result.saved) return onDone(result);
      setError("Something in the file changed what it would do. Import it again to see.");
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Import {file.name}</h3>
          <p className="text-sm text-slate-600 dark:text-neutral-300">
            {parts.length ? `${parts.join(", ")}.` : "Nothing to change."}
            {" "}Nothing is saved until you import.
          </p>
        </div>
        <button type="button" className={`${quietButton} !p-1.5`} onClick={onCancel} aria-label="Close"><X className="size-4" /></button>
      </div>
      {!ok && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Some rows have problems, so none of it can be imported yet. Fix them in the file and choose it again.
        </p>
      )}
      <ErrorNote error={error} />
      <ol className="space-y-2">
        {rows.map((r) => {
          const [label, tone] = ACTIONS[r.action] || ACTIONS.update;
          return (
            <li key={r.index} className={`rounded-xl border p-3 text-sm ${r.errors.length ? "border-amber-300 dark:border-amber-800" : "border-neutral-200 dark:border-neutral-800"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={tone}>{label}</Pill>
                <span className="font-medium text-slate-900 dark:text-white">{r.title || "(no title)"}</span>
                <span className="text-xs text-slate-500 dark:text-neutral-400">{r.id ? `#${r.id}` : r.ref ? `ref ${r.ref}` : `row ${r.index + 1}`}</span>
              </div>
              {r.errors.map((e) => <p key={e} className="mt-1 text-amber-800 dark:text-amber-300">{e}</p>)}
              {r.action !== "delete" && Object.keys(r.changes).length > 0 && (
                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                  {Object.entries(r.changes).map(([field, [from, to]]) => (
                    <React.Fragment key={field}>
                      <dt className="text-slate-500 dark:text-neutral-400">{FIELD_LABELS[field] || field.replace(/_/g, " ")}</dt>
                      <dd className="min-w-0 break-words text-slate-700 dark:text-neutral-200">
                        {r.action === "create" ? null : <><s className="text-slate-400">{shown(from)}</s>{" → "}</>}
                        {shown(to)}
                      </dd>
                    </React.Fragment>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primaryButton} disabled={!ok || busy || total === 0} onClick={apply}>
          {busy ? "Importing…" : `Import ${total} ${total === 1 ? "change" : "changes"}`}
        </button>
        <button type="button" className={quietButton} onClick={onCancel}>Cancel</button>
      </div>
    </Card>
  );
}
