import React from "react";

export default function Footer() {
  return (
    <footer className="bg-neutral-950 text-white mt-auto border-t border-white/10">
  <div className="max-w-6xl mx-auto px-4 py-12">

    <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">

      {/* HMBLBOT */}
      <div>
        <img
          src="https://humblebot.s3.us-west-2.amazonaws.com/hmblbotLOGOsmBLUE.png"
          className="w-16 mb-4"
          alt="HumbleBot Logo"
        />

        <h3 className="font-bold text-lg">
          HMBLBOT
        </h3>

        <p className="mt-2 text-xs text-neutral-400 sans">
          Tools for people in recovery, built to make meetings,
          readings, and service a little easier.
        </p>
      </div>

      {/* Tools */}
      <div>
        <h3 className="font-semibold mb-4">
          Recovery Tools
        </h3>

        <div className="space-y-2 text-sm text-neutral-400">
          <a href="/topicificator" className="block hover:text-white">
            Topicificator 9002
          </a>

          <a href="/readings" className="block hover:text-white">
            Reading Archive
          </a>

          <a href="/service_readings" className="block hover:text-white">
            Service Readings
          </a>

          <a href="/host_helper/scratchpaper" className="block hover:text-white">
            Scratchpaper
          </a>
        </div>
      </div>

      {/* Project */}
      <div>
        <h3 className="font-semibold mb-4">
          Project
        </h3>

        <div className="space-y-2 text-sm text-neutral-400">
          <a href="/about" className="block hover:text-white">
            About HMBLBOT
          </a>

          <a href="/contact" className="block hover:text-white">
            Contact / Feedback
          </a>

          <a href="/report" className="block hover:text-white">
            Report a Problem
          </a>

          <a
            href="https://github.com/thisguycolton/HMBLBOT-RecoveryBot"
            className="block hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>

      {/* Support */}
      <div>
        <h3 className="font-semibold mb-4">
          Support HMBLBOT
        </h3>

        <p className="text-xs text-neutral-400 mb-4 sans">
          HMBLBOT is free to use. If it has been useful to you,
          you can help keep it running.
        </p>

        <a href="https://www.buymeacoffee.com/hmblbot" target="_blank" rel="noreferrer">
          <img
            src="https://img.buymeacoffee.com/button-api/?text=Support HMBLBOT&emoji=🤖&slug=hmblbot&button_colour=5F7FFF&font_colour=ffffff&font_family=Arial&outline_colour=000000&coffee_colour=FFDD00"
            alt="Support HMBLBOT"
          />
        </a>
      </div>

    </div>

    {/* Bottom */}
    <div className="mt-10 border-t border-white/10 pt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-xs text-neutral-500">

      <div>
        © 2026 HMBLBOT
      </div>

      <div className="flex flex-wrap gap-4">
        <a href="/privacy" className="hover:text-white">
          Privacy
        </a>

        <a href="/terms" className="hover:text-white">
          Terms
        </a>

        <a href="/disclaimer" className="hover:text-white">
          Disclaimer
        </a>
      </div>

    </div>

  </div>
</footer>
  );
}