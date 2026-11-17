// The Docs screenshots: name (public/docs-images/<name>.webp), the page, who's signed in (sam is a
// site and group admin; riley sponsors jordan and casey; "guest" is signed out), phone or computer,
// and what part to keep:
// Phone shots end in -phone: the docs show those phone-sized (docs.css).
//   clip: "window" (everything) | default: the stage (the page without the sidebar)
//   card: a locator; keeps the rounded card it sits in ; from: a locator to start at, height: px
//   prep: async (page) => {...} before the picture
const { selectText } = require("./lib");

const click = (sel) => async (p) => { await p.locator(sel).first().click(); };
const CHAPTER = "/books/the-big-book-of-alcoholics-anonymous/chapters/";
const G = "/groups/lantern-street";

module.exports = [
  // Getting started
  { name: "getting-started/home-page", url: "/", who: "guest", clip: "window" },
  // Sign-up runs on localhost: its robot check needs a secure page
  { name: "getting-started/sign-up", url: "/users/sign_up", who: "guest", base: "http://localhost:3000" },
  { name: "getting-started/frame", url: "/people", clip: "window" },
  { name: "getting-started/search", url: "/people", clip: "window",
    prep: async (p) => { await p.keyboard.press("/"); await p.keyboard.type("lantern", { delay: 40 }); await p.waitForTimeout(1200); } },
  { name: "getting-started/bell", url: "/people", clip: "window", prep: click('header button[aria-label*="otification" i]') },
  { name: "getting-started/home-phone", url: "/people", phone: true },
  { name: "getting-started/menu-phone", url: "/people", phone: true, prep: async (p) => { await p.locator('button[aria-label="Menu"]').first().click(); await p.waitForTimeout(900); } },
  { name: "getting-started/install-phone", url: "/install", who: "guest", phone: true },
  { name: "getting-started/profile-settings", url: "/users/edit", card: "text=Sobriety date" },
  { name: "getting-started/privacy-defaults", url: "/users/edit", card: "text=Who sees new notes" },
  { name: "getting-started/reminders-settings", url: "/users/edit", card: "text=A daily nudge" },

  // Meetings
  { name: "meetings/find-a-meeting", url: "/groups/meetings" },
  { name: "meetings/find-a-meeting-list", url: "/groups/meetings", from: "text=meetings, soonest first", height: 620,
    prep: click('button:has-text("List")') },
  { name: "meetings/find-a-meeting-phone", url: "/groups/meetings", who: "guest", phone: true },
  { name: "meetings/topicificator", url: "/topicificator", clip: "window", // the shuffle button (the bar's buttons have no labels)
    prep: async (p) => { await p.mouse.click(630, 858); await p.waitForTimeout(1500); } },
  { name: "meetings/service-readings", url: "/service_readings" },
  { name: "meetings/service-reading", url: "/service_readings/1" },
  { name: "meetings/reading-archive", url: "/readings" },
  { name: "meetings/reading", url: "/readings/1" },
  { name: "meetings/poll", url: "/p/POLL" },
  { name: "meetings/polls", url: "/polls" },
  { name: "meetings/new-poll", url: "/polls/new" },

  // Group tools
  { name: "group-tools/find-your-group", url: "/groups/find" },
  { name: "group-tools/group-page", url: G },
  { name: "group-tools/group-page-guest", url: G, who: "guest", clip: "window" },
  { name: "group-tools/group-page-phone", url: G, phone: true },
  { name: "group-tools/page-editor", url: `${G}/page/edit`, clip: "window" },
  { name: "group-tools/meetings", url: `${G}/meetings`, from: "text=Next up", height: 640 },
  { name: "group-tools/meetings-week", url: `${G}/meetings`, from: "text=Week by week", height: 620 },
  { name: "group-tools/members", url: `${G}/members` },
  { name: "group-tools/chat", url: `${G}/messages`, clip: "window" },
  { name: "group-tools/chat-phone", url: `${G}/messages/1`, phone: true },
  { name: "group-tools/chat-mention", url: `${G}/messages/1`, clip: "window",
    prep: async (p) => { await p.locator('textarea, [contenteditable="true"]').last().click(); await p.keyboard.type("Thanks @mo", { delay: 60 }); await p.waitForTimeout(900); } },
  { name: "group-tools/events", url: `${G}/events` },
  { name: "group-tools/event", url: "/events/EVENT" },
  { name: "group-tools/hosting", url: "/people/me/hosting", height: 520 },
  // Cut above the countdown bar: the demo meeting isn't on tonight
  { name: "group-tools/hostdeck", url: `${G}/host/2`, clip: "window", height: 830 },
  { name: "group-tools/decks", url: `${G}/decks` },
  { name: "group-tools/conscience", url: `${G}/conscience` },
  { name: "group-tools/business-meetings", url: `${G}/conscience/meetings` },
  { name: "group-tools/business-meeting", url: `${G}/conscience/meetings/1` },
  { name: "group-tools/decisions", url: `${G}/conscience/decisions` },
  { name: "group-tools/decision", url: `${G}/conscience/decisions`, prep: click('text=Buy 20 Big Books for newcomers') },
  { name: "group-tools/documents", url: `${G}/conscience/documents` },
  { name: "group-tools/document", url: `${G}/conscience/documents/DOC` },
  { name: "group-tools/officials", url: `${G}/conscience/officials` },
  { name: "group-tools/treasury", url: `${G}/conscience/treasury` },
  { name: "group-tools/treasury-report", url: `${G}/conscience/treasury`, prep: click("text=October 2026") },
  { name: "group-tools/dashboard", url: `${G}/dashboard` },
  { name: "group-tools/settings", url: `${G}/settings` },
  { name: "group-tools/settings-meetings", url: `${G}/settings/meetings` },

  // Step work
  { name: "step-work/chips", url: "/recovery" },
  { name: "step-work/chip-open", url: "/recovery", clip: "window", prep: click('text=1 year >> nth=0') },
  { name: "step-work/give-a-chip", url: "/recovery/give" },
  { name: "step-work/chip-design", url: `${G}/settings/chips` },
  { name: "step-work/inventory", url: "/recovery/inventory" },
  { name: "step-work/inventory-phone", url: "/recovery/inventory", phone: true },
  { name: "step-work/gratitude", url: "/recovery/gratitude" },
  { name: "step-work/steps", url: "/recovery/steps" },
  { name: "step-work/worksheet", url: "/recovery/steps/WORK" },
  { name: "step-work/worksheet-page", url: "/recovery/steps/WORK", prep: click('text=Times I couldn\'t control it') },
  { name: "step-work/sponsorship", url: "/recovery/sponsorship", who: "riley" },
  { name: "step-work/sponsorship-sponsee", url: "/recovery/sponsorship", who: "jordan" },

  // Library
  { name: "library/library", url: "/library" },
  { name: "library/book", url: "/library/the-big-book-of-alcoholics-anonymous" },
  { name: "library/chapter", url: CHAPTER + "chapter-5-how-it-works", clip: "window" },
  { name: "library/highlight-bar", url: CHAPTER + "chapter-5-how-it-works", clip: "window",
    prep: (p) => selectText(p, "Our stories disclose in a general way what we used to be like") },
  { name: "library/highlights", url: "/library/highlights" },
  { name: "library/tag", url: "/people/tags/promises" },
  { name: "library/my-readings", url: "/readings/mine" },
  { name: "library/screen-share", url: CHAPTER + "chapter-5-how-it-works?screen=1", clip: "window" },

  // Community
  { name: "community/home-feed", url: "/people" },
  { name: "community/home-feed-phone", url: "/people", phone: true },
  { name: "community/my-page", url: "/people/me" },
  { name: "community/page-editor", url: "/people/me/edit", clip: "window" },
  { name: "community/someone-else", url: "/people/riley-m" },

  // Extras
  { name: "extras/acid-quest", url: "/game/game", clip: "window" },

  // Site admin and the docs themselves
  { name: "site-admin/dashboard", url: "/admin_panel", clip: "window" },
  { name: "site-admin/step-worksheets", url: "/admin_panel/step_templates", clip: "window" },
  { name: "site-admin/chip-templates", url: "/admin_panel/chip_templates", clip: "window" },
  { name: "site-admin/meeting-lists", url: "/admin_panel/meeting_lists", clip: "window" },
  { name: "site-admin/blocked-words", url: "/admin_panel/blocked_words", clip: "window" },
  { name: "site-admin/notices", url: "/admin_panel/notices", clip: "window" },
  { name: "site-admin/docs-home", url: "/docs", clip: "window" },
  { name: "site-admin/docs-editor", url: "/docs/group-tools/group-chat/edit", clip: "window" },
  { name: "site-admin/docs-slash-menu", url: "/docs/group-tools/group-chat/edit", clip: "window",
    prep: async (p) => { await p.locator(".ProseMirror p").last().click(); await p.keyboard.press("End"); await p.keyboard.press("Enter"); await p.keyboard.type("/"); await p.waitForTimeout(500); },
    // take the "/" and the new line back out, so autosave leaves the page as it was
    after: async (p) => { await p.keyboard.press("Escape"); await p.keyboard.press("Backspace"); await p.keyboard.press("Backspace"); await p.waitForTimeout(2500); } },
];
