import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, ImageIcon, Link2, Loader2, Send, Share2, X } from "lucide-react";
import { showToast } from "../../lib/toast";
import { saveNote, VISIBILITY } from "../notes/lib";

// "Share as a picture" for your own highlight or note: pick a look and a size, see it, then
// share it straight from your phone's share sheet (Instagram, Messages, a story...), save
// it, copy it, copy the link, or post it to your own timeline as a note with the picture
// (and a line of your own; a highlight's note links back to it in the book). The picture is drawn on our server (QuoteCard), so the
// page never calls anyone else. It names nobody unless they tick "Add my first name".
//
// `cardUrl` is where the server draws it (/api/highlights/:id/card); `link` is the share
// link that goes with a highlight (none for notes, which only members see); `hasNote` offers
// to leave a highlight's note off.
export const LOOKS = [
  { value: "paper", label: "Paper", swatch: "linear-gradient(135deg,#fdfaf3,#f4ecdc)" },
  { value: "marker", label: "Marker", swatch: "linear-gradient(135deg,#fff 0 45%,#fef08a 45% 75%,#fff 75%)" },
  { value: "night", label: "Night", swatch: "linear-gradient(160deg,#1e293b,#0b1120)" },
  { value: "sunrise", label: "Sunrise", swatch: "linear-gradient(150deg,#fb923c,#db2777)" },
];
export const SIZES = [
  { value: "square", label: "Square", hint: "For a post or a feed", ratio: "1 / 1" },
  { value: "story", label: "Story", hint: "Tall, for stories", ratio: "9 / 16" },
  { value: "wide", label: "Wide", hint: "Like a link preview", ratio: "1200 / 630" },
];

