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
  { key: "proposed", label: "Proposed" },
  { key: "withdrawn", label: "Withdrawn" },
];
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
export const servicePath = (slug) => `/${slug}/conscience/service`;
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
