import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import { Bold, Italic, Link2, Strikethrough, Underline as UnderlineIcon } from "lucide-react";
import MarkdownTextarea from "./MarkdownTextarea";
import { editorCanHold, markdownToNoteHtml, noteJsonToMarkdown } from "./noteMarkdown";
import { looksLikeMarkdown } from "../../lib/markdownHtml";
import { api } from "../groups/lib";

// Each pill button, and the mark it turns on or off. Any of them go together: bold and italic,
// bold underlined, and so on.
const MARKS = [
  { mark: "bold", label: "Bold", icon: Bold, toggle: (c) => c.toggleBold() },
  { mark: "italic", label: "Italic", icon: Italic, toggle: (c) => c.toggleItalic() },
  { mark: "underline", label: "Underline", icon: UnderlineIcon, toggle: (c) => c.toggleUnderline() },
  { mark: "strike", label: "Strikethrough", icon: Strikethrough, toggle: (c) => c.toggleStrike() },
];

// ⌘/Ctrl+Shift+X strikes through, as in the plain text box
const StrikeKey = Extension.create({
  name: "strikeKey",
  addKeyboardShortcuts() { return { "Mod-Shift-x": () => this.editor.commands.toggleStrike() }; },
});

// A note's (or comment's) text box that shows what the Markdown means instead of its
// symbols: bold looks bold. It takes and gives Markdown (`value`, `onChange`), so notes
// are stored and shown (book/Markdown.jsx) as before. Selecting text brings up the same
// pill as MarkdownTextarea, whose buttons light up for what the words already have, and
// typing Markdown (**bold**, *italic*, - lists, > quotes) still works. ⌘/Ctrl+B, I, U,
// Shift+X and K format the selection. A note with a table stays in the plain text box.
// `onKeyDown` and `onPaste` see the keys and pastes first (preventDefault to keep them).
// With `hashtags`, typing # offers the tags already on notes you can see, most used first
// (↑↓ to move, Enter or Tab to pick, Esc to close).
const MarkdownEditor = forwardRef(function MarkdownEditor(props, ref) {
  const [plain] = useState(() => !editorCanHold(props.value));
  if (plain) {
    const { hashtags, ...rest } = props;
    return <MarkdownTextarea ref={ref} {...rest} />;
  }
  return <RichEditor ref={ref} {...props} />;
});

