// app/javascript/components/ChapterViewer.jsx
import { useEffect, useState, useRef, useLayoutEffect, useCallback } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import axios from "axios";
import { PageBreak } from "../tiptap/PageBreak";
import TextAlign from '@tiptap/extension-text-align';
import ReaderBubbleMenu from "../components/ReaderBubbleMenu";
import HighlightsModal from "../components/HighlightsModal";
import { ReaderBar, ReaderFooter, ChaptersDialog, ModeSwitch, useChapterHotkeys, chapterHref, tocHref, isAdminViewer } from "./book/ReaderChrome";
import { SearchDialog, SearchBanner, useInTextSearch, useSearchHotkey } from "./book/BookSearch";
import { rememberLastRead } from "./book/readingProgress";
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
import HighlightCard, { HIGHLIGHT_PALETTE as PALETTE, highlightCss } from "./book/HighlightCard";
import { highlightUrl, allHighlightsUrl, shareLink, useToast } from "./book/highlightSharing";
import { MessageSquareText } from "lucide-react";

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
  
  // Same separators as createHighlight, so offsets line up.
  const doc = editor.state.doc;
  const text = doc.textBetween(0, doc.content.size, "\n", "\n");
  return (Array.isArray(highlights) ? highlights : []).map(h => {
    const sel = h.selector || {};
    let start = sel.position?.start, end = sel.position?.end;
    const exact = sel.quote?.exact;

    // If the chapter was edited since, the offsets drift: find the quote again,
    // preferring the copy that follows the stored prefix.
    if (exact && (start == null || end == null || text.slice(start, end) !== exact)) {
      const prefix = sel.quote.prefix || "";
      let idx = prefix ? text.indexOf(prefix + exact) : -1;
      idx = idx >= 0 ? idx + prefix.length : text.indexOf(exact);
      if (idx >= 0) {
        start = idx;
        end = idx + exact.length;
      } else {
        start = end = null;
      }
    }
    
    if (start == null || end == null || end <= start) return null;
    
    const from = offsetToPos(editor.state.doc, start);
    const to = offsetToPos(editor.state.doc, end);
    return { 
      id: h.id, 
      from, 
      to, 
      color: (h.style && h.style.color) || "yellow",
      hasNote: !!h.note,
    };
  }).filter(Boolean);
}

