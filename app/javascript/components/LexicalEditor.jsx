import React, { useEffect, useMemo, useRef, useState } from "react";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import {
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $createParagraphNode, $createTextNode } from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  FORMAT_ELEMENT_COMMAND,
} from "lexical";
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { AutoLinkNode } from "@lexical/link";

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  Pilcrow,
  Quote,
  List,
  ListOrdered,
  ListX,
  AlignLeft,
  AlignCenter,
  Link as LinkIcon,
  Undo,
  Redo
} from "lucide-react";

function Placeholder({ text }) {
  return (
    <div className="pointer-events-none absolute left-4 top-4 text-neutral-400">
      {text}
    </div>
  );
}

function Toolbar() {
  const [editor] = useLexicalComposerContext();
  const [isLinkPromptOpen, setIsLinkPromptOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  function btnClass() {
    return "flex items-center justify-center rounded-md border border-neutral-300 bg-neutral-50 p-2 text-dark dark:bg-neutral-800 dark:text-white dark:border-neutral-600 hover:bg-neutral-200";
  }

  function applyLink() {
    editor.dispatchCommand(
      TOGGLE_LINK_COMMAND,
      linkValue.trim() ? linkValue.trim() : null
    );
    setIsLinkPromptOpen(false);
    setLinkValue("");
  }

  const icon = "w-4 h-4";

  return (
    <div className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 p-2">
      <div className="flex flex-wrap gap-2">

        <button type="button" className={btnClass()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}>
          <Bold className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}>
          <Italic className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}>
          <Underline className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}>
          <Strikethrough className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() =>
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createParagraphNode());
              }
            })
          }>
          <Pilcrow className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() =>
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createHeadingNode("h2"));
              }
            })
          }>
          <Heading2 className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() =>
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) {
                $setBlocksType(selection, () => $createQuoteNode());
              }
            })
          }>
          <Quote className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND)}>
          <List className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND)}>
          <ListOrdered className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() => editor.dispatchCommand(REMOVE_LIST_COMMAND)}>
          <ListX className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left")}>
          <AlignLeft className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")}>
          <AlignCenter className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() => setIsLinkPromptOpen((v) => !v)}>
          <LinkIcon className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() => editor.dispatchCommand(UNDO_COMMAND)}>
          <Undo className={icon} />
        </button>

        <button type="button" className={btnClass()}
          onClick={() => editor.dispatchCommand(REDO_COMMAND)}>
          <Redo className={icon} />
        </button>

      </div>

      {isLinkPromptOpen && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            placeholder="https://example.com"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={applyLink}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

function EditorStateInitializer({ initialHtml }) {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initialHtml || initializedRef.current) return;

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      const parser = new DOMParser();
      const dom = parser.parseFromString(initialHtml, "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);

      root.select();
      root.append(...nodes);
    });

    initializedRef.current = true;
  }, [editor, initialHtml]);

  return null;
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}
function stripDirectionMarkers(text) {
  return text.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "");
}

export default function LexicalEditor({
  value = "",
  onChange,
  placeholder = "Start typing...",
  minHeight = 280,
  namespace = "LexicalEditor",
}) {
  const initialConfig = useMemo(() => ({
  namespace,
  theme: {
    paragraph: "mb-3",
    quote: "border-l-4 border-neutral-300 pl-4 italic text-neutral-600",
    heading: {
      h1: "text-3xl font-bold mb-4",
      h2: "text-2xl font-bold mb-3",
      h3: "text-xl font-semibold mb-2",
    },
    text: {
      bold: "font-bold",
      italic: "italic",
      underline: "underline",
      strikethrough: "line-through",
    },
    link: "text-blue-600 underline",
    list: {
      ul: "list-disc ml-6 mb-3",
      ol: "list-decimal ml-6 mb-3",
      listitem: "mb-1",
    },
  },
  onError(error) {
    console.error(error);
  },
  nodes: [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    CodeNode,
    CodeHighlightNode,
    LinkNode,
    AutoLinkNode,
  ],
}), [namespace]);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:bg-neutral-700 dark:text-light dark:border-neutral-900 text-dark shadow-sm focus:outline-2! focus:outline-offset-2 focus:outline-neutral-900"  dir="ltr">
      <LexicalComposer initialConfig={initialConfig}>
        <Toolbar />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                dir="ltr"
                className="editor-input min-h-[200px] px-4 py-4 outline-none text-left"
                style={{
                  minHeight,
                  direction: "ltr",
                  textAlign: "left",
                  unicodeBidi: "plaintext",
                  writingMode: "horizontal-tb",
                }}
              />
            }
            placeholder={<Placeholder text={placeholder} />}
            ErrorBoundary={({ children }) => <>{children}</>}
          />
          <ListPlugin />
          <HistoryPlugin />
          <EditorStateInitializer initialHtml={value} />
          <OnChangePlugin
            onChange={(editorState, editor) => {
              editorState.read(() => {
                const html = $generateHtmlFromNodes(editor, null);
                onChange?.(html);
              });
            }}
          />
        </div>
      </LexicalComposer>
    </div>
  );
}