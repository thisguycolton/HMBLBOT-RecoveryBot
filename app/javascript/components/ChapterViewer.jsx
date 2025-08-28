// app/javascript/components/ChapterViewer.jsx
import { useEffect, useState, useRef, useLayoutEffect, useCallback} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import axios from "axios";
import { PageBreak } from "../tiptap/PageBreak";
import TextAlign from '@tiptap/extension-text-align';
import { Highlighter, ChevronRight, ChevronDown, Moon, Sun } from "lucide-react";
import ReaderBubbleMenu from "../components/ReaderBubbleMenu";
import HighlightsModal from "../components/HighlightsModal";
import MiddleTruncate from "./MiddleTruncate";
import ChapterNavBar from "../components/ChapterNavBar";
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import Heading from '@tiptap/extension-heading';
import Blockquote from '@tiptap/extension-blockquote';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import CodeBlock from '@tiptap/extension-code-block';
import { ParagraphWithPage } from "../tiptap/ParagraphWithPage";
import { FontSize } from "../tiptap/FontSize";
import { Indent } from "../tiptap/Indent";
import { HBHighlight } from '../tiptap/HBHighlight';



 // map friendly color names -> actual CSS colors (backgroundColor)
 const PALETTE = {
   yellow: '#fef08a', // tailwind yellow-200-ish
   lime:   '#bef264',
   cyan:   '#a5f3fc',
   pink:   '#fbcfe8',
   orange: '#fed7aa',
 };


function useHighlightShareLink(bookSlug, slug) {
  const [shareToken, setShareToken] = useState(null);

  const ensureShareToken = useCallback(async () => {
    if (shareToken) return shareToken;
    const { data } = await axios.post("/api/highlights/share");
    setShareToken(data.share_token);
    return data.share_token;
  }, [shareToken]);

  const linkFor = useCallback(
    async (hlId) => {
      const token = await ensureShareToken();
      return `${location.origin}/books/${bookSlug}/chapters/${slug}?share=${encodeURIComponent(
        token
      )}#hl-${hlId}`;
    },
    [bookSlug, slug, ensureShareToken]
  );

  const copyLink = useCallback(
    async (hlId) => {
      const url = await linkFor(hlId);
      try {
        await navigator.clipboard.writeText(url);
        console.info("Link copied:", url);
      } catch (e) {
        console.error("Copy failed", e);
        window.prompt("Copy highlight link:", url);
      }
    },
    [linkFor]
  );

  return { shareToken, copyLink, linkFor };
}
 
function truncateMiddle(str, maxLength = 80) {
  if (!str || str.length <= maxLength) return str;

  const ellipsis = "…";
  const keep = maxLength - ellipsis.length;
  const front = Math.ceil(keep / 2);
  const back = Math.floor(keep / 2);

  return str.slice(0, front) + ellipsis + str.slice(str.length - back);
}
/** Map a plain-text offset to a ProseMirror position using textBetween + binary search */
function offsetToPos(doc, target) {
  // Guard rails
  const maxPos = Math.max(1, doc.content.size - 1);
  if (target <= 0) return 1;

  let lo = 1;
  let hi = maxPos;

  // Binary search: find the smallest pos whose textBetween length >= target
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const len = doc.textBetween(0, mid, "\n", "\n").length;
    if (len < target) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, maxPos);
}

function resolveRanges(editor, highlights) {
  const text = editor.getText();
  return (Array.isArray(highlights) ? highlights : []).map(h => {
    const sel = h.selector || {};
    let start = sel.position?.start, end = sel.position?.end;
    if ((start == null || end == null) && sel.quote?.exact) {
      const idx = text.indexOf(sel.quote.exact);
      if (idx >= 0) { start = idx; end = idx + sel.quote.exact.length; }
    }
    if (start == null || end == null || end <= start) return null;
    const from = offsetToPos(editor.state.doc, start);
    const to   = offsetToPos(editor.state.doc, end);
    return { id: h.id, from, to, color: (h.style && h.style.color) || "yellow" };
  }).filter(Boolean);
}

