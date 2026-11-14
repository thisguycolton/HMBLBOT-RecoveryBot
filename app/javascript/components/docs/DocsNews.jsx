import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronRight, Newspaper, PenSquare, Star } from "lucide-react";
import { api } from "../groups/lib";
import { useDocs } from "./DocsApp";

// News in the Docs: blog posts and site news, written in the docs editor as pages of the News
// section (DocSection kind "news"). The Docs home leads with NewsBlock (featured posts first,
// then the newest, from /api/docs `news`); the News section lists every post (NewsList).

export const newsDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null);

// "Blog · Nov 14, 2026", and a Featured star when it's pinned
export function NewsMeta({ post, className = "" }) {
  const date = newsDate(post.published_at);
  return (
    <span className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold ${className}`}>
      <span className="uppercase tracking-wide text-accent dark:text-accent-light">{post.news_label || "News"}</span>
      {date && <><span aria-hidden="true" className="text-slate-300 dark:text-neutral-600">·</span><time dateTime={post.published_at} className="font-medium text-slate-500 dark:text-neutral-400">{date}</time></>}
      {post.featured && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
          <Star size={11} className="fill-current" /> Featured
        </span>
      )}
      {post.status === "draft" && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-neutral-800 dark:text-neutral-400">Draft</span>}
    </span>
  );
}

// The post's cover picture, or the site's blue cover with a newspaper when it has none
export function NewsCover({ post, className = "", iconSize = 28 }) {
  if (post.cover_image) {
    return <img src={post.cover_image} alt="" loading="lazy" className={`object-cover ${className}`} />;
  }
  return (
    <span aria-hidden="true" className={`grid place-items-center bg-gradient-to-br from-cover-from to-cover-to text-white/80 ${className}`}>
      <Newspaper size={iconSize} strokeWidth={1.5} />
    </span>
  );
}

// Makes a draft post in the News section and opens it in the editor
function useNewPost(section) {
  const { reload } = useDocs();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const make = () => {
    if (!section) return;
    api("/docs/pages", { method: "POST", body: { page: { doc_section_id: section.id, title: "New post" } } })
      .then((d) => reload().then(() => navigate(`${d.page.docs_path}/edit`)))
      .catch((e) => setError(e.message));
  };
  return [make, error];
}

export function NewPostButton({ section, label = "Write a post", className = "" }) {
  const [make, error] = useNewPost(section);
  return (
    <>
      <button type="button" onClick={make} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold !bg-accent !text-white hover:opacity-90 ${className}`}>
        <PenSquare size={15} /> {label}
      </button>
      {error && <span className="text-sm text-rose-600">{error}</span>}
    </>
  );
}

// The top of the Docs home: the lead post big, with its cover, and up to three more beside it
// (under it on phones). Hidden when there's no news, except for editors, who get a nudge.
export function NewsBlock() {
  const { news, sections, editor } = useDocs();
  const section = sections?.find((s) => s.kind === "news");
  const posts = news || [];
  if (!section || (!posts.length && !editor)) return null;

  const [lead, ...rest] = posts;
  return (
    <section aria-labelledby="docs-news" className="mb-10">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="docs-news" className="!m-0 flex items-center gap-2 !text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          <Newspaper size={20} className="text-accent dark:text-accent-light" /> News
        </h2>
        <span className="flex-1" />
        {editor && <NewPostButton section={section} />}
        {posts.length > 0 && (
          <Link to={section.path} className="inline-flex items-center gap-1 text-sm font-semibold !text-accent !no-underline dark:!text-accent-light">
            All news <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {!lead ? (
        <p className="!m-0 rounded-3xl border-2 border-dashed border-neutral-200 p-6 text-sm text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
          No news yet. Write a post, publish it, and it shows here for everyone. Switch on Featured in a post&apos;s settings to keep it at the front.
        </p>
      ) : (
        <div className={`grid gap-4 ${rest.length ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" : ""}`}>
          <Link
            to={lead.path}
            className={`group flex overflow-hidden rounded-3xl border border-neutral-200 bg-white !no-underline transition hover:border-accent/50 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 ${rest.length ? "flex-col" : "flex-col sm:flex-row"}`}
          >
            <NewsCover post={lead} iconSize={44} className={`aspect-[16/9] w-full shrink-0 ${rest.length ? "" : "sm:aspect-auto sm:w-1/2 sm:min-h-56"}`} />
            <span className="flex flex-1 flex-col p-5 sm:p-6">
              <NewsMeta post={lead} />
              <span className="mt-2 block text-xl font-bold leading-snug tracking-tight text-slate-900 group-hover:text-accent dark:text-white dark:group-hover:text-accent-light sm:text-2xl">{lead.title}</span>
              {lead.summary && <span className="mt-2 line-clamp-3 block text-sm text-slate-600 dark:text-neutral-400 sm:text-base">{lead.summary}</span>}
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent dark:text-accent-light">
                Read more <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </Link>

          {rest.length > 0 && (
            <ul className="!m-0 flex list-none flex-col gap-3 !p-0">
              {rest.map((post) => (
                <li key={post.id} className="flex-1">
                  <Link
                    to={post.path}
                    className="group flex h-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-3 !no-underline transition hover:border-accent/50 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <NewsCover post={post} iconSize={22} className="size-20 shrink-0 rounded-xl sm:size-24" />
                    <span className="min-w-0 flex-1">
                      <NewsMeta post={post} />
                      <span className="mt-1 line-clamp-2 block font-semibold leading-snug text-slate-900 group-hover:text-accent dark:text-white dark:group-hover:text-accent-light">{post.title}</span>
                      {post.summary && <span className="mt-0.5 line-clamp-1 block text-sm text-slate-500 dark:text-neutral-400">{post.summary}</span>}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-slate-300 group-hover:text-accent dark:text-neutral-600" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// Every post in a news section, newest first (drafts on top for editors)
export function NewsList({ section }) {
  if (!section.pages.length) return <p className="text-slate-500 dark:text-neutral-400">No posts yet.</p>;
  return (
    <ul className="!m-0 grid list-none gap-4 !p-0 sm:grid-cols-2 xl:grid-cols-3">
      {section.pages.map((post) => (
        <li key={post.id}>
          <Link
            to={post.path}
            className="group flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white !no-underline transition hover:border-accent/50 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <NewsCover post={post} className="aspect-[16/9] w-full" />
            <span className="flex flex-1 flex-col p-4">
              <NewsMeta post={post} />
              <span className="mt-1.5 block font-semibold leading-snug text-slate-900 group-hover:text-accent dark:text-white dark:group-hover:text-accent-light">{post.title}</span>
              {post.summary && <span className="mt-1 line-clamp-2 block text-sm text-slate-500 dark:text-neutral-400">{post.summary}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
