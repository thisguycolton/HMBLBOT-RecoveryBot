import React from "react";
import { useParams } from "react-router-dom";
import DeckView from "./DeckView";
import useHostingDeck from "./useHostingDeck";
import { deckTemplate } from "./templates";

// /groups/:slug/view/:code: a shared HostDeck of its own (Deck#share_code), where its /h/CODE link
// sends someone who isn't in the group, signed in or not, when the group lets people follow it
// (Deck#guest_access). The same deck and layout the hosts have, read-only: it follows where they
// are, and nothing on it changes anything.
export default function GuestDeck() {
  const { code } = useParams();
  const deck = useHostingDeck(`/deck_links/${encodeURIComponent(code)}`, { readOnly: true });
  return <DeckView deck={deck} template={deckTemplate(deck.center)} canArrange={false} />;
}
