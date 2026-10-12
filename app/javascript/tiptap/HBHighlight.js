// app/javascript/tiptap/HBHighlight.js
import Highlight from '@tiptap/extension-highlight';

export const HBHighlight = Highlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: el => el.style.backgroundColor || null,
        renderHTML: attrs => attrs.color ? { style: `background-color: ${attrs.color}` } : {},
      },
      hlId: {
        default: null,
        parseHTML: el => el.getAttribute('data-hl-id'),
        renderHTML: attrs => attrs.hlId ? { 'data-hl-id': attrs.hlId } : {},
      },
      // Marks a highlight that carries a note, so readers can tell it has one.
      hasNote: {
        default: false,
        parseHTML: el => el.hasAttribute('data-note'),
        renderHTML: attrs => attrs.hasNote ? { 'data-note': '' } : {},
      },
      // If you want a class too, you can hard-code it in renderHTML below
    };
  },

  renderHTML({ HTMLAttributes }) {
    // Make sure the element has both the data attribute and class
    const cls = ['hb-hl', HTMLAttributes.class].filter(Boolean).join(' ');
    const attrs = { ...HTMLAttributes, class: cls };
    return ['mark', attrs, 0];
  },
});