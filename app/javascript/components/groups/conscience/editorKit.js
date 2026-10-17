// The document editor's Tiptap setup: what a word processor's page needs and no more (the
// server keeps the same set, DocumentHtml::TAGS).
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";

export const documentExtensions = (placeholder = "Start typing…") => [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false }),
  Underline,
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
