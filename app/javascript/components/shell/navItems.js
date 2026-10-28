import {
  BookHeart, BookOpen, BookOpenCheck, CalendarClock, CalendarDays, CalendarRange, ClipboardCheck, FileText, Gamepad2, Gavel,
  Highlighter, House, Landmark, LayoutTemplate, Library, MapPinned, MonitorPlay, NotebookPen, Pickaxe, Scale, ScrollText,
  Settings, Sparkles, Stamp, UserCheck, UserRound, Users, Bookmark, Presentation, Medal, MoonStar, HandHeart, Gift,
} from "lucide-react";

// What the shell's sidebar (Sidebar.jsx) lists. "You" and "Explore" are fixed; "Your groups"
// comes from /api/nav, one folder per group with its pages for every member and a section
// for each role they hold there. The group dashboard (groups/GroupDashboard.jsx) reads the
// same role sections, so a page added here shows up in both.

export const YOU_ITEMS = [
  { key: "feed", label: "Home feed", href: "/people", icon: House, groups: true },
  { key: "page", label: "My page", href: "/people/me", icon: UserRound, groups: true },
  { key: "highlights", label: "Highlights", href: "/library/highlights", icon: Highlighter },
  { key: "readings", label: "My readings", href: "/readings/mine", icon: NotebookPen },
  { key: "hosting", label: "Hosting", href: "/people/me/hosting", icon: Presentation, host: true },
  // Recovery tools (entrypoints/recovery.jsx), private to the member
  { key: "chips", label: "Chips", href: "/recovery", icon: Medal, exact: true },
  { key: "inventory", label: "10th step", href: "/recovery/inventory", icon: MoonStar },
  { key: "gratitude", label: "Gratitude", href: "/recovery/gratitude", icon: HandHeart },
  { key: "give", label: "Give a chip", href: "/recovery/give", icon: Gift, giver: true },
];

export const EXPLORE_ITEMS = [
  { key: "find", label: "Find a meeting", href: "/groups/meetings", icon: MapPinned },
  { key: "library", label: "Library", href: "/library", icon: Library },
  { key: "archive", label: "Readings", href: "/readings", icon: Bookmark },
  { key: "topicificator", label: "Topicificator", href: "/topicificator", icon: Sparkles },
  { key: "service", label: "Service Readings", href: "/service_readings", icon: BookHeart },
  { key: "helper", label: "Host-burger Helper", href: "/host_helper/scratchpaper", icon: ScrollText },
];

export const EXTRA_ITEMS = [
  { key: "quest", label: "The Acid Quest", href: "/game/game", icon: Gamepad2 },
  { key: "minecraft", label: "Minecraft Server", href: "/game_server/getting_started", icon: Pickaxe },
];

// Every member's pages of a group
export const groupItems = (slug) => [
  { key: "home", label: "Home", href: `/groups/${slug}`, icon: House, exact: true },
  { key: "meetings", label: "Meetings", href: `/groups/${slug}/meetings`, icon: CalendarClock },
  { key: "events", label: "Events", href: `/groups/${slug}/events`, icon: CalendarRange },
  { key: "conscience", label: "Conscience", href: `/groups/${slug}/conscience`, icon: Scale },
  { key: "hosts", label: "Hosts", href: `/groups/${slug}/hosts`, icon: UserCheck },
  { key: "decks", label: "HostDeck", href: `/groups/${slug}/decks`, icon: MonitorPlay },
];

// The sections a role adds, in the group dashboard (/groups/:slug/conscience/*). `role` is the
// key in /api/nav's roles; the dashboard's own `show` checks the group's can_* flags.
export const ROLE_SECTIONS = [
  {
    key: "record_keeper",
    title: "Record keeper",
    items: [
      { key: "meetings", path: "/meetings", label: "Business meetings", icon: CalendarDays },
      { key: "decisions", path: "/decisions", label: "Decisions", icon: Gavel },
      { key: "documents", path: "/documents", label: "Documents", icon: FileText },
      { key: "templates", path: "/templates", label: "Document templates", icon: Stamp },
      { key: "officials", path: "/officials", label: "Elected officials", icon: BookOpenCheck },
    ],
  },
  {
    key: "host_coordinator",
    title: "Host coordinator",
    items: [{ key: "hosts", path: "/hosts", label: "Schedule", icon: CalendarClock }],
  },
  {
    key: "treasurer",
    title: "Treasurer",
    items: [{ key: "treasury", path: "/treasury", label: "Treasury", icon: Landmark }],
  },
  {
    key: "admin",
    title: "Group admin",
    items: [
      { key: "members", path: "/members", label: "Members", icon: Users, count: "requests" },
      { key: "schedule", path: "/schedule", label: "Meeting schedule", icon: CalendarClock },
      { key: "events", path: "/events", label: "Manage events", icon: CalendarRange },
      { key: "literature", path: "/literature", label: "Approved literature", icon: BookOpen },
      { key: "court", path: "/court", label: "Court verifications", icon: ClipboardCheck },
      { key: "settings", path: "/settings", label: "Group settings", icon: Settings },
      { key: "chips", path: "/chips", label: "Chips", icon: Medal },
      { key: "page", href: (slug) => `/groups/${slug}/page/edit`, label: "Edit the group page", icon: LayoutTemplate },
    ],
  },
];

// A record keeper's pages are also the treasurer's way in, so a record keeper doesn't get the
// Treasurer section twice: each item shows under the first role that has it
export function roleSections(roles) {
  const seen = new Set();
  return ROLE_SECTIONS.filter((s) => roles?.[s.key]).map((s) => {
    const items = s.items.filter((i) => !seen.has(i.key));
    items.forEach((i) => seen.add(i.key));
    return { ...s, items };
  }).filter((s) => s.items.length);
}

export const roleHref = (slug, item) => (typeof item.href === "function" ? item.href(slug) : `/groups/${slug}/conscience${item.path}`);

const matches = (href, path, exact) => path === href || (!exact && path.startsWith(`${href}/`));

// The href of the item for this page: the longest match, so /groups/x/conscience/documents
// lights up Documents and not Conscience
export function activeHref(hrefs, path = window.location.pathname) {
  if (path.startsWith("/books/")) path = "/library"; // the reader belongs to the library
  return hrefs.filter(({ href, exact }) => matches(href, path, exact)).sort((a, b) => b.href.length - a.href.length)[0]?.href || null;
}
