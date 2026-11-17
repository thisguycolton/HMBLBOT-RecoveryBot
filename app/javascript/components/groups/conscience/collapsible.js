// Collapsible text in the document editor (Insert > Collapsible text): a line to tap and the text
// it hides, like a long reading or the full Traditions under a one-line heading. Stored as
// <details><summary>Show more</summary><p>...</p></details>, which the server keeps (DocumentHtml)
// and every page that shows a document as HTML (the Command Center's script, version history)
// opens and closes on its own. In the editor it starts open so the writer sees what's inside; for
// readers it starts closed. Opening and closing one isn't a change to the document.
import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

const SUMMARY = "Show more";
// What can go inside: the page's usual blocks and other collapsibles. A section mark or a form
// can't, since the Command Center cuts the script at those.
const BODY = ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "table", "horizontalRule", "collapsible"];

export const CollapsibleSummary = Node.create({
  name: "collapsibleSummary",
  content: "inline*",
  defining: true,
  isolating: true,
  parseHTML() { return [{ tag: "summary" }]; },
  renderHTML({ HTMLAttributes }) { return ["summary", HTMLAttributes, 0]; },
});

// The collapsible around the cursor: { node, pos } or null
function around($pos) {
  for (let d = $pos.depth; d > 0; d -= 1) {
    if ($pos.node(d).type.name === "collapsible") return { node: $pos.node(d), pos: $pos.before(d) };
  }
  return null;
}

export const Collapsible = Node.create({
  name: "collapsible",
  group: "block",
  content: `collapsibleSummary (${BODY.join(" | ")})+`,
  defining: true,
  parseHTML() { return [{ tag: "details" }]; },
  renderHTML({ HTMLAttributes }) { return ["details", mergeAttributes(HTMLAttributes), 0]; },

  addNodeView() {
    return ({ editor, getPos }) => {
      let open = editor.isEditable;
      const dom = document.createElement("div");
      const head = document.createElement("div");
      head.className = "doc-collapse__tools";
      head.contentEditable = "false";
      const button = (cls, label, html) => {
        const b = Object.assign(document.createElement("button"), { type: "button", className: cls, title: label, innerHTML: html });
        b.setAttribute("aria-label", label);
        b.addEventListener("mousedown", (e) => e.preventDefault());
        return b;
      };
      const toggle = button("doc-collapse__toggle", "", '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>');
      head.append(toggle);
      if (editor.isEditable) {
        const unwrap = button("doc-collapse__unwrap", "Make it plain text again", '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>');
        unwrap.addEventListener("click", () => editor.chain().focus().setTextSelection(getPos() + 2).unsetCollapsible().run());
        head.append(unwrap);
      }
      const body = document.createElement("div");
      body.className = "doc-collapse__body";
      const show = () => {
        dom.className = `doc-collapse ${open ? "doc-collapse--open" : "doc-collapse--closed"}`;
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Hide the text" : "Show the text");
        toggle.title = open ? "Hide the text" : "Show the text";
      };
      toggle.addEventListener("click", () => { open = !open; show(); });
      // Reading: tapping the line opens it too
      body.addEventListener("click", (e) => {
        if (editor.isEditable || !e.target.closest("summary")) return;
        open = !open;
        show();
      });
      dom.append(head, body);
      show();
      return {
        dom,
        contentDOM: body,
        ignoreMutation: (m) => head.contains(m.target) || (m.type === "attributes" && m.target === dom),
      };
    };
  },

  addCommands() {
    return {
      // Wraps the picked paragraphs, or puts in an empty one where the cursor is
      setCollapsible: () => ({ state, tr, dispatch }) => {
        const { schema, selection } = state;
        const summary = schema.nodes.collapsibleSummary.create(null, schema.text(SUMMARY));
        const range = !selection.empty && selection.$from.blockRange(selection.$to);
        let blocks = [];
        if (range) range.parent.forEach((n, _, i) => { if (i >= range.startIndex && i < range.endIndex) blocks.push(n); });
        const fits = range && blocks.length && blocks.every((n) => BODY.includes(n.type.name))
          && range.parent.canReplaceWith(range.startIndex, range.endIndex, this.type);
        if (!fits) blocks = [schema.nodes.paragraph.create()];
        const node = this.type.create(null, [summary, ...blocks]);
        if (!dispatch) return true;
        let at;
        if (fits) {
          tr.replaceWith(range.start, range.end, node);
          at = range.start;
        } else {
          const { $from } = selection;
          // After the block the cursor is in (or in its place, if that's an empty paragraph)
          const top = $from.depth > 0 ? $from.before(1) : $from.pos;
          const block = $from.depth > 0 ? $from.node(1) : null;
          if (block && block.type.name === "paragraph" && block.content.size === 0) {
            tr.replaceWith(top, top + block.nodeSize, node);
            at = top;
          } else {
            at = block ? top + block.nodeSize : $from.pos;
            tr.insert(at, node);
          }
        }
        // Something to type into after it, when it ends the page (or the collapsible it's in)
        const $end = tr.doc.resolve(at + node.nodeSize);
        if ($end.index() === $end.parent.childCount) tr.insert(at + node.nodeSize, schema.nodes.paragraph.create());
        // The line to tap is picked, ready to be typed over
        tr.setSelection(TextSelection.create(tr.doc, at + 2, at + 2 + SUMMARY.length));
        dispatch(tr.scrollIntoView());
        return true;
      },
      // Back to plain text: the line becomes a paragraph above what was inside
      unsetCollapsible: () => ({ state, tr, dispatch }) => {
        const found = around(state.selection.$from);
        if (!found) return false;
        if (!dispatch) return true;
        const { node, pos } = found;
        const parts = [];
        node.forEach((child) => {
          if (child.type.name === "collapsibleSummary") {
            if (child.content.size) parts.push(state.schema.nodes.paragraph.create(null, child.content));
          } else parts.push(child);
        });
        tr.replaceWith(pos, pos + node.nodeSize, parts);
        tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size))));
        dispatch(tr);
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Enter on the line goes to the text under it
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parent.type.name !== "collapsibleSummary") return false;
        const after = $from.after();
        return editor.chain().setTextSelection(TextSelection.near(editor.state.doc.resolve(after + 1)).from).scrollIntoView().run();
      },
      // Backspace in an empty line with nothing under it takes the collapsible out
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parent.type.name !== "collapsibleSummary" || $from.parentOffset !== 0) return false;
        const found = around($from);
        const onlyEmpty = found.node.childCount === 2 && found.node.child(1).type.name === "paragraph" && found.node.child(1).content.size === 0;
        if ($from.parent.content.size === 0 && onlyEmpty) {
          return editor.chain().command(({ tr }) => {
            tr.delete(found.pos, found.pos + found.node.nodeSize);
            tr.setSelection(TextSelection.near(tr.doc.resolve(found.pos), -1));
            return true;
          }).run();
        }
        return true; // don't merge the line into what's above it
      },
    };
  },
});
