import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, FileJson, Loader2, UploadCloud, X } from "lucide-react";
import { inputClass, labelClass } from "../ui/styles";
import { clock, parseChapters } from "../../lib/videoChapters";
import { uploadWithProgress } from "../../lib/uploadWithProgress";

const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v";
export const VIDEO_MAX_MB = 300; // Api::DocsController::VIDEO_MAX
const mb = (bytes) => (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0);
const plainName = (name) => name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();

// The docs editor's "Add a video" window (/ Video, or dropping a video on the page): the video
// file, a title, and its chapters from a JSON file (or pasted, or typed), shown as a list before
// anything is sent. Upload sends the video with a progress bar; DocEditor keeps the page from
// being left while `onBusy` says it's still going. When it's done, `onDone` gets the ```video
// block's JSON with the chapters written into it.
export default function DocVideoUpload({ pageId, initialFile = null, onDone, onClose, onBusy }) {
  const [file, setFile] = useState(initialFile);
  const [title, setTitle] = useState(initialFile ? plainName(initialFile.name) : "");
  const [chaptersText, setChaptersText] = useState("");
  const [chaptersFile, setChaptersFile] = useState(null);
  const [progress, setProgress] = useState(null); // { loaded, total, startedAt } while sending
  const [finishing, setFinishing] = useState(false); // all bytes sent, the server is storing it
  const [error, setError] = useState(null);
  const job = useRef(null);
  const videoInput = useRef(null);
  const jsonInput = useRef(null);
  const busy = !!progress;

  useEffect(() => { onBusy?.(busy); }, [busy, onBusy]);
  useEffect(() => () => job.current?.abort(), []);
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [busy, onClose]);

  const chapters = useMemo(() => {
    if (!chaptersText.trim()) return { list: [] };
    try {
      const list = parseChapters(chaptersText);
      return list.length ? { list } : { list, error: "No chapters found. Each one needs a start and a title." };
    } catch {
      return { list: [], error: "That isn't valid JSON." };
    }
  }, [chaptersText]);

  const pickVideo = (f) => {
    if (!f) return;
    setError(null);
    if (!/^video\//.test(f.type) && !/\.(mp4|webm|mov|m4v)$/i.test(f.name)) { setError("Pick an MP4, WebM or MOV video."); return; }
    if (f.size > VIDEO_MAX_MB * 1048576) { setError(`Videos can be up to ${VIDEO_MAX_MB} MB. This one is ${mb(f.size)} MB.`); return; }
    setFile(f);
    if (!title.trim()) setTitle(plainName(f.name));
  };
  const pickJson = (f) => {
    if (!f) return;
    f.text().then((text) => { setChaptersFile(f.name); setChaptersText(text.trim()); });
  };

  const start = () => {
    if (!file || chapters.error) return;
    setError(null);
    setFinishing(false);
    const form = new FormData();
    form.append("video", file);
    const startedAt = Date.now();
    setProgress({ loaded: 0, total: file.size, startedAt });
    job.current = uploadWithProgress(`/api/docs/pages/${pageId}/videos`, form, ({ loaded, total }) => {
      setProgress({ loaded, total, startedAt });
      if (loaded >= total) setFinishing(true);
    });
    job.current.promise
      .then(({ url }) => {
        setProgress(null);
        const block = { src: url, ...(title.trim() ? { title: title.trim() } : {}) };
        if (chapters.list.length) block.chapters = chapters.list.map((c) => ({ start: clock(c.start), title: c.title }));
        onDone(block);
      })
      .catch((e) => { setProgress(null); setFinishing(false); if (!e.aborted) setError(e.message); });
  };
  const cancel = () => job.current?.abort();

  const pct = progress ? Math.min(100, Math.round((progress.loaded / (progress.total || 1)) * 100)) : 0;
  const left = (() => {
    if (!progress || !progress.loaded || finishing) return null;
    const secs = ((Date.now() - progress.startedAt) / progress.loaded) * (progress.total - progress.loaded) / 1000;
    if (!Number.isFinite(secs) || secs < 1) return null;
    return secs < 60 ? `about ${Math.ceil(secs)} s left` : `about ${Math.ceil(secs / 60)} min left`;
  })();

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Add a video">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl dark:bg-neutral-900 sm:rounded-[28px]">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <span className="grid size-9 place-items-center rounded-xl bg-accent-tint text-accent dark:bg-accent/25 dark:text-white"><Clapperboard size={18} /></span>
          <h2 className="!m-0 flex-1 text-lg font-semibold text-slate-900 dark:text-white">Add a video</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
            className="grid size-9 place-items-center rounded-full !bg-transparent !p-0 text-slate-500 hover:!bg-neutral-100 disabled:opacity-30 dark:text-neutral-400 dark:hover:!bg-neutral-800">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          {/* The video */}
          <div>
            <span className={labelClass}>Video</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => videoInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (!busy) pickVideo(e.dataTransfer.files?.[0]); }}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 !bg-neutral-50 px-4 py-4 text-left hover:border-accent/60 disabled:cursor-default dark:border-neutral-700 dark:!bg-neutral-950"
            >
              <UploadCloud size={22} className="shrink-0 text-accent dark:text-accent-light" />
              <span className="min-w-0 flex-1">
                {file ? (
                  <>
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{file.name}</span>
                    <span className="block text-xs text-slate-500 dark:text-neutral-400">{mb(file.size)} MB{!busy && " · choose another"}</span>
                  </>
                ) : (
                  <>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">Choose a video, or drop it here</span>
                    <span className="block text-xs text-slate-500 dark:text-neutral-400">MP4 works everywhere. Up to {VIDEO_MAX_MB} MB.</span>
                  </>
                )}
              </span>
            </button>
            <input ref={videoInput} type="file" accept={VIDEO_ACCEPT} hidden onChange={(e) => { pickVideo(e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          <label className="block">
            <span className={labelClass}>Title <span className="font-normal text-slate-400">(shown above the chapters)</span></span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} className={inputClass} placeholder="What this video shows" />
          </label>

          {/* Chapters */}
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className={`${labelClass} !mb-0 flex-1`}>Chapters <span className="font-normal text-slate-400">(optional)</span></span>
              <button type="button" disabled={busy} onClick={() => jsonInput.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full !bg-neutral-100 px-3 py-1 text-xs font-semibold !text-slate-700 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:!text-neutral-200">
                <FileJson size={14} /> Upload JSON
              </button>
              <input ref={jsonInput} type="file" accept=".json,application/json,.txt,text/plain" hidden onChange={(e) => { pickJson(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <textarea
              value={chaptersText}
              onChange={(e) => { setChaptersText(e.target.value); setChaptersFile(null); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { const f = e.dataTransfer.files?.[0]; if (f) { e.preventDefault(); pickJson(f); } }}
              disabled={busy}
              rows={4}
              spellCheck={false}
              placeholder={'[{ "start": "0:00", "title": "Intro" }, { "start": "1:15", "title": "Next part" }]'}
              className={`${inputClass} font-mono text-xs`}
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              aria-label="Chapters JSON"
            />
            {chaptersFile && !chapters.error && <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">From {chaptersFile}</p>}
            {chapters.error && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{chapters.error}</p>}
            {chapters.list.length > 0 && (
              <ol className="mt-2 max-h-44 list-none overflow-y-auto rounded-2xl border border-neutral-200 !p-1.5 dark:border-neutral-800">
                {chapters.list.map((c) => (
                  <li key={c.start} className="flex items-baseline gap-3 rounded-lg px-2 py-1 text-sm text-slate-700 dark:text-neutral-300">
                    <span className="w-12 shrink-0 tabular-nums text-xs text-slate-500 dark:text-neutral-400">{clock(c.start)}</span>
                    <span className="min-w-0 flex-1">{c.title}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        </div>

        <div className="border-t border-neutral-200 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-neutral-800">
          {busy ? (
            <div>
              <div className="mb-2 flex items-baseline gap-2 text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">{finishing ? "Saving the video…" : `Uploading… ${pct}%`}</span>
                <span className="ml-auto tabular-nums text-xs text-slate-500 dark:text-neutral-400">
                  {finishing ? "almost done" : `${mb(progress.loaded)} of ${mb(progress.total)} MB${left ? ` · ${left}` : ""}`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <div className={`h-full rounded-full bg-accent transition-[width] duration-200 ${finishing ? "animate-pulse" : ""}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <p className="!m-0 flex-1 text-xs text-slate-500 dark:text-neutral-400">Keep this page open until it finishes.</p>
                <button type="button" onClick={cancel} disabled={finishing}
                  className="rounded-full !bg-neutral-100 px-4 py-2 text-sm font-semibold !text-slate-700 hover:!bg-neutral-200 disabled:opacity-40 dark:!bg-neutral-800 dark:!text-neutral-200">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose}
                className="rounded-full !bg-transparent px-4 py-2 text-sm font-semibold !text-slate-600 hover:!bg-neutral-100 dark:!text-neutral-300 dark:hover:!bg-neutral-800">
                Not now
              </button>
              <button type="button" onClick={start} disabled={!file || !!chapters.error}
                className="inline-flex items-center gap-1.5 rounded-full !bg-accent px-4 py-2 text-sm font-semibold !text-white hover:opacity-90 disabled:opacity-40">
                {finishing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />} Upload and add
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
