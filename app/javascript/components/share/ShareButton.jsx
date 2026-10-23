import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Mail, MessageCircle, Share2, X } from "lucide-react";

// A Share button and what it opens: the preview people will see (the link's card, see
// ShareCard in app/services), the link to copy, the phone's own share sheet, and a few
// places to send it. The panel is drawn over the page (a portal), so a toolbar or a card
// that cuts off what overflows it can't cut it off; on phones it's a sheet from the bottom.
//
// `url` is a path on this site or a full address. `image` is the card's picture, when the
// thing is for everyone. `children` goes under the link (a document's "Who can see it").
// With `open`/`onOpenChange` someone else opens it (a File menu) and `bare` leaves the button out.
export default function ShareButton({
  url, title, text, image, label = "Share", iconOnly = false, className = "", panelTitle = "Share",
  note, children, open: openProp, onOpenChange, bare = false,
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = useCallback((v) => (onOpenChange ? onOpenChange(v) : setOpenState(v)), [onOpenChange]);
  const anchor = useRef(null);

  return (
    <>
      <span ref={anchor} className={bare ? "inline-block size-0 align-top" : "contents"}>
        {!bare && (
          <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}
            title={label} aria-label={iconOnly ? label : undefined} className={className}>
            <Share2 className="size-4 shrink-0" />{!iconOnly && <span>{label}</span>}
          </button>
        )}
      </span>
      {open && (
        <SharePanel anchor={anchor} onClose={() => setOpen(false)} url={url} title={title} text={text} image={image}
          heading={panelTitle} note={note}>
          {children}
        </SharePanel>
      )}
    </>
  );
}

const PANEL_WIDTH = 352; // 22rem
const isPhone = () => window.matchMedia("(max-width: 639px)").matches;

export const fullUrl = (url) => new URL(url, window.location.origin).toString();

function SharePanel({ anchor, onClose, url, title, text, image, heading, note, children }) {
  const box = useRef(null);
  const [phone, setPhone] = useState(isPhone);
  const [place, setPlace] = useState(null);
  const [copied, setCopied] = useState(false);
  const link = fullUrl(url);

  // Under the button, kept inside the window
  const position = useCallback(() => {
    setPhone(isPhone());
    const el = anchor.current?.firstElementChild || anchor.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    setPlace({ top: r.bottom + 8, left, width });
  }, [anchor]);

  useLayoutEffect(() => { position(); }, [position]);
  useEffect(() => {
    const close = (e) => {
      if (box.current?.contains(e.target) || anchor.current?.contains(e.target)) return;
      onClose();
    };
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    window.addEventListener("keydown", esc);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      window.removeEventListener("keydown", esc);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [anchor, onClose, position]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this link:", link);
    }
  };
  const canShare = typeof navigator.share === "function";
  const nativeShare = async () => {
    try {
      await navigator.share({ title, text, url: link });
      onClose();
    } catch {
      // they closed the share sheet
    }
  };

  const message = [text || title, link].filter(Boolean).join("\n");
  const enc = encodeURIComponent;
  const targets = [
    { label: "Messages", icon: MessageCircle, href: `sms:?&body=${enc(message)}` },
    { label: "Email", icon: Mail, href: `mailto:?subject=${enc(title || "")}&body=${enc(message)}` },
    { label: "Facebook", icon: FacebookIcon, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`, external: true },
    { label: "X", icon: XIcon, href: `https://x.com/intent/post?url=${enc(link)}&text=${enc(title || "")}`, external: true },
  ];

  const sheet = phone
    ? "fixed inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[calc(1rem+env(safe-area-inset-bottom))]"
    : "fixed rounded-2xl";

  return createPortal(
    // On <body>, outside the app's own font rules (the reader styles make paragraphs serif)
    <div className="share-panel !font-sans [&_*]:!font-sans">
      {phone && <div className="fixed inset-0 z-[2600] bg-black/40" aria-hidden="true" />}
      <div ref={box} role="dialog" aria-label={heading}
        style={phone || !place ? undefined : { top: place.top, left: place.left, width: place.width }}
        className={`${sheet} z-[2601] space-y-3 bg-white p-4 text-left text-sm text-slate-700 shadow-2xl ring-1 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700`}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-slate-900 dark:text-white">{heading}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:text-neutral-400 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>
        {image && (
          <img src={image} alt="" loading="lazy" className="aspect-[1200/630] w-full rounded-xl bg-neutral-100 object-cover ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700" />
        )}
        <div className="flex gap-2">
          <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link"
            className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-base text-slate-700 sm:text-xs dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200" />
          <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl !bg-accent px-3 py-2 text-xs font-semibold !text-white">
            {copied ? <><Check className="size-4" /> Copied</> : <><Copy className="size-4" /> Copy</>}
          </button>
        </div>
        {note}
        {children}
        <div className="grid grid-cols-4 gap-1.5">
          {targets.map(({ label, icon: Icon, href, external }) => (
            <a key={label} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}
              className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium !text-slate-600 hover:bg-neutral-100 dark:!text-neutral-300 dark:hover:bg-neutral-800">
              <span className="grid size-10 place-items-center rounded-full bg-neutral-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-200"><Icon className="size-5" /></span>
              {label}
            </a>
          ))}
        </div>
        {canShare && (
          <button type="button" onClick={nativeShare} className="flex w-full items-center justify-center gap-2 rounded-xl !bg-neutral-100 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:text-white dark:hover:!bg-neutral-700">
            <Share2 className="size-4" /> More ways to share…
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

function FacebookIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
    </svg>
  );
}

function XIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  );
}
