import { Extension } from '@tiptap/core'

/**
 * Indent levels as multiples of step (px).
 * Works for paragraph by default; optionally listItem if you include its name in options.types.
 */
export const Indent = Extension.create({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph'],     // you can add 'listItem' if you want
      step: 24,                 // pixels per indent level
      min: 0,
      max: 8,
    }
  },

  addGlobalAttributes() {
    return this.options.types.map(t => ({
      types: [t],
      attributes: {
        indent: {
          default: 0,
          parseHTML: el => {
            const ml = (el.style.marginLeft || '').trim()
            if (!ml.endsWith('px')) return 0
            const px = parseInt(ml, 10)
            return Math.max(this.options.min, Math.min(this.options.max, Math.round(px / this.options.step)))
          },
          renderHTML: attrs => {
            const lvl = Number.isFinite(attrs.indent) ? attrs.indent : 0
            if (!lvl) return {}
            return { style: `margin-left: ${lvl * this.options.step}px` }
          },
        },
      },
    }))
  },

  addCommands() {
    const clamp = (x, min, max) => Math.max(min, Math.min(max, x))
    const types = this.options.types
    const step = this.options.step
    const min = this.options.min
    const max = this.options.max

    function updateIndent(delta) {
      return ({ state, chain }) => {
        const { from, to } = state.selection
        let tr = chain()
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!types.includes(node.type.name)) return
          const current = node.attrs.indent || 0
          const next = clamp(current + delta, min, max)
          if (next !== current) {
            tr = tr.updateAttributes(node.type.name, { indent: next })
          }
        })
        return tr.run()
      }
    }

    return {
      indent: () => updateIndent(+1),
      outdent: () => updateIndent(-1),
      setIndent:
        level =>
        ({ state, chain }) => {
          const lvl = clamp(level, min, max)
          const { from, to } = state.selection
          let tr = chain()
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!types.includes(node.type.name)) return
            tr = tr.updateAttributes(node.type.name, { indent: lvl })
          })
          return tr.run()
        },
      unsetIndent:
        () =>
        ({ state, chain }) => {
          const { from, to } = state.selection
          let tr = chain()
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!types.includes(node.type.name)) return
            tr = tr.updateAttributes(node.type.name, { indent: 0 })
          })
          return tr.run()
        },
    }
  },
})