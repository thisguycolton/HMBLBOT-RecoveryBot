import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { DraggableBlockPlugin_EXPERIMENTAL } from "@lexical/react/LexicalDraggableBlockPlugin";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import {
  HorizontalRuleNode,
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  INSERT_HORIZONTAL_RULE_COMMAND,
} from "@lexical/react/LexicalHorizontalRuleNode";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $createTextNode,
  $getNearestNodeFromDOMNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  FORMAT_TEXT_COMMAND,
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import { $isLinkNode, AutoLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import {
  HEADING,
  LINK,
  ORDERED_LIST,
  QUOTE,
  TEXT_FORMAT_TRANSFORMERS,
  UNORDERED_LIST,
} from "@lexical/markdown";
import {
  Bold,
  Check,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  Strikethrough,
  Underline,
} from "lucide-react";

// Theme classes end up in the saved HTML, so they stay the same as the old editor's
// to keep the show page rendering identically.
const EDITOR_THEME = {
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
};

const EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  AutoLinkNode,
  HorizontalRuleNode,
];

// "---" on its own line becomes a divider
const HORIZONTAL_RULE = {
  dependencies: [HorizontalRuleNode],
  export: (node) => ($isHorizontalRuleNode(node) ? "***" : null),
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode, _children, _match, isImport) => {
    const line = $createHorizontalRuleNode();
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }
    line.selectNext();
  },
  type: "element",
};

const MARKDOWN_TRANSFORMERS = [
  HORIZONTAL_RULE,
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  ...TEXT_FORMAT_TRANSFORMERS,
  LINK,
];

// ------------------------------------------------------------------
// Slash menu
// ------------------------------------------------------------------

class BlockOption extends MenuOption {
  constructor(title, { icon, keywords = [], hint, onSelect }) {
    super(title);
    this.title = title;
    this.icon = icon;
    this.keywords = keywords;
    this.hint = hint;
    this.onSelect = onSelect;
  }
}

function setBlocks(createNode) {
  const selection = $getSelection();
  if ($isRangeSelection(selection)) $setBlocksType(selection, createNode);
}

function buildBlockOptions(editor) {
  return [
    new BlockOption("Text", { icon: Pilcrow, keywords: ["paragraph", "p"], onSelect: () => setBlocks(() => $createParagraphNode()) }),
    new BlockOption("Heading 1", { icon: Heading1, keywords: ["h1", "title"], hint: "#", onSelect: () => setBlocks(() => $createHeadingNode("h1")) }),
    new BlockOption("Heading 2", { icon: Heading2, keywords: ["h2", "subtitle"], hint: "##", onSelect: () => setBlocks(() => $createHeadingNode("h2")) }),
    new BlockOption("Heading 3", { icon: Heading3, keywords: ["h3"], hint: "###", onSelect: () => setBlocks(() => $createHeadingNode("h3")) }),
    new BlockOption("Bulleted list", { icon: List, keywords: ["ul", "unordered", "bullet"], hint: "-", onSelect: () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined) }),
    new BlockOption("Numbered list", { icon: ListOrdered, keywords: ["ol", "ordered", "number"], hint: "1.", onSelect: () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined) }),
    new BlockOption("Quote", { icon: Quote, keywords: ["blockquote"], hint: ">", onSelect: () => setBlocks(() => $createQuoteNode()) }),
    new BlockOption("Divider", { icon: Minus, keywords: ["hr", "rule", "line", "separator"], hint: "---", onSelect: () => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined) }),
  ];
}

function SlashMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState(null);
  const triggerFn = useBasicTypeaheadTriggerMatch("/", { minLength: 0 });

  const allOptions = useMemo(() => buildBlockOptions(editor), [editor]);
  const options = useMemo(() => {
    if (!query) return allOptions;
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return allOptions.filter((option) => pattern.test(option.title) || option.keywords.some((k) => pattern.test(k)));
  }, [allOptions, query]);

  const onSelectOption = useCallback(
    (option, textNode, closeMenu) => {
      editor.update(() => {
        textNode?.remove();
        option.onSelect();
        closeMenu();
      });
    },
    [editor]
  );

  return (
    <LexicalTypeaheadMenuPlugin
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      anchorClassName="z-50"
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        anchorElementRef.current && options.length
          ? createPortal(
              <div className="mt-6 w-60 overflow-hidden rounded-2xl bg-white dark:bg-surface-dark shadow-lg ring-1 ring-black/5 dark:ring-white/10 font-sans">
                <div className="px-3 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                  Blocks
                </div>
                <ul className="pb-1.5 max-h-72 overflow-y-auto" role="listbox">
                  {options.map((option, i) => {
                    const Icon = option.icon;
                    const isActive = selectedIndex === i;
                    return (
                      <li
                        key={option.key}
                        ref={(el) => option.setRefElement(el)}
                        role="option"
                        aria-selected={isActive}
                        tabIndex={-1}
                        onMouseEnter={() => setHighlightedIndex(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setHighlightedIndex(i);
                          selectOptionAndCleanUp(option);
                        }}
                        className={`mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${
                          isActive
                            ? "bg-accent-tint text-accent-ink font-semibold dark:bg-accent/35 dark:text-white"
                            : "text-slate-800 dark:text-neutral-200"
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                          isActive ? "border-accent/30 bg-white text-accent dark:bg-transparent dark:text-white" : "border-neutral-200 dark:border-neutral-700 text-slate-500"
                        }`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1">{option.title}</span>
                        {option.hint && <kbd className="text-xs font-normal text-slate-400">{option.hint}</kbd>}
                      </li>
                    );
                  })}
                </ul>
              </div>,
              anchorElementRef.current
            )
          : null
      }
    />
  );
}

