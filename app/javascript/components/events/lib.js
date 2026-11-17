// Shared by the event page and the HMBLBOT Editor (/events/:token and /events/:token/edit).
import { Gavel, AlignLeft, BarChart3, CalendarRange, GalleryHorizontalEnd, Heading, Image, LayoutGrid, ListChecks, ShieldCheck } from "lucide-react";
export { api } from "../groups/lib";
import { api } from "../groups/lib";

// The three page layouts. Regions: "main" is the larger column, "side" the smaller one;
// the centered layout stacks side blocks under the main ones.
export const LAYOUTS = [
  { key: "main_side", label: "Content + sidebar", ratio: "66 / 33", cols: [4, 2] },
  { key: "centered", label: "Centered", ratio: "16 / 66 / 16", cols: [1, 4, 1] },
  { key: "side_main", label: "Sidebar + content", ratio: "33 / 66", cols: [2, 4] },
];

// Widths a block can take inside its region, out of 12 columns
export const SPANS = [3, 4, 6, 8, 9, 12];
// Full class names so Tailwind sees them
export const SPAN_CLASS = {
  3: "md:col-span-3",
  4: "md:col-span-4",
  6: "md:col-span-6",
  8: "md:col-span-8",
  9: "md:col-span-9",
  12: "md:col-span-12",
};
export const nearestSpan = (n) => SPANS.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), 12);

export const GUIDELINES_TEMPLATE = "## Guidelines\n\n- Arrive a few minutes early\n- Keep what's shared here, here\n- Phones on silent\n";

export const newId = () => Math.random().toString(36).slice(2, 10);

// The editor's block palette, in its three groups
export const BLOCK_GROUPS = [
  {
    title: "Text",
    items: [
      { type: "heading", label: "Heading", note: "A title that updates as you type", icon: Heading },
      { type: "notes", label: "Notes", note: "Markdown; can go out as an update", icon: AlignLeft },
    ],
  },
  {
    title: "Event",
    items: [
      { type: "agenda", label: "Agenda", note: "What's on the agenda, in order", icon: ListChecks },
      { type: "guidelines", label: "Guidelines", note: "What's expected of everyone", icon: ShieldCheck },
      { type: "poll", label: "Poll", note: "A schedule poll to vote in", icon: BarChart3 },
      { type: "conscience_agenda", label: "Business agenda", note: "The live agenda of a business meeting", icon: Gavel },
    ],
  },
  {
    title: "Photos",
    items: [
      { type: "photo", label: "Photo", note: "One picture, or a carousel", icon: Image },
      { type: "gallery", label: "Gallery", note: "A grid of pictures", icon: LayoutGrid },
    ],
  },
];
export const BLOCK_INFO = Object.fromEntries(BLOCK_GROUPS.flatMap((g) => g.items.map((i) => [i.type, i])));
export const EventIcon = CalendarRange;
export const CarouselIcon = GalleryHorizontalEnd;

export function newBlock(type, region = "main") {
  const base = { id: newId(), type, region, span: 12, size: "auto", color: "default" };
  switch (type) {
    case "heading": return { ...base, text: "New heading", level: 2, align: "left" };
    case "notes": return { ...base, markdown: "", update: false };
    case "agenda": return { ...base, title: "What's on the agenda", view: "list", activities: [] };
    case "guidelines": return { ...base, markdown: GUIDELINES_TEMPLATE, notify: false };
    case "photo": return { ...base, photos: [] };
    case "gallery": return { ...base, title: "", photos: [] };
    case "poll": return { ...base, poll_token: null };
    case "conscience_agenda": return { ...base, title: "Agenda" };
    default: return base;
  }
}

// Blocks whose changes go out to followers: notes marked as updates, guidelines set to notify
export function announced(blocks) {
  const out = {};
  for (const b of blocks || []) {
    if ((b.type === "notes" && b.update) || (b.type === "guidelines" && b.notify)) out[b.id] = (b.markdown || "").trim();
  }
  return out;
}

// The announcing blocks that would send an update if saved now
export function pendingUpdates(saved, draft) {
  const before = announced(saved);
  return Object.entries(announced(draft)).filter(([id, md]) => md && before[id] !== md).map(([id]) => id);
}

// A markdown headline is an update's title
export function updateTitle(markdown, fallback = "New update") {
  const m = /^#{1,6}\s+(.+)$/m.exec((markdown || "").trim().split("\n")[0] || "");
  return m ? m[1].trim() : fallback;
}

// uploadPath: where the page takes pictures ("/events/:token/images", "/groups/:slug/page/images")
export async function uploadImage(uploadPath, file) {
  const form = new FormData();
  form.append("file", file);
  const { url } = await api(uploadPath, { method: "POST", form });
  return url;
}