/* replacement: useHideCoveredPageBreaks (IntersectionObserver + minimal DOM writes) */
function useHideCoveredPageBreaks(editor) {
  useLayoutEffect(() => {
    if (!editor) return;

    let raf = null;
    let resizeObserver = null;
    let mutationObserver = null;
    let els = [];
    let currentIdx = -1;

    const getStickyOffset = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--reader-sticky-offset");

      const parsed = parseInt(value, 10);

      return Number.isFinite(parsed) ? parsed : 0;
    };

    const indexElements = () => {
      if (!editor.view?.dom) return;

      els = Array.from(
        editor.view.dom.querySelectorAll("[data-page-break]")
      );

      els.forEach((el, index) => {
        el.dataset.pbIndex = String(index);
      });
    };

    const applyState = (idx) => {
      if (idx === currentIdx) return;

      currentIdx = idx;

      els.forEach((el, index) => {
        const isCurrent = index === idx;
        const isCovered = index < idx;

        el.classList.toggle("is-stuck", isCurrent);
        el.classList.toggle("is-covered", isCovered);
      });

      // Update the cloned sticky pill, if present.
      const stickyContainer =
        document.getElementById("page-break-sticky");

      const stickyPill =
        document.getElementById("page-break-sticky-pill");

      if (idx >= 0) {
        const current = els[idx];

        const originalPill =
          current.querySelector(".page-break__pill");

        const label =
          originalPill?.textContent?.trim() ||
          current.dataset.page ||
          `Page ${idx + 1}`;

        if (stickyPill && stickyPill.textContent !== label) {
          stickyPill.textContent = label;
        }

        if (stickyContainer) {
          stickyContainer.classList.remove("hidden", "hide");
          stickyContainer.classList.add("show");
        }
      } else {
        if (stickyContainer) {
          stickyContainer.classList.remove("show");
          stickyContainer.classList.add("hide");

          window.setTimeout(() => {
            if (
              stickyContainer.classList.contains("hide")
            ) {
              stickyContainer.classList.add("hidden");
            }
          }, 160);
        }
      }
    };

    const recompute = () => {
      raf = null;

      if (!els.length) return;

      const stickyOffset = getStickyOffset();

      let idx = -1;

      /*
       * Find the last page break whose top has crossed
       * the sticky header line.
       */
      for (let i = 0; i < els.length; i++) {
        const rect = els[i].getBoundingClientRect();

        if (rect.top <= stickyOffset) {
          idx = i;
        } else {
          break;
        }
      }

      applyState(idx);
    };

    const schedule = () => {
      if (raf !== null) return;

      raf = requestAnimationFrame(recompute);
    };

    const setup = () => {
      indexElements();
      schedule();
    };

    /*
     * IMPORTANT:
     *
     * Don't wait for editor.on("create").
     * By the time this hook receives `editor`, the editor
     * has normally already been created.
     */
    setup();

    // Scroll is the important event here.
    window.addEventListener("scroll", schedule, {
      passive: true,
    });

    window.addEventListener("resize", () => {
      indexElements();
      schedule();
    }, {
      passive: true,
    });

    /*
     * Tiptap can change its DOM when content changes.
     * Re-index page breaks when that happens.
     */
    if (editor.view?.dom) {
      mutationObserver = new MutationObserver(() => {
        indexElements();
        schedule();
      });

      mutationObserver.observe(editor.view.dom, {
        childList: true,
        subtree: true,
      });

      /*
       * Keep the page-break calculation correct when the
       * editor's layout changes.
       */
      resizeObserver = new ResizeObserver(() => {
        schedule();
      });

      resizeObserver.observe(editor.view.dom);
    }

    return () => {
      window.removeEventListener("scroll", schedule);

      if (raf !== null) {
        cancelAnimationFrame(raf);
      }

      if (mutationObserver) {
        mutationObserver.disconnect();
      }

      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [editor]);
}

/* ---------- Main component starts here (I left your original logic intact and added new pieces) ---------- */

export default function ChapterViewer({ bookSlug, slug }) {
  const [chapter, setChapter] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [color, setColor] = useState("yellow");
  const [toast, toastNode] = useToast();
  const signedIn = document.body.dataset.currentUser === "true";

  // ?hl=SHARE_ID shows one shared highlight, ?share=TOKEN all of a reader's.
  const [sharedParams] = useState(() => {
    const p = new URLSearchParams(location.search);
    return { hl: p.get("hl"), share: p.get("share") };
  });
  const sharedView = !!(sharedParams.hl || sharedParams.share);

  // The highlight card (tap a highlight) and whether it opens straight into the note editor.
  const [cardId, setCardId] = useState(null);
  const [cardEditing, setCardEditing] = useState(false);
  const cardHighlight = cardId ? highlights.find((h) => String(h.id) === String(cardId)) : null;
  const openCard = useCallback((id, { edit = false } = {}) => {
    setCardEditing(edit);
    setCardId(String(id));
  }, []);

  const rangesRef = useRef(new Map()); // id -> { from, to }
  const applyingRef = useRef(false);
  const editorMountedRef = useRef(false);

  const [openHighlightsModal, setOpenHighlightsModal] = useState(false);
  const [openChaptersModal, setOpenChaptersModal] = useState(false); // <-- new: chapter modal open state
  const [chaptersList, setChaptersList] = useState(null); // <-- fetched list of chapters
  const cssFromStored = highlightCss;

  // A #hl-ID in the URL waits here until the highlights are drawn, then we scroll to it.
  const pendingJumpRef = useRef(null);
  useLayoutEffect(() => {
    const m = location.hash.match(/^#hl-(.+)$/);
    if (m) pendingJumpRef.current = { id: m[1], open: sharedView };
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
            hasNote: r.hasNote,
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

    const pending = pendingJumpRef.current;
    if (pending && rangesRef.current.has(String(pending.id))) {
      pendingJumpRef.current = null;
      setTimeout(() => {
        tryJump(pending.id);
        if (pending.open) openCard(pending.id);
      }, 60);
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

        const { hl, share } = sharedParams;
        const hls = await axios.get(`/api/highlights`, {
          params: {
            chapter_slug: slug,
            book_slug: bookSlug,
            ...(hl ? { hl } : share ? { share } : {}),
          }
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

  /* ------------------ Creating and sharing highlights ------------------ */

  // The last text selection inside the chapter, kept so a tap on the
  // popover (which can collapse the selection on phones) still knows what to highlight.
  const lastSelectionRef = useRef(null);
  const [selectionPop, setSelectionPop] = useState(null); // { x, y } in page coordinates

  useEffect(() => {
    if (!editor || sharedView) return;
    let raf = 0;
    const onSelectionChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let view;
        try { view = editor.view; } catch { return; }
        const sel = window.getSelection();
        if (!view?.dom || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
          setSelectionPop(null);
          return;
        }
        const range = sel.getRangeAt(0);
        if (!view.dom.contains(range.commonAncestorContainer) || !sel.toString().trim()) {
          setSelectionPop(null);
          return;
        }
        try {
          const a = view.posAtDOM(range.startContainer, range.startOffset);
          const b = view.posAtDOM(range.endContainer, range.endOffset);
          lastSelectionRef.current = { from: Math.min(a, b), to: Math.max(a, b) };
        } catch {
          return;
        }
        const rect = range.getBoundingClientRect();
        const half = 150;
        const x = Math.min(Math.max(rect.left + rect.width / 2, half), window.innerWidth - half);
        const below = window.matchMedia?.("(pointer: coarse)").matches;
        setSelectionPop({ x: x + window.scrollX, y: (below ? rect.bottom : rect.top) + window.scrollY, below });
      });
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [editor, sharedView]);

  async function createHighlight(colorName = color, { withNote = false } = {}) {
    if (!editor) return;
    if (!signedIn) {
      toast("Sign in to save highlights");
      return;
    }

    const sel = lastSelectionRef.current || editor.state.selection;
    const { from, to } = sel || {};
    if (from == null || from === to) {
      toast("Select some text first");
      return;
    }

    const doc = editor.state.doc;
    const before = doc.textBetween(0, from, "\n", "\n");
    const exact = doc.textBetween(from, to, "\n", "\n");
    const after = doc.textBetween(to, doc.content.size, "\n", "\n");
    if (!exact.trim()) return;

    const start = before.length;
    const end = start + exact.length;
    // The palette names are what we store; older code stored raw CSS colors.
    const name = Object.keys(PALETTE).find((k) => k === colorName || PALETTE[k] === colorName) || "yellow";

    const payload = {
      highlight: {
        chapter_slug: slug,
        book_slug: bookSlug,
        style: { color: name },
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

    try {
      const { data } = await axios.post("/api/highlights", payload);
      const created = { ...payload.highlight, mine: true, ...data, id: String(data.id) };
      setHighlights((prev) => [...prev, created]);
      setColor(name);
      lastSelectionRef.current = null;
      window.getSelection()?.removeAllRanges();
      setSelectionPop(null);
      if (withNote) openCard(created.id, { edit: true });
    } catch (error) {
      if (error?.response?.status === 401) toast("Sign in to save highlights");
      else {
        console.error("Failed to create highlight:", error);
        toast("Couldn't save that highlight");
      }
    }
  }

  async function deleteHighlight(id) {
    try {
      await axios.delete(`/api/highlights/${id}`);
      setHighlights((prev) => prev.filter((h) => String(h.id) !== String(id)));
      setCardId(null);
      toast("Highlight deleted");
    } catch (error) {
      console.error("Failed to delete highlight:", error);
      toast("Couldn't delete that highlight");
    }
  }

  const updateHighlight = useCallback((next) => {
    setHighlights((prev) => prev.map((h) => (String(h.id) === String(next.id) ? { ...h, ...next, id: h.id } : h)));
  }, []);

  async function shareOne(h) {
    const quote = h.selector?.quote?.exact || "";
    const result = await shareLink(highlightUrl(bookSlug, slug, h), {
      title: chapter?.title,
      text: quote ? `“${quote.slice(0, 140)}${quote.length > 140 ? "…" : ""}”` : undefined,
    });
    if (result === "copied") toast("Link to this highlight copied");
  }

  async function shareAll() {
    try {
      const url = await allHighlightsUrl();
      const result = await shareLink(url, { title: "My highlights" });
      if (result === "copied") toast("Link to all your highlights copied");
    } catch (e) {
      toast(e?.response?.status === 401 ? "Sign in to share highlights" : "Couldn't make a share link");
    }
  }

  const sharedBy = sharedView ? (highlights.find((h) => !h.mine)?.by ?? null) : undefined;
  const sharedMine = sharedView && highlights.length > 0 && highlights.every((h) => h.mine);

  // Sticky offset helper
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
      history.replaceState(null, "", `${location.pathname}${location.search}#hl-${id}`);
    } else {
      location.hash = `#hl-${id}`;
    }
    
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

      const marks = view.dom?.querySelectorAll(`[data-hl-id="${CSS.escape(String(id))}"]`) || [];
      marks.forEach((m) => m.classList.add('hb-hl-pulse'));
      setTimeout(() => marks.forEach((m) => m.classList.remove('hb-hl-pulse')), 1200);

      return true;
    } catch (error) {
      console.warn("Failed to jump to highlight:", error);
      return false;
    }
  }

  /* ------------------ Chapter list + neighbors ------------------ */

  useEffect(() => {
    let mounted = true;
    axios
      .get(`/api/books/${bookSlug}/chapters`)
      .then(({ data }) => {
        if (mounted && Array.isArray(data)) setChaptersList(data);
      })
      .catch((e) => console.warn("Could not fetch chapters list", e));
    return () => { mounted = false; };
  }, [bookSlug]);

  useEffect(() => {
    rememberLastRead(bookSlug, slug);
  }, [bookSlug, slug]);

  const ordered = Array.isArray(chaptersList)
    ? [...chaptersList].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    : [];
  const position = ordered.findIndex((c) => c.slug === slug);
  const prevChapter = position > 0 ? ordered[position - 1] : null;
  const nextChapter = position >= 0 && position < ordered.length - 1 ? ordered[position + 1] : null;
  const bookTitle = ordered[0]?.book_title || chapter?.book_title || "";

  // Before the chapter list loads, the hotkeys stay off rather than guessing.
  const listReady = position >= 0;
  useChapterHotkeys(
    listReady ? (prevChapter ? chapterHref(bookSlug, prevChapter) : tocHref(bookSlug)) : null,
    listReady ? (nextChapter ? chapterHref(bookSlug, nextChapter) : tocHref(bookSlug)) : null
  );

  /* ------------------ Search ------------------ */

  const [openSearch, setOpenSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(location.search).get("search") || "");
  const [pageEl, setPageEl] = useState(null);
  const inText = useInTextSearch(pageEl, searchQuery);

  // Tapping a highlight opens its card (note, share, color, delete). Listening on
  // the page rather than the editor survives TipTap swapping its DOM on load.
  useEffect(() => {
    if (!pageEl) return;
    const onClick = (e) => {
      const mark = e.target instanceof Element ? e.target.closest("[data-hl-id]") : null;
      if (!mark || !pageEl.contains(mark)) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) return;
      e.preventDefault();
      openCard(mark.getAttribute("data-hl-id"));
    };
    pageEl.addEventListener("click", onClick);
    return () => pageEl.removeEventListener("click", onClick);
  }, [pageEl, openCard]);
  useSearchHotkey(useCallback(() => setOpenSearch(true), []));

  function clearSearch() {
    setSearchQuery("");
    const url = new URL(location.href);
    url.searchParams.delete("search");
    history.replaceState(null, "", url);
  }

  useEffect(() => {
    if (chapter?.title) document.title = bookTitle ? `${chapter.title} | ${bookTitle}` : chapter.title;
  }, [chapter?.title, bookTitle]);

  /* ------------------ UI ------------------ */

  return (
    <div className="wb wb-reader">
      {/* Progress bar */}
      <div className="fixed top-14 left-0 w-full h-0.5 z-50 overflow-hidden pointer-events-none">
        <div
          ref={progRef}
          className="h-0.5 bg-[oklch(70%_0.2_44)] origin-left will-change-transform"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>

      <ReaderBar
        bookSlug={bookSlug}
        bookTitle={bookTitle}
        chapterTitle={chapter?.title}
        prev={prevChapter}
        next={nextChapter}
        onOpenChapters={() => setOpenChaptersModal(true)}
        onOpenSearch={() => setOpenSearch(true)}
      />

      {searchQuery && (
        <SearchBanner
          query={searchQuery}
          count={inText.count}
          current={inText.current}
          onNext={inText.next}
          onPrev={inText.prev}
          onClear={clearSearch}
        />
      )}

      {sharedView && (
        <div className="wb-shared-banner" role="status">
          <span>
            {sharedMine
              ? `You're viewing your shared ${sharedParams.hl ? "highlight" : "highlights"}.`
              : `You're viewing ${sharedBy ? `${sharedBy}'s` : "a shared"} ${sharedParams.hl ? "highlight" : "highlights"}.`}
            {sharedParams.hl && highlights.some((h) => h.note) && " Tap it to read the note."}
          </span>
          {signedIn && <a href={location.pathname}>Show mine</a>}
          {sharedParams.share && <a href={`/library/highlights/${encodeURIComponent(sharedParams.share)}`}>See them all</a>}
        </div>
      )}

      {isAdminViewer() && (
        <div className="wb-reader__mode">
          <ModeSwitch bookSlug={bookSlug} chapterSlug={slug} editing={false} />
        </div>
      )}

      <article className="wb-reader__page" ref={setPageEl}>
        <div className="prose hb-reader
            prose-slate
            prose-base md:prose-lg
            dark:prose-invert
            max-w-none !mx-auto">
          <EditorContent editor={editor} />
        </div>
      </article>

      {listReady && <ReaderFooter bookSlug={bookSlug} bookTitle={bookTitle} next={nextChapter} />}

      {/* Reader bubble menu for highlights */}
      <ReaderBubbleMenu
        colors={PALETTE}
        value={cssFromStored(color)}
        onChangeColor={(css) => setColor(css)}
        onHighlight={() => createHighlight(color)}
        onOpenModal={() => setOpenHighlightsModal(true)}
        onOpenChapters={() => setOpenChaptersModal(true)}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        isDark={document.documentElement.classList.contains('dark')}
      />

      {/* Over selected text: tap a color to highlight, or start a note */}
      {selectionPop && (
        <div
          className={`wb wb-selection-pop ${selectionPop.below ? "wb-selection-pop--below" : ""}`}
          style={{ left: selectionPop.x, top: selectionPop.y }}
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          role="toolbar"
          aria-label="Highlight selection"
        >
          {signedIn ? (
            <>
              {Object.entries(PALETTE).map(([name, css]) => (
                <button
                  key={name}
                  type="button"
                  className="wb-selection-pop__swatch"
                  style={{ backgroundColor: css }}
                  aria-label={`Highlight ${name}`}
                  aria-pressed={cssFromStored(color) === css}
                  onClick={() => createHighlight(name)}
                />
              ))}
              <span className="wb-selection-pop__sep" aria-hidden="true" />
              <button type="button" className="wb-selection-pop__btn" onClick={() => createHighlight(color, { withNote: true })}>
                <MessageSquareText size={15} aria-hidden="true" /> Note
              </button>
            </>
          ) : (
            <a className="wb-selection-pop__btn" href="/users/sign_in">Sign in to highlight</a>
          )}
        </div>
      )}

      {/* Highlights modal */}
      <HighlightsModal
        open={openHighlightsModal}
        onClose={() => setOpenHighlightsModal(false)}
        highlights={(Array.isArray(highlights) ? highlights : [])}
        swatchOf={(h) => cssFromStored(h?.style?.color)}
        onJump={jumpToHighlight}
        onShare={shareOne}
        onShareAll={signedIn ? shareAll : null}
        sharedBy={sharedBy}
        signedIn={signedIn}
      />

      <HighlightCard
        key={cardId || "none"}
        highlight={cardHighlight}
        startEditing={cardEditing}
        onClose={() => setCardId(null)}
        bookSlug={bookSlug}
        chapterSlug={slug}
        onChange={updateHighlight}
        onDelete={deleteHighlight}
        toast={toast}
      />

      {toastNode}

      <SearchDialog
        open={openSearch}
        onClose={() => setOpenSearch(false)}
        bookSlug={bookSlug}
        bookTitle={bookTitle}
        initialQuery={searchQuery}
      />

      <ChaptersDialog
        open={openChaptersModal}
        onClose={() => setOpenChaptersModal(false)}
        bookSlug={bookSlug}
        bookTitle={bookTitle}
        chapters={ordered}
        currentSlug={slug}
      />
    </div>
  );
}
