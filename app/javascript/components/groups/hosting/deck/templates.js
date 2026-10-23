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
