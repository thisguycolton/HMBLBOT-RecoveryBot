// app/javascript/components/CourtVerificationForm.jsx
import React, { useState } from "react";
import axios from "axios";
import Navbar from "./Navbar";

const CourtVerificationForm = ({ isAuthenticated }) => {
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [meetingTimeSlot, setMeetingTimeSlot] = useState(""); // "09:00", "12:00", "18:00", "21:00"
  const [hostName, setHostName] = useState("");
  const [signerName, setSignerName] = useState("");
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const meetingAtString = `${dateStr}T${meetingTimeSlot}:00`;

    try {
      const payload = {
        court_verification: {
          respondent_name: respondentName,
          respondent_email: respondentEmail,
          meeting_at: meetingAtString,
          host_name: hostName,
          signer_name: signerName,
          // topic if you decide to persist it later
        },
      };

      const res = await axios.post("/api/court_verifications", payload);

      if (res.status === 201 || res.status === 200) {
        setSuccessMessage("Verification email has been sent to the respondent.");
        setRespondentName("");
        setRespondentEmail("");
        setHostName("");
        setSignerName("");
        setTopic("");
        setMeetingTimeSlot("");
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

  const timeButtonClass = (slot) =>
    [
      "px-4 py-2 rounded text-sm font-medium border",
      "transition-colors duration-150",
      meetingTimeSlot === slot
        ? "bg-cyan-600 border-cyan-400 text-white"
        : "bg-slate-900 border-slate-600 text-slate-100 hover:bg-slate-800",
    ].join(" ");

  const todayDisplay = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

 return (
  <div className="bg-gray-900 text-white min-h-screen w-full overflow-x-hidden">
    <Navbar isAuthenticated={isAuthenticated} />

    <main className="pt-[var(--nav-h,80px)] py-6 px-0 md:px-4 lg:px-8 flex justify-center w-full">
      <div
        className="
          w-full max-w-xl md:max-w-3xl lg:max-w-4xl
          bg-gray-800
          md:rounded-lg
          shadow-lg
          px-4 py-6 sm:px-6 sm:py-8
          mx-auto
        "
      >
        {/* Title */}
        <header className="mb-6 text-center px-2">
          {/* smaller on mobile so it doesn't push width */}
          <h1 className="text-3xl! sm:text-4xl! lg:text-4xl! font-bold ttSans break-words">
            MEETING VERIFICATION
          </h1>
          <p className="text-cyan-400 text-sm sm:text-base mt-1 ttSans text-center">
            The Acid Test AA Meeting
          </p>
        </header>

        {/* Alerts */}
        {successMessage && (
          <div className="mb-4 p-3 rounded border border-emerald-500 text-emerald-300 text-sm bg-emerald-900/20">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded border border-red-500 text-red-300 text-sm bg-red-900/20">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 max-w-full">
          {/* Respondent name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Respondent Name
            </label>
            <input
              type="text"
              value={respondentName}
              onChange={(e) => setRespondentName(e.target.value)}
              className="w-full max-w-full border border-slate-600! bg-slate-900 rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-cyan-500"
              required
            />
          </div>

          {/* Respondent email */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Respondent Email
            </label>
            <input
              type="email"
              value={respondentEmail}
              onChange={(e) => setRespondentEmail(e.target.value)}
              className="w-full max-w-full border border-slate-600! bg-slate-900 rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-cyan-500"
              required
            />
          </div>

          {/* Day / Time of Meeting Attended */}
          <section>
            <h5 className="block text-sm font-medium mb-1 text-center ttSans">
              Day / Time of Meeting Attended
            </h5>

            <p className="text-slate-300 mb-2 text-sm sm:text-base text-center">
              Date will be recorded as{" "}
              <span className="font-semibold">{todayDisplay}</span>. <br />
              All times are in{" "}
              <span className="font-semibold">Phoenix, AZ (MST)</span>.
            </p>

            <h5 className="block text-xs font-semibold mb-3 ttSans text-center">
              Meeting Time
            </h5>

            <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto mb-2">
              <button
                type="button"
                onClick={() => setMeetingTimeSlot("09:00")}
                className={`${timeButtonClass("09:00")} border-slate-600!`}
              >
                9:00 AM
              </button>

              <button
                type="button"
                onClick={() => setMeetingTimeSlot("12:00")}
                className={`${timeButtonClass("12:00")} border-slate-600!`}
              >
                12:00 PM
              </button>

              <button
                type="button"
                onClick={() => setMeetingTimeSlot("18:00")}
                className={`${timeButtonClass("18:00")} border-slate-600!`}
              >
                6:00 PM
              </button>

              <button
                type="button"
                onClick={() => setMeetingTimeSlot("21:00")}
                className={`${timeButtonClass("21:00")} border-slate-600!`}
              >
                9:00 PM
              </button>
            </div>
          </section>

          {/* Topic */}
          <div>
            <label className="block text-sm font-medium mb-1">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full max-w-full border border-slate-600! bg-slate-900 rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-cyan-500"
              required
            />
          </div>

          {/* Host name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Host Name
            </label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="w-full max-w-full border border-slate-600! bg-slate-900 rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-cyan-500"
              required
            />
          </div>

          {/* Signer name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Signer Name
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full max-w-full border border-slate-600! bg-slate-900 rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-cyan-500"
              required
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending..." : "Send Verification Email"}
            </button>
          </div>
        </form>

        {/* Footer text inside card */}
        <p className="pt-10 text-xs md:text-sm text-gray-400 ftSans text-center">
          This tool sends an email verifying attendance at The Acid Test AA
          Meeting (9am, 12pm, 6pm, 9pm – Phoenix time).
        </p>
      </div>
    </main>

    <img
      src="https://humblebot.s3.us-west-2.amazonaws.com/hmblbotLOGOsmBLUE.png"
      alt="HumbleBot Logo"
      className="hidden fixed bottom-7 right-4 w-16 opacity-70 hover:opacity-95"
    />
  </div>
  );
};

export default CourtVerificationForm;