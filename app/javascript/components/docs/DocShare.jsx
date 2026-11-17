import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { showToast } from "../../lib/toast";

// Sharing a docs page, or one line of it.
//
// Every line of a page has an address (renderDoc in docMarkdown.js): headings their own (#hosts),
// the rest #l-<code> from the line's words. Opening a link to a line
// scrolls to it and lights it up for a moment (flashLine). A link button sits beside the line
// under the pointer on a computer; selecting words anywhere shows "Link to this line".

const BLOCKS = "p, li, blockquote, table, h2, h3, h4";

// Scroll to a line and light it up for a moment
export function flashLine(id, { scroll = true } = {}) {
  const el = id && document.getElementById(id);
  if (!el) return false;
  if (scroll) el.scrollIntoView({ block: /^H[234]$/.test(el.tagName) ? "start" : "center", behavior: "smooth" });
  el.classList.remove("doc-flash");
  void el.offsetWidth; // restart the animation if it's already running
  el.classList.add("doc-flash");
  setTimeout(() => el.classList.remove("doc-flash"), 3200);
  return true;
}

const pageUrl = (hash = "") => `${window.location.origin}${window.location.pathname}${hash ? `#${hash}` : ""}`;
const touch = () => window.matchMedia?.("(hover: none)").matches;

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Share a link to one line: the phone's share sheet where there is one, otherwise copy it
async function shareLine(id, title) {
  const url = pageUrl(id);
  window.history.replaceState(null, "", `#${id}`);
  flashLine(id, { scroll: false });
  if (touch() && navigator.share) {
    try { await navigator.share({ title, url }); } catch { /* closed the share sheet */ }
    return;
  }
  if (await copy(url)) showToast("Link to this line copied", { tone: "success" });
  else window.prompt("Copy the link to this line", url); // eslint-disable-line no-alert
}

// The link button beside the line under the pointer, and the "Link to this line" pill over
// selected words. `body` is the page text's element.
export function LineLinks({ body, title }) {
  const [hover, setHover] = useState(null); // { id, top }
  const [picked, setPicked] = useState(null); // { id, top, left }
  const wrap = useRef(null);

  // Where an element sits inside the article (the buttons are placed against it)
  const place = useCallback((rect) => {
    const box = wrap.current?.parentElement?.getBoundingClientRect();
    return box ? { top: rect.top - box.top, left: rect.left - box.left, width: rect.width } : null;
  }, []);

  useEffect(() => {
    const root = body.current;
    if (!root) return undefined;
    const blockOf = (node) => {
      const el = node?.nodeType === 3 ? node.parentElement : node;
      const block = el?.closest?.(BLOCKS);
      if (!block || !root.contains(block)) return null;
      // a paragraph inside a list item or quote: the item or quote is the line
      return block.parentElement.closest("li, blockquote") && !block.matches("li") ? block.parentElement.closest("li, blockquote") : block;
    };

    const onMove = (e) => {
      const block = blockOf(e.target);
      if (!block?.id) return;
      setHover((h) => {
        if (h?.id === block.id) return h;
        const at = place(block.getBoundingClientRect());
        if (!at) return h;
        const line = parseFloat(getComputedStyle(block).lineHeight) || 28;
        return { id: block.id, top: at.top + Math.min(line, block.offsetHeight) / 2 };
      });
    };
    const onLeave = (e) => {
      if (!wrap.current?.contains(e.relatedTarget)) setHover(null);
    };

    const onSelect = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setPicked(null); return; }
      const range = sel.getRangeAt(0);
      const block = blockOf(range.startContainer);
      if (!block?.id || !root.contains(range.endContainer)) { setPicked(null); return; }
      const at = place(range.getBoundingClientRect());
      if (at) setPicked({ id: block.id, top: at.top, left: at.left + at.width / 2 });
    };

    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    document.addEventListener("selectionchange", onSelect);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("selectionchange", onSelect);
    };
  }, [body, place]);

  return (
    <div ref={wrap} className="pointer-events-none absolute inset-0" aria-hidden={!hover && !picked}>
      {hover && (
        <button
          type="button"
          onMouseLeave={(e) => { if (!body.current?.contains(e.relatedTarget)) setHover(null); }}
          onClick={() => shareLine(hover.id, title)}
          title="Copy a link to this line"
          aria-label="Copy a link to this line"
          style={{ top: hover.top }}
          className="doc-line-link pointer-events-auto absolute -left-10 hidden size-7 -translate-y-1/2 place-items-center rounded-lg !bg-transparent !p-0 !text-slate-400 hover:!bg-neutral-100 hover:!text-accent dark:hover:!bg-neutral-800 lg:[@media(hover:hover)]:grid"
        >
          <Link2 size={15} />
        </button>
      )}
      {picked && (
        <button
          type="button"
          // keep the selection: a press on the pill mustn't clear it before the click lands
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { shareLine(picked.id, title); window.getSelection()?.removeAllRanges(); setPicked(null); }}
          style={{ top: picked.top, left: picked.left }}
          className="pointer-events-auto absolute z-10 inline-flex -translate-x-1/2 -translate-y-[calc(100%+0.6rem)] items-center gap-1.5 whitespace-nowrap rounded-full !bg-slate-900 px-3 py-1.5 text-xs font-semibold !text-white shadow-lg dark:!bg-white dark:!text-slate-900 max-sm:translate-y-[calc(100%+2.2rem)]"
        >
          <Link2 size={13} /> Link to this line
        </button>
      )}
    </div>
  );
}