function useHideCoveredPageBreaks(editor) {
  useLayoutEffect(() => {
    if (!editor) return;
    const root = document.documentElement;

    const stickyOffset = () => {
      const v = getComputedStyle(root).getPropertyValue('--reader-sticky-offset');
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : 0;
    };

    let els = [];
    let currentIdx = -1;
    let ticking = false;

    const indexEls = () => {
      els = Array.from(document.querySelectorAll('[data-page-break]'));
      els.forEach((el, i) => (el.dataset.pbIndex = String(i)));
    };

    const update = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (!els.length) { ticking = false; return; }
        const topOffset = stickyOffset();
        let idx = -1;
        // scan until first below sticky line
        for (let i = 0; i < els.length; i++) {
          const top = els[i].getBoundingClientRect().top;
          if (top - topOffset <= 0) idx = i; else break;
        }
        if (idx !== currentIdx) {
          // cheap class updates only when changed
          els.forEach((el, i) => {
            const stuck = (i === idx);
            const covered = (i < idx);
            el.classList.toggle('is-stuck', stuck);
            el.classList.toggle('is-covered', covered);
          });
          currentIdx = idx;
        }
        ticking = false;
      });
    };

    // initial
    indexEls();
    requestAnimationFrame(update);

    const onScroll = () => update();
    const onResize = () => { indexEls(); update(); };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    const mo = new MutationObserver(() => { indexEls(); update(); });
    mo.observe(editor.view.dom, { childList: true, subtree: true });

    editor.on('create', () => { indexEls(); update(); });
    editor.on('update', () => { indexEls(); update(); });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      mo.disconnect();
      editor.off('create');
      editor.off('update');
    };
  }, [editor]);
}

export default function ChapterViewer({ bookSlug, slug }) {
  const [chapter, setChapter] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [color, setColor] = useState("yellow");
  const [progress, setProgress] = useState(0);
  const { copyLink } = useHighlightShareLink(bookSlug, slug);

  const [openHighlights, setOpenHighlights] = useState(false); // collapsed by default
  const rangesRef = useRef(new Map()); // id -> { from, to }

  const [openHighlightsModal, setOpenHighlightsModal] = useState(false);
  const cssFromStored = (stored) => PALETTE[stored] || stored || PALETTE.yellow;

  const [pendingJumpId, setPendingJumpId] = useState(null);
  useEffect(() => {
    const m = location.hash.match(/^#hl-(.+)$/);
    if (m) setPendingJumpId(m[1]);   // keep as string
  }, []);

  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({ paragraph: false }), // match editor
      Heading,                                    // explicit (StarterKit adds it, but good to be clear)
      ParagraphWithPage,                          // <-- important
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      PageBreak,
      Table.configure({ resizable: false }),
      Indent.configure({ types: ["paragraph"], step: 24, min: 0, max: 8 }),
      TableRow,
      TableHeader,
      TableCell,
      HBHighlight.configure({ multicolor: true }),
    ],
    content: chapter?.tiptap_json || chapter?.tiptap || null,
  }, [chapter]);

    useHideCoveredPageBreaks(editor);

    const [theme, setTheme] = useState(() => {
    // prefer saved setting; else follow system
    return localStorage.getItem('theme') || 'system';
  });
  

  // apply theme to <html>
  useEffect(() => {
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && systemDark);

  // make this explicit, not toggle
  root.classList.toggle('dark', isDark);

  localStorage.setItem('theme', theme);

  // keep theme-color meta in sync (optional)
  const meta =
    document.querySelector('meta[name="theme-color"]') ||
    (() => {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      document.head.appendChild(m);
      return m;
    })();
  meta.content = isDark ? '#0a0a0a' : '#ffffff';
}, [theme]);

  // scroll progress
const progRef = useRef(null);
const rafRef = useRef(0);

