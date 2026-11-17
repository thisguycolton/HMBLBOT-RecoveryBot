import React from "react";
import { Navigate, NavLink, useParams } from "react-router-dom";
import DecisionsView from "./DecisionsView";
import DocumentPage from "./DocumentPage";
import DocumentsView from "./DocumentsView";
import DocumentTemplates from "./DocumentTemplates";
import MeetingPage from "./MeetingPage";
import MeetingsView from "./MeetingsView";
import OverviewView from "./OverviewView";
import ReportPage from "./ReportPage";
import ServiceView from "./ServiceView";
import TreasuryView from "./TreasuryView";

const SECTIONS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "meetings", label: "Business meetings", path: "/meetings" },
  { key: "decisions", label: "Decisions", path: "/decisions" },
  { key: "documents", label: "Documents", path: "/documents" },
  { key: "officials", label: "Officials", path: "/officials" },
  { key: "treasury", label: "Treasury", path: "/treasury" },
  // Admins have them in Manage; a record keeper who isn't an admin keeps them here
  { key: "templates", label: "Templates", path: "/templates", show: (g) => g.can_keep_records && !g.can_manage },
];

// The Group conscience tab (/groups/:slug/conscience/*): a group's business meetings, its
// decisions, documents, service positions and treasurer's reports. Members see the tab; anyone
// may open a Public document or decision someone linked to.
//   /conscience                       Overview (members; anyone else gets the documents)
//   /conscience/meetings(/:id)        business meetings, agendas and minutes
//   /conscience/decisions             what the group voted on
//   /conscience/documents(/:id|/new)  document folders, and a document as a page
//   /conscience/officials             the group's officials and who holds each office
//   /conscience/treasury(/:id|/new)   the treasurer's monthly reports
//   /conscience/templates             document templates (record keepers who aren't admins; admins: Manage)
// (Its HostDecks moved to Host tools > Decks, /groups/:slug/decks.)
// Members see it on the group page; people with a role on the stage (GroupDashboard.jsx
// ConscienceRoute), and their role decides what they can change. One section's page:
export function ConscienceBody({ group, view, id, embedded = false }) {
  const isMember = group.is_member || group.is_site_admin;
  if (!isMember && view !== "documents" && view !== "decisions") return <DocumentsView group={group} />;
  if (view === "meetings") return id ? <MeetingPage key={id} group={group} id={id} /> : <MeetingsView group={group} />;
  if (view === "decisions") return <DecisionsView group={group} />;
  if (view === "documents") return id === "new" ? <DocumentPage group={group} embedded={embedded} /> : id ? <DocumentPage group={group} id={id} embedded={embedded} /> : <DocumentsView group={group} />;
  if (view === "officials") return <ServiceView group={group} />;
  if (view === "templates" && group.can_keep_records) return <DocumentTemplates group={group} />;
  if (view === "treasury") return id === "new" ? <ReportPage group={group} /> : id ? <ReportPage key={id} group={group} id={id} /> : <TreasuryView group={group} />;
  return <OverviewView group={group} />;
}

export const SECTION_KEYS = SECTIONS.map((s) => s.key);

export default function ConscienceTab({ group, embedded = false }) {
  const [rawView, id] = (useParams()["*"] || "").split("/").filter(Boolean);
  const view = rawView === "service" ? "officials" : rawView; // its old address
  const isMember = group.is_member || group.is_site_admin;
  const sections = SECTIONS.filter((s) => !s.show || s.show(group));
  const current = sections.some((s) => s.key === view) ? view : isMember ? "overview" : "documents";
  const base = `/${group.slug}/conscience`;
  if (view === "templates" && group.can_manage) return <Navigate to={`/${group.slug}/manage/templates`} replace />;

  return (
    <div className="space-y-5">
      {isMember && (
        <>
          {/* One row of pills everywhere; on a phone it scrolls sideways */}
          <nav aria-label="Group conscience" className="group-chrome no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {sections.map((s) => (
              <NavLink key={s.key} to={`${base}${s.path}`} end
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${current === s.key ? "!bg-accent !text-white" : "bg-white text-slate-700 ring-1 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700"}`}>
                {s.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}
      <ConscienceBody group={group} view={current} id={id} embedded={embedded} />
    </div>
  );
}
