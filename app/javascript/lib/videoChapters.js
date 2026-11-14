// Chapters for a video (ui/ChapterVideo), read from JSON. Any of these shapes work:
//   [{ "start": "0:00", "title": "Sign up" }, { "start": 42, "title": "Find a meeting" }]
//   { "chapters": [ ...the same... ] }
//   { "0:00": "Sign up", "0:42": "Find a meeting" }
// A start can be seconds (42, "42", "42.5") or a clock ("0:42", "1:02:03"). The start can also be
// called time, at, from, startTime or timestamp, and the title name, label or text. A chapter
// runs until the next one starts (the last one until the video ends); an item's own "end" only
// sizes the timeline until the video says how long it is. Items without a usable start or title
// are dropped, and the rest come back in order.
// The same functions read plain text, one "0:42 Find a meeting" per line, the way YouTube
// descriptions list them.

export function parseTime(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^\d+(\.\d+)?s?$/.test(text)) return parseFloat(text);
  if (!/^\d+(:[0-5]?\d){1,2}(\.\d+)?$/.test(text)) return null;
  return text.split(":").reduce((total, part) => total * 60 + parseFloat(part), 0);
}

export const clock = (seconds) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

const pick = (item, keys) => keys.map((k) => item[k]).find((v) => v !== undefined && v !== null);

function fromText(text) {
  return text.split(/\r?\n/).map((line) => {
    const m = line.trim().match(/^[-•*]?\s*\(?(\d+(?::[0-5]?\d){1,2})\)?\s*[-–—:|.]?\s*(.+)$/);
    return m && { start: m[1], title: m[2] };
  }).filter(Boolean);
}

function items(input) {
  if (typeof input === "string") {
    const text = input.trim();
    if (!text) return [];
    if (text.startsWith("[") || text.startsWith("{")) return items(JSON.parse(text));
    return fromText(text);
  }
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    if (Array.isArray(input.chapters)) return input.chapters;
    return Object.entries(input).map(([start, title]) => ({ start, title }));
  }
  return [];
}

// -> [{ start, end|null, title }], sorted, starts unique. Throws on JSON that doesn't parse.
export function parseChapters(input) {
  const seen = new Set();
  return items(input)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const start = parseTime(pick(item, ["start", "time", "at", "from", "startTime", "start_time", "timestamp"]));
      const end = parseTime(pick(item, ["end", "to", "endTime", "end_time"]));
      const title = pick(item, ["title", "name", "label", "text"]);
      if (start === null || title === undefined || title === null) return null;
      return { start, end: end !== null && end > start ? end : null, title: String(title).trim() };
    })
    .filter((c) => c && c.title && !seen.has(c.start) && seen.add(c.start))
    .sort((a, b) => a.start - b.start);
}

// Chapters laid out over a video `duration` seconds long: every chapter gets its end, and the
// time before the first chapter (if it doesn't start at 0) becomes an untitled one, so the
// timeline's pieces cover the whole video with no holes.
export function layoutChapters(chapters, duration) {
  const total = duration > 0 ? duration : Math.max(1, ...chapters.map((c) => c.end || c.start + 1));
  const list = chapters.filter((c) => c.start < total);
  if (!list.length) return [{ start: 0, end: total, title: "" }];
  const out = list[0].start > 0.5 ? [{ start: 0, end: list[0].start, title: "" }] : [];
  list.forEach((c, i) => {
    const next = list[i + 1]?.start ?? total;
    out.push({ start: i === 0 && !out.length ? 0 : c.start, end: Math.min(next, total), title: c.title });
  });
  return out;
}

export const chapterAt = (laid, time) => {
  for (let i = laid.length - 1; i >= 0; i -= 1) if (time >= laid[i].start) return i;
  return 0;
};
