// app/javascript/components/ChapterEditor.jsx
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import Heading from '@tiptap/extension-heading';
import Blockquote from '@tiptap/extension-blockquote';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import CodeBlock from '@tiptap/extension-code-block';
import TableMenu from "./TableMenu";
import PageBreakModal from "./PageBreakModal";
import { updatePageBreakAt } from "../utils/pageBreak";
import axios from "axios";
import { ReaderBar, ChaptersDialog, ModeSwitch } from "./book/ReaderChrome";
import { SearchDialog, useSearchHotkey } from "./book/BookSearch";
import "../styles/writebook.css";

// ⚠️ Ensure these imports match your actual export style.
// If your files export default, switch to: `import PageBreak from '../tiptap/PageBreak'` etc.
import { PageBreak } from "../tiptap/PageBreak";
import { ParagraphWithPage } from "../tiptap/ParagraphWithPage";
import { FontSize } from "../tiptap/FontSize";
import { Indent } from "../tiptap/Indent";

import FloatingMenuExtension from "@tiptap/extension-floating-menu";

function forceBlockToParagraph(editor) {
  if (!editor) return;

  // Whatever defaults you want for a normal paragraph
  const defaultAttrs = { page: null, indent: 0, textAlign: 'left' };

  editor
    .chain()
    .focus()

    // Unwrap lists/code/blockquote and clear heading type
    // (clearNodes turns block nodes into paragraphs automatically)
    .clearNodes()

    // Ensure it's our paragraph node (your extension name is still 'paragraph')
    .setParagraph()

    // Normalize attrs on the paragraph node
    .updateAttributes('paragraph', defaultAttrs)

    // Optional: remove font size + text align marks so Typography sets rhythm
    .unsetFontSize?.()                // your custom mark
    .setTextAlign('left')             // or .unsetTextAlign() if you wrote one
    .run();
}
function BlockTypeSelect({ editor }) {
  if (!editor) return null;

  return (
    <select
      className="border border-slate-200 rounded-sm text-xs px-1 py-0.5 bg-white"
      value={
        editor.isActive('heading', { level: 1 }) ? 'h1' :
        editor.isActive('heading', { level: 2 }) ? 'h2' :
        editor.isActive('heading', { level: 3 }) ? 'h3' :
        editor.isActive('blockquote') ? 'blockquote' :
        editor.isActive('bulletList') ? 'bulletList' :
        editor.isActive('orderedList') ? 'orderedList' :
        editor.isActive('codeBlock') ? 'codeBlock' :
        'paragraph'
      }
      onChange={(e) => {
        const val = e.target.value;
        const chain = editor.chain().focus();

        switch (val) {
          case 'h1':
            chain.setHeading({ level: 1 }).run(); break;
          case 'h2':
            chain.setHeading({ level: 2 }).run(); break;
          case 'h3':
            chain.setHeading({ level: 3 }).run(); break;
          case 'blockquote':
            chain.setBlockquote().run(); break;
          case 'bulletList':
            chain.toggleBulletList().run(); break;
          case 'orderedList':
            chain.toggleOrderedList().run(); break;
          case 'codeBlock':
            chain.setCodeBlock().run(); break;
          default:
            chain.setParagraph().run();
        }
      }}
    >
      <option value="paragraph">Paragraph</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="blockquote">Blockquote</option>
      <option value="bulletList">Bullet List</option>
      <option value="orderedList">Numbered List</option>
      <option value="codeBlock">Code Block</option>
    </select>
  );
}

function BlockTagBadge({ editor, container }) {
  if (!editor) return null;

  // TipTap will position this element near the selection.
  return createPortal(
    <div className="pointer-events-auto" style={{ zIndex: 9999 }}>
      <div className="rounded-full border bg-white shadow px-2 py-1 text-xs flex items-center gap-2">
        <span className="opacity-70">
          {editor.isActive('heading', { level: 1 }) ? 'H1' :
           editor.isActive('heading', { level: 2 }) ? 'H2' :
           editor.isActive('heading', { level: 3 }) ? 'H3' :
           editor.isActive('blockquote') ? 'Quote' :
           editor.isActive('bulletList') ? '• List' :
           editor.isActive('orderedList') ? '1. List' :
           editor.isActive('codeBlock') ? 'Code' : 'Paragraph'}
        </span>
        <BlockTypeSelect editor={editor} />
      </div>
    </div>,
    container
  );
}

import {
  Bold, Italic, Heading2, Quote, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  IndentDecrease, IndentIncrease, Type, Pilcrow, RemoveFormatting,
  SquareSplitVertical, Undo2, Redo2, Check, Ellipsis,
} from "lucide-react";

