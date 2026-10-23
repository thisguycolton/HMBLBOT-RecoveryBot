import React, { useEffect, useMemo, useState } from "react";
import {
  Video,
  Copy,
  Check,
  Pencil,
  Trash2,
  MessageSquareQuote,
  MonitorPlay,
  Users,
} from "lucide-react";
import ShareButton from "./share/ShareButton";

function hasMeaningfulContent(value) {
  if (value == null) return false;

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "object") {
    // TipTap/ProseMirror doc support
    if (value.type === "doc") {
      return Array.isArray(value.content) && value.content.length > 0;
    }

    // Generic non-empty object fallback
    return Object.keys(value).length > 0;
  }

  return false;
}

function firstMeaningfulContent(...values) {
  return values.find(hasMeaningfulContent) ?? "";
}

export default function ReadingShow({
  reading,
  currentUser,
  baseUrl = window.location.origin,
  onDelete,
}) {
  const [scrollWidth, setScrollWidth] = useState(0);
  const [copied, setCopied] = useState(false);

  const ownerId = reading?.user_id ?? reading?.userId;
  const currentUserId = currentUser?.id;

  const isOwner =
    currentUserId != null &&
    ownerId != null &&
    Number(currentUserId) === Number(ownerId);

  useEffect(() => {
    function updateScrollProgress() {
      const doc = document.documentElement;
      const height = doc.scrollHeight - doc.clientHeight;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const pct = height > 0 ? (scrollTop / height) * 100 : 0;
      setScrollWidth(Math.max(0, Math.min(100, pct)));
    }

    updateScrollProgress();
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("resize", updateScrollProgress);

    return () => {
      window.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("resize", updateScrollProgress);
    };
  }, []);

  const readingUrl = `${baseUrl}/readings/${reading.id}`;

  const meetingDateLabel = formatMeetingDate(reading.meetingDate);
  const meetingTimeLabel = formatMeetingTime(reading.meetingTime);

function renderRichContent(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();

    // Already HTML
    if (trimmed.startsWith("<")) return trimmed;

    // Might be TipTap JSON stored as a string
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return tiptapJsonToHtml(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  // Already parsed JSON object
  if (typeof value === "object") {
    return tiptapJsonToHtml(value);
  }

  return String(value);
}
function tiptapJsonToHtml(node) {
  if (!node) return "";

  if (Array.isArray(node)) {
    return node.map(tiptapJsonToHtml).join("");
  }

  if (node.type === "text") {
    let text = escapeHtml(node.text || "");

    if (node.marks?.length) {
      for (const mark of node.marks) {
        if (mark.type === "bold") text = `<strong>${text}</strong>`;
        if (mark.type === "italic") text = `<em>${text}</em>`;
        if (mark.type === "strike") text = `<s>${text}</s>`;
        if (mark.type === "underline") text = `<u>${text}</u>`;
        if (mark.type === "code") text = `<code>${text}</code>`;

        if (mark.type === "link") {
          const href = mark.attrs?.href || "#";
          text = `<a href="${escapeHtml(href)}">${text}</a>`;
        }

        if (mark.type === "textStyle") {
          const styles = [];
          if (mark.attrs?.fontSize) styles.push(`font-size:${mark.attrs.fontSize}`);
          if (mark.attrs?.color) styles.push(`color:${mark.attrs.color}`);
          if (styles.length) {
            text = `<span style="${styles.join(";")}">${text}</span>`;
          }
        }
      }
    }

    return text;
  }

  const content = (node.content || []).map(tiptapJsonToHtml).join("");

  switch (node.type) {
    case "doc":
      return content;
    case "paragraph":
      return `<p>${content}</p>`;
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level || 1), 1), 6);
      return `<h${level}>${content}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${content}</ul>`;
    case "orderedList":
      return `<ol>${content}</ol>`;
    case "listItem":
      return `<li>${content}</li>`;
    case "blockquote":
      return `<blockquote>${content}</blockquote>`;
    case "horizontalRule":
      return `<hr>`;
    case "hardBreak":
      return `<br>`;
    case "codeBlock":
      return `<pre><code>${content}</code></pre>`;
    default:
      return content;
  }
}

