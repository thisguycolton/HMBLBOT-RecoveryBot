import React, { useLayoutEffect, useRef, useState } from "react";
import axios from "axios";
import { BookText, ChevronDown, Eye, Save, Shapes, Type, X } from "lucide-react";
import BlockEditor from "./BlockEditor";
import IconPicker from "./ui/IconPicker";
import LucideIcon from "./ui/LucideIcon";
import { Shell, ShellBand, ShellPanel } from "./ui/Shell";
import { inputClass, labelClass, iconInputClass } from "./ui/styles";

// The old Rails form saved Bootstrap icon classes; the hosting list (groups/hosting/ServiceReadings.jsx)
// draws Lucide icons by name, so an old reading opens with its Lucide match picked
const BOOTSTRAP_TO_LUCIDE = {
  "bi-peace": "bird",
  "bi-list-ol": "list-ordered",
  "bi-people": "users",
  "bi-book": "book",
  "bi-stars": "sparkles",
  "bi-calendar-check": "calendar-check",
  "bi-gear": "settings",
  "bi-clock": "clock",
  "bi-trash": "trash",
  "bi-check-circle": "circle-check",
  "bi-heart": "heart",
  "bi-chat-quote": "message-square-quote",
};

function lucideName(icon) {
  if (!icon) return null;
  return BOOTSTRAP_TO_LUCIDE[icon] || icon.replace(/^bi-/, "") || null;
}

// ActionText wraps the body in <div class="trix-content">; the editor wants what's inside
function unwrapTrix(html) {
  const value = String(html || "").trim();
  if (!value || typeof DOMParser === "undefined") return value;
  const doc = new DOMParser().parseFromString(value, "text/html");
  const wrapper = doc.body.firstElementChild;
  if (doc.body.children.length === 1 && wrapper?.classList.contains("trix-content")) return wrapper.innerHTML.trim();
  return value;
}

function htmlHasText(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;| /g, " ").trim().length > 0;
}

function FieldError({ id, message, className = "" }) {
  if (!message) return null;
  return (
    <p id={id} className={`mt-1.5 text-sm font-medium text-red-600 dark:text-red-300 !font-sans !text-left ${className}`}>
      {message}
    </p>
  );
}

