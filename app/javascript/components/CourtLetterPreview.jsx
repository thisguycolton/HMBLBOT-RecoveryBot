// app/javascript/components/CourtLetterPreview.jsx
import React from "react";

// The court verification email as the attendee will see it (it mirrors
// court_verification_mailer/verification_email.html.erb and CourtLetter on the server).
// {{placeholders}} with a value in `values` are filled in; the rest show as labelled chips,
// so a group admin (or a host part-way through the form) can see where each value goes.
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
const LABEL_LINE = /^([^:]{1,30}):\s+(.+)$/;

function fill(text, values, fields, keyBase) {
  const out = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(PLACEHOLDER)) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const key = match[1];
    const value = values?.[key];
    if (value) {
      out.push(<span key={`${keyBase}-${i++}`} className="text-slate-900 dark:text-white">{value}</span>);
    } else {
      const known = fields && key in fields;
      out.push(
        <span
          key={`${keyBase}-${i++}`}
          title={known ? `Filled in from the form: ${fields[key]}` : "The form doesn't fill this in"}
          className={`mx-0.5 inline-block rounded-md px-1.5 py-px align-baseline font-sans text-[0.8em] font-semibold ${
            known
              ? "bg-accent/10 text-accent ring-1 ring-accent/30 dark:bg-accent/25 dark:text-white dark:ring-accent/50"
              : "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-800"
          }`}
        >
          {known ? fields[key] : `{{${key}}}`}
        </span>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function CourtLetterPreview({ groupTitle, subject, body, values = {}, fields, className = "" }) {
  const paragraphs = (body || "")
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((p) => p.length);

  return (
    <div className={`overflow-hidden rounded-xl bg-white text-left shadow-panel dark:bg-neutral-900 ${className}`}>
      <div className="border-b border-neutral-100 px-4 py-2.5 text-sm dark:border-neutral-800">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">Subject</span>{" "}
        <span className="text-slate-900 dark:text-white">{fill(subject || "", values, fields, "s")}</span>
      </div>
      <div className="border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
        <div className="text-base font-semibold text-slate-900 dark:text-white">{groupTitle}</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">Meeting attendance verification</div>
      </div>
      <div className="space-y-4 px-5 py-5 text-sm leading-relaxed text-slate-700 dark:text-neutral-300">
        {paragraphs.map((lines, pi) => (
          <div key={pi}>
            {lines.map((line, li) => {
              const m = line.match(LABEL_LINE);
              return (
                <div key={li}>
                  {m ? (
                    <>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{m[1]}:</span>{" "}
                      {fill(m[2], values, fields, `${pi}-${li}`)}
                    </>
                  ) : (
                    fill(line, values, fields, `${pi}-${li}`)
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-neutral-100 px-5 py-3 text-xs text-slate-500 dark:border-neutral-800 dark:text-neutral-400">
        This verification reflects attendance at an Alcoholics Anonymous meeting and is provided at the request of the participant.
      </div>
    </div>
  );
}
