import React from "react";
import { BookMarked } from "lucide-react";

const ReadingArchive = ({ readings, notice }) => {
  return (
    <div className="w-full min-w-0 bg-neutral-400 text-slate-100 dark:bg-neutral-700">

      {/* Hero / Jumbotron */}
      <section className="w-full border-b-8 border-rose-300 bg-rose-400 text-neutral-900 shadow-sm dark:border-rose-900 dark:bg-rose-800">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="mx-auto mb-4 flex h-25 w-25 items-center justify-center rounded-3xl bg-white/20 p-5.5 dark:text-white">
            <BookMarked className="h-12 w-12 md:h-14 md:w-14" />
          </div>

          <h1 className="mt-5 text-2xl font-extrabold tracking-[0.3em] dark:text-slate-50 sm:text-4xl md:text-5xl ttSans">
            READING ARCHIVE
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base dark:text-stone-100/85 sm:text-lg ttSans">
            An index of the meeting readings and topics from The Acid Test and
            friends.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="w-full bg-neutral-400 dark:bg-neutral-700">
        <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">

          {notice && (
            <div className="mb-6 rounded-xl bg-neutral-200 px-4 py-3 text-sm text-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-100">
              {notice}
            </div>
          )}

          {!readings || readings.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No readings found yet. Once your group adds readings, they&apos;ll
              show up here.
            </p>
          ) : (
            <div className="space-y-8">
              {readings.map((reading) => (
                <article
                  key={reading.id}
                  className="relative overflow-hidden rounded-md bg-neutral-200 p-6 shadow-sm transition hover:border-neutral-300/80 hover:bg-neutral-300 hover:shadow-lg dark:bg-neutral-900/60 dark:hover:border-stone-400/80 dark:hover:bg-slate-900 sm:p-9"
                >
                  <a
                    href={reading.path}
                    className="group block min-w-0"
                    aria-label={reading.title}
                  >
                    <h2 className="text-lg font-semibold uppercase tracking-[0.2em] text-neutral-900 dark:text-neutral-50 sm:text-xl">
                      {reading.title}
                    </h2>

                    <blockquote className="mt-4 text-md leading-relaxed text-neutral-900 dark:text-neutral-50">
                      {reading.preview}

                      <span className="ml-1 font-semibold italic text-neutral-900 dark:text-neutral-50">
                        Read more
                      </span>
                    </blockquote>

                    {/* Reading metadata */}
                    <div className="mt-4 flex min-w-0 flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
                      <cite className="not-italic truncate sm:pr-4">
                        – {reading.source}
                      </cite>

                      <time
                        dateTime={reading.meeting_date_iso}
                        className="shrink-0 font-semibold"
                      >
                        {reading.meeting_date}
                      </time>
                    </div>
                  </a>
                </article>
              ))}
            </div>
          )}

        </div>
      </section>
    </div>
  );
};

export default ReadingArchive;