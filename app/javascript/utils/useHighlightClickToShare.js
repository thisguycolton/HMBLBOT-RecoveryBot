// app/javascript/utils/useHighlightClickToShare.js
import { useEffect, useRef, useCallback } from "react";

const useHighlightClickToShare = (viewRef, copyShareLinkForHighlight, bookSlug, slug) => {
  const attachedRef = useRef(false);
  const clickHandlerRef = useRef(null);

  // Fallback function for clipboard
  const fallbackCopyToClipboard = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      return successful;
    } catch (err) {
      console.error('Fallback copy failed:', err);
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const handler = useCallback(async (e) => {
    // Safely get the root element
    let root;
    try {
      root = viewRef.current?.dom;
      if (!root || !root.addEventListener) return;
    } catch (error) {
      console.warn("Cannot access editor DOM:", error);
      return;
    }

    // Get the click target safely
    const eventTarget = e.target;
    if (!eventTarget) return;

    // Traverse up the DOM to find the highlight element
    let currentElement = eventTarget;
    let highlightElement = null;

    while (currentElement && currentElement !== root && currentElement !== document.body) {
      if (currentElement.hasAttribute && currentElement.hasAttribute('data-hl-id')) {
        highlightElement = currentElement;
        break;
      }
      currentElement = currentElement.parentElement;
    }

    if (!highlightElement) return;

    // Don't interfere with text selection
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      return;
    }

    const id = highlightElement.getAttribute('data-hl-id');
    if (!id) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      const url = `${window.location.origin}/books/${bookSlug}/chapters/${slug}#hl-${id}`;
      
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers
        fallbackCopyToClipboard(url);
      }
      
      // Visual feedback
      highlightElement.classList.add('hb-hl-pulse');
      setTimeout(() => {
        highlightElement.classList.remove('hb-hl-pulse');
      }, 600);
    } catch (error) {
      console.warn("Copy failed, using fallback:", error);
      // Final fallback - show prompt
      const url = `${window.location.origin}/books/${bookSlug}/chapters/${slug}#hl-${id}`;
      window.prompt("Copy this highlight link:", url);
    }
  }, [viewRef, bookSlug, slug]);

  // Store the handler in a ref
  clickHandlerRef.current = handler;

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 10;

    const tryAttachListener = () => {
      if (!mounted) return;

      try {
        const root = viewRef.current?.dom;
        if (!root) {
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(tryAttachListener, 100);
          }
          return;
        }

        if (attachedRef.current) {
          root.removeEventListener('click', clickHandlerRef.current);
        }

        root.addEventListener('click', clickHandlerRef.current, {
          passive: false,
          capture: true
        });

        attachedRef.current = true;
        console.log("Click listener attached successfully");
        
      } catch (error) {
        console.warn("Failed to attach click listener:", error);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(tryAttachListener, 200);
        }
      }
    };

    // Initial attempt with delay
    setTimeout(tryAttachListener, 100);

    return () => {
      mounted = false;
      if (attachedRef.current) {
        try {
          const root = viewRef.current?.dom;
          if (root) {
            root.removeEventListener('click', clickHandlerRef.current, {
              capture: true
            });
          }
        } catch (error) {
          console.warn("Error removing listener:", error);
        }
        attachedRef.current = false;
      }
    };
  }, [viewRef]);

  // Add CSS for the pulse animation
  useEffect(() => {
    if (!document.getElementById('hb-hl-styles')) {
      const style = document.createElement('style');
      style.id = 'hb-hl-styles';
      style.textContent = `
        .hb-hl-pulse {
          animation: hbPulse 0.6s ease 1;
        }
        
        @keyframes hbPulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        
        /* Safari-specific fixes */
        @media not all and (min-resolution: 0.001dpcm) {
          @supports (-webkit-appearance: none) {
            [data-hl-id] {
              -webkit-tap-highlight-color: transparent;
              cursor: pointer;
            }
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
};

export default useHighlightClickToShare;