const contentSource = firstMeaningfulContent(
  reading.content_html,
  reading.contentHtml,
  reading.content,
  reading.richer_content_html,
  reading.richerContentHtml,
  reading.richer_content,
  reading.richerContent
);

const topicSource = firstMeaningfulContent(
  reading.topic_html,
  reading.topicHtml,
  reading.topic
);

const contentHtml = renderRichContent(contentSource);
const topicHtml = renderRichContent(topicSource);

  const formattedTopicsHtml = useMemo(() => {
    return String(topicHtml)
      .replace(/<\/?ul>/gi, "")
      .replace(/<\/li>/gi, "<br>")
      .replace(/<li>/gi, "- ")
      .replace(/&nbsp;/gi, " ")
      .trim();
  }, [topicHtml]);

  async function handleCopy() {
    const readingTitle =
      `<strong style="font-size: 1.5em;">Reading:</strong><br>` +
      `${escapeHtml(reading.title)}<br>`;

    const contentToCopy =
      `====================<br>` +
      readingTitle +
      `${readingUrl}<br>` +
      `====================<br>` +
      `<strong style="font-size: 1.5em;">Example Topics For Sharing:</strong><br>` +
      `Feel free to check in!<br>` +
      `---------------------<br>` +
      formattedTopicsHtml;

    const plainText = contentToCopy.replace(/<\/?[^>]+(>|$)/g, "");

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([contentToCopy], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" }),
        }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      try {
        await navigator.clipboard.writeText(plainText);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } catch (fallbackError) {
        console.error("Copy failed", fallbackError);
      }
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = window.confirm("Delete this reading?");
    if (!ok) return;
    await onDelete(reading);
  }

  const group = reading.group;
  const hostUrl = reading.host_url;
  const coverUrl = group?.cover_url;
  const signedIn = currentUserId != null;
  const hasTopics = String(topicHtml).replace(/<[^>]*>|&nbsp;/g, "").trim().length > 0;

  const ghostButton =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold !text-white transition hover:bg-white/10 hover:!text-white";

  return (
    <>
      <div
        className="fixed top-0 left-0 h-1.5 bg-sky-400 z-[10000] transition-[width] duration-75"
        style={{ width: `${scrollWidth}%` }}
      />
      <div className="min-h-screen w-full bg-stone-50 text-slate-900 dark:bg-neutral-900 dark:text-neutral-100">
        {/* HERO */}
        {/* The group's cover photo (as on its page), else the site's blue */}
        <section className={`relative overflow-hidden text-white ${coverUrl ? "bg-neutral-900" : "bg-gradient-to-r from-sky-600 to-sky-800"}`}>
          {coverUrl && <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" />}
          <div className={`relative ${coverUrl ? "bg-gradient-to-t from-black/85 via-black/55 to-black/30" : ""}`}>
          <div className="mx-auto max-w-3xl px-5 py-8 md:py-12">
            {group?.logo_url && (
              <a href={group.url} className="mb-4 inline-block" title={`${group.name}'s group page`}>
                <img src={group.logo_url} alt={group.name} className="size-14 rounded-[28%] object-cover shadow-lg ring-2 ring-white/70 md:size-16" />
              </a>
            )}
            <div className="text-xs font-semibold uppercase tracking-widest text-sky-100/90">
              Meeting reading
              {group && (
                <>
                  <span className="mx-2 text-sky-200/60">·</span>
                  <a href={group.url} className="!text-sky-100 underline-offset-4 hover:!text-white hover:underline">
                    {group.name}
                  </a>
                </>
              )}
            </div>

            <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl ttSans">
              {reading.meetingName || "Meeting Reading"}
            </h1>

            {(meetingDateLabel || meetingTimeLabel) && (
              <div className="mt-2 text-lg text-sky-50 md:text-xl">
                {meetingDateLabel}
                {meetingDateLabel && meetingTimeLabel && <span className="mx-2 text-sky-200/70">·</span>}
                {meetingTimeLabel && <span className="font-light">{meetingTimeLabel}</span>}
              </div>
            )}

            {reading.tags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {reading.tags.map((tag) => (
                  <a
                    key={tag.id}
                    href={`/readings?tag=${encodeURIComponent(tag.slug || tag.title)}`}
                    className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm font-medium !text-white transition hover:bg-white/20 hover:!text-white"
                  >
                    {tag.title}
                  </a>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-2">
              {reading.meetingUrl && (
                <a
                  href={reading.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex grow items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold !text-sky-800 shadow-sm transition hover:bg-sky-50 hover:!text-sky-900 sm:grow-0"
                >
                  <Video size={18} />
                  Join with Zoom
                </a>
              )}

              {hostUrl && (
                <a href={hostUrl} className={ghostButton} title="Open HostDeck for this meeting">
                  <MonitorPlay size={18} />
                  Host
                </a>
              )}

              {group && (
                <a href={group.url} className={ghostButton} title={`${group.name}'s group page`}>
                  <Users size={18} />
                  Group
                </a>
              )}

              <button
                type="button"
                onClick={handleCopy}
                title="Copy the title, link and topics to paste in the chat"
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  copied
                    ? "border-emerald-500 !bg-emerald-500 text-white"
                    : "border-white/30 !bg-transparent text-white hover:!bg-white/10"
                }`}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? "Copied" : "Copy for chat"}
              </button>

              <ShareButton url={`/readings/${reading.id}`} title={[reading.title || reading.meetingName, group?.name].filter(Boolean).join(" · ")}
                text={reading.title || reading.meetingName} image={reading.published ? `/share_cards/reading/${reading.id}.png` : null}
                panelTitle="Share this reading" className={`${ghostButton} !bg-transparent`} />

              {isOwner && (
                <a href={`/readings/${reading.id}/edit`} className={ghostButton} aria-label="Edit this reading" title="Edit this reading">
                  <Pencil size={18} />
                  <span className="sr-only">Edit</span>
                </a>
              )}

              {isOwner && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  aria-label="Delete this reading"
                  className="inline-flex items-center justify-center rounded-xl border border-red-300/40 !bg-transparent px-4 py-2.5 text-white transition hover:bg-red-500/20"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-5 py-8 md:py-12">
          {/* MAIN READING */}
          <article>
            <h2 className="mb-6 text-3xl font-bold uppercase tracking-wide md:text-4xl ttSans">
              {reading.title}
            </h2>

            <div className="reading-prose wrap-normal" dangerouslySetInnerHTML={{ __html: contentHtml }} />

            {reading.source && (
              <div className="mt-8 border-t border-stone-200 pt-4 text-base italic text-neutral-600 dark:border-neutral-700 dark:text-neutral-400 wrap-normal">
                {reading.source}
              </div>
            )}
          </article>

          {/* TOPICS */}
          {hasTopics && (
            <section className="mt-10 rounded-2xl border border-sky-100 bg-sky-50 px-6 py-6 dark:border-neutral-700 dark:bg-neutral-800 md:px-8 md:py-8">
              <h2 className="text-2xl font-bold ttSans">Example topics for sharing</h2>
              <div className="mt-1 text-neutral-600 italic dark:text-neutral-400">Feel free to check in!</div>
              <div
                className="reading-topics mt-5 text-lg font-medium text-slate-800 dark:text-neutral-100"
                dangerouslySetInnerHTML={{ __html: topicHtml }}
              />
            </section>
          )}

          {/* CTA, for visitors without an account */}
          {!signedIn && (
            <section className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-stone-200 bg-white px-6 py-6 dark:border-neutral-700 dark:bg-neutral-800/60 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800">
                <MessageSquareQuote size={24} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">Share readings easier</h2>
                <div className="mt-1 text-slate-600 dark:text-neutral-300">
                  Sign up to post your readings and share them with others with a simple click.
                </div>
              </div>
              <a
                href="/users/sign_up"
                className="inline-flex w-full items-center justify-center rounded-xl bg-blue-500 px-5 py-2.5 font-semibold !text-white hover:bg-blue-400 sm:w-auto"
              >
                Sign up
              </a>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function formatMeetingDate(value) {
  if (!value) return "";
  // A bare YYYY-MM-DD is the meeting's own date: read it as local, not as midnight UTC
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMeetingTime(value) {
  if (!value) return "";

  if (/^\d{2}:\d{2}/.test(value)) {
    const [hour, minute] = value.split(":");
    const d = new Date();
    d.setHours(Number(hour), Number(minute), 0, 0);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}