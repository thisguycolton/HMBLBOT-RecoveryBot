import React, { useEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, FileUp, Highlighter, Italic, Link2, List, ListOrdered, Maximize2, Minimize2, Minus, Quote,
  Redo2, Strikethrough, Table2, Underline, Undo2, Unlink,
} from "lucide-react";
import { BORDER_COLORS, BORDER_WIDTHS, CELL_FILLS, CELL_WIDTHS, HIGHLIGHT_COLORS, TEXT_COLORS, normalizeHref } from "./editorKit";

const button = "grid size-8 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-700 hover:!bg-neutral-200/70 disabled:opacity-35 dark:text-neutral-200 dark:hover:!bg-neutral-700/60";
const on = "!bg-accent/15 text-accent dark:!bg-accent/30 dark:text-white";

function Tool({ label, icon: Icon, active, disabled, onClick }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={!!active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`${button} ${active ? on : ""}`}>
      <Icon className="size-4" />
    </button>
  );
}
// A toolbar button that opens a row of color swatches, with a "None" to take the color off
function ColorMenu({ label, icon: Icon, colors, current, onPick, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <span ref={ref} className="relative shrink-0">
      <button type="button" title={label} aria-label={label} aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((v) => !v)} className={`${button} relative`}>
        <Icon className="size-4" />
        <span aria-hidden="true" className="absolute inset-x-1.5 bottom-1 h-1 rounded-full" style={{ background: current || "transparent", boxShadow: current ? "none" : "inset 0 0 0 1px rgb(148 163 184)" }} />
      </button>
      {open && (
        <span role="menu" className="fixed z-[2300] mt-1 grid w-44 grid-cols-5 gap-1.5 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
          style={{ top: ref.current?.getBoundingClientRect().bottom, left: Math.min(ref.current?.getBoundingClientRect().left || 0, window.innerWidth - 184) }}>
          {colors.map(([name, value]) => (
            <button key={value} type="button" role="menuitem" title={name} aria-label={name} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(value); setOpen(false); }}
              className={`size-7 rounded-lg !p-0 ring-1 ring-black/10 ${current === value ? "outline outline-2 outline-offset-1 outline-accent" : ""}`} style={{ background: value }} />
          ))}
          <button type="button" role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => { onClear(); setOpen(false); }}
            className="col-span-5 mt-1 rounded-lg !bg-neutral-100 py-1 text-xs font-medium text-slate-700 dark:!bg-neutral-800 dark:text-neutral-200">None</button>
        </span>
      )}
    </span>
  );
}

// Everything about the table the cursor is in: rows and columns, the header row, merging, and
// the selected cells' fill, borders, width and alignment (drag across cells to style several)
function TableMenu({ editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const run = (fn) => () => fn(editor.chain().focus()).run();
  const setCell = (attr, value) => editor.chain().focus().setCellAttribute(attr, value).run();
  const cell = editor.getAttributes(editor.isActive("tableHeader") ? "tableHeader" : "tableCell");
  const act = "rounded-lg !bg-neutral-100 px-2 py-1 text-xs font-medium text-slate-700 hover:!bg-neutral-200 dark:!bg-neutral-800 dark:text-neutral-200 dark:hover:!bg-neutral-700";
  const Row = ({ label, children }) => (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{label}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
  const choice = (attr, [name, value]) => (
    <button key={name} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setCell(attr, value)}
      className={`${act} ${(cell[attr] || null) === value ? "!bg-accent/20 !text-accent" : ""}`}>{name}</button>
  );
  const swatch = (attr, [name, value]) => (
    <button key={name} type="button" title={name} aria-label={name} onMouseDown={(e) => e.preventDefault()} onClick={() => setCell(attr, value)}
      className={`size-6 rounded-md !p-0 ring-1 ring-black/15 ${(cell[attr] || null) === value ? "outline outline-2 outline-offset-1 outline-accent" : ""}`}
      style={{ background: value || "repeating-linear-gradient(45deg,#fff,#fff 3px,#e2e8f0 3px,#e2e8f0 6px)" }} />
  );
  return (
    <span ref={ref} className="relative shrink-0">
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold ${open ? on : "!bg-accent/10 text-accent"} `}>
        <Table2 className="size-4" /> Table ▾
      </button>
      {open && (
        <div className="fixed z-[2300] mt-1 w-72 space-y-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
          style={{ top: ref.current?.getBoundingClientRect().bottom, left: Math.min(ref.current?.getBoundingClientRect().left || 0, window.innerWidth - 300) }}>
          <Row label="Rows and columns">
            <button type="button" className={act} onClick={run((c) => c.addRowBefore())}>+ Row above</button>
            <button type="button" className={act} onClick={run((c) => c.addRowAfter())}>+ Row below</button>
            <button type="button" className={act} onClick={run((c) => c.addColumnBefore())}>+ Column left</button>
            <button type="button" className={act} onClick={run((c) => c.addColumnAfter())}>+ Column right</button>
            <button type="button" className={act} onClick={run((c) => c.deleteRow())}>− Row</button>
            <button type="button" className={act} onClick={run((c) => c.deleteColumn())}>− Column</button>
            <button type="button" className={act} onClick={run((c) => c.toggleHeaderRow())}>Header row</button>
            <button type="button" className={act} disabled={!editor.can().mergeCells()} onClick={run((c) => c.mergeCells())}>Merge</button>
            <button type="button" className={act} disabled={!editor.can().splitCell()} onClick={run((c) => c.splitCell())}>Split</button>
          </Row>
          <Row label="Cell fill">{CELL_FILLS.map((c) => swatch("backgroundColor", c))}</Row>
          <Row label="Border color">{BORDER_COLORS.map((c) => swatch("borderColor", c))}</Row>
          <Row label="Border width">{BORDER_WIDTHS.map((c) => choice("borderWidth", c))}</Row>
          <Row label="Column width">{CELL_WIDTHS.map((c) => choice("cellWidth", c))}</Row>
          <Row label="Line up text">{[["Top", null], ["Middle", "middle"], ["Bottom", "bottom"]].map((c) => choice("verticalAlign", c))}</Row>
          <p className="text-[11px] text-slate-500 dark:text-neutral-400">Styles go on the cell the cursor is in. Drag across cells to style several at once.</p>
          <button type="button" className={`${act} w-full !text-rose-700 dark:!text-rose-300`} onClick={() => { setOpen(false); editor.chain().focus().deleteTable().run(); }}>Delete table</button>
        </div>
      )}
    </span>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-neutral-300 dark:bg-neutral-600" />;

// The word processor's ribbon above the page: styles, alignment, lists, links, tables, undo, import
export default function DocumentToolbar({ editor, onImport, fullScreen, onFullScreen }) {
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
      <ColorMenu label="Text color" icon={Baseline} colors={TEXT_COLORS} current={editor.getAttributes("textStyle").color}
        onPick={(color) => editor.chain().focus().setTextColor(color).run()} onClear={() => editor.chain().focus().unsetTextColor().run()} />
      <ColorMenu label="Highlight color" icon={Highlighter} colors={HIGHLIGHT_COLORS} current={editor.isActive("highlight") ? editor.getAttributes("highlight").color : null}
        onPick={(color) => editor.chain().focus().setHighlight({ color }).run()} onClear={() => editor.chain().focus().unsetHighlight().run()} />
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
      {inTable && <TableMenu editor={editor} />}
      {onFullScreen && (
        <>
          <Divider />
          <Tool label={fullScreen ? "Leave full screen (Esc)" : "Full screen"} icon={fullScreen ? Minimize2 : Maximize2} active={fullScreen} onClick={onFullScreen} />
        </>
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
