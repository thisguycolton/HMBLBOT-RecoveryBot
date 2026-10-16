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
      out.push(<span key={`${keyBase}-${i++}`} className="text-white">{value}</span>);
    } else {
      const known = fields && key in fields;
      out.push(
        <span
          key={`${keyBase}-${i++}`}
          title={known ? `Filled in from the form: ${fields[key]}` : "The form doesn't fill this in"}
          className={`mx-0.5 inline-block rounded-md px-1.5 py-px align-baseline font-sans text-[0.8em] font-semibold ${
            known ? "bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40" : "bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/50"
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
    <div className={`overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-left ${className}`}>
      <div className="border-b border-slate-800 px-4 py-2 font-sans text-xs text-slate-400">
        <span className="text-slate-500">Subject:</span> <span className="text-slate-200">{fill(subject || "", values, fields, "s")}</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="overflow-hidden rounded-lg border border-slate-800 bg-gray-900">
          <div className="bg-gradient-to-r from-cyan-600 to-cyan-400 px-4 py-3 text-center font-sans">
            <div className="text-base font-semibold uppercase tracking-wider text-cyan-50">{groupTitle}</div>
            <div className="text-xs text-sky-100">Meeting Attendance Verification</div>
          </div>
          <div className="space-y-4 px-5 py-5 font-sans text-sm leading-relaxed text-gray-200">
            {paragraphs.map((lines, pi) => (
              <div key={pi}>
                {lines.map((line, li) => {
                  const m = line.match(LABEL_LINE);
                  return (
                    <div key={li}>
                      {m ? (
                        <>
                          <span className="text-xs uppercase tracking-wider text-gray-400">{m[1]}:</span>{" "}
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
          <div className="bg-slate-950 px-4 py-3 text-center font-sans text-[11px] text-gray-500">
            This verification reflects attendance at an Alcoholics Anonymous meeting and is provided at the request of the participant.
          </div>
        </div>
      </div>
    </div>
  );
}
