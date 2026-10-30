import {
  BookHeart, CalendarClock, CalendarRange, Gamepad2, Highlighter, House, LayoutDashboard, Library, MapPinned, MonitorPlay,
  NotebookPen, Pickaxe, Scale, ScrollText, Settings, Sparkles, UserRound, Users, Bookmark, Presentation, Medal, MoonStar,
  HandHeart, Gift, FileCheck2, MessagesSquare,
} from "lucide-react";

// What the shell's sidebar (Sidebar.jsx) lists. "You" and "Explore" are fixed; "Your groups"
// comes from /api/nav, one folder per group with its pages (groupItems).

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

// A group's pages in its folder: the same pages for everyone in it, a role deciding what they
// can change there (so no page of its own per role), plus Court verification (the group's form,
// never linked publicly) and Give a chip for its hosts, Settings
// for its admins and the Dashboard (what needs you) for anyone with a role. `group` is the
// group from /api/nav (its roles and can_give); without one, every page (pageInfo.js).
export function groupItems(slug, group = null) {
  const roles = group?.roles;
  const all = !group;
  const anyRole = roles && (roles.admin || roles.record_keeper || roles.host_coordinator || roles.treasurer);
  return [
    { key: "home", label: "Home", href: `/groups/${slug}`, icon: House, exact: true },
    { key: "meetings", label: "Meetings", href: `/groups/${slug}/meetings`, icon: CalendarClock },
    { key: "chat", label: "Chat", href: `/groups/${slug}/messages`, icon: MessagesSquare, count: "chat_unread" },
    (all || group.can_give) && { key: "court", label: "Court verification", href: `/court_verifications/new?group=${slug}`, icon: FileCheck2 },
    { key: "events", label: "Events", href: `/groups/${slug}/events`, icon: CalendarRange },
    { key: "conscience", label: "Conscience", href: `/groups/${slug}/conscience`, icon: Scale },
    { key: "members", label: "Members", href: `/groups/${slug}/members`, icon: Users, count: "requests" },
    { key: "decks", label: "HostDeck", href: `/groups/${slug}/decks`, icon: MonitorPlay },
    (all || group.can_give) && { key: "give", label: "Give a chip", href: `/recovery/give?group=${slug}`, icon: Gift },
    (all || anyRole) && { key: "dashboard", label: "Dashboard", href: `/groups/${slug}/dashboard`, icon: LayoutDashboard },
    (all || roles?.admin) && { key: "settings", label: "Settings", href: `/groups/${slug}/settings`, icon: Settings },
  ].filter(Boolean);
}

const matches = (href, path, exact) => {
  // Give a chip and Court verification are in every group's folder (?group=): only the group in the address lights up
  const [base, query] = href.split("?");
  if (query && !window.location.search.includes(query)) return false;
  return path === base || (!exact && path.startsWith(`${base}/`));
};

// The href of the item for this page: the longest match, so /groups/x/meetings lights up
// Meetings and not the group's Home
export function activeHref(hrefs, path = window.location.pathname) {
  if (path.startsWith("/books/")) path = "/library"; // the reader belongs to the library
  return hrefs.filter(({ href, exact }) => matches(href, path, exact)).sort((a, b) => b.href.length - a.href.length)[0]?.href || null;
}
