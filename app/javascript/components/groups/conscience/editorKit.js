// The document editor's Tiptap setup: what a word processor's page needs and no more (the
// server keeps the same set, DocumentHtml::TAGS).
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { Extension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";

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
          renderHTML: (attrs) => (attrs.color ? { style: `color: ${attrs.color}` } : {}),
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

// The colors the toolbar offers: readable on the white page, and the same in print
export const TEXT_COLORS = [
  ["Black", "#0f172a"], ["Gray", "#64748b"], ["Red", "#dc2626"], ["Orange", "#ea580c"], ["Green", "#16a34a"],
  ["Teal", "#0d9488"], ["Blue", "#2563eb"], ["Purple", "#7c3aed"], ["Pink", "#db2777"],
];
export const HIGHLIGHT_COLORS = [
  ["Yellow", "#fef08a"], ["Green", "#bbf7d0"], ["Blue", "#bfdbfe"], ["Pink", "#fbcfe8"], ["Orange", "#fed7aa"], ["Purple", "#ddd6fe"], ["Gray", "#e2e8f0"],
];

export const documentExtensions = (placeholder = "Start typing…") => [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false }),
  Underline,
  TextStyle,
  TextColor,
  Highlight.configure({ multicolor: true }),
  Link.configure({ openOnClick: false, autolink: true, protocols: ["mailto"], HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Placeholder.configure({ placeholder }),
];

// A link as someone types it ("example.com", "me@example.com") made into one the editor keeps
export function normalizeHref(value) {
  const v = value.trim();
  if (!v) return "";
  if (/^(https?:|mailto:|\/|#)/i.test(v)) return v;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? `mailto:${v}` : `https://${v}`;
}
