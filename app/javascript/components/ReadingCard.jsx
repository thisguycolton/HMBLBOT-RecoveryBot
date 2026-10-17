import React from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import TagBadge from "./TagBadge";
import { getAccentThemeFromIcon, getTagIcon } from "./ReadingArchiveUtils";

/**
 * ReadingCard - A card displaying a reading with tag-based visual identity.
 * The first tag sets the card's accent color and decorative icon.
 */
const ReadingCard = ({ reading }) => {
  const tags = reading.tags || [];
  const primaryTag = tags[0] || null;
  const accentTheme = getAccentThemeFromIcon(primaryTag?.icon_name, primaryTag?.slug || primaryTag?.title);
  const DecorativeIcon = primaryTag ? getTagIcon(primaryTag.icon_name, primaryTag.slug || primaryTag.title) : BookOpen;

  return (
    <article className="group relative overflow-hidden rounded-xl bg-white shadow-panel ring-1 ring-neutral-200/60 transition-shadow hover:shadow-lg dark:bg-neutral-900 dark:ring-neutral-800">
      <div className={`absolute inset-x-0 top-0 h-1 ${accentTheme.bar}`} />
      <div className="pointer-events-none absolute -bottom-5 -right-5 opacity-[0.06] transition-opacity group-hover:opacity-10">
        <DecorativeIcon className="h-40 w-40 text-slate-900 dark:text-white" strokeWidth={0.8} />
      </div>

      <a href={reading.path} className="relative z-10 block p-5" aria-label={`Open reading: ${reading.title}`}>
        <div className="mb-3 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
          {tags.slice(0, 4).map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
          {tags.length > 4 && <span className="shrink-0 px-2 py-1 text-xs font-medium text-slate-500 dark:text-neutral-400">+{tags.length - 4}</span>}
        </div>

        <h3 className="line-clamp-2 text-base font-semibold text-slate-900 dark:text-white">{reading.title}</h3>
        <p className="serif mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-neutral-400">{reading.preview}</p>

        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <cite className={`max-w-[150px] truncate text-xs not-italic ${accentTheme.text}`}>{reading.source || "Unknown source"}</cite>
          <span className={`ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:translate-x-1 ${accentTheme.iconBg} ${accentTheme.text}`}>
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </a>
    </article>
  );
};

export default ReadingCard;