// replace your scroll progress effect with:
useEffect(() => {
  const el = progRef.current;
  if (!el) return;

  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    rafRef.current = requestAnimationFrame(() => {
      const doc = document.documentElement;
      const total = (doc.scrollHeight - doc.clientHeight) || 1; // avoid 0
      const pct = Math.min(1, Math.max(0, window.scrollY / total));
      // transform = paint-only; no layout
      el.style.transform = `scaleX(${pct})`;
      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(rafRef.current);
  };
}, []);

  // load chapter + highlights
  useEffect(() => {
  (async () => {
    try {
      const ch = await axios.get(`/api/books/${bookSlug}/chapters/${slug}.json`);
      setChapter(ch.data);

      const params = new URLSearchParams(location.search);
      const share = params.get('share');

      const hls = await axios.get(`/api/highlights`, {
        params: { chapter_slug: slug, ...(share ? { share } : {}) }
      });

      setHighlights(Array.isArray(hls.data) ? hls.data : []);
    } catch (e) {
      console.error("Failed to load chapter", e);
    }
  })();
}, [bookSlug, slug]);

  // apply highlight marks
const [shareToken, setShareToken] = useState(null);

async function ensureShareToken() {
  if (shareToken) return shareToken;
  try {
    const { data } = await axios.post('/api/highlights/share');
    setShareToken(data.share_token);
    return data.share_token;
  } catch (e) {
    // 401/403 means not logged in or not allowed to create a token
    throw new Error('LOGIN_REQUIRED');
  }
}

async function copyShareLinkForHighlight(hlId) {
  // If you *must* support public clicks too, you can fall back to no-token link,
  // but that link won't show your private highlights. Better to require login here.
  let url;
  try {
    const token = await ensureShareToken();
    url = `${location.origin}/books/${bookSlug}/chapters/${slug}?share=${encodeURIComponent(token)}#hl-${hlId}`;
    await navigator.clipboard.writeText(url);
    toast('Link copied to clipboard'); // replace with your toast/snackbar
  } catch (err) {
    if (err.message === 'LOGIN_REQUIRED') {
      toast('Log in to generate a share link');
      return;
    }
    // fallback UI
    url ||= `${location.origin}/books/${bookSlug}/chapters/${slug}#hl-${hlId}`;
    window.prompt('Copy highlight link:', url);
  }
}
// …

useLayoutEffect(() => {
  if (!editor) return;
  const doc = editor.state?.doc;
  if (!doc || doc.content.size <= 2) return;

  const { state, view } = editor;
  const markType = state.schema.marks.highlight;
  if (!markType) return;

  // temporarily enable to mutate marks
  const wasEditable = editor.isEditable;
  editor.setEditable(true);
  try {
    // 1) clear existing highlight marks
    let tr = state.tr.removeMark(0, doc.content.size, markType);

    // 2) resolve and apply new marks
    const resolved = resolveRanges(editor, highlights);
    rangesRef.current.clear();
    resolved.forEach((r) => {
  const cssColor = PALETTE[r.color] || r.color || PALETTE.yellow;
  rangesRef.current.set(String(r.id), { from: r.from, to: r.to });
  tr = tr.addMark(
    r.from,
    r.to,
    markType.create({ color: cssColor, hlId: String(r.id), class: 'hb-hl' })
  );
});

    if (tr.steps.length) {
      view.dispatch(tr);
    }
  } finally {
    editor.setEditable(wasEditable);
  }

  // 3) if there’s a pending deep-link jump, do it after DOM paints
  if (pendingJumpId != null) {
    // double RAF to ensure ProseMirror has flushed DOM updates
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (tryJump(pendingJumpId)) {
          setPendingJumpId(null);
        }
      });
    });
  }
}, [editor, highlights, pendingJumpId]);

  async function createHighlight() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const before = editor.state.doc.textBetween(0, from, "\n", "\n");
    const exact  = editor.state.doc.textBetween(from, to, "\n", "\n");
    const after  = editor.state.doc.textBetween(to, editor.state.doc.content.size, "\n", "\n");
    const start = before.length;
    const end   = start + exact.length;
    const payload = {
      highlight: {
        chapter_slug: slug,
        style: { color },
        selector: {
          type: "Composite",
          position: { type: "TextPositionSelector", start, end },
          quote: { type: "TextQuoteSelector", exact, prefix: before.slice(-40), suffix: after.slice(0, 40) }
        }
      }
    };
    const res = await axios.post("/api/highlights", payload);
    const newId = String(res.data.id);
    setHighlights(prev => [...prev, { id: newId, ...payload.highlight }]);
  }

  async function deleteHighlight(id) {
    await axios.delete(`/api/highlights/${id}`);
    setHighlights(prev => prev.filter(h => h.id !== id));
  }

