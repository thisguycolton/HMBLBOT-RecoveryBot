// Opens the day count modal (components/DayCount.jsx, mounted with the toasts) on this page.
// Kept apart from DayCount so callers don't pull in the modal's chip and confetti code.
// Returns false when the modal isn't mounted here (no sobriety date on the server's side), so
// the caller can fall back to a link.
export const DAY_COUNT_OPEN_EVENT = "hb:day-count-open";

export function openDayCount() {
  return !window.dispatchEvent(new Event(DAY_COUNT_OPEN_EVENT, { cancelable: true }));
}
