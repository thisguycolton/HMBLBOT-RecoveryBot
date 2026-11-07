import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, ChevronRight, FilePlus2, Pencil, Trash2 } from "lucide-react";
import LucideIcon from "../ui/LucideIcon";
import IconPicker from "../ui/IconPicker";
import { Bone, SkeletonGroup } from "../ui/Skeleton";
import { inputClass, labelClass } from "../ui/styles";
import { api } from "../groups/lib";
import { useDocs } from "./DocsApp";

// A section of the docs (/docs/:section): its intro and every page in it. Site admins can add a
// page (a draft, opened in the editor), rename the section, and delete it once it's empty.
export default function DocsSectionPage() {
  const { section: slug } = useParams();
  const { sections, loaded, editor, reload } = useDocs();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const section = sections?.find((s) => s.slug === slug);

  if (!loaded) return <SkeletonGroup className="space-y-4"><Bone className="h-9 w-1/2" /><Bone className="h-4 w-2/3" /><Bone rounded="rounded-2xl" className="h-24" /></SkeletonGroup>;
  if (!section) return <NotFound />;

  const newPage = () => {
    api("/docs/pages", { method: "POST", body: { page: { doc_section_id: section.id, title: "New page" } } })
      .then((d) => reload().then(() => navigate(`${d.page.docs_path}/edit`)))
      .catch((e) => setError(e.message));
  };
  const remove = () => {
    if (!window.confirm(`Delete the section “${section.title}”?`)) return;
    api(`/docs/sections/${section.id}`, { method: "DELETE" }).then(() => reload().then(() => navigate("/docs"))).catch((e) => setError(e.message));
  };

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-sm text-slate-500 dark:text-neutral-400">
        <Link to="/docs" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-400 dark:hover:!text-white">Docs</Link>
      </nav>
      {editing ? (
        <SectionForm section={section} onDone={(changed) => { setEditing(false); if (changed) reload().then(() => changed.slug !== slug && navigate(changed.path)); }} />
      ) : (
        <header className="mb-8 flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-tint text-accent dark:bg-accent/25 dark:text-white">
            <LucideIcon name={section.icon} fallback={BookOpen} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="!m-0 !text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{section.title}</h1>
            {section.summary && <p className="mt-2 max-w-2xl text-base text-slate-600 dark:text-neutral-400">{section.summary}</p>}
            {editor && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={newPage} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold !bg-accent !text-white hover:opacity-90"><FilePlus2 size={15} /> New page</button>
                <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold !bg-neutral-100 !text-slate-700 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:!text-neutral-200"><Pencil size={15} /> Rename section</button>
                {!section.pages.length && <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold !bg-rose-50 !text-rose-700 dark:!bg-rose-500/10 dark:!text-rose-300"><Trash2 size={15} /> Delete section</button>}
              </div>
            )}
            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          </div>
        </header>
      )}

      <ul className="!m-0 grid list-none gap-3 !p-0 sm:grid-cols-2">
        {section.pages.map((page) => (
          <li key={page.id}>
            <Link to={page.path} className="group flex h-full items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 !no-underline transition hover:border-accent/50 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-slate-600 group-hover:bg-accent-tint group-hover:text-accent dark:bg-neutral-800 dark:text-neutral-300">
                <LucideIcon name={page.icon} fallback={BookOpen} size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                  {page.title}
                  {page.status === "draft" && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-neutral-800">Draft</span>}
                </span>
                {page.summary && <span className="mt-0.5 block text-sm text-slate-500 dark:text-neutral-400">{page.summary}</span>}
              </span>
              <ChevronRight size={16} className="mt-1 shrink-0 text-slate-300 group-hover:text-accent" />
            </Link>
          </li>
        ))}
      </ul>
      {!section.pages.length && <p className="text-slate-500 dark:text-neutral-400">No pages here yet.</p>}
    </div>
  );
}

function SectionForm({ section, onDone }) {
  const [form, setForm] = useState({ title: section.title, summary: section.summary || "", icon: section.icon, slug: section.slug, position: section.position });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const save = (e) => {
    e.preventDefault();
    api(`/docs/sections/${section.id}`, { method: "PATCH", body: { section: form } }).then((d) => onDone(d.section)).catch((err) => setError(err.message));
  };
  return (
    <form onSubmit={save} className="mb-8 grid gap-4 rounded-3xl border border-neutral-200 p-5 dark:border-neutral-800 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className={labelClass}>Name</span><input className={inputClass} value={form.title} onChange={set("title")} /></label>
      <label className="sm:col-span-2"><span className={labelClass}>Summary</span><input className={inputClass} value={form.summary} onChange={set("summary")} /></label>
      <label><span className={labelClass}>Address</span><input className={inputClass} value={form.slug} onChange={set("slug")} /></label>
      <label><span className={labelClass}>Order</span><input type="number" className={inputClass} value={form.position} onChange={set("position")} /></label>
      <div className="sm:col-span-2"><IconPicker value={form.icon} onChange={set("icon")} /></div>
      {error && <p className="!m-0 text-sm text-rose-600 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="rounded-full px-4 py-2 text-sm font-semibold !bg-accent !text-white">Save</button>
        <button type="button" onClick={() => onDone(null)} className="rounded-full px-4 py-2 text-sm font-semibold !bg-neutral-100 !text-slate-700 dark:!bg-neutral-800 dark:!text-neutral-200">Cancel</button>
      </div>
    </form>
  );
}

export function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="!m-0 !text-2xl font-bold text-slate-900 dark:text-white">That page isn&apos;t in the docs</h1>
      <p className="mt-2 text-slate-500 dark:text-neutral-400">It may have moved, or it may be for members only. <Link to="/docs">Back to the docs</Link></p>
    </div>
  );
}
