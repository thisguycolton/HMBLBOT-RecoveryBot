import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../../lib";
import { ACTIVITY_TITLE, cueTime, scriptSections, skipReason } from "../lib";
import { CUE_EARLY_MS, CUE_SHOWN_MS, PING_MS, SIZES, store, useDarkMode, useMeetingClock } from "../parts";

// Everything a meeting's HostDeck shares with its blocks (blocks.jsx get it as `deck`): the
// meeting and its kit (`center`), the live state both hosts see (`live`) and `act` to change it,
// the script's sections and where the meeting is in them, the meeting clock, what's open on the
// stage (the script, a kit reading or the activity), the phone tab, and the page's own settings
// (text size, dark mode, setup). The page checks in every few seconds (ping), which is how the
// host and co-host see each other. Blocks never fetch or poll on their own.
export default function useHostingDeck() {
  const { slug, meetingId } = useParams();
  // ?on=: the date a short link (/h/CODE) opened, so both hosts stay on that day
  const [params] = useSearchParams();
  const on = /^\d{4}-\d{2}-\d{2}$/.test(params.get("on") || "") ? params.get("on") : null;
  const base = `/groups/${slug}/hosting/${meetingId}`;
  const q = on ? `?on=${on}` : "";
  const [center, setCenter] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [live, setLive] = useState(null);
  const [sections, setSections] = useState([]);
  const [reading, setReading] = useState(null); // a kit reading open on the stage, or "activity"
  const [panel, setPanel] = useState("script"); // on a phone: which tab is showing
  const [setup, setSetup] = useState(false);
  const [dark, toggleDark] = useDarkMode();
  const [size, setSize] = useState(() => Number(store.get("hosting-text-size", 20)) || 20);
  const [dismissed, setDismissed] = useState([]); // reminders this host closed
  const { now, elapsed } = useMeetingClock(center?.starts_at, live?.server_now);

  const applyLive = useCallback((next) => {
    if (!next) return;
    setLive((prev) => {
      if (prev && next.version < prev.version) return { ...prev, presences: next.presences };
      return next;
    });
  }, []);

  const load = useCallback(() => api(`${base}${q}`).then((c) => { setCenter(c); applyLive(c.live); }).catch((e) => setError(e)), [base, q, applyLive]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let gone = false;
    scriptSections(center?.kit?.script, center?.kit?.activity_anchor).then((s) => !gone && setSections(s));
    return () => { gone = true; };
  }, [center?.kit?.script, center?.kit?.activity_anchor]);

  useEffect(() => {
    document.title = center ? `Hosting ${center.meeting.name}` : "HostDeck";
  }, [center]);

  // Sections that aren't for today (their days, or the day's activity) are left out completely:
  // not in the flow, the counts, or Next / Previous
  const weekday = center ? new Date(`${center.on}T12:00:00`).getDay() : 0;
  const skips = useMemo(() => sections.map((sec) => skipReason(sec, { activity: live?.activity, weekday })), [sections, live?.activity, weekday]);
  const shown = useMemo(() => sections.map((_, i) => i).filter((i) => !skips[i]), [sections, skips]);
  const nextIndex = (from, by) => {
    for (let i = from + by; i >= 0 && i < sections.length; i += by) if (!skips[i]) return i;
    return -1;
  };
  // The meeting is on a section that's left out today (the activity changed under it): show the
  // next one that isn't, or the one before when it was the last
  const stored = Math.min(live?.section_index || 0, Math.max(sections.length - 1, 0));
  const index = !skips[stored] || !shown.length ? stored : [nextIndex(stored, 1), nextIndex(stored, -1)].find((i) => i >= 0);
  const section = sections[index];

  // What the other host sees beside my name
  const activity = setup ? "Setting up the kit" : reading === "activity" ? `On ${ACTIVITY_TITLE}` : reading ? `Sharing ${reading.title}` : panel === "chat" ? "Looking at chat postings"
    : section ? `On ${section.title}` : "Here";

  const ping = useCallback(() => {
    api(`${base}/ping${q}`, { method: "POST", body: { activity, section_index: index } }).then(applyLive).catch(() => {});
  }, [base, q, activity, index, applyLive]);
  useEffect(() => {
    if (!center) return undefined;
    ping();
    const t = setInterval(ping, PING_MS);
    return () => clearInterval(t);
  }, [center, ping]);

  const act = async (what, extra = {}) => {
    setActionError(null);
    try {
      applyLive(await api(`${base}/act${q}`, { method: "POST", body: { act: what, ...extra } }));
    } catch (e) { setActionError(e.message); }
  };
  const goto = (i) => {
    if (i < 0 || i >= sections.length) return;
    setReading(null);
    setPanel("script");
    act("goto", { index: i, label: sections[i].title });
  };
  const next = () => {
    if (!live.completed.includes(index)) act("complete", { index, label: section?.title });
    goto(nextIndex(index, 1));
  };

  // Arrow keys move through the script (not while typing)
  useEffect(() => {
    const onKey = (e) => {
      if (setup || e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.key === "ArrowRight") goto(nextIndex(index, 1));
      if (e.key === "ArrowLeft") goto(nextIndex(index, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const changeSize = (step) => {
    const i = Math.min(Math.max(SIZES.indexOf(size) + step, 0), SIZES.length - 1);
    setSize(SIZES[i]);
    store.set("hosting-text-size", SIZES[i]);
  };

  // Sections with a reminder whose time has come (from a minute before), not done or closed yet
  const cues = center && live
    ? sections.map((sec, i) => ({ sec, i, at: cueTime(sec.cue, center.starts_at, center.ends_at) }))
      .filter(({ i, at }) => at && !skips[i] && !live.completed.includes(i) && !dismissed.includes(i) && now >= at - CUE_EARLY_MS && now < at + CUE_SHOWN_MS)
    : [];
  // Today's reading / activity: its place in the script, or on its own on the stage when the script has none
  const openActivity = () => {
    const spot = sections.findIndex((x, i) => x.activity && !skips[i]);
    if (spot >= 0) goto(spot);
    else { setReading("activity"); setPanel("script"); }
  };
  // A kit reading on the stage
  const openReading = (r) => { setReading(r); setPanel("script"); };

  return {
    slug, center, setCenter, applyLive, error, actionError, live, act, sections, skips, shown, index, section, nextIndex, goto, next,
    reading, setReading, openActivity, openReading, panel, setPanel, setup, setSetup, dark, toggleDark, size, changeSize,
    now, elapsed, cues, dismiss: (i) => setDismissed((d) => [...d, i]),
  };
}
