// app/javascript/components/ChapterViewer.jsx
import { useEffect, useState, useRef, useLayoutEffect, useCallback } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import axios from "axios";
import { PageBreak } from "../tiptap/PageBreak";
import TextAlign from '@tiptap/extension-text-align';
import { Highlighter, ChevronRight, ChevronDown, Moon, Sun, Search } from "lucide-react"; // <-- added Search
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
import useHighlightClickToShare from "../utils/useHighlightClickToShare";

// Map friendly color names to actual CSS colors (backgroundColor)
const PALETTE = {
  yellow: '#fef08a', // tailwind yellow-200-ish
  lime: '#bef264',
  cyan: '#a5f3fc',
  pink: '#fbcfe8',
  orange: '#fed7aa',
};

/* ---------- (snip) unchanged helpers: useHighlightShareLink, truncateMiddle, offsetToPos, resolveRanges ---------- */
/* (I left them exactly as you had them above — omitted here for brevity in this example) */

function useHighlightShareLink(bookSlug, slug) {
  const [shareToken, setShareToken] = useState(null);

  const ensureShareToken = useCallback(async () => {
    if (shareToken) return shareToken;
    try {
      const { data } = await axios.post("/api/highlights/share");
      setShareToken(data.share_token);
      return data.share_token;
    } catch (error) {
      console.error("Failed to create share token:", error);
      throw new Error("Failed to create share token");
    }
  }, [shareToken]);

  const linkFor = useCallback(
    async (hlId) => {
      try {
        const token = await ensureShareToken();
        return `${location.origin}/books/${bookSlug}/chapters/${slug}?share=${encodeURIComponent(
          token
        )}#hl-${hlId}`;
      } catch (error) {
        console.error("Failed to generate share link:", error);
        return `${location.origin}/books/${bookSlug}/chapters/${slug}#hl-${hlId}`;
      }
    },
    [bookSlug, slug, ensureShareToken]
  );

  const copyLink = useCallback(
    async (hlId) => {
      try {
        const url = await linkFor(hlId);
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

function offsetToPos(doc, target) {
  const maxPos = Math.max(1, doc.content.size - 1);
  if (target <= 0) return 1;

  let lo = 1;
  let hi = maxPos;

  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const len = doc.textBetween(0, mid, "\n", "\n").length;
    if (len < target) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, maxPos);
}

function resolveRanges(editor, highlights) {
  if (!editor) return [];
  
  const text = editor.getText();
  return (Array.isArray(highlights) ? highlights : []).map(h => {
    const sel = h.selector || {};
    let start = sel.position?.start, end = sel.position?.end;
    
    if ((start == null || end == null) && sel.quote?.exact) {
      const idx = text.indexOf(sel.quote.exact);
      if (idx >= 0) { 
        start = idx; 
        end = idx + sel.quote.exact.length; 
      }
    }
    
    if (start == null || end == null || end <= start) return null;
    
    const from = offsetToPos(editor.state.doc, start);
    const to = offsetToPos(editor.state.doc, end);
    return { 
      id: h.id, 
      from, 
      to, 
      color: (h.style && h.style.color) || "yellow" 
    };
  }).filter(Boolean);
}

/* replacement: useHideCoveredPageBreaks (IntersectionObserver + minimal DOM writes) */
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
    let raf = null;
    let observer = null;
    let mo = null;

    const indexEls = () => {
      els = Array.from(document.querySelectorAll('[data-page-break]'));
      els.forEach((el, i) => (el.dataset.pbIndex = String(i)));
    };

    // Perform the single scan + minimal DOM updates. Called inside RAF
    const recomputeAndApply = () => {
      if (!els.length) return;

      const topOffset = stickyOffset();
      let idx = -1;
      // single scan using getBoundingClientRect once per element on IO callback
      for (let i = 0; i < els.length; i++) {
        const top = els[i].getBoundingClientRect().top;
        if (top - topOffset <= 0) idx = i;
        else break;
      }

      if (idx === currentIdx) return;
      currentIdx = idx;

      // minimal DOM writes: toggle classes only when idx changes
      els.forEach((el, i) => {
        // Only touch classList when it actually changes to reduce paints
        if (i === idx) {
          if (!el.classList.contains('is-stuck')) el.classList.add('is-stuck');
          if (el.classList.contains('is-covered')) el.classList.remove('is-covered');
        } else if (i < idx) {
          if (!el.classList.contains('is-covered')) el.classList.add('is-covered');
          if (el.classList.contains('is-stuck')) el.classList.remove('is-stuck');
        } else {
          if (el.classList.contains('is-covered')) el.classList.remove('is-covered');
          if (el.classList.contains('is-stuck')) el.classList.remove('is-stuck');
        }
      });

      // If you added the single cloned sticky pill, update it here (cheap text update + class toggle)
      try {
        const stickyContainer = document.getElementById('page-break-sticky');
        const stickyPill = document.getElementById('page-break-sticky-pill');

        if (idx >= 0) {
          const el = els[idx];
          const originalPill = el.querySelector('.page-break__pill');
          const label = originalPill ? originalPill.textContent.trim() : `Page ${idx + 1}`;
          if (stickyPill && stickyPill.textContent !== label) stickyPill.textContent = label;
          if (stickyContainer) {
            stickyContainer.classList.remove('hidden', 'hide');
            stickyContainer.classList.add('show');
          }
        } else {
          if (stickyContainer) {
            stickyContainer.classList.remove('show');
            stickyContainer.classList.add('hide');
            // optionally hide after animation
            window.setTimeout(() => stickyContainer?.classList.add('hidden'), 160);
          }
        }
      } catch (e) {
        // non-fatal; keep behavior graceful if elements missing
        // console.warn('sticky pill update failed', e);
      }
    };

    // Debounced entry - schedule recompute inside RAF
    const scheduleRecompute = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        recomputeAndApply();
        raf = null;
      });
    };

    const setupObservers = () => {
      indexEls();

      // intersection observer to wake us when page-breaks cross the sticky line
      const rootMargin = `-${stickyOffset()}px 0px 0px 0px`;
      observer = new IntersectionObserver(
        (entries) => {
          // whenever IO fires, schedule a recompute (IO calls much less than scroll)
          scheduleRecompute();
        },
        { root: null, rootMargin, threshold: [0, 0.001] }
      );

      els.forEach((el) => observer.observe(el));

      // small mutation observer so new page-breaks get indexed
      const dom = editor.view?.dom || document;
      mo = new MutationObserver(() => {
        indexEls();
        scheduleRecompute();
      });
      mo.observe(dom, { childList: true, subtree: true });

      // initial compute
      scheduleRecompute();
    };

    // Ensure we start after editor is ready
    const onEditorReady = () => {
      // small delay to let the editor finish layout
      setTimeout(() => {
        setupObservers();
      }, 100);
    };

    if (editor.isReady) onEditorReady();
    else editor.on('create', onEditorReady);

    // also watch resize (infrequent)
    const onResize = () => {
      indexEls();
      scheduleRecompute();
    };
    window.addEventListener('resize', onResize, { passive: true });

    // cleanup
    return () => {
      window.removeEventListener('resize', onResize);
      if (observer) observer.disconnect();
      if (mo) mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
      editor.off('create', onEditorReady);
    };
  }, [editor]);
}

