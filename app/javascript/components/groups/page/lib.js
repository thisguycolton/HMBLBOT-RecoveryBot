// Group pages in the HMBLBOT Editor: the blocks a group page can have (EventBlocks::GROUP_TYPES
// on the server), its own and the event page's shared ones.
import { AlignLeft, BookOpen, CalendarClock, CalendarRange, Heading, Image, LayoutGrid, ListChecks, MessagesSquare, NotebookPen, ShieldCheck, UserPlus, Users } from "lucide-react";
import { newBlock } from "../../events/lib";

export const GROUP_BLOCK_GROUPS = [
  {
    title: "Text",
    items: [
      { type: "heading", label: "Heading", note: "A title; {{group}} is the group's name", icon: Heading },
      { type: "notes", label: "Notes", note: "Markdown: about us, what to expect", icon: AlignLeft },
    ],
  },
  {
    title: "Group",
    items: [
      { type: "meetings", label: "Meetings", note: "When and where the group meets", icon: CalendarClock },
      { type: "events", label: "Events", note: "Its upcoming events", icon: CalendarRange },
      { type: "timeline", label: "Timeline", note: "Notes members share to the group", icon: MessagesSquare },
      { type: "join", label: "Join", note: "Ask to join, or start the group", icon: UserPlus },
      { type: "members", label: "Members", note: "Who's in the group", icon: Users },
      { type: "literature", label: "Literature", note: "Books the group approved", icon: BookOpen },
      { type: "readings", label: "Readings", note: "Readings members shared", icon: NotebookPen },
    ],
  },
  {
    title: "Meeting",
    items: [
      { type: "agenda", label: "Format", note: "How a meeting goes, in order", icon: ListChecks },
      { type: "guidelines", label: "Guidelines", note: "What's expected of everyone", icon: ShieldCheck },
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
export const GROUP_BLOCK_INFO = Object.fromEntries(GROUP_BLOCK_GROUPS.flatMap((g) => g.items.map((i) => [i.type, i])));

const DEFAULTS = {
  meetings: { title: "Meetings" },
  events: { title: "Coming up", limit: 3 },
  timeline: { title: "From our members", limit: 10 },
  literature: { title: "Our literature" },
  readings: { title: "Shared readings", limit: 5 },
  members: { title: "Members" },
  join: { title: "Join us", markdown: "Everyone with a desire to stop drinking is welcome." },
};

export function newGroupBlock(type, region = "main") {
  const block = newBlock(type, region);
  if (type === "agenda") return { ...block, title: "Our meeting format" };
  return DEFAULTS[type] ? { ...block, ...DEFAULTS[type] } : block;
}

// Group blocks with nothing to show this viewer stay off the page (the editor shows them
// all). Members' blocks still show to everyone else in a group, as a way in.
export function hiddenFor(block, context) {
  const outside = context.kind === "intergroup";
  switch (block.type) {
    case "events": return !context.events?.length;
    case "literature": return !context.literature?.length;
    case "readings": return !context.readings?.length;
    case "timeline": return outside;
    case "members": return outside;
    case "meetings": return !context.meetings?.length;
    default: return false;
  }
}

export const timeAgo = (iso) => {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};
