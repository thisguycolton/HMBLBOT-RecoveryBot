import { CircleHelp } from "lucide-react";
import { EXPLORE_ITEMS, EXTRA_ITEMS, YOU_ITEMS, activeHref, groupItems } from "./navItems";

// What the Info bar says on a page that brings no side panel of its own (PageAside): what the
// page is for and how to use it, by the sidebar item the page belongs to.
const ABOUT = {
  feed: "Notes and highlights from you, the people you follow and your groups. Write a note at the top, and tap a #hashtag to see more like it.",
  page: "Your page: your timeline, a bit about you and your groups. Change how it looks with Edit your page.",
  highlights: "Everything you've highlighted in the library, with your notes. Tap one to go back to that spot in the book.",
  readings: "The readings you've written. Finish your drafts and publish them when they're ready.",
  hosting: "The meetings you're down to host, and the subs your groups are asking for. Take one here.",
  chips: "Your chips: sobriety milestones, 10th steps, gratitude, streaks and Meeting Maker. Tap one to spin it, star favorites for your profile.",
  inventory: "Your nightly 10th step. Answer each question, save it, and look back at the nights before. Only you see it.",
  gratitude: "Today's gratitude list, one thing on each line, and the days before. Only you see it.",
  steps: "Worksheets for working the steps: pick one, fill it in at your own pace, change it to suit you and your sponsor. Only you see it.",
  sponsorship: "Your sponsors and the people you sponsor. Sponsees send their lists one at a time; sponsors can leave a short note.",
  find: "Look up AA Intergroup's meetings, local in-person ones and our groups' own, by name, day or Zoom link. Times show in your time zone.",
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
  meetings: "Today's meetings with who's hosting and a way in, then the week's hosts and every meeting. Sign up for a slot, ask for a sub, or take one.",
  chat: "The group's chat, in channels. Type @ to mention someone or a role like @hosts; only mentions send a notification.",
  court: "Send a court verification letter for someone who came to one of this group's meetings. Pick the meeting and day, then sign.",
  events: "The group's events. RSVP, see who's going, and look back at past ones. Admins start new ones here.",
  conscience: "Group conscience: business meetings, decisions, documents, the group's elected officials and the treasury. Record keepers and treasurers edit right here.",
  members: "The group's members. Admins approve requests to join and give people roles here.",
  decks: "HostDeck: what a host runs the meeting from, with the script, readings, timer and more.",
  give: "Give someone a chip in your group's design. Members get it right away; anyone else gets an email to claim it.",
  dashboard: "What needs you in this group, a part for each role you hold, with the way to each.",
  settings: "How the group is set up: its name and logo, meeting times, chips, approved literature and court verifications.",
};

const FALLBACK = { title: "RecoveryBot", icon: CircleHelp, about: "Free tools for meetings, readings and service. Open the menu to get around, or search from the top." };

export function pageInfo(path = window.location.pathname) {
  // Explore first: on a tie (/groups/meetings) the site's own page wins over a group's
  const items = [...EXPLORE_ITEMS, ...YOU_ITEMS, ...EXTRA_ITEMS].map((i) => ({ href: i.href, exact: i.exact, title: i.label, icon: i.icon, about: ABOUT[i.key] }));
  const slug = path.match(/^\/groups\/([^/]+)/)?.[1] || new URLSearchParams(window.location.search).get("group");
  if (slug) {
    items.push(...groupItems(slug).map((i) => ({ href: i.href, exact: i.exact, title: i.key === "home" ? "Group page" : i.label, icon: i.icon, about: GROUP_ABOUT[i.key] })));
  }
  const href = activeHref(items, path);
  const item = href && items.find((i) => i.href === href && i.about);
  return item ? { title: item.title, icon: item.icon, about: item.about } : FALLBACK;
}
