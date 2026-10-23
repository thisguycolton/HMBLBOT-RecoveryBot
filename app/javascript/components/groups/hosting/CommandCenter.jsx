import React from "react";
import { useSearchParams } from "react-router-dom";
import CommandCenterClassic from "./CommandCenterClassic";
import DeckView from "./deck/DeckView";
import useHostingDeck from "./deck/useHostingDeck";
import { HOST_A_MEETING } from "./deck/templates";

// The pieces other pages use (the chat postings page, the Time Capsule)
export { ChatPostings, MeetingClock, timeOf, useDarkMode, useMeetingClock, useNow } from "./parts";

// /groups/:slug/host/:meetingId: a meeting's HostDeck, laid out as the "Host a meeting" template
// (what was the Hosting Command Center). ?classic=1 shows the Command Center as it was, for one
// release, in case HostDeck gets something wrong.
export default function CommandCenter() {
  const [params] = useSearchParams();
  return params.get("classic") === "1" ? <CommandCenterClassic /> : <HostDeck />;
}

function HostDeck() {
  const deck = useHostingDeck();
  return <DeckView deck={deck} template={HOST_A_MEETING} />;
}
