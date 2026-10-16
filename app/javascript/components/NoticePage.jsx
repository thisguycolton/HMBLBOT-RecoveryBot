import React from "react";
import { ArrowLeft, ArrowUpRight, Megaphone } from "lucide-react";
import Markdown from "./book/Markdown";

const TONE = {
  info: "bg-accent",
  success: "bg-emerald-600",
  warning: "bg-amber-600",
};

// The write-up behind a site notice (/notices/:id, NoticesController)
export default function NoticePage({ notice }) {
  const published = new Date(notice.published_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="w-full bg-stone-100 dark:bg-stone-800 min-h-[70vh] !font-sans">
      <article className="mx-auto max-w-2xl px-4 py-10">
        <a href="/" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-neutral-300 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Home
        </a>
        <div className="mt-4 rounded-4xl bg-neutral-200 dark:bg-neutral-900 p-3 shadow-lg">
          <header className={`${TONE[notice.tone] || TONE.info} text-white rounded-t-panel px-5 py-4 shadow-panel`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
              <Megaphone className="w-4 h-4" /> Notice · {published}
            </div>
            <h1 className="mt-1 !text-2xl !leading-tight font-semibold !font-sans">{notice.title}</h1>
            {notice.summary && <div className="mt-1 text-white/85">{notice.summary}</div>}
          </header>
          <div className="mt-2 rounded-b-panel bg-white dark:bg-surface-dark px-5 py-6 shadow-panel">
            {notice.preview && (
              <div className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                Admin preview: this notice isn't showing to anyone right now.
              </div>
            )}
            <Markdown source={notice.body || ""} className="prose prose-slate dark:prose-invert max-w-none" />
            {notice.link_url && (
              <a
                href={notice.link_url}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium !text-white hover:bg-slate-800 dark:bg-white dark:!text-slate-900"
              >
                {notice.link_label || "Open"} <ArrowUpRight className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
