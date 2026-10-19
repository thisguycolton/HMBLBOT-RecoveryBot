// Turning a Word (.docx) or RTF file into HTML for the document editor. This happens in the
// browser; the server cleans the HTML again before it is kept (DocumentHtml).
import { rtfToHtml } from "./rtf";
import { markdownToEditorHtml } from "./markdownHtml";

export const IMPORT_MAX = 10 * 1024 * 1024;
export const IMPORT_ACCEPT = ".docx,.rtf,.md,.markdown,.txt";
export const isImportable = (file) => /\.(docx|rtf|md|markdown|txt)$/i.test(file?.name || "");

const titleOf = (file) => file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

// -> { title, html, notes } or throws an Error saying what's wrong with the file
export async function importDocument(file) {
  if (/\.doc$/i.test(file.name)) throw new Error("Old .doc files can't be imported. Open it in Word and save it as .docx first.");
  if (!isImportable(file)) throw new Error("Import a Word (.docx), RTF or Markdown (.md) file.");
  if (file.size > IMPORT_MAX) throw new Error("That file is over 10 MB.");

  if (/\.(md|markdown|txt)$/i.test(file.name)) {
    return { title: titleOf(file), html: markdownToEditorHtml(await file.text()), notes: [] };
  }

  if (/\.rtf$/i.test(file.name)) {
    // RTF is plain text with escapes; its raw bytes are Windows-1252
    const html = rtfToHtml(new TextDecoder("windows-1252").decode(await file.arrayBuffer()));
    return { title: titleOf(file), html, notes: [] };
  }

  const mammoth = (await import("mammoth/mammoth.browser")).default;
  try {
    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      // Pictures aren't kept, so they aren't turned into data in the text
      {
        convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: "" })),
        styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh"],
      }
    );
    const pictures = result.messages.some((m) => /image/i.test(m.message)) || /<img/i.test(result.value);
    return { title: titleOf(file), html: result.value.replace(/<img[^>]*>/gi, ""), notes: pictures ? ["Pictures in the file weren't imported."] : [] };
  } catch {
    throw new Error("That doesn't look like a Word (.docx) file.");
  }
}
