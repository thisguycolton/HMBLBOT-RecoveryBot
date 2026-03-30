import React, { useEffect, useRef, useState } from "react";
import Calendar from "react-calendar";
import LexicalEditor from "./LexicalEditor";
import { Minus, Sun } from "lucide-react";
import "react-calendar/dist/Calendar.css";
import axios from "axios";


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

function extractTimeParts(reading = {}) {
  if (reading?.hour || reading?.minute || reading?.meridiem) {
    return {
      hour: String(reading?.hour || ""),
      minute: String(reading?.minute || ""),
      meridiem: String(reading?.meridiem || ""),
    };
  }

  if (reading?.meetingTime && /^\d{2}:\d{2}(:\d{2})?$/.test(String(reading.meetingTime))) {
    const raw = String(reading.meetingTime);
    const parts = raw.split(":");
    const hour24 = Number(parts[0]);
    const minute = parts[1] || "";

    if (!Number.isNaN(hour24)) {
      const meridiem = hour24 >= 12 ? "PM" : "AM";
      let hour12 = hour24 % 12;
      if (hour12 === 0) hour12 = 12;

      return {
        hour: String(hour12),
        minute: String(minute).padStart(2, "0"),
        meridiem,
      };
    }
  }

  return {
    hour: "",
    minute: "",
    meridiem: "",
  };
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

function buildFormData(reading = {}, currentUser = {}, activeGroup = {}) {
  const timeParts = extractTimeParts(reading);

  return {
    meetingName: reading?.meetingName || activeGroup?.title || "",
    meetingUrl: reading?.meetingUrl || activeGroup?.meetingLink || "",
    meetingDate: formatDateForInput(reading?.meetingDate) || "",
    hour: timeParts.hour,
    minute: timeParts.minute,
    meridiem: timeParts.meridiem,
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
    pollId: reading?.poll_id || reading?.pollId || "",
    tagIds: Array.isArray(reading?.tag_ids) ? reading.tag_ids.map(Number) : [],
  };
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
  const minuteOptions = ["00", "15", "30", "45"];
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const [calendarOpen, setCalendarOpen] = useState(false);

  const [availableTags, setAvailableTags] = useState(tags || []);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
  const nextId = reading?.id ?? "new";
  if (hydratedReadingIdRef.current === nextId) return;

  setFormData(buildFormData(reading, currentUser, activeGroup));
  hydratedReadingIdRef.current = nextId;
}, [reading?.id]);

useEffect(() => {
  console.log("ReadingForm reading prop:", reading);
  console.log("ReadingForm currentUser prop:", currentUser);
}, [reading, currentUser]);

