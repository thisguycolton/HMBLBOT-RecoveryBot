import React from "react";

// Small pieces shared by the Groups pages

export function Message({ title, text, children }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center !font-sans">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
      {text && <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400">{text}</p>}
      {children}
    </div>
  );
}

export const Loading = () => <p className="py-16 text-center !font-sans text-sm text-slate-500">Loading…</p>;

// !bg: the reader styles give every <button> a gray fill
export const primaryButton =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl !bg-accent px-3.5 py-2 text-sm font-semibold !text-white shadow-panel hover:opacity-90 disabled:opacity-50";
export const quietButton =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl !bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-neutral-200 hover:!bg-neutral-50 disabled:opacity-50 dark:!bg-neutral-900 dark:text-neutral-200 dark:ring-neutral-700 dark:hover:!bg-neutral-800";
export const dangerButton =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl !bg-transparent px-3 py-2 text-sm font-medium text-rose-700 hover:!bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:!bg-rose-950/40";
export const linkButton = "!bg-transparent p-0 text-sm font-medium text-accent hover:underline";

export function ErrorNote({ error }) {
  if (!error) return null;
  return <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>;
}

export function Pill({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300",
    accent: "bg-accent/10 text-accent dark:bg-accent/25 dark:text-white",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

// The open Writebook-style section: an uppercase label over a soft gray tray
export function Tray({ label, action, children, className = "" }) {
  return (
    <section className={className}>
      {(label || action) && (
        <div className="mb-2 flex items-center justify-between gap-3">
          {label && <h2 className="!text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{label}</h2>}
          {action}
        </div>
      )}
      <div className="nest-tray rounded-3xl bg-neutral-100 p-1.5 dark:bg-neutral-800/70">{children}</div>
    </section>
  );
}

// On the shell's white stage a card is set off by a hairline as much as by its shadow
export function Card({ children, className = "", ref, ...rest }) {
  return <div ref={ref} {...rest} className={`rounded-2xl bg-white shadow-panel ring-1 ring-neutral-200/80 dark:bg-neutral-900 dark:ring-neutral-800 ${className}`}>{children}</div>;
}

export function copy(text, done) {
  navigator.clipboard?.writeText(text).then(done, () => window.prompt("Copy this link:", text));
}
