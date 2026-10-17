import React, { useRef, useState } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, FileUp, Italic, Link2, List, ListOrdered, Minus, Quote,
  Redo2, Strikethrough, Table2, Underline, Undo2, Unlink,
} from "lucide-react";
import { normalizeHref } from "./editorKit";

const button = "grid size-8 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-700 hover:!bg-neutral-200/70 disabled:opacity-35 dark:text-neutral-200 dark:hover:!bg-neutral-700/60";
const on = "!bg-accent/15 text-accent dark:!bg-accent/30 dark:text-white";

function Tool({ label, icon: Icon, active, disabled, onClick }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={!!active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`${button} ${active ? on : ""}`}>
      <Icon className="size-4" />
    </button>
  );
}
const Divider = () => <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-neutral-300 dark:bg-neutral-600" />;

// The word processor's ribbon above the page: styles, alignment, lists, links, tables, undo, import
export default function DocumentToolbar({ editor, onImport }) {
  const fileRef = useRef(null);
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState("");
  if (!editor) return null;
  const run = (fn) => () => fn(editor.chain().focus()).run();
  const block = editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p";
  const setBlock = (value) => {
    const chain = editor.chain().focus();
    if (value === "p") chain.setParagraph().run();
    else chain.setHeading({ level: Number(value[1]) }).run();
  };
  const startLink = () => {
    setHref(editor.getAttributes("link").href || "");
    setLinking(true);
  };
  const applyLink = (e) => {
    e.preventDefault();
    const value = normalizeHref(href);
    if (value) editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
    else editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinking(false);
  };
  const inTable = editor.isActive("table");

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-nowrap items-center gap-0.5 overflow-x-auto px-2 py-1.5">
      <Tool label="Undo" icon={Undo2} disabled={!editor.can().undo()} onClick={run((c) => c.undo())} />
      <Tool label="Redo" icon={Redo2} disabled={!editor.can().redo()} onClick={run((c) => c.redo())} />
      <Divider />
      <select aria-label="Text style" value={block} onChange={(e) => setBlock(e.target.value)} className="h-8 shrink-0 rounded-lg border border-neutral-300 bg-white px-2 text-xs text-slate-800 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100">
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <Divider />
      <Tool label="Bold (Ctrl+B)" icon={Bold} active={editor.isActive("bold")} onClick={run((c) => c.toggleBold())} />
      <Tool label="Italic (Ctrl+I)" icon={Italic} active={editor.isActive("italic")} onClick={run((c) => c.toggleItalic())} />
      <Tool label="Underline (Ctrl+U)" icon={Underline} active={editor.isActive("underline")} onClick={run((c) => c.toggleUnderline())} />
      <Tool label="Strikethrough" icon={Strikethrough} active={editor.isActive("strike")} onClick={run((c) => c.toggleStrike())} />
      <Divider />
      <Tool label="Align left" icon={AlignLeft} active={editor.isActive({ textAlign: "left" })} onClick={run((c) => c.setTextAlign("left"))} />
      <Tool label="Center" icon={AlignCenter} active={editor.isActive({ textAlign: "center" })} onClick={run((c) => c.setTextAlign("center"))} />
      <Tool label="Align right" icon={AlignRight} active={editor.isActive({ textAlign: "right" })} onClick={run((c) => c.setTextAlign("right"))} />
      <Tool label="Justify" icon={AlignJustify} active={editor.isActive({ textAlign: "justify" })} onClick={run((c) => c.setTextAlign("justify"))} />
      <Divider />
      <Tool label="Bulleted list" icon={List} active={editor.isActive("bulletList")} onClick={run((c) => c.toggleBulletList())} />
      <Tool label="Numbered list" icon={ListOrdered} active={editor.isActive("orderedList")} onClick={run((c) => c.toggleOrderedList())} />
      <Tool label="Quote" icon={Quote} active={editor.isActive("blockquote")} onClick={run((c) => c.toggleBlockquote())} />
      <Tool label="Divider line" icon={Minus} onClick={run((c) => c.setHorizontalRule())} />
      <Divider />
      {linking ? (
        <form onSubmit={applyLink} className="flex shrink-0 items-center gap-1">
          <input autoFocus aria-label="Link address" value={href} onChange={(e) => setHref(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setLinking(false)} placeholder="Paste or type a link" className="h-8 w-44 rounded-lg border border-neutral-300 bg-white px-2 text-xs dark:border-neutral-600 dark:bg-neutral-900 dark:text-white" />
          <button type="submit" className="h-8 rounded-lg !bg-accent px-2.5 text-xs font-semibold !text-white">Apply</button>
          <button type="button" onClick={() => setLinking(false)} className="h-8 rounded-lg !bg-transparent px-2 text-xs text-slate-600 dark:text-neutral-300">Cancel</button>
        </form>
      ) : (
        <>
          <Tool label="Link" icon={Link2} active={editor.isActive("link")} onClick={startLink} />
          {editor.isActive("link") && <Tool label="Remove link" icon={Unlink} onClick={run((c) => c.extendMarkRange("link").unsetLink())} />}
        </>
      )}
      <Tool label="Insert a table" icon={Table2} active={inTable} onClick={run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))} />
      {inTable && (
        <span className="flex shrink-0 items-center gap-1 rounded-lg bg-neutral-200/60 px-1 text-[11px] font-semibold text-slate-600 dark:bg-neutral-700/60 dark:text-neutral-200">
          <button type="button" className="rounded px-1.5 py-1 !bg-transparent hover:underline" onClick={run((c) => c.addRowAfter())}>+ Row</button>
          <button type="button" className="rounded px-1.5 py-1 !bg-transparent hover:underline" onClick={run((c) => c.addColumnAfter())}>+ Column</button>
          <button type="button" className="rounded px-1.5 py-1 !bg-transparent hover:underline" onClick={run((c) => c.deleteRow())}>− Row</button>
          <button type="button" className="rounded px-1.5 py-1 !bg-transparent hover:underline" onClick={run((c) => c.deleteColumn())}>− Column</button>
          <button type="button" className="rounded px-1.5 py-1 !bg-transparent text-rose-700 hover:underline dark:text-rose-300" onClick={run((c) => c.deleteTable())}>Delete table</button>
        </span>
      )}
      {onImport && (
        <>
          <Divider />
          <input ref={fileRef} type="file" hidden accept=".docx,.rtf" onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) onImport(f); }} />
          <button type="button" onClick={() => fileRef.current?.click()} title="Import a Word (.docx) or RTF file" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg !bg-transparent px-2 text-xs font-medium text-slate-700 hover:!bg-neutral-200/70 dark:text-neutral-200 dark:hover:!bg-neutral-700/60">
            <FileUp className="size-4" /> Import Word / RTF
          </button>
        </>
      )}
    </div>
  );
}
