// Shared bits of the Group conscience tab (/groups/:slug/conscience): the document folders
// (GroupDocument::KINDS on the server), who can see a document, and links.
import { BookOpen, CalendarClock, Coins, FolderOpen, HandHelping, Megaphone, PiggyBank, ScrollText, ShieldCheck } from "lucide-react";

export const KINDS = [
  { key: "format", label: "Format & scripts", note: "How a meeting goes, readings", icon: ScrollText },
  { key: "guidelines", label: "Guidelines & policies", note: "Group guidelines, bylaws", icon: ShieldCheck },
  { key: "treasury", label: "Treasury", note: "Treasurer's reports, budgets", icon: PiggyBank },
  { key: "service", label: "Service positions", note: "Descriptions, rotation", icon: HandHelping },
  { key: "outreach", label: "Outreach", note: "Flyers, letters, PI/CPC", icon: Megaphone },
  { key: "other", label: "Other", note: "Anything else", icon: FolderOpen },
];
export const KIND_INFO = Object.fromEntries(KINDS.map((k) => [k.key, k]));

export const VISIBILITIES = [
  { key: "members", label: "Members", note: "Anyone in the group" },
  { key: "public", label: "Public", note: "Anyone who opens the group's page" },
  { key: "keepers", label: "Record keepers", note: "Only people who keep the group's records" },
];
export const VISIBILITY_LABELS = Object.fromEntries(VISIBILITIES.map((v) => [v.key, v.label]));

export const STATUSES = [
  { key: "current", label: "Current" },
  { key: "draft", label: "Draft" },
  { key: "archived", label: "Archived" },
];

// Decisions (Motion on the server)
export const CATEGORIES = [
  { key: "money", label: "Money", icon: Coins },
  { key: "format", label: "Format", icon: ScrollText },
  { key: "service", label: "Service", icon: HandHelping },
  { key: "literature", label: "Literature", icon: BookOpen },
  { key: "meeting", label: "Meeting time & place", icon: CalendarClock },
  { key: "other", label: "Other", icon: FolderOpen },
];
export const CATEGORY_INFO = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
export const MOTION_STATUSES = [
  { key: "passed", label: "Passed" },
  { key: "failed", label: "Failed" },
  { key: "tabled", label: "Tabled" },
  { key: "referred", label: "Referred to a committee" },
  { key: "postponed", label: "Postponed to a time" },
  { key: "postponed_indefinitely", label: "Postponed indefinitely" },
  { key: "proposed", label: "Pending (not decided yet)" },
  { key: "withdrawn", label: "Withdrawn" },
  { key: "no_second", label: "No second (not before the group)" },
  { key: "out_of_order", label: "Ruled out of order" },
];
// What the secretary can record for a motion of this kind: motions nobody votes on are ruled on
export const statusOptions = (kind) => {
  const keys = ["main", "rescind"].includes(kind.key) ? MOTION_STATUSES.map((s) => s.key) : ["passed", "failed", "proposed", "withdrawn", "no_second", "out_of_order"];
  return keys.map((key) => {
    const base = MOTION_STATUSES.find((s) => s.key === key);
    if (kind.vote === "none" && key === "passed") return { key, label: "Granted / sustained" };
    if (kind.vote === "none" && key === "failed") return { key, label: "Denied / not sustained" };
    return base;
  });
};
export const STATUS_TONES = { passed: "green", failed: "amber", out_of_order: "amber", no_second: "slate", withdrawn: "slate", tabled: "slate", referred: "slate", postponed: "slate", postponed_indefinitely: "slate", proposed: "accent" };

