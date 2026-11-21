import React, { useEffect, useMemo, useState } from "react";

// Share a fun day-count fact as a picture, inside the day count modal (DayCount): pick a look
// and a size, see it, then hand it to the phone's share sheet (Messages, Instagram, a story...),
// save it, or copy its link. The picture is drawn on our server (FactCard, GET /facts/:days/card)
// and the link (/facts/:days) shows the same picture as its preview. Neither says whose day
// count it is. Plain CSS (day-count.css), since the modal mounts on the older Bootstrap pages too.
const LOOKS = [
  { value: "color", label: "Color" },
  { value: "night", label: "Night" },
  { value: "paper", label: "Paper" },
  { value: "sunrise", label: "Sunrise" },
];
const SWATCHES = {
  color: { space: "#1e1b4b,#7c3aed", nature: "#064e3b,#10b981", history: "#7c2d12,#f59e0b", numbers: "#172554,#0ea5e9", body: "#881337,#fb7185" },
  night: "#0b1020,#1e293b",
  paper: "#fdfaf3,#f1e7d3",
  sunrise: "#f97316,#db2777",
};
const SIZES = [
  { value: "square", label: "Post", ratio: "1 / 1" },
  { value: "story", label: "Story", ratio: "9 / 16" },
];

export default function FactShare({ fact, onBack }) {
  const [look, setLook] = useState("color");
  const [size, setSize] = useState("square");
  const [picture, setPicture] = useState(null); // { url, blob } once drawn
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const src = `/facts/${fact.days}/card?look=${look}&size=${size}`;
  const link = useMemo(() => `${window.location.origin}/facts/${fact.days}${look === "color" ? "" : `?look=${look}`}`, [fact.days, look]);
  const label = `${fact.days.toLocaleString()} ${fact.days === 1 ? "day" : "days"}`;
  // Some titles are just the count ("2,000 days"); then the detail says what's fun about it
  const text = fact.title === label ? `${label}: ${fact.detail}` : `${label}: ${fact.title}`;

  useEffect(() => {
    const stop = new AbortController();
    let url;
    setFailed(false);
    fetch(src, { signal: stop.signal })
      .then((res) => { if (!res.ok) throw new Error(); return res.blob(); })
      .then((blob) => { url = URL.createObjectURL(blob); setPicture({ url, blob }); })
      .catch((e) => { if (e?.name !== "AbortError") setFailed(true); });
    return () => { stop.abort(); if (url) URL.revokeObjectURL(url); };
  }, [src]);

  const file = () => new File([picture.blob], `recoverybot-fun-fact-${fact.days}.png`, { type: "image/png" });
  const canShareFiles = typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  const canShare = typeof navigator.share === "function";

  // The picture itself where the phone can take it, with the link under it; else just the link
  const share = async () => {
    if (busy || !picture) return;
    setBusy(true);
    try {
      if (canShareFiles) await navigator.share({ files: [file()], title: text, text: `${text}\n${link}` });
      else await navigator.share({ title: text, text, url: link });
    } catch { /* closed the share sheet */ }
    setBusy(false);
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(link); } catch { window.prompt("Copy this link:", link); }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const swatch = (l) => {
    const colors = l === "color" ? SWATCHES.color[fact.topic] || SWATCHES.color.numbers : SWATCHES[l];
    return `linear-gradient(135deg,${colors})`;
  };

  return (
    <div className="hb-factshare">
      <button type="button" className="hb-factshare__back" onClick={onBack}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg> Back
      </button>
      {/* the dialog's name while the day count's head steps aside (DayCount) */}
      <h2 id="hb-daycount-title" className="hb-factshare__title">Share this fun fact</h2>
      <div className={`hb-factshare__stage hb-factshare__stage--${size}`}>
        {picture && !failed ? (
          <img src={picture.url} alt={text} style={{ aspectRatio: SIZES.find((s) => s.value === size).ratio }} />
        ) : (
          <div className="hb-factshare__placeholder" style={{ aspectRatio: SIZES.find((s) => s.value === size).ratio }}>
            {failed ? "Couldn't draw that one. Try another look." : "Drawing it…"}
          </div>
        )}
      </div>
      <div className="hb-factshare__looks" role="group" aria-label="Look">
        {LOOKS.map((l) => (
          <button key={l.value} type="button" aria-pressed={look === l.value} onClick={() => setLook(l.value)}>
            <span style={{ background: swatch(l.value) }} />{l.label}
          </button>
        ))}
      </div>
      <div className="hb-factshare__sizes" role="group" aria-label="Size">
        {SIZES.map((s) => (
          <button key={s.value} type="button" aria-pressed={size === s.value} onClick={() => setSize(s.value)}>{s.label}</button>
        ))}
      </div>
      <div className="hb-factshare__actions">
        {canShare && (
          <button type="button" className="hb-daycount__button hb-daycount__button--primary" onClick={share} disabled={busy || !picture}>
            {canShareFiles ? "Share picture…" : "Share link…"}
          </button>
        )}
        <a className={`hb-daycount__button${canShare ? "" : " hb-daycount__button--primary"}`} href={`${src}&download=1`} download>Save picture</a>
        <button type="button" className="hb-daycount__button" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button>
      </div>
      <p className="hb-factshare__note">It doesn't say whose day count it is. Anyone with the link sees this fun fact.</p>
    </div>
  );
}
