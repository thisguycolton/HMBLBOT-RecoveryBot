import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, Film, ImageIcon, Loader2, Share2, X } from "lucide-react";
import { showToast } from "../../lib/toast";
import { chipFaces } from "./ChipModal";

// Share a chip as a picture, a GIF or a video: pick a background (a few gradients, or two
// colors of your own), a size and, for the moving ones, a speed; see it live; then share it
// from your phone's share sheet, save it or copy it. Everything is drawn right here
// (chipMotion.js), so the chip never goes to our server or anyone else's. It says nothing
// but the chip unless they add the chip's name or their first name.
//
// The moving one spins in, holds its front, turns over to its back, holds, and spins out
// into the start again, so it loops.

const FORMATS = [
  { value: "picture", label: "Picture" },
  { value: "gif", label: "GIF" },
  { value: "video", label: "Video" },
];
const RATIOS = { square: "1 / 1", story: "9 / 16", wide: "1200 / 630" };

let motion; // chipMotion.js, loaded the first time someone opens this
const loadMotion = () => (motion ||= import("./chipMotion"));

export default function ChipPictureShare({ chip, design, firstName, onClose }) {
  const [lib, setLib] = useState(null);
  const [prepared, setPrepared] = useState(null);
  const [failed, setFailed] = useState(null);
  const [format, setFormat] = useState("gif");
  const [background, setBackground] = useState("night");
  const [custom, setCustom] = useState({ from: "#0ea5e9", to: "#9333ea" });
  const [size, setSize] = useState("square");
  const [pair, setPair] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [withLabel, setWithLabel] = useState(false);
  const [withName, setWithName] = useState(false);
  const [withDate, setWithDate] = useState(false);
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const made = useRef(new Map()); // files already made, by choices
  const canvasRef = useRef(null);

  useEffect(() => {
    let live = true;
    loadMotion()
      .then(async (m) => {
        // the date it was earned is on its back only if they want it there
        const chipReady = await m.prepareChip(chipFaces(withDate ? chip : { ...chip, on: null }, design));
        if (live) { setLib(m); setPrepared(chipReady); }
      })
      .catch(() => live && setFailed("Couldn't draw this chip."));
    return () => { live = false; };
  }, [chip, design, withDate]);

  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [onClose]);

  const colors = background === "custom" ? custom : lib?.BACKGROUNDS.find((b) => b.value === background);
  const lines = useMemo(() => {
    const out = [];
    if (withLabel) out.push(chip.label);
    if (withName && firstName) out.push(firstName);
    return out;
  }, [withLabel, withName, firstName, chip.label]);
  const opts = useMemo(() => colors && ({ format, background: colors, size, pair: format === "picture" && pair, speed, lines }), [format, colors, size, pair, speed, lines]);
  const key = JSON.stringify({ ...opts, withDate });

  // The live preview, redrawn whenever a choice changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!lib || !prepared || !canvas || !opts) return undefined;
    const [W, H] = lib.SIZES[size].picture;
    const scale = Math.min(1, (canvas.clientWidth * (window.devicePixelRatio || 1)) / W) || 0.5;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    return lib.preview(canvas, prepared, opts);
  }, [lib, prepared, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const ext = { picture: "png", gif: "gif", video: "mp4" }[format];
  const fileName = (blob) => {
    const e = blob.type === "video/webm" ? "webm" : ext;
    return `recoverybot-chip-${(chip.label || "chip").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${e}`;
  };
  const make = async () => {
    if (made.current.has(key)) return made.current.get(key);
    setProgress(0);
    const blob = format === "picture" ? await lib.makePicture(prepared, opts)
      : format === "gif" ? await lib.makeGif(prepared, opts, setProgress)
        : await lib.makeVideo(prepared, opts, setProgress);
    const file = new File([blob], fileName(blob), { type: blob.type });
    made.current.set(key, file);
    return file;
  };

  const run = async (which, work) => {
    if (busy || !prepared) return;
    setBusy(which);
    try {
      await work();
    } catch (e) {
      if (e?.name !== "AbortError") showToast(e?.message || "Something went wrong.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const canShareFiles = typeof navigator.canShare === "function"
    && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  const canCopy = format === "picture" && typeof window.ClipboardItem === "function" && !!navigator.clipboard?.write;

  const share = () => run("share", async () => {
    const file = await make();
    if (!navigator.canShare({ files: [file] })) throw new Error(`This device can't share a ${format === "video" ? "video" : "GIF"} to another app. Save it instead.`);
    await navigator.share({ files: [file], title: `${chip.label} chip` });
  });
  const save = () => run("save", async () => {
    const file = await make();
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });
  const copy = () => run("copy", async () => {
    // Safari wants the promise handed over right away
    await navigator.clipboard.write([new window.ClipboardItem({ "image/png": make().then((f) => f) })]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  });

  const making = busy && busy !== "copy" && format !== "picture";
  const noun = { picture: "picture", gif: "GIF", video: "video" }[format];
  const segment = (active) => `rounded-lg px-2 py-1.5 text-xs font-semibold ${active ? "!bg-white text-slate-900 shadow-sm dark:!bg-neutral-950 dark:text-white" : "!bg-transparent text-slate-500 dark:text-neutral-400"}`;
  const legend = "mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";

  return createPortal(
    <div className="picture-share fixed inset-0 z-[2600] flex items-end justify-center !font-sans sm:items-center sm:p-4 [&_*]:!font-sans" role="dialog" aria-modal="true" aria-label="Share as a picture or video">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white text-sm text-slate-700 shadow-2xl ring-1 ring-neutral-200 sm:max-w-3xl sm:rounded-3xl dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">{format === "video" ? <Film className="size-4" /> : <ImageIcon className="size-4" />} Share your chip</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:text-neutral-400 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-4 overflow-y-auto p-4 sm:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="self-start rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-800">
            <div className="relative mx-auto w-full" style={{ maxWidth: size === "story" ? "min(15rem, 30dvh)" : size === "square" ? "min(24rem, 46dvh)" : "100%" }}>
              <canvas ref={canvasRef} role="img" aria-label={`${chip.label} chip${format === "picture" ? "" : ", spinning"}`}
                className="block w-full rounded-xl shadow-md ring-1 ring-black/5" style={{ aspectRatio: RATIOS[size], background: colors ? `linear-gradient(135deg, ${colors.from}, ${colors.to})` : undefined }} />
              {!prepared && !failed && <p className="absolute inset-0 grid place-items-center text-xs text-white/80"><Loader2 className="size-5 animate-spin" /></p>}
              {failed && <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-red-600">{failed}</p>}
              {making && (
                <div className="absolute inset-x-[8%] bottom-[6%] rounded-full bg-black/40 p-1" role="progressbar" aria-label={`Making the ${noun}`} aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-1.5 rounded-full bg-white transition-[width]" style={{ width: `${Math.max(4, progress * 100)}%` }} />
                </div>
              )}
            </div>
            <p className="mx-auto mt-2.5 max-w-sm text-center text-xs text-slate-500 dark:text-neutral-400">
              {format === "picture" ? (pair ? "Both sides of your chip." : "The front of your chip.")
                : format === "gif" ? "A GIF loops on its own in Messages, Facebook and X. Instagram only takes pictures and videos."
                  : "A video for Instagram, TikTok or a story. Most apps loop it."}
            </p>
          </div>

          <div className="space-y-4">
            <fieldset>
              <legend className={legend}>Make a</legend>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
                {FORMATS.map((f) => <button key={f.value} type="button" aria-pressed={format === f.value} onClick={() => setFormat(f.value)} className={segment(format === f.value)}>{f.label}</button>)}
              </div>
            </fieldset>

            <fieldset>
              <legend className={legend}>Background</legend>
              <div className="grid grid-cols-4 gap-1.5">
                {(lib?.BACKGROUNDS || []).map((b) => (
                  <button key={b.value} type="button" aria-pressed={background === b.value} onClick={() => setBackground(b.value)}
                    className={`flex flex-col items-center gap-1 rounded-xl !bg-transparent p-1.5 text-[11px] font-medium ${background === b.value ? "text-accent ring-2 ring-accent" : "text-slate-600 ring-1 ring-neutral-200 dark:text-neutral-300 dark:ring-neutral-700"}`}>
                    <span className="block h-7 w-full rounded-lg ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${b.from}, ${b.to})` }} />
                    {b.label}
                  </button>
                ))}
                <button type="button" aria-pressed={background === "custom"} onClick={() => setBackground("custom")}
                  className={`flex flex-col items-center gap-1 rounded-xl !bg-transparent p-1.5 text-[11px] font-medium ${background === "custom" ? "text-accent ring-2 ring-accent" : "text-slate-600 ring-1 ring-neutral-200 dark:text-neutral-300 dark:ring-neutral-700"}`}>
                  <span className="block h-7 w-full rounded-lg ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${custom.from}, ${custom.to})` }} />
                  Yours
                </button>
              </div>
              {background === "custom" && (
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5">From <input type="color" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
                  <label className="flex items-center gap-1.5">To <input type="color" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className={legend}>Size</legend>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
                {Object.entries(lib?.SIZES || { square: { label: "Square" }, story: { label: "Story" }, wide: { label: "Wide" } }).map(([value, s]) => (
                  <button key={value} type="button" aria-pressed={size === value} title={s.hint} onClick={() => setSize(value)} className={segment(size === value)}>{s.label}</button>
                ))}
              </div>
            </fieldset>

            {format === "picture" ? (
              <fieldset>
                <legend className={legend}>Show</legend>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
                  <button type="button" aria-pressed={!pair} onClick={() => setPair(false)} className={segment(!pair)}>The front</button>
                  <button type="button" aria-pressed={pair} onClick={() => setPair(true)} className={segment(pair)}>Both sides</button>
                </div>
              </fieldset>
            ) : (
              <fieldset>
                <legend className={legend}>Speed</legend>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
                  {(lib?.SPEEDS || []).map((s) => <button key={s.value} type="button" aria-pressed={speed === s.value} onClick={() => setSpeed(s.value)} className={segment(speed === s.value)}>{s.label}</button>)}
                </div>
              </fieldset>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={withLabel} onChange={(e) => setWithLabel(e.target.checked)} /> Add “{chip.label}” under it</label>
              {chip.on && <label className="flex items-center gap-2"><input type="checkbox" checked={withDate} onChange={(e) => setWithDate(e.target.checked)} /> Show the date on the back</label>}
              {firstName && <label className="flex items-center gap-2"><input type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} /> Add my first name</label>}
              <p className="text-xs text-slate-500 dark:text-neutral-400">Only the chip shows unless you add these.{chip.shape === "round" ? " A sobriety chip tells people how long you've been sober." : ""}</p>
            </div>

            <div className="grid gap-2">
              {canShareFiles && (
                <button type="button" onClick={share} disabled={!!busy || !prepared}
                  className="flex items-center justify-center gap-2 rounded-xl !bg-accent px-3 py-2.5 font-semibold !text-white disabled:opacity-60">
                  {busy === "share" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} {busy === "share" && making ? `Making the ${noun}…` : `Share ${noun}…`}
                </button>
              )}
              <button type="button" onClick={save} disabled={!!busy || !prepared}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-semibold disabled:opacity-60 ${canShareFiles ? "!bg-neutral-100 !text-slate-800 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:!text-white" : "!bg-accent !text-white"}`}>
                {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {busy === "save" && making ? `Making the ${noun}…` : `Save ${noun}`}
              </button>
              {canCopy && (
                <button type="button" onClick={copy} disabled={!!busy || !prepared}
                  className="flex items-center justify-center gap-1.5 rounded-xl !bg-neutral-100 px-2 py-2 text-xs font-semibold text-slate-800 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:text-white">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy picture"}
                </button>
              )}
              {size === "story" && format !== "gif" && <p className="text-xs text-slate-500 dark:text-neutral-400">For Instagram or Facebook stories: save it, then add it from your photos.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
