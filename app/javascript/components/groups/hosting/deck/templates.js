// HostDeck's built-in templates: which blocks (blocks.jsx) go in which region of which layout.
//
//   layout     "both" (sidebars left and right), "left", "right" or "focus" (no sidebars)
//   strip      across the top, under the header (reminders)
//   left, main, right   the columns
//   bar        along the bottom; a block with grow: true takes the room that's left
//   tabs       on a phone, one tab at a time: [key, label]; each block shows under its own (BLOCKS[type].tab)
//
// A block is { id, type, settings }. tight: true puts it a little closer to the one above, the
// way the Command Center grouped who's here with the share link and milestones.
//
// "Host a meeting" is exactly the Hosting Command Center as it was before HostDeck.
export const HOST_A_MEETING = {
  key: "host_a_meeting",
  name: "Host a meeting",
  layout: "both",
  strip: [{ id: "reminders", type: "reminders" }],
  left: [
    { id: "flow", type: "flow" },
    { id: "activity", type: "activity" },
    { id: "meeting_readings", type: "meeting_readings" },
    { id: "service_readings", type: "service_readings" },
    { id: "quick_actions", type: "quick_actions" },
  ],
  main: [{ id: "stage", type: "stage" }],
  right: [
    { id: "chat_postings", type: "chat_postings" },
    { id: "share_link", type: "share_link" },
    { id: "hosts_here", type: "hosts_here", tight: true },
    { id: "milestones", type: "milestones", tight: true },
    { id: "activity_log", type: "activity_log", tight: true },
  ],
  bar: [
    { id: "previous", type: "previous" },
    { id: "clock", type: "clock", grow: true },
    { id: "next", type: "next" },
  ],
  tabs: [["script", "Script"], ["chat", "Chat"], ["readings", "Readings"], ["people", "Hosts"]],
};

const DECK_TABS = [["script", "Script"], ["readings", "Lists"], ["people", "People"]];
const STEPS_BAR = [{ id: "previous", type: "previous" }, { id: "clock", type: "clock", grow: true }, { id: "next", type: "next" }];

// A business meeting run from its agenda (the script): what to do before it starts, a timer for
// reports, notes, and who's here
export const BUSINESS_MEETING = {
  key: "business_meeting",
  name: "Business meeting",
  layout: "both",
  strip: [{ id: "reminders", type: "reminders" }],
  left: [
    { id: "flow", type: "flow" },
    { id: "opening", type: "checklist", settings: { title: "Before we start", items: [
      { id: "prayer", text: "Opening prayer" }, { id: "quorum", text: "Check for a quorum" }, { id: "minutes", text: "Read and approve the last minutes" },
      { id: "treasurer", text: "Treasurer's report" },
    ] } },
  ],
  main: [{ id: "stage", type: "stage" }],
  right: [
    { id: "report_timer", type: "timer", settings: { title: "Report timer", minutes: 3 } },
    { id: "notes", type: "notes", settings: { title: "Remember", markdown: "- Motions need a second before discussion\n- Keep each report to three minutes" } },
    { id: "hosts_here", type: "hosts_here" },
    { id: "activity_log", type: "activity_log", tight: true },
  ],
  bar: STEPS_BAR,
  tabs: DECK_TABS,
};

// Host and co-host onboarding, stepped through a document, with what to do before a first meeting
export const HOST_ONBOARDING = {
  key: "onboarding",
  name: "Host onboarding",
  layout: "left",
  strip: [],
  left: [
    { id: "flow", type: "flow" },
    { id: "first_meeting", type: "checklist", settings: { title: "Before your first meeting", items: [
      { id: "format", text: "Read the meeting's format" }, { id: "account", text: "Set up your account and profile" },
      { id: "zoom", text: "Get the Zoom host key from a host coordinator" }, { id: "shadow", text: "Co-host with an experienced host" },
      { id: "hostdeck", text: "Open HostDeck for your meeting and look around" },
    ] } },
    { id: "tips", type: "notes", settings: { title: "Tips", markdown: "Ask a host coordinator anything. Nobody gets it perfect the first time." } },
    { id: "hosts_here", type: "hosts_here" },
  ],
  main: [{ id: "stage", type: "stage" }],
  right: [],
  bar: STEPS_BAR,
  tabs: DECK_TABS,
};

// Anything else run from a document
export const GENERAL_DECK = {
  key: "general",
  name: "Blank deck",
  layout: "both",
  strip: [],
  left: [{ id: "flow", type: "flow" }, { id: "notes", type: "notes", settings: { title: "Notes", markdown: "" } }],
  main: [{ id: "stage", type: "stage" }],
  right: [{ id: "hosts_here", type: "hosts_here" }, { id: "activity_log", type: "activity_log", tight: true }],
  bar: STEPS_BAR,
  tabs: DECK_TABS,
};

export const TEMPLATES = [HOST_A_MEETING, BUSINESS_MEETING, HOST_ONBOARDING, GENERAL_DECK];
// What a deck of its own (Deck) starts as, by what it's for
export const DECK_TEMPLATES = { business_meeting: BUSINESS_MEETING, onboarding: HOST_ONBOARDING, general: GENERAL_DECK };
export const PURPOSES = [["business_meeting", "A business meeting"], ["onboarding", "Host and co-host onboarding"], ["general", "Something else"]];

export const REGIONS = ["strip", "left", "main", "right", "bar"];
// What size a region draws its blocks at
export const REGION_SIZE = { strip: "bar", left: "side", main: "main", right: "side", bar: "bar" };
// Which columns each layout shows
export const LAYOUT_SIDES = { both: ["left", "right"], left: ["left"], right: ["right"], focus: [] };
export const LAYOUT_CHOICES = [["both", "Both sidebars"], ["left", "Left sidebar"], ["right", "Right sidebar"], ["focus", "No sidebars"]];

// The deck as a meeting has it: its saved layout (its own, or the group's default), or "Host a
// meeting". The phone tabs come from the template either way.
export function deckTemplate(center) {
  const base = baseTemplate(center);
  const saved = center?.layout?.arrangement;
  if (!saved) return base;
  return { ...base, ...Object.fromEntries(REGIONS.map((r) => [r, saved[r] || []])), layout: saved.layout || "both", key: "saved" };
}

// What a deck starts from: Host a meeting for a meeting, else its purpose's template
export const baseTemplate = (center) => (center?.deck ? DECK_TEMPLATES[center.deck.purpose] || GENERAL_DECK : HOST_A_MEETING);

// What the layout editor saves (DeckArrangement on the server)
export const toArrangement = (t) => ({ layout: t.layout, ...Object.fromEntries(REGIONS.map((r) => [r, t[r].map(({ id, type, tight, grow, settings }) => ({ id, type, tight, grow, settings }))])) });

// A copy to edit
export const draftOf = (t) => ({ ...t, ...Object.fromEntries(REGIONS.map((r) => [r, (t[r] || []).map((b) => ({ ...b, ...(b.settings ? { settings: structuredClone(b.settings) } : {}) }))])) });
