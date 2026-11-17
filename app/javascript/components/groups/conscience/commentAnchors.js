// Where a document's comments sit in its text. A comment keeps the words it's about as a
// quote, with a little text before and after (GroupDocumentComment), not as a mark in the
// document, so readers who can't edit can comment too. Here those words are found again and
// underlined with decorations, which follow the text as it's edited.
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const commentAnchorsKey = new PluginKey("commentAnchors");
const CONTEXT = 32;

// The document's text as one string (blocks on their own lines), and where each run of it is
export function textIndex(doc) {
  let text = "";
  const runs = [];
  doc.descendants((node, pos) => {
    if (node.isText) {
      runs.push({ start: text.length, pos, length: node.text.length });
      text += node.text;
    } else if (node.isBlock && text && !text.endsWith("\n")) text += "\n";
    return true;
  });
  return { text, runs };
}

function offsetAt(index, pos) {
  for (const run of index.runs) {
    if (pos < run.pos) return run.start;
    if (pos <= run.pos + run.length) return run.start + (pos - run.pos);
  }
  return index.text.length;
}

function posAt(index, offset, end = false) {
  for (const run of index.runs) {
    if (offset < run.start + run.length || (end && offset === run.start + run.length)) return run.pos + Math.max(0, offset - run.start);
  }
  const last = index.runs[index.runs.length - 1];
  return last ? last.pos + last.length : 0;
}

// What a comment on the text from..to records: { quote, prefix, suffix }
export function quoteFor(doc, from, to) {
  const index = textIndex(doc);
  let start = offsetAt(index, Math.min(from, to));
  let finish = offsetAt(index, Math.max(from, to));
  while (start < finish && /\s/.test(index.text[start])) start += 1;
  while (finish > start && /\s/.test(index.text[finish - 1])) finish -= 1;
  return { quote: index.text.slice(start, finish), prefix: index.text.slice(Math.max(0, start - CONTEXT), start), suffix: index.text.slice(finish, finish + CONTEXT) };
}

// How many characters two strings share at their joining ends
function sharedEnd(a, b) { let n = 0; while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n += 1; return n; }
function sharedStart(a, b) { let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n += 1; return n; }

// Finds each comment's words: { id: { from, to } }, leaving out comments whose words are gone.
// Where the quote appears more than once, the one with the most matching text around it wins.
export function locate(doc, comments) {
  const index = textIndex(doc);
  const found = {};
  comments.forEach((c) => {
    if (!c.quote) return;
    let best = null;
    let at = index.text.indexOf(c.quote);
    while (at !== -1) {
      const score = sharedEnd(index.text.slice(Math.max(0, at - CONTEXT), at), c.prefix || "") + sharedStart(index.text.slice(at + c.quote.length, at + c.quote.length + CONTEXT), c.suffix || "");
      if (!best || score > best.score) best = { at, score };
      at = index.text.indexOf(c.quote, at + 1);
    }
    if (best) found[c.id] = { from: posAt(index, best.at), to: posAt(index, best.at + c.quote.length, true) };
  });
  return found;
}

function decorate(doc, anchors, active) {
  return DecorationSet.create(doc, Object.entries(anchors).filter(([, a]) => a.to > a.from).map(([id, a]) => Decoration.inline(a.from, a.to, {
    class: `doc-comment-anchor${String(active) === id ? " is-active" : ""}`, "data-comment-id": id,
  })));
}

// Show anchors with editor.commands.setCommentAnchors({ id: { from, to } }, activeId)
export const CommentAnchors = Extension.create({
  name: "commentAnchors",
  addCommands() {
    return {
      setCommentAnchors: (anchors, active = null) => ({ tr, dispatch }) => {
        if (dispatch) tr.setMeta(commentAnchorsKey, { anchors, active }).setMeta("addToHistory", false);
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      key: commentAnchorsKey,
      state: {
        init: (_, state) => ({ anchors: {}, active: null, set: DecorationSet.empty, doc: state.doc }),
        apply(tr, value, _old, state) {
          const meta = tr.getMeta(commentAnchorsKey);
          if (meta) return { anchors: meta.anchors, active: meta.active, set: decorate(state.doc, meta.anchors, meta.active) };
          if (!tr.docChanged) return value;
          const anchors = {};
          Object.entries(value.anchors).forEach(([id, a]) => {
            const from = tr.mapping.map(a.from, 1);
            const to = tr.mapping.map(a.to, -1);
            if (to > from) anchors[id] = { from, to };
          });
          return { ...value, anchors, set: value.set.map(tr.mapping, tr.doc) };
        },
      },
      props: { decorations: (state) => commentAnchorsKey.getState(state).set },
    })];
  },
});

// Where each comment is now, after edits
export const currentAnchors = (editor) => (editor ? commentAnchorsKey.getState(editor.state)?.anchors || {} : {});
