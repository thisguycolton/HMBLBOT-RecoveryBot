// app/javascript/tiptap/FontSize.js
import { Extension } from '@tiptap/core'
import { TextStyle } from '@tiptap/extension-text-style'

function pxToEm(px) {
  // accept "16px", " 20px ", 20 (number) etc.
  if (px == null) return null
  const n = typeof px === 'number' ? px : parseFloat(String(px).replace('px', '').trim())
  if (!isFinite(n) || n <= 0) return null
  // 1em ~= parent font-size; using 16 as base keeps existing JSON untouched but responsive
  return (n / 16).toFixed(4) + 'em'
}

export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: el => el.style?.fontSize || null, // keep reading px if present
            renderHTML: attrs => {
              const fs = attrs.fontSize
              if (!fs) return {}
              const em = pxToEm(fs)
              // If we can compute em, render that so it scales with prose; otherwise fall back to px
              return em
                ? { style: `font-size: ${em}` }
                : { style: `font-size: ${fs}` }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (sizePx /* e.g. "16px" */) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: sizePx }).run(),

      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})