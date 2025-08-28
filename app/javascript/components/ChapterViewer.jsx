// app/javascript/components/ChapterViewer.jsx
import { useEffect, useState, useRef, useLayoutEffect, useCallback } from "react";
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
import useHighlightClickToShare from "../utils/useHighlightClickToShare";

// Map friendly color names to actual CSS colors (backgroundColor)
const PALETTE = {
  yellow: '#fef08a', // tailwind yellow-200-ish
  lime: '#bef264',
  cyan: '#a5f3fc',
  pink: '#fbcfe8',
  orange: '#fed7aa',
};

/**
 * Custom hook for handling highlight sharing functionality
 */
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

/**
 * Truncates a string from the middle with ellipsis
 */
function truncateMiddle(str, maxLength = 80) {
  if (!str || str.length <= maxLength) return str;

  const ellipsis = "…";
  const keep = maxLength - ellipsis.length;
  const front = Math.ceil(keep / 2);
  const back = Math.floor(keep / 2);

  return str.slice(0, front) + ellipsis + str.slice(str.length - back);
}

/**
 * Maps a plain-text offset to a ProseMirror position using textBetween + binary search
 */
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

/**
 * Resolves highlight ranges to editor positions
 */
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

/**
 * Custom hook to hide page breaks that are covered by sticky headers
 */
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
        if (!els.length) { 
          ticking = false; 
          return; 
        }
        
        const topOffset = stickyOffset();
        let idx = -1;
        
        for (let i = 0; i < els.length; i++) {
          const top = els[i].getBoundingClientRect().top;
          if (top - topOffset <= 0) idx = i; 
          else break;
        }
        
        if (idx !== currentIdx) {
          els.forEach((el, i) => {
            el.classList.toggle('is-stuck', i === idx);
            el.classList.toggle('is-covered', i < idx);
          });
          currentIdx = idx;
        }
        
        ticking = false;
      });
    };

    // Wait for editor to be fully mounted before setting up observers
    const setupObservers = () => {
      const dom = editor.view?.dom;
      if (!dom) return;
      
      const mo = new MutationObserver(() => { 
        indexEls(); 
        update(); 
      });
      
      mo.observe(dom, { childList: true, subtree: true });
      indexEls();
      requestAnimationFrame(update);
      
      return mo;
    };

    let mo;
    const onEditorReady = () => {
      // Small delay to ensure editor is fully mounted
      setTimeout(() => {
        mo = setupObservers();
      }, 100);
    };

    if (editor.isReady) {
      onEditorReady();
    } else {
      editor.on('create', onEditorReady);
    }

    const onScroll = () => update();
    const onResize = () => { indexEls(); update(); };
    
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (mo) mo.disconnect();
      editor.off('create', onEditorReady);
    };
  }, [editor]);
}

/**
 * Main ChapterViewer component
 */
export default function ChapterViewer({ bookSlug, slug }) {
  const [chapter, setChapter] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [color, setColor] = useState("yellow");
  const { copyLink } = useHighlightShareLink(bookSlug, slug);

  const rangesRef = useRef(new Map()); // id -> { from, to }
  const applyingRef = useRef(false);
  const editorMountedRef = useRef(false);

  const [openHighlightsModal, setOpenHighlightsModal] = useState(false);
  const cssFromStored = (stored) => PALETTE[stored] || stored || PALETTE.yellow;

  const [pendingJumpId, setPendingJumpId] = useState(null);
  
  useLayoutEffect(() => {
    const m = location.hash.match(/^#hl-(.+)$/);
    if (m) setPendingJumpId(m[1]); // keep as string
  }, []);

  // Editor configuration
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
        // Safely access the editor view
        if (editor.view && typeof editor.view === 'object') {
          viewRef.current = editor.view;
        }
      } catch (error) {
        console.warn("Could not access editor view:", error);
      }
    };
    
    // Update initially
    updateViewRef();
    
    // Listen for editor creation/updates
    editor.on('create', updateViewRef);
    editor.on('update', updateViewRef);
    
    return () => {
      editor.off('create', updateViewRef);
      editor.off('update', updateViewRef);
    };
  }, [editor]);

  // Apply the page break hiding functionality
  useHideCoveredPageBreaks(editor);

  // Enable highlight click-to-share functionality
  useHighlightClickToShare(viewRef, copyLink);

  /**
   * Applies highlights to the editor content
   */
  const applyHighlights = useCallback(() => {
    if (!editor || applyingRef.current || !editorMountedRef.current) return;
    
    // Safely check if view is available
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

  // Apply highlights when ready or when highlights change
  useLayoutEffect(() => {
    if (!editor) return;
    
    const runHighlights = () => {
      // Small delay to ensure editor is fully ready
      setTimeout(applyHighlights, 50);
    };
    
    if (editorMountedRef.current) {
      runHighlights();
    } else {
      editor.on('create', runHighlights);
    }
    
    return () => editor.off('create', runHighlights);
  }, [editor, applyHighlights]);

  // Theme management
  const [theme, setTheme] = useState(() => {
    // Prefer saved setting; else follow system
    return localStorage.getItem('theme') || 'system';
  });

  // Apply theme to <html>
  useLayoutEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && systemDark);

    // Make this explicit, not toggle
    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);

    // Keep theme-color meta in sync (optional)
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

  // Scroll progress indicator
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

  // Load chapter + highlights
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

  // Share token management
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

  /**
   * Creates a new highlight from the current selection
   */
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

  /**
   * Deletes a highlight
   */
  async function deleteHighlight(id) {
    try {
      await axios.delete(`/api/highlights/${id}`);
      setHighlights(prev => prev.filter(h => h.id !== id));
    } catch (error) {
      console.error("Failed to delete highlight:", error);
    }
  }

  /**
   * Calculates sticky offset for proper scrolling
   */
  function getStickyOffset() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--reader-sticky-offset');
    const n = parseInt(v, 10);
    // Add a little breathing room so the text isn't jammed under the bar
    return (Number.isFinite(n) ? n : 0) + 45;
  }

  /**
   * Jumps to a specific highlight
   */
  function jumpToHighlight(id) {
    if (!editor) return;

    // Remember this jump in the URL so reloads work
    if (history.replaceState) {
      history.replaceState(null, "", `#hl-${id}`);
    } else {
      location.hash = `#hl-${id}`;
    }
    
    setPendingJumpId(id);
    // Try immediately if ranges are already resolved
    tryJump(id);
  }

  function nudgeForSticky(offsetExtra = 155) {
    const css = getComputedStyle(document.documentElement)
      .getPropertyValue('--reader-sticky-offset');
    const base = parseInt(css, 10) || 0;
    return base + offsetExtra;
  }

  /**
   * Attempts to jump to a highlight position
   */
  function tryJump(id) {
    if (!editor) return false;
    
    const pos = rangesRef.current.get(String(id));
    if (!pos) return false;

    try {
      const view = editor.view;
      const coords = view.coordsAtPos(pos.from);
      const targetTop = window.scrollY + coords.top - nudgeForSticky();

      window.scrollTo({ top: targetTop, left: 0, behavior: 'smooth' });

      // Optional: also select/flash
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

  // Try to jump to pending highlight when editor is ready
  useEffect(() => {
    if (pendingJumpId && editorMountedRef.current) {
      // Small delay to ensure everything is rendered
      setTimeout(() => tryJump(pendingJumpId), 100);
    }
  }, [pendingJumpId, editorMountedRef.current]);

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
    </div>
  );
}