import React, { useMemo } from "react";
import TagBadge from "./TagBadge";
import { getTagIcon, getAccentThemeFromIcon } from "./ReadingArchiveUtils";

/**
 * ReadingCard - A card displaying a reading with tag-based visual identity.
 * The first tag determines the card's accent color and decorative icon.
 */
const ReadingCard = ({ reading }) => {
  const tags = reading.tags || [];
  const primaryTag = tags[0] || null;
  
  // Get visual theme from first tag
  const accentTheme = useMemo(() => {
    if (primaryTag) {
      return getAccentThemeFromIcon(primaryTag.icon_name);
    }
    // Default neutral theme if no tags
    return {
      bg: "bg-slate-500/10",
      border: "border-slate-500/30",
      text: "text-slate-400",
      iconBg: "bg-slate-500/20",
      gradient: "from-slate-500/5",
    };
  }, [primaryTag]);

  // Get decorative icon component from first tag
  const DecorativeIcon = useMemo(() => {
    if (primaryTag) {
      return getTagIcon(primaryTag.icon_name);
    }
    // Default book icon for readings without tags
    return ({ className }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeWidth="2" strokeLinecap="round" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeWidth="2" />
      </svg>
    );
  }, [primaryTag]);

  return (
    <article className="group relative overflow-hidden rounded-xl transition-all duration-300 hover:shadow-2xl">
      {/* Dimensional background with gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accentTheme.gradient} to-white/5`} />
      <div className="absolute inset-0 bg-slate-900/60" />
      
      {/* Accent border top */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${accentTheme.bg.replace("/10", "")}`} />
      
      {/* Decorative background icon - large, positioned lower-right */}
      <div className="absolute bottom-[-20px] right-[-20px] opacity-5 group-hover:opacity-10 transition-opacity duration-300">
        <DecorativeIcon className="h-40 w-40 text-white" strokeWidth={0.8} />
      </div>

      {/* Card content */}
      <a href={reading.path} className="block p-5 relative z-10" aria-label={`Open reading: ${reading.title}`}>
        {/* Tag row - single line, never wraps */}
        <div className="flex flex-nowrap items-center gap-1.5 mb-3 min-w-0 overflow-hidden">
          {tags.slice(0, 4).map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
          {tags.length > 4 && (
            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-slate-400 shrink-0">
              +{tags.length - 4}
            </span>
          )}
        </div>

        {/* Title - more prominent */}
        <h3 className="text-base font-bold uppercase tracking-wide text-slate-100 group-hover:text-white line-clamp-2">
          {reading.title}
        </h3>

        {/* Excerpt */}
        <p className="mt-3 text-sm leading-relaxed text-slate-400 line-clamp-3 serif">
          {reading.preview}
        </p>

        {/* Metadata footer */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-700/50 pt-3">
          {/* Source */}
          <cite className={`not-italic text-xs truncate max-w-[150px] ${accentTheme.text}`}>
            {reading.source || "Unknown Source"}
          </cite>
          
          {/* Arrow indicator in circular button */}
          <span className={`ml-2 shrink-0 transform transition-transform duration-300 group-hover:translate-x-1 ${accentTheme.text}`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${accentTheme.iconBg}`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </span>
        </div>
      </a>

      {/* Hover gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accentTheme.gradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
    </article>
  );
};

export default ReadingCard;
