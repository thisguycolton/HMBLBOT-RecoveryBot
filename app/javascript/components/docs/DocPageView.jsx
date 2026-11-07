import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, EyeOff, Lock, Pencil, Users } from "lucide-react";
import LucideIcon from "../ui/LucideIcon";
import { Bone, SkeletonGroup, SkeletonText } from "../ui/Skeleton";
import { api } from "../groups/lib";
import { useDocs } from "./DocsApp";
import { NotFound } from "./DocsSectionPage";
import { renderDoc } from "./docMarkdown";
import { flashLine, LineLinks, ShareButton } from "./DocShare";

const longDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

// One docs page (/docs/:section/:page, or /about and /history by `alias`): breadcrumb, title,
// summary, the Markdown, when it last changed and Previous / Next. Its headings are listed
// beside it on wide screens, or folded under the title (On this page). Site admins get Edit and see whether it's a draft
// or still waiting for a read-through.
export default function DocPageView({ alias }) {
  const params = useParams();
  const { hash } = useLocation();
  const { editor } = useDocs();
  const [data, setData] = useState(null);
  const [missing, setMissing] = useState(false);
  const [active, setActive] = useState(null);
  const body = useRef(null);

  useEffect(() => {
    setData(null);
    setMissing(false);
    const query = alias ? `alias=${alias}` : `section=${encodeURIComponent(params.section)}&page=${encodeURIComponent(params.page)}`;
    api(`/docs/page?${query}`).then(setData).catch(() => setMissing(true));
  }, [alias, params.section, params.page]);

  const page = data?.page;
  const { html, headings } = useMemo(() => (page ? renderDoc(page.body) : { html: "", headings: [] }), [page]);

  useEffect(() => {
    if (page) document.title = page.path_alias ? `${page.title} | RecoveryBot` : `${page.title} | RecoveryBot Docs`;
  }, [page]);

  // A link to a heading or a line (#hosts, #l-…) scrolls there once the page is drawn and
  // lights it up for a moment
  useEffect(() => {
    if (!html || !hash) return undefined;
    const t = setTimeout(() => flashLine(decodeURIComponent(hash.slice(1))), 150);
    return () => clearTimeout(t);
  }, [html, hash]);

  // The heading you're reading lights up in On this page
  useEffect(() => {
    if (!headings.length) return undefined;
    const seen = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id);
    }, { rootMargin: "-80px 0px -65% 0px" });
    headings.forEach((h) => { const el = document.getElementById(h.id); if (el) seen.observe(el); });
    return () => seen.disconnect();
  }, [headings]);

  if (missing) return <NotFound />;
  if (!page) {
    return (
      <SkeletonGroup className="max-w-3xl space-y-4">
        <Bone className="h-4 w-40" />
        <Bone className="h-10 w-2/3" />
        <Bone className="h-4 w-1/2" />
        <SkeletonText lines={8} className="pt-6" />
      </SkeletonGroup>
    );
  }

  const toc = headings.length > 1 ? <OnThisPage headings={headings} active={active} onPick={setActive} /> : null;

  return (
    <div className="grid gap-10 2xl:grid-cols-[minmax(0,48rem)_13rem]">
      <article className="relative min-w-0 max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-3 hidden flex-wrap items-center lg:flex gap-1 text-sm text-slate-500 dark:text-neutral-400">
          <Link to="/docs" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-400 dark:hover:!text-white">Docs</Link>
          <ChevronRight size={14} />
          <Link to={page.section.path} className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-400 dark:hover:!text-white">{page.section.title}</Link>
        </nav>

        <header className="mb-8 border-b border-neutral-200 pb-6 dark:border-neutral-800">
          <div className="flex items-start gap-4">
            <span className="mt-1 hidden size-11 shrink-0 place-items-center rounded-xl bg-accent-tint text-accent dark:bg-accent/25 dark:text-white sm:grid">
              <LucideIcon name={page.icon} fallback={BookOpen} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="!m-0 !text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:!text-4xl">{page.title}</h1>
              {page.summary && <p className="mt-2 text-lg text-slate-600 dark:text-neutral-400">{page.summary}</p>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {page.audience === "members" && <Badge icon={Users}>For members (signed in)</Badge>}
            {page.audience === "admins" && <Badge icon={Lock}>For site admins</Badge>}
            {editor && page.status === "draft" && <Badge icon={EyeOff} tone="slate">Draft: only site admins see it</Badge>}
            {editor && !page.reviewed && <Badge tone="amber">Draft text, not reviewed yet</Badge>}
            <span className="ml-auto flex items-center gap-2">
              <ShareButton page={page} headings={headings} />
            {editor && (
              <Link to={`${page.docs_path}/edit`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold !bg-neutral-100 !text-slate-700 !no-underline hover:!bg-neutral-200 dark:!bg-neutral-800 dark:!text-neutral-200">
                <Pencil size={14} /> Edit
              </Link>
            )}
            </span>
          </div>
        </header>

        {toc && (
          <details className="group mb-8 rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800 2xl:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold leading-6 text-slate-700 dark:text-neutral-200 [&::-webkit-details-marker]:hidden">
              <ChevronRight size={15} className="shrink-0 transition-transform group-open:rotate-90" />
              <span>On this page</span>
            </summary>
            <div className="mt-2">{toc}</div>
          </details>
        )}

        <LineLinks body={body} title={page.title} />
        <div
          ref={body}
          className="doc-body prose prose-slate max-w-none dark:prose-invert [&_p]:!text-left [&_li]:!text-left prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-10 prose-h2:text-2xl prose-h3:text-lg prose-a:text-accent dark:prose-a:text-accent-light prose-li:my-1 prose-img:rounded-2xl prose-table:text-sm"
          // renderDoc runs markdown-it with raw HTML off: the text can't add tags of its own
          dangerouslySetInnerHTML={{ __html: html }} // eslint-disable-line react/no-danger
        />

        <footer className="mt-12 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <p className="!m-0 text-sm text-slate-500 dark:text-neutral-400">Last updated {longDate(page.updated_at)}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {data.previous ? <Neighbor to={data.previous} label="Previous" icon={ArrowLeft} /> : <span />}
            {data.next && <Neighbor to={data.next} label="Next" icon={ArrowRight} right />}
          </div>
        </footer>
      </article>
      {toc && (
        <aside className="hidden 2xl:block">
          <div className="sticky top-10">{toc}</div>
        </aside>
      )}
    </div>
  );
}

// The page's ## and ### headings; the one you're reading lights up
function OnThisPage({ headings, active, onPick }) {
  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400 2xl:block">On this page</p>
      <ul className="!m-0 list-none space-y-0.5 !p-0">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" }); window.history.replaceState(null, "", `#${h.id}`); onPick(h.id); }}
              className={`block border-l-2 py-1 !no-underline ${h.level === 3 ? "pl-5" : "pl-3"} ${
                active === h.id ? "border-accent font-semibold !text-accent dark:!text-accent-light" : "border-transparent !text-slate-600 hover:!text-slate-900 dark:!text-neutral-400 dark:hover:!text-white"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Badge({ icon: Icon, tone = "accent", children }) {
  const tones = {
    accent: "bg-accent-tint text-accent dark:bg-accent/25 dark:text-white",
    slate: "bg-neutral-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300",
    amber: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${tones[tone]}`}>
      {Icon && <Icon size={12} />} {children}
    </span>
  );
}

function Neighbor({ to, label, icon: Icon, right = false }) {
  return (
    <Link to={to.path} className={`group flex flex-col rounded-2xl border border-neutral-200 p-4 !no-underline hover:border-accent/50 dark:border-neutral-800 ${right ? "items-end text-right" : ""}`}>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-neutral-400">
        {!right && <Icon size={13} />} {label} {right && <Icon size={13} />}
      </span>
      <span className="mt-1 font-semibold text-slate-900 group-hover:text-accent dark:text-white dark:group-hover:text-accent-light">{to.title}</span>
      <span className="text-xs text-slate-500 dark:text-neutral-400">{to.section}</span>
    </Link>
  );
}
