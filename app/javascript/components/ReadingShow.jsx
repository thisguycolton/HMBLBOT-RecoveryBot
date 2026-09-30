import React, { useEffect, useMemo, useState } from "react";
import {
  Video,
  Copy,
  Check,
  Pencil,
  Trash2,
  MessageSquareQuote,
} from "lucide-react";

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
  baseUrl = "https://aa.humblebot.io",
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

  return (
    <>
      <div
        className="fixed top-0 left-0 h-1.5 bg-sky-400 z-[10000] transition-[width] duration-75"
        style={{ width: `${scrollWidth}%` }}
      />
      <div className="grid grid-cols-6 lg:gap-2 !w-screen">
      <div className="min-h-screen col-span-6 md:col-span-4 md:col-start-2 bg-stone-50  text-slate-900 ">
        {/* HERO */}
        {/* HERO */}
<section
  className="
    relative
    left-1/2
    w-screen
    -translate-x-1/2
    bg-gradient-to-r
    from-sky-600
    to-sky-800
    text-white
    border-b-8
    border-sky-200
    dark:border-neutral-700
  "
>
  <div className="mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-14 lg:py-16">
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">

      {/* Reading information */}
      <div className="min-w-0 flex-1">
        <h1 className="text-4xl font-bold tracking-tight md:text-6xl ttSans">
          {reading.meetingName || "Meeting Reading"}
        </h1>

        <h2 className="mt-2 text-2xl font-semibold text-sky-100 md:text-4xl">
          Meeting Reading
        </h2>

        <div className="mt-5">
          <div className="text-xl md:text-3xl">
            <span>{meetingDateLabel}</span>

            {meetingTimeLabel && (
              <span className="ml-3 font-light text-sky-100">
                {meetingTimeLabel}
              </span>
            )}
          </div>

          {reading.tags?.length > 0 && (
  <div className="mt-5 w-full overflow-x-auto overflow-y-hidden">
    <div className="flex w-max min-w-full flex-nowrap gap-2 pb-1">
      {reading.tags.map((tag) => (
        <a
          key={tag.id}
          href={`/readings?tag=${encodeURIComponent(
            tag.slug || tag.title
          )}`}
          className="
            inline-flex
            shrink-0
            items-center
            rounded-full
            border
            border-white/30
            bg-white/10
            px-4
            py-1.5
            text-sm
            font-medium
            text-white
            hover:!bg-white/20
          hover:!text-white
          focus:!text-white
          active:!text-white
          visited:!text-white
            whitespace-nowrap
            transition
            hover:bg-white/20
          "
        >
          {tag.title}
        </a>
      ))}
    </div>
  </div>
)}
        </div>
      </div>

      {/* Actions */}
      <div className="w-full lg:w-auto lg:min-w-[220px]">
        <div className="flex w-full flex-wrap gap-2 lg:justify-end">

          {reading.meetingUrl && (
            <a
              href={reading.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="
                inline-flex
                grow
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-blue-500
                px-5
                py-3
                text-sm
                font-semibold
                text-white
                transition
                hover:bg-blue-400
                lg:grow-0
              "
            >
              <Video size={18} />

              <span className="hidden md:inline">
                Join With Zoom
              </span>

              <span className="md:hidden">
                Join
              </span>
            </a>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className={`
              inline-flex
              items-center
              justify-center
              rounded-xl
              px-4
              py-3
              font-semibold
              transition
              ${
                copied
                  ? "bg-emerald-500 text-white"
                  : "bg-white text-slate-900 hover:bg-slate-100"
              }
            `}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>

          {isOwner && (
            <>
              <a
                href={`/readings/${reading.id}/edit`}
                className="
                  inline-flex
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-white/30
                  px-4
                  py-3
                  text-white
                  transition
                  hover:bg-white/10
                "
              >
                <Pencil size={18} />
              </a>

              {onDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="
                    inline-flex
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-red-300/40
                    px-4
                    py-3
                    text-white
                    transition
                    hover:bg-red-500/20
                  "
                >
                  <Trash2 size={18} />
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

    </div>
  </div>
</section>

        {/* MAIN READING */}
        <section className=" bg-stone-100 dark:bg-neutral-900  dark:text-neutral-100">
          <div className=" max-w-display px-4 py-5 md:py-14">
            <figure>
              <h1 className="mb-6 text-3xl font-bold uppercase tracking-widest md:text-5xl ttSans">
                {reading.title}
              </h1>

              <blockquote className="reading-prose wrap-normal">
                <div
                  dangerouslySetInnerHTML={{ __html: contentHtml }}
                />
              </blockquote>

              {reading.source && (
                <figcaption className="mt-6 text-xl italic text-neutral-600 dark:text-neutral-300 md:text-2xl wrap-normal">
                  {reading.source}
                </figcaption>
              )}
            </figure>
          </div>
        </section>

        {/* TOPICS */}
<section className="relative left-1/2 w-screen -translate-x-1/2 bg-sky-900 text-white grid grid-cols-6 lg:gap-2">
  <div className="mx-auto max-w-5xl px-4 py-12 md:py-16 col-span-6 md:col-span-4 md:col-start-2">
    <h2 className="text-center text-3xl font-bold uppercase md:text-5xl">
      Example Topics For Sharing
    </h2>

    <h3 className="mt-2 text-center text-xl italic text-neutral-300 md:text-2xl">
      Feel free to check in!
    </h3>

    <div className="mt-8 rounded-[2rem] bg-white px-6 py-8 text-neutral-800 shadow-sm dark:bg-cyan-600 dark:text-neutral-100 md:px-10 md:py-10">
      <div
        className="reading-topics text-lg md:text-xl"
        dangerouslySetInnerHTML={{ __html: topicHtml }}
      />
    </div>
  </div>
</section>

        {/* CTA */}
        <section className=" bg-neutral-100 dark:bg-stone-900 dark:text-neutral-100">
          <div className=" max-w-5xl px-4 py-12 md:py-16">
            <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 text-sky-800">
                <MessageSquareQuote size={38} />
              </div>

              <div className="flex-1">
                <h2 className="text-3xl font-semibold md:text-5xl">
                  Share Readings Easier
                </h2>
                <p className="mt-3 text-lg text-slate-600 dark:text-neutral-300 md:text-2xl">
                  Sign up to post your readings and share them with others with a simple click.
                </p>
              </div>
            </div>

            <div className="mt-8  max-w-2xl">
              <a
                href="/users/sign_up"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-500 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-400"
              >
                Sign Up
              </a>
            </div>
          </div>
        </section>
      </div>
      </div>

    </>
  );
}

function formatMeetingDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
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