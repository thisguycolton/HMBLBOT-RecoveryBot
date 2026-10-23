import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib";
import CommandCenterClassic from "./CommandCenterClassic";
import DeckView from "./deck/DeckView";
import { EditorToolbar } from "./deck/LayoutEditor";
import useHostingDeck from "./deck/useHostingDeck";
import { deckTemplate, draftOf, toArrangement } from "./deck/templates";

// The pieces other pages use (the chat postings page, the Time Capsule)
export { ChatPostings, MeetingClock, timeOf, useDarkMode, useMeetingClock, useNow } from "./parts";

// /groups/:slug/host/:meetingId: a meeting's HostDeck, laid out as the meeting's saved layout,
// the group's, or the built-in "Host a meeting" (what was the Hosting Command Center).
// ?classic=1 shows the Command Center as it was, for one release, in case HostDeck gets
// something wrong.
export default function CommandCenter() {
  const [params] = useSearchParams();
  return params.get("classic") === "1" ? <CommandCenterClassic /> : <HostDeck />;
}

function HostDeck() {
  const deck = useHostingDeck();
  const [draft, setDraft] = useState(null); // the layout being edited
  const [scope, setScope] = useState("meeting");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const template = deckTemplate(deck.center);
  const base = deck.center && `/groups/${deck.slug}/hosting/${deck.center.meeting.id}`;
  const done = (c) => { deck.setCenter(c); deck.applyLive(c.live); setDraft(null); };

  const edit = () => {
    setDraft(draftOf(template));
    setScope(deck.center.layout?.scope === "default" ? "default" : "meeting");
    setError(null);
  };
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      done(await api(`${base}/arrangement?on=${deck.center.on}`, { method: "PUT", body: { scope, arrangement: toArrangement(draft) } }));
    } catch (e) { setError(e.message); }
    setSaving(false);
  };
  const removeOwn = async () => {
    if (!window.confirm(`Lay out ${deck.center.meeting.name} the way the group's other meetings are?`)) return;
    try { done(await api(`${base}/arrangement?scope=meeting&on=${deck.center.on}`, { method: "DELETE" })); } catch (e) { setError(e.message); }
  };

  const editor = draft && {
    draft, setDraft,
    toolbar: <EditorToolbar center={deck.center} draft={draft} setDraft={setDraft} scope={scope} setScope={setScope} saving={saving} error={error}
      onSave={save} onCancel={() => setDraft(null)} onRemoveOwn={removeOwn} />,
  };
  return <DeckView deck={deck} template={template} editor={editor} canArrange={!!deck.center?.can_arrange} onEdit={edit} />;
}
