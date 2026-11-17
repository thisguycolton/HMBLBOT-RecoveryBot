// Group pages in the HMBLBOT Editor: the blocks a group page can have (EventBlocks::GROUP_TYPES
// on the server), its own and the event page's shared ones.
import { AlignLeft, BookOpen, CalendarClock, CalendarRange, FileText, Gavel, Scale, Heading, Image, LayoutGrid, ListChecks, MessagesSquare, NotebookPen, ShieldCheck, UserPlus, Users } from "lucide-react";
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
      { type: "documents", label: "Documents", note: "Format, guidelines and other documents", icon: FileText },
      { type: "decisions", label: "Decisions", note: "What the group has decided", icon: Scale },
      { type: "business_meeting", label: "Business meeting", note: "The next one, its agenda, suggest an item", icon: Gavel },
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
  documents: { title: "Documents", kind: "all", limit: 5, pinned_only: false },
  decisions: { title: "Decisions", category: "all", limit: 5 },
  business_meeting: { title: "Next business meeting" },
  members: { title: "Members" },
  join: { title: "Join us", markdown: "Everyone with a desire to stop drinking is welcome." },
};

export function newGroupBlock(type, region = "main") {
  const block = newBlock(type, region);
  if (type === "agenda") return { ...block, title: "Our meeting format" };
  return DEFAULTS[type] ? { ...block, ...DEFAULTS[type] } : block;
}

// The documents a Documents block lists: the viewer's own (context.documents), narrowed to its folder
export const documentsFor = (block, context) =>
  (context.documents || [])
    .filter((d) => (block.kind && block.kind !== "all" ? d.kind === block.kind : true) && (!block.pinned_only || d.pinned))
    .slice(0, block.limit || 5);

// The standing decisions a Decisions block lists, from the viewer's own (context.decisions)
export const decisionsFor = (block, context) =>
  (context.decisions || []).filter((d) => !block.category || block.category === "all" || d.category === block.category).slice(0, block.limit || 5);

// Group blocks with nothing to show this viewer stay off the page (the editor shows them
// all). Members' blocks still show to everyone else in a group, as a way in.
export function hiddenFor(block, context) {
  const outside = context.kind === "intergroup";
  switch (block.type) {
    case "events": return !context.events?.length;
    case "literature": return !context.literature?.length;
    case "readings": return !context.readings?.length;
    case "documents": return !documentsFor(block, context).length && !context.viewer?.can_keep_records;
    case "business_meeting": return !context.business_meeting && !context.viewer?.can_keep_records;
    case "decisions": return !decisionsFor(block, context).length && !context.viewer?.can_keep_records;
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
