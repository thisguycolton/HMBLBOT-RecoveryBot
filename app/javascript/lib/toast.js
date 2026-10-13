import { useSyncExternalStore } from "react";

// App-wide toast queue (ported from metr). Every Vite entrypoint shares one queue
// through window, so a toast raised by any React app shows in the one <Toasts />.

const store = (window.__hbToasts ||= { toasts: [], nextId: 1, listeners: new Set() });
const emit = () => store.listeners.forEach((listener) => listener());

export const dismissToast = (id) => {
  store.toasts = store.toasts.filter((toast) => toast.id !== id);
  emit();
};

export const clearToasts = () => {
  store.toasts = [];
  emit();
};

// Flag the browser tab when an alert arrives while it's in the background
const UNSEEN = "● ";
const markTabUnseen = () => {
  if (!document.hidden || document.title.startsWith(UNSEEN)) return;
  document.title = UNSEEN + document.title;
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.title.startsWith(UNSEEN)) document.title = document.title.slice(UNSEEN.length);
    },
    { once: true }
  );
};

// showToast("Saved.", { tone: "success" | "info" | "warning" | "error", href })
export const showToast = (message, options = {}) => {
  if (!message) return;
  markTabUnseen();
  const toast = { id: store.nextId++, message, tone: "info", ...options };
  store.toasts = [...store.toasts.slice(-2), toast];
  emit();
  // Start the countdown only once the page is actually in view
  const ms = toast.tone === "error" ? 10_000 : 6_000;
  const countdown = () => setTimeout(() => dismissToast(toast.id), ms);
  if (document.hidden) document.addEventListener("visibilitychange", countdown, { once: true });
  else countdown();
};

export const useToasts = () =>
  useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.toasts
  );
