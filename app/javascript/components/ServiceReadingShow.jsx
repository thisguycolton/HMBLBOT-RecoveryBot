import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import { Copy, Pencil, Trash2, MessageSquareQuote, BookOpen } from "lucide-react";

export default function ServiceReadingShow({
  reading,
  notice,
  isAdmin,
  isAuthenticated
}) {
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  // Scroll progress bar
  useEffect(() => {
    const handleScroll = () => {
      const height =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;

      const scrollTop =
        document.body.scrollTop || document.documentElement.scrollTop;

      setProgress((scrollTop / height) * 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Copy handler
  const handleCopy = async () => {
    const html = `
      <strong style="font-size:1.5em;">Reading:</strong><br>
      ${reading.title}<br>
      ${reading.source}<br>
      https://aa.humblebot.io/service_readings/${reading.id}
    `;

    const text = html.replace(/<\/?[^>]+(>|$)/g, "");

    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);

    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 text-slate-900 dark:text-white w-screen">
      <Navbar isAuthenticated={isAuthenticated} />

      {/* Scroll progress */}
      <div
        className="fixed top-0 left-0 h-1 bg-cyan-500 z-50"
        style={{ width: `${progress}%` }}
      />

      {/* Hero */}
      <div className="bg-teal-500 dark:bg-teal-700 text-white py-12 text-center pt-30 border-b-8 border-cyan-200 shadow-sm dark:border-cyan-900">
        <div className="mb-4 rounded-3xl bg-white/10 size-25 mx-auto p-5.5">
          <BookOpen className="h-12 w-12 md:h-14 md:w-14" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-widest ttSans uppercase mt-10">
          {reading.title}
        </h1>
        <p className="mt-2 text-lg opacity-80 text-2xl! text-center! w-full">
          {reading.source}
        </p>
                {/* Copy Button */}
        <div className="flex justify-end mb-4 absolute top-20 right-4 z-50">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 rounded ${
              copied
                ? "bg-green-600 text-white"
                : "bg-slate-900 text-white dark:bg-white dark:text-black"
            }`}
          >
            <Copy size={16} />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {notice && (
          <div className="mb-4 text-green-500">{notice}</div>
        )}

        {/* Reading Body */}
        <div className="prose dark:prose-invert max-w-none noto text-lg">
          <div dangerouslySetInnerHTML={{ __html: reading.content_html }} />
        </div>

        {/* Source */}
        <div className="mt-6 text-sm text-slate-500">
          Source: {reading.source}
        </div>

        {/* Admin */}
        {isAdmin && (
          <div className="mt-10 grid grid-cols-2 gap-3">
            <a
              href={`/service_readings/${reading.id}/edit`}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded border border-cyan-500 text-cyan-500"
            >
              <Pencil size={16} />
              Edit
            </a>

            <form method="post" action={`/service_readings/${reading.id}`}>
              <input type="hidden" name="_method" value="delete" />
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-red-500 text-red-500"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </form>
          </div>
        )}
      </main>

      {/* CTA */}
        <section className=" bg-neutral-100 dark:bg-stone-900 dark:text-neutral-100">
          <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
            <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 text-sky-800">
                <MessageSquareQuote size={38} />
              </div>

              <div className="flex-1">
                <h2 className="text-3xl font-semibold md:text-5xl">
                  Share Readings Easier
                </h2>
                <p className="mt-3 text-lg text-slate-600 dark:text-neutral-300 md:text-2xl">
                  Sign up to post your readings and share them with others with a simple click.
                </p>
              </div>
            </div>

            <div className="mt-8 mx-auto max-w-2xl">
              <a
                href="/users/sign_up"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-500 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-400"
              >
                Sign Up
              </a>
            </div>
          </div>
        </section>
    </div>
  );
}