import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Send, X } from "lucide-react";
import { Card, primaryButton, quietButton } from "../../groups/ui";
import StepSection, { ReadingList, ReadingStrip } from "./StepSections";
import { isReadingList, pageProgress, pageSummary } from "./stepText";

// A worksheet a page at a time, like an install wizard (pagesOf decides the pages): a Welcome
// page (the introduction, the reading list to tick off, and what's done so far), one page per
// screen with Back / Next, and a Review page to look it over and finish. Nothing is required:
// any page can be skipped and come back to. A rail lists the pages on a computer; on a phone
// the progress bar opens the same list. Where they were is kept (settings.at_page) so they
// can pick up there.
//
// `at` is 0 for Welcome, 1…n for the pages and n + 1 for Review.
export default function StepWizard({ work, pages, label, intro, setAnswer, setSettings, finish, settingsBlock, onAllOnOnePage }) {
  const answers = work.answers || {};
  const [at, setAt] = useState(0);
  const [sheet, setSheet] = useState(false);
  const top = useRef(null);
  const first = useRef(true);
  const review = pages.length + 1;

  const progress = useMemo(() => pages.map((p) => pageProgress(p, answers, work.definition)), [pages, answers, work.definition]);
  const anyStarted = progress.some((p) => p.started);
  const readingLists = (work.definition.sections || []).filter(isReadingList);
  // Where to pick up: the page they were last on, else the first one not started yet
  const resumeAt = (() => {
    const last = pages.findIndex((p) => p.id === work.settings?.at_page);
    if (last >= 0) return last + 1;
    const fresh = progress.findIndex((p) => !p.started);
    return fresh >= 0 ? fresh + 1 : review;
  })();

  const go = (n) => {
    const next = Math.max(0, Math.min(review, n));
    setAt(next);
    setSheet(false);
    if (next >= 1 && next <= pages.length) setSettings({ at_page: pages[next - 1].id });
  };
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    window.scrollTo({ top: 0, behavior: "smooth" });
    top.current?.focus({ preventScroll: true });
  }, [at]);

  const page = at >= 1 && at <= pages.length ? pages[at - 1] : null;
  const list = [
    { n: 0, title: "Welcome", hint: readingLists.length ? readingHint(readingLists, answers) : "Introduction", kind: "welcome" },
    ...pages.map((p, i) => ({ n: i + 1, title: p.title, part: p.part, hint: progress[i].hint, kind: "page", started: progress[i].started })),
    { n: review, title: "Look it over", hint: work.status === "done" ? "Marked done" : "Then finish", kind: "review" },
  ];
  const where = at === 0 ? "Welcome" : at === review ? "Look it over" : `Page ${at} of ${pages.length}`;

  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <nav aria-label="Pages" className="hidden lg:sticky lg:top-[calc(var(--nav-h)+1rem)] lg:block">
        <Card className="p-2">
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Pages</div>
          <PageList list={list} at={at} go={go} />
        </Card>
      </nav>

      <div className="min-w-0 space-y-3">
        {at > 0 && (
          <button type="button" onClick={() => setSheet(true)} aria-label={`${where}. All pages`}
            className="block w-full space-y-2 rounded-2xl !bg-transparent px-1 text-left lg:pointer-events-none">
            <span className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-900 dark:text-white">{where}</span>
              {page && <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-neutral-400">{page.part ? `${page.part} · ` : ""}{page.title}</span>}
              <ChevronDown className="ml-auto size-4 shrink-0 text-slate-500 lg:hidden" aria-hidden="true" />
            </span>
            <span className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${pages.length + 1}, minmax(0, 1fr))` }} aria-hidden="true">
              {[...pages.map((_, i) => i + 1), review].map((n) => (
                <span key={n} className={`h-1.5 rounded-full ${n <= at ? "bg-accent" : progress[n - 1]?.started ? "bg-accent-soft dark:bg-accent/40" : "bg-neutral-200 dark:bg-neutral-800"}`} />
              ))}
            </span>
          </button>
        )}

        <Card className="p-5 sm:p-8">
          <div ref={top} tabIndex={-1} className="space-y-6 outline-none">
            {at === 0 && (
              <>
                {intro}
                {readingLists.map((s) => (
                  <section key={s.id} className="space-y-2 rounded-3xl bg-accent-tint p-2 dark:bg-accent/15" aria-labelledby={`rl-${s.id}`}>
                    <div className="flex items-center gap-2 px-2 pt-1 text-accent-ink dark:text-sky-100">
                      <BookOpen className="size-4 shrink-0" aria-hidden="true" />
                      <h2 id={`rl-${s.id}`} className="!m-0 flex-1 !text-base font-semibold">{s.title || "Readings"}</h2>
                      <span className="text-sm font-medium">{readCount(s, answers)}</span>
                    </div>
                    <ReadingList section={s} value={answers[s.id]} set={(v) => setAnswer(s.id, v)} />
                  </section>
                ))}
                <section className="space-y-2" aria-labelledby="pages-ahead">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 id="pages-ahead" className="!m-0 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{anyStarted ? "Done so far" : "What's ahead"}</h2>
                    {anyStarted && <span className="text-sm text-slate-500 dark:text-neutral-400">{progress.filter((p) => p.started).length} of {pages.length} pages started</span>}
                  </div>
                  <ol className="divide-y divide-neutral-200 overflow-hidden rounded-2xl ring-1 ring-neutral-200 dark:divide-neutral-800 dark:ring-neutral-800">
                    {pages.map((p, i) => (
                      <li key={p.id}>
                        <button type="button" onClick={() => go(i + 1)} className="flex min-h-12 w-full items-center gap-3 !bg-transparent px-3 py-2.5 text-left hover:!bg-neutral-50 dark:hover:!bg-neutral-800/50">
                          <Dot n={i + 1} done={progress[i].started} />
                          <span className="min-w-0 flex-1 text-slate-900 dark:text-white">{p.part && <span className="text-slate-500 dark:text-neutral-400">{p.part} · </span>}{p.title}</span>
                          {anyStarted && <span className="shrink-0 text-sm text-slate-500 dark:text-neutral-400">{progress[i].hint}</span>}
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )}

            {page && (
              <>
                {page.part && <div className="text-sm font-semibold uppercase tracking-wide text-accent">{page.part}</div>}
                {(page.line || page.title !== (page.sections.find((s) => !["reference", "note"].includes(s.kind)) || page.sections[0])?.title) && (
                  <div className="space-y-1 pb-3">
                    {page.title !== (page.sections.find((s) => !["reference", "note"].includes(s.kind)) || page.sections[0])?.title && (
                      <h2 className="!m-0 !text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{page.title}</h2>
                    )}
                    {page.line && <p className="!m-0 text-slate-600 dark:text-neutral-400">{page.line}</p>}
                  </div>
                )}
                {page.sections.map((s) => (isReadingList(s) && !s.body
                  ? <ReadingStrip key={s.id} section={s} value={answers[s.id]} set={(v) => setAnswer(s.id, v)} />
                  : <StepSection key={s.id} section={s} answers={answers} setAnswer={setAnswer} definition={work.definition} settings={work.settings} />))}
              </>
            )}

            {at === review && (
              <>
                <div className="space-y-1">
                  <h2 className="!m-0 !text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Look it over</h2>
                  <p className="text-slate-600 dark:text-neutral-400">Everything you wrote, page by page. Anything still empty can wait: you can come back to any page whenever you like.</p>
                </div>
                <ol className="divide-y divide-neutral-200 overflow-hidden rounded-2xl ring-1 ring-neutral-200 dark:divide-neutral-800 dark:ring-neutral-800">
                  {pages.map((p, i) => {
                    const summary = progress[i].started ? pageSummary(p, work) : "";
                    return (
                      <li key={p.id}>
                        <button type="button" onClick={() => go(i + 1)} className="flex w-full items-start gap-3 !bg-transparent px-3 py-3 text-left hover:!bg-neutral-50 dark:hover:!bg-neutral-800/50">
                          <Dot n={i + 1} done={progress[i].started} />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-slate-900 dark:text-white">{p.title}</span>
                            <span className={`block text-sm ${summary ? "text-slate-600 dark:text-neutral-300" : "text-slate-500 dark:text-neutral-400"}`}>{summary || "Nothing yet"}</span>
                          </span>
                          <span className="shrink-0 pt-0.5 text-sm font-medium text-accent dark:text-accent-light">{summary ? "Edit" : "Write"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {readingLists.some((s) => s.items.some((r) => !answers[s.id]?.[r.id])) && (
                  <p className="text-sm text-slate-600 dark:text-neutral-400">
                    Not read yet: {readingLists.flatMap((s) => s.items.filter((r) => !answers[s.id]?.[r.id]).map((r) => r.label)).join("; ")}.{" "}
                    <button type="button" onClick={() => go(0)} className="!bg-transparent p-0 font-medium !text-accent underline dark:!text-accent-light">The reading list</button>
                  </p>
                )}
                {settingsBlock}
                {finish.note}
              </>
            )}
          </div>
        </Card>

        <div className="sticky bottom-[calc(var(--shell-bottom,0px)+0.75rem)] z-10 lg:bottom-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/95 p-2 shadow-panel ring-1 ring-neutral-200 backdrop-blur dark:bg-neutral-900/95 dark:ring-neutral-800">
            {at > 0 && <button type="button" className={quietButton} onClick={() => go(at - 1)}><ChevronLeft className="size-4" /> Back</button>}
            {at === 0 && anyStarted && <button type="button" className={quietButton} onClick={() => go(1)}>Start from the beginning</button>}
            <span className="flex-1" />
            {page && !progress[at - 1].started && <button type="button" className={`${quietButton} !bg-transparent !ring-0 !text-accent dark:!text-accent-light`} onClick={() => go(at + 1)}>Skip for now</button>}
            {at === review ? (
              <>
                {finish.print}
                <button type="button" className={quietButton} onClick={finish.send}><Send className="size-4" /> Send to my sponsor</button>
                {finish.done}
              </>
            ) : (
              <button type="button" className={primaryButton} onClick={() => go(at === 0 ? (anyStarted ? resumeAt : 1) : at + 1)}>
                {at === 0 ? (anyStarted ? "Pick up where I left off" : "Start") : at === pages.length ? "Look it over" : "Next"} <ChevronRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-[2600] flex items-end justify-center bg-black/40 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div role="dialog" aria-modal="true" aria-label="Pages"
            className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl dark:bg-neutral-900">
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Pages</span>
              <button type="button" onClick={() => setSheet(false)} aria-label="Close" className="grid size-10 place-items-center rounded-xl !bg-transparent text-slate-500"><X className="size-5" /></button>
            </div>
            <PageList list={list} at={at} go={go} />
            <div className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
              <button type="button" onClick={onAllOnOnePage} className="flex min-h-12 w-full items-center rounded-2xl !bg-transparent px-3 text-left text-slate-700 dark:text-neutral-200">Show it all on one page</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function readCount(section, answers) {
  const read = section.items.filter((r) => answers[section.id]?.[r.id]).length;
  return `${read} of ${section.items.length} read`;
}

function readingHint(lists, answers) {
  const all = lists.flatMap((s) => s.items.map((r) => !!answers[s.id]?.[r.id]));
  return `${all.filter(Boolean).length} of ${all.length} read`;
}

function Dot({ n, done, current }) {
  const on = done || current;
  return (
    <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${on ? "bg-accent text-white" : "text-slate-500 ring-[1.5px] ring-inset ring-neutral-300 dark:text-neutral-400 dark:ring-neutral-700"}`}>
      {done && !current ? <Check className="size-3.5" strokeWidth={3} /> : n}
    </span>
  );
}

function PageList({ list, at, go }) {
  return (
    <ol className="space-y-0.5">
      {list.map((item) => {
        const current = item.n === at;
        return (
          <li key={item.n}>
            <button type="button" onClick={() => go(item.n)} aria-current={current ? "step" : undefined}
              className={`flex min-h-12 w-full items-center gap-3 rounded-[calc(var(--radius-2xl)-0.5rem)] px-2.5 py-2 text-left ${current ? "!bg-accent-tint dark:!bg-accent/15" : "!bg-transparent hover:!bg-neutral-50 dark:hover:!bg-neutral-800/50"}`}>
              {item.kind === "page"
                ? <Dot n={item.n} done={item.started} current={current} />
                : <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full ${current ? "bg-accent text-white" : "text-slate-500 ring-[1.5px] ring-inset ring-neutral-300 dark:ring-neutral-700"}`}>{item.kind === "welcome" ? <BookOpen className="size-3.5" /> : <Check className="size-3.5" />}</span>}
              <span className="min-w-0">
                <span className={`block text-sm leading-snug text-slate-900 dark:text-white ${current ? "font-semibold" : "font-medium"}`}>{item.title}</span>
                {item.hint && <span className="block text-xs text-slate-500 dark:text-neutral-400">{item.hint}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
