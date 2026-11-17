import React from "react";
import { Bone, SkeletonGroup } from "../../ui/Skeleton";

// Whether the page is dark: each person's own pick (View > Dark page, kept in this browser), or
// the site's until they pick. DocumentSheet and the skeleton both ask this, so they match.
export function prefersDarkPaper() {
  let paper = "";
  try { paper = localStorage.getItem("doc-paper") || ""; } catch {}
  return paper ? paper === "dark" : document.documentElement.classList.contains("dark");
}

// The desk around the page: DocumentSheet's own wrapper, so the skeleton sits exactly where
// the page will
export const deskClass = ({ dark, embedded, fullScreen = false }) => `${dark ? "doc-dark " : ""}${fullScreen
  ? "doc-desk doc-fullscreen fixed inset-0 z-[2200] overflow-y-auto px-2 pb-16 sm:px-4"
  : embedded ? "doc-desk min-h-[calc(100dvh-var(--nav-h))] px-2 pb-16 sm:px-4"
  : "doc-desk -mx-4 -mt-1 rounded-2xl px-2 pb-10 sm:mx-0 sm:px-4"}`;
export const chromeClass = ({ embedded, fullScreen = false }) => `doc-chrome z-20 -mx-2 mb-6 space-y-px border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 print:hidden ${fullScreen
  ? "sticky top-0 sm:-mx-4" : embedded ? "sticky top-[var(--nav-h)] sm:-mx-4" : "sm:sticky sm:top-[var(--nav-h,56px)] sm:-mx-4 sm:rounded-t-2xl"}`;

// The toolbar's groups of buttons, as bones: [buttons in the group, wide first one]
const TOOL_GROUPS = [[2], [1, "w-28"], [6], [4], [4], [2]];

// A document loading (DocumentPage): the menu bar, the toolbar (for someone who can edit), and a
// sheet of paper with a title, a byline and paragraphs, all in the same frame as the real page,
// so nothing jumps when it arrives.
export default function DocumentSkeleton({ embedded = false, toolbar = true }) {
  const dark = prefersDarkPaper();
  const paperBone = dark ? { "--skullet-base": "rgb(255 255 255 / 0.08)", "--skullet-highlight": "rgb(255 255 255 / 0.14)" } : { "--skullet-base": "rgb(15 23 42 / 0.07)", "--skullet-highlight": "rgb(15 23 42 / 0.12)" };
  const P = ({ className }) => <Bone className={`h-3.5 ${className}`} style={paperBone} />;
  return (
    <SkeletonGroup label="Loading the document" className={deskClass({ dark, embedded })}>
      <div className={chromeClass({ embedded })}>
        {/* the same row as the page's: back, File Edit View Insert, the status, share, history, Save (which wraps under on a phone) */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5">
          <span className="grid size-8 place-items-center"><Bone className="size-4" rounded="rounded" /></span>
          <span className="flex shrink-0 items-center">
            {["w-6", "w-6", "w-8", "w-10"].map((w, i) => <span key={i} className="flex h-7 items-center px-2.5"><Bone className={`h-3.5 ${w}`} /></span>)}
          </span>
          <span className="flex min-w-0 flex-1 items-center"><Bone className="h-3 w-40 max-w-full" /></span>
          <span className="grid size-8 place-items-center"><Bone className="size-4" rounded="rounded" /></span>
          <span className="grid size-8 place-items-center"><Bone className="size-4" rounded="rounded" /></span>
          {toolbar && <Bone className="h-9 w-36" rounded="rounded-xl" />}
        </div>
        {toolbar && (
          <div className="flex flex-nowrap items-center gap-0.5 overflow-hidden px-2 py-1.5">
            {TOOL_GROUPS.map(([n, wide], g) => (
              <React.Fragment key={g}>
                {g > 0 && <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-neutral-300 dark:bg-neutral-600" />}
                {Array.from({ length: n }, (_, i) => (
                  <span key={i} className={`grid h-8 shrink-0 place-items-center ${wide && i === 0 ? wide : "w-8"}`}>
                    <Bone className={wide && i === 0 ? "h-8 w-full" : "size-4"} rounded={wide ? "rounded-lg" : "rounded"} />
                  </span>
                ))}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      <div className="mx-auto max-w-[816px]">
        <div className="mx-auto w-full max-w-[816px] min-w-0">
          <div className="doc-paper">
            <Bone className="h-9 w-3/5 sm:h-10" rounded="rounded-xl" style={paperBone} />
            <div className="doc-meta"><Bone className="h-3 w-44" style={paperBone} /></div>
            <div className="space-y-3">
              <P className="w-full" /><P className="w-11/12" /><P className="w-full" /><P className="w-2/5" />
            </div>
            <Bone className="mt-9 h-5 w-1/3" rounded="rounded-lg" style={paperBone} />
            <div className="mt-4 space-y-3">
              <P className="w-full" /><P className="w-10/12" /><P className="w-full" /><P className="w-11/12" /><P className="w-3/5" />
            </div>
            <div className="mt-7 space-y-3">
              <P className="w-full" /><P className="w-9/12" /><P className="w-1/2" />
            </div>
          </div>
        </div>
      </div>
    </SkeletonGroup>
  );
}
