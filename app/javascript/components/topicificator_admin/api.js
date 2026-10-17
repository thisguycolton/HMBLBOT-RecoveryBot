// JSON calls to /api/admin/*. Errors come back as { errors: [...] } or { error }; the thrown
// Error carries the first message so pages can show it as-is.
function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
}

export async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`/api/admin${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrfToken() },
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.errors?.[0] || data.error || `Request failed (${response.status})`);
  return data;
}

export const topicTitle = (topic) => [topic.title, topic.subtitle].filter(Boolean).join(" ").trim() || "Untitled topic";
