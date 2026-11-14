import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  CheckSquare, Code2, Heading1, Heading2, Heading3, Image as ImageIcon, Lightbulb, List, ListOrdered, Minus, Pilcrow,
  ShieldCheck, StickyNote, Table as TableIcon, TextQuote, TriangleAlert, Clapperboard,
} from "lucide-react";

// What "/" offers in the docs editor, Notion-style. `run` gets a chain with the "/query" already
// removed; `picture` asks DocEditor for a file instead.
// A ```video block to fill in: the file, and the chapters that cut up its timeline
const VIDEO_TEMPLATE = `{
  "src": "/docs-videos/your-video.mp4",
  "title": "What this video shows",
  "chapters": [
    { "start": "0:00", "title": "First part" },
    { "start": "0:30", "title": "Second part" }
  ]
}`;
const callout = (kind) => (chain) => chain.setParagraph().toggleBlockquote().insertContent(`[!${kind}] `);
export const COMMANDS = [
  { key: "text", label: "Text", hint: "Plain writing", icon: Pilcrow, words: "paragraph plain", run: (c) => c.setParagraph() },
  { key: "h1", label: "Heading 1", hint: "Big section heading", icon: Heading1, words: "title h1 #", run: (c) => c.setHeading({ level: 1 }) },
  { key: "h2", label: "Heading 2", hint: "Shows in On this page", icon: Heading2, words: "h2 ## section", run: (c) => c.setHeading({ level: 2 }) },
  { key: "h3", label: "Heading 3", hint: "Smaller heading, also listed", icon: Heading3, words: "h3 ### subsection", run: (c) => c.setHeading({ level: 3 }) },
  { key: "bullets", label: "Bulleted list", hint: "- a simple list", icon: List, words: "ul unordered bullet", run: (c) => c.toggleBulletList() },
  { key: "numbers", label: "Numbered list", hint: "1. steps in order", icon: ListOrdered, words: "ol ordered steps numbered", run: (c) => c.toggleOrderedList() },
  { key: "checklist", label: "Checklist", hint: "[ ] things to tick off", icon: CheckSquare, words: "todo task check", run: (c) => c.toggleTaskList() },
  { key: "tip", label: "Tip", hint: "Green callout", icon: Lightbulb, words: "callout tip hint", run: callout("TIP") },
  { key: "note", label: "Note", hint: "Blue callout", icon: StickyNote, words: "callout note info", run: callout("NOTE") },
  { key: "warning", label: "Heads up", hint: "Amber callout", icon: TriangleAlert, words: "callout warning caution heads", run: callout("WARNING") },
  { key: "privacy", label: "Privacy", hint: "Purple callout about who sees what", icon: ShieldCheck, words: "callout privacy anonymity private", run: callout("PRIVACY") },
  { key: "quote", label: "Quote", hint: "> quoted words", icon: TextQuote, words: "blockquote", run: (c) => c.setParagraph().toggleBlockquote() },
  { key: "divider", label: "Divider", hint: "--- a line across", icon: Minus, words: "hr rule line separator", run: (c) => c.setHorizontalRule() },
  { key: "code", label: "Code", hint: "``` monospace block", icon: Code2, words: "codeblock pre", run: (c) => c.toggleCodeBlock() },
  { key: "table", label: "Table", hint: "3 × 3 with a header row", icon: TableIcon, words: "grid columns", run: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },
  { key: "video", label: "Video", hint: "A video with chapters (JSON)", icon: Clapperboard, words: "movie clip chapters timeline player", run: (c) => c.insertContent({ type: "codeBlock", attrs: { language: "video" }, content: [{ type: "text", text: VIDEO_TEMPLATE }] }) },
  { key: "picture", label: "Picture", hint: "Upload a screenshot", icon: ImageIcon, words: "image photo screenshot upload", picture: true },
];

// Labels that start with what was typed first ("ti" is Tip before Heading 1's "title"), then
// labels that hold it, then the other words a command goes by
export const matchCommands = (query) => {
  const q = query.trim().toLowerCase();
  if (!q) return COMMANDS;
  const rank = (c) => {
    const label = c.label.toLowerCase();
    if (label.startsWith(q)) return 0;
    if (label.includes(q)) return 1;
    return c.words.split(" ").some((w) => w.startsWith(q)) ? 2 : c.words.includes(q) ? 3 : 4;
  };
  return COMMANDS.map((c) => [rank(c), c]).filter(([r]) => r < 4).sort((a, b) => a[0] - b[0]).map(([, c]) => c);
};

// The list under the cursor. DocEditor passes keys in through onKey (true = handled).
const SlashMenu = forwardRef(function SlashMenu({ items, coords, onPick }, ref) {
  const [at, setAt] = useState(0);
  const list = useRef(null);
  useEffect(() => setAt(0), [items]);
  useEffect(() => { list.current?.querySelector(`[data-i="${at}"]`)?.scrollIntoView({ block: "nearest" }); }, [at]);

  useImperativeHandle(ref, () => ({
    onKey(e) {
      if (!items.length) return false;
      if (e.key === "ArrowDown") { setAt((i) => (i + 1) % items.length); return true; }
      if (e.key === "ArrowUp") { setAt((i) => (i - 1 + items.length) % items.length); return true; }
      if (e.key === "Enter" || e.key === "Tab") { onPick(items[at]); return true; }
      return false;
    },
  }), [items, at, onPick]);

  if (!items.length) return null;
  const top = Math.min(coords.bottom + 6, window.innerHeight - 330);
  const left = Math.min(coords.left, window.innerWidth - 290);

  return (
    <div
      ref={list}
      role="listbox"
      aria-label="Insert"
      style={{ position: "fixed", top, left }}
      className="z-50 max-h-80 w-[17rem] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-1.5 !font-sans shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
    >
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Insert</p>
      {items.map((item, i) => (
        <button
          key={item.key}
          type="button"
          data-i={i}
          role="option"
          aria-selected={i === at}
          onMouseEnter={() => setAt(i)}
          onMouseDown={(e) => { e.preventDefault(); onPick(item); }}
          className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left !text-slate-800 dark:!text-neutral-100 ${i === at ? "!bg-neutral-100 dark:!bg-neutral-800" : "!bg-transparent"}`}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-white text-slate-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
            <item.icon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="block truncate text-xs text-slate-500 dark:text-neutral-400">{item.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
});

export default SlashMenu;
