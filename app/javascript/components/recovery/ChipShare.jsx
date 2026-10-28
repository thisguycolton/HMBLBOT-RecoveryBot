import React, { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { api } from "../groups/lib";
import { primaryButton, quietButton } from "../groups/ui";
import { showToast } from "../../lib/toast";
import { VISIBILITY } from "../notes/lib";
import { localDate } from "./lib";

// Share to timeline, under a chip in its modal: never automatic. Opens to who sees it
// (Followers or Members), a few words, and the groups to share it to as well, then posts it
// as a note with the chip on it (Api::TimelineNotesController#create, chip_id). `options` is
// what /api/recovery says (share_groups, shared, profile_path); without it, it asks.
export default function ChipShare({ chip, options: given, startOpen = false }) {
  const [options, setOptions] = useState(given || null);
  const [open, setOpen] = useState(startOpen);
  const [visibility, setVisibility] = useState("followers");
  const [body, setBody] = useState("");
  const [groups, setGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const start = async () => {
    setOpen(true);
    if (options) return;
    try { setOptions(await api(`/recovery?today=${localDate()}`)); } catch { setOptions({ share_groups: [], shared: [] }); }
  };
  if (options && !options.profile_path) return null; // profiles aren't open to them yet
  const shared = done || options?.shared?.includes(chip.id);

  const share = async () => {
    setSaving(true);
    try {
      await api("/timeline_notes", { method: "POST", body: { note: { chip_id: chip.id, today: localDate(), body, visibility, group_slugs: groups } } });
      setDone(true);
      setOpen(false);
      showToast("Shared to your timeline.");
    } catch (e) {
      showToast(e.message, { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className={quietButton} onClick={start}>
          {shared ? <Check className="size-4" /> : <Share2 className="size-4" />} {shared ? "Shared · share again" : "Share to timeline"}
        </button>
        {shared && options?.profile_path && <a href={options.profile_path} className="text-sm font-medium text-accent hover:underline">See your timeline</a>}
      </div>
    );
  }

  const choices = VISIBILITY.filter((v) => v.value !== "private");
  return (
    <div className="space-y-3 rounded-2xl p-3 text-left ring-1 ring-neutral-200 dark:ring-neutral-700">
      <div role="radiogroup" aria-label="Who sees it" className="flex flex-wrap gap-2">
        {choices.map((v) => {
          const Icon = v.icon;
          return (
            <button key={v.value} type="button" role="radio" aria-checked={visibility === v.value} onClick={() => setVisibility(v.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${visibility === v.value ? "!bg-accent/10 text-accent ring-accent/40" : "!bg-transparent text-slate-600 ring-neutral-300 dark:text-neutral-300 dark:ring-neutral-700"}`}>
              <Icon className="size-3.5" /> {v.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 dark:text-neutral-400">
        {choices.find((v) => v.value === visibility).note}.{chip.kind === "round" ? " A sobriety chip tells them how long you've been sober." : ""}
      </p>
      <label className="block">
        <span className="sr-only">Say something (optional)</span>
        <textarea id="chip-share-body" rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Say something (optional)"
          className="w-full rounded-xl border-0 bg-neutral-50 p-2.5 text-sm ring-1 ring-neutral-200 focus:ring-2 focus:ring-accent dark:bg-neutral-900 dark:ring-neutral-700" />
      </label>
      {options?.share_groups?.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Also share to</legend>
          {options.share_groups.map((g) => (
            <label key={g.slug} className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
              <input type="checkbox" checked={groups.includes(g.slug)}
                onChange={(e) => setGroups((list) => (e.target.checked ? [...list, g.slug] : list.filter((s) => s !== g.slug)))} />
              {g.title}
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={quietButton} onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className={primaryButton} disabled={saving || !options} onClick={share}>{saving ? "Sharing…" : "Share"}</button>
      </div>
    </div>
  );
}
