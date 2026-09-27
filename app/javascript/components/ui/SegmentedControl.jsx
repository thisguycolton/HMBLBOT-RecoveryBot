import React from "react";

// Equal-width segmented bar, like the Today / Tomorrow / ✓ row in the DateTimePicker.
export default function SegmentedControl({ options, value, onChange, onConfirm, confirmIcon: ConfirmIcon, confirmLabel = "Apply" }) {
  return (
    <div className="flex items-stretch divide-x divide-neutral-200 dark:divide-neutral-700">
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
