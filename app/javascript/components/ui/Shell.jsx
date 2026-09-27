import React from "react";

// Gray rounded frame that holds stacked panels, like the DateTimePicker popup.
export function Shell({ as: Tag = "section", className = "", children }) {
  return (
    <Tag className={`bg-neutral-200 dark:bg-neutral-800 rounded-4xl p-3 shadow-lg flex flex-col gap-2 ${className}`}>
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
  return (
    <div className={`bg-white dark:bg-surface-dark shadow-panel overflow-hidden ${PANEL_RADIUS[position]} ${className}`}>
      {children}
    </div>
  );
}

// Blue header band, like the month bar on the calendar.
export function ShellBand({ icon: Icon, title, subtitle, position = "top" }) {
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
