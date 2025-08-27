// app/javascript/components/Navbar.jsx
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X, LogIn, LogOut } from "lucide-react";

export default function Navbar({
  isAuthenticated = false,
  // Optional: override paths if your routes differ
  rootPath = "/",
  topicificatorPath = "/topicificator",
  scratchpaperPath = "/host_helper/scratchpaper",
  gameServerGuidePath = "/game_server/getting_started",
  loginPath = "/users/sign_in",
  logoutPath = "/users/sign_out",
  brand = "HumbleBot",
  brandSubtitle = "Beta v0.5",   // NEW: pass null/"" to hide

}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);

  const extrasRef = useRef(null);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const onDoc = (e) => {
      if (!extrasRef.current) return;
      if (!extrasRef.current.contains(e.target)) setExtrasOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && (setExtrasOpen(false), setMobileOpen(false));

    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Rails CSRF helper for logout
  function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : "";
  }

  function LogoutButton({ className = "" }) {
    return (
      <form action={logoutPath} method="post" className={className}>
        <input type="hidden" name="_method" value="delete" />
        <input type="hidden" name="authenticity_token" value={csrfToken()} />
        <button
          type="submit"
          className="w-full items-center gap-2 rounded-md px-3 py-2
                     bg-slate-900 text-white hover:bg-slate-800
                     dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          title="Sign out"
        >
          <LogOut size={16} className="text-center md:text-start mx-auto md:mx-1" />
        </button>
      </form>
    );
  }

  const NavLink = ({ href, children }) => (
    <a
      href={href}
      className="px-3 py-2 rounded-md text-sm font-medium
                 text-slate-700 hover:text-slate-900 hover:bg-slate-100
                 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800"
    >
      {children}
    </a>
  );

  return (
    <nav id="site-nav" className="fixed top-0 inset-x-0 z-50 h-14 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-b border-slate-300 dark:border-slate-600"

      role="navigation"
      aria-label="Main"
    >
      <div className="mx-auto max-w-6xl px-3">
        <div className="flex h-14 items-center justify-between">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <a
              href={rootPath}
              className="text-lg font-semibold tracking-tight
                         text-slate-900 dark:text-white"
            >
              <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                {brand}
              </span>
              {brandSubtitle && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ps-2">
                  {brandSubtitle}
                </span>
              )}
            </a>

            {/* Desktop links */}
            <div className="ml-2 hidden md:flex items-center">
              <NavLink href={rootPath}>Home</NavLink>
              <NavLink href={topicificatorPath}>Topicificator 9002</NavLink>

              {/* Extras dropdown */}
              <div className="relative" ref={extrasRef}>
                <button
                  type="button"
                  onClick={() => setExtrasOpen((v) => !v)}
                  className="group inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium
                             text-slate-700 hover:text-slate-900 hover:bg-slate-100
                             dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800"
                  aria-expanded={extrasOpen}
                >
                  Extras
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${extrasOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Menu */}
                <div
                  className={`absolute left-0 mt-2 w-64 origin-top-left rounded-lg border
                              border-slate-200 bg-white p-2 shadow-lg
                              dark:border-slate-800 dark:bg-neutral-900
                              ${extrasOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95"}
                              transition-all duration-150`}
                >
                  <a
                    href={scratchpaperPath}
                    className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100
                               dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Scratchpaper
                  </a>
                  <a
                    href={gameServerGuidePath}
                    className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100
                               dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Game Server — Getting Started
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Auth & Mobile toggle */}
          <div className="flex items-center gap-2">
            {/* Auth */}
            <div className="hidden md:block">
              {isAuthenticated ? (
                <LogoutButton />
              ) : (
                <a
                  href={loginPath}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2
                             bg-slate-900 text-white hover:bg-slate-800
                             dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  title="Sign in"
                >
                  <LogIn size={16} />
                  <span className="hidden sm:inline">Login</span>
                </a>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center rounded-md p-2
                         text-slate-700 hover:bg-slate-100 hover:text-slate-900
                         dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-expanded={mobileOpen}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile panel */}
      <div
        className={`md:hidden border-t border-slate-200 dark:border-slate-800
                    transition-all duration-150 overflow-hidden  bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-b border-slate-300 dark:border-slate-600
                    ${mobileOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="mx-auto max-w-6xl px-3 py-3 space-y-1">
          <div className="rounded-md grid row-span-full">
            <NavLink href={rootPath}>Home</NavLink>
            <NavLink href={topicificatorPath}>Topicificator</NavLink>
          </div>
          {/* Extras (inline) */}
          <div className="rounded-md">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide
                            text-slate-500 dark:text-slate-400">
              Extras
            </div>
            <a
              href={scratchpaperPath}
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100
                         dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Scratchpaper
            </a>
            <a
              href={gameServerGuidePath}
              className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100
                         dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Game Server — Getting Started
            </a>
          </div>

          {/* Auth (inline) */}
          <div className="pt-2 grid row-span-full">
            {isAuthenticated ? (
              <LogoutButton className="w-full!" />
            ) : (
              <a
                href={loginPath}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2
                           bg-slate-900 text-white hover:bg-slate-800
                           dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <LogIn size={16} />
                Login
              </a>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}