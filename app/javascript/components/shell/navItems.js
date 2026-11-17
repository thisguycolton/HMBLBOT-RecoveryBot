import {
  BookHeart, CalendarClock, CalendarRange, Gamepad2, Highlighter, House, LayoutDashboard, Library, MapPinned, MonitorPlay,
  NotebookPen, Pickaxe, Scale, ScrollText, Settings, Sparkles, UserRound, Users, Bookmark, Presentation, Medal, MoonStar,
  HandHeart, HeartHandshake, Footprints, Gift, FileCheck2, MessagesSquare, LifeBuoy, Sprout, BookOpen, Coffee,
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
  { key: "steps", label: "Steps", href: "/recovery/steps", icon: Footprints },
  { key: "sponsorship", label: "Sponsorship", href: "/recovery/sponsorship", icon: HeartHandshake },
];

export const EXPLORE_ITEMS = [
  { key: "find", label: "Find a meeting", href: "/groups/meetings", icon: MapPinned },
  { key: "library", label: "Library", href: "/library", icon: Library },
  { key: "archive", label: "Readings", href: "/readings", icon: Bookmark },
  { key: "topicificator", label: "Topicificator", href: "/topicificator", icon: Sparkles },
  { key: "service", label: "Service Readings", href: "/service_readings", icon: BookHeart },
  { key: "helper", label: "Host-burger Helper", href: "/host_helper/scratchpaper", icon: ScrollText },
  { key: "docs", label: "Help & docs", href: "/docs", icon: LifeBuoy },
];

export const EXTRA_ITEMS = [
  { key: "quest", label: "The Acid Quest", href: "/game/game", icon: Gamepad2 },
  { key: "minecraft", label: "Minecraft Server", href: "/game_server/getting_started", icon: Pickaxe },
];

// The sidebar's categories (Sidebar.jsx): one icon each, most opening a sub menu of their items
// (the keys above). A category with an `href` and no items is a plain link. `auth`: only signed in;
// `groups`: only with a group; `host`: only hosts (or with sub requests open to you).
// Your groups come between the main categories and BOTTOM_CATEGORIES.
const ALL_ITEMS = Object.fromEntries([...YOU_ITEMS, ...EXPLORE_ITEMS, ...EXTRA_ITEMS].map((i) => [i.key, i]));
const pick = (...keys) => keys.map((k) => ALL_ITEMS[k]);

export const CATEGORIES = [
  { key: "home", label: "Home", href: "/people", icon: House, auth: true, groups: true },
  { key: "recovery", label: "Recovery", icon: Sprout, auth: true, items: pick("chips", "steps", "inventory", "gratitude", "sponsorship") },
  { key: "read", label: "Read", icon: BookOpen, items: [...pick("library", "archive"), { ...ALL_ITEMS.readings, auth: true }, { ...ALL_ITEMS.highlights, auth: true }] },
  { key: "meetings", label: "Meetings", icon: Coffee, items: [ALL_ITEMS.find, { ...ALL_ITEMS.hosting, auth: true }, ...pick("topicificator", "service", "helper")] },
];

export const BOTTOM_CATEGORIES = [
  { key: "docs", label: "Help & docs", href: "/docs", icon: LifeBuoy },
  { key: "extras", label: "Extras", icon: Gamepad2, items: EXTRA_ITEMS },
];

// Whether an item or category shows for this member. `who`: { auth, groups, host }
export const shows = (item, who) => (!item.auth || who.auth) && (!item.groups || who.groups) && (!item.host || who.host);

// A group's menu: the same list in its sidebar folder (Sidebar.jsx) and as the tabs on its pages
// (GroupPage.jsx), so there's one thing to learn. Everyone in the group gets the seven main
// sections; below a "Service" divider, Host tools for its hosts (Host a meeting, Decks, Give a
// chip and Court verification, the group's form, never linked publicly), the Dashboard (what
// needs you) for anyone with a role and Manage for its admins. `who`: { member, host, anyRole,
// admin } (groupPerms / navPerms below); without it, every section (pageInfo.js). Signed-out
// visitors and people waiting to join see the members' sections `locked`.
export function groupMenu(slug, who = null) {
  const all = !who;
  const locked = !all && !who.member;
  const base = `/groups/${slug}`;
  return [
    { key: "home", label: "Home", href: base, icon: House, exact: true },
    { key: "meetings", label: "Meetings", href: `${base}/meetings`, icon: CalendarClock },
    { key: "chat", label: "Chat", href: `${base}/messages`, icon: MessagesSquare, count: "chat_unread", locked },
    { key: "events", label: "Events", href: `${base}/events`, icon: CalendarRange },
    { key: "conscience", label: "Group conscience", href: `${base}/conscience`, icon: Scale, locked },
    { key: "reading", label: "Reading", href: `${base}/reading`, icon: BookOpen, locked },
    { key: "members", label: "Members", href: `${base}/members`, icon: Users, count: "requests", locked },
    (all || who.host) && { key: "hosttools", label: "Host tools", href: `${base}/host`, icon: MonitorPlay, service: true, also: [`${base}/decks`] },
    (all || who.anyRole) && { key: "dashboard", label: "Dashboard", href: `${base}/dashboard`, icon: LayoutDashboard, service: true },
    (all || who.admin) && { key: "manage", label: "Manage", href: `${base}/manage`, icon: Settings, service: true },
  ].filter(Boolean);
}

// `who` for a group from /api/nav (its roles and can_give)
export const navPerms = (group) => {
  const r = group.roles || {};
  return { member: !group.waiting, host: !!group.can_give, anyRole: !!(r.admin || r.record_keeper || r.host_coordinator || r.treasurer), admin: !!r.admin };
};

// `who` for a group from /api/groups/:slug (GroupsController#group_json)
export const groupPerms = (group) => ({
  member: !!(group.is_member || group.is_site_admin),
  host: !!group.can_host,
  anyRole: !!(group.can_manage || group.can_keep_records || group.can_schedule_hosts || group.can_keep_treasury),
  admin: !!group.can_manage,
});

// The sidebar folder's items: the menu without the sections a member can't open yet
export const groupItems = (slug, group = null) => groupMenu(slug, group && navPerms(group)).filter((i) => !i.locked);

// Host tools' own pages, as pills along the top of each (HostToolsNav)
export const hostTools = (slug) => [
  { key: "host", label: "Host a meeting", href: `/groups/${slug}/host` },
  { key: "decks", label: "Decks", href: `/groups/${slug}/decks` },
  { key: "give", label: "Give a chip", href: `/recovery/give?group=${slug}`, icon: Gift, away: true },
  { key: "court", label: "Court verification", href: `/court_verifications/new?group=${slug}`, icon: FileCheck2, away: true },
];

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
  // `also`: other pages that light the same item up (Host tools' Decks)
  const hits = hrefs.flatMap(({ href, exact, also = [] }) => [href, ...also].filter((h) => matches(h, path, exact)).map((h) => ({ href, length: h.length })));
  return hits.sort((a, b) => b.length - a.length)[0]?.href || null;
}