// ------------------------------------------------------------------
// Floating format toolbar (shows over a text selection)
// ------------------------------------------------------------------

const TEXT_FORMATS = [
  { format: "bold", icon: Bold, label: "Bold" },
  { format: "italic", icon: Italic, label: "Italic" },
  { format: "underline", icon: Underline, label: "Underline" },
  { format: "strikethrough", icon: Strikethrough, label: "Strikethrough" },
];

function FloatingFormatToolbar() {
  const [editor] = useLexicalComposerContext();
  const [position, setPosition] = useState(null);
  const [activeFormats, setActiveFormats] = useState({});
  const [isLink, setIsLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState(null);
  const savedSelectionRef = useRef(null);

  const updateToolbar = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      const nativeSelection = window.getSelection();
      const rootElement = editor.getRootElement();

      if (
        !$isRangeSelection(selection) ||
        selection.isCollapsed() ||
        !selection.getTextContent().trim() ||
        !nativeSelection?.rangeCount ||
        !rootElement?.contains(nativeSelection.anchorNode)
      ) {
        setPosition(null);
        return;
      }

      const rect = nativeSelection.getRangeAt(0).getBoundingClientRect();
      setPosition({ top: rect.top - 8, left: rect.left + rect.width / 2 });
      setActiveFormats(Object.fromEntries(TEXT_FORMATS.map(({ format }) => [format, selection.hasFormat(format)])));
      const node = selection.anchor.getNode();
      setIsLink($isLinkNode(node) || $isLinkNode(node.getParent()));
    });
  }, [editor]);

  useEffect(() => {
    const unregister = editor.registerUpdateListener(() => updateToolbar());
    const onScroll = () => updateToolbar();
    document.addEventListener("selectionchange", updateToolbar);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      unregister();
      document.removeEventListener("selectionchange", updateToolbar);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [editor, updateToolbar]);

  function startLink() {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }
    editor.getEditorState().read(() => {
      savedSelectionRef.current = $getSelection()?.clone() ?? null;
    });
    setLinkDraft({ url: "", position });
  }

  function applyLink() {
    const url = linkDraft?.url.trim();
    if (url && savedSelectionRef.current) {
      editor.update(() => $setSelection(savedSelectionRef.current.clone()));
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, /^[a-z]+:/i.test(url) ? url : `https://${url}`);
    }
    savedSelectionRef.current = null;
    setLinkDraft(null);
    editor.focus();
  }

  const shownAt = linkDraft?.position || position;
  if (!shownAt) return null;

  return createPortal(
    <div
      className="fixed z-50 -translate-x-1/2 -translate-y-full overflow-hidden rounded-xl bg-white dark:bg-surface-dark shadow-lg ring-1 ring-black/5 dark:ring-white/10 font-sans"
      style={{ top: shownAt.top, left: shownAt.left }}
      onMouseDown={(e) => {
        if (e.target.tagName !== "INPUT") e.preventDefault();
      }}
    >
      {linkDraft ? (
        <div className="flex items-stretch divide-x divide-neutral-200 dark:divide-neutral-700">
          <input
            autoFocus
            type="text"
            value={linkDraft.url}
            onChange={(e) => setLinkDraft((draft) => ({ ...draft, url: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                setLinkDraft(null);
                editor.focus();
              }
            }}
            placeholder="Paste a link…"
            className="w-56 border-0 bg-transparent px-3 py-2 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0"
          />
          <button type="button" onClick={applyLink} className="w-10 shrink-0 inline-flex items-center justify-center bg-accent text-white hover:opacity-90" title="Apply link">
            <Check className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      ) : (
        <div className="flex items-stretch divide-x divide-neutral-200 dark:divide-neutral-700">
          {TEXT_FORMATS.map(({ format, icon: Icon, label }) => (
            <FormatButton
              key={format}
              label={label}
              active={activeFormats[format]}
              onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)}
            >
              <Icon className="h-4 w-4" strokeWidth={2.5} />
            </FormatButton>
          ))}
          <FormatButton label={isLink ? "Remove link" : "Link"} active={isLink} onClick={startLink}>
            <LinkIcon className="h-4 w-4" strokeWidth={2.5} />
          </FormatButton>
        </div>
      )}
    </div>,
    document.body
  );
}

