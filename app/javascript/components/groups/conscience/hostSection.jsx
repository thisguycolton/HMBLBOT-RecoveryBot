// The Hosting Command Center's sections, in the document editor: Insert > Add Section puts a
// section mark in a meeting's format (a dashed line with a small tag naming it), and the Command
// Center cuts the script at them. Clicking the tag opens the section's title and conditions: the
// day's reading / activity spot, which activities or days it's for, and a reminder at a time in
// the meeting (the Burning Desire, 30 minutes in). Stored as an empty
// <div data-hc-section data-title=... data-kind=... data-when=... data-days=... data-cue=...>,
// which the server keeps (DocumentHtml) and documents.css draws when the text is shown as HTML.
// Also here: forms the hosts fill in right in the script (Insert > Milestone Form: who's
// celebrating, as the Command Center's milestones sidebar has it), stored as an empty
// <div data-hc-form="milestones">; and {{ milestones }}-style dynamic values shown as chips, and
// Insert > Dynamic Values.
import React, { useEffect, useRef, useState } from "react";
import { Node, Extension, mergeAttributes } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { AlarmClock, CalendarDays, Filter, PartyPopper, Plus, Sparkles, Trash2, Braces, X } from "lucide-react";
import { ACTIVITY_CONDITIONS, WEEKDAYS, cueLabel, offeredValues, parseCue, valueToken } from "../hosting/lib";
import { api } from "../lib";

const list = (text) => String(text || "").split(",").map((x) => x.trim()).filter(Boolean);
const chip = "rounded-full px-2.5 py-1 text-xs font-medium ring-1";
const chipOn = "!bg-accent/15 text-accent ring-accent/40 dark:!bg-accent/30 dark:text-white";
const chipOff = "!bg-white text-slate-600 ring-neutral-300 hover:ring-accent/40 dark:!bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700";
const field = "w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white";
const small = "text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";

// What a section's tag says beside its title: the spot, its conditions, its reminder
function summary(attrs) {
  const when = list(attrs.when);
  const days = list(attrs.days).map(Number);
  return [
    attrs.kind === "activity" && { icon: Sparkles, text: "Reading / activity" },
    when.length > 0 && { icon: Filter, text: when.map((w) => ACTIVITY_CONDITIONS.find(([k]) => k === w)?.[1] || w).join(" or ") },
    days.length > 0 && { icon: CalendarDays, text: days.map((d) => WEEKDAYS[d]).join(", ") },
    parseCue(attrs.cue) && { icon: AlarmClock, text: cueLabel(parseCue(attrs.cue)) },
  ].filter(Boolean);
}

