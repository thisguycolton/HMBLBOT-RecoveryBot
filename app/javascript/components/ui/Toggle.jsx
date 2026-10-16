import React from "react";

// An on/off switch with its label, for settings that used to be a checkbox.
export default function Toggle({ checked, onChange, label, description, disabled = false, id, className = "" }) {
  return (
    <label className={`inline-flex items-start gap-3 text-sm ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${className}`}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative mt-px inline-flex h-5 w-9 shrink-0 items-center rounded-full !p-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900 ${
          checked ? "!bg-accent" : "!bg-neutral-300 dark:!bg-neutral-600"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`}
        />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-slate-800 dark:text-neutral-200">{label}</span>}
          {description && <span className="block text-xs text-slate-500 dark:text-neutral-400">{description}</span>}
        </span>
      )}
    </label>
  );
}
