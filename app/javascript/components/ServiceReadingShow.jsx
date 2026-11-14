import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, MessageSquareQuote, Pencil, Trash2 } from "lucide-react";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80";

const ghostButton =
  `inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 !bg-transparent px-4 py-2.5 text-sm font-semibold !text-white transition hover:!bg-white/10 hover:!text-white ${focusRing}`;

export default function ServiceReadingShow({ reading, notice, isAdmin, isAuthenticated }) {
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const deleteForm = useRef(null);
  const otherSources = reading.other_sources || [];
  const csrf = typeof document !== "undefined"
    ? document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
    : null;

  // Reading progress along the top
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const height = el.scrollHeight - el.clientHeight;
      setProgress(height > 0 ? Math.min(100, (el.scrollTop / height) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The title, source and link, to paste in a meeting's chat
  const handleCopy = async () => {
    const url = `${window.location.origin}/service_readings/${reading.id}`;
    const html = `<strong style="font-size:1.5em;">Reading:</strong><br>${reading.title}<br>${reading.source || ""}<br>${url}`;
    const text = ["Reading:", reading.title, reading.source, url].filter(Boolean).join("\n");

    try {
      if (window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused (no permission): leave the button as it was
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${reading.title}"${reading.source ? ` (${reading.source})` : ""}?`)) {
      deleteForm.current?.submit();
    }
  };

  return (
    <>
      <div
        className="fixed left-0 top-0 z-[10000] h-1.5 bg-sky-400 transition-[width] duration-75"
        style={{ width: `${progress}%` }}
      />

      <div className="w-full min-w-0 text-slate-900 dark:text-neutral-100">
        {/* HERO */}
        <section className="bg-gradient-to-r from-sky-600 to-sky-800 text-white">
          <div className="mx-auto max-w-3xl px-5 py-8 md:py-12">
            <a
              href="/service_readings"
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest !text-sky-100/90 underline-offset-4 hover:!text-white hover:underline"
            >
              <ArrowLeft className="size-3.5" />
              Service readings
            </a>

            <h1 className="mt-3 text-4xl font-bold tracking-tight break-words md:text-5xl ttSans">
              {reading.title}
            </h1>

            {reading.source && (
              <div className="mt-2 text-lg text-sky-50 break-words md:text-xl">{reading.source}</div>
            )}

            {/* The same reading from its other sources */}
            {otherSources.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-sky-100/80">Also from:</span>
                {otherSources.map((other) => (
                  <a
                    key={other.id}
                    href={`/service_readings/${other.id}`}
                    className="inline-flex max-w-full items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm font-medium !text-white transition hover:bg-white/20 hover:!text-white"
                  >
                    <span className="truncate">{other.source || "Another source"}</span>
                  </a>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                title="Copy the title, source and link to paste in the chat"
                className={`inline-flex grow items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition sm:grow-0 ${focusRing} ${
                  copied ? "!bg-emerald-500 !text-white" : "!bg-white !text-sky-800 hover:!bg-sky-50"
                }`}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? "Copied" : "Copy for chat"}
              </button>

              {isAdmin && (
                <>
                  <a href={`/service_readings/${reading.id}/edit`} className={ghostButton} aria-label="Edit this reading" title="Edit this reading">
                    <Pencil size={18} />
                    <span className="sr-only sm:not-sr-only">Edit</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleDelete}
                    aria-label="Delete this reading"
                    title="Delete this reading"
                    className={`inline-flex items-center justify-center rounded-xl border border-red-300/40 !bg-transparent px-4 py-2.5 !text-white transition hover:!bg-red-500/20 ${focusRing}`}
                  >
                    <Trash2 size={18} />
                  </button>
                  <form ref={deleteForm} method="post" action={`/service_readings/${reading.id}`} className="hidden">
                    <input type="hidden" name="_method" value="delete" />
                    {csrf && <input type="hidden" name="authenticity_token" value={csrf} />}
                  </form>
                </>
              )}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-5 py-8 md:py-12">
          {notice && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              {notice}
            </div>
          )}

          {/* The reading */}
          <article className="min-w-0">
            <div
              className="reading-prose min-w-0 break-words [overflow-wrap:anywhere] [&_img]:h-auto [&_img]:max-w-full [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_pre]:whitespace-pre-wrap [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: reading.content_html }}
            />

            {reading.source && (
              <div className="mt-8 border-t border-stone-200 pt-4 text-base italic text-neutral-600 break-words dark:border-neutral-700 dark:text-neutral-400">
                {reading.source}
              </div>
            )}
          </article>

          {/* For visitors without an account */}
          {!isAuthenticated && (
            <section className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-stone-200 bg-white px-6 py-6 dark:border-neutral-700 dark:bg-neutral-800/60 sm:flex-row sm:items-center">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800">
                <MessageSquareQuote size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold">Share readings easier</h2>
                <div className="mt-1 text-slate-600 dark:text-neutral-300">
                  Sign up to post your readings and share them with others with a simple click.
                </div>
              </div>
              <a
                href="/users/sign_up"
                className="inline-flex w-full items-center justify-center rounded-xl bg-blue-500 px-5 py-2.5 font-semibold !text-white hover:bg-blue-400 sm:w-auto"
              >
                Sign up
              </a>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
