import { CircleHelp } from "lucide-react";
import { EXPLORE_ITEMS, EXTRA_ITEMS, ROLE_SECTIONS, YOU_ITEMS, activeHref, groupItems, roleHref } from "./navItems";

// What the Info bar says on a page that brings no side panel of its own (PageAside): what the
// page is for and how to use it, by the sidebar item the page belongs to.
const ABOUT = {
  feed: "Notes and highlights from you, the people you follow and your groups. Write a note at the top, and tap a #hashtag to see more like it.",
  page: "Your page: your timeline, a bit about you and your groups. Change how it looks with Edit your page.",
  highlights: "Everything you've highlighted in the library, with your notes. Tap one to go back to that spot in the book.",
  readings: "The readings you've written. Finish your drafts and publish them when they're ready.",
  hosting: "The meetings you're down to host, and the subs your groups are asking for. Take one here.",
  chips: "Your chips: one for each sobriety milestone, and triangles for your 10th steps and gratitude lists. Only you see them.",
  inventory: "Your nightly 10th step. Answer each question, save it, and look back at the nights before. Only you see it.",
  gratitude: "Today's gratitude list, one thing on each line, and the days before. Only you see it.",
  find: "Look up AA Intergroup's meetings and our groups' own, by name, day or Zoom link. Times show in your time zone.",
  library: "The literature, ready to read. Open a book, search it, or go to a printed page. Select words to highlight them or add a note.",
  archive: "Readings people have shared. Search or browse them, and open one to read or share it.",
  topicificator: "Draws a topic for your meeting. Not the one? Draw again.",
  service: "The readings for a meeting's service positions, ready to read aloud or share.",
  helper: "Tools to help a host get ready for a meeting and run it.",
  quest: "The Acid Quest, a game made for The Acid Test.",
  minecraft: "How to join the group's Minecraft server.",
};

const GROUP_ABOUT = {
  home: "This group's page: its meetings, events and what members share. Not a member yet? Ask to join from the top.",
  meetings: "The group's meetings, with their times, Zoom details and who's hosting.",
  events: "The group's events. RSVP, see who's going, and look back at past ones.",
  conscience: "Group conscience: business meetings, decisions, documents and the group's elected officials.",
  hosts: "Who hosts each meeting and when. Sign up for a slot, ask for a sub, or take one.",
  decks: "HostDeck: what a host runs the meeting from, with the script, readings, timer and more.",
};

const ROLE_ABOUT = {
  record_keeper: {
    meetings: "Business meetings: set the agenda, take minutes and print them.",
    decisions: "Everything the group has decided, as threads you can search, with what replaced what.",
    documents: "The group's documents, in folders. Write, upload and pin them.",
    templates: "Templates for the group's documents, so new ones start right.",
    officials: "Who holds each service position, and since when.",
  },
  host_coordinator: { hosts: "The hosting schedule: fill slots, and answer requests for a sub." },
  treasurer: { treasury: "Treasurer's reports: what came in, what went out, and the balance." },
  admin: {
    members: "The group's members. Approve requests to join, and give people roles.",
    schedule: "The group's meeting times. Add, change or end a meeting.",
    events: "Make and edit the group's events.",
    literature: "The literature the group approves to read in its meetings.",
    court: "Court verification forms members have asked to have signed.",
    settings: "The group's name, logo, time zone and how it runs.",
    chips: "How the group's chips look to the members who call it their home group: colors, the words around the edge, and what's in the middle.",
    page: "Lay out the group's page in the HMBLBOT Editor.",
  },
};

const FALLBACK = { title: "RecoveryBot", icon: CircleHelp, about: "Free tools for meetings, readings and service. Open the menu to get around, or search from the top." };

export function pageInfo(path = window.location.pathname) {
  // Explore first: on a tie (/groups/meetings) the site's own page wins over a group's
  const items = [...EXPLORE_ITEMS, ...YOU_ITEMS, ...EXTRA_ITEMS].map((i) => ({ href: i.href, exact: i.exact, title: i.label, icon: i.icon, about: ABOUT[i.key] }));
  const slug = path.match(/^\/groups\/([^/]+)/)?.[1];
  if (slug) {
    items.push(...groupItems(slug).map((i) => ({ href: i.href, exact: i.exact, title: i.key === "home" ? "Group page" : i.label, icon: i.icon, about: GROUP_ABOUT[i.key] })));
    ROLE_SECTIONS.forEach((s) => s.items.forEach((i) => {
      items.push({ href: roleHref(slug, i), title: i.label, icon: i.icon, about: ROLE_ABOUT[s.key]?.[i.key] });
    }));
  }
  const href = activeHref(items, path);
  const item = href && items.find((i) => i.href === href && i.about);
  return item ? { title: item.title, icon: item.icon, about: item.about } : FALLBACK;
}
