// Profile pages in the HMBLBOT Editor: the blocks a profile can have
// (EventBlocks::PROFILE_TYPES on the server), its own and a few of the event page's.
import { AlignLeft, Heading, Image, LayoutGrid, MessagesSquare, UserRound, Users, UsersRound } from "lucide-react";
import { newBlock } from "../events/lib";

export const PROFILE_BLOCK_GROUPS = [
  {
    title: "Profile",
    items: [
      { type: "feed", label: "Timeline", note: "Your notes and highlights", icon: MessagesSquare },
      { type: "about", label: "About", note: "Your picture, blurb and sobriety date", icon: UserRound },
      { type: "groups", label: "Groups", note: "Groups you're in", icon: UsersRound },
      { type: "people", label: "People", note: "Who you follow, or who follows you", icon: Users },
    ],
  },
  {
    title: "Text",
    items: [
      { type: "heading", label: "Heading", note: "A title", icon: Heading },
      { type: "notes", label: "Notes", note: "Markdown: your story, what helps", icon: AlignLeft },
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
export const PROFILE_BLOCK_INFO = Object.fromEntries(PROFILE_BLOCK_GROUPS.flatMap((g) => g.items.map((i) => [i.type, i])));

const DEFAULTS = {
  feed: { title: "Timeline", limit: 10, show: "all" },
  about: { title: "About" },
  groups: { title: "Groups" },
  people: { title: "Following", which: "following" },
};

export function newProfileBlock(type, region = "main") {
  const block = newBlock(type, region);
  return DEFAULTS[type] ? { ...block, ...DEFAULTS[type] } : block;
}

// Blocks with nothing to show this viewer stay off someone else's profile; its owner
// sees them all, with a word on what goes there
export function hiddenFor(block, context) {
  if (context.viewer?.is_me) return false;
  switch (block.type) {
    case "groups": return !context.groups?.length;
    case "people": return !(block.which === "followers" ? context.followers : context.following)?.length;
    case "about": return !context.person?.bio && !context.person?.sobriety_date;
    default: return false;
  }
}

// "2 years, 3 months", from a sobriety date
export function soberFor(iso) {
  if (!iso) return null;
  const start = new Date(`${iso}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  const days = Math.floor((now - start) / 86400000);
  if (months < 1) return `${days} ${days === 1 ? "day" : "days"}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (rest) parts.push(`${rest} ${rest === 1 ? "month" : "months"}`);
  return parts.join(", ");
}
