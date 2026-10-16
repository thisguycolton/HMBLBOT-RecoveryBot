import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LayoutTemplate } from "lucide-react";
import { PageBlocks } from "../../events/EventLayout";
import { api } from "../lib";
import { Loading, Message } from "../ui";
import GroupHero, { heroButton } from "./GroupHero";
import { hiddenFor } from "./lib";

// The default group page on its own: an AA Intergroup group that isn't on RecoveryBot yet
// (/groups/find/:oiaaSlug, filled in from its listings), or, with `template`, the default
// page as site admins see it (/groups/default-page).
export default function IntergroupPage({ template = false }) {
  const { oiaaSlug } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPage(null);
    api(template ? "/group_page_template" : `/intergroup_pages/${encodeURIComponent(oiaaSlug)}`).then((data) => {
      if (data.group_slug) return navigate(`/${data.group_slug}`, { replace: true });
      setPage(data);
      document.title = `${template ? "The default group page" : data.context.group.title} | RecoveryBot`;
    }).catch((e) => setError(e.message));
  }, [oiaaSlug, template, navigate]);

  if (error) {
    return (
      <Message title="That group isn't here" text={error}>
        <Link to="/find" className="mt-4 inline-block text-sm text-accent hover:underline">Find your group</Link>
      </Message>
    );
  }
  if (!page) return <Loading />;

  // Starting it makes a group here (waiting for a site admin), run by whoever started it
  const onStart = async () => {
    const group = await api("/groups/start", { method: "POST", body: { oiaa_slug: page.context.oiaa_slug } });
    navigate(`/${group.slug}`);
  };
  const context = { ...page.context, kind: page.kind, note_max: page.note_max, onStart };

  return (
    <div className="mx-auto max-w-6xl space-y-6 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <Link to={template ? "/" : "/find"} className="text-sm text-slate-500 hover:text-accent dark:text-neutral-400">{template ? "← Groups" : "← Find your group"}</Link>
      <GroupHero
        group={context.group}
        coverUrl={page.cover_url}
        note={template ? "A made-up group, to show the default page" : "Listed by AA Intergroup · not on RecoveryBot yet"}
        actions={page.can_edit_default && <Link to="/default-page/edit" className={heroButton}><LayoutTemplate className="h-4 w-4" /> Edit the default page</Link>}
      />
      <PageBlocks layout={page.layout} blocks={page.blocks} context={context} hidden={(b) => hiddenFor(b, context)} />
    </div>
  );
}
