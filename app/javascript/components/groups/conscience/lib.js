// Shared bits of the Group conscience tab (/groups/:slug/conscience): the document folders
// (GroupDocument::KINDS on the server), who can see a document, and links.
import { FolderOpen, HandHelping, Megaphone, PiggyBank, ScrollText, ShieldCheck } from "lucide-react";

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

export const NAMES_REMINDER = "First names and last initials only.";
export const FILE_ACCEPT = ".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp,.gif";

export const documentsPath = (slug, rest = "") => `/${slug}/conscience${rest ? `/documents/${rest}` : ""}`;
export const fileUrl = (slug, id, params = "") => `/api/groups/${slug}/documents/${id}/file${params}`;

export const sizeLabel = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
export const dateLabel = (iso) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