// Add or change a service reading (How It Works, the Traditions, the Promises...). Laid out
// like the reading it makes (ServiceReadingShow.jsx): the title and source in the blue hero,
// the words underneath; the short title and icon beside it.
export default function ServiceReadingEditor({ reading = {} }) {
  const isEditing = Boolean(reading.id);
  const [form, setForm] = useState(() => ({
    title: reading.title || "",
    shortTitle: reading.short_title || "",
    source: reading.source || "",
    icon: lucideName(reading.icon),
    body: unwrapTrix(reading.body_html),
  }));
  const [wasValidated, setWasValidated] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  // The title box grows to fit a long title
  const titleRef = useRef(null);
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [form.title]);

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const errors = {};
  if (!form.title.trim()) errors.title = "Add a title for this reading.";
  if (!htmlHasText(form.body)) errors.body = "Add the words of the reading.";
  const shown = wasValidated ? errors : {};

  const backUrl = isEditing ? `/service_readings/${reading.id}` : "/service_readings";

  async function handleSubmit(e) {
    e.preventDefault();
    setWasValidated(true);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      const target = document.querySelector(`[data-field="${firstInvalid}"]`)?.querySelector("textarea, input, [contenteditable='true']");
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.focus({ preventScroll: true });
      return;
    }

    setSaving(true);
    setServerErrors([]);
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
      const response = await axios({
        method: isEditing ? "patch" : "post",
        url: isEditing ? `/service_readings/${reading.id}` : "/service_readings",
        data: {
          service_reading: {
            title: form.title.trim(),
            short_title: form.shortTitle.trim(),
            source: form.source.trim(),
            icon: form.icon || "",
            body: form.body,
          },
        },
        headers: { "X-CSRF-Token": csrf, Accept: "application/json", "Content-Type": "application/json" },
        withCredentials: true,
      });
      window.location.href = response?.data?.redirect_url || backUrl;
    } catch (error) {
      const list = error?.response?.data?.errors || ["Something went wrong while saving. Try again."];
      setServerErrors(Array.isArray(list) ? list : [list]);
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const saveButton = (extra = "") => (
    <button
      type="submit"
      form="service-reading-form"
      disabled={saving}
      className={`!bg-accent hover:opacity-90 disabled:opacity-60 text-white text-sm font-semibold transition-opacity inline-flex items-center justify-center gap-2 ${extra}`}
    >
      <Save className="w-4 h-4" strokeWidth={2.5} />
      {saving ? "Saving..." : "Save Reading"}
    </button>
  );

  return (
    <div className="w-full min-w-0">
      {/* Page header */}
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 pt-6 pb-5">
        <div className="max-w-6xl mx-auto">
          <nav className="flex items-center text-sm text-slate-500 dark:text-neutral-400 mb-3 min-w-0">
            <a href="/service_readings" className="hover:text-accent transition-colors shrink-0">Service readings</a>
            <ChevronDown className="w-4 h-4 mx-2 text-slate-400 -rotate-90 shrink-0" />
            {isEditing && (
              <>
                <a href={backUrl} className="hover:text-accent transition-colors truncate">{reading.title || "Reading"}</a>
                <ChevronDown className="w-4 h-4 mx-2 text-slate-400 -rotate-90 shrink-0" />
              </>
            )}
            <span className="text-slate-900 dark:text-white font-medium shrink-0">{isEditing ? "Edit" : "New"}</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-accent-tint dark:bg-accent/30 shadow-panel flex items-center justify-center shrink-0">
                <LucideIcon name={form.icon} fallback={BookText} size={20} strokeWidth={2.5} className="text-accent dark:text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="!text-xl max-lg:!text-2xl !leading-tight font-semibold text-slate-900 dark:text-white !font-sans">
                  {isEditing ? "Edit Service Reading" : "New Service Reading"}
                </h1>
                <p className="text-sm text-slate-600 dark:text-neutral-400 mt-0.5 !font-sans !text-left">
                  {isEditing
                    ? "Change the words, source, short title or icon."
                    : "Add a reading groups can open and share during a meeting."}
                </p>
              </div>
            </div>
            <div className="max-lg:hidden flex items-stretch rounded-panel overflow-hidden shadow-panel bg-white dark:bg-surface-dark divide-x divide-neutral-200 dark:divide-neutral-700">
              <a
                href={backUrl}
                className="px-5 py-3 text-sm font-medium !text-slate-900 dark:!text-neutral-300 hover:bg-accent/5 dark:hover:bg-white/5 transition-colors !no-underline"
              >
                Cancel
              </a>
              {saveButton("px-5 py-3")}
            </div>
          </div>
        </div>
      </header>

      {serverErrors.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 mt-4">
          <div role="alert" className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-panel shadow-panel flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 !font-sans !text-left">
                {serverErrors.length} error{serverErrors.length === 1 ? "" : "s"} kept this reading from being saved:
              </p>
              <ul className="mt-2 space-y-1">
                {serverErrors.map((error, i) => (
                  <li key={i} className="text-sm text-red-700 dark:text-red-300">{error}</li>
                ))}
              </ul>
            </div>
            <button type="button" onClick={() => setServerErrors([])} aria-label="Dismiss" className="!bg-transparent text-red-400 hover:text-red-600 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <form id="service-reading-form" noValidate onSubmit={handleSubmit} className="px-4 min-[1400px]:px-8 py-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          {/* Live preview: what /service_readings/:id will show */}
          <main className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2 px-3 text-xs text-slate-500 dark:text-neutral-400">
              <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                Live preview
              </span>
              <span className="hidden sm:inline">
                Type <kbd className="rounded bg-white dark:bg-neutral-800 px-1.5 py-0.5 font-mono shadow-panel">/</kbd> for blocks · select text to format
              </span>
            </div>

            <div className="overflow-hidden rounded-4xl shadow-lg ring-1 ring-black/5 dark:ring-white/10">
              <section className="bg-gradient-to-r from-sky-600 to-sky-800 text-white px-5 py-8 md:px-10 md:py-10">
                <div data-field="title">
                  <label htmlFor="service_reading_title" className="sr-only">Title</label>
                  <textarea
                    id="service_reading_title"
                    ref={titleRef}
                    rows={1}
                    placeholder="Full reading title"
                    value={form.title}
                    aria-invalid={Boolean(shown.title)}
                    aria-describedby={shown.title ? "service_reading_title_error" : undefined}
                    onChange={(e) => update("title", e.target.value.replace(/\n/g, " "))}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    className="block w-full resize-none overflow-hidden border-0 !bg-transparent p-0 text-4xl font-bold tracking-tight !text-white md:text-5xl ttSans placeholder:text-sky-100/60 focus:outline-none focus:ring-0"
                  />
                  <FieldError id="service_reading_title_error" message={shown.title} className="!text-red-100" />
                </div>
                <label htmlFor="service_reading_source" className="sr-only">Source</label>
                <input
                  id="service_reading_source"
                  type="text"
                  placeholder="Source: book, pamphlet, page…"
                  value={form.source}
                  onChange={(e) => update("source", e.target.value)}
                  className="mt-3 block w-full border-0 !bg-transparent p-0 text-lg !text-sky-50 md:text-xl placeholder:text-sky-100/60 focus:outline-none focus:ring-0"
                />
              </section>

              <section data-field="body" className="bg-stone-100 dark:bg-neutral-900 text-slate-900 dark:text-neutral-100 px-5 py-8 md:px-10 md:py-10">
                <FieldError message={shown.body} className="!mt-0 mb-3" />
                <div className="reading-prose wrap-normal">
                  <BlockEditor
                    namespace="service-reading-body-editor"
                    value={form.body}
                    onChange={(value) => update("body", value)}
                    placeholder="The words of the reading… type '/' for blocks"
                    minHeight={320}
                  />
                </div>
                {form.source.trim() && (
                  <div className="mt-8 border-t border-stone-200 pt-4 text-base italic text-neutral-600 break-words dark:border-neutral-700 dark:text-neutral-400">
                    {form.source}
                  </div>
                )}
              </section>
            </div>
          </main>

          <aside className="space-y-6 min-w-0">
            <Shell>
              <ShellBand icon={Type} title="Short title" />
              <ShellPanel position="bottom" className="p-4">
                <label htmlFor="service_reading_short_title" className={labelClass}>Shorter name</label>
                <div className="relative">
                  <Type className={iconInputClass} />
                  <input
                    id="service_reading_short_title"
                    type="text"
                    placeholder="Shorter reading title"
                    value={form.shortTitle}
                    onChange={(e) => update("shortTitle", e.target.value)}
                    className={`${inputClass} pl-9 max-lg:py-3 max-lg:text-base`}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400 !font-sans !text-left">
                  Shown where space is tight, like a group&apos;s hosting list.
                </p>
              </ShellPanel>
            </Shell>

            <Shell>
              <ShellBand icon={Shapes} title="Icon" />
              <ShellPanel position="bottom" className="p-4">
                <IconPicker value={form.icon} onChange={(icon) => update("icon", icon)} label="Reading icon" />
              </ShellPanel>
            </Shell>

            {isEditing && (
              <a
                href={backUrl}
                className="flex items-center justify-center gap-2 text-sm font-medium !text-slate-600 dark:!text-neutral-400 hover:!text-accent !no-underline"
              >
                <Eye className="w-4 h-4" />
                View this reading without saving
              </a>
            )}
          </aside>
        </div>
      </form>

      {/* Phones: Cancel / Save stay in reach above the bottom bar */}
      <div className="lg:hidden sticky bottom-[calc(var(--shell-bottom,0px)+0.75rem)] z-10 px-4 pb-4">
        <div className="flex items-stretch rounded-panel overflow-hidden shadow-panel bg-white dark:bg-surface-dark divide-x divide-neutral-200 dark:divide-neutral-700">
          <a
            href={backUrl}
            className="flex-1 min-h-12 px-4 py-3 text-sm font-medium !text-slate-900 dark:!text-neutral-300 inline-flex items-center justify-center !no-underline"
          >
            Cancel
          </a>
          {saveButton("flex-1 min-h-12 px-4 py-3")}
        </div>
      </div>
    </div>
  );
}
