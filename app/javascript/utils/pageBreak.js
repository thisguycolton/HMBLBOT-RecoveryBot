// utils/pageBreak.js
export function updatePageBreakAt(editor, pos, nextAttrs) {
  if (!editor) return false;
  return editor.commands.command(({ tr, state }) => {
    const node = state.doc.nodeAt(pos);
    if (!node || node.type.name !== "pageBreak") return false;
    const attrs = { ...node.attrs, ...nextAttrs };
    tr.setNodeMarkup(pos, node.type, attrs);
    return true;
  });
}