import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ImagePlus, Trash2, Users, X } from "lucide-react";
import LinkCard, { firstLink } from "./LinkCard";
import MarkdownEditor from "./MarkdownEditor";
import VisibilityPicker from "./VisibilityPicker";
import { api } from "../groups/lib";
import { recipientVisibility, saveNote } from "./lib";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

// Writing or editing a timeline note, the way a highlight's note is written
// (book/HighlightNote.jsx): Markdown, ⌘/Ctrl+Enter saves, Esc cancels. Notes also hold
// pictures (pick, drop or paste them) and say who sees them on your profile. `groups` are
// the groups you can share it to; `shareTo` is the one group it goes to (a group page's
// Timeline block). `to` (a person) writes it on their profile instead, and then it isn't
// shared to groups. It's written formatted, not as Markdown symbols, and selecting text
// offers Bold, Italic, Underline, Strikethrough and Link (MarkdownEditor). Typing # suggests
// hashtags and @ people (and the roles in the groups it's shared to). The first link gets a
// preview card, which the X takes off. A rounded card: the writing on white, then Photo and
// who sees it on the left, "Also share to" (a menu of your groups) and Post note on the right.
// Needs a `.wb` around it.
export default function NoteEditor({
  note = null, groups: groupsGiven = null, shareTo = null, to = null, defaultVisibility = "private", max = 10000, imagesMax = 6,
  onSaved, onCancel, onDelete, autoFocus = false, placeholder = "What's on your mind today? Select words to format them, and add photos if you like.",
}) {
  const recipient = note?.recipient || to;
  const groups = recipient ? null : groupsGiven;
  const [body, setBody] = useState(note?.body || "");
  const [visibility, setVisibility] = useState(note?.visibility || defaultVisibility);
  const [picked, setPicked] = useState(() => note?.groups?.map((g) => g.slug) || (shareTo ? [shareTo] : []));
  const [files, setFiles] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [link, setLink] = useState(note?.link || null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [dropped, setDropped] = useState(() => new Set()); // links whose preview was taken off (or has none)
  const textRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { if (autoFocus) textRef.current?.focus(); }, [autoFocus]);

  // The first link's preview, a moment after it's typed or pasted
  const url = firstLink(body);
  useEffect(() => {
    if (!url) { setLink(null); setLinkLoading(false); return undefined; }
    if (url === link?.url || dropped.has(url)) return undefined;
    let current = true;
    const timer = setTimeout(async () => {
      setLinkLoading(true);
      try {
        const preview = await api(`/link_preview?url=${encodeURIComponent(url)}`);
        if (current) setLink(preview);
      } catch {
        if (current) { setLink(null); setDropped((d) => new Set(d).add(url)); }
      } finally {
        if (current) setLinkLoading(false);
      }
    }, 600);
    return () => { current = false; clearTimeout(timer); };
  }, [url, link?.url, dropped]);
  const dropLink = () => { if (link) setDropped((d) => new Set(d).add(link.url)); setLink(null); };

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);
  const kept = (note?.images || []).filter((i) => !removed.includes(i.id));
  const count = kept.length + files.length;
  const empty = !body.trim() && count === 0;

  const addFiles = (list) => {
    const pictures = [...list].filter((f) => ACCEPT.split(",").includes(f.type));
    if (pictures.length < list.length) setError("Pictures need to be JPEG, PNG, WebP or GIF.");
    const room = imagesMax - count;
    if (pictures.length > room) setError(`A note can have up to ${imagesMax} pictures.`);
    if (room > 0 && pictures.length) setFiles((f) => [...f, ...pictures.slice(0, room)]);
  };

  const reset = () => { setBody(""); setLink(null); setDropped(new Set()); setFiles([]); setRemoved([]); setError(null); setPicked(shareTo ? [shareTo] : []); setVisibility(defaultVisibility); };

  async function save() {
    if (empty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const fields = { body, visibility, images: files, link_url: (url && link?.url === url ? url : "") };
      if (removed.length) fields.remove_image_ids = removed;
      if (groups || shareTo) fields.group_slugs = picked;
      if (to && !note) fields.to = to.username;
      const saved = await saveNote(note?.id, fields);
      if (!note) reset();
      onSaved?.(saved);
    } catch (e) {
      setError(e.status === 401 ? "Sign in again to save your note." : e.message || "Couldn't save the note. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const toggle = (slug) => setPicked((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));
  const cancel = () => { if (note) { setBody(note.body || ""); setLink(note.link || null); setRemoved([]); setFiles([]); } else reset(); onCancel?.(); };

  return (
    <form
      className="wb-hl-note wb-hl-note--editing wb-note-editor wb-note-editor--card"
      onSubmit={(e) => { e.preventDefault(); save(); }}
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault(); }}
      onDrop={(e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } }}
    >
      <MarkdownEditor
        ref={textRef}
        value={body}
        minRows={note ? 5 : 3}
        maxLength={max}
        placeholder={placeholder}
        hashtags
        mentions={{ groups: picked }}
        onChange={setBody}
        onPaste={(e) => { if (e.clipboardData?.files?.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape" && (note || onCancel)) { e.stopPropagation(); cancel(); }
        }}
      />

      {(link || linkLoading) && url && <LinkCard link={link?.url === url ? link : null} loading={linkLoading && link?.url !== url} onRemove={dropLink} />}

      {count > 0 && (
        <ul className="wb-note-editor__images">
          {kept.map((image) => (
            <li key={image.id}>
              <img src={image.url} alt="" />
              <button type="button" onClick={() => setRemoved((r) => [...r, image.id])} aria-label="Remove this picture"><X size={14} /></button>
            </li>
          ))}
          {previews.map((p) => (
            <li key={p.url}>
              <img src={p.url} alt="" />
              <button type="button" onClick={() => setFiles((f) => f.filter((x) => x !== p.file))} aria-label="Remove this picture"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="wb-hl-note__error" role="alert">{error}</p>}

      <div className="wb-hl-note__actions">
        <button type="button" className="wb-btn" onClick={() => fileRef.current?.click()} disabled={saving || count >= imagesMax} title="Add pictures">
          <ImagePlus size={15} aria-hidden="true" /> <span className="wb-note-editor__label">Photo</span>
        </button>
        <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { addFiles(e.target.files || []); e.target.value = ""; }} />
        <VisibilityPicker value={visibility} onChange={setVisibility} disabled={saving}
          {...(recipient ? { options: recipientVisibility(recipient), title: "Who sees this note" } : {})} />
        {note && onDelete && (
          <button type="button" className="wb-btn wb-hl-note__delete" onClick={onDelete} disabled={saving}>
            <Trash2 size={14} aria-hidden="true" /> <span className="wb-note-editor__label">Delete note</span>
          </button>
        )}
        <span className="flex-1" />
        {groups?.length > 0 && (
          <span className="wb-note-editor__share">
            <span className="wb-note-editor__label">Also share to</span>
            <GroupsPicker groups={groups} picked={picked} onToggle={toggle} disabled={saving} />
          </span>
        )}
        {(note || onCancel) && (
          <button type="button" className="wb-btn" onClick={cancel} disabled={saving}>Cancel</button>
        )}
        <button type="submit" className="wb-btn wb-btn--reversed" disabled={saving || empty}>
          {saving ? "Saving…" : note ? "Save note" : "Post note"}
        </button>
      </div>
    </form>
  );
}

// "Your Groups ▾": the groups it also goes to, ticked in a short menu. The button names the
// one group when there's one.
function GroupsPicker({ groups, picked, onToggle, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc, true);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc, true); };
  }, [open]);
  const chosen = groups.filter((g) => picked.includes(g.slug));
  const label = chosen.length === 0 ? "Your Groups" : chosen.length === 1 ? chosen[0].title : `${chosen.length} groups`;
  return (
    <span ref={ref} className="relative inline-block">
      <button type="button" className="wb-note-editor__pill" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        data-on={chosen.length > 0 || undefined}>
        <Users size={14} aria-hidden="true" /> <span className="max-w-[9rem] truncate">{label}</span> <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <ul role="listbox" aria-multiselectable="true" aria-label="Also share to"
          className="absolute bottom-full right-0 z-30 mb-1 max-h-72 w-64 overflow-y-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
          {groups.map((g) => {
            const on = picked.includes(g.slug);
            return (
              <li key={g.slug}>
                <button type="button" role="option" aria-selected={on} onClick={() => onToggle(g.slug)}
                  className="flex w-full items-center gap-2.5 rounded-lg !bg-transparent px-2.5 py-2 text-left text-sm text-slate-800 hover:!bg-neutral-100 dark:text-neutral-100 dark:hover:!bg-neutral-800">
                  <span className={`grid size-4 shrink-0 place-items-center rounded border ${on ? "border-accent bg-accent text-white" : "border-neutral-300 dark:border-neutral-600"}`}>
                    {on && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 truncate">{g.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </span>
  );
}
