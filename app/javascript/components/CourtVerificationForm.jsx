// app/javascript/components/CourtVerificationForm.jsx
import React, { useState } from "react";
import axios from "axios";
import { Send } from "lucide-react";
import CourtLetterPreview from "./CourtLetterPreview";
import { Card, ErrorNote, Tray, primaryButton, quietButton } from "./groups/ui";
import { inputClass, labelClass } from "./ui/styles";

// The four daily Acid Test meetings, used when the form isn't opened from a group's link
const DEFAULT_SLOTS = [
  { value: "09:00", label: "9:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "18:00", label: "6:00 PM" },
  { value: "21:00", label: "9:00 PM" },
];

const addDaysIso = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// `group` comes from /court_verifications/new?group=<slug>: the group's name, its meetings
// and today's date in its time zone. Without it the form is the Acid Test's, as before.
const CourtVerificationForm = ({ isAuthenticated, group = null }) => {
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [meetingTimeSlot, setMeetingTimeSlot] = useState(""); // "09:00", "12:00", "18:00", "21:00"
  const [hostName, setHostName] = useState("");
  const [signerName, setSignerName] = useState("");
  const [topic, setTopic] = useState("");
  const [meetingDay, setMeetingDay] = useState("today"); // "today" | "yesterday"
  const pickDay = (day) => {
    setMeetingDay(day);
    if (group) setMeetingTimeSlot("");
  };
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const getMeetingDate = () => {
  if (group) return meetingDay === "yesterday" ? addDaysIso(group.today, -1) : group.today;
  const date = new Date();

  if (meetingDay === "yesterday") {
    date.setDate(date.getDate() - 1);
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
};

const meetingDisplayDate = () =>
  new Date(`${getMeetingDate()}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    if (!meetingTimeSlot) {
      setErrorMessage("Please select a meeting time.");
      setSubmitting(false);
      return;
    }

  const meetingAtString = `${getMeetingDate()}T${meetingTimeSlot}:00`;

    try {
      const payload = {
        ...(group ? { group_slug: group.slug, meeting_id: meetingTimeSlot, meeting_date: getMeetingDate() } : {}),
        court_verification: {
          respondent_name: respondentName,
          respondent_email: respondentEmail,
          ...(group ? {} : { meeting_at: meetingAtString }),
          host_name: hostName,
          signer_name: signerName,
           topic: topic,
        },
      };

      const res = await axios.post("/api/court_verifications", payload);

      if (res.status === 201 || res.status === 200) {
        setSuccessMessage("Verification email has been sent to the respondent.");

        // clear only the fields that should reset each time
        setRespondentName("");
        setRespondentEmail("");

        // keep these in state until a full page refresh
        // setMeetingTimeSlot("");
        // setHostName("");
        // setSignerName("");
        // setTopic("");
      } else {
        setErrorMessage("There was a problem sending the verification.");
      }
    } catch (err) {
      console.error(err);
      const errors =
        err.response?.data?.errors?.join(", ") ||
        "There was a problem sending the verification.";
      setErrorMessage(errors);
    } finally {
      setSubmitting(false);
    }
  };

  // A group's meetings on the chosen day (their id is the slot), or the Acid Test's four
  const slots = group
    ? group.meetings
        .filter((m) => m.dates.includes(getMeetingDate()))
        .map((m) => ({ value: String(m.id), label: m.name === group.title ? m.time_label : `${m.time_label} · ${m.name}` }))
    : DEFAULT_SLOTS;

  // The group's email, filled in as the host completes the form
  const chosenMeeting = group && group.meetings.find((m) => String(m.id) === meetingTimeSlot);
  const letterValues = group && {
    attendee: respondentName.trim(),
    meeting_time: chosenMeeting ? `${meetingDisplayDate()} at ${chosenMeeting.time_label}` : "",
    topic: topic.trim(),
    host: hostName.trim(),
    signer: signerName.trim(),
    group: group.title,
  };

  const choice = (active) =>
    `rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "!bg-white text-slate-900 shadow-sm dark:!bg-neutral-700 dark:text-white"
        : "!bg-transparent text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
    }`;
  const slotClass = (value) =>
    meetingTimeSlot === value
      ? "inline-flex items-center rounded-xl !bg-accent px-3.5 py-2 text-sm font-semibold !text-white shadow-panel"
      : quietButton;
  const title = group ? group.title : "The Acid Test AA Meeting";

  return (
    <main className="w-full pt-[var(--nav-h,56px)]">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Meeting verification</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          <p className="text-sm text-slate-600 dark:text-neutral-400">
            {group
              ? `Sends an email verifying attendance at a meeting of ${group.title}.`
              : "Sends an email verifying attendance at The Acid Test AA Meeting (9am, 12pm, 6pm and 9pm, Phoenix time)."}
          </p>
        </header>

        {successMessage && (
          <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{successMessage}</p>
        )}
        <ErrorNote error={errorMessage} />

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tray label="Attendee">
            <Card className="grid gap-4 p-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cv-name" className={labelClass}>Name</label>
                <input id="cv-name" type="text" value={respondentName} onChange={(e) => setRespondentName(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label htmlFor="cv-email" className={labelClass}>Email</label>
                <input id="cv-email" type="email" value={respondentEmail} onChange={(e) => setRespondentEmail(e.target.value)} className={inputClass} required />
              </div>
            </Card>
          </Tray>

          <Tray label="Meeting attended">
            <Card className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
                  <button type="button" onClick={() => pickDay("yesterday")} className={choice(meetingDay === "yesterday")}>Yesterday</button>
                  <button type="button" onClick={() => pickDay("today")} className={choice(meetingDay === "today")}>Today</button>
                </div>
                <p className="text-sm text-slate-600 dark:text-neutral-400">
                  <span className="font-medium text-slate-900 dark:text-white">{meetingDisplayDate()}</span>
                  {" · "}{group ? group.time_zone_label : "Phoenix time (MST)"}
                </p>
              </div>
              <div>
                <span className={labelClass}>Meeting time</span>
                {slots.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-neutral-400">{group.title} has no meeting on that day.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <button key={slot.value} type="button" aria-pressed={meetingTimeSlot === slot.value} onClick={() => setMeetingTimeSlot(slot.value)} className={slotClass(slot.value)}>
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </Tray>

          <Tray label="Meeting details">
            <Card className="grid gap-4 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="cv-topic" className={labelClass}>Topic</label>
                <input id="cv-topic" type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label htmlFor="cv-host" className={labelClass}>Host</label>
                <input id="cv-host" type="text" value={hostName} onChange={(e) => setHostName(e.target.value)} className={inputClass} required />
              </div>
              <div>
                <label htmlFor="cv-signer" className={labelClass}>Signer</label>
                <input id="cv-signer" type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} className={inputClass} required />
              </div>
            </Card>
          </Tray>

          {group?.email && (
            <Tray label="The email they'll get">
              <CourtLetterPreview
                groupTitle={group.title}
                subject={group.email.subject}
                body={group.email.body}
                fields={group.email.fields}
                values={letterValues}
              />
            </Tray>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={submitting} className={primaryButton}>
              <Send className="h-4 w-4" /> {submitting ? "Sending…" : "Send verification email"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default CourtVerificationForm;
