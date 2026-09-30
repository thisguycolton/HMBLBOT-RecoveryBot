import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import BlockEditor from "./BlockEditor";
import DateTimePicker from "./ui/DateTimePicker";
import { createDateFromString } from "./ui/DateTimePicker/dateUtils";
import { Shell, ShellPanel, ShellBand } from "./ui/Shell";
import SegmentedControl from "./ui/SegmentedControl";
import { inputClass, labelClass, iconInputClass } from "./ui/styles";
import axios from "axios";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Calendar as CalendarIcon,
  Link as LinkIcon,
  Save,
  Plus,
  Tag,
  User,
  Globe,
  Share2,
  ChevronDown,
  X
} from "lucide-react";


const EMPTY_OBJECT = {};
const EMPTY_ARRAY = [];

function formatDateForInput(date) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Combine meetingDate ("YYYY-MM-DD") + meetingTime ("HH:MM") into a local Date for the picker
function meetingValueToDate({ meetingDate, meetingTime }) {
  if (!meetingDate) return null;
  const date = createDateFromString(meetingDate);
  if (!date) return null;
  if (meetingTime) {
    const [hours, minutes] = meetingTime.split(":").map(Number);
    date.setHours(hours, minutes || 0, 0, 0);
  }
  return date;
}

// Split a picked Date into the values Rails casts natively for the date and time columns
function dateToMeetingFields(date) {
  return {
    meetingDate: formatDateForInput(date),
    meetingTime: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
}

const PUBLISHING_OPTIONS = [
  { value: "draft", label: "Draft", description: "Keep this reading unpublished." },
  { value: "immediate", label: "Now", description: "Make this reading visible to your group right away." },
  { value: "scheduled", label: "Later", description: "Choose a date and time to publish." },
];

// Below Tailwind's `lg` breakpoint the editor is shown as a step-by-step wizard
const WIZARD_MEDIA_QUERY = "(max-width: 1023.98px)";

const WIZARD_STEPS = [
  { label: "Content", title: "Reading Content" },
  { label: "Meeting Info", title: "Meeting Information" },
  { label: "Tags", title: "Tags" },
  { label: "Publishing", title: "Publishing" },
];

// Wizard step that holds each validated field; keys follow the order fields appear on the page
const FIELD_STEPS = {
  title: 0,
  content: 0,
  meetingName: 1,
  meetingUrl: 1,
  meetingDateTime: 1,
  host: 1,
  publishAt: 3,
};

const invalidInputClass = "!border-red-400 focus:!ring-red-500 focus:!border-red-500 dark:!border-red-500/70";

function htmlHasText(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|\u00a0/g, " ")
    .trim().length > 0;
}

