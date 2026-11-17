import React, { useRef, useState } from "react";
import { FileUp, FolderUp, X } from "lucide-react";
import { api } from "../lib";
import { Card, ErrorNote, Pill, primaryButton, quietButton } from "../ui";
import { longDate } from "./lib";

const STATUS_TONE = { passed: "green", failed: "slate", tabled: "amber", withdrawn: "slate", no_second: "slate", proposed: "accent" };

// Bringing old minutes in from Word files (app/services/minutes_import.rb): pick the folder (with
// its year folders) or some .docx files, see what they'd become, then bring them in. It all
// lands for record keepers to check: the meetings for keepers only, the motions waiting on a save.
export default function MinutesImport({ group, onClose, onDone }) {
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const folderInput = useRef(null);
  const fileInput = useRef(null);

  const pick = (list) => {
    setFiles(Array.from(list || []).filter((f) => !f.name.startsWith(".")));
    setPreview(null);
    setDone(null);
    setError(null);
  };
  const send = async (dryRun) => {
    setBusy(true);
    setError(null);
    const form = new FormData();
    files.forEach((f) => { form.append("files[]", f); form.append("names[]", f.webkitRelativePath || f.name); });
    form.append("dry_run", dryRun ? "1" : "0");
    try {
      const res = await api(`/groups/${group.slug}/minutes_imports`, { method: "POST", form });
      if (dryRun) setPreview(res);
      else { setDone(res); setPreview(null); onDone?.(); }
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const shown = preview || done;
  const kept = shown?.rows.filter((r) => !r.skipped) || [];
  const skipped = shown?.rows.filter((r) => r.skipped) || [];

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-white">Import old minutes</h3>
          <p className="text-sm text-slate-600 dark:text-neutral-300">Word files (.docx), one per meeting. Pick the whole folder if the files sit in year folders (2024, 2025...), so files named only by month get their year. Agendas and duplicate copies are skipped, and phone numbers and emails are taken out.</p>
        </div>
        <button type="button" aria-label="Close" className={`${quietButton} !px-2`} onClick={onClose}><X className="size-4" /></button>
      </div>
      <ErrorNote error={error} />
      <div className="flex flex-wrap gap-2">
        <input ref={folderInput} type="file" className="hidden" webkitdirectory="" directory="" multiple onChange={(e) => pick(e.target.files)} />
        <input ref={fileInput} type="file" className="hidden" accept=".docx" multiple onChange={(e) => pick(e.target.files)} />
        <button type="button" className={quietButton} onClick={() => folderInput.current.click()}><FolderUp className="size-4" /> Choose a folder</button>
        <button type="button" className={quietButton} onClick={() => fileInput.current.click()}><FileUp className="size-4" /> Choose files</button>
        {files.length > 0 && <span className="self-center text-sm text-slate-600 dark:text-neutral-300">{files.length} {files.length === 1 ? "file" : "files"} chosen</span>}
      </div>
      {files.length > 0 && !preview && !done && (
        <button type="button" className={primaryButton} disabled={busy} onClick={() => send(true)}>{busy ? "Reading them..." : "See what's in them"}</button>
      )}

      {shown && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {done ? "Brought in" : "Found"} {shown.meetings} business {shown.meetings === 1 ? "meeting" : "meetings"} and {shown.motions} {shown.motions === 1 ? "motion" : "motions"}{skipped.length ? `; ${skipped.length} ${skipped.length === 1 ? "file" : "files"} left out` : ""}.
          </p>
          {done && <p className="text-sm text-slate-600 dark:text-neutral-300">The meetings are visible to record keepers only for now. The motions are in Decisions with a warning sign: open each one, check it against the minutes, and save it so members can see it.</p>}
          <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto">
            {kept.map((r) => (
              <li key={r.file} className="rounded-lg bg-neutral-50 p-2.5 text-sm dark:bg-neutral-950">
                <p className="font-medium text-slate-900 dark:text-white">{longDate(r.held_on)} <span className="font-normal text-slate-500 dark:text-neutral-400">· {r.file}</span></p>
                {r.motions.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {r.motions.map((m, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-slate-700 dark:text-neutral-200">
                        <Pill tone={STATUS_TONE[m.status] || "slate"}>{m.status.replace("_", " ")}</Pill>
                        <span className="min-w-0 flex-1">{m.title}{m.moved_by_name ? ` (moved by ${m.moved_by_name})` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {skipped.length > 0 && (
            <details className="text-sm text-slate-600 dark:text-neutral-300">
              <summary className="cursor-pointer">Left out</summary>
              <ul className="mt-1 space-y-0.5">{skipped.map((r) => <li key={r.file}>{r.file}: {r.skipped}</li>)}</ul>
            </details>
          )}
          {preview && (
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={quietButton} onClick={() => pick([])}>Start over</button>
              <button type="button" className={primaryButton} disabled={busy || preview.meetings === 0} onClick={() => send(false)}>{busy ? "Bringing them in..." : `Bring in ${preview.meetings} ${preview.meetings === 1 ? "meeting" : "meetings"}`}</button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
