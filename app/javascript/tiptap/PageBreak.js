import { Node } from "@tiptap/core";


/** PageBreak: nice horizontal rule with a centered badge for page + title */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      kind: { default: null },   // "header" | "footer" | null
      page: { default: null },   // number
      title: { default: null },  // running head, e.g., "ALCOHOLICS ANONYMOUS"
    };
  },

  parseHTML() {
    return [{ tag: "div[data-page-break]" }];
  },

  /** Render as a decorative separator with a badge. */
  renderHTML({ HTMLAttributes }) {
    const { page, title, kind } = HTMLAttributes;

    const label = [
      page != null ? `Page ${page}` : null,
      title ? title : null,
    ].filter(Boolean).join(" • ");

    const variant =
      kind === "header" ? "page-break--header"
      : kind === "footer" ? "page-break--footer"
      : "page-break--default";

    return [
      "div",
      {
        "data-page-break": "true",
        class: `my-8 page-break ${variant}`,
      },
      ["div", { class: "relative flex items-center justify-center text-center" },
        ["div", { class: "h-px w-full bg-gray-300" }],
        // 👇 give the pill a unique class, no shadow-* utility here
        ["span", {
          class:
            "page-break__pill absolute -top-3 inline-block rounded-full border border-slate-300 dark:border-slate-400 bg-white dark:bg-neutral-600 px-3 py-0.5 text-[11px] uppercase tracking-wide text-gray-600 dark:text-slate-200"
        },
          label || "Page Break"
        ]
      ]
    ];
  }
});