function isValidMeetingUrl(value) {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

// Client-side checks run before saving; returns { field: message } for everything that needs fixing
function validateReading(formData, scheduleError) {
  const errors = {};
  if (!formData.title.trim()) errors.title = "Add a title for this reading.";
  if (!htmlHasText(formData.content)) errors.content = "Add the text of the reading.";
  if (!formData.meetingName.trim()) errors.meetingName = "Enter the group name.";
  if (!formData.meetingUrl.trim()) {
    errors.meetingUrl = "Enter the meeting URL.";
  } else if (!isValidMeetingUrl(formData.meetingUrl)) {
    errors.meetingUrl = "Enter a full link, like https://zoom.us/j/123456789.";
  }
  if (!formData.meetingDate || !formData.meetingTime) {
    errors.meetingDateTime = "Pick a meeting date and time, then press ✓.";
  }
  if (!formData.host.trim()) errors.host = "Enter the host's name.";
  if (scheduleError) errors.publishAt = scheduleError;
  return errors;
}

function FieldError({ id, message, className = "" }) {
  if (!message) return null;
  return (
    <p id={id} className={`mt-1.5 text-xs font-medium text-red-600 dark:text-red-400 !font-sans !text-left ${className}`}>
      {message}
    </p>
  );
}

function useIsWizardLayout() {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(WIZARD_MEDIA_QUERY).matches : false
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const query = window.matchMedia(WIZARD_MEDIA_QUERY);
    const handleChange = (e) => setMatches(e.matches);
    setMatches(query.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return matches;
}

// Compact numbered stepper shown under the page title on mobile
function WizardProgress({ current, errorSteps }) {
  return (
    <ol className="mt-5 grid grid-cols-4 lg:hidden" aria-label="Progress">
      {WIZARD_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const hasError = errorSteps?.has(index);
        return (
          <li
            key={step.label}
            aria-current={active ? "step" : undefined}
            className="relative flex flex-col items-center text-center"
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute top-3.5 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                  index <= current ? "bg-accent" : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              />
            )}
            <span
              className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold !font-sans transition-colors ${
                hasError
                  ? active
                    ? "bg-red-50 text-red-600 ring-2 ring-red-500 dark:bg-red-500/20 dark:text-red-300"
                    : "bg-red-50 text-red-600 border border-red-300 dark:bg-red-500/20 dark:border-red-500/60 dark:text-red-300"
                  : done
                  ? "bg-accent text-white"
                  : active
                    ? "bg-accent-tint text-accent-ink ring-2 ring-accent dark:bg-accent/35 dark:text-white"
                    : "bg-white text-slate-400 border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-500"
              }`}
            >
              {hasError ? "!" : done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={`mt-1.5 px-0.5 text-[11px] leading-tight !font-sans ${
                hasError
                  ? `${active ? "font-semibold" : "font-medium"} text-red-600 dark:text-red-400`
                  : active
                  ? "font-semibold text-slate-900 dark:text-white"
                  : done
                    ? "font-medium text-accent-ink dark:text-accent-soft"
                    : "font-medium text-slate-400 dark:text-neutral-500"
              }`}
            >
              <span className="sr-only">
                {hasError ? "Needs attention: " : done ? "Completed: " : active ? "Current: " : ""}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function hasMeaningfulContent(value) {
  if (value == null) return false;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return false;

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return hasMeaningfulContent(parsed);
      } catch {
        return true;
      }
    }

    return true;
  }

  if (Array.isArray(value)) {
    return value.length > 0 && value.some(hasMeaningfulContent);
  }

  if (typeof value === "object") {
    if (value.type === "doc") {
      return Array.isArray(value.content) && value.content.some(hasMeaningfulContent);
    }

    if (value.type === "text") {
      return Boolean(value.text && value.text.trim());
    }

    if (Array.isArray(value.content)) {
      return value.content.some(hasMeaningfulContent);
    }

    return Object.keys(value).length > 0;
  }

  return true;
}

function firstMeaningfulContent(...values) {
  return values.find(hasMeaningfulContent) ?? "";
}

function renderRichContent(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.startsWith("<")) return trimmed;

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return tiptapJsonToHtml(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

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
    case "paragraph": {
      const align = node.attrs?.textAlign ? ` style="text-align:${node.attrs.textAlign}"` : "";
      return `<p${align}>${content}</p>`;
    }
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level || 1), 1), 6);
      const align = node.attrs?.textAlign ? ` style="text-align:${node.attrs.textAlign}"` : "";
      return `<h${level}${align}>${content}</h${level}>`;
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildFormData(reading, currentUser, activeGroup) {
  // Defensive null checks
  if (!reading || typeof reading !== 'object') reading = {};
  if (!currentUser || typeof currentUser !== 'object') currentUser = {};
  if (!activeGroup || typeof activeGroup !== 'object') activeGroup = {};

  // Determine publishing state from published_at (new readings publish immediately)
  let publishingState = "immediate";
  if (reading?.id) {
    if (!reading.published_at) {
      publishingState = "draft";
    } else if (new Date(reading.published_at) > new Date()) {
      publishingState = "scheduled";
    }
  }

  return {
    meetingName: reading?.meetingName || activeGroup?.title || "",
    meetingUrl: reading?.meetingUrl || activeGroup?.meetingLink || "",
    meetingDate: formatDateForInput(reading?.meetingDate) || "",
    meetingTime: /^\d{2}:\d{2}/.test(reading?.meetingTime || "") ? reading.meetingTime.slice(0, 5) : "",
    host: reading?.host || currentUser?.name || "",
    title: reading?.title || "",
    source: reading?.source || "",
    topic: renderRichContent(
      firstMeaningfulContent(
        reading?.topic_html,
        reading?.topicHtml,
        reading?.topic
      )
    ),
    content: renderRichContent(
      firstMeaningfulContent(
        reading?.content_html,
        reading?.contentHtml,
        reading?.content,
        reading?.richer_content_html,
        reading?.richerContentHtml,
        reading?.richer_content,
        reading?.richerContent
      )
    ),
    richerContent: reading?.richerContent || "",
    userId: currentUser?.id || "",
    groupId: reading?.group_id || activeGroup?.id || "",
    tagIds: Array.isArray(reading?.tag_ids) ? reading.tag_ids.map(Number) : [],
    publishingState,
  };
}

// Single-line-feeling textarea that grows to fit long titles (Enter is ignored)
function AutoGrowTextarea({ value, className = "", ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      className={`block w-full resize-none overflow-hidden ${className}`}
      {...props}
    />
  );
}

export default function ReadingForm({
  reading = EMPTY_OBJECT,
  currentUser = EMPTY_OBJECT,
  polls = EMPTY_ARRAY,
  topicsById = EMPTY_OBJECT,
  tags = EMPTY_ARRAY,
  onSubmit,
  submitting = false,
  errors = EMPTY_ARRAY,
}) {

const safeReading = reading || EMPTY_OBJECT;
const safeCurrentUser = currentUser || EMPTY_OBJECT;
const activeGroup = safeCurrentUser?.user_active_group?.group || EMPTY_OBJECT;

const [localErrors, setLocalErrors] = useState(errors || []);
const hydratedReadingIdRef = useRef(reading?.id ?? "new");

const [formData, setFormData] = useState(() =>
  buildFormData(reading, currentUser, activeGroup)
);

useEffect(() => {
  const nextId = safeReading?.id ?? "new";
  if (hydratedReadingIdRef.current === nextId) return;

  setFormData(buildFormData(safeReading, safeCurrentUser, activeGroup));
  hydratedReadingIdRef.current = nextId;
}, [safeReading?.id]);

  const [wasValidated, setWasValidated] = useState(false);

  const isAdminUser = currentUser?.id === 1;

  // Scheduled publish time; only meaningful for an existing reading with a future published_at
  const [scheduleAt, setScheduleAt] = useState(() => {
    if (!reading?.id || !reading?.published_at) return null;
    const publishedAt = new Date(reading.published_at);
    return publishedAt > new Date() ? publishedAt : null;
  });

  // Mobile wizard: which step is visible, and where to go after a successful save
  const isWizard = useIsWizardLayout();
  const [step, setStep] = useState(0);
  const [savedUrl, setSavedUrl] = useState(null);
  const lastStep = WIZARD_STEPS.length - 1;

  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (isWizard) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, savedUrl]);

  // After a blocked save, bring the first invalid field into view once its step is showing
  const [focusField, setFocusField] = useState(null);
  useEffect(() => {
    if (!focusField) return undefined;
    const frame = requestAnimationFrame(() => {
      const target = document
        .querySelector(`[data-field="${focusField}"]`)
        ?.querySelector("textarea, input, [contenteditable='true'], button");
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      target?.focus({ preventScroll: true });
      setFocusField(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusField]);

  const [availableTags, setAvailableTags] = useState(tags || []);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // Handlers for publishing controls
  function handlePublishingStateChange(value) {
    setFormData((prev) => ({ ...prev, publishingState: value }));
    // Reset schedule when not in scheduled mode
    if (value !== "scheduled") setScheduleAt(null);
  }

function toggleTag(tagId) {
  setFormData((prev) => {
    const exists = prev.tagIds.includes(tagId);
    return {
      ...prev,
      tagIds: exists
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    };
  });
}
useEffect(() => {
  setAvailableTags(tags || []);
}, [tags]);





  useEffect(() => {
    setLocalErrors(errors || []);
}, [errors]);

  // Calculate published_at based on publishing state for submission
  function calculatePublishedAt() {
    if (formData.publishingState === "draft") {
      return null;
    }

    if (formData.publishingState === "immediate") {
      // Keep the original publish date when re-saving an already-published reading
      const existing = reading?.published_at ? new Date(reading.published_at) : null;
      return existing && existing <= new Date() ? existing.toISOString() : new Date().toISOString();
    }

    if (formData.publishingState === "scheduled") {
      return scheduleAt ? scheduleAt.toISOString() : null;
    }

    return null;
  }

async function handleCreateTag() {
  const title = newTagName.trim();
  if (!title) return;

  try {
    setCreatingTag(true);

    const csrf =
      document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

    const response = await axios.post(
      "/tags",
      { tag: { title } },
      {
        headers: {
          "X-CSRF-Token": csrf,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );

    const createdTag = response.data;

    setAvailableTags((prev) => [...prev, createdTag]);
    setFormData((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(Number(createdTag.id))
        ? prev.tagIds
        : [...prev.tagIds, Number(createdTag.id)],
    }));
    setNewTagName("");
  } catch (error) {
    console.error("Failed to create tag", error);
  } finally {
    setCreatingTag(false);
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  // In the wizard, only the last step saves; Enter on earlier steps just moves forward
  if (isWizard && step < lastStep) {
    setStep((s) => Math.min(s + 1, lastStep));
    return;
  }

  setWasValidated(true);

  // Don't save until everything passes; send the user to the first problem
  const firstInvalid = Object.keys(fieldErrors)[0];
  if (firstInvalid) {
    if (isWizard) setStep(FIELD_STEPS[firstInvalid]);
    setFocusField(firstInvalid);
    return;
  }

  try {
    const csrf =
      document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

    const publishedAt = calculatePublishedAt();
 
    const payload = {
      reading: {
        meetingName: formData.meetingName,
        meetingUrl: formData.meetingUrl,
        meetingDate: formData.meetingDate,
        meetingTime: formData.meetingTime,
        host: formData.host,
        title: formData.title,
        source: formData.source,
        content: formData.content,
        topic: formData.topic,
        tag_ids: formData.tagIds,
        published_at: publishedAt,
        ...(formData.groupId ? { group_id: formData.groupId } : {}),
      },
    };

    const isEdit = !!reading?.id;
    const url = isEdit ? `/readings/${reading.id}` : "/readings";
    const method = isEdit ? "patch" : "post";

    const response = await axios({
      method,
      url,
      data: payload,
      headers: {
        "X-CSRF-Token": csrf,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      withCredentials: true,
      
    } );

    const destination =
      response?.data?.redirect_url ||
      (isEdit ? `/readings/${reading.id}` : response?.data?.id ? `/readings/${response.data.id}` : null);

    // On mobile, show the completion screen; "Done" continues to the same destination
    if (isWizard) {
      setSavedUrl(destination || window.location.href);
      return;
    }

    if (destination) {
      window.location.href = destination;
    } else {
      window.location.reload();
    }
  } catch (error) {
    console.error("Failed to save reading", error);

    const serverErrors =
      error?.response?.data?.errors ||
      error?.response?.data?.error ||
      ["Something went wrong while saving."];

    setLocalErrors(Array.isArray(serverErrors) ? serverErrors : [serverErrors]);
    if (isWizard) window.scrollTo({ top: 0, behavior: "smooth" });
  }
}


  // "Later" needs a confirmed time in the future, otherwise it would save as a draft or publish now
  const scheduleError =
    formData.publishingState !== "scheduled"
      ? null
      : !scheduleAt
        ? "Pick a publish date and time, then press ✓."
        : scheduleAt <= new Date()
          ? "Pick a time in the future, or choose Now."
          : null;

  const fieldErrors = validateReading(formData, scheduleError);
  const shownErrors = wasValidated ? fieldErrors : EMPTY_OBJECT;
  const errorSteps = new Set(Object.keys(shownErrors).map((field) => FIELD_STEPS[field]));

  // Determine if this is an edit or new reading for dynamic UI
  const isEditing = !!reading?.id;

  const activePublishingOption =
    PUBLISHING_OPTIONS.find((option) => option.value === formData.publishingState) || PUBLISHING_OPTIONS[1];

  return (
    <>
      {/* Page Header */}
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 pt-20 pb-5 lg:pb-15 w-full mt-6">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center text-sm text-slate-500 dark:text-neutral-400 mb-3">
            <a href="/readings" className="hover:text-accent transition-colors">Readings</a>
            <ChevronDown className="w-4 h-4 mx-2 text-slate-400 -rotate-90" />
            <span className="text-slate-900 dark:text-white font-medium">{isEditing ? "Edit Reading" : "Create"}</span>
          </nav>

          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-accent-tint dark:bg-accent/30 shadow-panel flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-accent dark:text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl max-lg:!text-2xl max-lg:!leading-tight font-semibold text-slate-900 dark:text-white !font-sans">
                  {isEditing ? "Edit Reading" : "Create a New Reading"}
                </h1>
                <p className="text-sm text-slate-600 dark:text-neutral-400 mt-0.5 !font-sans max-lg:!text-left">
                  {isEditing
                    ? "Update the reading content and meeting details."
                    : "Add a meeting reading, set the details, and share it with your group."}
                </p>
              </div>
            </div>
            <div className="max-lg:hidden flex items-stretch rounded-panel overflow-hidden shadow-panel bg-white dark:bg-surface-dark divide-x divide-neutral-200 dark:divide-neutral-700">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-5 py-3 text-sm font-medium text-slate-900 dark:text-neutral-300 hover:bg-accent/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="reading-form"
                disabled={submitting}
                className="px-5 py-3 bg-accent hover:opacity-90 disabled:opacity-60 text-white text-sm font-semibold transition-opacity flex items-center gap-2"
              >
                <Save className="w-4 h-4" strokeWidth={2.5} />
                {submitting ? "Saving..." : "Save Reading"}
              </button>
            </div>
          </div>

          <WizardProgress current={savedUrl ? WIZARD_STEPS.length : step} errorSteps={savedUrl ? null : errorSteps} />
        </div>
      </header>

      {/* Error Alert */}
      {localErrors.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-panel shadow-panel flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {localErrors.length} error{localErrors.length === 1 ? "" : "s"} prohibited this reading from being saved:
              </p>
              <ul className="mt-2 space-y-1">
                {localErrors.map((error, i) => (
                  <li key={i} className="text-sm text-red-700 dark:text-red-300">{error}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setLocalErrors([])}
              className="text-red-400 hover:text-red-600 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {savedUrl && (
        <div className="bg-slate-50 dark:bg-neutral-950 px-4 py-10 min-h-[60vh]">
          <Shell className="max-w-md mx-auto">
            <ShellPanel className="px-6 py-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-accent-tint dark:bg-accent/30 shadow-panel flex items-center justify-center">
                <Check className="w-8 h-8 text-accent dark:text-white" strokeWidth={3} />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white !font-sans">Reading Saved</h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-neutral-400 !font-sans !text-center">
                Your reading has been saved successfully.
              </p>
            </ShellPanel>
            <a
              href={savedUrl}
              className="block w-full rounded-panel shadow-panel bg-accent hover:opacity-90 text-white text-base font-semibold text-center py-3.5 transition-opacity"
            >
              Done
            </a>
          </Shell>
        </div>
      )}

      <form
        hidden={Boolean(savedUrl)}
        id="reading-form"
        className={`needs-validation ${wasValidated ? "was-validated" : ""}`}
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="bg-slate-50 dark:bg-neutral-950 px-4 min-[1400px]:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            {/* Mobile wizard step heading */}
            <div className="lg:hidden mb-4 px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent dark:text-accent-soft !font-sans">
                Step {step + 1} of {WIZARD_STEPS.length}
              </p>
              {step === 0 && (
                <h2 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-white !font-sans">
                  {WIZARD_STEPS[0].title}
                </h2>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">

            {/* Editable preview - mirrors the ReadingShow page */}
            <main className={`min-w-0 ${step === 0 ? "" : "max-lg:hidden"}`}>
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
                {/* Reading */}
                <section className="bg-stone-100 dark:bg-neutral-900 text-slate-900 dark:text-neutral-100 px-5 py-8 md:px-14 md:py-14">
                  <figure>
                    <div data-field="title" className="mb-6">
                      <AutoGrowTextarea
                        id="reading_title"
                        aria-label="Reading title"
                        placeholder="Reading title"
                        required
                        aria-invalid={Boolean(shownErrors.title)}
                        aria-describedby={shownErrors.title ? "reading_title_error" : undefined}
                        value={formData.title}
                        onChange={(e) => updateField("title", e.target.value)}
                        className="border-0 bg-transparent p-0 text-3xl font-bold uppercase tracking-widest md:text-5xl ttSans placeholder:text-slate-400/70 focus:outline-none focus:ring-0"
                      />
                      <FieldError id="reading_title_error" message={shownErrors.title} className="!text-sm mt-2" />
                    </div>

                    <div data-field="content">
                      <FieldError message={shownErrors.content} className="!text-sm !mt-0 mb-3" />
                      <blockquote className="reading-prose wrap-normal">
                        <BlockEditor
                          namespace="reading-content-editor"
                          value={formData.content}
                          onChange={(value) => updateField("content", value)}
                          placeholder="Start the reading… type '/' for blocks"
                          minHeight={240}
                        />
                      </blockquote>
                    </div>

                    <figcaption className="mt-6">
                      <input
                        id="reading_source"
                        type="text"
                        aria-label="Source"
                        placeholder="Source (optional): book, chapter, page, link…"
                        value={formData.source}
                        onChange={(e) => updateField("source", e.target.value)}
                        className="w-full border-0 bg-transparent p-0 text-xl italic text-neutral-600 dark:text-neutral-300 md:text-2xl placeholder:text-neutral-400 focus:outline-none focus:ring-0"
                      />
                    </figcaption>
                  </figure>
                </section>

                {/* Example topics */}
                <section className="bg-sky-900 text-white px-5 py-12 md:px-10 md:py-16">
                  <h2 className="text-center text-3xl font-bold uppercase md:text-5xl">
                    Example Topics For Sharing
                  </h2>
                  <h3 className="mt-2 text-center text-xl italic text-neutral-300 md:text-2xl">
                    Feel free to check in!
                  </h3>

                  <div className="mt-8 rounded-[2rem] bg-white px-6 py-8 text-neutral-800 shadow-sm dark:bg-cyan-600 dark:text-neutral-100 md:px-14 md:py-10">
                    <BlockEditor
                      namespace="reading-topic-editor"
                      value={formData.topic}
                      onChange={(value) => updateField("topic", value)}
                      placeholder="Add example topics… try '- ' for a list"
                      className="reading-topics text-lg md:text-xl"
                      placeholderClassName="text-lg md:text-xl"
                      minHeight={120}
                    />
                  </div>
                </section>
              </div>
            </main>

            {/* Right Sidebar */}
            <aside className="space-y-6">

              {/* Meeting Information Card */}
              <Shell className={step === 1 ? "" : "max-lg:hidden"}>
                <ShellBand icon={CalendarIcon} title="Meeting Information" />

                <ShellPanel position="bottom" className="p-4 space-y-4 max-lg:p-5 max-lg:space-y-5">
                  {/* Group Name */}
                  <div data-field="meetingName">
                    <label htmlFor="meeting_name" className={labelClass}>
                      Group Name *
                    </label>
                    <div className="relative">
                      <Globe className={iconInputClass} />
                      <input
                        id="meeting_name"
                        aria-invalid={Boolean(shownErrors.meetingName)}
                        aria-describedby={shownErrors.meetingName ? "meeting_name_error" : undefined}
                        type="text"
                        className={`${inputClass} pl-9 max-lg:py-3 max-lg:text-base ${shownErrors.meetingName ? invalidInputClass : ""}`}
                        required
                        value={formData.meetingName}
                        onChange={(e) => updateField("meetingName", e.target.value)}
                      />
                    </div>
                    <FieldError id="meeting_name_error" message={shownErrors.meetingName} />
                  </div>

                  {/* Meeting URL */}
                  <div data-field="meetingUrl">
                    <label htmlFor="meeting_url" className={labelClass}>
                      Meeting URL *
                    </label>
                    <div className="relative">
                      <LinkIcon className={iconInputClass} />
                      <input
                        id="meeting_url"
                        aria-invalid={Boolean(shownErrors.meetingUrl)}
                        aria-describedby={shownErrors.meetingUrl ? "meeting_url_error" : undefined}
                        type="url"
                        className={`${inputClass} pl-9 max-lg:py-3 max-lg:text-base ${shownErrors.meetingUrl ? invalidInputClass : ""}`}
                        required
                        value={formData.meetingUrl}
                        onChange={(e) => updateField("meetingUrl", e.target.value)}
                      />
                    </div>
                    <FieldError id="meeting_url_error" message={shownErrors.meetingUrl} />
                  </div>

                  {/* Meeting Date & Time */}
                  <div data-field="meetingDateTime">
                    <label className={labelClass}>
                      Date &amp; Time of Meeting *
                    </label>
                    <DateTimePicker
                      pickerType="date-time"
                      pickerDefault="today"
                      value={meetingValueToDate(formData)}
                      invalid={Boolean(shownErrors.meetingDateTime)}
                      onChange={(date) => {
                        if (!date) return;
                        setFormData((prev) => ({ ...prev, ...dateToMeetingFields(date) }));
                      }}
                    />
                    <FieldError message={shownErrors.meetingDateTime} />
                  </div>

                  {/* Host */}
                  <div data-field="host">
                    <label htmlFor="host" className={labelClass}>
                      Host *
                    </label>
                    <div className="relative">
                      <User className={iconInputClass} />
                      <input
                        id="host"
                        aria-invalid={Boolean(shownErrors.host)}
                        aria-describedby={shownErrors.host ? "host_error" : undefined}
                        type="text"
                        className={`${inputClass} pl-9 max-lg:py-3 max-lg:text-base ${shownErrors.host ? invalidInputClass : ""}`}
                        required
                        value={formData.host}
                        onChange={(e) => updateField("host", e.target.value)}
                      />
                    </div>
                    <FieldError id="host_error" message={shownErrors.host} />
                  </div>
                </ShellPanel>
              </Shell>

              {/* Tags Card */}
              <Shell className={step === 2 ? "" : "max-lg:hidden"}>
                <ShellBand icon={Tag} title="Tags" />

                <ShellPanel position="bottom" className="p-4 max-lg:p-5">
                  <div className="flex flex-wrap gap-1.5 max-lg:gap-2">
                    {availableTags.map((tag) => {
                      const selected = formData.tagIds.includes(Number(tag.id));
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(Number(tag.id))}
                          aria-pressed={selected}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 max-lg:px-3.5 max-lg:py-2 max-lg:text-sm rounded-full text-xs transition-colors ${
                            selected
                              ? "bg-accent-tint text-accent-ink font-semibold dark:bg-accent/35 dark:text-white"
                              : "bg-white dark:bg-neutral-900 font-medium text-slate-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 hover:bg-accent/5 dark:hover:bg-white/5"
                          }`}
                        >
                          {selected && <span className="w-1.5 h-1.5 rounded-full bg-accent dark:bg-white" aria-hidden="true" />}
                          {tag.title}
                          {!selected && <Plus className="w-3 h-3 text-slate-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {isAdminUser && (
                    <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-stretch rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 focus-within:ring-2 focus-within:ring-accent">
                        <input
                          type="text"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="Add new tag (admin only)"
                          className="flex-1 min-w-0 px-3 py-2 max-lg:py-3 text-sm max-lg:text-base bg-white dark:bg-neutral-900 text-slate-800 dark:text-white placeholder-slate-400 border-0 focus:outline-none focus:ring-0"
                        />
                        <button
                          type="button"
                          onClick={handleCreateTag}
                          disabled={creatingTag || !newTagName.trim()}
                          className="shrink-0 px-4 text-sm font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-opacity"
                        >
                          {creatingTag ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </div>
                  )}
                </ShellPanel>
              </Shell>

              {/* Publishing Card */}
              <Shell className={step === 3 ? "" : "max-lg:hidden"}>
                <ShellBand icon={Share2} title="Publishing" />

                <ShellPanel position="middle">
                  <SegmentedControl
                    options={PUBLISHING_OPTIONS}
                    value={formData.publishingState}
                    onChange={handlePublishingStateChange}
                  />
                </ShellPanel>

                <ShellPanel position="bottom" className="p-4 space-y-3 max-lg:p-5">
                  <p className="text-sm text-slate-600 dark:text-neutral-400 !font-sans">
                    {activePublishingOption.description}
                  </p>

                  {formData.publishingState === "scheduled" && (
                    <div data-field="publishAt">
                      <label className={labelClass}>Publish On</label>
                      <DateTimePicker
                        pickerType="date-time"
                        pickerDefault="tomorrow"
                        value={scheduleAt}
                        invalid={Boolean(shownErrors.publishAt)}
                        onChange={(date) => setScheduleAt(date)}
                      />
                      <FieldError message={shownErrors.publishAt} />
                    </div>
                  )}
                </ShellPanel>
              </Shell>

            </aside>
          </div>
          </div>
        </div>

        {/* Mobile wizard navigation */}
        <div className="lg:hidden w-full fixed bottom-0 z-20 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-slate-50/90 dark:bg-neutral-950/90 backdrop-blur border-t border-neutral-200/70 dark:border-neutral-800">
          <div className="max-w-7xl mx-auto flex items-stretch rounded-panel overflow-hidden shadow-panel bg-white dark:bg-surface-dark divide-x divide-neutral-200 dark:divide-neutral-700">
            <button
              type="button"
              onClick={() => (step === 0 ? window.history.back() : setStep((s) => s - 1))}
              className="flex-1 min-h-12 px-4 py-3 text-sm font-medium text-slate-900 dark:text-neutral-300 hover:bg-accent/5 dark:hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2"
            >
              {step === 0 ? (
                "Cancel"
              ) : (
                <>
                  <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
                  Back
                </>
              )}
            </button>
            {step < lastStep ? (
              <button
                key="next"
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 min-h-12 px-4 py-3 bg-accent hover:opacity-90 text-white text-sm font-semibold transition-opacity inline-flex items-center justify-center gap-2"
              >
                Next
                <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </button>
            ) : (
              <button
                key="save"
                type="submit"
                disabled={submitting}
                className="flex-1 min-h-12 px-4 py-3 bg-accent hover:opacity-90 disabled:opacity-60 text-white text-sm font-semibold transition-opacity inline-flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" strokeWidth={2.5} />
                {submitting ? "Saving..." : "Save Reading"}
              </button>
            )}
          </div>
        </div>

        {/* Hidden inputs for form data */}
        <input type="hidden" name="reading[meetingName]" value={formData.meetingName} />
        <input type="hidden" name="reading[meetingUrl]" value={formData.meetingUrl} />
        <input type="hidden" name="reading[meetingDate]" value={formData.meetingDate} />
        <input type="hidden" name="reading[meetingTime]" value={formData.meetingTime} />
        <input type="hidden" name="reading[host]" value={formData.host} />
        <input type="hidden" name="reading[title]" value={formData.title} />
        <input type="hidden" name="reading[source]" value={formData.source} />
        <input type="hidden" name="reading[content]" value={formData.content} />
        <input type="hidden" name="reading[topic]" value={formData.topic} />
        <input type="hidden" name="reading[user_id]" value={formData.userId} />
        <input type="hidden" name="reading[group_id]" value={formData.groupId} />
      </form>
    </>
  );
}
