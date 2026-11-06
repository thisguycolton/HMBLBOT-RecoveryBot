import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Copy, Eye, FileText, Merge, PencilRuler, Plus, Printer, RotateCcw, Rows3, ScrollText, Scissors, StickyNote, Trash2, X } from "lucide-react";
import { api } from "../../groups/lib";
import { Card, ErrorNote, Loading, primaryButton, quietButton } from "../../groups/ui";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import { showToast } from "../../../lib/toast";
import StepSection, { Prose } from "./StepSections";
import PrintableWorksheet from "./PrintableWorksheet";
import { KINDS, Mover, SectionEditor, area, iconButton, newId, newSection, problem, tidy } from "./EditorFields";
import { pagesOf, partsOf, readingsOnly } from "./stepText";
import { dropSection, mergeUp, moveInPage, moveToPage, setPage, splitAt } from "./pageOps";

const STEPS = Array.from({ length: 12 }, (_, i) => i + 1);

// The HumbleBot Editor (/recovery/steps/:id/edit): build or change a worksheet completely.
// The outline of sections on the left, the one picked in the middle (EditorFields), and a live
// preview on the right, on screen or on paper. Shown a page at a time (the default), the outline
// groups the sections by page: a page can be named, given a line under its title, split and
// merged (pageOps), and the preview shows one page with Back and Next. Only their own copy changes; what they've
// written stays with each section. Saving sends the whole definition (StepTool.clean keeps
// what it understands).
export default function WorksheetEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [work, setWork] = useState(null);
  const [original, setOriginal] = useState(null);
  const [draft, setDraft] = useState(null);
  const [picked, setPicked] = useState("worksheet");
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState("edit"); // on phones: edit | preview
  const [paper, setPaper] = useState(false);
  const [tried, setTried] = useState({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const previewRef = useRef(null);

  useEffect(() => {
    api(`/step_works/${id}?editor=1`).then((d) => {
      setWork(d.work);
      setOriginal(d.original || null);
      setDraft({ name: d.work.name, step: d.work.step, intro: d.work.definition.intro || "", credit: d.work.definition.credit || "", layout: d.work.definition.layout || "", sections: d.work.definition.sections });
      setTried(d.work.answers || {});
      document.title = `Editing ${d.work.name} | RecoveryBot`;
    }).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Keep the section being edited in view in the preview
  useEffect(() => {
    previewRef.current?.querySelector(`[data-section="${picked}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [picked]);

  const definition = useMemo(() => draft && { intro: draft.intro, credit: draft.credit || undefined, layout: draft.layout || undefined, sections: draft.sections }, [draft]);
  // Every page, as the editor shows them: a page of nothing but readings shows on the welcome page
  const pages = useMemo(() => {
    if (!definition) return null;
    const all = pagesOf(definition, { all: true });
    const split = all.some((p) => !readingsOnly(p));
    const of = all.filter((p) => !split || !readingsOnly(p)).length;
    let n = 0;
    return all.map((p) => {
      const welcome = split && all.length > 1 && readingsOnly(p);
      if (!welcome) n += 1;
      return { ...p, welcome, label: welcome ? "Welcome page" : `Page ${n}`, of };
    });
  }, [definition]);
  if (!draft) return <div className="mx-auto max-w-3xl">{error ? <ErrorNote error={error} /> : <Loading />}</div>;

  const update = (patch) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); };
  const setSections = (sections) => update({ sections });
  const section = draft.sections.find((s) => s.id === picked);
  const changeSection = (next) => setSections(draft.sections.map((s) => (s.id === next.id ? next : s)));
  const pageMode = draft.layout !== "one_page";
  const pickedPage = picked.startsWith("page:") ? pages.find((p) => p.id === picked.slice(5)) : null;
  const pageOf = (sid) => pages.find((p) => p.sections.some((s) => s.id === sid));
  // The page the preview shows: the picked page, or the picked section's page
  const shownPage = pageMode ? (pickedPage || (section && pageOf(section.id)) || null) : null;
  const pageOp = (next, pick) => { setSections(next); if (pick) setPicked(pick); };
  const add = (kind) => {
    const s = newSection(kind, draft.sections);
    const last = pickedPage?.sections[pickedPage.sections.length - 1];
    const at = last ? draft.sections.indexOf(last) + 1 : section ? draft.sections.indexOf(section) + 1 : draft.sections.length;
    setSections([...draft.sections.slice(0, at), s, ...draft.sections.slice(at)]);
    setPicked(s.id);
    setAdding(false);
  };
  const duplicate = (s) => {
    const copy = JSON.parse(JSON.stringify(s));
    copy.id = newId(s.kind);
    copy.title = s.title ? `${s.title} (copy)` : s.title;
    delete copy.page;
    delete copy.page_line;
    ["items", "review", "columns"].forEach((k) => { if (copy[k]) copy[k] = copy[k].map((x) => ({ ...x, id: newId(k === "columns" ? "col" : "q") })); });
    const at = draft.sections.indexOf(s) + 1;
    setSections([...draft.sections.slice(0, at), copy, ...draft.sections.slice(at)]);
    setPicked(copy.id);
  };
  const remove = (s) => {
    if (draft.sections.length === 1) return setError("A worksheet needs at least one section.");
    const wrote = work.answers?.[s.id] && JSON.stringify(work.answers[s.id]).replace(/[{}[\]",:]/g, "").trim();
    if (wrote && !window.confirm("You've written in this section. Take it out? What you wrote won't show once you save.")) return null;
    const n = draft.sections.indexOf(s);
    setSections(dropSection(draft.sections, s.id));
    return setPicked(draft.sections[n + 1]?.id || draft.sections[n - 1]?.id || "worksheet");
  };
  const startOver = () => {
    if (!original || !window.confirm(`Start over from ${original.name}? Your changes to the sections are replaced (nothing is saved until you press Save).`)) return;
    update({ intro: original.definition.intro || "", credit: original.definition.credit || "", layout: original.definition.layout || "", sections: original.definition.sections });
    setPicked("worksheet");
  };
  const save = async (andLeave) => {
    const missing = draft.sections.map(problem).find(Boolean);
    if (missing) { setError(missing); return; }
    if (!draft.name.trim()) { setError("Give the worksheet a name."); setPicked("worksheet"); return; }
    setBusy(true);
    setError(null);
    try {
      const d = await api(`/step_works/${id}`, { method: "PATCH", body: { name: draft.name.trim(), step: draft.step, definition: tidy(definition) } });
      setWork(d.work);
      setDirty(false);
      showToast("Your worksheet is saved.", { tone: "success" });
      if (andLeave) navigate(`/steps/${id}`);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const leave = () => { if (!dirty || window.confirm("Leave without saving your changes?")) navigate(`/steps/${id}`); };

  const outline = (
    <nav aria-label="Sections" className="space-y-1">
      <OutlineButton on={picked === "worksheet"} onClick={() => setPicked("worksheet")} icon={FileText} title={draft.name || "Untitled"} sub={`Step ${draft.step} · name and introduction`} />
      {pageMode && pages.map((p, pn) => (
        <div key={p.id} className="space-y-0.5">
          {p.part && pages[pn - 1]?.part !== p.part && <div className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{p.part}</div>}
          <button type="button" aria-current={picked === `page:${p.id}` ? "true" : undefined} onClick={() => setPicked(`page:${p.id}`)}
            className={`mt-1 flex w-full items-baseline gap-2 rounded-xl px-2 py-1 text-left ${picked === `page:${p.id}` ? "!bg-accent/10 dark:!bg-accent/25" : "!bg-transparent hover:!bg-neutral-100 dark:hover:!bg-neutral-800"}`}>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-accent dark:text-accent-light">{p.label}</span>
            <span className="min-w-0 truncate text-xs font-medium text-slate-700 dark:text-neutral-300">{p.title}</span>
          </button>
          <div className="ml-2 space-y-0.5 border-l border-neutral-200 pl-1.5 dark:border-neutral-700">
            {p.sections.map((s, i) => {
              const bad = problem(s);
              return (
                <div key={s.id} className="group flex items-center gap-0.5">
                  <OutlineButton on={picked === s.id} onClick={() => setPicked(s.id)} icon={KINDS[s.kind]?.icon || FileText}
                    title={s.title || s.body?.slice(0, 50) || KINDS[s.kind]?.name} sub={bad ? "Needs something" : KINDS[s.kind]?.name} warn={!!bad} />
                  <div className={`flex shrink-0 ${picked === s.id ? "" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"}`}>
                    <button type="button" aria-label={`Move ${s.title || "this section"} up`} disabled={i === 0} onClick={() => setSections(moveInPage(draft.sections, s.id, -1))} className={iconButton}><ArrowUp className="size-4" /></button>
                    <button type="button" aria-label={`Move ${s.title || "this section"} down`} disabled={i === p.sections.length - 1} onClick={() => setSections(moveInPage(draft.sections, s.id, 1))} className={iconButton}><ArrowDown className="size-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {!pageMode && partsOf(definition).map((p, pn) => (
        <div key={pn} className="space-y-1">
          {p.part && <div className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{p.part}</div>}
          {p.sections.map((s) => {
            const n = draft.sections.indexOf(s);
            const bad = problem(s);
            return (
              <div key={s.id} className="group flex items-center gap-0.5">
                <OutlineButton on={picked === s.id} onClick={() => setPicked(s.id)} icon={KINDS[s.kind]?.icon || FileText}
                  title={s.title || s.body?.slice(0, 50) || KINDS[s.kind]?.name} sub={bad ? "Needs something" : KINDS[s.kind]?.name} warn={!!bad} />
                <div className={picked === s.id ? "" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"}>
                  <Mover list={draft.sections} n={n} set={setSections} label={s.title || "this section"} remove={false} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <button type="button" className={`${quietButton} mt-2 w-full justify-center`} onClick={() => setAdding(true)}><Plus className="size-4" /> Add a section</button>
    </nav>
  );

  const pageEditor = pickedPage && (
    <PageEditor key={pickedPage.id} page={pickedPage} pages={pages}
      setTitle={(page) => setSections(setPage(draft.sections, pickedPage.id, { page }))}
      setLine={(page_line) => setSections(setPage(draft.sections, pickedPage.id, { page_line }))}
      split={(sid) => pageOp(splitAt(draft.sections, sid), `page:${sid}`)}
      merge={() => pageOp(mergeUp(draft.sections, pickedPage.id), `page:${pages[pickedPage.number - 2].id}`)}
      move={(sid, d) => setSections(moveInPage(draft.sections, sid, d))}
      pick={setPicked} addHere={() => setAdding(true)} />
  );

  const editor = pageEditor || (picked === "worksheet" || !section ? (
    <div className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="ed-name">Name</label>
        <input id="ed-name" className={inputClass} maxLength={200} value={draft.name} onChange={(e) => update({ name: e.target.value })} />
      </div>
      <div>
        <label className={labelClass} htmlFor="ed-step">For step</label>
        <select id="ed-step" className={selectClass} value={draft.step} onChange={(e) => update({ step: Number(e.target.value) })}>
          {STEPS.map((n) => <option key={n} value={n}>Step {n}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="ed-intro">Introduction</label>
        <textarea id="ed-intro" className={`${area} min-h-[6rem]`} maxLength={4000} value={draft.intro} onChange={(e) => update({ intro: e.target.value })} />
        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">A new line starts a new paragraph. **Two stars** make words bold, and {"{{higher_power}}"} becomes their name for their Higher Power.</p>
      </div>
      <div>
        <span className={labelClass} id="ed-layout">Show it</span>
        <Segmented label="Show it" labelledBy="ed-layout" value={pageMode ? "pages" : "one_page"} onChange={(v) => update({ layout: v === "one_page" ? "one_page" : "" })}
          options={[["pages", "A page at a time", Rows3], ["one_page", "All on one page", ScrollText]]} />
        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
          {pageMode ? "A welcome page with the readings, then a page at a time, then a look over everything. Pick a page in the outline to name it, split it or join it to the one above." : "Everything on one long page. Whoever uses it can still switch to a page at a time."}
        </p>
      </div>
      <div>
        <label className={labelClass} htmlFor="ed-credit">Credit</label>
        <input id="ed-credit" className={inputClass} maxLength={300} placeholder="Where the approach comes from, if anywhere" value={draft.credit} onChange={(e) => update({ credit: e.target.value })} />
      </div>
      {original && (
        <div className="border-t border-neutral-200/70 pt-4 dark:border-neutral-800">
          <button type="button" className={quietButton} onClick={startOver}><RotateCcw className="size-4" /> Start over from {original.name}</button>
        </div>
      )}
    </div>
  ) : (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
          {React.createElement(KINDS[section.kind].icon, { className: "size-4" })} {KINDS[section.kind].name}
        </span>
        <div className="flex gap-1">
          <button type="button" className={quietButton} onClick={() => duplicate(section)}><Copy className="size-4" /> Duplicate</button>
          <button type="button" className={`${quietButton} hover:!text-rose-600`} onClick={() => remove(section)}><Trash2 className="size-4" /> Delete</button>
        </div>
      </div>
      {pageMode && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200/70 dark:bg-neutral-800/50 dark:ring-neutral-700">
          <div className="min-w-[12rem] flex-1">
            <label className={labelClass} htmlFor="ed-on-page">On page</label>
            <select id="ed-on-page" className={selectClass} value={pageOf(section.id)?.id || ""}
              onChange={(e) => setSections(moveToPage(draft.sections, section.id, e.target.value))}>
              {pages.map((p) => <option key={p.id} value={p.id}>{p.label}: {p.title}</option>)}
            </select>
          </div>
          {pageOf(section.id)?.id !== section.id && (
            <button type="button" className={quietButton} onClick={() => pageOp(splitAt(draft.sections, section.id), `page:${section.id}`)}><Scissors className="size-4" /> Start a new page here</button>
          )}
        </div>
      )}
      <SectionEditor key={section.id} section={section} sections={draft.sections} change={changeSection} />
    </div>
  ));

  const settings = work.settings;
  const preview = paper ? (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
      <PrintableWorksheet work={{ ...work, name: draft.name, definition, answers: tried }} label={`Step ${draft.step}`} />
    </div>
  ) : shownPage ? (
    <PagePreview page={shownPage} pages={pages} picked={picked} setPicked={setPicked} answers={tried}
      setAnswer={(sid, v) => setTried((t) => ({ ...t, [sid]: v }))} definition={definition} settings={settings} previewRef={previewRef} />
  ) : (
    <div ref={previewRef} className="space-y-6">
      {pageMode && pages[0] && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-neutral-200/70 dark:bg-neutral-800/50 dark:text-neutral-400 dark:ring-neutral-700">
          <span>The welcome page. Then {pages[0].of === 1 ? "1 page" : `${pages[0].of} pages`} and a look over everything.</span>
          <button type="button" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap !bg-transparent p-0 font-semibold !text-accent dark:!text-accent-light" onClick={() => setPicked(`page:${pages[0].id}`)}>{pages[0].label} <ChevronRight className="size-3.5" /></button>
        </div>
      )}
      <header className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-accent">Step {draft.step}</div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{draft.name || "Untitled"}</h2>
        <Prose text={draft.intro?.replaceAll("{{higher_power}}", settings?.higher_power || "God")} className="text-sm text-slate-600 dark:text-neutral-400" />
        {draft.credit && <p className="text-xs text-slate-500">{draft.credit}</p>}
      </header>
      {!pageMode && partsOf(definition).map((p, n) => (
        <div key={n} className="space-y-6">
          {p.part && <h3 className="border-b border-neutral-200 pb-2 text-lg font-semibold text-slate-900 dark:border-neutral-800 dark:text-white">{p.part}</h3>}
          {p.sections.map((s) => (
            <div key={s.id} data-section={s.id} role="button" tabIndex={-1} onClick={() => setPicked(s.id)} onKeyDown={() => {}}
              className={`-m-2 cursor-pointer rounded-2xl p-2 transition ${picked === s.id ? "ring-2 ring-accent/60" : "hover:ring-1 hover:ring-neutral-300 dark:hover:ring-neutral-700"}`}>
              <StepSection section={s} answers={tried} setAnswer={(sid, v) => setTried((t) => ({ ...t, [sid]: v }))} definition={definition} settings={settings} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-[96rem] space-y-4 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <div className="sticky top-[var(--nav-h)] z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-neutral-200/70 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <button type="button" onClick={leave} className="inline-flex items-center gap-1 !bg-transparent p-0 text-sm text-accent"><ChevronLeft className="size-4" /> Worksheet</button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent"><PencilRuler className="size-3.5" /> HumbleBot Editor</div>
          <div className="truncate font-semibold text-slate-900 dark:text-white">{draft.name || "Untitled"}</div>
        </div>
        <span role="status" className="hidden text-sm text-slate-500 sm:inline">{dirty ? "Not saved yet" : <span className="inline-flex items-center gap-1"><Check className="size-4" /> Saved</span>}</span>
        <button type="button" className={quietButton} disabled={busy || !dirty} onClick={() => save(false)}>Save</button>
        <button type="button" className={primaryButton} disabled={busy} onClick={() => (dirty ? save(true) : navigate(`/steps/${id}`))}>{busy ? "Saving…" : dirty ? "Save and close" : "Done"}</button>
      </div>
      <ErrorNote error={error} />
      <p className="text-sm text-slate-600 dark:text-neutral-400">
        Change anything: the name, the introduction, every section and question, or build it from nothing. Only your copy changes, and what you've written stays with each section.
      </p>

      <div role="group" aria-label="Show" className="inline-flex overflow-hidden rounded-xl text-sm ring-1 ring-neutral-200 lg:hidden dark:ring-neutral-700">
        {[["edit", "Edit", PencilRuler], ["preview", "Preview", Eye]].map(([k, label, Icon]) => (
          <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 font-semibold ${view === k ? "!bg-accent !text-white" : "!bg-white text-slate-700 dark:!bg-neutral-900 dark:text-neutral-200"}`}><Icon className="size-4" /> {label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className={`${view === "edit" ? "" : "hidden"} lg:sticky lg:top-[calc(var(--nav-h)+4.5rem)] lg:block lg:max-h-[calc(100dvh-var(--nav-h)-5.5rem)] lg:overflow-y-auto`}>
          <Card className="p-2">{outline}</Card>
        </div>
        <div className={`${view === "edit" ? "" : "hidden"} min-w-0 lg:block`}>
          <Card className="p-4">{editor}</Card>
        </div>
        <div className={`${view === "preview" ? "" : "hidden"} lg:sticky lg:top-[calc(var(--nav-h)+4.5rem)] lg:block lg:max-h-[calc(100dvh-var(--nav-h)-5.5rem)] lg:overflow-y-auto`}>
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview · typing here isn't saved</span>
              <div role="group" aria-label="Preview as" className="inline-flex overflow-hidden rounded-lg text-xs ring-1 ring-neutral-200 dark:ring-neutral-700">
                {[[false, "On screen", Eye], [true, "On paper", Printer]].map(([k, label, Icon]) => (
                  <button key={label} type="button" aria-pressed={paper === k} onClick={() => setPaper(k)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 font-semibold ${paper === k ? "!bg-accent !text-white" : "!bg-white text-slate-700 dark:!bg-neutral-900 dark:text-neutral-200"}`}><Icon className="size-3.5" /> {label}</button>
                ))}
              </div>
            </div>
            {preview}
          </Card>
        </div>
      </div>

      {adding && <AddSection onAdd={add} onClose={() => setAdding(false)} />}
    </div>
  );
}

function OutlineButton({ on, onClick, icon: Icon, title, sub, warn }) {
  return (
    <button type="button" aria-current={on ? "true" : undefined} onClick={onClick}
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left ${on ? "!bg-accent/10 dark:!bg-accent/25" : "!bg-transparent hover:!bg-neutral-100 dark:hover:!bg-neutral-800"}`}>
      <Icon className={`size-4 shrink-0 ${on ? "text-accent dark:text-white" : "text-slate-400"}`} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{title}</span>
        <span className={`block truncate text-xs ${warn ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-neutral-400"}`}>{sub}</span>
      </span>
    </button>
  );
}

// Pick the kind of section to add
function AddSection({ onAdd, onClose }) {
  return (
    <div className="fixed inset-0 z-[2600] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Add a section"
        className="max-h-[90dvh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm shadow-2xl ring-1 ring-neutral-200 sm:rounded-2xl dark:bg-neutral-900 dark:ring-neutral-700">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-slate-900 dark:text-white">Add a section</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"><X className="size-4" /></button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(KINDS).map(([kind, k]) => (
            <button key={kind} type="button" onClick={() => onAdd(kind)}
              className="flex items-start gap-3 rounded-2xl !bg-neutral-50 p-3 text-left ring-1 ring-neutral-200/70 hover:!bg-accent/5 hover:ring-accent/40 dark:!bg-neutral-800/60 dark:ring-neutral-700">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent dark:bg-accent/25 dark:text-white"><k.icon className="size-5" /></span>
              <span><span className="block font-semibold text-slate-900 dark:text-white">{k.name}</span><span className="block text-xs text-slate-600 dark:text-neutral-400">{k.about}</span></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Segmented({ label, labelledBy, value, onChange, options, small }) {
  return (
    <div role="group" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} className={`inline-flex overflow-hidden ${small ? "rounded-lg text-xs" : "rounded-xl text-sm"} ring-1 ring-neutral-200 dark:ring-neutral-700`}>
      {options.map(([k, text, Icon]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}
          className={`inline-flex items-center gap-1.5 ${small ? "px-2.5 py-1" : "px-3 py-1.5"} font-semibold ${value === k ? "!bg-accent !text-white" : "!bg-white text-slate-700 dark:!bg-neutral-900 dark:text-neutral-200"}`}>
          {Icon && <Icon className={small ? "size-3.5" : "size-4"} />} {text}
        </button>
      ))}
    </div>
  );
}

// A page picked in the outline: its title, the line under it, and what's on it, with a place to
// split it between any two sections and a way to join it to the page above
function PageEditor({ page, pages, setTitle, setLine, split, merge, move, pick, addHere }) {
  const first = page.number === 1;
  const startsPart = page.sections[0]?.part && pages[page.number - 2]?.part !== page.sections[0].part;
  const head = page.sections[0];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent"><StickyNote className="size-4" /> {page.label}{page.welcome ? "" : ` of ${page.of}`}</span>
        <button type="button" className={quietButton} disabled={first || !!startsPart} onClick={merge}
          title={startsPart ? "A new part always starts a page" : undefined}><Merge className="size-4" /> Join with the page above</button>
      </div>
      {page.part && <p className="text-xs text-slate-500 dark:text-neutral-400">In {page.part}</p>}
      {page.welcome && <p className="rounded-xl bg-accent/5 p-3 text-sm text-slate-700 ring-1 ring-accent/20 dark:bg-accent/15 dark:text-neutral-300">Only readings are on this page, so they show on the welcome page, with a reminder on the page after. Add a section to make it a page of its own.</p>}
      <div>
        <label className={labelClass} htmlFor="pg-title">Page title</label>
        <input id="pg-title" className={inputClass} maxLength={200} value={head.page !== undefined ? head.page.trimStart() : page.title}
          placeholder={head.title || "Page title"} onChange={(e) => setTitle(e.target.value)} />
        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Shows at the top of the page, in the list of pages and on the welcome page. When it's the same as the first section's title, it shows once.</p>
      </div>
      <div>
        <label className={labelClass} htmlFor="pg-line">A line under the title (optional)</label>
        <textarea id="pg-line" className={`${area} min-h-[3.5rem]`} maxLength={300} value={head.page_line || ""}
          placeholder="Take your time with this one." onChange={(e) => setLine(e.target.value)} />
      </div>
      <div>
        <div className={labelClass}>On this page</div>
        <ol className="space-y-1">
          {page.sections.map((s, i) => (
            <li key={s.id}>
              {i > 0 && (
                <div className="group/split relative flex items-center py-0.5">
                  <span className="h-px flex-1 border-t border-dashed border-neutral-300 opacity-0 group-hover/split:opacity-100 group-focus-within/split:opacity-100 dark:border-neutral-600" />
                  <button type="button" onClick={() => split(s.id)} className="mx-1 inline-flex items-center gap-1 rounded-lg !bg-transparent px-2 py-0.5 text-xs font-medium text-slate-500 hover:!bg-accent/10 hover:text-accent dark:text-neutral-400">
                    <Scissors className="size-3.5" /> Split here
                  </button>
                  <span className="h-px flex-1 border-t border-dashed border-neutral-300 opacity-0 group-hover/split:opacity-100 group-focus-within/split:opacity-100 dark:border-neutral-600" />
                </div>
              )}
              <div className="flex items-center gap-1 rounded-xl bg-neutral-50 px-2 py-1 ring-1 ring-neutral-200/70 dark:bg-neutral-800/50 dark:ring-neutral-700">
                {React.createElement(KINDS[s.kind]?.icon || FileText, { className: "size-4 shrink-0 text-slate-400" })}
                <button type="button" onClick={() => pick(s.id)} className="min-w-0 flex-1 truncate !bg-transparent p-1 text-left text-sm font-medium text-slate-900 hover:underline dark:text-white">
                  {s.title || s.body?.slice(0, 50) || KINDS[s.kind]?.name}
                </button>
                <button type="button" aria-label={`Move ${s.title || "this section"} up`} disabled={i === 0} onClick={() => move(s.id, -1)} className={iconButton}><ArrowUp className="size-4" /></button>
                <button type="button" aria-label={`Move ${s.title || "this section"} down`} disabled={i === page.sections.length - 1} onClick={() => move(s.id, 1)} className={iconButton}><ArrowDown className="size-4" /></button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className={`${quietButton} mt-2`} onClick={addHere}><Plus className="size-4" /> Add a section to this page</button>
      </div>
    </div>
  );
}

// The preview, a page at a time: the page as it shows (title, line, sections) and Back / Next
function PagePreview({ page, pages, picked, setPicked, answers, setAnswer, definition, settings, previewRef }) {
  const answerable = page.sections.find((s) => !["reference", "note"].includes(s.kind)) || page.sections[0];
  const prev = pages[page.number - 2];
  const next = pages[page.number];
  return (
    <div ref={previewRef} className="space-y-6">
      <div className="flex items-center justify-between gap-2 text-xs">
        <button type="button" onClick={() => setPicked(prev ? `page:${prev.id}` : "worksheet")} className="inline-flex items-center gap-1 !bg-transparent p-0 font-semibold !text-accent dark:!text-accent-light"><ChevronLeft className="size-3.5" /> {prev ? "Back" : "Welcome"}</button>
        <span className="font-semibold text-slate-500 dark:text-neutral-400">{page.label}{page.welcome ? "" : ` of ${page.of}`}</span>
        <button type="button" disabled={!next} onClick={() => next && setPicked(`page:${next.id}`)} className="inline-flex items-center gap-1 !bg-transparent p-0 font-semibold !text-accent disabled:opacity-30 dark:!text-accent-light">Next <ChevronRight className="size-3.5" /></button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"><div className="h-full rounded-full bg-accent" style={{ width: `${(page.number / pages.length) * 100}%` }} /></div>
      <div className="space-y-6">
        {page.part && <div className="text-sm font-semibold uppercase tracking-wide text-accent">{page.part}</div>}
        {(page.title !== answerable?.title || page.line) && (
          <div className="space-y-1">
            {page.title !== answerable?.title && <h2 className="!m-0 !text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{page.title}</h2>}
            {page.line && <p className="!m-0 text-slate-600 dark:text-neutral-400">{page.line}</p>}
          </div>
        )}
        {page.sections.map((s) => (
          <div key={s.id} data-section={s.id} role="button" tabIndex={-1} onClick={() => setPicked(s.id)} onKeyDown={() => {}}
            className={`-m-2 cursor-pointer rounded-2xl p-2 transition ${picked === s.id ? "ring-2 ring-accent/60" : "hover:ring-1 hover:ring-neutral-300 dark:hover:ring-neutral-700"}`}>
            <StepSection section={s} answers={answers} setAnswer={setAnswer} definition={definition} settings={settings} />
          </div>
        ))}
      </div>
    </div>
  );
}
