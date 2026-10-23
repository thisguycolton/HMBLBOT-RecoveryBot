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

export const TEMPLATES = [HOST_A_MEETING];

export const REGIONS = ["strip", "left", "main", "right", "bar"];
// What size a region draws its blocks at
export const REGION_SIZE = { strip: "bar", left: "side", main: "main", right: "side", bar: "bar" };
// Which columns each layout shows
export const LAYOUT_SIDES = { both: ["left", "right"], left: ["left"], right: ["right"], focus: [] };
export const LAYOUT_CHOICES = [["both", "Both sidebars"], ["left", "Left sidebar"], ["right", "Right sidebar"], ["focus", "No sidebars"]];

// The deck as a meeting has it: its saved layout (its own, or the group's default), or "Host a
// meeting". The phone tabs come from the template either way.
export function deckTemplate(center) {
  const saved = center?.layout?.arrangement;
  if (!saved) return HOST_A_MEETING;
  return { ...HOST_A_MEETING, ...Object.fromEntries(REGIONS.map((r) => [r, saved[r] || []])), layout: saved.layout || "both", key: "saved" };
}

// What the layout editor saves (DeckArrangement on the server)
export const toArrangement = (t) => ({ layout: t.layout, ...Object.fromEntries(REGIONS.map((r) => [r, t[r].map(({ id, type, tight, grow }) => ({ id, type, tight, grow }))])) });

// A copy to edit
export const draftOf = (t) => ({ ...t, ...Object.fromEntries(REGIONS.map((r) => [r, (t[r] || []).map((b) => ({ ...b }))])) });
