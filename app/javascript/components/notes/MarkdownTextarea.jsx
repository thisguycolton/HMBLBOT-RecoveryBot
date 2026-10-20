import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Bold, Italic, Link2, Strikethrough, Underline } from "lucide-react";

// Markdown each button wraps the selection in (`++` is underline in book/Markdown.jsx)
const MARKS = [
  { key: "b", label: "Bold", icon: Bold, wrap: "**" },
  { key: "i", label: "Italic", icon: Italic, wrap: "*" },
  { key: "u", label: "Underline", icon: Underline, wrap: "++" },
  { key: "x", label: "Strikethrough", icon: Strikethrough, wrap: "~~", shift: true },
];

// Where `position` in a textarea's text sits on screen, relative to the textarea: a hidden
// copy with the same type styles, measured up to that character
function caretCoords(textarea, position) {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  ["boxSizing", "width", "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight", "paddingTop",
    "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "textTransform", "wordSpacing", "tabSize"].forEach((p) => { mirror.style[p] = style[p]; });
  Object.assign(mirror.style, { position: "absolute", visibility: "hidden", whiteSpace: "pre-wrap", overflowWrap: "break-word", top: "0", left: "-9999px" });
  mirror.textContent = textarea.value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(position) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const coords = { top: marker.offsetTop - textarea.scrollTop, left: marker.offsetLeft };
  document.body.removeChild(mirror);
  return coords;
}

// A note's text box: it grows with what's written (never resized by hand), and selecting
// text brings up Bold, Italic, Underline, Strikethrough and Link above it, which put the
// Markdown in for you (⌘/Ctrl+B, I, U, Shift+X and K do the same). Other props go to the textarea.
const MarkdownTextarea = forwardRef(function MarkdownTextarea({ value, onChange, onKeyDown, minRows = 3, className = "", ...rest }, ref) {
  const textRef = useRef(null);
  const [bar, setBar] = useState(null); // { top, left } while text is selected
  const [linking, setLinking] = useState(null); // { start, end, url } while asking for a link
  useImperativeHandle(ref, () => textRef.current);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  const place = useCallback(() => {
    const el = textRef.current;
    if (!el || el.selectionStart === el.selectionEnd || document.activeElement !== el) { setBar(null); return; }
    const { top, left } = caretCoords(el, el.selectionStart);
    setBar({ top: Math.max(top, 0), left: Math.min(Math.max(left - 8, 0), Math.max(el.clientWidth - 190, 0)) });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", place);
    return () => document.removeEventListener("selectionchange", place);
  }, [place]);

  // Puts `next` in place of start..end and selects `select` (offsets into the new text)
  const replace = (start, end, next, select) => {
    const text = value.slice(0, start) + next + value.slice(end);
    onChange(text);
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + select[0], start + select[1]);
    });
  };

  const wrap = (mark) => {
    const el = textRef.current;
    const [start, end] = [el.selectionStart, el.selectionEnd];
    const picked = value.slice(start, end);
    const w = mark.wrap;
    // Already wrapped (inside or just outside the selection): take it off
    if (picked.length > 2 * w.length && picked.startsWith(w) && picked.endsWith(w)) {
      const inner = picked.slice(w.length, -w.length);
      return replace(start, end, inner, [0, inner.length]);
    }
    if (value.slice(start - w.length, start) === w && value.slice(end, end + w.length) === w) {
      return replace(start - w.length, end + w.length, picked, [0, picked.length]);
    }
    // Markers can't hold the spaces at a selection's edges, so they stay outside
    const lead = picked.match(/^\s*/)[0];
    const trail = picked.slice(lead.length).match(/\s*$/)[0];
    const core = picked.slice(lead.length, picked.length - trail.length) || "text";
    const next = `${lead}${w}${core}${w}${trail}`;
    replace(start, end, next, [lead.length + w.length, lead.length + w.length + core.length]);
  };

  const askLink = () => {
    const el = textRef.current;
    setLinking({ start: el.selectionStart, end: el.selectionEnd, url: "" });
  };
  const applyLink = () => {
    const { start, end } = linking;
    let url = linking.url.trim();
    setLinking(null);
    if (!url) { textRef.current?.focus(); return; }
    if (!/^(https?:\/\/|mailto:)/i.test(url)) url = `https://${url}`;
    const label = value.slice(start, end).trim() || url;
    replace(start, end, `[${label}](${url})`, [1, 1 + label.length]);
  };

  const keyDown = (e) => {
    if (e.metaKey || e.ctrlKey) {
      const k = e.key.toLowerCase();
      const mark = MARKS.find((m) => m.key === k && !!m.shift === e.shiftKey);
      if (mark) { e.preventDefault(); wrap(mark); return; }
      if (k === "k" && !e.shiftKey) { e.preventDefault(); askLink(); return; }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="wb-md-input">
      <textarea ref={textRef} value={value} rows={minRows} className={`wb-hl-note__input wb-md-input__text ${className}`}
        onChange={(e) => onChange(e.target.value)} onKeyDown={keyDown} onMouseUp={place} onKeyUp={place}
        onBlur={() => setTimeout(place, 0)} {...rest} />
      {(bar || linking) && (
        <div className="wb-md-input__bar" style={{ top: bar?.top ?? 0, left: bar?.left ?? 0 }} role="toolbar" aria-label="Format the selected text"
          onMouseDown={(e) => { if (e.target.tagName !== "INPUT") e.preventDefault(); }}>
          {linking ? (
            <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); applyLink(); }}>
              <input autoFocus type="url" inputMode="url" placeholder="Paste a link" value={linking.url} aria-label="Link"
                onChange={(e) => setLinking((l) => ({ ...l, url: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setLinking(null); textRef.current?.focus(); } }} />
              <button type="submit" className="wb-md-input__btn wb-md-input__btn--text">Add</button>
            </form>
          ) : (
            <>
              {MARKS.map((m) => {
                const Icon = m.icon;
                return (
                  <button key={m.key} type="button" className="wb-md-input__btn" onClick={() => wrap(m)} aria-label={m.label} title={m.label}>
                    <Icon size={15} aria-hidden="true" />
                  </button>
                );
              })}
              <button type="button" className="wb-md-input__btn" onClick={askLink} aria-label="Link" title="Link">
                <Link2 size={15} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default MarkdownTextarea;
