// app/javascript/utils/useHighlightClickToShare.js

import { useEffect, useRef } from "react";

const useHighlightClickToShare = (
  viewRef,
  copyShareLinkForHighlight
) => {
  const callbackRef = useRef(copyShareLinkForHighlight);
  const attachedRootRef = useRef(null);

  // Always keep the latest callback without having to
  // recreate the DOM event listener.
  useEffect(() => {
    callbackRef.current = copyShareLinkForHighlight;
  }, [copyShareLinkForHighlight]);

  useEffect(() => {
    let mounted = true;
    let retryTimer = null;

    const handleClick = async (event) => {
      if (!mounted) return;

      const root = attachedRootRef.current;

      if (!root) return;

      let target = event.target;

      if (!(target instanceof Element)) {
        target = target?.parentElement;
      }

      if (!target) return;

      const highlightElement =
        target.closest("[data-hl-id]");

      if (
        !highlightElement ||
        !root.contains(highlightElement)
      ) {
        return;
      }

      const id =
        highlightElement.getAttribute("data-hl-id");

      if (!id) return;

      /*
       * Don't steal clicks while the user is actively
       * selecting text.
       */
      const selection = window.getSelection();

      if (
        selection &&
        !selection.isCollapsed &&
        selection.toString().trim().length > 0
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      try {
        const copyFn = callbackRef.current;

        if (typeof copyFn !== "function") {
          console.warn(
            "No highlight share callback available."
          );
          return;
        }

        await copyFn(id);

        /*
         * Visual confirmation.
         */
        highlightElement.classList.add(
          "hb-hl-pulse"
        );

        window.setTimeout(() => {
          highlightElement.classList.remove(
            "hb-hl-pulse"
          );
        }, 600);

      } catch (error) {
        console.error(
          "Failed to copy highlight link:",
          error
        );
      }
    };

    const attach = () => {
      if (!mounted) return;

      const root = viewRef?.current?.dom;

      if (!root) {
        retryTimer = window.setTimeout(
          attach,
          100
        );

        return;
      }

      /*
       * Tiptap can replace its DOM during initialization.
       * Make sure we aren't leaving a listener on an old
       * editor root.
       */
      if (
        attachedRootRef.current &&
        attachedRootRef.current !== root
      ) {
        attachedRootRef.current.removeEventListener(
          "click",
          handleClick,
          true
        );

        attachedRootRef.current = null;
      }

      if (attachedRootRef.current === root) {
        return;
      }

      root.addEventListener(
        "click",
        handleClick,
        {
          passive: false,
          capture: true,
        }
      );

      attachedRootRef.current = root;

      console.log(
        "Highlight click listener attached"
      );
    };

    attach();

    return () => {
      mounted = false;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      if (attachedRootRef.current) {
        attachedRootRef.current.removeEventListener(
          "click",
          handleClick,
          true
        );

        attachedRootRef.current = null;
      }
    };
  }, [viewRef]);

  /*
   * Add highlight interaction styles once.
   */
  useEffect(() => {
    if (
      document.getElementById(
        "hb-hl-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id = "hb-hl-styles";

    style.textContent = `
      [data-hl-id] {
        cursor: pointer;
      }

      .hb-hl-pulse {
        animation:
          hbPulse 0.6s ease 1;
      }

      @keyframes hbPulse {
        0% {
          opacity: 1;
        }

        50% {
          opacity: 0.7;
        }

        100% {
          opacity: 1;
        }
      }

      @media (hover: hover) {
        [data-hl-id]:hover {
          filter: brightness(0.97);
        }
      }

      @media not all and (min-resolution: 0.001dpcm) {
        @supports (-webkit-appearance: none) {
          [data-hl-id] {
            -webkit-tap-highlight-color: transparent;
          }
        }
      }
    `;

    document.head.appendChild(style);
  }, []);
};

export default useHighlightClickToShare;