function getStickyOffset() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--reader-sticky-offset');
  const n = parseInt(v, 10);
  // add a little breathing room so the text isn’t jammed under the bar
  return (Number.isFinite(n) ? n : 0) + 45;
}

function jumpToHighlight(id) {
  if (!editor) return;

  // remember this jump in the URL so reloads work
  if (history.replaceState) {
    history.replaceState(null, "", `#hl-${id}`);
  } else {
    location.hash = `#hl-${id}`;
  }
  setPendingJumpId(id);

  // try immediately if ranges are already resolved
  tryJump(id);
}

function nudgeForSticky(offsetExtra = 155) {
  const css = getComputedStyle(document.documentElement)
    .getPropertyValue('--reader-sticky-offset');
  const base = parseInt(css, 10) || 0;
  return base + offsetExtra;
}

function tryJump(id) {
  if (!editor) return false;
  const pos = rangesRef.current.get(String(id)); // <-- string key
  if (!pos) return false;

  const view = editor.view;
  const coords = view.coordsAtPos(pos.from);
  const targetTop = window.scrollY + coords.top - nudgeForSticky();

  window.scrollTo({ top: targetTop, left: 0, behavior: 'smooth' });

  // optional: also select/flash
  editor.chain().setTextSelection({ from: pos.from, to: pos.to }).run();
  const root = view.dom;
  root.classList.add('hb-flash');
  setTimeout(() => root.classList.remove('hb-flash'), 300);

  return true;
}

useEffect(() => {
  if (!editor) return;
  const root = editor.view.dom;

  const onClick = async (e) => {
    const el = e.target.closest('mark.hb-hl');
    if (!el) return;

    // avoid interfering with text selection drags
    const sel = window.getSelection();
    if (sel && String(sel).length > 0) return;

    const id = el.getAttribute('data-hl-id');
    if (!id) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      await copyShareLinkForHighlight(id);
      // optional visual feedback on the mark
      el.classList.add('animate-[pulse_0.6s_ease_1]');
      setTimeout(() => el.classList.remove('animate-[pulse_0.6s_ease_1]'), 600);
    } catch (_) {}
  };

  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}, [editor, bookSlug, slug, shareToken]);



  return (
    <div className="max-w-3xl mx-auto p-4 space-y-3">
      {/* Progress bar */}
      <div className="fixed top-14 left-0 w-full h-1 bg-gray-200 z-50 overflow-hidden">
        <div
          ref={progRef}
          className="h-1 bg-blue-500 origin-left will-change-transform"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>

      {/* Sticky chapter header */}
      <div className="sticky top-10 z-40 bg-stone-100/90 dark:bg-stone-800/90 backdrop-blur z-10 flex items-center justify-between gap-3 pt-6 px-2 ">
        <h1 className="text-2xl! md:text-4xl! font-bold truncate text-center flex-1">
          {chapter?.title}
        </h1>

      </div>
      <ChapterNavBar
        bookTitle={chapter?.book_title || "The Big Book of Alcoholics Anonymous"}
        bookSlug={bookSlug}
        prevSlug={chapter?.neighbors?.prev_slug}   // or however you expose neighbors
        nextSlug={chapter?.neighbors?.next_slug}
      />
      <div className="prose hb-reader
          prose-slate
          prose-sm md:prose lg:prose-lg xl:prose-xl 2xl:prose-2xl
          dark:prose-invert
          max-w-none mx-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Highlight list */}
      {/* Highlights (collapsible) */}

        <ReaderBubbleMenu
          colors={PALETTE}
          value={cssFromStored(color)}
          onChangeColor={(css) => setColor(css)}
          onHighlight={createHighlight}
          onOpenModal={() => setOpenHighlightsModal(true)}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}  // NEW
          isDark={document.documentElement.classList.contains('dark')}              // NEW
        />

        <HighlightsModal
          open={openHighlightsModal}
          onClose={() => setOpenHighlightsModal(false)}
          highlights={(Array.isArray(highlights) ? highlights : [])}
          swatchOf={(h) => cssFromStored(h?.style?.color)}
          onJump={jumpToHighlight}
          onDelete={deleteHighlight}
          onShare={(id) => copyLink(id)}
          MiddleTruncate={MiddleTruncate}
        />
    </div>
  );
}