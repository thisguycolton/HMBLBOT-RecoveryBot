import { useLayoutEffect, useRef } from "react";

// Slides things into their new places when a list changes order, instead of letting them jump
// there ("FLIP": note where each one was, let the page lay them out, then animate each from its
// old spot to the new one). Used by the block editors, so blocks move aside live while one is
// dragged and when one is moved with the arrows.
//
//   const ref = useFlip(orderKey, anchorRef)
//   <div ref={ref}> … each item carries data-flip-id="…" … </div>
//
// `orderKey` changes when the order changes (only then does anything animate, so typing in a
// block that grows doesn't make the rest slide). `anchorRef.current`, when set to an item's id,
// keeps that item where it is on screen by scrolling the page, so a block moved with the arrows
// stays under the finger and the page moves around it instead. It's cleared after use.
export default function useFlip(orderKey, anchorRef = null) {
  const container = useRef(null);
  const last = useRef(new Map()); // id => { top, left } in page coordinates, without animation
  const lastKey = useRef(orderKey);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const items = [...root.querySelectorAll("[data-flip-id]")];
    const changed = lastKey.current !== orderKey;
    lastKey.current = orderKey;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Where each one is showing right now (its old place plus any slide still running), before
    // the running slides are stopped
    const sy0 = window.scrollY;
    const shownAt = new Map();
    if (changed) {
      items.forEach((el) => {
        const id = el.dataset.flipId;
        const was = last.current.get(id);
        if (!was) return;
        const [dx, dy] = runningOffset(el);
        shownAt.set(id, { top: was.top - sy0 + dy, left: was.left + dx });
        el.getAnimations?.().forEach((a) => { if (a.id === "flip") a.cancel(); });
      });
    }

    // Where each one is laid out now
    const now = new Map();
    items.forEach((el) => {
      const r = el.getBoundingClientRect();
      const [dx, dy] = changed ? [0, 0] : runningOffset(el);
      now.set(el.dataset.flipId, { top: r.top - dy + window.scrollY, left: r.left - dx });
    });

    if (changed) {
      const anchor = anchorRef?.current;
      if (anchorRef) anchorRef.current = null;
      if (anchor && last.current.has(anchor) && now.has(anchor)) {
        window.scrollBy(0, now.get(anchor).top - last.current.get(anchor).top);
      }
      const sy1 = window.scrollY;
      if (!reduced) {
        items.forEach((el) => {
          const id = el.dataset.flipId;
          const from = shownAt.get(id);
          const to = now.get(id);
          if (!from || !to) return;
          const dx = from.left - to.left;
          const dy = from.top - (to.top - sy1);
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
          const animation = el.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
            { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
          );
          animation.id = "flip";
        });
      }
    }
    last.current = now;
  });

  return container;
}

// How far a running slide has an element moved from where it's laid out
function runningOffset(el) {
  if (!el.getAnimations?.().some((a) => a.id === "flip")) return [0, 0];
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return [0, 0];
  const m = new DOMMatrixReadOnly(t);
  return [m.m41, m.m42];
}
