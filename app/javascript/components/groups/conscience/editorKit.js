// The document editor's Tiptap setup: what a word processor's page needs and no more (the
// server keeps the same set, DocumentHtml::TAGS).
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { looksLikeMarkdown, markdownToEditorHtml } from "../../../lib/markdownHtml";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { HostForm, HostSection, ValueTokens } from "./hostSection";
import { Collapsible, CollapsibleSummary } from "./collapsible";
import { swatches, toneAttrs } from "./docColors";

// Text color, kept as style="color: ..." on a <span> (the server keeps that, DocumentHtml)
const TextColor = Extension.create({
  name: "textColor",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        color: {
          default: null,
          parseHTML: (el) => el.style.color || null,
          renderHTML: (attrs) => (attrs.color ? { style: `color: ${attrs.color}`, ...toneAttrs(attrs.color, "text") } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setTextColor: (color) => ({ chain }) => chain().setMark("textStyle", { color }).run(),
      unsetTextColor: () => ({ chain }) => chain().setMark("textStyle", { color: null }).removeEmptyTextStyle().run(),
    };
  },
});

// The colors the toolbar offers: readable on the white page, and the same in print. On the dark
// page each shows in its own dark tone (docColors.js).
export const TEXT_COLORS = swatches("text");
export const HIGHLIGHT_COLORS = swatches("mark");

// A highlight also says its tone, for the dark page
const ToneHighlight = Highlight.extend({
  addAttributes() {
    const parent = this.parent?.() || {};
    return {
      ...parent,
      color: {
        ...parent.color,
        renderHTML: (attrs) => (attrs.color ? { "data-color": attrs.color, style: `background-color: ${attrs.color}; color: inherit`, ...toneAttrs(attrs.color, "mark") } : {}),
      },
    };
  },
});

// Table cells keep their own fill, border and width as inline style (the server keeps those)
const cellStyle = {
  backgroundColor: { default: null, parseHTML: (el) => el.style.backgroundColor || null, renderHTML: (a) => (a.backgroundColor ? { style: `background-color: ${a.backgroundColor}`, ...toneAttrs(a.backgroundColor, "fill") } : {}) },
  borderColor: { default: null, parseHTML: (el) => el.style.borderColor || null, renderHTML: (a) => (a.borderColor ? { style: `border-color: ${a.borderColor}`, ...toneAttrs(a.borderColor, "border") } : {}) },
  borderWidth: { default: null, parseHTML: (el) => el.style.borderWidth || null, renderHTML: (a) => (a.borderWidth ? { style: `border-width: ${a.borderWidth}; border-style: ${a.borderWidth === "0px" ? "none" : "solid"}` } : {}) },
  cellWidth: { default: null, parseHTML: (el) => el.style.width || null, renderHTML: (a) => (a.cellWidth ? { style: `width: ${a.cellWidth}` } : {}) },
  verticalAlign: { default: null, parseHTML: (el) => el.style.verticalAlign || null, renderHTML: (a) => (a.verticalAlign ? { style: `vertical-align: ${a.verticalAlign}` } : {}) },
};
const StyledCell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), ...cellStyle }; } });
const StyledHeader = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), ...cellStyle }; } });

// [name, light value, tone]; null takes the color off
export const CELL_FILLS = [["None", null], ...swatches("fill")];
export const BORDER_COLORS = [["Default", null], ...swatches("border")];
export const BORDER_WIDTHS = [["Default", null], ["None", "0px"], ["Thin", "1px"], ["Medium", "2px"], ["Thick", "3px"]];
export const CELL_WIDTHS = [["Auto", null], ["Narrow", "15%"], ["Medium", "30%"], ["Wide", "50%"]];

// Pasting Markdown (from a .md file, ChatGPT, a notes app) turns it into real headings, lists,
// quotes and tables. Formatted pastes (from Word, a web page) are left to the editor as before.
const MarkdownPaste = Extension.create({
  name: "markdownPaste",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [new Plugin({
      props: {
        handlePaste(view, event) {
          const data = event.clipboardData;
          if (!data || data.types.includes("text/html") && !/^\s*<(meta|pre|code)/i.test(data.getData("text/html"))) return false;
          const text = data.getData("text/plain");
          if (!looksLikeMarkdown(text)) return false;
          editor.commands.insertContent(markdownToEditorHtml(text), { parseOptions: { preserveWhitespace: false } });
          return true;
        },
      },
    })];
  },
});

// `live`: extensions for editing together (liveExtensions), which bring their own undo
export const documentExtensions = (placeholder = "Start typing…", live = []) => [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false, ...(live.length ? { history: false } : {}) }),
  Underline,
  TextStyle,
  TextColor,
  ToneHighlight.configure({ multicolor: true }),
  MarkdownPaste,
  Link.configure({ openOnClick: false, autolink: true, protocols: ["mailto"], HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Table.configure({ resizable: false }),
  TableRow,
  StyledHeader,
  StyledCell,
  Placeholder.configure({ placeholder }),
  // Insert > Collapsible text: a line to tap that shows or hides the text under it
  Collapsible,
  CollapsibleSummary,
  // the Hosting Command Center's sections, forms and dynamic values, for a meeting's format
  HostSection,
  HostForm,
  ValueTokens,
  ...live,
];

// A link as someone types it ("example.com", "me@example.com") made into one the editor keeps
export function normalizeHref(value) {
  const v = value.trim();
  if (!v) return "";
  if (/^(https?:|mailto:|\/|#)/i.test(v)) return v;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? `mailto:${v}` : `https://${v}`;
}