useEffect(() => {
  setLocalErrors(errors || []);
}, [errors]);

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
  setWasValidated(true);

  const form = e.currentTarget;
  if (!form.checkValidity()) return;

  try {
    const csrf =
      document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

    const payload = {
  reading: {
    meetingName: formData.meetingName,
    meetingUrl: formData.meetingUrl,
    meetingDate: formData.meetingDate,
    hour: formData.hour,
    minute: formData.minute,
    meridiem: formData.meridiem,
    host: formData.host,
    title: formData.title,
    source: formData.source,
    content: formData.content,
    topic: formData.topic,
    tag_ids: formData.tagIds,
    ...(formData.groupId ? { group_id: formData.groupId } : {}),
    ...(formData.pollId ? { poll_id: formData.pollId } : {}),
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

    if (response?.data?.redirect_url) {
      window.location.href = response.data.redirect_url;
      return;
    }

    if (isEdit) {
      window.location.href = `/readings/${reading.id}`;
    } else if (response?.data?.id) {
      window.location.href = `/readings/${response.data.id}`;
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
  }
}

  return (
    <>
      <style>{`
        #reading_title {
          font-family: "Montserrat", sans-serif !important;
          font-size: 40px !important;
          font-weight: 700;
        }

        #reading_source {
          font-family: "Montserrat", sans-serif !important;
          font-size: 20px !important;
          font-style: italic;
        }

        #reading_topic {
          font-family: "Montserrat", sans-serif !important;
          font-size: 20px !important;
        }
          .ProseMirror,
        .editor-input {
          direction: ltr;
          text-align: left;
        }
        #reading-editor-root{
          top:0px;
          position:absolute;
        }
      `}</style>

      <form
        className={`needs-validation ${wasValidated ? "was-validated" : ""}`}
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="md:flex h-100 gx-0 pt-14 justify-center w-screen">
          <div className="w-100  md:w-100  flex-none">
            <div
              className="md:fixed form-side-panel w-screen md:w-100 md:h-screen bg-teal-300 dark:bg-teal-700 dark:text-light text-dark overflow-y-hidden"
              style={{ marginTop: "" }}
            >
              <div className="col-md-8 col-lg-12 offset-md-2 offset-lg-0 px-2">
                <div className="details-cont bg-jumbo-blue-light p-3">
                  {localErrors.length > 0 && (
                    <div style={{ color: "red" }}>
                      <h2>
                        {errors.length} error{errors.length === 1 ? "" : "s"} prohibited
                        this reading from being saved:
                      </h2>
                      <ul>
                        {localErrors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2 mb-3 ">
                    <label htmlFor="meetingNameInput" className="col-span-full text-lg font-bold">
                      Group Name:
                    </label>
                    <input
                      id="meetingNameInput"
                      className="col-span-full border-2 border-teal-500 rounded h-10 bg-teal-200 dark:bg-teal-900 text-dark dark:text-light px-2 hover:bg-teal-400!  dark:hover:bg-teal-800! focus:outline-2! focus:outline-offset-2 focus:outline-teal-500"
                      required
                      value={formData.meetingName}
                      onChange={(e) => updateField("meetingName", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 mb-3">
                    <label htmlFor="meetingURLInput" className="col-span-full text-lg font-bold">
                      Meeting URL:
                    </label>
                    <input
                      id="meetingURLInput"
                      className="col-span-full border-2 border-teal-500 rounded h-10 bg-teal-200 dark:bg-teal-900 text-dark dark:text-light px-2 hover:bg-teal-400!  dark:hover:bg-teal-800!  focus:outline-2! focus:outline-offset-2 focus:outline-teal-500"
                      required
                      value={formData.meetingUrl}
                      onChange={(e) => updateField("meetingUrl", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 mb-3 ">
                    <label htmlFor="meetingDateInput" className="col-span-full text-lg font-bold">
                      Date of Meeting:
                    </label>

                    <button
                      type="button"
                      id="meetingDateInput"
                      className="text-start d-flex justify-content-between col-span-full border-2 border-teal-500 rounded h-10 bg-teal-200 dark:bg-teal-900 text-dark dark:text-light px-2 hover:bg-teal-400!  dark:hover:bg-teal-800! focus:outline-2! focus:outline-offset-2 focus:outline-teal-500"
                      onClick={() => setCalendarOpen((v) => !v)}
                    >
                      <span>
                        {formData.meetingDate
                          ? formData.meetingDate
                          : "Select meeting date"}
                      </span>
                      <i className="bi bi-calendar-event" />
                    </button>

                    {calendarOpen && (
                      <div
                        className="position-absolute bg-white shadow rounded p-2 mt-2"
                        style={{ zIndex: 1000 }}
                      >
                        <Calendar
                          value={formData.meetingDate ? new Date(formData.meetingDate) : new Date()}
                          onChange={(value) => {
                            updateField("meetingDate", formatDateForInput(value));
                            setCalendarOpen(false);
                          }}
                        />
                      </div>
                    )}

                    <input
                      type="hidden"
                      name="reading[meetingDate]"
                      value={formData.meetingDate}
                      required
                    />
                  </div>

                  <div className=" mb-3 ">
                    <label htmlFor="meetingTimeInput" className="text-lg font-bold block mb-2">
                      Time of Meeting:
                    </label>
                    <div className="timepicker grid grid-cols-4 gap-0 input-group">
                      <select
                        className="hour col-span-1 border-2 border-teal-500 rounded-s h-10 bg-teal-200 dark:bg-teal-900 text-dark dark:text-light px-2 hover:bg-teal-400!  dark:hover:bg-teal-800!  focus:outline-2! focus:outline-offset-2 focus:outline-teal-500"
                        value={formData.hour}
                        onChange={(e) => updateField("hour", e.target.value)}
                      >
                        <option value="">HH</option>
                        {hourOptions.map((hour) => (
                          <option key={hour} value={hour}>
                            {hour}
                          </option>
                        ))}
                      </select>

                      <span className="colon col-span-1 border-2 border-teal-500  h-10 bg-teal-200 dark:bg-teal-400 text-dark dark:text-light p-1 text-center input-group-text fw-bold">:</span>

                      <select
                        className="minute col-span-1 border-2 border-teal-500  h-10 bg-teal-200 dark:bg-teal-900 text-dark dark:text-light px-2 hover:bg-teal-400!  dark:hover:bg-teal-800!  focus:outline-2! focus:outline-offset-2 focus:outline-teal-500"
                        value={formData.minute}
                        onChange={(e) => updateField("minute", e.target.value)}
                      >
                        <option value="">MM</option>
                        {minuteOptions.map((minute) => (
                          <option key={minute} value={minute}>
                            {minute}
                          </option>
                        ))}
                      </select>

                      <select
                        className="meridiem col-span-1 border-2 border-teal-500 rounded-e h-10 bg-teal-200 dark:bg-teal-900 text-dark dark:text-light px-2 hover:bg-teal-400!  dark:hover:bg-teal-800!  focus:outline-2! focus:outline-offset-2 focus:outline-teal-500"
                        required
                        value={formData.meridiem}
                        onChange={(e) => updateField("meridiem", e.target.value)}
                      >
                        <option value=""><Sun/></option>
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>

                      <span className="input-group-text px-3">
                        <i className="bi bi-clock" />
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 mb-3">
                    <label htmlFor="hostInput" className="text-lg font-bold col-span-full">
                      Host:
                    </label>
                    <input
                      id="hostInput"
                      className="col-span-1 border-2 border-teal-500 rounded h-10 bg-teal-200 dark:bg-teal-900 text-dark dark:text-light px-2 hover:bg-teal-400!  dark:hover:bg-teal-800!  focus:outline-2! focus:outline-offset-2 focus:outline-teal-500"
                      required
                      value={formData.host}
                      onChange={(e) => updateField("host", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 mb-3">
  <label className="col-span-full text-lg font-bold">
    Tags:
  </label>

  <div className="flex flex-wrap gap-2">
    {availableTags.map((tag) => {
      const selected = formData.tagIds.includes(Number(tag.id));

      return (
        <button
          key={tag.id}
          type="button"
          onClick={() => toggleTag(Number(tag.id))}
          className={
            selected
              ? "rounded-full border-2 border-neutral-900 bg-neutral-900 text-white px-3 py-1 text-sm"
              : "rounded-full border-2 border-neutral-400 bg-white dark:bg-neutral-800 dark:text-white px-3 py-1 text-sm"
          }
        >
          {tag.title}
        </button>
      );
    })}
  </div>

  {isAdminUser && (
    <div className="flex gap-2 mt-2">
      <input
        type="text"
        value={newTagName}
        onChange={(e) => setNewTagName(e.target.value)}
        placeholder="Add new tag"
        className="border-2 border-neutral-900 rounded h-10 border-teal-500 rounded h-10 bg-teal-300 dark:bg-teal-900 text-dark dark:text-light px-2 w-full focus:border-teal-500 focus:outline-2 focus:outline-offset-2 focus:outline-teal-500"
      />
      <button
        type="button"
        onClick={handleCreateTag}
        disabled={creatingTag || !newTagName.trim()}
        className="border-2 border-neutral-900 rounded h-10 px-4 bg-neutral-900 text-white"
      >
        {creatingTag ? "Adding..." : "Add"}
      </button>
    </div>
  )}
</div>


                  <div className="mb-0">
                    <button
                      type="submit"
                      className="col-span-1 border-2 border-neutral-300 rounded w-full h-10 bg-neutral-200 dark:bg-neutral-900 text-dark dark:text-light px-2 hover:bg-neutral-300!  dark:hover:bg-neutral-800!  focus:outline-2! focus:outline-offset-2 focus:outline-neutral-900"
                      disabled={submitting}
                    >
                      <i className="bi bi-floppy fs-4 pe-3 align-baseline" />
                      <span className="align-text-bottom ps-2 fw-normal tracking-widest">
                        {submitting ? "SAVING..." : "SAVE READING"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="width-screen md:w-fill relative left-0 md:flex-auto p-5">
            <div className="reading-content-editor overflow-y-scroll">
              <div className=" mt-2">
                <div className="editor-cont border border-0 mb-3">
                  <div className="mb-2">
                    <input
                      id="reading_title"
                      className="ms-1 ps-4 border-2 border-neutral-300 rounded-xl w-full h-15 bg-neutral-200 dark:bg-neutral-800 text-dark dark:text-light px-2 hover:bg-neutral-300!  dark:hover:bg-neutral-800! focus:outline-2! focus:outline-offset-2 focus:outline-neutral-300"
                      placeholder="Reading Title"
                      required
                      value={formData.title}
                      onChange={(e) => updateField("title", e.target.value)}
                    />
                  </div>

                  <div className="reading-container container-fluid p-0 ps-1 shadow-sm pb-5 position-relative">
                    <LexicalEditor
                      namespace="reading-content-editor"
                      value={formData.content}
                      onChange={(value) => updateField("content", value)}
                      placeholder="Reading content..."
                      minHeight={320}
                    />

                    <div className="flex flex-row  mt-3">
                      <div className="w-10 fw-bold px-2 dark:text-neutral-500 pt-3"><Minus/></div>
                      <input
                        id="reading_source"
                        className=" w-fill border border-2 border-neutral-300 rounded-xl w-full h-13 bg-neutral-200 dark:bg-neutral-800 text-dark dark:text-light px-2 hover:bg-neutral-300!  dark:hover:bg-neutral-800! focus:outline-2! focus:outline-offset-2 focus:outline-neutral-300"
                        placeholder="Source of reading"
                        value={formData.source}
                        onChange={(e) => updateField("source", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="my-3">
                  <h2 className="text-center display-5 pb-3 fw-bold dark:text-light text-dark text-uppercase text-4xl noto font-weight-900 ">
                    Example Topics For Sharing
                  </h2>
                  <h3 className="mb-2 text-body-secondary text-center fs-3 tracking-widest text-2xl mb-2">
                    <em>Feel free to check in!</em>
                  </h3>

                  <LexicalEditor
                    namespace="reading-topic-editor"
                    value={formData.topic}
                    onChange={(value) => updateField("topic", value)}
                    placeholder="Add example topics..."
                    minHeight={220}
                  />
                </div>

                <input type="hidden" name="reading[meetingName]" value={formData.meetingName} />
                <input type="hidden" name="reading[meetingUrl]" value={formData.meetingUrl} />
                <input type="hidden" name="reading[meetingDate]" value={formData.meetingDate} />
                <input type="hidden" name="reading[hour]" value={formData.hour} />
                <input type="hidden" name="reading[minute]" value={formData.minute} />
                <input type="hidden" name="reading[meridiem]" value={formData.meridiem} />
                <input type="hidden" name="reading[host]" value={formData.host} />
                <input type="hidden" name="reading[title]" value={formData.title} />
                <input type="hidden" name="reading[source]" value={formData.source} />
                <input type="hidden" name="reading[content]" value={formData.content} />
                <input type="hidden" name="reading[topic]" value={formData.topic} />
                <input type="hidden" name="reading[user_id]" value={formData.userId} />
                <input type="hidden" name="reading[group_id]" value={formData.groupId} />
                <input type="hidden" name="reading[poll_id]" value={formData.pollId} />
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );

}