/* ---------- Main component starts here (I left your original logic intact and added new pieces) ---------- */

export default function ChapterViewer({ bookSlug, slug }) {
  const [chapter, setChapter] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [color, setColor] = useState("yellow");
  const { copyLink } = useHighlightShareLink(bookSlug, slug);

  const rangesRef = useRef(new Map()); // id -> { from, to }
  const applyingRef = useRef(false);
  const editorMountedRef = useRef(false);

  const [openHighlightsModal, setOpenHighlightsModal] = useState(false);
  const [openChaptersModal, setOpenChaptersModal] = useState(false); // <-- new: chapter modal open state
  const [chaptersList, setChaptersList] = useState(null); // <-- fetched list of chapters
  const cssFromStored = (stored) => PALETTE[stored] || stored || PALETTE.yellow;

  const [pendingJumpId, setPendingJumpId] = useState(null);
  
  useLayoutEffect(() => {
    const m = location.hash.match(/^#hl-(.+)$/);
    if (m) setPendingJumpId(m[1]); // keep as string
  }, []);

  /* ---------- editor configuration (unchanged, except onCreate sets mounted ref) ---------- */

  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({ paragraph: false }),
      Heading,
      ParagraphWithPage,
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
    onCreate: () => {
      editorMountedRef.current = true;
    },
    onDestroy: () => {
      editorMountedRef.current = false;
    }
  }, [chapter]);

  // Safe reference to editor view
  const viewRef = useRef(null);
  
  useLayoutEffect(() => {
    if (!editor) return;
    
    const updateViewRef = () => {
      try {
        if (editor.view && typeof editor.view === 'object') {
          viewRef.current = editor.view;
        }
      } catch (error) {
        console.warn("Could not access editor view:", error);
      }
    };
    
    updateViewRef();
    editor.on('create', updateViewRef);
    editor.on('update', updateViewRef);
    
    return () => {
      editor.off('create', updateViewRef);
      editor.off('update', updateViewRef);
    };
  }, [editor]);

  useHideCoveredPageBreaks(editor);
  useHighlightClickToShare(viewRef, null, bookSlug, slug);

  /* ---------- applyHighlights (unchanged) ---------- */
  const applyHighlights = useCallback(() => {
    if (!editor || applyingRef.current || !editorMountedRef.current) return;
    
    let view;
    try {
      view = editor.view;
      if (!view || !view.state) return;
    } catch (error) {
      console.warn("Editor view not available for highlighting:", error);
      return;
    }

    const { state } = editor;
    const doc = state.doc;
    const markType = state.schema?.marks?.highlight;
    
    if (!doc || !markType) return;

    applyingRef.current = true;
    const wasEditable = editor.isEditable;

    try {
      editor.setEditable(true);
      let tr = state.tr.removeMark(0, doc.content.size, markType);

      const resolved = resolveRanges(editor, highlights);
      rangesRef.current.clear();
      
      for (const r of resolved) {
        const colorCss = PALETTE[r.color] || r.color || PALETTE.yellow;
        rangesRef.current.set(String(r.id), { from: r.from, to: r.to });
        
        tr = tr.addMark(
          r.from,
          r.to,
          markType.create({ 
            color: colorCss, 
            hlId: String(r.id), 
            class: 'hb-hl' 
          })
        );
      }

      if (tr.steps.length) {
        try {
          view.dispatch(tr);
        } catch (error) {
          console.warn("Failed to dispatch highlight transaction:", error);
        }
      }
    } finally {
      editor.setEditable(wasEditable);
      applyingRef.current = false;
    }
  }, [editor, highlights]);

  useLayoutEffect(() => {
    if (!editor) return;
    
    const runHighlights = () => {
      setTimeout(applyHighlights, 50);
    };
    
    if (editorMountedRef.current) {
      runHighlights();
    } else {
      editor.on('create', runHighlights);
    }
    
    return () => editor.off('create', runHighlights);
  }, [editor, applyHighlights]);

  // Theme management (left unchanged)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'system';
  });

  useLayoutEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && systemDark);

    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);

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

  // Scroll progress indicator (unchanged)
  const progRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = progRef.current;
    if (!el) return;

    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      
      rafRef.current = requestAnimationFrame(() => {
        const doc = document.documentElement;
        const total = (doc.scrollHeight - doc.clientHeight) || 1;
        const pct = Math.min(1, Math.max(0, window.scrollY / total));
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

  // Load chapter + highlights (unchanged)
  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      try {
        const ch = await axios.get(`/api/books/${bookSlug}/chapters/${slug}.json`);
        if (isMounted) setChapter(ch.data);

        const params = new URLSearchParams(location.search);
        const share = params.get('share');

        const hls = await axios.get(`/api/highlights`, {
          params: { chapter_slug: slug, ...(share ? { share } : {}) }
        });

        if (isMounted) setHighlights(Array.isArray(hls.data) ? hls.data : []);
      } catch (e) {
        console.error("Failed to load chapter", e);
      }
    })();
    
    return () => {
      isMounted = false;
    };
  }, [bookSlug, slug]);

  // Share token management (unchanged)
  const [shareToken, setShareToken] = useState(null);

  async function ensureShareToken() {
    if (shareToken) return shareToken;
    
    try {
      const { data } = await axios.post('/api/highlights/share');
      setShareToken(data.share_token);
      return data.share_token;
    } catch (e) {
      throw new Error('LOGIN_REQUIRED');
    }
  }

  // createHighlight / deleteHighlight (unchanged)
  async function createHighlight() {
    if (!editor) return;
    
    try {
      const { from, to } = editor.state.selection;
      if (from === to) return;
      
      const before = editor.state.doc.textBetween(0, from, "\n", "\n");
      const exact = editor.state.doc.textBetween(from, to, "\n", "\n");
      const after = editor.state.doc.textBetween(to, editor.state.doc.content.size, "\n", "\n");
      
      const start = before.length;
      const end = start + exact.length;
      
      const payload = {
        highlight: {
          chapter_slug: slug,
          style: { color },
          selector: {
            type: "Composite",
            position: { type: "TextPositionSelector", start, end },
            quote: { 
              type: "TextQuoteSelector", 
              exact, 
              prefix: before.slice(-40), 
              suffix: after.slice(0, 40) 
            }
          }
        }
      };
      
      const res = await axios.post("/api/highlights", payload);
      const newId = String(res.data.id);
      
      setHighlights(prev => [...prev, { id: newId, ...payload.highlight }]);
    } catch (error) {
      console.error("Failed to create highlight:", error);
    }
  }

  async function deleteHighlight(id) {
    try {
      await axios.delete(`/api/highlights/${id}`);
      setHighlights(prev => prev.filter(h => h.id !== id));
    } catch (error) {
      console.error("Failed to delete highlight:", error);
    }
  }

  // Sticky offset helpers (unchanged)
  function getStickyOffset() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--reader-sticky-offset');
    const n = parseInt(v, 10);
    return (Number.isFinite(n) ? n : 0) + 45;
  }

  function nudgeForSticky(offsetExtra = 155) {
    const css = getComputedStyle(document.documentElement)
      .getPropertyValue('--reader-sticky-offset');
    const base = parseInt(css, 10) || 0;
    return base + offsetExtra;
  }

  // Jump to highlight (unchanged)
  function jumpToHighlight(id) {
    if (!editor) return;

    if (history.replaceState) {
      history.replaceState(null, "", `#hl-${id}`);
    } else {
      location.hash = `#hl-${id}`;
    }
    
    setPendingJumpId(id);
    tryJump(id);
  }

  function tryJump(id) {
    if (!editor) return false;
    
    const pos = rangesRef.current.get(String(id));
    if (!pos) return false;

    try {
      const view = editor.view;
      const coords = view.coordsAtPos(pos.from);
      const targetTop = window.scrollY + coords.top - nudgeForSticky();

      window.scrollTo({ top: targetTop, left: 0, behavior: 'smooth' });

      editor.chain().setTextSelection({ from: pos.from, to: pos.to }).run();
      
      const root = view.dom;
      if (root) {
        root.classList.add('hb-flash');
        setTimeout(() => root.classList.remove('hb-flash'), 300);
      }

      return true;
    } catch (error) {
      console.warn("Failed to jump to highlight:", error);
      return false;
    }
  }

  // Try pending jump when ready (unchanged)
  useEffect(() => {
    if (pendingJumpId && editorMountedRef.current) {
      setTimeout(() => tryJump(pendingJumpId), 100);
    }
  }, [pendingJumpId, editorMountedRef.current]);

  /* ------------------ NEW: chapters listing + jump logic ------------------ */

  // Fetch a list of chapters for the book (tries a couple of sensible endpoints)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Try a few endpoints; adjust depending on your API
        const endpoints = [
          `/api/books/${bookSlug}/chapters`, // common restful index
          `/api/books/${bookSlug}/chapters.json`,
          `/api/books/${bookSlug}/toc`, // sometimes used
        ];
        for (const ep of endpoints) {
          try {
            const res = await axios.get(ep);
            const data = res.data;
            if (mounted && Array.isArray(data) && data.length) {
              setChaptersList(data);
              break;
            }
          } catch (e) {
            // ignore and try next
          }
        }
      } catch (e) {
        console.warn("Could not fetch chapters list", e);
      }
    })();
    return () => (mounted = false);
  }, [bookSlug]);

  // Try to locate a page DOM node by page number
  function findPageElementByNumber(pageNum) {
    if (!pageNum && pageNum !== 0) return null;
    // common attributes:
    return document.querySelector(
      `[data-page="${pageNum}"], [data-page-number="${pageNum}"], [data-page-break="${pageNum}"]`
    );
  }

  // Jump to a chapter object (tries several strategies)
  async function jumpToChapter(ch) {
    if (!ch) return;

    // 1) If chapter has selector text positions, map them to pos
    const sel = ch.selector || ch.start_selector || ch.position;
    if (sel && typeof sel.start === 'number') {
      try {
        const fromPos = offsetToPos(editor?.state?.doc, sel.start);
        const toPos = offsetToPos(editor?.state?.doc, sel.end || sel.start + 1);
        const coords = editor.view.coordsAtPos(fromPos);
        const targetTop = window.scrollY + coords.top - nudgeForSticky(155);
        window.scrollTo({ top: targetTop, left: 0, behavior: 'smooth' });
        editor.chain().setTextSelection({ from: fromPos, to: toPos }).run();
        return;
      } catch (e) {
        // fallthrough
        console.warn("Failed to jump using selector:", e);
      }
    }

    // 2) If chapter supplies page_start, try to find page element
    const pageStart = ch.page_start || ch.start_page || (ch.page_range && ch.page_range[0]);
    if (pageStart != null) {
      const el = findPageElementByNumber(pageStart);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - getStickyOffset();
        window.scrollTo({ top, left: 0, behavior: 'smooth' });
        return;
      }
    }

    // 3) If chapter has an intro quote that exists in text, find that offset
    if (ch.extract || ch.intro || ch.preview) {
      const text = editor?.getText?.();
      const q = ch.extract || ch.intro || ch.preview;
      const idx = text ? text.indexOf(q) : -1;
      if (idx >= 0) {
        const pos = offsetToPos(editor.state.doc, idx);
        const coords = editor.view.coordsAtPos(pos);
        const targetTop = window.scrollY + coords.top - nudgeForSticky(155);
        window.scrollTo({ top: targetTop, left: 0, behavior: 'smooth' });
        return;
      }
    }

    // 4) fallback: navigate to the chapter page
    window.location.href = `/books/${bookSlug}/chapters/${ch.slug || ch.id}`;
  }

  /* ------------------ UI: header + modal ------------------ */

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
        <h1
          className="text-2xl! md:text-4xl! font-bold truncate text-center flex-1 cursor-pointer"
          onClick={() => setOpenChaptersModal(true)} // header click opens modal
          title="Open chapter index"
        >
          {chapter?.title}
        </h1>

        {/* Magnifier button (also opens modal) */}
        <button
          aria-label="Open chapters"
          className="ml-3 p-2 rounded hover:bg-stone-200 dark:hover:bg-stone-700"
          onClick={() => setOpenChaptersModal(true)}
        >
          <Search size={18} />
        </button>
      </div>
      
      <ChapterNavBar
        bookTitle={chapter?.book_title || "The Big Book of Alcoholics Anonymous"}
        bookSlug={bookSlug}
        prevSlug={chapter?.neighbors?.prev_slug}
        nextSlug={chapter?.neighbors?.next_slug}
      />
      
      <div className="prose hb-reader
          prose-slate
          prose-sm md:prose lg:prose-lg xl:prose-xl 2xl:prose-2xl
          dark:prose-invert
          max-w-none mx-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Reader bubble menu for highlights */}
      <ReaderBubbleMenu
        colors={PALETTE}
        value={cssFromStored(color)}
        onChangeColor={(css) => setColor(css)}
        onHighlight={createHighlight}
        onOpenModal={() => setOpenHighlightsModal(true)}
        onOpenChapters={() => setOpenChaptersModal(true)} // <-- new optional prop
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        isDark={document.documentElement.classList.contains('dark')}
      />

      {/* Highlights modal */}
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

      {/* ---------- NEW: Chapters modal ---------- */}
      {openChaptersModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpenChaptersModal(false)}
          />
          <div className="relative bg-white dark:bg-stone-900 rounded-xl shadow-xl max-h-[80vh] overflow-auto w-full max-w-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Chapters</h2>
              <button
                className="p-2 rounded hover:bg-stone-200 dark:hover:bg-stone-800"
                onClick={() => setOpenChaptersModal(false)}
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              {Array.isArray(chaptersList) ? (
                chaptersList.map((c) => (
                  <button
                    key={c.id || c.slug || c.title}
                    onClick={() => {
                      setOpenChaptersModal(false);
                      setTimeout(() => jumpToChapter(c), 50);
                    }}
                    className="w-full text-left p-3 rounded hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{c.title || c.name}</div>
                      <div className="text-sm text-stone-500 dark:text-stone-400">
                        {c.page_start != null || c.page_end != null
                          ? `pages ${c.page_start || '?'}${c.page_end ? `–${c.page_end}` : ''}`
                          : c.preview
                          ? truncateMiddle(c.preview, 80)
                          : c.subtitle || ''}
                      </div>
                    </div>
                    <ChevronRight />
                  </button>
                ))
              ) : (
                <div className="text-sm text-stone-500">No chapter index available.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}