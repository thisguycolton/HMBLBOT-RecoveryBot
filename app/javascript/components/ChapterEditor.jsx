// app/javascript/components/ChapterEditor.jsx
import { useEffect, useState, useMemo } from "react";
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

// ⚠️ Ensure these imports match your actual export style.
// If your files export default, switch to: `import PageBreak from '../tiptap/PageBreak'` etc.
import { PageBreak } from "../tiptap/PageBreak";
import { ParagraphWithPage } from "../tiptap/ParagraphWithPage";
import { FontSize } from "../tiptap/FontSize";
import { Indent } from "../tiptap/Indent";

import FloatingMenuExtension from "@tiptap/extension-floating-menu";

function forceBlockToParagraph(editor) {
  const { state } = editor;
  const { $from } = state.selection;
  const node = $from.parent;
  if (node.type.name === 'paragraph') return;
  // Replace the node type at selection to 'paragraph' (keeping content/attrs you care about)
  editor.chain().focus().setNode('paragraph').run();
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
  Bold, Italic,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  IndentDecrease, IndentIncrease, Type, BrushCleaning, CloudCheck, Save, 
  Table as TableIcon,
  Columns as ColumnsIcon,
  Rows as RowsIcon,
  Trash2,
  Merge,
  Split,
  PlusSquare,
  MinusSquare,
  SquareSplitVertical,
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
      if (editor) editor.commands.setContent(doc, false);
    })().catch(err => console.error("Load chapter failed", err));
  }, [bookSlug, slug, editor]);

  // Save content
  async function saveContent() {
    if (!editor || !chapter) return;
    const doc = editor.getJSON();
    await axios.patch(
      `/api/books/${bookSlug}/chapters/${chapter.slug}`,
      { chapter: { tiptap_json: doc } },
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Save meta (title + slug) then redirect if slug changed
  async function saveMeta() {
    if (!chapter) return;
    const fromSlug = chapter.slug;
    await axios.patch(
      `/api/books/${bookSlug}/chapters/${fromSlug}`,
      { chapter: { title, slug: chapterSlug } },
      { headers: { "Content-Type": "application/json" } }
    );
    if (chapterSlug !== fromSlug) {
      window.location.replace(`/books/${bookSlug}/chapters/${chapterSlug}/edit`);
    } else {
      // keep local chapter in sync
      setChapter(prev => ({ ...(prev || {}), title, slug: chapterSlug }));
    }
  }

  if (!editor) return null;

  const isActive = (name, attrs) => editor.isActive(name, attrs);

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-3">
      {/* Title + Slug row */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            className="w-full rounded border px-3 py-2 text-xl font-semibold bg-white"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Chapter title"
          />
        </div>
        <div className="w-80">
          <label className="block text-sm font-medium mb-1">Slug</label>
          <input
            className="w-full rounded border px-3 py-2 bg-white"
            value={chapterSlug}
            onChange={e => setChapterSlug(e.target.value)}
            placeholder="chapter-slug"
          />
        </div>
        <button type="button" className="hb-btn" onClick={saveMeta}><Save size={16} /></button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-sm px-1 py-1 bg-slate-100! sticky top-0 z-10">
        {/* Bold / Italic */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`hb-btn rounded-sm ${isActive('bold') ? 'hb-btn--active' : ''}`}
          title="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`hb-btn rounded-sm ${isActive('italic') ? 'hb-btn--active' : ''}`}
          title="Italic"
        >
          <Italic size={16} />
        </button>

        <span className="mx-1 h-5 w-px bg-gray-200" />
        <button
          type="button"
          className="hb-btn"
          title="Convert to paragraph"
          onClick={() => {
            forceBlockToParagraph(editor);
            // optional: auto-save right away
            // saveContent();
          }}
        >
          ¶
        </button>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        {/* Font size */}
        <div className="flex items-center gap-1">
          <Type size={16} className="text-gray-500" />
          <select
            onChange={e => {
              const val = e.target.value;
              if (val === "default") editor.chain().focus().unsetFontSize().run();
              else editor.chain().focus().setFontSize(val).run();
            }}
            defaultValue="default"
            className="border border-slate-200 rounded-sm text-sm px-1 py-1 bg-white"
            title="Font size"
          >
            <option value="default">Size</option>
            <option value="12px">Small</option>
            <option value="16px">Normal</option>
            <option value="20px">Large</option>
            <option value="24px">X-Large</option>
          </select>
        </div>

        <span className="mx-1 h-5 w-px bg-gray-200" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`hb-btn rounded-sm ${isActive({ textAlign: "left" }) ? "hb-btn--active" : ""}`}
          title="Align left"
        >
          <AlignLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`hb-btn rounded-sm ${isActive({ textAlign: "center" }) ? "hb-btn--active" : ""}`}
          title="Align center"
        >
          <AlignCenter size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`hb-btn rounded-sm ${isActive({ textAlign: "right" }) ? "hb-btn--active" : ""}`}
          title="Align right"
        >
          <AlignRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={`hb-btn rounded-sm ${isActive({ textAlign: "justify" }) ? "hb-btn--active" : ""}`}
          title="Justify"
        >
          <AlignJustify size={16} />
        </button>

        <span className="mx-1 h-5 w-px bg-gray-200" />

        {/* Indent / Outdent */}
        <button
          type="button"
          onClick={() => editor.chain().focus().indent().run()}
          className="hb-btn rounded-sm"
          title="Increase indent"
        >
          <IndentIncrease size={16} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().outdent().run()}
          className="hb-btn rounded-sm"
          title="Decrease indent"
        >
          <IndentDecrease size={16} />
        </button>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-2">
          <TableMenu editor={editor} />
        </div>
        <span className="mx-1 h-5 w-px bg-gray-200" />

        <div className="flex items-center gap-1">
          <button type="button" className="hb-btn rounded-sm" title="Insert page break"
            onClick={() => handleInsertBreak("default")}>
            <SquareSplitVertical size={16} />
          </button>
        </div>
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <div className="ml-auto flex gap-2">
          <button type="button" className="hb-btn bg-sky-300! hover:bg-sky-200! rounded-sm" onClick={() => editor.chain().focus().unsetIndent().unsetFontSize().run()}>
            <BrushCleaning size={16} />
          </button>
          <button type="button" className="hb-btn bg-green-300! hover:bg-green-200! rounded-sm" onClick={saveContent}>
            <CloudCheck size={16} />
          </button>
        </div>

      </div>
      
      <EditorContent editor={editor} className="prose max-w-none hb-reader border border-slate-200 rounded p-3 bg-white" />
      <BlockTagBadge editor={editor} container={floatingEl} />
      <PageBreakModal
        open={pbOpen}
        initialAttrs={pbAttrs}
        onClose={() => setPbOpen(false)}
        onSave={handleSavePageBreak}
      />
    </div>
  );
}