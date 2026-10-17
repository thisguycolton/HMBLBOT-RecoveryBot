import React from "react";

const COLORS = ["bg-sky-600", "bg-emerald-600", "bg-amber-600", "bg-rose-600", "bg-violet-600", "bg-teal-600", "bg-orange-600", "bg-indigo-600"];

// A member's picture, or their initials on a color picked from their name
export default function Avatar({ person, size = 40, className = "" }) {
  const name = person?.name || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (person?.avatar_url) {
    return <img src={person.avatar_url} alt="" style={style} className={`shrink-0 rounded-full object-cover ${className}`} />;
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  const color = COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];
  return (
    <span style={style} aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${color} ${className}`}>
      {initials}
    </span>
  );
}