export const STATUS_LABEL = { going: "Going", maybe: "Maybe", following: "Following", not_going: "Can't go" };

// Block colors, from the site's palette (app/javascript/styles/tailwind.css): the accent
// blue, RecoveryBot's steel blue, and the tints the rest of the site already uses. Each
// tone has a card (background and ring), a strong fill (numbers), `button` (the same for
// links and buttons, which the reader styles fill gray, so it's !important), a soft fill
// (badges, icons), heading text and a frame for photos; each color has a swatch for the
// picker. "default" is each block's usual look. Full class names, so Tailwind sees them
// (EventBlocks::COLORS on the server).
export const COLORS = [
  { key: "default", label: "Default", swatch: "!bg-white ring-1 ring-neutral-300 dark:!bg-neutral-800 dark:ring-neutral-600" },
  { key: "accent", label: "Blue", swatch: "!bg-accent" },
  { key: "brand", label: "Steel", swatch: "!bg-brand" },
  { key: "sky", label: "Sky", swatch: "!bg-sky-400" },
  { key: "indigo", label: "Indigo", swatch: "!bg-indigo-500" },
  { key: "emerald", label: "Green", swatch: "!bg-emerald-500" },
  { key: "amber", label: "Amber", swatch: "!bg-amber-400" },
  { key: "rose", label: "Rose", swatch: "!bg-rose-400" },
  { key: "slate", label: "Gray", swatch: "!bg-slate-500" },
];

const TONES = {
  default: {
    card: "bg-white shadow-panel dark:bg-neutral-800/70 dark:ring-1 dark:ring-white/5",
    strong: "bg-accent text-white", button: "!bg-accent !text-white", soft: "bg-accent/10 text-accent dark:bg-accent/25 dark:text-sky-200",
    text: "text-slate-900 dark:text-white", frame: "",
  },
  accent: {
    card: "bg-accent/[0.07] ring-1 ring-accent/25 dark:bg-accent/15 dark:ring-accent/35",
    strong: "bg-accent text-white", button: "!bg-accent !text-white", soft: "bg-accent/15 text-accent dark:bg-accent/30 dark:text-sky-200",
    text: "text-accent dark:text-sky-300", frame: "bg-accent/[0.07] ring-1 ring-accent/25 dark:bg-accent/15 dark:ring-accent/35",
  },
  brand: {
    card: "bg-brand/10 ring-1 ring-brand/30 dark:bg-brand/20 dark:ring-brand/40",
    strong: "bg-brand text-white", button: "!bg-brand !text-white", soft: "bg-brand/15 text-brand dark:bg-brand/30 dark:text-brand-light",
    text: "text-brand dark:text-brand-light", frame: "bg-brand/10 ring-1 ring-brand/30 dark:bg-brand/20 dark:ring-brand/40",
  },
  sky: {
    card: "bg-sky-50 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:ring-sky-900/70",
    strong: "bg-sky-600 text-white", button: "!bg-sky-600 !text-white", soft: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200",
    text: "text-sky-700 dark:text-sky-300", frame: "bg-sky-50 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:ring-sky-900/70",
  },
  indigo: {
    card: "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-900/70",
    strong: "bg-indigo-600 text-white", button: "!bg-indigo-600 !text-white", soft: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200",
    text: "text-indigo-700 dark:text-indigo-300", frame: "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-900/70",
  },
  emerald: {
    card: "bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900/60",
    strong: "bg-emerald-600 text-white", button: "!bg-emerald-600 !text-white", soft: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
    text: "text-emerald-700 dark:text-emerald-300", frame: "bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900/60",
  },
  amber: {
    card: "bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900/60",
    strong: "bg-amber-500 text-white", button: "!bg-amber-500 !text-white", soft: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
    text: "text-amber-700 dark:text-amber-300", frame: "bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900/60",
  },
  rose: {
    card: "bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:ring-rose-900/60",
    strong: "bg-rose-500 text-white", button: "!bg-rose-500 !text-white", soft: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200",
    text: "text-rose-700 dark:text-rose-300", frame: "bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:ring-rose-900/60",
  },
  slate: {
    card: "bg-slate-100 ring-1 ring-slate-200 dark:bg-neutral-800 dark:ring-neutral-700",
    strong: "bg-slate-600 text-white", button: "!bg-slate-600 !text-white", soft: "bg-slate-200 text-slate-700 dark:bg-neutral-700 dark:text-neutral-200",
    text: "text-slate-700 dark:text-neutral-200", frame: "bg-slate-100 ring-1 ring-slate-200 dark:bg-neutral-800 dark:ring-neutral-700",
  },
};

// The classes for a block's color. Guidelines are amber unless given another color.
export function tone(block) {
  const key = block?.color && block.color !== "default" ? block.color : block?.type === "guidelines" ? "amber" : "default";
  return TONES[key] || TONES.default;
}