// A # after a space (or at the start), then the tag so far, right before the cursor, the
// way app/models/hashtags.rb finds them
const TAG_BEFORE_CURSOR = /(?:^|[^\p{L}\p{N}_&#/])#(\p{L}[\p{L}\p{N}_]{0,49}|)$/u;

// The tags starting with `query` on notes you can see, kept for a while so typing back
// and forth doesn't ask again
const tagCache = new Map();
function suggestTags(query) {
  const hit = tagCache.get(query);
  if (hit && Date.now() - hit.at < 60_000) return Promise.resolve(hit.items);
  return api(`/hashtags?q=${encodeURIComponent(query)}`)
    .then((d) => { tagCache.set(query, { at: Date.now(), items: d.hashtags }); return d.hashtags; })
    .catch(() => []);
}

const RichEditor = forwardRef(function RichEditor({
  value, onChange, onKeyDown, onPaste, minRows = 3, placeholder = "", autoFocus = false, className = "",
  "aria-label": ariaLabel, hashtags = false,
}, ref) {
  const wrapRef = useRef(null);
  const sent = useRef(value || ""); // the Markdown last given to onChange
  const handlers = useRef({});
  handlers.current = { onChange, onKeyDown, onPaste };
  const [bar, setBar] = useState(null); // { top, left } while text is selected
  const [linking, setLinking] = useState(null); // { from, to, url } while asking for a link
  const [tags, setTags] = useState(null); // { from, to, query, items, index, top, left } while typing a #tag
  const tagsRef = useRef(null);
  tagsRef.current = tags;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, horizontalRule: false }),
      Underline,
      StrikeKey,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } }),
      Placeholder.configure({ placeholder }),
    ],
    content: markdownToNoteHtml(value),
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: `wb-hl-note__input wb-md-input__text wb-md-editor ${className}`,
        style: `min-height: ${minRows * 1.5 + 1.2}em`,
        role: "textbox",
        "aria-multiline": "true",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      },
      handleKeyDown: (view, event) => {
        if (tagsRef.current?.items.length && pickTagKey(event)) return true;
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
          event.preventDefault();
          askLink();
          return true;
        }
        event.nativeEvent = event;
        handlers.current.onKeyDown?.(event);
        return event.defaultPrevented;
      },
      handlePaste: (view, event) => {
        handlers.current.onPaste?.(event);
        if (event.defaultPrevented) return true;
        // Markdown pasted as plain text comes in formatted
        const data = event.clipboardData;
        const pasted = data?.getData("text/plain");
        if (pasted && !data.getData("text/html") && looksLikeMarkdown(pasted)) {
          editorRef.current?.commands.insertContent(markdownToNoteHtml(pasted));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      const markdown = e.isEmpty ? "" : noteJsonToMarkdown(e.getJSON());
      sent.current = markdown;
      handlers.current.onChange?.(markdown);
    },
  });
  const editorRef = useRef(null);
  editorRef.current = editor;

  // A value from outside (cleared after posting, or put back on Cancel) replaces what's there
  useEffect(() => {
    if (!editor || (value || "") === sent.current) return;
    sent.current = value || "";
    editor.commands.setContent(markdownToNoteHtml(value), false);
  }, [editor, value]);

  useImperativeHandle(ref, () => ({ focus: () => editor?.commands.focus("end") }), [editor]);

  const place = useCallback(() => {
    if (!editor || !wrapRef.current) return;
    const { from, empty } = editor.state.selection;
    if (empty || !editor.isFocused) { setBar(null); return; }
    const box = wrapRef.current.getBoundingClientRect();
    const start = editor.view.coordsAtPos(from);
    const width = wrapRef.current.clientWidth;
    setBar({ top: Math.max(start.top - box.top, 0), left: Math.min(Math.max(start.left - box.left - 8, 0), Math.max(width - 190, 0)) });
  }, [editor]);

  useEffect(() => {
    if (!editor) return undefined;
    const hide = () => setTimeout(place, 0);
    editor.on("selectionUpdate", place);
    editor.on("focus", place);
    editor.on("blur", hide);
    return () => { editor.off("selectionUpdate", place); editor.off("focus", place); editor.off("blur", hide); };
  }, [editor, place]);

  // The #tag being typed just before the cursor, if any, and the tags it could be
  useEffect(() => {
    if (!editor || !hashtags) return undefined;
    let timer;
    let current = 0;
    const look = () => {
      clearTimeout(timer);
      const { $from, empty } = editor.state.selection;
      const before = empty && !editor.isActive("code") && $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
      const typed = before && before.match(TAG_BEFORE_CURSOR);
      if (!typed || !editor.isFocused) { setTags(null); return; }
      const query = typed[1].toLowerCase();
      const from = $from.pos - typed[1].length - 1;
      const box = wrapRef.current?.getBoundingClientRect();
      const at = editor.view.coordsAtPos(from);
      const spot = box ? { top: at.bottom - box.top, left: Math.max(Math.min(at.left - box.left, (wrapRef.current.clientWidth || 0) - 240), 0) } : { top: 0, left: 0 };
      setTags((t) => ({ items: t?.query === query ? t.items : t?.items || [], index: t?.query === query ? t.index : 0, ...spot, from, to: $from.pos, query }));
      const asked = ++current;
      timer = setTimeout(() => {
        suggestTags(query).then((items) => {
          if (asked === current) setTags((t) => (t && t.query === query ? { ...t, items, index: Math.min(t.index, Math.max(items.length - 1, 0)) } : t));
        });
      }, 120);
    };
    const close = () => setTimeout(() => { if (!editor.isFocused) setTags(null); }, 150);
    editor.on("selectionUpdate", look);
    editor.on("update", look);
    editor.on("blur", close);
    return () => { clearTimeout(timer); editor.off("selectionUpdate", look); editor.off("update", look); editor.off("blur", close); };
  }, [editor, hashtags]);

  const pickTag = (name) => {
    const t = tagsRef.current;
    if (!t || !editor) return;
    setTags(null);
    editor.chain().focus().insertContentAt({ from: t.from, to: t.to }, `#${name} `).run();
  };

  // ↑↓ move through the suggestions, Enter or Tab picks one, Esc closes them
  function pickTagKey(event) {
    const t = tagsRef.current;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const step = event.key === "ArrowDown" ? 1 : -1;
      setTags({ ...t, index: (t.index + step + t.items.length) % t.items.length });
    } else if (event.key === "Enter" || event.key === "Tab") {
      if (event.metaKey || event.ctrlKey) return false;
      pickTag(t.items[t.index].name);
    } else if (event.key === "Escape") {
      setTags(null);
    } else return false;
    event.preventDefault();
    return true;
  }

  function askLink() {
    const e = editorRef.current;
    if (!e) return;
    if (e.isActive("link")) { e.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    const { from, to } = e.state.selection;
    setLinking({ from, to, url: "" });
  }

  const applyLink = () => {
    const { from, to } = linking;
    let url = linking.url.trim();
    setLinking(null);
    if (!url) { editor.commands.focus(); return; }
    if (!/^(https?:\/\/|mailto:)/i.test(url)) url = `https://${url}`;
    const chain = editor.chain().focus();
    if (from === to) chain.insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }).run();
    else chain.setTextSelection({ from, to }).setLink({ href: url }).run();
  };

  if (!editor) return null;
  return (
    <div ref={wrapRef} className="wb-md-input">
      <EditorContent editor={editor} />
      {tags?.items.length > 0 && (
        <ul className="wb-tag-suggest" style={{ top: tags.top, left: tags.left }} role="listbox" aria-label="Hashtags"
          onMouseDown={(e) => e.preventDefault()}>
          {tags.items.map((item, i) => (
            <li key={item.name} role="option" aria-selected={i === tags.index}>
              <button type="button" onClick={() => pickTag(item.name)} onMouseEnter={() => setTags((t) => t && { ...t, index: i })}>
                <span className="wb-tag-suggest__name">#{item.name}</span>
                <span className="wb-tag-suggest__count">· {item.count.toLocaleString()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(bar || linking) && (
        <div className="wb-md-input__bar" style={{ top: bar?.top ?? 0, left: bar?.left ?? 0 }} role="toolbar" aria-label="Format the selected text"
          onMouseDown={(e) => { if (e.target.tagName !== "INPUT") e.preventDefault(); }}>
          {linking ? (
            <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); applyLink(); }}>
              <input autoFocus type="url" inputMode="url" placeholder="Paste a link" value={linking.url} aria-label="Link"
                onChange={(e) => setLinking((l) => ({ ...l, url: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setLinking(null); editor.commands.focus(); } }} />
              <button type="submit" className="wb-md-input__btn wb-md-input__btn--text">Add</button>
            </form>
          ) : (
            <>
              {MARKS.map((m) => {
                const Icon = m.icon;
                const on = editor.isActive(m.mark);
                return (
                  <button key={m.mark} type="button" className="wb-md-input__btn" aria-pressed={on} aria-label={m.label} title={m.label}
                    onClick={() => m.toggle(editor.chain().focus()).run()}>
                    <Icon size={15} aria-hidden="true" />
                  </button>
                );
              })}
              <button type="button" className="wb-md-input__btn" aria-pressed={editor.isActive("link")} onClick={askLink}
                aria-label={editor.isActive("link") ? "Remove link" : "Link"} title={editor.isActive("link") ? "Remove link" : "Link"}>
                <Link2 size={15} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default MarkdownEditor;
