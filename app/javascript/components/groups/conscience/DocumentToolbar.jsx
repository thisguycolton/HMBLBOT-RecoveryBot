import React, { useEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, Baseline,
  BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart, Bold, ChevronDown, FileUp, Grid2x2, Highlighter, Italic,
  Link2, List, ListOrdered, Maximize2, Minimize2, Minus, MoveHorizontal, PaintBucket, PanelTop, Quote, Redo2, SquareDashed, Strikethrough, Table2,
  TableCellsMerge, TableCellsSplit, Trash2, Underline, Undo2, Unlink,
} from "lucide-react";
import { BORDER_COLORS, BORDER_WIDTHS, CELL_FILLS, CELL_WIDTHS, HIGHLIGHT_COLORS, TEXT_COLORS, normalizeHref } from "./editorKit";
import { PALETTES, toneOf } from "./docColors";

const button = "grid size-8 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-700 hover:!bg-neutral-200/70 disabled:opacity-35 dark:text-neutral-200 dark:hover:!bg-neutral-700/60";
const on = "!bg-accent/15 text-accent dark:!bg-accent/30 dark:text-white";

function Tool({ label, icon: Icon, active, disabled, onClick }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={!!active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`${button} ${active ? on : ""}`}>
      <Icon className="size-4" />
    </button>
  );
}
// A popover under a toolbar button. Fixed to the window, so a toolbar that scrolls sideways (on a
// phone) doesn't clip it; closes on a tap outside it.
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const away = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", away);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("resize", away); };
  }, [open]);
  const place = (width) => {
    const r = ref.current?.getBoundingClientRect();
    return { top: (r?.bottom || 0) + 4, left: Math.max(8, Math.min(r?.left || 0, window.innerWidth - width - 8)) };
  };
  return { open, setOpen, ref, place };
}

// One swatch: its light color, and data-*-tone so on the dark page it shows the dark tone it'll get
function Swatch({ kind, name, value, tone, picked, onPick, size = "size-7" }) {
  const attrs = tone ? { [PALETTES[kind].attr]: tone } : {};
  return (
    <button type="button" role="menuitemradio" aria-checked={picked} title={name} aria-label={name} onMouseDown={(e) => e.preventDefault()} onClick={onPick}
      className={`${size} rounded-lg !p-0 ring-1 ring-black/10 dark:ring-white/15 ${picked ? "outline outline-2 outline-offset-1 outline-accent" : ""}`}
      style={{ background: value || "repeating-linear-gradient(45deg,#fff,#fff 3px,#e2e8f0 3px,#e2e8f0 6px)" }} {...attrs} />
  );
}

// A toolbar button that opens a grid of color swatches, with a "None" to take the color off.
// `kind`: which palette (docColors.js), so the swatches and the bar under the icon show the tone
// the page will.
function ColorMenu({ label, icon: Icon, kind, colors, current, onPick, onClear, clearLabel = "None" }) {
  const { open, setOpen, ref, place } = usePopover();
  const currentTone = toneOf(current, kind);
  const barAttrs = currentTone ? { [PALETTES[kind].attr]: currentTone } : {};
  return (
    <span ref={ref} className="relative shrink-0">
      <button type="button" title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((v) => !v)} className={`${button} relative ${open ? on : ""}`}>
        <Icon className="size-4" />
        <span aria-hidden="true" className="absolute inset-x-1.5 bottom-1 h-1 rounded-full" {...barAttrs}
          style={{ background: current || "transparent", boxShadow: current ? "none" : "inset 0 0 0 1px rgb(148 163 184)" }} />
      </button>
      {open && (
        <span role="menu" aria-label={label} className="fixed z-[2300] grid w-48 grid-cols-5 gap-1.5 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900" style={place(192)}>
          {colors.filter(([, value]) => value).map(([name, value, tone]) => (
            <Swatch key={value} kind={kind} name={name} value={value} tone={tone} picked={!!current && currentTone === tone}
              onPick={() => { onPick(value); setOpen(false); }} />
          ))}
          <button type="button" role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => { onClear(); setOpen(false); }}
            className="col-span-5 mt-1 rounded-lg !bg-neutral-100 py-1 text-xs font-medium text-slate-700 dark:!bg-neutral-800 dark:text-neutral-200">{clearLabel}</button>
        </span>
      )}
    </span>
  );
}

