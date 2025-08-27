import React from "react";

export default function BookCard({ book, isAdmin }) {
  const visitHref = book.first_chapter_slug
    ? `/books/${book.slug}/chapters/${book.first_chapter_slug}`
    : `/books/${book.slug}`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm
                    dark:border-slate-800 dark:bg-neutral-900">
      <div className="aspect-[3/2] bg-slate-100 dark:bg-neutral-800">
        {book.image_url ? (
          <img src={book.image_url} alt={`${book.title} `} className="h-full w-full object-contain bg-slate-600" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center
                          bg-gradient-to-br from-sky-200 to-indigo-200
                          dark:from-neutral-800 dark:to-neutral-700">
            <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              {String(book.title || "B").slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{book.title}</h2>
          {book.author && (
            <div className="text-xs text-slate-500 dark:text-slate-400">by {book.author}</div>
          )}
          {book.description && (
            <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{book.description}</p>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <a
            href={visitHref}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2
                       bg-white text-slate-900 border border-slate-200 hover:bg-slate-50
                       dark:bg-neutral-800 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-neutral-700"
          >
            Visit
          </a>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <a
                href={`/library/${book.slug}/edit`} // You can point this to React (/books/:slug/edit) too
                className="inline-flex items-center gap-2 rounded-md px-3 py-2
                           border border-slate-200 text-slate-700 hover:bg-slate-50
                           dark:border-slate-700 dark:text-slate-200 dark:hover:bg-neutral-800"
              >
                Edit
              </a>
              <a
                href={`/library/${book.slug}/chapters`} // Your existing chapter manager route/page
                className="inline-flex items-center gap-2 rounded-md px-3 py-2
                           bg-slate-900 text-white hover:bg-slate-800
                           dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Chapter Manager
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}