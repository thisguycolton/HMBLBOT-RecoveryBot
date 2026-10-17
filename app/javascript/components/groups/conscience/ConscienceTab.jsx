import React from "react";
import { useParams } from "react-router-dom";
import DocumentsView from "./DocumentsView";
import DocumentView from "./DocumentView";
import DocumentEditor from "./DocumentEditor";

// The Group conscience tab (/groups/:slug/conscience/*): for now the group's documents.
// Members see the tab; anyone may open a Public document someone linked to.
//   /conscience                      folders
//   /conscience/documents/new        a new document (record keepers)
//   /conscience/documents/:id        one document, with its history
//   /conscience/documents/:id/edit   change it (record keepers)
export default function ConscienceTab({ group }) {
  const [view, id, action] = (useParams()["*"] || "").split("/").filter(Boolean);
  if (view === "documents" && id === "new") return <DocumentEditor group={group} />;
  if (view === "documents" && id && action === "edit") return <DocumentEditor group={group} id={id} />;
  if (view === "documents" && id) return <DocumentView group={group} id={id} />;
  return <DocumentsView group={group} />;
}
