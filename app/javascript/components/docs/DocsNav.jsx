import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, EyeOff, Lock, Users } from "lucide-react";
import LucideIcon from "../ui/LucideIcon";
import { Bone, SkeletonGroup } from "../ui/Skeleton";
import { useDocs } from "./DocsApp";
import DocSearch from "./DocSearch";

// The docs' own sidebar: the search box, then every section with its pages. The section of
// the page you're on is open; any section can be opened or folded. Site admins see drafts
// (crossed eye), members-only and admins-only pages (marked) and unreviewed ones (a dot).
export default function DocsNav() {
  const { sections, loaded, editor } = useDocs();
  const { pathname } = useLocation();
  const current = sections?.find((s) => pathname === s.path || s.pages.some((p) => pathname === p.path || pathname.startsWith(`${p.docs_path}`)));
  const [open, setOpen] = useState({});
  useEffect(() => { if (current) setOpen((o) => ({ ...o, [current.id]: true })); }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <nav aria-label="Docs" className="text-sm">
      <Link to="/docs" className="mb-3 flex items-center gap-2 !text-slate-900 !no-underline dark:!text-white">
        <span className="text-base font-bold tracking-tight">RecoveryBot Docs</span>
      </Link>
      <DocSearch compact />
      {!loaded ? (
        <SkeletonGroup className="mt-5 space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Bone key={i} className="h-4 w-4/5" />)}
        </SkeletonGroup>
      ) : (
        <ul className="!m-0 mt-4 list-none space-y-0.5 !p-0">
          {sections.map((section) => {
            const isOpen = !!open[section.id];
            return (
              <li key={section.id}>
                <div className="flex items-center">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Fold" : "Open"} ${section.title}`}
                    onClick={() => setOpen((o) => ({ ...o, [section.id]: !isOpen }))}
                    className="grid size-7 shrink-0 place-items-center rounded-lg !bg-transparent !p-0 !text-slate-400 hover:!bg-neutral-100 dark:hover:!bg-neutral-800"
                  >
                    <ChevronRight size={15} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  <Link
                    to={section.path}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 font-semibold !no-underline ${
                      pathname === section.path ? "!text-accent dark:!text-accent-light" : "!text-slate-800 hover:!text-slate-950 dark:!text-neutral-100 dark:hover:!text-white"
                    }`}
                  >
                    <LucideIcon name={section.icon} size={15} className="shrink-0 opacity-70" />
                    <span className="truncate">{section.title}</span>
                  </Link>
                </div>
                {isOpen && (
                  <ul className="!m-0 mb-2 ml-[0.85rem] list-none border-l border-neutral-200 !py-0.5 !pl-2 dark:border-neutral-800">
                    {section.pages.map((page) => {
                      const active = pathname === page.path || pathname === page.docs_path;
                      return (
                        <li key={page.id}>
                          <Link
                            to={page.path}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 !no-underline ${
                              active
                                ? "bg-accent-tint font-semibold !text-accent dark:bg-accent/25 dark:!text-white"
                                : "!text-slate-600 hover:bg-neutral-100 hover:!text-slate-900 dark:!text-neutral-400 dark:hover:bg-neutral-800 dark:hover:!text-white"
                            }`}
                          >
                            <span className={`min-w-0 flex-1 truncate ${page.status === "draft" ? "italic opacity-70" : ""}`}>{page.title}</span>
                            {editor && page.status === "draft" && <EyeOff size={12} className="shrink-0 opacity-60" aria-label="Draft" />}
                            {page.audience === "members" && <Users size={12} className="shrink-0 opacity-50" aria-label="Members only" />}
                            {page.audience === "admins" && <Lock size={12} className="shrink-0 opacity-50" aria-label="Admins only" />}
                            {editor && !page.reviewed && <span className="size-1.5 shrink-0 rounded-full bg-amber-400" title="Not reviewed yet" />}
                          </Link>
                        </li>
                      );
                    })}
                    {!section.pages.length && <li className="px-2.5 py-1.5 text-xs text-slate-400">No pages yet</li>}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
