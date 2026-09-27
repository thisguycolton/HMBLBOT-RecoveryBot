import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Shell, ShellPanel } from "../ui/Shell";
import { inputClass, iconInputClass, labelClass } from "../ui/styles";
import { api, topicTitle } from "./api";
import { buttonClass, selectClass } from "./App";
import TopicEditor, { DifficultyBadge } from "./TopicEditor";
import LucideIcon from "../ui/LucideIcon";

// Filters live in the query string, so a set or category page can link straight to its topics
const FILTERS = ["q", "topic_set_id", "category_id", "difficulty", "tag_id", "prompts"];

export default function TopicsPage({ meta, reloadMeta, notify }) {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [query, setQuery] = useState(params.get("q") || "");
  const [refresh, setRefresh] = useState(0);
  const page = Number(params.get("page") || 1);

  // search as you type, a moment after the last keystroke
  useEffect(() => {
    const t = setTimeout(() => setFilter("q", query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams();
    [...FILTERS, "page"].forEach((k) => params.get(k) && qs.set(k, params.get(k)));
    api(`/topics?${qs}`).then((r) => live && setResult(r)).catch((e) => notify(e.message, "error"));
    return () => { live = false; };
  }, [params.toString(), refresh]);

  function setFilter(key, value) {
    const next = new URLSearchParams(params);
    if ((next.get(key) || "") === (value || "")) return;
    value ? next.set(key, value) : next.delete(key);
    next.delete("page");
    setParams(next, { replace: true });
  }

  const goPage = (n) => {
    const next = new URLSearchParams(params);
    n > 1 ? next.set("page", n) : next.delete("page");
    setParams(next);
  };

  const open = (id) => navigate({ pathname: `/topics/${id}`, search: params.toString() });
  const close = () => navigate({ pathname: "/", search: params.toString() });
  const saved = (topic, created) => {
    setRefresh((n) => n + 1);
    reloadMeta();
    if (created) open(topic.id);
  };
  const deleted = () => {
    setRefresh((n) => n + 1);
    reloadMeta();
    close();
    notify("Topic deleted.");
  };

  const pages = result ? Math.max(1, Math.ceil(result.total / result.per_page)) : 1;
  const setName = Object.fromEntries(meta.topic_sets.map((s) => [s.id, s.name]));
  const catById = Object.fromEntries(meta.categories.map((c) => [c.id, c]));
  const editing = topicId === "new" ? "new" : topicId ? Number(topicId) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start">
      {/* List (hidden on small screens while a topic is open) */}
      <div className={`space-y-4 ${editing ? "hidden lg:block" : ""}`}>
        <Shell>
          <ShellPanel position="top" className="p-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className={iconInputClass} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search titles or a topic number…"
                  aria-label="Search topics"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <button type="button" className={buttonClass.primary} onClick={() => navigate({ pathname: "/topics/new", search: params.toString() })}>
                <Plus className="w-4 h-4" strokeWidth={2.5} /> New
              </button>
            </div>
          </ShellPanel>
          <ShellPanel position="bottom" className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Filter label="Set" value={params.get("topic_set_id")} onChange={(v) => setFilter("topic_set_id", v)}
              options={meta.topic_sets.map((s) => [s.id, `${s.name} (${s.topics})`])} />
            <Filter label="Category" value={params.get("category_id")} onChange={(v) => setFilter("category_id", v)}
              options={[["none", `Open Road (${meta.uncategorized})`], ...meta.categories.map((c) => [c.id, `${c.title} (${c.topics})`])]} />
            <Filter label="Difficulty" value={params.get("difficulty")} onChange={(v) => setFilter("difficulty", v)}
              options={[["unset", "Not set"], ...meta.difficulties.map((d) => [d, cap(d)])]} />
            <Filter label="Tag" value={params.get("tag_id")} onChange={(v) => setFilter("tag_id", v)}
              options={meta.tags.map((t) => [t.id, t.title])} />
            <Filter label="Ways to share" value={params.get("prompts")} onChange={(v) => setFilter("prompts", v)}
              options={[["curated", "Has custom wording"], ["draft", "Has drafts to review"]]} />
          </ShellPanel>
        </Shell>

        <Shell>
          <ShellPanel position="single" className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {!result ? (
              <p className="p-6 text-sm text-slate-500 !font-sans">Loading…</p>
            ) : result.topics.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 dark:text-neutral-400 !font-sans">No topics match these filters.</p>
            ) : (
              result.topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => open(t.id)}
                  aria-current={editing === t.id ? "true" : undefined}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                    editing === t.id ? "!bg-accent-tint dark:!bg-accent/25" : "!bg-transparent hover:!bg-accent/5 dark:hover:!bg-white/5"
                  }`}
                >
                  <span className="w-10 shrink-0 text-xs tabular-nums text-slate-400 pt-0.5">{t.searchable_number || "–"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-900 dark:text-white !font-sans">{topicTitle(t)}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-neutral-400 mt-0.5 !font-sans">
                      <LucideIcon name={catById[t.topic_category_id]?.icon_name || (t.topic_category_id ? null : "signpost")} size={12} className="shrink-0 text-accent dark:text-accent-soft" />
                      {setName[t.topic_set_id]} · {catById[t.topic_category_id]?.title || "Open Road"}
                      {t.tag_ids.length > 0 && ` · ${t.tag_ids.length} tag${t.tag_ids.length === 1 ? "" : "s"}`}
                      {t.prompts.custom > 0 && ` · ${t.prompts.custom} custom`}
                      {t.prompts.off > 0 && ` · ${t.prompts.off} off`}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 shrink-0">
                    <DifficultyBadge difficulty={t.difficulty} />
                    {t.prompts.draft > 0 && (
                      <span className="rounded-full bg-amber-50 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200 px-2 py-0.5 text-xs">
                        {t.prompts.draft} draft{t.prompts.draft === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </ShellPanel>
        </Shell>

        {result && (
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-neutral-400 !font-sans">
            <span>{result.total} topic{result.total === 1 ? "" : "s"}</span>
            <span className="flex items-center gap-2">
              <button type="button" className={buttonClass.secondary} disabled={page <= 1} onClick={() => goPage(page - 1)} aria-label="Previous page">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="tabular-nums">{page} / {pages}</span>
              <button type="button" className={buttonClass.secondary} disabled={page >= pages} onClick={() => goPage(page + 1)} aria-label="Next page">
                <ChevronRight className="w-4 h-4" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className={editing ? "" : "hidden lg:block"}>
        {editing ? (
          <TopicEditor
            key={editing}
            topicId={editing}
            meta={meta}
            defaults={{ topic_set_id: params.get("topic_set_id") || meta.topic_sets[0]?.id }}
            onClose={close}
            onSaved={saved}
            onDeleted={deleted}
            notify={notify}
          />
        ) : (
          <div className="rounded-panel border-2 border-dashed border-neutral-200 dark:border-neutral-800 p-10 text-center text-sm text-slate-500 dark:text-neutral-400 !font-sans">
            Choose a topic to edit its details, difficulty, tags and ways to share.
          </div>
        )}
      </div>
    </div>
  );
}

function Filter({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">All</option>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
