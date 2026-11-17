import React, { useEffect, useRef, useState } from "react";
import { Download, Minus, Plus } from "lucide-react";
import "pdfjs-dist/web/pdf_viewer.css";

const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5, 2];

// A PDF read in the page (pdf.js), so it looks the same everywhere and needs no plug-in: pages are
// drawn as they scroll into view, with a text layer for selecting and copying. `src` is
// the file's URL on this site; `downloadHref` saves it.
export default function PdfViewer({ src, name, downloadHref }) {
  const box = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);

  useEffect(() => {
    let cancelled = false;
    let loaded = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/build/pdf.min.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        const res = await fetch(src, { credentials: "same-origin" });
        if (!res.ok) throw new Error("not found");
        loaded = await pdfjs.getDocument({ data: new Uint8Array(await res.arrayBuffer()) }).promise;
        if (cancelled) { loaded.destroy(); return; }
        setPdf(loaded);
      } catch {
        if (!cancelled) setError("This PDF couldn't be shown here.");
      }
    })();
    return () => { cancelled = true; loaded?.destroy(); };
  }, [src]);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pdf-viewer overflow-clip rounded-xl bg-neutral-200 dark:bg-neutral-800">
      <div className="flex flex-wrap items-center gap-2 bg-neutral-100 px-3 py-2 text-sm text-slate-700 dark:bg-neutral-900 dark:text-neutral-200 print:hidden">
        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
        {pdf && <span className="text-xs text-slate-500 dark:text-neutral-400">Page {current} of {pdf.numPages}</span>}
        <button type="button" aria-label="Zoom out" disabled={zoom === ZOOMS[0]} onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])} className="grid size-8 place-items-center rounded-lg !bg-transparent hover:!bg-neutral-200 disabled:opacity-40 dark:hover:!bg-neutral-800"><Minus className="size-4" /></button>
        <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in" disabled={zoom === ZOOMS[ZOOMS.length - 1]} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])} className="grid size-8 place-items-center rounded-lg !bg-transparent hover:!bg-neutral-200 disabled:opacity-40 dark:hover:!bg-neutral-800"><Plus className="size-4" /></button>
        <a href={downloadHref} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent hover:underline"><Download className="size-4" /> Download</a>
      </div>
      <div ref={box} className="flex flex-col items-center gap-3 p-3 sm:p-5">
        {error && <p className="py-10 text-sm text-slate-600 dark:text-neutral-300">{error} <a href={downloadHref} className="text-accent underline">Download it instead</a>.</p>}
        {!pdf && !error && <p className="py-10 text-sm text-slate-500">Opening the PDF…</p>}
        {pdf && width > 0 && Array.from({ length: pdf.numPages }, (_, i) => (
          <PdfPage key={`${i}-${zoom}`} pdf={pdf} number={i + 1} fit={Math.max(240, width - (width < 640 ? 24 : 40))} zoom={zoom} onVisible={setCurrent} />
        ))}
      </div>
    </div>
  );
}

// One page: a box of the right size right away, drawn once it's near the screen
function PdfPage({ pdf, number, fit, zoom, onVisible }) {
  const holder = useRef(null);
  const canvas = useRef(null);
  const textLayer = useRef(null);
  const [size, setSize] = useState({ w: fit * zoom, h: fit * zoom * 1.294 });
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = holder.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setNear(true);
      if (entry.intersectionRatio > 0.4) onVisible(number);
    }, { rootMargin: "600px 0px", threshold: [0, 0.4] });
    observer.observe(el);
    return () => observer.disconnect();
  }, [number, onVisible]);

  useEffect(() => {
    if (!near) return undefined;
    let task = null;
    let text = null;
    let dead = false;
    (async () => {
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const scale = (fit * zoom) / base.width;
      const viewport = page.getViewport({ scale });
      if (dead) return;
      setSize({ w: viewport.width, h: viewport.height });
      const ratio = window.devicePixelRatio || 1;
      const c = canvas.current;
      c.width = Math.floor(viewport.width * ratio);
      c.height = Math.floor(viewport.height * ratio);
      task = page.render({ canvasContext: c.getContext("2d"), viewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] });
      await task.promise.catch(() => {});
      if (dead) return;
      try {
        const layer = textLayer.current;
        layer.replaceChildren();
        layer.style.setProperty("--scale-factor", String(scale));
        const { TextLayer } = await import("pdfjs-dist/build/pdf.min.mjs");
        text = new TextLayer({ textContentSource: page.streamTextContent(), container: layer, viewport });
        await text.render();
      } catch { /* the page still reads; it just can't be selected */ }
    })();
    return () => { dead = true; task?.cancel(); text?.cancel(); };
  }, [near, pdf, number, fit, zoom]);

  return (
    <div ref={holder} className="relative bg-white shadow-md" style={{ width: size.w, height: size.h }} aria-label={`Page ${number}`}>
      <canvas ref={canvas} className="block" style={{ width: size.w, height: size.h }} />
      <div ref={textLayer} className="textLayer" />
    </div>
  );
}