export default function ChapterEditor({ bookSlug, slug }) {
  const [chapter, setChapter] = useState(null);
  const [title, setTitle] = useState("");
  const [chapterSlug, setChapterSlug] = useState("");
  // Create a real element up front and keep it for the editor's lifetime
  const floatingEl = useMemo(() => {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.zIndex = '9999';
    document.body.appendChild(el);
    return el;
  }, []);
  useEffect(() => () => { floatingEl.remove(); }, [floatingEl]);


  function findFirstPageBreakPos(editor) {
  let found = null;
  editor.state.doc.descendants((node, pos) => {
    if (!found && node.type?.name === "pageBreak") {
      found = pos;
      return false; // stop descending
    }
    return true;
  });
  return found;
}

function insertPageBreak(editor, initial = { kind: "default", title: "", page: null }) {
  if (!editor) return null;
  const at = editor.state.selection.from;

  // insert a pageBreak node
  editor.chain().focus().insertContent({ type: "pageBreak", attrs: initial }).run();

  // try to find a pageBreak near/after the current selection
  // (simple approach: first pageBreak in doc; good enough for single inserts)
  let pos = null;

  // narrow search around the selection if you want to be fancy:
  // scan a small window around 'at'
  const { doc } = editor.state;
  doc.nodesBetween(Math.max(0, at - 5), Math.min(doc.content.size, at + 5), (node, p) => {
    if (!pos && node.type?.name === "pageBreak") pos = p;
  });

  // fallback: first one in the doc
  if (pos == null) pos = findFirstPageBreakPos(editor);
  return pos;
}
  // Editor
  const editor = useEditor({
    editable: true,
    extensions: [
      StarterKit.configure({ paragraph: false }),   // we replace paragraph
      Heading.configure({ levels: [1,2,3,4,5,6] }),
      ParagraphWithPage,                             // your custom node
      PageBreak,                                     // your custom node
      TextStyle,
      FontSize,                                      // your custom mark
      Blockquote,
      BulletList,
      OrderedList,
      ListItem,
      CodeBlock,
      FloatingMenuExtension.configure({
        element: floatingEl,
        shouldShow: ({ editor }) => editor.isFocused && !editor.state.selection.empty,
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Indent.configure({ types: ["paragraph"], step: 24, min: 0, max: 8 }),
      Table.configure({
        resizable: true,
        lastColumnResizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: null,
  });
  const [pbOpen, setPbOpen] = useState(false);
  const [pbPos, setPbPos] = useState(null);
  const [pbAttrs, setPbAttrs] = useState(null);

  const handleInsertBreak = (kind = "default") => {
  if (!editor) return;
  const pos = insertPageBreak(editor, { kind, title: "", page: null });
  if (pos != null) {
    const node = editor.state.doc.nodeAt(pos);
    setPbPos(pos);
    setPbAttrs(node?.attrs || { kind, title: "", page: null });
    setPbOpen(true); // open the modal so you can fix attrs immediately
  }
};

  // Click-to-edit for page breaks
  useEffect(() => {
    if (!editor) return;

    const onClick = (e) => {
      // only react to clicks on the badge/pill or its children
      const pill = e.target.closest(".page-break__pill");
      if (!pill) return;

      // find the wrapper node that matches your renderHTML tag
      const wrapper = pill.closest('[data-page-break]');
      if (!wrapper) return;

      // map DOM -> document position
      let pos;
      try {
        pos = editor.view.posAtDOM(wrapper, 0);
      } catch {
        return;
      }
      if (typeof pos !== "number") return;

      // read current attrs
      const node = editor.state.doc.nodeAt(pos);
      if (!node || node.type.name !== "pageBreak") return;

      setPbPos(pos);
      setPbAttrs(node.attrs);
      setPbOpen(true);
    };

    // Delegate on the editor root (or document)
    const root = editor.view.dom;
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [editor]);

  const handleSavePageBreak = (next) => {
    if (!editor || pbPos == null) return;
    updatePageBreakAt(editor, pbPos, next);
    setPbOpen(false);
  };

  // Load chapter
  useEffect(() => {
    if (!bookSlug || !slug) return;
    (async () => {
      const { data } = await axios.get(`/api/books/${bookSlug}/chapters/${slug}.json`);
      setChapter(data);
      setTitle(data.title || "");
      setChapterSlug(data.slug || "");

      // Accept either tiptap_json (preferred) or tiptap
      const doc = data.tiptap_json ?? data.tiptap ?? { type: "doc", content: [] };
      if (editor) {
        editor.commands.setContent(doc, false);
        loadedRef.current = true;
      }
    })().catch(err => console.error("Load chapter failed", err));
  }, [bookSlug, slug, editor]);

  // Track unsaved changes so the save button can show clean / dirty / saving.
  const [status, setStatus] = useState("clean");
  const loadedRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => { if (loadedRef.current) setStatus("dirty"); };
    editor.on("update", onUpdate);
    return () => editor.off("update", onUpdate);
  }, [editor]);

  const save = useCallback(async () => {
    if (!editor || !chapter || statusRef.current === "saving") return;
    setStatus("saving");
    try {
      await axios.patch(
        `/api/books/${bookSlug}/chapters/${chapter.slug}`,
        { chapter: { title, tiptap_json: editor.getJSON() } },
        { headers: { "Content-Type": "application/json" } }
      );
      setChapter((prev) => ({ ...(prev || {}), title }));
      // Anything typed while the request was in flight is still unsaved.
      setStatus((s) => (s === "saving" ? "clean" : s));
    } catch (e) {
      console.error("Save failed", e);
      setStatus("dirty");
      window.alert("Couldn't save this chapter. Check your connection and try again.");
    }
  }, [editor, chapter, bookSlug, title]);

  // Autosave a few seconds after the last change, like Writebook.
  useEffect(() => {
    if (status !== "dirty") return;
    const t = setTimeout(save, 3000);
    return () => clearTimeout(t);
  }, [status, save, title]);

  // Cmd/Ctrl+S saves now; leaving with unsaved changes asks first.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    };
    const onBeforeUnload = (e) => {
      if (statusRef.current !== "clean") { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [save]);

  // Slug changes move the chapter's URL, so they're saved on their own and reload the page.
  async function saveSlug() {
    if (!chapter || !chapterSlug || chapterSlug === chapter.slug) return;
    if (statusRef.current !== "clean") await save();
    await axios.patch(
      `/api/books/${bookSlug}/chapters/${chapter.slug}`,
      { chapter: { slug: chapterSlug } },
      { headers: { "Content-Type": "application/json" } }
    );
    window.location.replace(`/books/${bookSlug}/chapters/${chapterSlug}/edit`);
  }

  // Neighbors + book title for the header, chapter list and search
  const [chapters, setChapters] = useState([]);
  useEffect(() => {
    axios.get(`/api/books/${bookSlug}/chapters`)
      .then(({ data }) => setChapters(Array.isArray(data) ? [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)) : []))
      .catch(() => setChapters([]));
  }, [bookSlug]);
  const position = chapters.findIndex((c) => c.slug === slug);
  const prev = position > 0 ? chapters[position - 1] : null;
  const next = position >= 0 && position < chapters.length - 1 ? chapters[position + 1] : null;
  const bookTitle = chapters[0]?.book_title || "";

  const [openChapters, setOpenChapters] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [openMore, setOpenMore] = useState(false);
  useSearchHotkey(useCallback(() => setOpenSearch(true), []));

  useEffect(() => {
    if (chapter?.title) document.title = `Editing ${chapter.title}`;
  }, [chapter?.title]);

  if (!editor) return null;

  const isActive = (name, attrs) => editor.isActive(name, attrs);
  const Tool = ({ label, active, onClick, children }) => (
    <button
      type="button"
      className="wb-tool"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : !!active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
  const run = (fn) => () => fn(editor.chain().focus()).run();

  const saveLabel = status === "clean" ? "Saved" : status === "saving" ? "Saving…" : "Save (⌘S)";

  return (
    <div className="wb wb-reader wb-editor">
      <ReaderBar
        bookSlug={bookSlug}
        bookTitle={bookTitle}
        chapterTitle={title || chapter?.title}
        prev={prev}
        next={next}
        editing
        onOpenChapters={() => setOpenChapters(true)}
        onOpenSearch={() => setOpenSearch(true)}
      />

      <div className="wb-page-toolbar" role="toolbar" aria-label="Formatting">
        <ModeSwitch bookSlug={bookSlug} chapterSlug={slug} editing />
        <span className="wb-page-toolbar__sep" />

        <Tool label="Bold" active={isActive("bold")} onClick={run((c) => c.toggleBold())}><Bold size={18} /></Tool>
        <Tool label="Italic" active={isActive("italic")} onClick={run((c) => c.toggleItalic())}><Italic size={18} /></Tool>
        <Tool label="Heading" active={isActive("heading", { level: 2 })} onClick={run((c) => c.toggleHeading({ level: 2 }))}><Heading2 size={18} /></Tool>
        <Tool label="Quote" active={isActive("blockquote")} onClick={run((c) => c.toggleBlockquote())}><Quote size={18} /></Tool>
        <Tool label="Bulleted list" active={isActive("bulletList")} onClick={run((c) => c.toggleBulletList())}><List size={18} /></Tool>
        <Tool label="Numbered list" active={isActive("orderedList")} onClick={run((c) => c.toggleOrderedList())}><ListOrdered size={18} /></Tool>
        <Tool label="Insert page break" onClick={() => handleInsertBreak("default")}><SquareSplitVertical size={18} /></Tool>

        <span className="relative">
          <Tool label="More formatting" active={openMore} onClick={() => setOpenMore((v) => !v)}><Ellipsis size={18} /></Tool>
          {openMore && (
            <div className="wb-popover" onMouseDown={(e) => e.target.tagName !== "INPUT" && e.target.tagName !== "SELECT" && e.preventDefault()}>
              <label>Alignment</label>
              <div className="wb-popover__row">
                <Tool label="Align left" active={isActive({ textAlign: "left" })} onClick={run((c) => c.setTextAlign("left"))}><AlignLeft size={18} /></Tool>
                <Tool label="Align center" active={isActive({ textAlign: "center" })} onClick={run((c) => c.setTextAlign("center"))}><AlignCenter size={18} /></Tool>
                <Tool label="Align right" active={isActive({ textAlign: "right" })} onClick={run((c) => c.setTextAlign("right"))}><AlignRight size={18} /></Tool>
                <Tool label="Justify" active={isActive({ textAlign: "justify" })} onClick={run((c) => c.setTextAlign("justify"))}><AlignJustify size={18} /></Tool>
                <Tool label="Increase indent" onClick={run((c) => c.indent())}><IndentIncrease size={18} /></Tool>
                <Tool label="Decrease indent" onClick={run((c) => c.outdent())}><IndentDecrease size={18} /></Tool>
              </div>

              <label><Type size={12} className="inline mr-1" />Text size</label>
              <select
                defaultValue="default"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "default") editor.chain().focus().unsetFontSize().run();
                  else editor.chain().focus().setFontSize(val).run();
                }}
              >
                <option value="default">Default</option>
                <option value="12px">Small</option>
                <option value="16px">Normal</option>
                <option value="20px">Large</option>
                <option value="24px">X-Large</option>
              </select>

              <label>Block</label>
              <div className="wb-popover__row items-center">
                <Tool label="Convert to plain paragraph" onClick={() => forceBlockToParagraph(editor)}><Pilcrow size={18} /></Tool>
                <Tool label="Clear size and indent" onClick={run((c) => c.unsetIndent().unsetFontSize())}><RemoveFormatting size={18} /></Tool>
                <TableMenu editor={editor} />
              </div>

              <label htmlFor="chapter-slug">Address</label>
              <div className="flex gap-2">
                <input id="chapter-slug" value={chapterSlug} onChange={(e) => setChapterSlug(e.target.value)} placeholder="chapter-slug" />
                <button type="button" className="wb-btn" onClick={saveSlug} disabled={!chapterSlug || chapterSlug === chapter?.slug}>Move</button>
              </div>
            </div>
          )}
        </span>

        <span className="wb-page-toolbar__sep" />
        <Tool label="Undo" onClick={run((c) => c.undo())}><Undo2 size={18} /></Tool>
        <Tool label="Redo" onClick={run((c) => c.redo())}><Redo2 size={18} /></Tool>
        <button
          type="button"
          className={`wb-tool wb-save wb-save--${status}`}
          title={saveLabel}
          aria-label={saveLabel}
          onClick={save}
          disabled={status === "saving"}
        >
          <Check size={18} strokeWidth={3} />
        </button>
      </div>

      <article className="wb-reader__page">
        <label className="wb-editor__title-label" htmlFor="chapter-title">Title in the contents</label>
        <input
          id="chapter-title"
          className="wb-editor__title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); if (loadedRef.current) setStatus("dirty"); }}
          placeholder="Chapter title"
        />
        <EditorContent
          editor={editor}
          className="prose hb-reader prose-slate prose-base md:prose-lg dark:prose-invert max-w-none"
        />
      </article>

      <BlockTagBadge editor={editor} container={floatingEl} />
      <PageBreakModal
        open={pbOpen}
        initialAttrs={pbAttrs}
        onClose={() => setPbOpen(false)}
        onSave={handleSavePageBreak}
      />
      <ChaptersDialog
        open={openChapters}
        onClose={() => setOpenChapters(false)}
        bookSlug={bookSlug}
        bookTitle={bookTitle}
        chapters={chapters}
        currentSlug={slug}
        editing
      />
      <SearchDialog open={openSearch} onClose={() => setOpenSearch(false)} bookSlug={bookSlug} bookTitle={bookTitle} />
    </div>
  );
}
