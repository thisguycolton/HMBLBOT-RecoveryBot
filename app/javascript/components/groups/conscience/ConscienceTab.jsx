import React from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { selectClass } from "../../ui/styles";
import DecisionsView from "./DecisionsView";
import DocumentPage from "./DocumentPage";
import DocumentsView from "./DocumentsView";
import MeetingPage from "./MeetingPage";
import MeetingsView from "./MeetingsView";
import OverviewView from "./OverviewView";
import ReportPage from "./ReportPage";
import ServiceView from "./ServiceView";
import TreasuryView from "./TreasuryView";

const SECTIONS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "meetings", label: "Meetings", path: "/meetings" },
  { key: "decisions", label: "Decisions", path: "/decisions" },
  { key: "documents", label: "Documents", path: "/documents" },
  { key: "officials", label: "Elected officials", path: "/officials" },
  { key: "treasury", label: "Treasury", path: "/treasury" },
];

// The Group conscience tab (/groups/:slug/conscience/*): a group's business meetings, its
// decisions, documents, service positions and treasurer's reports. Members see the tab; anyone
// may open a Public document or decision someone linked to.
//   /conscience                       Overview (members; anyone else gets the documents)
//   /conscience/meetings(/:id)        business meetings, agendas and minutes
//   /conscience/decisions             what the group voted on
//   /conscience/documents(/:id|/new)  document folders, and a document as a page
//   /conscience/officials             the group's elected officials and who holds each office
//   /conscience/treasury(/:id|/new)   the treasurer's monthly reports
// What one section shows, for the tab and for the group dashboard (GroupDashboard.jsx)
export function ConscienceBody({ group, view, id }) {
  const isMember = group.is_member || group.is_site_admin;
  if (!isMember && view !== "documents" && view !== "decisions") return <DocumentsView group={group} />;
  if (view === "meetings") return id ? <MeetingPage key={id} group={group} id={id} /> : <MeetingsView group={group} />;
  if (view === "decisions") return <DecisionsView group={group} />;
  if (view === "documents") return id === "new" ? <DocumentPage group={group} /> : id ? <DocumentPage group={group} id={id} /> : <DocumentsView group={group} />;
  if (view === "officials") return <ServiceView group={group} />;
  if (view === "treasury") return id === "new" ? <ReportPage group={group} /> : id ? <ReportPage key={id} group={group} id={id} /> : <TreasuryView group={group} />;
  return <OverviewView group={group} />;
}

export const SECTION_KEYS = SECTIONS.map((s) => s.key);

export default function ConscienceTab({ group }) {
  const [rawView, id] = (useParams()["*"] || "").split("/").filter(Boolean);
  const view = rawView === "service" ? "officials" : rawView; // its old address
  const navigate = useNavigate();
  const isMember = group.is_member || group.is_site_admin;
  const current = SECTIONS.some((s) => s.key === view) ? view : isMember ? "overview" : "documents";
  const base = `/${group.slug}/conscience`;

  return (
    <div className="space-y-5">
      {isMember && (
        <>
          <nav aria-label="Group conscience" className="group-chrome hidden flex-wrap gap-1 sm:flex">
            {SECTIONS.map((s) => (
              <NavLink key={s.key} to={`${base}${s.path}`} end
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${current === s.key ? "!bg-accent !text-white" : "bg-white text-slate-700 ring-1 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700"}`}>
                {s.label}
              </NavLink>
            ))}
          </nav>
          <select aria-label="Group conscience" className={`${selectClass} group-chrome sm:hidden`} value={current} onChange={(e) => navigate(`${base}${SECTIONS.find((s) => s.key === e.target.value).path}`)}>
            {SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </>
      )}
      <ConscienceBody group={group} view={current} id={id} />
    </div>
  );
}
