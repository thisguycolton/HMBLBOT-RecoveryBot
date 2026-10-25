import React from "react";
import TopBar from "./shell/TopBar";
import { ChromeSheets, useChrome } from "./shell/Chrome";
import { usePath, useNav, useTheme } from "./shell/useShell";

// The shell's top bar on its own, for the tools that take the whole window (the chapter
// editor, a reading's editor, the Topicificator's own pages): the logo, search and account,
// with the sidebar's links behind the menu button. Everything else sits in Layout.
export default function Navbar({ isAuthenticated = false }) {
  const nav = useNav();
  const theme = useTheme();
  const path = usePath();
  const chrome = useChrome();
  return (
    <>
      <div className={`fixed inset-x-0 top-0 ${chrome.open ? "z-[2100]" : "z-50"} h-[var(--nav-h)] border-b border-neutral-300/70 bg-[#ececec]/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 print:!hidden`}>
        <TopBar nav={nav} isAuthenticated={isAuthenticated} theme={theme} alwaysMenu withLogo
          onMenu={() => chrome.show("menu")} onSearch={() => chrome.show("search")} onDonate={() => chrome.show("donate")} onCourt={() => chrome.show("court")} />
      </div>
      <ChromeSheets chrome={chrome} nav={nav} isAuthenticated={isAuthenticated} theme={theme} path={path} />
    </>
  );
}
