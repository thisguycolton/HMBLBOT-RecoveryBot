import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, FolderPlus, LifeBuoy } from "lucide-react";
import LucideIcon from "../ui/LucideIcon";
import { Bone, SkeletonGroup } from "../ui/Skeleton";
import { api } from "../groups/lib";
import { useDocs } from "./DocsApp";
import DocSearch from "./DocSearch";
import { NewsBlock } from "./DocsNews";

// The Docs home (/docs): a welcome, the big search box, the News block (featured posts and the
// newest, DocsNews), and a card per section with its first few pages. Site admins also see how many pages still need a read-through and New section.
export default function DocsHome() {
  const { sections, loaded, editor, to_review: toReview, reload } = useDocs();
  const navigate = useNavigate();

  return (
    <div>
      <header className="mb-8">
        <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent dark:text-accent-light">
          <LifeBuoy size={16} /> Help &amp; docs
        </p>
        <h1 className="!m-0 !text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:!text-4xl">How to use RecoveryBot</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-neutral-400">
          Step-by-step guides for every tool, from finding a meeting to running your group&apos;s business meeting. Pick a section or search.
        </p>
        <div className="mt-6 max-w-2xl">
          <DocSearch />
        </div>
      </header>

      <NewsBlock />

      {editor && toReview > 0 && (
        <p className="mb-6 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="size-2 rounded-full bg-amber-400" />
          {toReview} {toReview === 1 ? "page has" : "pages have"} draft text nobody has reviewed yet (the dots in the list). Open one, read it through and tick Reviewed in its settings.
        </p>
      )}

      {!loaded ? (
        <SkeletonGroup className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Bone key={i} rounded="rounded-3xl" className="h-44" />)}
        </SkeletonGroup>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.filter((s) => s.kind !== "news").map((section) => (
            <section key={section.id} className="flex flex-col rounded-3xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <Link to={section.path} className="group flex items-start gap-3 !no-underline">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-tint text-accent dark:bg-accent/25 dark:text-white">
                  <LucideIcon name={section.icon} fallback={BookOpen} size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold text-slate-900 group-hover:text-accent dark:text-white dark:group-hover:text-accent-light">{section.title}</span>
                  {section.summary && <span className="mt-0.5 block text-sm text-slate-500 dark:text-neutral-400">{section.summary}</span>}
                </span>
              </Link>
              <ul className="!m-0 mt-4 flex-1 list-none space-y-1 !p-0 text-sm">
                {section.pages.slice(0, 5).map((page) => (
                  <li key={page.id}>
                    <Link to={page.path} className="!text-slate-700 !no-underline hover:!text-accent dark:!text-neutral-300 dark:hover:!text-accent-light">{page.title}</Link>
                  </li>
                ))}
              </ul>
              {section.pages.length > 5 && (
                <Link to={section.path} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold !text-accent !no-underline dark:!text-accent-light">
                  All {section.pages.length} pages <ArrowRight size={14} />
                </Link>
              )}
            </section>
          ))}
          {editor && <NewSection onMade={(s) => reload().then(() => navigate(s.path))} />}
        </div>
      )}
    </div>
  );
}

function NewSection({ onMade }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);
  const make = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    api("/docs/sections", { method: "POST", body: { section: { title } } })
      .then((d) => { setTitle(""); onMade(d.section); })
      .catch((err) => setError(err.message));
  };
  return (
    <form onSubmit={make} className="flex flex-col justify-center gap-3 rounded-3xl border-2 border-dashed border-neutral-200 p-5 dark:border-neutral-800">
      <p className="!m-0 flex items-center gap-2 font-semibold text-slate-700 dark:text-neutral-200"><FolderPlus size={18} /> New section</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Section name"
        className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
      />
      {error && <p className="!m-0 text-sm text-rose-600">{error}</p>}
      <button type="submit" className="self-start rounded-full px-4 py-2 text-sm font-semibold !bg-accent !text-white hover:opacity-90">Add section</button>
    </form>
  );
}
