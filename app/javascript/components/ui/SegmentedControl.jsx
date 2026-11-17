import React from "react";

// Equal-width segmented bar, like the Today / Tomorrow / ✓ row in the DateTimePicker.
// Four or more choices with longer names are two to a row on a phone, so their words aren't
// squeezed a word a line.
const ONE_ROW = "flex items-stretch divide-x divide-neutral-200 dark:divide-neutral-700";
const TWO_A_ROW = "grid grid-cols-2 sm:flex sm:items-stretch sm:divide-x sm:divide-neutral-200 sm:dark:divide-neutral-700 [&>*]:border-neutral-200 dark:[&>*]:border-neutral-700 max-sm:[&>*:nth-child(even)]:border-l max-sm:[&>*:nth-child(n+3)]:border-t max-sm:[&>*:last-child:nth-child(odd)]:col-span-2";

export default function SegmentedControl({ options, value, onChange, onConfirm, confirmIcon: ConfirmIcon, confirmLabel = "Apply" }) {
  const crowded = !onConfirm && options.length >= 4 && options.some((o) => typeof o.label === "string" && o.label.length > 9);
  return (
    <div className={crowded ? TWO_A_ROW : ONE_ROW}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange?.(option.value)}
            aria-pressed={isActive}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-3 text-sm transition-colors ${
              isActive
                ? "bg-accent-tint text-accent-ink font-semibold dark:bg-accent/35 dark:text-white"
                : "font-medium text-slate-900 dark:text-neutral-300 hover:bg-accent/5 dark:hover:bg-white/5"
            }`}
          >
            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-accent dark:bg-white" aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
      {onConfirm && (
        <button
          type="button"
          onClick={onConfirm}
          title={confirmLabel}
          className="w-14 shrink-0 inline-flex items-center justify-center bg-accent text-white font-semibold hover:opacity-90 transition-opacity"
        >
          {ConfirmIcon ? <ConfirmIcon className="w-4 h-4" strokeWidth={3} /> : confirmLabel}
        </button>
      )}
    </div>
  );
}