// The page's Share button and its card: the page's link to copy, the phone's share sheet,
// and links to each part of the page
export function ShareButton({ page, headings }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(null);
  const box = useRef(null);
  const url = pageUrl();

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const copyLink = async (hash, key) => {
    const link = pageUrl(hash);
    if (await copy(link)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } else {
      window.prompt("Copy the link", link); // eslint-disable-line no-alert
    }
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold !bg-neutral-100 !text-slate-700 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:!text-neutral-200 dark:hover:!bg-neutral-700"
      >
        <Share2 size={14} /> Share
      </button>
      {open && (
        <div role="dialog" aria-label="Share this page" className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-neutral-200 bg-white p-4 text-left text-sm shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
          <p className="!m-0 font-semibold text-slate-900 dark:text-white">Share “{page.title}”</p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-1 pl-3 pr-1 dark:border-neutral-700 dark:bg-neutral-950">
            <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-neutral-300">{url.replace(/^https?:\/\//, "")}</span>
            <button
              type="button"
              onClick={() => copyLink("", "page")}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold !bg-accent !text-white hover:!bg-accent/90"
            >
              {copied === "page" ? <Check size={13} /> : <Copy size={13} />} {copied === "page" ? "Copied" : "Copy"}
            </button>
          </div>
          {typeof navigator !== "undefined" && navigator.share && (
            <button
              type="button"
              onClick={() => navigator.share({ title: page.title, text: page.summary || undefined, url }).catch(() => {})}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold !bg-neutral-100 !text-slate-700 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:!text-neutral-200"
            >
              <Share2 size={14} /> Share with an app…
            </button>
          )}
          {headings.length > 0 && (
            <>
              <p className="!mb-1 !mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Link to a part of the page</p>
              <ul className="!m-0 max-h-48 list-none space-y-0.5 overflow-y-auto !p-0">
                {headings.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => copyLink(h.id, h.id)}
                      className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left !bg-transparent !text-slate-700 hover:!bg-neutral-100 dark:!text-neutral-200 dark:hover:!bg-neutral-800 ${h.level === 3 ? "pl-6" : "pl-2"}`}
                    >
                      <span className="min-w-0 flex-1 truncate">{h.text}</span>
                      {copied === h.id ? <Check size={14} className="shrink-0 text-emerald-600" /> : <Link2 size={14} className="shrink-0 opacity-50" />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="!mb-0 !mt-3 text-xs text-slate-500 dark:text-neutral-400">
            <span className="[@media(hover:none)]:hidden">To share one line, point at it and click the link button beside it, or select a few of its words.</span>
            <span className="[@media(hover:hover)]:hidden">To share one line, select a few of its words and tap Link to this line.</span>
          </p>
        </div>
      )}
    </div>
  );
}
