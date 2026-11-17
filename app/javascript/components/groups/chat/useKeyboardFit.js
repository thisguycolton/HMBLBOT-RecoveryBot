import { useEffect } from "react";

const TYPED = /^(INPUT|TEXTAREA|SELECT)$/;
const NOT_TYPED = /^(checkbox|radio|button|submit|reset|range|color|file|image)$/;
const typingIn = (el) => {
  const a = document.activeElement;
  return !!a && el.contains(a) && (a.isContentEditable || (TYPED.test(a.tagName) && !NOT_TYPED.test(a.type)));
};

// Keeps the chat's message box right on top of the phone's keyboard. With the keyboard up, iOS
// doesn't shrink the page: it slides the whole page up under the keyboard to show the box, so
// the box ends up mid-screen over the space the bottom bar had, and the channel's header goes
// off the top. So while someone is typing in the chat on a touch screen and the keyboard is up
// (the visible part of the page, visualViewport, is well short of the page), the chat is laid
// over exactly what's visible: its header at the top, the box at the bottom, against the keyboard.
export default function useKeyboardFit(el) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !el) return undefined;
    if (!window.matchMedia?.("(pointer: coarse)").matches) return undefined;
    let frame = 0;
    let box = null; // where the chat sat on the page before it was laid over the screen
    const reset = () => {
      Object.assign(el.style, { position: "", top: "", left: "", width: "", height: "", minHeight: "", zIndex: "" });
      el.classList.remove("chat-page--keyboard");
      box = null;
    };
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const keyboard = document.documentElement.clientHeight - vv.height > 120 && vv.scale < 1.01;
        if (!(keyboard && typingIn(el))) { if (box) reset(); return; }
        if (!box) {
          const r = el.getBoundingClientRect();
          box = { left: r.left, width: r.width };
          el.classList.add("chat-page--keyboard");
        }
        Object.assign(el.style, {
          position: "fixed",
          top: `${vv.offsetTop}px`,
          left: `${box.left}px`,
          width: `${box.width}px`,
          height: `${vv.height}px`,
          minHeight: "0",
          zIndex: "55",
        });
      });
    };
    // The keyboard can close a moment after the box loses focus; check again once it has
    const later = () => { place(); setTimeout(place, 350); };
    vv.addEventListener("resize", place);
    vv.addEventListener("scroll", place);
    document.addEventListener("focusin", place);
    document.addEventListener("focusout", later);
    place();
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", place);
      vv.removeEventListener("scroll", place);
      document.removeEventListener("focusin", place);
      document.removeEventListener("focusout", later);
      reset();
    };
  }, [el]);
}
