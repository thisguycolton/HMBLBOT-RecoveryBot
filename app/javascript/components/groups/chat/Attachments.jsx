import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, FileSpreadsheet, FileText, File as FileIcon, Presentation, X } from "lucide-react";

// What can go on a chat message (ChatMessage::FILE_TYPES), as the file picker takes it
export const FILES_MAX = 6;
const EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv"];
export const ACCEPT = EXTENSIONS.map((e) => `.${e}`).join(",") + ",image/png,image/jpeg,image/webp,image/gif";
const extOf = (name) => (name.split(".").pop() || "").toLowerCase();
const isPicture = (name) => ["png", "jpg", "jpeg", "webp", "gif"].includes(extOf(name));

// Why these files can't be sent, or null (the server checks again)
export function fileProblem(files) {
  if (files.length > FILES_MAX) return `A message can have up to ${FILES_MAX} files.`;
  for (const f of files) {
    if (!EXTENSIONS.includes(extOf(f.name))) return `${f.name} can't be sent here: pictures, PDFs, Word, Excel, PowerPoint, text and CSV files can.`;
    if (isPicture(f.name) && f.size > 10 * 1024 * 1024) return "Pictures need to be under 10 MB each.";
    if (f.size > 20 * 1024 * 1024) return "Files need to be under 20 MB each.";
  }
  return null;
}

export function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function KindIcon({ name, className }) {
  const ext = extOf(name);
  const Icon = ["xls", "xlsx", "csv"].includes(ext) ? FileSpreadsheet : ["ppt", "pptx"].includes(ext) ? Presentation
    : ["pdf", "doc", "docx", "txt"].includes(ext) ? FileText : FileIcon;
  return <Icon className={className} aria-hidden="true" />;
}

// The files waiting to go with a message in the box, each with an X to take it off
export function PendingFiles({ files, onRemove }) {
  const shown = useMemo(() => files.map((file) => ({ file, url: isPicture(file.name) ? URL.createObjectURL(file) : null })), [files]);
  useEffect(() => () => shown.forEach((s) => s.url && URL.revokeObjectURL(s.url)), [shown]);
  return (
    <ul className="flex gap-2.5 overflow-x-auto px-1.5 pb-1.5 pr-3 pt-2.5" aria-label="Files to send">
      {shown.map(({ file, url }, i) => (
        <li key={`${file.name}-${i}`} className="relative shrink-0">
          {url ? (
            <img src={url} alt={file.name} className="size-16 rounded-xl object-cover ring-1 ring-neutral-200 dark:ring-neutral-700" />
          ) : (
            <span className="flex h-16 w-44 items-center gap-2 rounded-xl bg-white px-2.5 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
              <KindIcon name={file.name} className="size-6 shrink-0 text-accent" />
              <span className="min-w-0 text-xs">
                <span className="block truncate font-semibold text-slate-800 dark:text-neutral-100">{file.name}</span>
                <span className="text-slate-500">{fileSize(file.size)}</span>
              </span>
            </span>
          )}
          <button type="button" onClick={() => onRemove(i)} aria-label={`Don't send ${file.name}`} title="Remove"
            className="absolute -right-1.5 -top-1.5 inline-grid size-6 place-items-center rounded-full !bg-slate-800 !text-white shadow ring-2 ring-white dark:ring-neutral-800">
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

// A message's pictures (tap one to see it big) and its other files as cards to open or download
export function MessageFiles({ files }) {
  const [big, setBig] = useState(null);
  const pictures = files.filter((f) => f.image);
  const others = files.filter((f) => !f.image);
  return (
    <div className="mt-1 space-y-1.5">
      {pictures.length > 0 && (
        <div className={`grid max-w-md gap-1.5 ${pictures.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {pictures.map((f) => (
            <button key={f.id} type="button" onClick={() => setBig(f)} aria-label={`See ${f.name}`}
              className="overflow-hidden rounded-xl !bg-neutral-100 ring-1 ring-neutral-200 dark:!bg-neutral-800 dark:ring-neutral-700">
              <img src={f.url} alt={f.name} loading="lazy"
                className={`block w-full object-cover ${pictures.length === 1 ? "max-h-80 object-contain" : "aspect-square"}`} />
            </button>
          ))}
        </div>
      )}
      {others.map((f) => (
        <a key={f.id} href={f.url} target="_blank" rel="noopener" download={f.type === "application/pdf" ? undefined : f.name}
          className="flex max-w-sm items-center gap-3 rounded-xl bg-white px-3 py-2.5 !no-underline ring-1 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:ring-neutral-700 dark:hover:bg-neutral-800">
          <KindIcon name={f.name} className="size-8 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{f.name}</span>
            <span className="text-xs text-slate-500 dark:text-neutral-400">{extOf(f.name).toUpperCase()} · {fileSize(f.size)}</span>
          </span>
          {f.type === "application/pdf" ? <ExternalLink className="size-4 shrink-0 text-slate-400" aria-label="Opens" /> : <Download className="size-4 shrink-0 text-slate-400" aria-label="Downloads" />}
        </a>
      ))}
      {big && <PictureViewer picture={big} onClose={() => setBig(null)} />}
    </div>
  );
}

// One picture over everything, as big as fits; Esc, X or a tap outside it closes it
function PictureViewer({ picture, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[2300] flex flex-col bg-black/90 !font-sans" role="dialog" aria-modal="true" aria-label={picture.name} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-sm text-white">
        <span className="min-w-0 flex-1 truncate">{picture.name}</span>
        <a href={picture.url} target="_blank" rel="noopener" className="inline-grid size-10 place-items-center rounded-full !text-white hover:bg-white/10" aria-label="Open it on its own" title="Open it on its own"><ExternalLink className="size-5" /></a>
        <button type="button" onClick={onClose} className="inline-grid size-10 place-items-center rounded-full !bg-transparent !text-white hover:!bg-white/10" aria-label="Close"><X className="size-6" /></button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img src={picture.url} alt={picture.name} className="max-h-full max-w-full rounded-lg object-contain" />
      </div>
    </div>,
    document.body,
  );
}
