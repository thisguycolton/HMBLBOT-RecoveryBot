import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Settings } from "lucide-react";
import { PageBlocks } from "../events/EventLayout";
import { api } from "../groups/lib";
import { heroQuietButton } from "../groups/page/GroupHero";
import { ErrorNote, Loading } from "../groups/ui";
import ProfileHero from "./ProfileHero";
import { hiddenFor } from "./lib";

// Someone's profile (/people/:username, /people/me for yours): their page from the HMBLBOT
// Editor, or the default one (their timeline, about, groups, who they follow).
export default function ProfilePage() {
  const { username = "me" } = useParams();
  const [page, setPage] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => api(`/people/${encodeURIComponent(username)}`).then((data) => {
    setPage(data);
    document.title = `${data.context.viewer.is_me ? "Your profile" : data.context.person.name} | RecoveryBot`;
  }).catch((e) => setError(e.message)), [username]);
  useEffect(() => { setPage(null); setError(null); load(); }, [load]);

  if (error) return <ErrorNote error={error} />;
  if (!page) return <Loading />;

  const { person, viewer } = page.context;
  const context = { ...page.context, kind: page.kind, note_max: page.note_max, images_max: page.images_max };
  const onFollowChange = ({ following, followers_count }) =>
    setPage((p) => ({ ...p, context: { ...p.context, viewer: { ...p.context.viewer, following }, person: { ...p.context.person, followers_count } } }));

  return (
    <div className="space-y-6 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <ProfileHero bleed person={person} viewer={viewer} coverUrl={page.cover_url} onFollowChange={onFollowChange}
        actions={viewer.is_me && (
          <>
            <Link to="/me/edit" className={heroQuietButton}><Pencil className="size-4" /> Edit your page</Link>
            <a href="/users/edit" className={heroQuietButton}><Settings className="size-4" /> Settings</a>
          </>
        )} />
      <PageBlocks info layout={page.layout} blocks={page.blocks} context={context} hidden={(b) => hiddenFor(b, context)} />
    </div>
  );
}
