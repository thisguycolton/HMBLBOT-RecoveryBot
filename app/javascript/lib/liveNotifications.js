// Tells open bells (NotificationBell.jsx) the moment the account gets a notification, so the
// list and count update without a refresh, on the web and in the apps: NotificationsChannel on
// the server, plus a push arriving while the app is open ("hb:notifications", native_app.js).
// One connection for the page, however many bells it shows.
import { createConsumer } from "@rails/actioncable";

const listeners = new Set();
let consumer = null;
let subscription = null;
let timer = null;

// A burst (a reaction and a comment at once) fetches once
const changed = () => {
  clearTimeout(timer);
  timer = setTimeout(() => listeners.forEach((fn) => fn()), 250);
};

export function onNotificationsChanged(fn) {
  listeners.add(fn);
  if (listeners.size === 1) {
    window.addEventListener("hb:notifications", changed);
    try {
      consumer = createConsumer();
      let dropped = false;
      subscription = consumer.subscriptions.create({ channel: "NotificationsChannel" }, {
        received: changed,
        // Back after the connection dropped (a phone asleep, the server redeployed): catch up
        connected: () => { if (dropped) changed(); dropped = false; },
        disconnected: () => { dropped = true; },
      });
    } catch {
      // no WebSocket here; the bell still polls
    }
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size) return;
    window.removeEventListener("hb:notifications", changed);
    subscription?.unsubscribe();
    consumer?.disconnect();
    subscription = consumer = null;
  };
}
