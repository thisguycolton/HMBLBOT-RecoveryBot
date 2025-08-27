// app/javascript/tiptap/ParagraphWithPage.js
import Paragraph from '@tiptap/extension-paragraph';

export const ParagraphWithPage = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      page: {
        default: null,
        parseHTML: element => element.getAttribute?.('data-page') ?? null,
        renderHTML: attributes => {
          if (!attributes.page) return {};
          return { 'data-page': attributes.page };
        },
      },
    };
  },
});