function SectionView({ node, updateAttributes, deleteNode, editor, getPos }) {
  const attrs = node.attrs;
  const editable = editor.isEditable;
  const [open, setOpen] = useState(editable && !attrs.title);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  // An untitled section gets a name when its box closes
  useEffect(() => { if (!open && editable && !attrs.title) updateAttributes({ title: "Untitled section" }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Its number among the document's sections
  let number = 0;
  try {
    const pos = getPos();
    editor.state.doc.nodesBetween(0, pos + 1, (n) => { if (n.type.name === "hostSection") number += 1; });
  } catch { /* not placed yet */ }

  const when = list(attrs.when);
  const days = list(attrs.days).map(Number);
  const cue = parseCue(attrs.cue);
  const toggle = (key, values, value) => {
    const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
    updateAttributes({ [key]: next.length ? (key === "days" ? next.sort((a, b) => a - b) : next).join(",") : null });
  };
  const setCue = (from, minutes) => updateAttributes({ cue: from ? `${from}${minutes >= 0 ? "+" : ""}${minutes}` : null });
  const cueFrom = cue ? (cue.from === "start" ? "start" : "end") : "";
  const cueMinutes = cue ? Math.abs(cue.minutes) : 30;
  const tags = summary(attrs);

  return (
    <NodeViewWrapper className="hc-sec" data-drag-handle="" contentEditable={false}>
      <div ref={ref} className="hc-sec__line">
        <button type="button" className={`hc-sec__tag ${open ? "hc-sec__tag--open" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}
          title={editable ? "Section: click to change it" : "A section of the HostDeck script"}>
          <span className="hc-sec__num">§{number || ""}</span>
          <span className="hc-sec__title">{attrs.title || "New section"}</span>
          {tags.map(({ icon: Icon, text }) => <span key={text} className="hc-sec__cond"><Icon className="size-3" /> {text}</span>)}
        </button>
        {open && (
          <div className="hc-sec__pop" role="dialog" aria-label="Section">
            {editable ? (
              <div className="space-y-3">
                <div>
                  <label className={small} htmlFor={`sec-title-${number}`}>Section title</label>
                  <input id={`sec-title-${number}`} className={field} autoFocus={!attrs.title} maxLength={80} value={attrs.title || ""} placeholder="Top of the hour"
                    onChange={(e) => updateAttributes({ title: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); setOpen(false); editor.commands.focus(); } }} />
                </div>
                <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-neutral-200">
                  <input type="checkbox" className="mt-0.5" checked={attrs.kind === "activity"} onChange={(e) => updateAttributes({ kind: e.target.checked ? "activity" : null })} />
                  <span>Today's reading / activity goes here<span className="block text-xs text-slate-500 dark:text-neutral-400">The hosts pick it in this section. What you write in it shows above the pick.</span></span>
                </label>
                <div>
                  <span className={`${small} block`}>Only when today's activity is</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {ACTIVITY_CONDITIONS.map(([key, text]) => (
                      <button key={key} type="button" aria-pressed={when.includes(key)} className={`${chip} ${when.includes(key) ? chipOn : chipOff}`} onClick={() => toggle("when", when, key)}>{text}</button>
                    ))}
                  </div>
                  <span className="block mt-1 text-xs text-slate-500 dark:text-neutral-400">{when.length ? "Skipped on other days, like a speaker's introduction." : "None picked: every meeting."}</span>
                </div>
                <div>
                  <span className={`${small} block`}>Only on</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {WEEKDAYS.map((d, i) => (
                      <button key={d} type="button" aria-pressed={days.includes(i)} className={`${chip} !px-2 ${days.includes(i) ? chipOn : chipOff}`} onClick={() => toggle("days", days, i)}>{d}</button>
                    ))}
                  </div>
                  <span className="block mt-1 text-xs text-slate-500 dark:text-neutral-400">{days.length ? "For a format shared by several meetings." : "None picked: every day."}</span>
                </div>
                <div>
                  <span className={`${small} block`}>Remind the host</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {cueFrom && <input aria-label="Minutes" type="number" min={0} max={300} className={`${field} !w-20`} value={cueMinutes}
                      onChange={(e) => setCue(cueFrom, (cueFrom === "end" ? -1 : 1) * Math.min(Math.max(Number(e.target.value) || 0, 0), 300))} />}
                    <select aria-label="When" className={field} value={cueFrom} onChange={(e) => setCue(e.target.value, (e.target.value === "end" ? -1 : 1) * (cue ? cueMinutes : e.target.value === "end" ? 10 : 30))}>
                      <option value="">No reminder</option>
                      <option value="start">minutes after the start</option>
                      <option value="end">minutes before the end</option>
                    </select>
                  </div>
                  <span className="block mt-1 text-xs text-slate-500 dark:text-neutral-400">HostDeck tells the hosts when it's time, like the Burning Desire 30 minutes in.</span>
                </div>
                <div className="flex items-center gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
                  <button type="button" className="inline-flex items-center gap-1 rounded-lg !bg-transparent px-2 py-1 text-xs font-medium text-rose-700 hover:!bg-rose-50 dark:text-rose-300 dark:hover:!bg-rose-950/40" onClick={() => deleteNode()}><Trash2 className="size-3.5" /> Remove the section</button>
                  <span className="flex-1" />
                  <button type="button" className="rounded-lg !bg-accent px-3 py-1 text-xs font-semibold !text-white" onClick={() => { setOpen(false); editor.commands.focus(); }}>Done</button>
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-sm text-slate-700 dark:text-neutral-200">
                <span className="block font-semibold">{attrs.title}</span>
                <span className="block text-xs text-slate-500 dark:text-neutral-400">A section of the meeting's script in HostDeck{tags.length ? ":" : "."}</span>
                {tags.map(({ icon: Icon, text }) => <span key={text} className="flex items-center gap-1.5 text-xs"><Icon className="size-3.5" /> {text}</span>)}
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

const dataAttr = (name) => ({ default: null, parseHTML: (el) => el.getAttribute(`data-${name}`) || null, renderHTML: (a) => (a[name] ? { [`data-${name}`]: a[name] } : {}) });

export const HostSection = Node.create({
  name: "hostSection",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { title: dataAttr("title"), kind: dataAttr("kind"), when: dataAttr("when"), days: dataAttr("days"), cue: dataAttr("cue") };
  },
  parseHTML() { return [{ tag: "div[data-hc-section]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes({ "data-hc-section": "" }, HTMLAttributes)]; },
  addNodeView() { return ReactNodeViewRenderer(SectionView); },
  addCommands() {
    return { addHostSection: () => ({ commands }) => commands.insertContent({ type: this.name, attrs: { title: "" } }) };
  },
});

// A form in the script: in the document, a card standing in for it (what the hosts will see
// there); in the Command Center, the real form (CommandCenter.jsx's ScriptView)
export const HOST_FORMS = { milestones: { title: "Milestone form", text: "The hosts add who's celebrating and their time here, while they read the script. It's the same list as HostDeck's Celebrating milestones." } };

function FormView({ node, deleteNode, editor }) {
  const form = HOST_FORMS[node.attrs.form] || HOST_FORMS.milestones;
  return (
    <NodeViewWrapper className="hc-form" data-drag-handle="" contentEditable={false}>
      <div className="hc-form__head">
        <PartyPopper className="size-4 shrink-0" />
        <span className="hc-form__title">{form.title}</span>
        <span className="flex-1" />
        {editor.isEditable && <button type="button" className="hc-form__remove" onClick={() => deleteNode()} aria-label={`Remove the ${form.title.toLowerCase()}`} title="Remove"><Trash2 className="size-3.5" /></button>}
      </div>
      <p className="hc-form__text">{form.text}</p>
      <div className="hc-form__mock" aria-hidden="true">
        <span>Screen name</span><span>Time</span><span className="hc-form__plus"><Plus className="size-3.5" /></span>
      </div>
    </NodeViewWrapper>
  );
}

export const HostForm = Node.create({
  name: "hostForm",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { form: { default: "milestones", parseHTML: (el) => el.getAttribute("data-hc-form") || "milestones", renderHTML: (a) => ({ "data-hc-form": a.form }) } };
  },
  parseHTML() { return [{ tag: "div[data-hc-form]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", HTMLAttributes]; },
  addNodeView() { return ReactNodeViewRenderer(FormView); },
  addCommands() {
    return { addHostForm: (form = "milestones") => ({ commands }) => commands.insertContent({ type: this.name, attrs: { form } }) };
  },
});

// {{ milestones }} and the other dynamic values, shown as chips while writing and reading
const TOKEN = /\{\{\s*[a-z0-9_]+\s*\}\}/gi;
export const ValueTokens = Extension.create({
  name: "valueTokens",
  addProseMirrorPlugins() {
    const find = (doc) => {
      const found = [];
      doc.descendants((n, pos) => {
        if (!n.isText) return;
        for (const m of n.text.matchAll(TOKEN)) found.push(Decoration.inline(pos + m.index, pos + m.index + m[0].length, { class: "doc-token" }));
      });
      return DecorationSet.create(doc, found);
    };
    return [new Plugin({
      state: { init: (_, { doc }) => find(doc), apply: (tr, old) => (tr.docChanged ? find(tr.doc) : old) },
      props: { decorations(state) { return this.getState(state); } },
    })];
  },
});

// Insert > Dynamic Values: a row of the values the group's Command Center settings allow, under
// the toolbar. Clicking one puts it where the cursor is.
export function DynamicValuesBar({ editor, slug, documentId, onClose }) {
  const [values, setValues] = useState(null);
  useEffect(() => {
    api(`/groups/${slug}/hosting/values${documentId ? `?document_id=${documentId}` : ""}`)
      .then((d) => setValues(offeredValues(d.allowed, d.roles)))
      .catch(() => setValues(offeredValues(null, [])));
  }, [slug, documentId]);
  if (!editor) return null;
  return (
    <div role="toolbar" aria-label="Dynamic values" className="flex items-center gap-1.5 overflow-x-auto border-t border-neutral-200 px-2 py-1.5 dark:border-neutral-800">
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600 dark:text-neutral-300"><Braces className="size-4 text-accent" /> Dynamic values</span>
      {(values || []).map((v) => (
        <button key={v.key} type="button" title={`${valueToken(v.key)}: ${v.what}`} onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().insertContent(valueToken(v.key)).run()}
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${v.service ? "!bg-cyan-100 text-cyan-900 dark:!bg-cyan-900/40 dark:text-cyan-100" : "!bg-sky-100 text-sky-900 dark:!bg-sky-900/40 dark:text-sky-100"} hover:opacity-80`}>
          {v.label}
        </button>
      ))}
      {values && values.length === 0 && <span className="text-xs text-slate-500">None allowed. A host coordinator turns them on in HostDeck's settings.</span>}
      <span className="flex-1" />
      <button type="button" onClick={onClose} aria-label="Close dynamic values" className="grid size-7 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-500 hover:!bg-neutral-200/70 dark:hover:!bg-neutral-700/60"><X className="size-4" /></button>
    </div>
  );
}
