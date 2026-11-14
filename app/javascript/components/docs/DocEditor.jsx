import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import {
  ArrowLeft, Bold, Check, Code, Eye, FileCode2, History, ImagePlus, Italic, Link2, Loader2, PenLine, RotateCcw, SlidersHorizontal, Strikethrough, Trash2, X,
} from "lucide-react";
import Sheet from "../shell/Sheet";
import IconPicker from "../ui/IconPicker";
import Toggle from "../ui/Toggle";
import { Bone, SkeletonGroup, SkeletonText } from "../ui/Skeleton";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { api } from "../groups/lib";
import { useDocs } from "./DocsApp";
import { NotFound } from "./DocsSectionPage";
import { docExtensions, editorMarkdown } from "./editorExtensions";
import SlashMenu, { matchCommands } from "./SlashMenu";
import { renderDoc } from "./docMarkdown";
import DocVideoUpload from "./DocVideoUpload";
import { NewsCover } from "./DocsNews";

const SAVE_AFTER = 1200; // ms after the last keystroke
// A ```video block's JSON the way people write it by hand: one chapter per line
const videoBlock = ({ chapters, ...rest }) => {
  const lines = Object.entries(rest).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  if (chapters?.length) lines.push(`  "chapters": [\n${chapters.map((c) => `    { "start": ${JSON.stringify(c.start)}, "title": ${JSON.stringify(c.title)} }`).join(",\n")}\n  ]`);
  return `{\n${lines.join(",\n")}\n}`;
};
const isVideo = (f) => /^video\//.test(f.type) || /\.(mp4|webm|mov|m4v)$/i.test(f.name);

const when = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// The docs editor (/docs/:section/:page/edit, site admins): a title, a summary and one big
// Notion-style writing surface that saves Markdown by itself about a second after you stop.
// "/" opens the insert menu, selecting text brings up a formatting bubble, and the Markdown tab
// shows the same text as raw Markdown. Page settings, Reviewed and History sit in a column on
// the right on wide screens, or in a sheet behind the settings button.
export default function DocEditor() {
  const params = useParams();
  const { editor: canEdit } = useDocs();
  const [doc, setDoc] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setDoc(null);
    api(`/docs/page?section=${encodeURIComponent(params.section)}&page=${encodeURIComponent(params.page)}`)
      .then((d) => setDoc(d.page))
      .catch(() => setMissing(true));
  }, [params.section, params.page]);

  if (canEdit === false) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-600 dark:text-neutral-300">Only site admins can edit the docs.</div>;
  }
  if (missing) return <div className="mx-auto max-w-3xl px-4 py-10"><NotFound /></div>;
  if (!doc?.id) {
    return (
      <SkeletonGroup className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Bone className="h-10 w-2/3" /><Bone className="h-5 w-1/2" /><SkeletonText lines={10} className="pt-6" />
      </SkeletonGroup>
    );
  }
  return <Editor key={doc.id} initial={doc} />;
}

