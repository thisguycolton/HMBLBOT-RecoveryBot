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
const MarkdownEditor = forwardRef(function MarkdownEditor(props, ref) {
  const [plain] = useState(() => !editorCanHold(props.value));
  if (plain) return <MarkdownTextarea ref={ref} {...props} />;
  return <RichEditor ref={ref} {...props} />;
});

const RichEditor = forwardRef(function RichEditor({
  value, onChange, onKeyDown, onPaste, minRows = 3, placeholder = "", autoFocus = false, className = "",
  "aria-label": ariaLabel,
}, ref) {
  const wrapRef = useRef(null);
  const sent = useRef(value || ""); // the Markdown last given to onChange
  const handlers = useRef({});
  handlers.current = { onChange, onKeyDown, onPaste };
  const [bar, setBar] = useState(null); // { top, left } while text is selected
  const [linking, setLinking] = useState(null); // { from, to, url } while asking for a link

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
