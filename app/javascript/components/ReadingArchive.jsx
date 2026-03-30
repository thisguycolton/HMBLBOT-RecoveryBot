import React from "react";
import { BookMarked } from "lucide-react";

const ReadingArchive = ({ readings, notice }) => {
  return (
    <div className="min-h-screen bg-neutral-400 dark:bg-neutral-700 text-slate-100">
      {/* Hero / Jumbotron */}
      <section className="w-full bg-rose-400 text-neutral-900 dark:bg-rose-800 border-b-8 border-rose-300 shadow-sm dark:border-rose-900">

        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8 mt-10">
          <div className="mb-4 rounded-3xl bg-white/20 p-4 size-25 mx-auto p-5.5 dark:text-white">
            <BookMarked className="h-12 w-12 md:h-14 md:w-14 " />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-[0.3em] dark:text-slate-50 sm:text-4xl md:text-5xl ttSans">
            READING ARCHIVE
          </h1>
          <p className="mt-4 text-base dark:text-stone-100/85 sm:text-lg max-w-2xl mx-auto ttSans">
            An index of the meeting readings and topics from The Acid Test and
            friends.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="mx-auto flex w-full position-fixed flex-col px-4 pb-0 pt-0 h-screen sm:px-6 lg:px-8 bg-neutral-400 dark:bg-neutral-700">
        <div className="mx-auto mb-0 max-w-4xl text-start text-sm text-slate-400 bg-neutral-300  dark:bg-neutral-900/50 px-4 py-2 h-full">
        {notice && notice.length > 0 && (
          <div className="mb-6 rounded-lg border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </div>
        )}

        {(!readings || readings.length === 0) ? (
          <p className="mt-8 text-center text-sm text-slate-400">
            No readings found yet. Once your group adds readings, they&apos;ll
            show up here.
          </p>
        ) : (
          <div className="mt-4 space-y-8 max-w-4xl mx-auto">
            {readings.map((reading) => (
              <article
                key={reading.id}
                className="relative overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-900/60 p-9 shadow-sm transition hover:border-neutral-300/80 hover:bg-neutral-300 dark:hover:border-stone-400/80 dark:hover:bg-slate-900 hover:shadow-lg"
              >
                <a
                  href={reading.path}
                  className="group block"
                  aria-label={reading.title}
                >
                  <h2 className="text-lg font-semibold uppercase tracking-[0.2em] text-neutral-900 dark:text-neutral-50! dark:group-hover:text-stone-300 sm:text-xl">
                    {reading.title}
                  </h2>

                  <blockquote className="mt-4 text-md! leading-relaxed text-neutral-900 dark:text-neutral-50!">
                    {reading.preview}
                    <span className="ml-1 font-semibold italic text-neutral-900 dark:text-neutral-50!">
                      Read more
                    </span>
                  </blockquote>

                  <footer className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <cite className="not-italic truncate pr-4">
                      – {reading.source}
                    </cite>
                    <time
                      dateTime={reading.meeting_date_iso}
                      className="font-semibold text-slate-100"
                    >
                      {reading.meeting_date}
                    </time>
                  </footer>
                </a>
              </article>
            ))}
          </div>
        )}
        </div>
      </main>
    </div>
  );
};

export default ReadingArchive;