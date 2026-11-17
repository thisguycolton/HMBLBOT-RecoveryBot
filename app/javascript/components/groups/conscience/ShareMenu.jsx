import React, { useState } from "react";
import { Globe, Lock, UserCheck, Users } from "lucide-react";
import { api } from "../lib";
import { selectClass } from "../../ui/styles";
import { quietButton } from "../ui";
import ShareButton from "../../share/ShareButton";
import { VISIBILITIES } from "./lib";

const WHO = {
  public: [Globe, "Anyone with the link can read this document."],
  members: [Users, "Only members of this group can open the link."],
  hosts: [UserCheck, "Only members who can host or co-host, and record keepers, can open the link."],
  keepers: [Lock, "Only the group's record keepers can open the link."],
};

// "Share" on a document: its link, the preview a Public one shows when it's sent (the card
// ShareCard draws), and who can open it. Record keepers can change that right here (it takes
// effect at once, and isn't a new copy of the text).
// With `open`/`onOpenChange` the File menu opens it, and its own button is left out (`bare`).
export default function ShareMenu({ group, doc, canEdit, onChanged, open, onOpenChange, bare = false, buttonClass = quietButton, iconOnly = false }) {
  const [error, setError] = useState(null);
  const [Icon, note] = WHO[doc.visibility];
  const everyone = doc.visibility === "public" && doc.status === "current";

  const setVisibility = async (visibility) => {
    if (visibility === "public" && !window.confirm("This will be visible to anyone who opens the group's page. Make it Public?")) return;
    setError(null);
    try {
      const saved = await api(`/groups/${group.slug}/documents/${doc.id}`, { method: "PATCH", body: { document: { visibility } } });
      onChanged(saved);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <ShareButton
      url={`/groups/${group.slug}/conscience/documents/${doc.id}`}
      title={`${doc.title} · ${group.title}`}
      image={everyone ? `/share_cards/document/${doc.id}.png?v=${encodeURIComponent(doc.updated_at || "")}` : null}
      panelTitle="Share document" className={buttonClass} iconOnly={iconOnly} open={open} onOpenChange={onOpenChange} bare={bare}
      note={<p className="flex items-start gap-2 text-slate-600 dark:text-neutral-300"><Icon className="mt-0.5 size-4 shrink-0" /> {note}</p>}
    >
      {canEdit && (
        <div>
          <label htmlFor="share-visibility" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Who can see it</label>
          <select id="share-visibility" className={`${selectClass} max-sm:!text-base`} value={doc.visibility} onChange={(e) => setVisibility(e.target.value)}>
            {VISIBILITIES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    </ShareButton>
  );
}
