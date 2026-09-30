import React from "react";
import { getTagIcon, getAccentThemeFromIcon } from "./ReadingArchiveUtils";

/**
 * TagBadge - A single tag pill with icon and name.
 * Designed to be used within a flex container that handles overflow.
 */
const TagBadge = ({ tag, onClick, className = "" }) => {
  const IconComponent = getTagIcon(tag.icon_name);
  const accentTheme = getAccentThemeFromIcon(tag.icon_name);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${accentTheme.bg} ${accentTheme.border} border ${accentTheme.text} ${className}`}
      onClick={onClick}
    >
      <IconComponent className="h-3 w-3 shrink-0" strokeWidth={2.5} />
      <span className="truncate max-w-[4.5rem]">{tag.title}</span>
    </span>
  );
};

export default TagBadge;
