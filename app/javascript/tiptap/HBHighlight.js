// app/javascript/tiptap/HBHighlight.js
import Highlight from '@tiptap/extension-highlight';

export const HBHighlight = Highlight.extend({
  addAttributes() {
    const parent = typeof super.addAttributes === 'function' ? super.addAttributes() : {};
    return {
      ...parent,
      color: {
        default: null,
        parseHTML: el => el.getAttribute('data-color'),
        renderHTML: attrs => {
          const out = {};
          if (attrs.color) {
            out['data-color'] = attrs.color;
            out.style = `background-color: ${attrs.color}`;
          }
          return out;
        },
      },
      hlId: {
        default: null,
        parseHTML: el => el.getAttribute('data-hl-id'),
        renderHTML: attrs => (attrs.hlId ? { 'data-hl-id': String(attrs.hlId) } : {}),
      },
      // optional: class hook for styling
      class: {
        default: 'hb-hl',
        parseHTML: el => el.className,
        renderHTML: attrs => ({ class: attrs.class || 'hb-hl' }),
      },
    };
  },
});