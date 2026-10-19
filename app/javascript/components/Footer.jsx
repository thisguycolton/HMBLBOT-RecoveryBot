import React, { useState } from "react";
import { Heart } from "lucide-react";
import { RecoveryBotLogo } from "./brand/Logo";
import DonationModal from "./DonationModal";
import { NAV_CATEGORIES, showItem } from "./nav/siteMenu";

const REPO = "https://github.com/thisguycolton/HMBLBOT-RecoveryBot";

// The site footer: the brand and donate button, then the same tool groups as the nav
// (components/nav/siteMenu.js) so a new tool shows up here without another edit.
export default function Footer() {
  const [donating, setDonating] = useState(false);
  const signedIn = document.body.dataset.currentUser === "true";
  const visible = (items) => items.filter((item) => showItem(item, signedIn));

  return (
    <footer className="mt-auto border-t border-white/10 bg-neutral-950 text-white !font-sans">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="inline-block !text-white !no-underline" aria-label="RecoveryBot home">
              <RecoveryBotLogo markClassName="h-8 w-auto" textClassName="text-xl" botClassName="text-brand-light" />
            </a>
            <div className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-400">
              Free tools for people in recovery, built to make meetings, readings and service a little easier.
            </div>
            <button
              type="button"
              onClick={() => setDonating(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold !bg-rose-500/15 !text-rose-300 ring-1 ring-rose-400/30 hover:!bg-rose-500/25"
            >
              <Heart size={15} className="fill-current" /> Help keep it running
            </button>
          </div>

          {NAV_CATEGORIES.map((category) => (
            <nav key={category.key} aria-label={category.label}>
              <h3 className="!mb-3 !text-sm font-semibold !text-white !font-sans">{category.label}</h3>
              <ul className="!m-0 !p-0 list-none space-y-2 text-sm">
                {visible(category.items).map((item) => (
                  <li key={item.href}>
                    <a href={item.href} className="!text-neutral-400 !no-underline hover:!text-white">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} RecoveryBot by HMBLBOT</div>
          <div className="flex flex-wrap gap-4">
            <a href="/privacy" className="!text-neutral-500 !no-underline hover:!text-white">Privacy</a>
            <a href="/contact" className="!text-neutral-500 !no-underline hover:!text-white">Contact</a>
            <a href={`${REPO}/issues/new`} target="_blank" rel="noreferrer" className="!text-neutral-500 !no-underline hover:!text-white">
              Report a problem
            </a>
            <a href={REPO} target="_blank" rel="noreferrer" className="!text-neutral-500 !no-underline hover:!text-white">
              GitHub
            </a>
          </div>
        </div>
      </div>
      <DonationModal isOpen={donating} onClose={() => setDonating(false)} />
    </footer>
  );
}