function FormatButton({ label, active, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-pressed={!!active}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center transition-colors ${
        active
          ? "bg-accent-tint text-accent-ink dark:bg-accent/35 dark:text-white"
          : "text-slate-700 dark:text-neutral-300 hover:bg-accent/5 dark:hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------
// Drag handle + "add block" button in the left gutter
// ------------------------------------------------------------------

const BLOCK_MENU_CLASS = "block-editor-menu";

function useCanHover() {
  const query = "(hover: hover) and (min-width: 768px)";
  const [canHover, setCanHover] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setCanHover(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return canHover;
}

function BlockHandlePlugin({ anchorElem }) {
  const [editor] = useLexicalComposerContext();
  const menuRef = useRef(null);
  const targetLineRef = useRef(null);
  const [draggableElement, setDraggableElement] = useState(null);

  // Insert an empty block below (or above with Alt) pre-filled with "/" so the slash menu opens
  function insertBlock(e) {
    if (!draggableElement) return;
    editor.update(() => {
      const node = $getNearestNodeFromDOMNode(draggableElement);
      if (!node) return;
      const paragraph = $createParagraphNode();
      const slash = $createTextNode("/");
      paragraph.append(slash);
      if (e.altKey) node.insertBefore(paragraph);
      else node.insertAfter(paragraph);
      slash.select(1, 1);
    });
    editor.focus();
  }

  return (
    <DraggableBlockPlugin_EXPERIMENTAL
      anchorElem={anchorElem}
      menuRef={menuRef}
      targetLineRef={targetLineRef}
      onElementChanged={setDraggableElement}
      isOnMenu={(element) => !!element.closest(`.${BLOCK_MENU_CLASS}`)}
      menuComponent={
        <div ref={menuRef} className={`${BLOCK_MENU_CLASS} absolute left-0 top-0 flex items-center opacity-0 will-change-transform text-slate-400 font-sans`}>
          <button
            type="button"
            title="Add block below (Alt: above)"
            onClick={insertBlock}
            className="rounded-md p-0.5 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Plus className="h-4 w-4" />
          </button>
          <span title="Drag to move" className="cursor-grab rounded-md p-0.5 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
            <GripVertical className="h-4 w-4" />
          </span>
        </div>
      }
      targetLineComponent={
        <div ref={targetLineRef} className="pointer-events-none absolute left-0 top-0 h-1 rounded-full bg-accent opacity-0 will-change-transform" />
      }
    />
  );
}

// ------------------------------------------------------------------
// HTML in / out
// ------------------------------------------------------------------

function InitialHtmlPlugin({ html }) {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!html || initializedRef.current) return;
    initializedRef.current = true;

    editor.update(() => {
      const dom = new DOMParser().parseFromString(html, "text/html");
      const nodes = $generateNodesFromDOM(editor, dom);
      const root = $getRoot();
      root.clear();
      root.append(...nodes);
    });
  }, [editor, html]);

  return null;
}

// ------------------------------------------------------------------
// BlockEditor
// ------------------------------------------------------------------

/**
 * Notion-style Lexical editor: no toolbar; "/" opens a block menu, selecting text shows
 * a format bubble, markdown shortcuts work (#, -, 1., >, ---, **bold**), and blocks can be
 * dragged or inserted from the left gutter. Emits HTML via onChange.
 *
 * The gutter for block handles is created with negative margin, so give the parent at
 * least `md:px-12` of horizontal padding.
 */
export default function BlockEditor({
  value = "",
  onChange,
  placeholder = "Type '/' for blocks…",
  namespace = "BlockEditor",
  className = "",
  placeholderClassName = "",
  minHeight = 160,
}) {
  const canHover = useCanHover();
  const [anchorElem, setAnchorElem] = useState(null);

  const initialConfig = useMemo(
    () => ({
      namespace,
      theme: EDITOR_THEME,
      nodes: EDITOR_NODES,
      onError(error) {
        console.error(error);
      },
    }),
    [namespace]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div ref={setAnchorElem} className="relative md:-mx-12 md:px-12" dir="ltr">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className={`outline-none text-left ${className}`}
              style={{ minHeight }}
            />
          }
          placeholder={
            <div className={`pointer-events-none absolute top-0 left-0 md:left-12 select-none opacity-50 ${placeholderClassName}`}>
              {placeholder}
            </div>
          }
          ErrorBoundary={({ children }) => <>{children}</>}
        />
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <HorizontalRulePlugin />
      <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
      <SlashMenuPlugin />
      <FloatingFormatToolbar />
      {canHover && anchorElem && <BlockHandlePlugin anchorElem={anchorElem} />}
      <InitialHtmlPlugin html={value} />
      <OnChangePlugin
        ignoreSelectionChange
        onChange={(editorState, editor) => {
          editorState.read(() => onChange?.($generateHtmlFromNodes(editor, null)));
        }}
      />
    </LexicalComposer>
  );
}
