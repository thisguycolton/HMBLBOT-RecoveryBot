import {
  BookHeart,
  Bookmark,
  CalendarClock,
  Gamepad2,
  Gauge,
  Highlighter,
  Library,
  MapPinned,
  Megaphone,
  Pickaxe,
  ScrollText,
  Sparkles,
  Tags,
} from "lucide-react";

// The site's tools, grouped for the footer and the home page. The shell's sidebar has its own
// list (components/shell/navItems.js).
// `auth: true` items only show to signed-in accounts; `groups: true` ones only to accounts
// that see Groups (data-groups on the page's <body>).
export const NAV_CATEGORIES = [
  {
    key: "meetings",
    label: "Meetings",
    blurb: "Run a meeting",
    items: [
      { label: "Find a meeting", href: "/groups/meetings", icon: MapPinned, note: "Meetings by day, time and place, with a Join link" },
      { label: "Topicificator 9002", href: "/topicificator", icon: Sparkles, note: "Draw a topic for tonight's discussion" },
      { label: "Service Readings", href: "/service_readings", icon: BookHeart, note: "Preamble, Steps and Traditions, ready to read aloud" },
      { label: "Reading Archive", href: "/readings", icon: Bookmark, note: "Past meeting readings and topics" },
      { label: "Host-burger Helper", href: "/host_helper/scratchpaper", icon: ScrollText, note: "Service roles and milestones for the host" },
    ],
  },
  {
    key: "library",
    label: "Library",
    blurb: "Read the literature",
    items: [
      { label: "All books", href: "/library", icon: Library, note: "Big Book, Twelve and Twelve, Daily Reflections and more" },
      { label: "My highlights", href: "/library/highlights", icon: Highlighter, note: "Your highlights and notes in one place", auth: true },
    ],
  },
  {
    key: "extras",
    label: "Extras",
    blurb: "Just for fun",
    items: [
      { label: "The Acid Quest", href: "/game/game", icon: Gamepad2, note: "A pixel-art RPG built on meeting topics" },
      { label: "Minecraft Server", href: "/game_server/getting_started", icon: Pickaxe, note: "Join the fellowship's server" },
    ],
  },
];

// Shown only to User#suite_admin? (the server checks again on every page)
export const ADMIN_ITEMS = [
  { label: "Admin", href: "/admin_panel", icon: Gauge },
  { label: "Site notices", href: "/admin_panel/notices", icon: Megaphone },
  { label: "Schedule polls", href: "/schedule_polls", icon: CalendarClock },
  { label: "Topicificator admin", href: "/admin_panel/topicificator", icon: Tags },
];

// Whether an item shows: `auth` and `groups` items only to who they're for
export const showItem = (item, signedIn) =>
  (!item.auth || signedIn) && (!item.groups || document.body.dataset.groups === "true");
