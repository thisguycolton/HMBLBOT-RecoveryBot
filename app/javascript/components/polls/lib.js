// Shared helpers for polls (app/controllers/api/polls_controller.rb)

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`/api/polls${path}`, {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrfToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || (res.status === 401 ? "Please sign in first." : "Something went wrong."));
    error.status = res.status;
    throw error;
  }
  return data;
}

export const AUDIENCE_LABELS = {
  anyone: "Anyone with the link",
  signed_in: "People signed in",
  members: "Members of the group",
};
export const RESULTS_LABELS = {
  always: "Always",
  after_vote: "After they vote",
  after_close: "When it closes",
};
export const VOTERS_LABELS = {
  managers: "Only the people running it",
  everyone: "Everyone who can see results",
};

export const shortUrl = (poll) => `${window.location.origin}${poll.short_path}`;

export const when = (iso) =>
  iso ? new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

export const buttonClass =
  "inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-panel hover:bg-neutral-50 disabled:opacity-50 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";
export const primaryClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl !bg-accent px-4 py-2 text-sm font-semibold !text-white shadow-panel hover:opacity-90 disabled:opacity-50";
