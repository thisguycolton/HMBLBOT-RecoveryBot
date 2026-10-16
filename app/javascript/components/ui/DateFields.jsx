import React from "react";
import DateTimePicker from "./DateTimePicker";

// Drop-in replacements for <input type="date|time|datetime-local">: the same string
// values ("2026-10-16", "12:30", "2026-10-16T12:30"), shown like the plain inputs when
// closed, opening the DateTimePicker when clicked.

const pad = (n) => String(n).padStart(2, "0");

const parseDate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseTime = (s) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(s || "");
  if (!m) return null;
  const d = new Date();
  d.setHours(+m[1], +m[2], 0, 0);
  return d;
};
const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const parseDateTime = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
};

export function DateField({ value, onChange, min, max, ...rest }) {
  return (
    <DateTimePicker
      compact
      pickerType="date"
      value={parseDate(value)}
      onChange={(d) => onChange(d ? formatDate(d) : "")}
      minDate={parseDate(min)}
      maxDate={parseDate(max)}
      placeholder="Pick a date"
      {...rest}
    />
  );
}

export function TimeField({ value, onChange, ...rest }) {
  return (
    <DateTimePicker
      compact
      pickerType="time"
      value={parseTime(value)}
      onChange={(d) => onChange(d ? formatTime(d) : "")}
      placeholder="Pick a time"
      {...rest}
    />
  );
}

export function DateTimeField({ value, onChange, min, max, ...rest }) {
  return (
    <DateTimePicker
      compact
      pickerType="date-time"
      value={parseDateTime(value)}
      onChange={(d) => onChange(d ? `${formatDate(d)}T${formatTime(d)}` : "")}
      minDate={parseDate(min)}
      maxDate={parseDate(max)}
      placeholder="Pick a date and time"
      {...rest}
    />
  );
}

// Today as a date field value, in the viewer's own time zone
export const todayValue = () => formatDate(new Date());
