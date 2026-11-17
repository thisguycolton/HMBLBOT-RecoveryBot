import React from "react";

// Fills in a letterhead's blanks: {{group}} is the group's name, {{date}} the meeting's date
// (business meeting agendas only)
export const fillLetterhead = (text, groupTitle, date) => (text || "").replaceAll("{{group}}", groupTitle).replaceAll("{{date}}", date || "");

// A letterhead from the Templates page at the top of a page: its logo or seal, a heading and a
// line under it
export default function Letterhead({ template: t, groupTitle, date }) {
  return (
    <header className={`doc-letterhead doc-letterhead--${t.align}`}>
      {t.mark_url && <img src={t.mark_url} alt="" className="doc-letterhead-mark" />}
      {(t.header_text || t.subheader_text) && (
        <div className="doc-letterhead-text">
          {t.header_text && <p className="doc-letterhead-heading">{fillLetterhead(t.header_text, groupTitle, date)}</p>}
          {t.subheader_text && <p className="doc-letterhead-sub">{fillLetterhead(t.subheader_text, groupTitle, date)}</p>}
        </div>
      )}
    </header>
  );
}