export const REQUIRED_VOTE_LABELS = {
  majority: "A majority of the votes cast", two_thirds: "Two thirds of the votes cast", three_fourths: "Three fourths of the votes cast",
  unanimous: "Unanimous (nobody against)", entire_membership: "A majority of the entire membership",
};
export const VOTE_METHOD_LABELS = {
  voice: "Voice (ayes and noes)", rising: "Standing (rising) vote", show_of_hands: "Show of hands", ballot: "Ballot", roll_call: "Roll call", general_consent: "General consent (no objection)",
};
export const VOTE_METHOD_SHORT = { voice: "voice vote", rising: "standing vote", show_of_hands: "show of hands", ballot: "ballot", roll_call: "roll call", general_consent: "general consent" };
// What the rules say about a kind of motion, in a line
export const kindFacts = (k) => [
  k.second ? "Needs a second" : "No second needed",
  k.debatable === true ? "Debatable" : k.debatable === "limited" ? "Limited debate" : "Not debatable",
  k.amendable ? "Amendable" : "Not amendable",
  { majority: "Majority vote", two_thirds: "Two-thirds vote", rescind: "Two thirds (a majority with previous notice)", tie_sustains: "A tie sustains the chair", none: "The chair rules, no vote" }[k.vote],
].join(" · ");
export const TIME_NOTE = (zone) => `In ${zone.split("/").pop().replace("_", " ")} time`;
export const MOTION_STATUS_LABELS = Object.fromEntries(MOTION_STATUSES.map((s) => [s.key, s.label]));
// "12 for, 3 against, 1 abstained", or "" for a decision typed in without a count
export const countLabel = (m) => {
  const parts = [[m.votes_for, "for"], [m.votes_against, "against"], [m.abstentions, "abstained"]].filter(([n]) => n != null);
  return parts.map(([n, word]) => `${n} ${word}`).join(", ");
};
export const decisionsPath = (slug, open) => `/${slug}/conscience/decisions${open ? `?open=${open}` : ""}`;

export const NAMES_REMINDER = "First names and last initials only.";
export const FILE_ACCEPT = ".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp,.gif"; // what may be kept as a file

export const documentsPath = (slug, rest = "") => `/${slug}/conscience/documents${rest ? `/${rest}` : ""}`;
export const meetingsPath = (slug, id) => `/${slug}/conscience/meetings${id ? `/${id}` : ""}`;
export const treasuryPath = (slug, id) => `/${slug}/conscience/treasury${id ? `/${id}` : ""}`;
export const officialsPath = (slug) => `/${slug}/conscience/officials`;
export const fileUrl = (slug, id, params = "") => `/api/groups/${slug}/documents/${id}/file${params}`;

export const sizeLabel = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
// A date the server sends as "2026-03-03" is that day wherever you are; new Date("2026-03-03")
// would be midnight UTC, the evening before for anyone west of it
export const parseDay = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) : new Date(iso));
export const dateLabel = (iso) => parseDay(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
export const longDate = (iso) => parseDay(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const monthLabel = (iso) => parseDay(iso).toLocaleDateString([], { month: "long", year: "numeric" });

// Money is whole cents on the server; people type dollars
export const money = (cents) => (cents < 0 ? "-" : "") + (Math.abs(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
export const moneyField = (cents) => (cents ? (cents / 100).toFixed(2) : "");
export const parseMoney = (text) => {
  const n = Number(String(text ?? "").replace(/[$,\s]/g, ""));
  return String(text ?? "").trim() === "" || !Number.isFinite(n) ? null : Math.round(n * 100);
};

// Business meetings and their agendas
export const MEETING_STATUSES = [
  { key: "planned", label: "Planned" },
  { key: "held", label: "Held" },
  { key: "cancelled", label: "Cancelled" },
];
export const MINUTES_STATUSES = [
  { key: "draft", label: "Draft", note: "Only record keepers see them" },
  { key: "posted", label: "Posted", note: "Members can read them" },
  { key: "approved", label: "Approved", note: "Members read them; the group approved them" },
];
export const AGENDA_KINDS = [
  { key: "report", label: "Report" },
  { key: "old_business", label: "Old business" },
  { key: "new_business", label: "New business" },
  { key: "other", label: "Other" },
];
export const AGENDA_KIND_LABELS = Object.fromEntries(AGENDA_KINDS.map((k) => [k.key, k.label]));
export const AGENDA_STATUS_LABELS = { suggested: "Suggested", on_agenda: "On the agenda", tabled: "Tabled", done: "Done" };
