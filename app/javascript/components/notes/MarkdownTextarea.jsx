import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Bold, Highlighter, Italic, Link2, Strikethrough, Type, Underline, X } from "lucide-react";
import { BACKGROUND_COLORS, TEXT_COLORS, formatAttrs, parseAttrs } from "../groups/hosting/chatFormat";

// Markdown each button wraps the selection in (`++` is underline in book/Markdown.jsx)
const MARKS = [
  { key: "b", label: "Bold", icon: Bold, wrap: "**" },
  { key: "i", label: "Italic", icon: Italic, wrap: "*" },
  { key: "u", label: "Underline", icon: Underline, wrap: "++" },
  { key: "x", label: "Strikethrough", icon: Strikethrough, wrap: "~~", shift: true },
];

// Where `position` in a textarea's text sits on screen, relative to the textarea: a hidden
// copy with the same type styles, measured up to that character
export function caretCoords(textarea, position) {
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
// Markdown in for you (⌘/Ctrl+B, I, U, Shift+X and K do the same). With `colors`, the pill also
// has text and highlight colors, written as [text]{color=#dc2626 bg=#fef08a} (chat postings: see
// groups/hosting/chatFormat.js). Other props go to the textarea.
const MarkdownTextarea = forwardRef(function MarkdownTextarea({ value, onChange, onKeyDown, minRows = 3, className = "", colors = false, ...rest }, ref) {
  const textRef = useRef(null);
  const [bar, setBar] = useState(null); // { top, left } while text is selected
  const [linking, setLinking] = useState(null); // { start, end, url } while asking for a link
  const [picking, setPicking] = useState(null); // "color" | "bg" while choosing a color
  useImperativeHandle(ref, () => textRef.current);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  const place = useCallback(() => {
    const el = textRef.current;
    if (!el || el.selectionStart === el.selectionEnd || document.activeElement !== el) { setBar(null); setPicking(null); return; }
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
    // Bold and italic share `*`, so count the run of them around the selection: ***both***
    // is bold (2) and italic (1), and each button takes off or adds only its own
    if (w[0] === "*") {
      const left = value.slice(0, start).match(/\*{0,3}$/)[0].length;
      const right = value.slice(end).match(/^\*{0,3}/)[0].length;
      const has = (n) => (w.length === 2 ? n >= 2 : n % 2 === 1);
      if (has(left) && has(right)) return replace(start - w.length, end + w.length, picked, [0, picked.length]);
      if (left || right) return replace(start, end, `${w}${picked}${w}`, [w.length, w.length + picked.length]);
      const inLeft = picked.match(/^\*{0,3}/)[0].length;
      const inRight = picked.match(/\*{0,3}$/)[0].length;
      if (picked.length > inLeft + inRight && inLeft && inRight) {
        if (has(inLeft) && has(inRight)) {
          const inner = picked.slice(0, inLeft - w.length) + picked.slice(inLeft, -inRight) + picked.slice(picked.length - inRight + w.length);
          return replace(start, end, inner, [0, inner.length]);
        }
        const next = `${picked.slice(0, inLeft)}${w}${picked.slice(inLeft, -inRight)}${w}${picked.slice(-inRight)}`;
        return replace(start, end, next, [0, next.length]);
      }
    }
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

  // Sets (or, with no hex, takes off) the selection's text color or highlight. A selection inside
  // a [text]{...} span, or the whole span, changes that span's colors; anything else gets a new one.
  const paint = (key, hex) => {
    const el = textRef.current;
    const [start, end] = [el.selectionStart, el.selectionEnd];
    const picked = value.slice(start, end);
    setPicking(null);
    const change = (attrs) => formatAttrs({ ...attrs, [key]: hex || undefined });
    const after = value.slice(end).match(/^\]\{([^}\n]*)\}/);
    if (value[start - 1] === "[" && after) {
      const attrs = change(parseAttrs(after[1]));
      return replace(start - 1, end + after[0].length, attrs ? `[${picked}]{${attrs}}` : picked, [1, 1 + picked.length]);
    }
    const whole = picked.match(/^\[([^\]\n]+)\]\{([^}\n]*)\}$/);
    if (whole) {
      const attrs = change(parseAttrs(whole[2]));
      const text = attrs ? `[${whole[1]}]{${attrs}}` : whole[1];
      return replace(start, end, text, [attrs ? 1 : 0, (attrs ? 1 : 0) + whole[1].length]);
    }
    if (!hex) return;
    const lead = picked.match(/^\s*/)[0];
    const trail = picked.slice(lead.length).match(/\s*$/)[0];
    const core = picked.slice(lead.length, picked.length - trail.length) || "text";
    replace(start, end, `${lead}[${core}]{${key}=${hex}}${trail}`, [lead.length + 1, lead.length + 1 + core.length]);
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
          {picking ? (
            <div className="flex items-center gap-1" role="group" aria-label={picking === "color" ? "Text color" : "Highlight color"}>
              {(picking === "color" ? TEXT_COLORS : BACKGROUND_COLORS).map(([name, hex]) => (
                <button key={hex} type="button" className="wb-md-input__swatch" style={{ background: hex }} onClick={() => paint(picking, hex)} aria-label={name} title={name} />
              ))}
              <button type="button" className="wb-md-input__btn" onClick={() => paint(picking, null)} aria-label="No color" title="No color"><X size={15} aria-hidden="true" /></button>
            </div>
          ) : linking ? (
            // Not a <form>: this box usually sits inside one (a note, a chat message), and a form in
            // a form submits the outer one, or the browser refuses "aa.org" as a web address
            <div className="flex items-center gap-1" role="group" aria-label="Add a link">
              <input autoFocus type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                placeholder="Paste a link" value={linking.url} aria-label="Link"
                onChange={(e) => setLinking((l) => ({ ...l, url: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); applyLink(); }
                  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setLinking(null); textRef.current?.focus(); }
                }} />
              <button type="button" className="wb-md-input__btn wb-md-input__btn--text" onClick={applyLink}>Add</button>
            </div>
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
              {colors && (
                <>
                  <button type="button" className="wb-md-input__btn" onClick={() => setPicking("color")} aria-label="Text color" title="Text color"><Type size={15} aria-hidden="true" /></button>
                  <button type="button" className="wb-md-input__btn" onClick={() => setPicking("bg")} aria-label="Highlight color" title="Highlight color"><Highlighter size={15} aria-hidden="true" /></button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default MarkdownTextarea;