// A small labeled button for the table bar
function Act({ label, icon: Icon, text, onClick, disabled, active, danger }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active === undefined ? undefined : !!active} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium !bg-transparent disabled:opacity-35 ${danger ? "text-rose-700 hover:!bg-rose-50 dark:text-rose-300 dark:hover:!bg-rose-950/50" : "text-slate-700 hover:!bg-neutral-200/70 dark:text-neutral-200 dark:hover:!bg-neutral-700/60"} ${active ? on : ""}`}>
      {Icon && <Icon className="size-4" />}{text && <span>{text}</span>}
    </button>
  );
}

// A compact pick-one (border width, column width) as the phone's own picker
function Pick({ label, icon: Icon, options, value, onChange }) {
  return (
    <label title={label} className="relative inline-flex h-8 shrink-0 items-center gap-1 rounded-lg pl-2 text-xs text-slate-700 hover:bg-neutral-200/70 dark:text-neutral-200 dark:hover:bg-neutral-700/60">
      <Icon aria-hidden="true" className="size-4" />
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
        className="h-8 appearance-none rounded-lg border-0 !bg-transparent py-0 pl-0.5 pr-5 text-xs font-medium text-inherit focus:ring-2 focus:ring-accent">
        {options.map(([name, v]) => <option key={name} value={v ?? ""}>{name}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-1 size-3 opacity-60" />
    </label>
  );
}

// The table bar: a second row under the toolbar while the cursor is in a table, with everything
// about it: rows and columns, the header row, merging, and the cell's fill, borders, width and
// how its text lines up. Styles go on the cell the cursor is in, or every cell dragged across.
// It floats over the top of the page rather than pushing the page down, so the cell you tapped
// stays where it was.
function TableBar({ editor }) {
  const run = (fn) => () => fn(editor.chain().focus()).run();
  const setCell = (attr, value) => editor.chain().focus().setCellAttribute(attr, value).run();
  const cell = editor.getAttributes(editor.isActive("tableHeader") ? "tableHeader" : "tableCell");
  const valign = cell.verticalAlign || null;
  return (
    <div role="toolbar" aria-label="Table" className="doc-table-bar no-scrollbar absolute inset-x-0 top-full flex flex-nowrap items-center gap-0.5 overflow-x-auto border-y border-neutral-200 bg-neutral-50 px-2 py-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <span className="mr-1 inline-flex shrink-0 items-center gap-1 rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent"><Table2 className="size-3.5" /> Table</span>
      <Tool label="Add a row above" icon={BetweenHorizontalStart} onClick={run((c) => c.addRowBefore())} />
      <Tool label="Add a row below" icon={BetweenHorizontalEnd} onClick={run((c) => c.addRowAfter())} />
      <Tool label="Add a column to the left" icon={BetweenVerticalStart} onClick={run((c) => c.addColumnBefore())} />
      <Tool label="Add a column to the right" icon={BetweenVerticalEnd} onClick={run((c) => c.addColumnAfter())} />
      <Act label="Delete this row" text="− Row" onClick={run((c) => c.deleteRow())} />
      <Act label="Delete this column" text="− Column" onClick={run((c) => c.deleteColumn())} />
      <Divider />
      <Tool label="Header row" icon={PanelTop} active={editor.isActive("tableHeader")} onClick={run((c) => c.toggleHeaderRow())} />
      <Tool label="Merge cells (drag across cells first)" icon={TableCellsMerge} disabled={!editor.can().mergeCells()} onClick={run((c) => c.mergeCells())} />
      <Tool label="Split cell" icon={TableCellsSplit} disabled={!editor.can().splitCell()} onClick={run((c) => c.splitCell())} />
      <Divider />
      <ColorMenu label="Cell fill" icon={PaintBucket} kind="fill" colors={CELL_FILLS} current={cell.backgroundColor}
        onPick={(v) => setCell("backgroundColor", v)} onClear={() => setCell("backgroundColor", null)} />
      <ColorMenu label="Border color" icon={SquareDashed} kind="border" colors={BORDER_COLORS} current={cell.borderColor} clearLabel="Default"
        onPick={(v) => setCell("borderColor", v)} onClear={() => setCell("borderColor", null)} />
      <Pick label="Border width" icon={Grid2x2} options={BORDER_WIDTHS} value={cell.borderWidth} onChange={(v) => setCell("borderWidth", v)} />
      <Pick label="Column width" icon={MoveHorizontal} options={CELL_WIDTHS} value={cell.cellWidth} onChange={(v) => setCell("cellWidth", v)} />
      <Divider />
      <Tool label="Text at the top of the cell" icon={AlignVerticalJustifyStart} active={!valign} onClick={() => setCell("verticalAlign", null)} />
      <Tool label="Text in the middle of the cell" icon={AlignVerticalJustifyCenter} active={valign === "middle"} onClick={() => setCell("verticalAlign", "middle")} />
      <Tool label="Text at the bottom of the cell" icon={AlignVerticalJustifyEnd} active={valign === "bottom"} onClick={() => setCell("verticalAlign", "bottom")} />
      <Divider />
      <Act label="Delete the table" icon={Trash2} text="Delete table" danger onClick={run((c) => c.deleteTable())} />
    </div>
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
    <div className="relative">
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
      <ColorMenu label="Text color" icon={Baseline} kind="text" colors={TEXT_COLORS} current={editor.getAttributes("textStyle").color}
        onPick={(color) => editor.chain().focus().setTextColor(color).run()} onClear={() => editor.chain().focus().unsetTextColor().run()} />
      <ColorMenu label="Highlight color" icon={Highlighter} kind="mark" colors={HIGHLIGHT_COLORS} current={editor.isActive("highlight") ? editor.getAttributes("highlight").color : null}
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
        // Not a <form>: the toolbar can sit inside one, and a form in a form submits the outer one
        <div role="group" aria-label="Add a link" className="flex shrink-0 items-center gap-1">
          <input autoFocus aria-label="Link address" value={href} onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setLinking(false); if (e.key === "Enter") applyLink(e); }}
            placeholder="Paste or type a link" className="h-8 w-44 rounded-lg border border-neutral-300 bg-white px-2 text-xs dark:border-neutral-600 dark:bg-neutral-900 dark:text-white" />
          <button type="button" onClick={applyLink} className="h-8 rounded-lg !bg-accent px-2.5 text-xs font-semibold !text-white">Apply</button>
          <button type="button" onClick={() => setLinking(false)} className="h-8 rounded-lg !bg-transparent px-2 text-xs text-slate-600 dark:text-neutral-300">Cancel</button>
        </div>
      ) : (
        <>
          <Tool label="Link" icon={Link2} active={editor.isActive("link")} onClick={startLink} />
          {editor.isActive("link") && <Tool label="Remove link" icon={Unlink} onClick={run((c) => c.extendMarkRange("link").unsetLink())} />}
        </>
      )}
      <Tool label="Insert a table" icon={Table2} active={inTable} onClick={run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))} />
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
    {inTable && editor.isEditable && <TableBar editor={editor} />}
    </div>
  );
}
