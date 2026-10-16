import React, { useState } from "react";
import { Send } from "lucide-react";
import { showToast } from "../../lib/toast";
import { api } from "./lib";

// Write a timeline note (Api::TimelineNotesController). On your timeline you pick which of
// your groups see it (`groups`); in a group page's Timeline block it goes to that group
// (`shareTo`). onPosted(note) once it's saved.
export default function NoteComposer({ groups, shareTo, max = 2000, onPosted, placeholder = "Share something with your group…", compact = false }) {
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState(() => (shareTo ? [shareTo] : []));
  const [busy, setBusy] = useState(false);

  const post = async (e) => {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const note = await api("/timeline_notes", { method: "POST", body: { note: { body, group_slugs: picked } } });
      setBody("");
      onPosted?.(note);
    } catch (err) {
      showToast(err.message, { tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  const toggle = (slug) => setPicked((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));

  return (
    <form onSubmit={post} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={max}
        rows={compact ? 2 : 3}
        placeholder={placeholder}
        className="w-full resize-y rounded-xl border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-neutral-200 placeholder:text-slate-400 focus:ring-2 focus:ring-accent dark:bg-neutral-900 dark:text-white dark:ring-neutral-700"
      />
      {groups && groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 dark:text-neutral-400">Share to</span>
          {groups.map((g) => (
            <button key={g.slug} type="button" onClick={() => toggle(g.slug)} aria-pressed={picked.includes(g.slug)}
              className={`rounded-full px-2.5 py-1 font-medium ring-1 ${picked.includes(g.slug) ? "!bg-accent/10 text-accent ring-accent dark:!bg-accent/25 dark:text-sky-200" : "!bg-transparent text-slate-600 ring-neutral-300 hover:!bg-neutral-100 dark:text-neutral-300 dark:ring-neutral-700 dark:hover:!bg-neutral-800"}`}>
              {g.title}
            </button>
          ))}
          {picked.length === 0 && <span className="text-slate-400">· only you will see it</span>}
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        {body.length > max * 0.8 && <span className="text-xs text-slate-400">{body.length}/{max}</span>}
        <button type="submit" disabled={busy || !body.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl !bg-accent px-3 py-1.5 text-sm font-semibold !text-white shadow-panel hover:opacity-90 disabled:opacity-50">
          <Send className="size-3.5" /> {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
