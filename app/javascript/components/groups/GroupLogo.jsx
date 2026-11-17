import React from "react";

// The group's logo in its very rounded square, or its initials when it has none
export default function GroupLogo({ group, url = group?.logo_url, className = "size-12 text-base" }) {
  const initials = (group?.title || "?").split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w) && !/^(the|of|and)$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  return url
    ? <img src={url} alt="" className={`shrink-0 rounded-[28%] object-cover ${className}`} />
    : <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-[28%] bg-gradient-to-br from-accent to-indigo-600 font-bold text-white ${className}`}>{initials}</span>;
}

