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

export const documentsPath = (slug, rest = "") => `/${slug}/conscience${rest ? `/documents/${rest}` : ""}`;
export const fileUrl = (slug, id, params = "") => `/api/groups/${slug}/documents/${id}/file${params}`;

export const sizeLabel = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
export const dateLabel = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
