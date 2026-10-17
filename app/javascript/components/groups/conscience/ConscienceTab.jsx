import React from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { selectClass } from "../../ui/styles";
import DocumentsView from "./DocumentsView";
import DocumentView from "./DocumentView";
import DocumentEditor from "./DocumentEditor";
import DecisionsView from "./DecisionsView";

const SECTIONS = [
  { key: "documents", label: "Documents", path: "" },
  { key: "decisions", label: "Decisions", path: "/decisions" },
];

// The Group conscience tab (/groups/:slug/conscience/*): the group's documents and its
// decisions log. Members see the tab; anyone may open a Public document or decision
// someone linked to.
//   /conscience                      document folders
//   /conscience/decisions            what the group voted on
//   /conscience/documents/new        a new document (record keepers)
//   /conscience/documents/:id        one document, with its history
//   /conscience/documents/:id/edit   change it (record keepers)
export default function ConscienceTab({ group }) {
  const [view, id, action] = (useParams()["*"] || "").split("/").filter(Boolean);
  const navigate = useNavigate();
  const isMember = group.is_member || group.is_site_admin;
  const current = view === "decisions" ? "decisions" : "documents";
  const base = `/${group.slug}/conscience`;

  let body;
  if (view === "documents" && id === "new") body = <DocumentEditor group={group} />;
  else if (view === "documents" && id && action === "edit") body = <DocumentEditor group={group} id={id} />;
  else if (view === "documents" && id) body = <DocumentView group={group} id={id} />;
  else if (view === "decisions") body = <DecisionsView group={group} />;
  else body = <DocumentsView group={group} />;

  return (
    <div className="space-y-5">
      {isMember && (
        <>
          <nav aria-label="Group conscience" className="hidden gap-1 sm:flex">
            {SECTIONS.map((s) => (
              <NavLink key={s.key} to={`${base}${s.path}`} end
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${current === s.key ? "!bg-accent !text-white" : "bg-white text-slate-700 ring-1 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700"}`}>
                {s.label}
              </NavLink>
            ))}
          </nav>
          <select aria-label="Group conscience" className={`${selectClass} sm:hidden`} value={current} onChange={(e) => navigate(`${base}${SECTIONS.find((s) => s.key === e.target.value).path}`)}>
            {SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </>
      )}
      {body}
    </div>
  );
}
