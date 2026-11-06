// The screen-share view: a reading opened from HostDeck's "Open to share" shows the page alone,
// with no sidebar, top bar, bottom bar, footer or reader bar, so the shared window is just the text.
// HostDeck opens it in a window named SHARE_WINDOW with ?screen=1. That window stays in the view as
// it moves between readings (the name sticks to it); ?screen=0 ("Show menus") brings the menus back.
export const SHARE_WINDOW = "hosting-reading";

const READING_PATH = /^\/(books\/[^/]+\/chapters\/|readings\/)[^/]+\/?$/;

export function isShareView() {
  if (typeof window === "undefined") return false;
  const param = new URLSearchParams(window.location.search).get("screen");
  if (param === "1") return true;
  if (param === "0") {
    if (window.name === SHARE_WINDOW) window.name = "";
    return false;
  }
  return window.name === SHARE_WINDOW && READING_PATH.test(window.location.pathname);
}

// A reader link HostDeck opens to share: our own pages get ?screen=1, a link elsewhere is left alone
export function shareHref(href) {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, window.location.origin);
  url.searchParams.set("screen", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}
