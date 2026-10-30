import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import MarkdownTextarea, { caretCoords } from "../../notes/MarkdownTextarea";
import { SuggestList, suggestMentions } from "../../notes/MarkdownEditor";

// An @ after a space (or at the start), then the handle so far (app/models/mentions.rb)
const MENTION_BEFORE_CURSOR = /(?:^|[^\p{L}\p{N}_@./&-])@([a-zA-Z0-9-]{0,50})$/u;

// The chat's message box: a plain Markdown text box (MarkdownTextarea, with the format pill)
// where typing @ offers the people in the channel and the group's role handles (`where`:
// { group, channel } for /api/mentions). ↑↓ move, Enter or Tab picks, Esc closes; other keys
// go to `onKeyDown`.
const MentionTextarea = forwardRef(function MentionTextarea({ value, onChange, onKeyDown, where, ...rest }, ref) {
  const textRef = useRef(null);
  const [list, setList] = useState(null); // { from, query, items, index, top, left }
  const asked = useRef(0);
  useImperativeHandle(ref, () => textRef.current);

  const look = (text) => {
    const el = textRef.current;
    if (!el || el.selectionStart !== el.selectionEnd) { setList(null); return; }
    const typed = text.slice(0, el.selectionStart).match(MENTION_BEFORE_CURSOR);
    if (!typed) { setList(null); return; }
    const from = el.selectionStart - typed[1].length - 1;
    const { top, left } = caretCoords(el, from);
    const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 20;
    const n = ++asked.current;
    // Above the box: it sits at the bottom of the screen
    setList((l) => ({ items: l?.items || [], index: 0, from, query: typed[1], bottom: el.offsetHeight - top + 4, left: Math.max(Math.min(left, el.clientWidth - 240), 0), lineHeight }));
    suggestMentions(typed[1], where).then((items) => {
      if (n === asked.current) setList((l) => l && { ...l, items, index: 0 });
    });
  };

  const pick = (item) => {
    const el = textRef.current;
    if (!list || !el) return;
    const end = el.selectionStart;
    const next = `${value.slice(0, list.from)}${item.insert} ${value.slice(end)}`;
    setList(null);
    onChange(next);
    const caret = list.from + item.insert.length + 1;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };

  const keyDown = (e) => {
    if (list?.items.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setList({ ...list, index: (list.index + step + list.items.length) % list.items.length });
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && !e.metaKey && !e.ctrlKey) { e.preventDefault(); pick(list.items[list.index]); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setList(null); return; }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <MarkdownTextarea ref={textRef} value={value} onKeyDown={keyDown} {...rest}
        onChange={(text) => { onChange(text); requestAnimationFrame(() => look(text)); }}
        onBlur={() => setTimeout(() => setList(null), 150)} onClick={() => look(value)} />
      {list?.items.length > 0 && (
        <SuggestList items={list.items} index={list.index} label="People and roles" className="chat-suggest"
          style={{ bottom: list.bottom, left: list.left, top: "auto" }}
          onPick={pick} onHover={(i) => setList((l) => l && { ...l, index: i })} />
      )}
    </div>
  );
});

export default MentionTextarea;