export default function PictureShare({ cardUrl, link, kind = "highlight", hasNote = false, title, text, onClose }) {
  const [look, setLook] = useState("paper");
  const [size, setSize] = useState("square");
  const [withNote, setWithNote] = useState(true);
  const [withName, setWithName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null);
  const [copied, setCopied] = useState(null);
  const [posting, setPosting] = useState(false);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState("followers");

  const src = useMemo(() => {
    const q = new URLSearchParams({ look, size });
    if (hasNote && !withNote) q.set("note", "0");
    if (withName) q.set("name", "1");
    return `${cardUrl}?${q}`;
  }, [cardUrl, look, size, hasNote, withNote, withName]);
  useEffect(() => { setLoading(true); setFailed(false); }, [src]);

  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [onClose]);

  const fetchFile = async () => {
    const res = await fetch(src, { credentials: "same-origin" });
    if (!res.ok) throw new Error("Couldn't make that picture.");
    const blob = await res.blob();
    return new File([blob], `recoverybot-${kind}-${size}.png`, { type: "image/png" });
  };

  // Phones (and some computers) can hand the picture itself to another app
  const canShareFiles = typeof navigator.canShare === "function"
    && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  const canCopyPicture = typeof window.ClipboardItem === "function" && !!navigator.clipboard?.write;

  const run = async (which, work) => {
    if (busy) return;
    setBusy(which);
    try {
      await work();
    } catch (e) {
      if (e?.name !== "AbortError") showToast(e?.message || "Something went wrong.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const share = () => run("share", async () => {
    const file = await fetchFile();
    await navigator.share({ files: [file], title, text: [text, link].filter(Boolean).join("\n") || undefined });
  });

  const copyPicture = () => run("copy", async () => {
    // Safari wants the promise handed over right away
    await navigator.clipboard.write([new window.ClipboardItem({ "image/png": fetchFile().then((f) => f) })]);
    flash("picture");
  });

  const copyLink = () => run("link", async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy this link:", link);
    }
    flash("link");
  });

  const post = () => run("post", async () => {
    const file = await fetchFile();
    const body = [caption.trim(), link && `[Read it in the book](${link})`].filter(Boolean).join("\n\n");
    await saveNote(null, { body, visibility, images: [file] });
    showToast(visibility === "private" ? "Posted to your timeline, just for you." : "Posted to your timeline.");
    setPosting(false);
    setCaption("");
  });

  const flash = (what) => { setCopied(what); setTimeout(() => setCopied(null), 1600); };
  const ratio = SIZES.find((s) => s.value === size)?.ratio;

  return createPortal(
    <div className="picture-share fixed inset-0 z-[2600] flex items-end justify-center !font-sans sm:items-center sm:p-4 [&_*]:!font-sans" role="dialog" aria-modal="true" aria-label="Share as a picture">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white text-sm text-slate-700 shadow-2xl ring-1 ring-neutral-200 sm:max-w-3xl sm:rounded-3xl dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><ImageIcon className="size-4" /> Share as a picture</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:text-neutral-400 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-4 overflow-y-auto p-4 sm:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="self-start rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-800">
            <div className="relative mx-auto w-full" style={{ maxWidth: size === "story" ? "min(15rem, 26dvh)" : size === "square" ? "min(24rem, 46dvh)" : "100%" }}>
              <img key={src} src={src} alt="Your picture" onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }}
                className={`block w-full rounded-xl bg-white shadow-md ring-1 ring-black/5 transition-opacity ${loading ? "opacity-40" : "opacity-100"}`} style={{ aspectRatio: ratio }} />
              {loading && <Loader2 className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 animate-spin text-slate-500" aria-label="Drawing it" />}
              {failed && <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-red-600">Couldn't draw that one. Try another look.</p>}
            </div>
          </div>

          <div className="space-y-4">
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Look</legend>
              <div className="grid grid-cols-4 gap-1.5">
                {LOOKS.map((l) => (
                  <button key={l.value} type="button" aria-pressed={look === l.value} onClick={() => setLook(l.value)}
                    className={`flex flex-col items-center gap-1 rounded-xl !bg-transparent p-1.5 text-[11px] font-medium ${look === l.value ? "text-accent ring-2 ring-accent" : "text-slate-600 ring-1 ring-neutral-200 dark:text-neutral-300 dark:ring-neutral-700"}`}>
                    <span className="block h-8 w-full rounded-lg ring-1 ring-black/10" style={{ background: l.swatch }} />
                    {l.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Size</legend>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
                {SIZES.map((s) => (
                  <button key={s.value} type="button" aria-pressed={size === s.value} title={s.hint} onClick={() => setSize(s.value)}
                    className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${size === s.value ? "!bg-white text-slate-900 shadow-sm dark:!bg-neutral-950 dark:text-white" : "!bg-transparent text-slate-500 dark:text-neutral-400"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              {hasNote && (
                <label className="flex items-center gap-2"><input type="checkbox" checked={withNote} onChange={(e) => setWithNote(e.target.checked)} /> Include my note</label>
              )}
              <label className="flex items-center gap-2"><input type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} /> Add my first name</label>
              <p className="text-xs text-slate-500 dark:text-neutral-400">Your name stays off unless you add it.</p>
            </div>

            <div className="grid gap-2">
              {canShareFiles && (
                <button type="button" onClick={share} disabled={!!busy}
                  className="flex items-center justify-center gap-2 rounded-xl !bg-accent px-3 py-2.5 font-semibold !text-white disabled:opacity-60">
                  {busy === "share" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} Share picture…
                </button>
              )}
              <a href={`${src}&download=1`} download
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-semibold ${canShareFiles ? "bg-neutral-100 !text-slate-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:!text-white" : "!bg-accent !text-white"}`}>
                <Download className="size-4" /> Save picture
              </a>
              <div className="grid grid-cols-2 gap-2">
                {canCopyPicture && (
                  <button type="button" onClick={copyPicture} disabled={!!busy}
                    className="flex items-center justify-center gap-1.5 rounded-xl !bg-neutral-100 px-2 py-2 text-xs font-semibold text-slate-800 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:text-white">
                    {copied === "picture" ? <Check className="size-4" /> : <Copy className="size-4" />} {copied === "picture" ? "Copied" : "Copy picture"}
                  </button>
                )}
                {link && (
                  <button type="button" onClick={copyLink} disabled={!!busy}
                    className="flex items-center justify-center gap-1.5 rounded-xl !bg-neutral-100 px-2 py-2 text-xs font-semibold text-slate-800 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:text-white">
                    {copied === "link" ? <Check className="size-4" /> : <Link2 className="size-4" />} {copied === "link" ? "Copied" : "Copy link"}
                  </button>
                )}
              </div>
              {!posting ? (
                <button type="button" onClick={() => setPosting(true)}
                  className="flex items-center justify-center gap-2 rounded-xl !bg-neutral-100 px-3 py-2.5 font-semibold text-slate-800 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:text-white">
                  <Send className="size-4" /> Post to my timeline
                </button>
              ) : (
                <div className="space-y-2 rounded-2xl p-3 ring-1 ring-neutral-200 dark:ring-neutral-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Post to my timeline</p>
                  <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} maxLength={2000} placeholder="Say something (optional)" aria-label="Say something"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base sm:text-sm dark:border-neutral-700 dark:bg-neutral-950" />
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800" role="group" aria-label="Who sees it">
                    {VISIBILITY.map((v) => (
                      <button key={v.value} type="button" aria-pressed={visibility === v.value} title={v.note} onClick={() => setVisibility(v.value)}
                        className={`rounded-lg px-1 py-1.5 text-xs font-semibold ${visibility === v.value ? "!bg-white text-slate-900 shadow-sm dark:!bg-neutral-950 dark:text-white" : "!bg-transparent text-slate-500 dark:text-neutral-400"}`}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPosting(false)} className="flex-1 rounded-xl !bg-transparent px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-neutral-200 dark:text-neutral-300 dark:ring-neutral-700">Cancel</button>
                    <button type="button" onClick={post} disabled={!!busy} className="flex flex-[2] items-center justify-center gap-1.5 rounded-xl !bg-accent px-3 py-2 text-xs font-semibold !text-white disabled:opacity-60">
                      {busy === "post" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Post
                    </button>
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                {size === "story" ? "For Instagram or Facebook stories: save it, then add it from your photos." : link
                  ? "Anyone you send the link to can open this highlight. Its link preview is a wide Paper picture."
                  : "Notes are only for members, so there's no link: share the picture."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
