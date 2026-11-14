import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Maximize, Minimize, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { chapterAt, clock, layoutChapters, parseChapters } from "../../lib/videoChapters";

const RATES = [1, 1.25, 1.5, 2, 0.75];
const HIDE_AFTER = 2500; // ms without moving before the controls fade while playing

// A video with chapters (the Docs' ```video blocks, and anywhere else that wants one).
//   <ChapterVideo src="/docs-videos/tour.mp4" poster="…" title="…" chapters={[{ start: "0:42", title: "…" }]} />
// `chapters` can be anything lib/videoChapters reads (an array, { chapters: [...] }, a JSON
// string, "0:42 Title" lines) or the address of a .json file on this site ("/…") to load them from.
// The timeline is cut into one piece per chapter with a gap between them. Pointing at it (or
// dragging along it with a finger) shows a tooltip with the chapter's title and the time. The
// tooltip is drawn outside the player (fixed, in a portal), so the rounded, overflow-hidden frame
// never clips it, even at the very left or right edge. Keys: Space/K play, ←/→ 5 s, J/L 10 s,
// [ and ] the chapter before/after, M mute, F full screen.
export default function ChapterVideo({ src, poster, title, chapters: chapterSource, className = "", showList = true }) {
  const frame = useRef(null);
  const video = useRef(null);
  const bar = useRef(null);
  const pieces = useRef([]);
  const hideTimer = useRef(null);
  const [chapters, setChapters] = useState([]);
  const [problem, setProblem] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [full, setFull] = useState(false);
  const [awake, setAwake] = useState(true); // controls showing
  const [hover, setHover] = useState(null); // { time, index, x, top } while pointing at / dragging the timeline
  const [scrubbing, setScrubbing] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  // Read the chapters (or fetch them, when given the address of a .json file)
  useEffect(() => {
    let live = true;
    setProblem(null);
    const read = (input) => {
      try { if (live) setChapters(parseChapters(input)); } catch { if (live) { setChapters([]); setProblem("The chapters aren't valid JSON."); } }
    };
    if (typeof chapterSource === "string" && /^\/(?!\/)\S+$/.test(chapterSource.trim())) {
      fetch(chapterSource.trim(), { credentials: "same-origin" })
        .then((r) => (r.ok ? r.text() : Promise.reject()))
        .then(read)
        .catch(() => live && setProblem("The chapters file couldn't be loaded."));
    } else read(chapterSource || []);
    return () => { live = false; };
  }, [chapterSource]);

  const laid = useMemo(() => layoutChapters(chapters, duration), [chapters, duration]);
  const current = chapterAt(laid, now);
  const titled = chapters.length > 0;

  // --- the video's own events
  useEffect(() => {
    const v = video.current;
    if (!v) return undefined;
    const sync = () => {
      setNow(v.currentTime);
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
      setPlaying(!v.paused && !v.ended);
      setMuted(v.muted);
      const ranges = v.buffered;
      let end = 0;
      for (let i = 0; i < ranges.length; i += 1) if (ranges.start(i) <= v.currentTime + 0.5) end = Math.max(end, ranges.end(i));
      setBuffered(end);
    };
    const events = ["timeupdate", "durationchange", "loadedmetadata", "play", "pause", "ended", "progress", "volumechange", "seeked"];
    events.forEach((e) => v.addEventListener(e, sync));
    sync();
    return () => events.forEach((e) => v.removeEventListener(e, sync));
  }, [src]);

  useEffect(() => {
    const change = () => setFull(document.fullscreenElement === frame.current || document.webkitFullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", change);
    document.addEventListener("webkitfullscreenchange", change);
    return () => { document.removeEventListener("fullscreenchange", change); document.removeEventListener("webkitfullscreenchange", change); };
  }, []);

  // Controls fade out a moment after the pointer stops while it plays
  const wake = useCallback(() => {
    setAwake(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setAwake(false), HIDE_AFTER);
  }, []);
  useEffect(() => {
    if (!playing) { clearTimeout(hideTimer.current); setAwake(true); } else wake();
    return () => clearTimeout(hideTimer.current);
  }, [playing, wake]);
  const showing = awake || !playing || scrubbing || hover || listOpen;

  // --- actions
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    setStarted(true);
    if (v.paused || v.ended) v.play().catch(() => {}); else v.pause();
  };
  const seek = (time) => {
    const v = video.current;
    if (!v) return;
    const end = duration || v.duration || 0;
    v.currentTime = Math.max(0, end ? Math.min(time, end - 0.05) : time);
    setNow(v.currentTime);
  };
  const jumpChapter = (step) => {
    // Going back from more than 3 s into a chapter restarts it, the way music players do
    if (step < 0 && now - laid[current].start > 3) return seek(laid[current].start);
    const target = laid[Math.max(0, Math.min(laid.length - 1, current + step))];
    return seek(target.start);
  };
  const playChapter = (index) => {
    seek(laid[index].start);
    setStarted(true);
    video.current?.play().catch(() => {});
  };
  const toggleMute = () => { if (video.current) video.current.muted = !video.current.muted; };
  const nextRate = () => {
    const r = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(r);
    if (video.current) video.current.playbackRate = r;
  };
  const toggleFull = () => {
    const el = frame.current;
    const v = video.current;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iPhone: only the video itself can go full screen
  };

  // --- the timeline: where a pointer is, as a time. The pieces have gaps between them, so each
  // piece maps its own width to its own chapter (a point in a gap belongs to the nearer piece).
  const pointAt = (clientX) => {
    const boxes = pieces.current.slice(0, laid.length).map((el) => el?.getBoundingClientRect());
    if (!boxes.length || boxes.some((b) => !b)) return null;
    let index = boxes.findIndex((b) => clientX < b.right);
    if (index === -1) index = boxes.length - 1;
    if (index > 0 && clientX < boxes[index].left && clientX - boxes[index - 1].right < boxes[index].left - clientX) index -= 1;
    const box = boxes[index];
    const part = Math.max(0, Math.min(1, (clientX - box.left) / box.width));
    const c = laid[index];
    const barBox = bar.current.getBoundingClientRect();
    return { index, time: c.start + part * (c.end - c.start), x: Math.max(box.left, Math.min(box.right, clientX)), top: barBox.top };
  };
  const onBarMove = (e) => {
    if (e.pointerType !== "mouse" && !scrubbing) return;
    const p = pointAt(e.clientX);
    if (!p) return;
    setHover(p);
    if (scrubbing) seek(p.time);
    wake();
  };
  const onBarDown = (e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = pointAt(e.clientX);
    if (!p) return;
    setScrubbing(true);
    setHover(p);
    seek(p.time);
  };
  const onBarUp = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setScrubbing(false);
    if (e.pointerType !== "mouse") setHover(null);
  };
  const onBarLeave = () => { if (!scrubbing) setHover(null); };
  // The tooltip goes away if the page scrolls or resizes under a still pointer
  useEffect(() => {
    if (!hover) return undefined;
    const drop = () => { if (!scrubbing) setHover(null); };
    window.addEventListener("scroll", drop, true);
    window.addEventListener("resize", drop);
    return () => { window.removeEventListener("scroll", drop, true); window.removeEventListener("resize", drop); };
  }, [hover, scrubbing]);

  const onBarKey = (e) => {
    const keys = {
      ArrowLeft: () => seek(now - 5), ArrowRight: () => seek(now + 5), ArrowDown: () => seek(now - 5), ArrowUp: () => seek(now + 5),
      PageDown: () => jumpChapter(-1), PageUp: () => jumpChapter(1), Home: () => seek(0), End: () => seek(duration),
    };
    if (!keys[e.key]) return;
    e.preventDefault();
    e.stopPropagation();
    keys[e.key]();
  };
  const onFrameKey = (e) => {
    if (e.target.closest("button, a, input") && (e.key === " " || e.key === "Enter")) return;
    const keys = {
      " ": toggle, k: toggle, j: () => seek(now - 10), l: () => seek(now + 10), ArrowLeft: () => seek(now - 5), ArrowRight: () => seek(now + 5),
      "[": () => jumpChapter(-1), "]": () => jumpChapter(1), m: toggleMute, f: toggleFull,
    };
    const run = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!run || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    run();
    wake();
  };

  const onVideoClick = (e) => {
    // A tap on a phone shows or hides the controls; a click with a mouse plays or pauses
    if (e.nativeEvent.pointerType === "touch" || window.matchMedia?.("(hover: none)").matches) {
      if (showing && playing) { clearTimeout(hideTimer.current); setAwake(false); } else wake();
      return;
    }
    toggle();
  };

  if (!src) return <p className="text-sm text-red-600 dark:text-red-400">This video has no "src" yet.</p>;

  return (
    <figure className={`not-prose my-6 ${className}`}>
      <div
        ref={frame}
        tabIndex={-1}
        onKeyDown={onFrameKey}
        onPointerMove={(e) => e.pointerType === "mouse" && wake()}
        onMouseLeave={() => playing && setAwake(false)}
        className={`group/video relative overflow-hidden bg-black outline-none ring-1 ring-black/5 dark:ring-white/10 ${full ? "grid place-items-center" : "rounded-2xl shadow-sm"} ${showing ? "" : "cursor-none"}`}
      >
        <video
          ref={video}
          src={src}
          poster={poster}
          preload="metadata"
          playsInline
          onClick={onVideoClick}
          onDoubleClick={toggleFull}
          aria-label={title || "Video"}
          className={`block w-full ${full ? "h-full max-h-screen object-contain" : "aspect-video object-contain"}`}
          data-no-pull-refresh
        />

        {/* Big play button before it starts */}
        {!started && !playing && (
          <button type="button" onClick={toggle} aria-label="Play"
            className="absolute inset-0 grid place-items-center !bg-transparent bg-gradient-to-t from-black/50 via-black/10 to-transparent">
            <span className="grid size-16 place-items-center rounded-full bg-white/95 text-slate-900 shadow-xl transition group-hover/video:scale-105 sm:size-20">
              <Play size={30} className="ml-1" fill="currentColor" />
            </span>
            {title && <span className="absolute left-4 top-3 max-w-[80%] truncate text-left text-sm font-semibold text-white drop-shadow sm:text-base">{title}</span>}
          </button>
        )}

        {/* Controls */}
        <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-10 text-white transition-opacity duration-200 sm:px-4 ${showing ? "opacity-100" : "pointer-events-none opacity-0"} ${!started && !playing ? "hidden" : ""}`}>
          <div
            ref={bar}
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(now)}
            aria-valuetext={`${clock(now)} of ${clock(duration)}${laid[current]?.title ? `, ${laid[current].title}` : ""}`}
            onKeyDown={onBarKey}
            onPointerDown={onBarDown}
            onPointerMove={onBarMove}
            onPointerUp={onBarUp}
            onPointerCancel={onBarUp}
            onPointerLeave={onBarLeave}
            className="group/bar flex h-6 cursor-pointer touch-none select-none items-center gap-[3px] rounded outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {laid.map((c, i) => {
              const span = c.end - c.start || 1;
              const played = Math.max(0, Math.min(1, (now - c.start) / span));
              const loaded = Math.max(0, Math.min(1, (buffered - c.start) / span));
              const lit = hover?.index === i;
              return (
                <div
                  key={`${c.start}-${i}`}
                  ref={(el) => { pieces.current[i] = el; }}
                  style={{ flexGrow: span, flexBasis: 0 }}
                  className={`relative min-w-[3px] overflow-hidden rounded-full bg-white/25 transition-[height] duration-150 ${lit || (scrubbing && current === i) ? "h-2" : "h-1 group-hover/bar:h-1.5"}`}
                >
                  <span className="absolute inset-y-0 left-0 bg-white/35" style={{ width: `${loaded * 100}%` }} />
                  <span className="absolute inset-y-0 left-0 bg-accent-light" style={{ width: `${played * 100}%` }} />
                  {lit && hover && (
                    <span className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${Math.max(0, Math.min(1, (hover.time - c.start) / span)) * 100}%` }} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-1 flex items-center gap-1 text-sm sm:gap-2">
            <IconButton label={playing ? "Pause" : "Play"} onClick={toggle}>
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </IconButton>
            {titled && (
              <>
                <IconButton label="Previous chapter" onClick={() => jumpChapter(-1)} className="hidden sm:grid"><SkipBack size={17} /></IconButton>
                <IconButton label="Next chapter" onClick={() => jumpChapter(1)} className="hidden sm:grid"><SkipForward size={17} /></IconButton>
              </>
            )}
            <IconButton label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</IconButton>
            <span className="shrink-0 tabular-nums text-white/90">{clock(now)}<span className="text-white/50"> / {clock(duration)}</span></span>
            {titled && laid[current]?.title && (
              <button type="button" onClick={() => showList && setListOpen((o) => !o)}
                className="flex min-w-0 items-center gap-1 rounded-md !bg-transparent px-1.5 py-1 text-left font-medium text-white/90 hover:!bg-white/10">
                <span className="text-white/40" aria-hidden="true">·</span>
                <span className="truncate">{laid[current].title}</span>
              </button>
            )}
            <span className="flex-1" />
            <button type="button" onClick={nextRate} aria-label={`Speed ${rate}×`}
              className="shrink-0 rounded-md !bg-transparent px-1.5 py-1 text-xs font-semibold tabular-nums text-white/90 hover:!bg-white/10">
              {rate}×
            </button>
            <IconButton label={full ? "Exit full screen" : "Full screen"} onClick={toggleFull}>{full ? <Minimize size={18} /> : <Maximize size={18} />}</IconButton>
          </div>
        </div>

        {hover && <TimelineTip hover={hover} chapter={laid[hover.index]} container={full ? frame.current : null} />}
      </div>

      {problem && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{problem}</p>}

      {(title || (showList && titled)) && (
        <figcaption className="mt-3">
          {showList && titled ? (
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <button type="button" onClick={() => setListOpen((o) => !o)} aria-expanded={listOpen}
                className="flex w-full items-center gap-2 rounded-2xl !bg-transparent px-4 py-2.5 text-left text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {title && <span className="font-semibold text-slate-900 dark:text-white">{title} · </span>}
                  <span className="text-slate-600 dark:text-neutral-400">{chapters.length} chapters</span>
                </span>
                <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform dark:text-neutral-400 ${listOpen ? "rotate-180" : ""}`} />
              </button>
              {listOpen && (
                <ol className="m-0 list-none border-t border-neutral-200 p-1.5 dark:border-neutral-800">
                  {laid.map((c, i) => c.title && (
                    <li key={`${c.start}-${i}`}>
                      <button type="button" onClick={() => playChapter(i)}
                        className={`flex w-full items-baseline gap-3 rounded-xl px-2.5 py-2 text-left text-sm ${
                          i === current ? "!bg-accent-tint font-semibold text-accent-ink dark:!bg-accent/25 dark:text-white" : "!bg-transparent text-slate-700 hover:!bg-neutral-100 dark:text-neutral-300 dark:hover:!bg-neutral-800"
                        }`}>
                        <span className="w-12 shrink-0 tabular-nums text-xs text-slate-500 dark:text-neutral-400">{clock(c.start)}</span>
                        <span className="min-w-0 flex-1">{c.title}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : (
            <span className="text-sm text-slate-600 dark:text-neutral-400">{title}</span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

function IconButton({ label, onClick, children, className = "" }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`grid size-9 shrink-0 place-items-center rounded-full !bg-transparent !p-0 text-white/90 hover:!bg-white/15 hover:text-white ${className}`}>
      {children}
    </button>
  );
}

// The chapter tooltip above the timeline. It lives in document.body (or in the player itself while
// that's full screen, since only the full-screen element is drawn then), with fixed positioning,
// so the player's overflow-hidden frame can't cut it off. It stays inside the window: near an
// edge the bubble slides in while its arrow keeps pointing at the spot.
function TimelineTip({ hover, chapter, container }) {
  const tip = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => { if (tip.current) setWidth(tip.current.offsetWidth); }, [chapter?.title, hover.index]);
  const margin = 8;
  const half = width / 2;
  const left = Math.max(margin + half, Math.min(window.innerWidth - margin - half, hover.x));
  const arrow = Math.max(12, Math.min(width - 12, hover.x - (left - half)));
  return createPortal(
    <div
      ref={tip}
      role="tooltip"
      style={{ left, top: hover.top - 6, visibility: width ? "visible" : "hidden" }}
      className="pointer-events-none fixed z-[2400] w-max max-w-[min(18rem,calc(100vw-16px))] -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-center text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
    >
      {chapter?.title && <div className="text-sm font-semibold leading-snug">{chapter.title}</div>}
      <div className={`tabular-nums ${chapter?.title ? "text-xs text-white/70 dark:text-neutral-600" : "text-sm font-semibold"}`}>{clock(hover.time)}</div>
      <span aria-hidden="true" style={{ left: arrow }}
        className="absolute top-full size-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-slate-900 dark:border-t-neutral-100" />
    </div>,
    container || document.body,
  );
}
