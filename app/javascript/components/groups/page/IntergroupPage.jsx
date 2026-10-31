import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BellRing, Check, LayoutTemplate } from "lucide-react";
import { PageBlocks } from "../../events/EventLayout";
import { api } from "../lib";
import { Loading, Message } from "../ui";
import GroupHero, { heroButton, heroQuietButton } from "./GroupHero";
import NextMeeting from "../NextMeeting";
import { hiddenFor } from "./lib";

// The default group page on its own: an AA Intergroup group that isn't on RecoveryBot yet
// (/groups/find/:oiaaSlug, filled in from its listings), or, with `template`, the default
// page as site admins see it (/groups/default-page).
export default function IntergroupPage({ template = false }) {
  const { oiaaSlug } = useParams();
  const navigate = useNavigate();
  // "Find your group" is for people who see Groups; everyone else came from Find a meeting
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
  // Following it: told when it comes to RecoveryBot
  const follow = page.follow;
  const toggleFollow = async () => {
    if (!follow.signed_in) { window.location.href = "/users/sign_in"; return; }
    const res = await api(`/intergroup_pages/${encodeURIComponent(oiaaSlug)}/follow`, { method: follow.following ? "DELETE" : "POST" });
    setPage((p) => ({ ...p, follow: { ...p.follow, following: res.following, followers: p.follow.followers + (res.following ? 1 : -1) } }));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <GroupHero
        bleed
        group={context.group}
        coverUrl={page.cover_url}
        note={template ? "A made-up group, to show the default page" : `Listed by ${context.group?.source || "AA Intergroup"} · not on RecoveryBot yet`}
        next={!template && <NextMeeting meetings={context.meetings} buttonClass={heroButton} quietClass={heroQuietButton} />}
        actions={
          <>
            {page.can_edit_default && <Link to="/default-page/edit" className={heroButton}><LayoutTemplate className="h-4 w-4" /> Edit the default page</Link>}
            {!template && follow && (
              <button type="button" onClick={toggleFollow} className={follow.following ? heroQuietButton : heroButton}
                title="Get a notification when this group comes to RecoveryBot">
                {follow.following ? <><Check className="h-4 w-4" /> Following</> : <><BellRing className="h-4 w-4" /> Follow this group</>}
              </button>
            )}
            {!template && follow?.followers > 0 && <span className={heroQuietButton}>{follow.followers} {follow.followers === 1 ? "person is" : "people are"} waiting for it</span>}
          </>
        }
      />
      <PageBlocks layout={page.layout} blocks={page.blocks} context={context} hidden={(b) => hiddenFor(b, context)} />
    </div>
  );
}
