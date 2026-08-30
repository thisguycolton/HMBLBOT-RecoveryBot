import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export default function DonationModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donation-modal-title"
    >
      {/* Full-screen backdrop */}
      <button
        type="button"
        aria-label="Close donation dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60"
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-neutral-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-sky-800 px-6 py-8 text-center text-white md:px-8">
          <div className="mb-3 text-4xl">
            ☕
          </div>

          <h2
            id="donation-modal-title"
            className="text-2xl font-bold md:text-3xl"
          >
            Support HMBLBOT
          </h2>

          <p className="mt-2 text-sky-100 !text-center sans">
            Help keep recovery resources free and accessible.
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-7 text-neutral-700 dark:text-neutral-200 md:px-8">
          <div className="space-y-4 text-base leading-relaxed sans">
            <p className="sans">
              HMBLBOT is built to make recovery literature, readings, and
              meetings easier to find and share.
            </p>

            <p className="sans">
              It takes time, hosting, development, and a whole lot of little
              things behind the scenes to keep a project like this running.
            </p>

            <p className="sans">
              <strong>
                If HMBLBOT has been useful to you, you can help keep it going.
              </strong>
            </p>

            <p className="sans">
              Donations aren't required, and there is never any obligation to
              contribute. If you're able and you'd like to help, even a small
              contribution makes a difference.
            </p>
          </div>

          {/* Donation CTA */}
          
        </div>

        {/* Footer */}
        <div className="flex justify-center border-t border-neutral-200  dark:border-neutral-800 bg-gradient-to-r from-amber-600 to-amber-800">
          <div className="my-5 rounded-2xl bg-sky-50/80 p-5 text-center dark:bg-sky-950/50">
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-300 !text-center sans">
              Want to help support the project?
            </p>

            <a
              href="https://buymeacoffee.com/hmblbot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-sky-600 px-6 py-3 font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
            >
              ☕ Buy Me a Coffee
            </a>
          
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2.5 font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              Maybe Later
            </button>

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}