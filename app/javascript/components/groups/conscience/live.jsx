// Editing a document together (lib/liveDocument.js): starting the shared copy, the editor
// extensions that show it with everyone's cursors, and the row of pictures of who's here.
import React, { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { createDocument, getSchema } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { prosemirrorToYXmlFragment } from "y-prosemirror";
import { Eye } from "lucide-react";
import Avatar from "../Avatar";
import LiveDocument, { liveColor } from "../../../lib/liveDocument";
import { documentExtensions } from "./editorKit";

const FIELD = "default";

// The extensions that tie the editor to the shared copy: its text, and the others' cursors
// (a caret in their color with their name, which the pictures scroll to)
export function liveExtensions(live) {
  return [
    Collaboration.configure({ document: live.doc, field: FIELD }),
    CollaborationCursor.configure({
      provider: live,
      user: live.user,
      render: (user) => {
        const caret = document.createElement("span");
        caret.className = "collaboration-cursor__caret";
        caret.style.borderColor = user.color;
        caret.dataset.client = user.client;
        const label = document.createElement("span");
        label.className = "collaboration-cursor__label";
        label.style.backgroundColor = user.color;
        label.textContent = user.name;
        caret.append(label);
        return caret;
      },
    }),
  ];
}

// The first shared copy, made from the document's HTML and title in a scratch Y.Doc
function scratchCopy(html, title) {
  const scratch = new Y.Doc();
  prosemirrorToYXmlFragment(createDocument(html || "", getSchema(documentExtensions())), scratch.getXmlFragment(FIELD));
  scratch.getText("title").insert(0, title || "");
  return scratch;
}

// Opens the document live: { live, state } where state is "loading", "ready", or "waiting" (a
// reader on a document nobody has opened to edit yet, who reads the plain copy until someone
// does), or "off" (it couldn't connect; the page works as before)
export function useLiveDocument({ slug, doc, html, canEdit, onReset }) {
  const [state, setState] = useState("loading");
  const [live, setLive] = useState(null);
  const resetRef = useRef(onReset);
  resetRef.current = onReset;

  useEffect(() => {
    let gone = false;
    const l = new LiveDocument({
      slug, id: doc.id, canEdit,
      onReset: () => resetRef.current?.(),
      onStarted: () => resetRef.current?.(),
    });
    l.connect();
    const ready = async () => {
      for (let i = 0; i < 100 && !l.loaded && !gone; i += 1) await new Promise((r) => setTimeout(r, 100));
      if (gone) return;
      if (!l.loaded) { l.destroy(); setState("off"); return; }
      if (!l.started) {
        if (!canEdit) { setLive(l); setState("waiting"); return; }
        try { await l.start(scratchCopy(html, doc.title), html); } catch { setState("off"); return; }
        if (gone) return;
      }
      const me = l.me || { name: "Guest" };
      l.user = { name: me.name, avatar: me.avatar_url, uid: me.id ?? `guest-${l.doc.clientID}`, color: liveColor(me.id ?? l.doc.clientID), client: l.doc.clientID, editing: canEdit };
      setLive(l);
      setState("ready");
    };
    ready();
    return () => { gone = true; l.destroy(); };
  }, [slug, doc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { live, state };
}

// Everyone else here now, one entry a person (two tabs are one person), editors first
function useOthers(live) {
  const [others, setOthers] = useState([]);
  useEffect(() => {
    if (!live) return undefined;
    const read = () => {
      const byPerson = new Map();
      live.awareness.getStates().forEach((st, client) => {
        if (client === live.doc.clientID || !st.user) return;
        const person = { ...st.user, client, cursor: st.cursor, viewing: st.viewing };
        const seen = byPerson.get(st.user.uid);
        if (!seen || (!seen.cursor && person.cursor) || (!seen.editing && person.editing)) byPerson.set(st.user.uid, person);
      });
      setOthers([...byPerson.values()].sort((a, b) => (b.editing - a.editing) || a.name.localeCompare(b.name)));
    };
    read();
    live.awareness.on("change", read);
    return () => live.awareness.off("change", read);
  }, [live]);
  return others;
}

// Tells the others which paragraph is at the top of this screen, so tapping a reader's picture
// can take you there too
export function useShareViewing(live, editor) {
  useEffect(() => {
    if (!live || !editor) return undefined;
    let timer = null;
    const share = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const blocks = editor.view?.dom?.children;
        if (!blocks) return;
        let index = 0;
        for (let i = 0; i < blocks.length; i += 1) {
          if (blocks[i].getBoundingClientRect().bottom > 120) { index = i; break; }
        }
        if (live.awareness.getLocalState()?.viewing !== index) live.awareness.setLocalStateField("viewing", index);
      }, 400);
    };
    share();
    window.addEventListener("scroll", share, true);
    return () => { clearTimeout(timer); window.removeEventListener("scroll", share, true); };
  }, [live, editor]);
}

