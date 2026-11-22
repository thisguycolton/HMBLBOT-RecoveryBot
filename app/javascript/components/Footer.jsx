import React, { useState } from "react";
import { Heart } from "lucide-react";
import { RecoveryBotLogo } from "./brand/Logo";
import DonationModal from "./DonationModal";
import { donationsShown, isNativeApp } from "../lib/nativeApp";
import { NAV_CATEGORIES, showItem } from "./nav/siteMenu";

const REPO = "https://github.com/thisguycolton/HMBLBOT-RecoveryBot";
// A plain link only: no Facebook widget, pixel or SDK loads here (see /privacy).
const FACEBOOK = "https://www.facebook.com/profile.php?id=61596034574607";

// Facebook's "f" mark (lucide dropped its brand icons), drawn in currentColor.
function FacebookMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}

// The site footer: the brand and donate button, then the same tool groups as the nav
// (components/nav/siteMenu.js) so a new tool shows up here without another edit. Light gray in
// light mode (the shell's own color), near-black in dark mode.
export default function Footer() {
  const [donating, setDonating] = useState(false);
  const signedIn = document.body.dataset.currentUser === "true";
  const visible = (items) => items.filter((item) => showItem(item, signedIn));

  return (
    <footer className="mt-auto print:hidden bg-[#ececec] text-slate-900 !font-sans dark:bg-neutral-950 dark:text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="inline-block !text-slate-900 !no-underline dark:!text-white" aria-label="RecoveryBot home">
              <RecoveryBotLogo markClassName="h-8 w-auto" textClassName="text-xl" botClassName="text-brand dark:text-brand-light" />
            </a>
            <div className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-neutral-400">
              Free tools for people in recovery, built to make meetings, readings and service a little easier.
            </div>
            {donationsShown() && (
              <button
                type="button"
                onClick={() => setDonating(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold !bg-rose-500/10 !text-rose-700 ring-1 ring-rose-400/40 hover:!bg-rose-500/20 dark:!bg-rose-500/15 dark:!text-rose-300 dark:ring-rose-400/30 dark:hover:!bg-rose-500/25"
              >
                <Heart size={15} className="fill-current" /> Help keep it running
              </button>
            )}
            <div className="mt-4">
              <a
                href={FACEBOOK}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="RecoveryBot on Facebook"
                title="RecoveryBot on Facebook"
                className="inline-flex items-center gap-1.5 text-sm font-medium !text-slate-600 !no-underline hover:!text-[#1877F2] dark:!text-neutral-400 dark:hover:!text-white"
              >
                <FacebookMark size={18} /> Follow on Facebook
              </a>
            </div>
          </div>

          {NAV_CATEGORIES.map((category) => (
            <nav key={category.key} aria-label={category.label}>
              <h3 className="!mb-3 !text-sm font-semibold !text-slate-900 !font-sans dark:!text-white">{category.label}</h3>
              <ul className="!m-0 !p-0 list-none space-y-2 text-sm">
                {visible(category.items).map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="!text-slate-600 !no-underline hover:!text-slate-900 dark:!text-neutral-400 dark:hover:!text-white">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-neutral-300/70 pt-6 text-xs text-slate-500 dark:border-white/10 dark:text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} RecoveryBot by HMBLBOT</div>
          <div className="flex flex-wrap gap-4">
            <a href="/docs" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-500 dark:hover:!text-white">Help &amp; docs</a>
            <a href="/about" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-500 dark:hover:!text-white">About</a>
            <a href="/history" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-500 dark:hover:!text-white">History</a>
            {!isNativeApp() && <a href="/install" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-500 dark:hover:!text-white">Get the app</a>}
            <a href="/privacy" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-500 dark:hover:!text-white">Privacy</a>
            <a href="/terms" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-500 dark:hover:!text-white">Terms</a>
            <a href="/contact" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-500 dark:hover:!text-white">Contact</a>
            <a href={`${REPO}/issues/new`} target="_blank" rel="noreferrer" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-500 dark:hover:!text-white">
              Report a problem
            </a>
            <a href={REPO} target="_blank" rel="noreferrer" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-500 dark:hover:!text-white">
              GitHub
            </a>
            <a href={FACEBOOK} target="_blank" rel="noopener noreferrer" className="!text-slate-500 !no-underline hover:!text-slate-900 dark:!text-neutral-500 dark:hover:!text-white">
              Facebook
            </a>
          </div>
        </div>
      </div>
      <DonationModal isOpen={donating} onClose={() => setDonating(false)} />
    </footer>
  );
}
