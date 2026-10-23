import React, { createContext, useContext } from "react";

// "panel": the gray rounded frame with stacked panels and a blue band (DateTimePicker look).
// "card": one white bordered card with a plain header, the admin suite's look (metr-style).
// The admin suite sets "card" with <ShellStyle.Provider value="card">.
export const ShellStyle = createContext("panel");

// Gray rounded frame that holds stacked panels, like the DateTimePicker popup.
// The first and last panels always get the frame's rounded corners, so a stack that ends
// on a "middle" panel doesn't show square corners poking into the frame's curve.
export function Shell({ as: Tag = "section", className = "", children }) {
  if (useContext(ShellStyle) === "card") {
    return (
      <Tag className={`min-w-0 rounded-2xl border border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden flex flex-col divide-y divide-slate-200 dark:divide-neutral-800 ${className}`}>
        {children}
      </Tag>
    );
  }
  return (
    <Tag className={`bg-neutral-200 dark:bg-neutral-800 rounded-4xl p-3 shadow-lg flex flex-col gap-2 [&>:first-child]:rounded-t-panel [&>:last-child]:rounded-b-panel ${className}`}>
      {children}
    </Tag>
  );
}

// Corner radii are concentric with the shell (32px - 12px padding = 20px).
const PANEL_RADIUS = {
  top: "rounded-t-panel rounded-b-none",
  middle: "rounded-none",
  bottom: "rounded-b-panel rounded-t-none",
  single: "rounded-panel",
};

export function ShellPanel({ position = "single", className = "", children }) {
  if (useContext(ShellStyle) === "card") {
    return <div className={`bg-white dark:bg-neutral-900 overflow-hidden ${className}`}>{children}</div>;
  }
  return (
    <div className={`bg-white dark:bg-surface-dark shadow-panel overflow-hidden ${PANEL_RADIUS[position]} ${className}`}>
      {children}
    </div>
  );
}

// Blue header band, like the month bar on the calendar.
export function ShellBand({ icon: Icon, title, subtitle, position = "top" }) {
  if (useContext(ShellStyle) === "card") {
    return (
      <div className="px-5 sm:px-6 pt-5 pb-4 flex items-start gap-3">
        {Icon && (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-200">
            <Icon className="w-5 h-5" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="!text-lg font-semibold leading-tight text-slate-900 dark:text-white !font-sans">{title}</h2>
          {subtitle && <div className="text-sm text-slate-500 dark:text-neutral-400 mt-0.5 !font-sans">{subtitle}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className={`bg-accent text-white shadow-panel px-4 py-3 flex items-center gap-2 ${PANEL_RADIUS[position]}`}>
      {Icon && <Icon className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-tight !font-sans">{title}</h2>
        {subtitle && <p className="text-xs text-white/75 mt-0.5 !font-sans">{subtitle}</p>}
      </div>
    </div>
  );
}
