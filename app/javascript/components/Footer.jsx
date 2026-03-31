import React from "react";

export default function Footer() {
  return (
    <footer className="bg-neutral-900 text-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Left */}
          <div className="text-sm text-neutral-400 text-center md:text-left">
            © 2026 <span className="font-bold text-white">HMBLBOT</span>
          </div>

          {/* Center */}
          <a
            href="/"
            className="flex flex-col items-center text-center"
          >
            <img
              src="https://humblebot.s3.us-west-2.amazonaws.com/hmblbotLOGOsmBLUE.png"
              className="w-20 opacity-80"
              alt="HumbleBot Logo"
            />
            <p className="text-sm text-neutral-400 mt-1 ttSans italic!">
              Powered By
            </p>
            <p className="tracking-widest font-bold ttSans text-md ">
              HMBLBOT
            </p>
          </a>

          {/* Right */}
          <div className="flex justify-center md:justify-end">
            <a
              href="https://discord.gg/mBkUUwH7hd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xl hover:text-cyan-400 transition"
            >
              <i className="bi bi-discord"></i>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}