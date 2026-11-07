// The docs editor's Tiptap setup (DocEditor.jsx): Notion-style Markdown. Typing Markdown
// (# , - , 1. , [ ] , > , ```, ---, **bold**) turns into what it means; the content goes in
// and out as Markdown (tiptap-markdown), the way doc_pages.body stores it.
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Markdown } from "tiptap-markdown";

const CALLOUT = /^\[!(tip|note|warning|privacy)\]/i;

// A quote that starts with [!TIP] (or NOTE, WARNING, PRIVACY) looks like the callout it will be
const CalloutLook = Extension.create({
  name: "calloutLook",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("calloutLook"),
        props: {
          decorations(state) {
            const marks = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "blockquote") return true;
              const m = node.firstChild?.textContent.match(CALLOUT);
              if (m) marks.push(Decoration.node(pos, pos + node.nodeSize, { class: `doc-callout doc-callout-${m[1].toLowerCase()}` }));
              return false;
            });
            return DecorationSet.create(state.doc, marks);
          },
        },
      }),
    ];
  },
});

export function docExtensions({ placeholder }) {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noreferrer" } }),
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === "heading" ? "Heading" : placeholder),
      includeChildren: false,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({ inline: false }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    CalloutLook,
    Markdown.configure({ html: false, tightLists: true, bulletListMarker: "-", linkify: true, breaks: false, transformPastedText: true, transformCopiedText: true }),
  ];
}

// The editor's Markdown, tidied: Markdown's escaping turns "[!TIP]" into "\[!TIP\]", which
// still works but is hard to read in the Markdown tab
export const editorMarkdown = (editor) =>
  editor.storage.markdown.getMarkdown().replace(/^(\s*>\s*)\\\[!(tip|note|warning|privacy)\\\]/gim, (_, lead, kind) => `${lead}[!${kind.toUpperCase()}]`);
