// useHighlightClickToShare.js
import { useEffect, useRef, useCallback } from "react";

const useHighlightClickToShare = (viewRef, copyShareLinkForHighlight) => {
  const attachedRef = useRef(false);
  const detachRef = useRef(() => {});

  const handler = useCallback(async (e) => {
    const root = viewRef.current?.dom;
    if (!root) return;

    const el = e.target.closest('mark.hb-hl');
    if (!el || !root.contains(el)) return;

    const sel = window.getSelection();
    if (sel && String(sel).length > 0) return;

    const id = el.getAttribute('data-hl-id');
    if (!id) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      await copyShareLinkForHighlight(id);
      el.classList.add('animate-[pulse_0.6s_ease_1]');
      setTimeout(() => el.classList.remove('animate-[pulse_0.6s_ease_1]'), 600);
    } catch {}
  }, [viewRef, copyShareLinkForHighlight]);

  useEffect(() => {
    const root = viewRef.current?.dom;
    if (!root || attachedRef.current) return;

    root.addEventListener('click', handler, { passive: true });
    detachRef.current = () => root.removeEventListener('click', handler);
    attachedRef.current = true;

    return () => {
      if (attachedRef.current) {
        detachRef.current();
        attachedRef.current = false;
        detachRef.current = () => {};
      }
    };
  }, [viewRef, handler]);
};

export default useHighlightClickToShare;