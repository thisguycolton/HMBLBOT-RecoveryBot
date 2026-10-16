// Shared by the event page and the HMBLBOT Editor (/events/:token and /events/:token/edit).
import { AlignLeft, BarChart3, CalendarRange, GalleryHorizontalEnd, Heading, Image, LayoutGrid, ListChecks, ShieldCheck } from "lucide-react";
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
  const base = { id: newId(), type, region, span: 12, size: "auto" };
  switch (type) {
    case "heading": return { ...base, text: "New heading", level: 2, align: "left" };
    case "notes": return { ...base, markdown: "", update: false };
    case "agenda": return { ...base, title: "What's on the agenda", view: "list", activities: [] };
    case "guidelines": return { ...base, markdown: GUIDELINES_TEMPLATE, notify: false };
    case "photo": return { ...base, photos: [] };
    case "gallery": return { ...base, title: "", photos: [] };
    case "poll": return { ...base, poll_token: null };
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

export async function uploadImage(token, file) {
  const form = new FormData();
  form.append("file", file);
  const { url } = await api(`/events/${token}/images`, { method: "POST", form });
  return url;
}

export const STATUS_LABEL = { going: "Going", maybe: "Maybe", following: "Following", not_going: "Can't go" };
