import { useCallback, useEffect, useRef, useState } from "react";
import { createConsumer } from "@rails/actioncable";
import { tasksApi } from "./lib";

// The Task board, kept current: AdminTasksChannel says when anything changes (another admin
// moved or finished a task) and this fetches the board again. While a card is being dragged
// the refetch waits (`hold`), so the board doesn't jump under the pointer.
export default function useTaskBoard(notify) {
  const [board, setBoard] = useState(null);
  const timer = useRef(null);
  const hold = useRef(false);
  const pending = useRef(false);

  const load = useCallback(() => {
    if (hold.current) { pending.current = true; return Promise.resolve(); }
    return tasksApi().then(setBoard).catch((e) => notify?.(e.message, "error"));
  }, [notify]);

  useEffect(() => {
    load();
    const consumer = createConsumer();
    const soon = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 200); };
    const sub = consumer.subscriptions.create({ channel: "AdminTasksChannel" }, { connected: soon, received: soon });
    return () => { clearTimeout(timer.current); sub.unsubscribe(); consumer.disconnect(); };
  }, [load]);

  const setHold = useCallback((on) => {
    hold.current = on;
    if (!on && pending.current) { pending.current = false; load(); }
  }, [load]);

  return { board, setBoard, reload: load, setHold };
}