// Scrolls to where this person is: their cursor, or what they're reading
function jumpTo(person, editor) {
  const caret = document.querySelector(`.collaboration-cursor__caret[data-client="${person.client}"]`);
  const target = caret || (person.viewing != null ? editor?.view?.dom?.children?.[person.viewing] : null);
  if (!target) return false;
  target.scrollIntoView({ behavior: "smooth", block: caret ? "center" : "start" });
  if (caret) {
    caret.classList.remove("collaboration-cursor__caret--flash");
    void caret.offsetWidth; // restarts the flash
    caret.classList.add("collaboration-cursor__caret--flash");
  }
  return true;
}

const SHOWN = 5;

// The pictures of who's on the page, at the top. A ring in their cursor's color while they can
// edit; dimmed with an eye while they're reading. Tap one to go to their cursor.
export function LivePresence({ live, editor, offline }) {
  const others = useOthers(live);
  const [more, setMore] = useState(false);
  const [missing, setMissing] = useState(null);
  const moreRef = useRef(null);
  useEffect(() => {
    if (!more) return undefined;
    const close = (e) => { if (!moreRef.current?.contains(e.target)) setMore(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [more]);
  useEffect(() => { if (!missing) return undefined; const t = setTimeout(() => setMissing(null), 2500); return () => clearTimeout(t); }, [missing]);

  const go = (person) => {
    setMore(false);
    if (!jumpTo(person, editor)) setMissing(`${person.name} hasn't put their cursor anywhere yet`);
  };
  const face = (person, size = 28) => (
    <span className="relative inline-flex">
      <span className="rounded-full p-[2px]" style={{ boxShadow: `0 0 0 2px ${person.editing ? person.color : "transparent"}` }}>
        <Avatar person={{ name: person.name, avatar_url: person.avatar }} size={size} className={person.editing ? "" : "opacity-60"} />
      </span>
      {!person.editing && <span className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700"><Eye className="size-2.5" /></span>}
    </span>
  );
  const label = (p) => `${p.name}, ${p.editing ? "editing" : "reading"}. Go to ${p.editing ? "their cursor" : "where they're reading"}`;

  return (
    <div className="relative flex items-center gap-1" aria-label="Who's here">
      {offline && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">Reconnecting…</span>}
      <div className="flex -space-x-1.5">
        {others.slice(0, SHOWN).map((p) => (
          <button key={p.uid} type="button" onClick={() => go(p)} title={label(p)} aria-label={label(p)} className="relative rounded-full transition hover:z-10 hover:-translate-y-0.5 focus-visible:z-10">
            {face(p)}
          </button>
        ))}
      </div>
      {others.length > SHOWN && (
        <span ref={moreRef} className="relative">
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="grid h-8 min-w-8 place-items-center rounded-full bg-neutral-200 px-1.5 text-xs font-semibold text-slate-700 dark:bg-neutral-700 dark:text-neutral-100">+{others.length - SHOWN}</button>
          {more && (
            <span className="absolute right-0 top-10 z-30 w-60 rounded-xl bg-white p-1 shadow-lg ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
              {others.map((p) => (
                <button key={p.uid} type="button" onClick={() => go(p)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  {face(p, 24)}
                  <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-neutral-100">{p.name}</span>
                  <span className="text-xs text-slate-500 dark:text-neutral-400">{p.editing ? "editing" : "reading"}</span>
                </button>
              ))}
            </span>
          )}
        </span>
      )}
      {missing && <span role="status" className="absolute right-0 top-10 z-30 w-max max-w-64 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg">{missing}</span>}
    </div>
  );
}
