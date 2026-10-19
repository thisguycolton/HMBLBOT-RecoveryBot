// Markdown to the HTML the document editor takes (headings, nested lists, quotes, tables,
// links, bold/italic/strike). Raw HTML in the Markdown is shown as text, not run.
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: true, breaks: false }).enable(["table", "strikethrough"]);

export const markdownToEditorHtml = (source) => md.render(source || "");

// Whether pasted plain text is Markdown worth converting: a heading, a list, a quote, a table,
// a divider, a code fence, or **bold** / [links](...) somewhere in it
const SIGNS = [/^#{1,6}\s+\S/m, /^\s*[-*+]\s+\S/m, /^\s*\d+[.)]\s+\S/m, /^\s*>\s?\S/m, /^\s*\|.*\|\s*$/m, /^\s*(-{3,}|\*{3,}|_{3,})\s*$/m, /^```/m, /\*\*[^*\n]+\*\*/, /\[[^\]\n]+\]\([^)\s]+\)/];
export const looksLikeMarkdown = (text) => SIGNS.some((re) => re.test(text || ""));
