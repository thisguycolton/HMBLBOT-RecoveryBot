import React, { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import DocumentToolbar from "./DocumentToolbar";
import { documentExtensions } from "./editorKit";

// The minutes of a meeting: the same editor as a document, in a box instead of a page.
// `onReady` hands the editor to its parent (for "start from the agenda").
export default function MinutesEditor({ html, onChange, onReady }) {
  const editor = useEditor({
    extensions: documentExtensions("Write the minutes here, or start them from the agenda."),
    content: html,
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
    editorProps: { attributes: { class: "doc-prose", "aria-label": "Minutes" } },
  });
  useEffect(() => { if (editor) onReady?.(editor); }, [editor, onReady]);

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200 dark:ring-neutral-700">
      <div className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"><DocumentToolbar editor={editor} /></div>
      <div className="doc-minutes min-h-[16rem] bg-white p-4 sm:p-5"><EditorContent editor={editor} /></div>
    </div>
  );
}