function Editor({ initial }) {
  const { sections, reload } = useDocs();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary || "");
  const [mode, setMode] = useState("visual");
  const [source, setSource] = useState(initial.body);
  const [state, setState] = useState("saved"); // saved | waiting | saving | error
  const [error, setError] = useState(null);
  const [slash, setSlash] = useState(null); // { query, from, to, coords }
  const [settingsOpen, setSettingsOpen] = useState(false); // the settings sheet, below wide screens
  const pending = useRef({});
  const timer = useRef(null);
  const menu = useRef(null);
  const fileInput = useRef(null);
  const slashRef = useRef(null);
  slashRef.current = slash;
  const [video, setVideo] = useState(null); // the Add a video window: { file, pos }
  const [videoBusy, setVideoBusy] = useState(false); // a video is uploading
  const videoBusyRef = useRef(false);
  videoBusyRef.current = videoBusy;

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const fields = pending.current;
    pending.current = {};
    if (!Object.keys(fields).length) return Promise.resolve();
    setState("saving");
    return api(`/docs/pages/${initial.id}`, { method: "PATCH", body: { page: fields } })
      .then((d) => {
        setDoc(d.page);
        setError(null);
        setState(Object.keys(pending.current).length ? "waiting" : "saved");
        return d.page;
      })
      .catch((e) => { pending.current = { ...fields, ...pending.current }; setError(e.message); setState("error"); });
  }, [initial.id]);

  const queue = useCallback((fields) => {
    pending.current = { ...pending.current, ...fields };
    setState("waiting");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_AFTER);
  }, [flush]);

  // Leaving with words not saved yet: save them on the way out, and ask first
  useEffect(() => {
    const warn = (e) => {
      if (videoBusyRef.current) { e.preventDefault(); e.returnValue = ""; return; }
      if (!Object.keys(pending.current).length) return;
      flush();
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); flush(); };
  }, [flush]);

  // A video still uploading: moving to another page in the app asks first (and leaving cancels it)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => videoBusy && currentLocation.pathname !== nextLocation.pathname);

  const openVideo = useCallback((file = null) => {
    const ed = editorRef.current;
    setVideo({ file, pos: ed ? ed.state.selection.from : null });
  }, []);
  const addVideo = (block) => {
    const ed = editorRef.current;
    const at = video?.pos;
    setVideo(null);
    if (!ed) return;
    const node = { type: "codeBlock", attrs: { language: "video" }, content: [{ type: "text", text: videoBlock(block) }] };
    const chain = ed.chain().focus();
    (at != null && at <= ed.state.doc.content.size ? chain.insertContentAt(at, node) : chain.insertContent(node)).run();
  };

  const upload = useCallback((file, editor) => {
    if (!file?.type?.startsWith("image/")) return;
    const form = new FormData();
    form.append("image", file);
    setState("saving");
    api(`/docs/pages/${initial.id}/images`, { method: "POST", form })
      .then((d) => { editor.chain().focus().setImage({ src: d.url, alt: file.name.replace(/\.[a-z0-9]+$/i, "") }).run(); setState("waiting"); })
      .catch((e) => { setError(e.message); setState("error"); });
  }, [initial.id]);

  const editorRef = useRef(null);
  const editor = useEditor({
    extensions: useMemo(() => docExtensions({ placeholder: "Write, or type '/' for headings, lists, tips and pictures…" }), []),
    content: initial.body,
    editorProps: {
      attributes: { class: "doc-body prose prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-10 prose-h2:text-2xl prose-h3:text-lg prose-a:text-accent prose-li:my-1 [&_p]:!text-left [&_li]:!text-left" },
      handleKeyDown: (view, event) => {
        if (!slashRef.current) return false;
        if (event.key === "Escape") { setSlash(null); return true; }
        return menu.current?.onKey(event) || false;
      },
      handlePaste: (view, event) => {
        const files = [...(event.clipboardData?.files || [])];
        const clip = files.find(isVideo);
        if (clip) { openVideo(clip); return true; }
        const file = files.find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        upload(file, editorRef.current);
        return true;
      },
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer?.files || [])];
        const clip = files.find(isVideo);
        if (clip) { event.preventDefault(); openVideo(clip); return true; }
        const file = files.find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        upload(file, editorRef.current);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      queue({ body: editorMarkdown(ed) });
      findSlash(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => findSlash(ed),
    onBlur: () => setTimeout(() => setSlash(null), 150),
  });
  editorRef.current = editor;

  // "/" typed at the start of a line or after a space, and the words after it
  function findSlash(ed) {
    const { selection } = ed.state;
    if (!selection.empty) { setSlash(null); return; }
    const { $from } = selection;
    if ($from.parent.type.name === "codeBlock") { setSlash(null); return; }
    const before = $from.parent.textBetween(0, $from.parentOffset, null, "￼");
    const m = before.match(/(?:^|\s)\/([\w ]{0,20})$/);
    if (!m || m[1].startsWith(" ")) { setSlash(null); return; }
    const coords = ed.view.coordsAtPos($from.pos);
    setSlash({ query: m[1], from: $from.pos - m[1].length - 1, to: $from.pos, coords });
  }

  const pick = useCallback((command) => {
    const s = slashRef.current;
    if (!editor || !s) return;
    setSlash(null);
    const chain = editor.chain().focus().deleteRange({ from: s.from, to: s.to });
    if (command.picture) { chain.run(); fileInput.current?.click(); return; }
    if (command.video) { chain.run(); openVideo(); return; }
    command.run(chain).run();
  }, [editor]);

  const switchMode = (next) => {
    if (next === mode || !editor) return;
    if (next === "markdown") setSource(editorMarkdown(editor));
    else editor.commands.setContent(source);
    setMode(next);
  };

  const setLink = () => {
    const was = editor.getAttributes("link").href || "";
    const url = window.prompt("Link to (a page like /recovery, or https://…)", was);
    if (url === null) return;
    if (!url.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  // Settings save right away; a new address or section moves the editor there
  const saveSetting = (fields) => {
    pending.current = { ...pending.current, ...fields };
    flush().then((page) => {
      if (!page) return;
      reload();
      if (page.docs_path !== `/docs/${initial.section.slug}/${initial.slug}` && (fields.slug || fields.doc_section_id)) navigate(`${page.docs_path}/edit`, { replace: true });
    });
  };

  const remove = () => {
    if (!window.confirm(`Delete “${doc.title}”? Its history goes with it.`)) return;
    api(`/docs/pages/${doc.id}`, { method: "DELETE" }).then(() => reload().then(() => navigate(doc.section.path)));
  };

  const view = () => flush().then(() => navigate(doc.path));
  const slashItems = slash ? matchCommands(slash.query) : [];

  const settings = (
    <Settings doc={doc} sections={sections || []} onSave={saveSetting} onRemove={remove} onRestored={(page) => { setDoc(page); setTitle(page.title); setSource(page.body); editor?.commands.setContent(page.body); }} />
  );

  return (
    <div className="flex">
      <div className="mx-auto min-w-0 max-w-3xl flex-1 px-4 pb-24 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:pt-8">
        <div className="sticky top-0 z-20 -mx-4 mb-6 flex items-center gap-2 bg-white/90 px-4 py-2.5 backdrop-blur dark:bg-neutral-950/90 sm:-mx-6 sm:px-6">
          <button type="button" onClick={view} aria-label="Back to the page" title="Back to the page" className="grid size-9 place-items-center rounded-full !bg-neutral-100 !p-0 !text-slate-700 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:!text-neutral-200">
            <ArrowLeft size={17} />
          </button>
          <div className="inline-flex rounded-full bg-neutral-100 p-1 text-sm dark:bg-neutral-800" role="tablist" aria-label="Editor">
            {[["visual", "Write", PenLine], ["markdown", "Markdown", FileCode2]].map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => switchMode(key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${mode === key ? "!bg-white !text-slate-900 shadow-sm dark:!bg-neutral-950 dark:!text-white" : "!bg-transparent !text-slate-500 dark:!text-neutral-400"}`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <SaveState state={state} error={error} onRetry={flush} />
          <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Page settings" title="Page settings" className="ml-auto grid size-9 place-items-center rounded-full !bg-neutral-100 !p-0 !text-slate-700 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:!text-neutral-200 xl:hidden">
            <SlidersHorizontal size={16} />
          </button>
          <button type="button" onClick={view} className="inline-flex xl:ml-auto items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold !bg-accent !text-white hover:opacity-90">
            <Eye size={15} /> View page
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); queue({ title: e.target.value }); }}
          placeholder="Page title"
          aria-label="Title"
          className="w-full border-0 bg-transparent p-0 text-3xl font-bold tracking-tight text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-0 dark:text-white sm:text-4xl"
        />
        <input
          value={summary}
          onChange={(e) => { setSummary(e.target.value); queue({ summary: e.target.value }); }}
          placeholder="One line about what this page helps with"
          aria-label="Summary"
          className="mt-2 w-full border-0 bg-transparent p-0 text-lg text-slate-600 placeholder-slate-300 focus:outline-none focus:ring-0 dark:text-neutral-400"
        />
        <hr className="my-6 border-neutral-200 dark:border-neutral-800" />

        <div className="doc-editor" hidden={mode !== "visual"}>
          {editor && (
            <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }} shouldShow={({ editor: ed, state: s }) => !s.selection.empty && !ed.isActive("image") && !ed.isActive("codeBlock")}>
              <div className="flex items-center gap-0.5 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                {[
                  ["bold", "Bold", Bold, () => editor.chain().focus().toggleBold().run()],
                  ["italic", "Italic", Italic, () => editor.chain().focus().toggleItalic().run()],
                  ["strike", "Strikethrough", Strikethrough, () => editor.chain().focus().toggleStrike().run()],
                  ["code", "Code", Code, () => editor.chain().focus().toggleCode().run()],
                  ["link", "Link", Link2, setLink],
                ].map(([name, label, Icon, run]) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={label}
                    title={label}
                    aria-pressed={editor.isActive(name)}
                    onClick={run}
                    className={`grid size-8 place-items-center rounded-lg !p-0 ${editor.isActive(name) ? "!bg-accent-tint !text-accent dark:!bg-accent/25 dark:!text-white" : "!bg-transparent !text-slate-600 hover:!bg-neutral-100 dark:!text-neutral-300 dark:hover:!bg-neutral-800"}`}
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            </BubbleMenu>
          )}
          <EditorContent editor={editor} />
          {slash && <SlashMenu ref={menu} items={slashItems} coords={slash.coords} onPick={pick} />}
        </div>

        {mode === "markdown" && (
          <textarea
            value={source}
            onChange={(e) => { setSource(e.target.value); queue({ body: e.target.value }); }}
            spellCheck
            aria-label="Markdown"
            className="min-h-[60vh] w-full resize-y rounded-2xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm leading-relaxed text-slate-800 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          />
        )}

        <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0], editor); e.target.value = ""; }} />

        {video && (
          <DocVideoUpload pageId={initial.id} initialFile={video.file} onBusy={setVideoBusy} onDone={addVideo} onClose={() => setVideo(null)} />
        )}
        {blocker.state === "blocked" && <LeaveWhileUploading onStay={() => blocker.reset()} onLeave={() => blocker.proceed()} />}

      </div>
      <aside className="hidden w-80 shrink-0 border-l border-neutral-200 dark:border-neutral-800 xl:block">
        <div className="sticky top-0 max-h-dvh overflow-y-auto p-5">
          <p className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Page settings</p>
          {settings}
        </div>
      </aside>
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} side="right" label="Page settings" className="!rounded-none !bg-white dark:!bg-neutral-900">
        <div className="h-full overflow-y-auto p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <p className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Page settings</p>
          {settings}
        </div>
      </Sheet>
      </div>
    );
  }

  function SaveState({ state, error, onRetry }) {
    if (state === "error") {
      return (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold !bg-rose-50 !text-rose-700 dark:!bg-rose-500/10 dark:!text-rose-300" title={error}>
          Not saved: try again
        </button>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-neutral-400" aria-live="polite">
        {state === "saved" ? <><Check size={13} /> Saved</> : <><Loader2 size={13} className="animate-spin" /> Saving…</>}
      </span>
    );
  }

  function Settings({ doc, sections, onSave, onRemove, onRestored }) {
    const [slug, setSlug] = useState(doc.slug);
    const [position, setPosition] = useState(doc.position);
    useEffect(() => { setSlug(doc.slug); setPosition(doc.position); }, [doc.slug, doc.position]);
    const news = doc.section.kind === "news"; // posts go by date, so no Order or Reviewed

    return (
      <div className="space-y-5 !font-sans text-sm">
        {!news && (
        <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-500/10">
          <Toggle checked={doc.reviewed} onChange={(on) => onSave({ reviewed: on })} label="Reviewed" description={doc.reviewed ? `By ${doc.reviewed_by || "an admin"}, ${when(doc.reviewed_at)}` : "Tick once you've read the draft text through."} />
        </div>
        )}
        <label className="block">
          <span className={labelClass}>Status</span>
          <select className={selectClass} value={doc.status} onChange={(e) => onSave({ status: e.target.value })}>
            <option value="published">Published</option>
            <option value="draft">Draft (only site admins see it)</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Who can read it</span>
          <select className={selectClass} value={doc.audience} onChange={(e) => onSave({ audience: e.target.value })}>
            <option value="everyone">Everyone, no account needed</option>
            <option value="members">Members (signed in)</option>
            <option value="admins">Site admins</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Section</span>
          <select className={selectClass} value={doc.doc_section_id} onChange={(e) => onSave({ doc_section_id: Number(e.target.value) })}>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
        <div className={`grid gap-3 ${news ? "" : "grid-cols-[1fr_5rem]"}`}>
          <label className="block">
            <span className={labelClass}>Address</span>
            <input className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} onBlur={() => slug !== doc.slug && onSave({ slug })} />
          </label>
          <label className={`block ${news ? "hidden" : ""}`}>
            <span className={labelClass}>Order</span>
            <input type="number" className={inputClass} value={position} onChange={(e) => setPosition(e.target.value)} onBlur={() => Number(position) !== doc.position && onSave({ position })} />
          </label>
        </div>
        {news && <NewsSettings doc={doc} onSave={onSave} />}
        {doc.path_alias && <p className="!m-0 text-xs text-slate-500 dark:text-neutral-400">Also at <Link to={`/${doc.path_alias}`}>/{doc.path_alias}</Link></p>}
        <IconPicker value={doc.icon} onChange={(icon) => onSave({ icon })} />
        <VersionHistory doc={doc} onRestored={onRestored} />
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold !bg-rose-50 !text-rose-700 hover:!bg-rose-100 dark:!bg-rose-500/10 dark:!text-rose-300">
          <Trash2 size={14} /> Delete page
        </button>
      </div>
    );
  }

  // A news post's own settings: Featured (leads the News block on the Docs home), what kind of
  // post it is, its date and its cover picture (uploaded here, so it stays on RecoveryBot)
  function NewsSettings({ doc, onSave }) {
    const [date, setDate] = useState(toDateInput(doc.published_at));
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const file = useRef(null);
    useEffect(() => { setDate(toDateInput(doc.published_at)); }, [doc.published_at]);

    const upload = (picked) => {
      if (!picked?.type?.startsWith("image/")) return;
      const form = new FormData();
      form.append("image", picked);
      setUploading(true);
      setError(null);
      api(`/docs/pages/${doc.id}/images`, { method: "POST", form })
        .then((d) => onSave({ cover_image: d.url }))
        .catch((e) => setError(e.message))
        .finally(() => setUploading(false));
    };
    const saveDate = () => {
      if (date === toDateInput(doc.published_at)) return;
      // noon local time, so the day doesn't slip in other time zones
      onSave({ published_at: date ? new Date(`${date}T12:00:00`).toISOString() : "" });
    };

    return (
      <div className="space-y-4 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="!m-0 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">News post</p>
        <Toggle checked={doc.featured} onChange={(on) => onSave({ featured: on })} label="Featured" description="Kept at the front of News on the Docs home, ahead of newer posts." />
        <label className="block">
          <span className={labelClass}>Kind</span>
          <select className={selectClass} value={doc.news_kind || "news"} onChange={(e) => onSave({ news_kind: e.target.value })}>
            <option value="blog">Blog</option>
            <option value="news">Site news</option>
            <option value="update">Update</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Date</span>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} onBlur={saveDate} />
          {!doc.published_at && <span className="mt-1 block text-xs text-slate-500 dark:text-neutral-400">Set to today when you publish it.</span>}
        </label>
        <div>
          <p className={labelClass}>Cover picture</p>
          <NewsCover post={doc} className="aspect-[16/9] w-full rounded-xl" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => file.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold !bg-neutral-100 !text-slate-700 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:!text-neutral-200">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} {doc.cover_image ? "Change" : "Add a picture"}
            </button>
            {doc.cover_image && (
              <button type="button" onClick={() => onSave({ cover_image: "" })} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold !bg-transparent !text-slate-500 hover:!text-rose-600 dark:!text-neutral-400">
                <X size={14} /> Remove
              </button>
            )}
          </div>
          {error && <p className="!m-0 mt-1 text-xs text-rose-600">{error}</p>}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </div>
    );
  }

  function toDateInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Earlier copies of the page (DocPageVersion): look at one, or put it back
  function VersionHistory({ doc, onRestored }) {
    const [versions, setVersions] = useState(null);
    const [viewing, setViewing] = useState(null);
    const load = () => api(`/docs/pages/${doc.id}/versions`).then((d) => setVersions(d.versions));
    const open = (v) => api(`/docs/pages/${doc.id}/versions/${v.id}`).then((d) => setViewing(d.version));
    const restore = (v) => {
      if (!window.confirm(`Put back the copy from ${when(v.created_at)}? The page as it is now stays in History.`)) return;
      api(`/docs/pages/${doc.id}/restore`, { method: "POST", body: { version_id: v.id } }).then((d) => { onRestored(d.page); setViewing(null); load(); });
    };

    return (
      <div>
        <p className={labelClass}>History</p>
        {!versions ? (
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold !bg-neutral-100 !text-slate-700 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:!text-neutral-200">
            <History size={14} /> Show earlier copies
          </button>
        ) : versions.length === 0 ? (
          <p className="!m-0 text-slate-500 dark:text-neutral-400">No earlier copies yet. Each editing session keeps the text it replaced.</p>
        ) : (
          <ul className="!m-0 list-none space-y-1 !p-0">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <button type="button" onClick={() => open(v)} className="min-w-0 flex-1 text-left !bg-transparent !p-0 !text-slate-700 dark:!text-neutral-200">
                  <span className="block font-medium">{when(v.created_at)}</span>
                  <span className="block text-xs text-slate-500 dark:text-neutral-400">{v.saved_by || "Imported draft"} · {v.words} words</span>
                </button>
                <button type="button" onClick={() => restore(v)} aria-label="Put this copy back" title="Put this copy back" className="grid size-7 place-items-center rounded-lg !bg-transparent !p-0 !text-slate-500 hover:!text-accent">
                  <RotateCcw size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {viewing && <VersionModal version={viewing} onClose={() => setViewing(null)} onRestore={() => restore(viewing)} />}
      </div>
    );
  }

  function VersionModal({ version, onClose, onRestore }) {
    const { html } = useMemo(() => renderDoc(version.body), [version]);
    useEffect(() => {
      const onKey = (e) => e.key === "Escape" && onClose();
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    return (
      <div role="dialog" aria-modal="true" aria-label="Earlier copy" className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4">
        <div className="flex max-h-[85dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-neutral-900">
          <div className="flex items-center gap-3 border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
            <div className="min-w-0 flex-1">
              <p className="!m-0 font-semibold text-slate-900 dark:text-white">{version.title}</p>
              <p className="!m-0 text-xs text-slate-500 dark:text-neutral-400">{when(version.created_at)} · {version.saved_by || "Imported draft"}</p>
            </div>
            <button type="button" onClick={onRestore} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold !bg-accent !text-white"><RotateCcw size={14} /> Put back</button>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full !bg-neutral-100 !p-0 !text-slate-600 dark:!bg-neutral-800 dark:!text-neutral-300"><X size={16} /></button>
          </div>
          {/* renderDoc has raw HTML off */}
          <div className="doc-body prose prose-slate max-w-none overflow-y-auto px-6 py-5 dark:prose-invert" dangerouslySetInnerHTML={{ __html: html }} /> {/* eslint-disable-line react/no-danger */}
        </div>
    </div>
  );
}

// Trying to leave the editor while a video is still uploading
function LeaveWhileUploading({ onStay, onLeave }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4" role="alertdialog" aria-modal="true" aria-label="A video is still uploading">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl dark:bg-neutral-900">
        <h2 className="!m-0 text-lg font-semibold text-slate-900 dark:text-white">A video is still uploading</h2>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-neutral-400">If you leave now, the upload stops and the video won't be added.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onLeave} className="rounded-full !bg-transparent px-4 py-2 text-sm font-semibold !text-red-600 hover:!bg-red-50 dark:!text-red-400 dark:hover:!bg-red-500/10">Leave anyway</button>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <button type="button" autoFocus onClick={onStay} className="rounded-full !bg-accent px-4 py-2 text-sm font-semibold !text-white hover:opacity-90">Stay</button>
        </div>
      </div>
    </div>
  );
}
