import { useCallback, useEffect, useRef, useState } from "react";
import { createConsumer } from "@rails/actioncable";
import { api } from "./lib";

// A poll, kept current while it's open: PollChannel says when anything changes (a vote, an edit,
// closing) and this fetches it again, so each viewer only gets what they may see.
export default function usePoll(token) {
  const [poll, setPoll] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const load = useCallback(() => api(`/${token}`).then((d) => { setPoll(d); setError(null); }).catch((e) => setError(e.message)), [token]);

  useEffect(() => {
    load();
    const consumer = createConsumer();
    // A burst of votes refetches once; connected also runs after a reconnect, catching up
    const soon = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 250); };
    const sub = consumer.subscriptions.create({ channel: "PollChannel", token }, { connected: soon, received: soon });
    return () => { clearTimeout(timer.current); sub.unsubscribe(); consumer.disconnect(); };
  }, [token, load]);

  return { poll, setPoll, error, reload: load };
}
