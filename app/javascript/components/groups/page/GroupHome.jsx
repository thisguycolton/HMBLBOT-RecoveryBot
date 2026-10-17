import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { PageBlocks } from "../../events/EventLayout";
import { api } from "../lib";
import { ErrorNote, Loading } from "../ui";
import { hiddenFor } from "./lib";

// A group page's own content, its Home tab (/groups/:slug): the blocks its admins laid
// out in the HMBLBOT Editor, or the default page until they do. onJoin asks to join.
export default function GroupHome({ slug, onJoin }) {
  const [page, setPage] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api(`/groups/${slug}/page`).then(setPage).catch((e) => setError(e.message)), [slug]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorNote error={error} />;
  if (!page) return <Loading />;

  const context = { ...page.context, kind: page.kind, note_max: page.note_max, reload: load, onJoin: async () => { await onJoin(); await load(); } };
  return (
    <div className="space-y-6">
      {page.can_edit && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent/5 px-4 py-3 text-sm text-slate-700 ring-1 ring-accent/20 dark:bg-accent/10 dark:text-neutral-200">
          <span className="flex-1">
            {page.custom ? "You can change this page in the HMBLBOT Editor." : "This is the default group page. Make it your group's own in the HMBLBOT Editor."}
          </span>
          <Link to={`/${slug}/page/edit`} className="inline-flex items-center gap-1.5 rounded-xl !bg-accent px-3 py-1.5 font-semibold !text-white"><Pencil className="size-4" /> Edit the page</Link>
        </div>
      )}
      <PageBlocks layout={page.layout} blocks={page.blocks} context={context} hidden={(b) => hiddenFor(b, context)} />
    </div>
  );
}
