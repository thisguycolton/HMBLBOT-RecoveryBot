// The iPhone and Android apps' widgets: a day count and a favorite chip, on the Home Screen
// (and the day count on the Lock Screen). The widgets can't open the site, so the app's script
// (entrypoints/native_app.js) hands them what they show through the app's WidgetBridge plugin
// (mobile/), which keeps it on the phone:
//   soberSince  "YYYY-MM-DD", or "" without one (the widget counts the days itself, so it turns
//               over at midnight without the app being opened)
//   chipImage   the chip drawn on a clear background, a PNG as base64, or "" without one
//   chipBackImage  its back, drawn the same way, so tapping the chip on the widget flips it
//   chipLabel   its name ("1 year"), and chipId
// The chip is their first favorite (Chips page), else their newest sobriety chip, else their
// newest chip. It's drawn right here, the same way chip pictures are (chipMotion.js).
//
// The page's body carries data-widget (NativeAppRequest#native_widget_key): who's signed in,
// their sobriety date and their first favorite. The widgets are only redrawn when that, or the
// number of sobriety chips they've earned, changes; signed out, they're cleared.
import { chipMilestones } from "./milestones";
import { callPlugin, hasPlugin } from "./nativeApp";

const STORE = "hb-widget-key";
const VERSION = 2; // bump to redraw everyone's widgets after a change to how they're drawn
const SIZE = 600;

const remembered = () => { try { return localStorage.getItem(STORE); } catch { return null; } };
const remember = (key) => { try { localStorage.setItem(STORE, key); } catch { /* private mode */ } };

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function pickChip({ chips = [], favorites = [] }) {
  const byId = new Map(chips.map((c) => [c.id, c]));
  const favorite = favorites.map((id) => byId.get(id)).find(Boolean);
  if (favorite) return favorite;
  const newest = (list) => [...list].sort((a, b) => String(b.on || "").localeCompare(String(a.on || "")))[0];
  return newest(chips.filter((c) => c.shape === "round" && c.top !== false)) || newest(chips) || null;
}

// The chip, a little turned so its edge shows, on a clear square: base64 PNG
async function drawChipPictures(chip, design) {
  const [{ prepareChip, drawChip, canvasOf }, { chipFaces }] = await Promise.all([
    import("../components/recovery/chipMotion"),
    import("../components/recovery/ChipModal"),
  ]);
  const prepared = await prepareChip(chipFaces({ ...chip, on: null }, design));
  const tall = prepared.front.height / prepared.front.width;
  const w = (SIZE * 0.86) / Math.max(1, tall);
  // The front turned a little one way, the back turned the same amount past half a turn
  return [14, 194].map((angle) => {
    const canvas = canvasOf(SIZE, SIZE);
    drawChip(canvas.getContext("2d"), prepared, { cx: SIZE / 2, cy: SIZE / 2, w, angle, shadow: false });
    return canvas.toDataURL("image/png").split(",", 2)[1] || "";
  });
}

let running = null;

export function refreshWidgets({ force = false } = {}) {
  if (!hasPlugin("WidgetBridge")) return Promise.resolve();
  running ||= update(force).catch(() => {}).finally(() => { running = null; });
  return running;
}

async function update(force) {
  const server = document.body?.dataset.widget;
  if (server === undefined) return;
  if (!server) {
    // Signed out: nothing about them stays on the phone's widgets
    if (remembered() !== "" || force) {
      await callPlugin("WidgetBridge", "clear");
      remember("");
    }
    return;
  }
  const since = server.split("|")[1] || "";
  const earned = chipMilestones(since)?.earned.length ?? 0;
  const key = `${server}|${earned}|${VERSION}`;
  if (!force && remembered() === key) return;

  const res = await fetch(`/api/recovery?today=${todayIso()}`, { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!res.ok) return;
  const data = await res.json();
  const chip = pickChip(data);
  let chipImage = "";
  let chipBackImage = "";
  if (chip) {
    try { [chipImage, chipBackImage] = await drawChipPictures(chip, data.design); } catch { /* the widget shows its empty state */ }
  }
  await callPlugin("WidgetBridge", "update", {
    soberSince: data.sobriety_date || "",
    chipImage,
    chipBackImage,
    chipLabel: chip?.label || "",
    chipId: chip ? String(chip.id) : "",
  });
  remember(key);
}
