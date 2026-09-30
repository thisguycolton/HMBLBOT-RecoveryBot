import React, { useCallback, useEffect, useState } from "react";
import { Download, FileCheck, Mail, Printer, Search } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import { api } from "../topicificator_admin/api";
import { Flash, buttonClass } from "../topicificator_admin/App";

// Look up court attendance verifications by name, email and meeting dates, then hand the
// matches over as a printable PDF, a CSV, or one email. Filters live in the URL so a lookup
// can be bookmarked or shared with another admin.
const FILTERS = ["name", "email", "from", "to"];

function filtersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(FILTERS.map((key) => [key, params.get(key) || ""]));
}

function queryString(filters) {
  const params = new URLSearchParams();
  FILTERS.forEach((key) => filters[key] && params.set(key, filters[key]));
  return params.toString();
}

export default function CourtVerificationsAdmin() {
  const [draft, setDraft] = useState(filtersFromUrl);
  const [filters, setFilters] = useState(filtersFromUrl);
  const [result, setResult] = useState(null);
  const [flash, setFlash] = useState(null);

  const load = useCallback(async (current) => {
    setResult(null);
    try {
      const qs = queryString(current);
      setResult(await api(`/court_verifications${qs ? `?${qs}` : ""}`));
    } catch (e) {
      setFlash({ type: "error", text: e.message });
    }
  }, []);

  useEffect(() => { load(filters); }, [filters, load]);

  function search(e) {
    e.preventDefault();
    const qs = queryString(draft);
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    setFlash(null);
    setFilters({ ...draft });
  }

  const qs = queryString(filters);
  const suffix = qs ? `?${qs}` : "";
  const total = result?.total ?? 0;

  return (
    <>
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-6 pt-20 pb-8 w-full mt-6">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-accent-tint dark:bg-accent/30 shadow-panel flex items-center justify-center shrink-0">
            <FileCheck className="w-5 h-5 text-accent dark:text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="!text-xl !leading-tight font-semibold text-slate-900 dark:text-white !font-sans">Court verifications</h1>
            <p className="text-sm text-slate-600 dark:text-neutral-400 mt-0.5 !font-sans">
              Find someone's attendance verifications and print, download or email them all at once.
            </p>
          </div>
        </div>
      </header>

      <div className="bg-slate-50 dark:bg-neutral-950 px-4 min-[1400px]:px-8 py-6 min-h-[70vh]">
        <div className="max-w-7xl mx-auto space-y-6">
          {flash && <Flash flash={flash} onClose={() => setFlash(null)} />}

          <Shell>
            <ShellBand icon={Search} title="Find verifications" subtitle="Names and emails match partly, ignoring case. Dates are meeting days in Phoenix time, inclusive." />
            <ShellPanel position="bottom" className="p-4">
              <form onSubmit={search} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1fr_auto] items-end">
                <Field label="Name" value={draft.name} placeholder="e.g. Avelar" onChange={(name) => setDraft({ ...draft, name })} />
                <Field label="Email" value={draft.email} placeholder="any part of it" onChange={(email) => setDraft({ ...draft, email })} />
                <Field label="From" type="date" value={draft.from} onChange={(from) => setDraft({ ...draft, from })} />
                <Field label="To" type="date" value={draft.to} onChange={(to) => setDraft({ ...draft, to })} />
                <button type="submit" className={buttonClass.primary}>
                  <Search className="w-4 h-4" strokeWidth={2.5} /> Search
                </button>
              </form>
            </ShellPanel>
          </Shell>

          <Shell>
            <ShellBand
              icon={FileCheck}
              title={result ? `${total} ${total === 1 ? "verification" : "verifications"}` : "Loading…"}
              subtitle={result && total > result.limit ? `Showing the newest ${result.limit}. Print, CSV and email include every match.` : "Newest meeting first"}
            />
            <ShellPanel position="middle" className="p-4 flex flex-wrap gap-2">
              <a href={`/admin_panel/court_verifications/print${suffix}`} target="_blank" rel="noopener" className={`${buttonClass.secondary} ${total ? "" : "pointer-events-none opacity-50"}`}>
                <Printer className="w-4 h-4" /> Print / Save as PDF
              </a>
              <a href={`/api/admin/court_verifications.csv${suffix}`} className={`${buttonClass.secondary} ${total ? "" : "pointer-events-none opacity-50"}`}>
                <Download className="w-4 h-4" /> Download CSV
              </a>
              <EmailBundle filters={filters} total={total} notify={(text, type = "info") => setFlash({ type, text })} />
            </ShellPanel>
            <ShellPanel position="bottom" className="overflow-x-auto">
              <Results result={result} />
            </ShellPanel>
          </Shell>
        </div>
      </div>
    </>
  );
}

function Field({ label, onChange, ...props }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input className={inputClass} onChange={(e) => onChange(e.target.value)} {...props} />
    </label>
  );
}

function Results({ result }) {
  if (!result) return <p className="p-8 text-center text-sm text-slate-500 dark:text-neutral-400 !font-sans">Loading…</p>;
  if (!result.court_verifications.length) {
    return <p className="p-8 text-center text-sm text-slate-500 dark:text-neutral-400 !font-sans">No verifications match these filters.</p>;
  }
  const th = "px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";
  const td = "px-4 py-2 align-top text-slate-800 dark:text-neutral-200";
  return (
    <table className="w-full text-sm !font-sans">
      <thead className="border-b border-neutral-200 dark:border-neutral-700">
        <tr>
          <th className={th}>Meeting</th>
          <th className={th}>Name</th>
          <th className={th}>Email</th>
          <th className={th}>Topic</th>
          <th className={th}>Host</th>
          <th className={th}>Signed by</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {result.court_verifications.map((v) => (
          <tr key={v.id}>
            <td className={`${td} whitespace-nowrap`}>{v.meeting_time_label}</td>
            <td className={td}>{v.respondent_name}</td>
            <td className={td}>{v.respondent_email}</td>
            <td className={td}>{v.topic}</td>
            <td className={td}>{v.host_name}</td>
            <td className={td}>{v.signer_name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Sends every match in one email to an address the admin types, after a confirm.
function EmailBundle({ filters, total, notify }) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);

  async function send(e) {
    e.preventDefault();
    if (!window.confirm(`Email all ${total} matching ${total === 1 ? "verification" : "verifications"} to ${recipient}?`)) return;
    setSending(true);
    try {
      const data = await api("/court_verifications/send_bundle", { method: "POST", body: { ...filters, recipient } });
      notify(`Sent ${data.sent} ${data.sent === 1 ? "verification" : "verifications"} to ${data.recipient}.`);
      setOpen(false);
      setRecipient("");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={buttonClass.secondary} disabled={!total} onClick={() => setOpen(true)}>
        <Mail className="w-4 h-4" /> Email these to…
      </button>
    );
  }
  return (
    <form onSubmit={send} className="flex flex-wrap items-center gap-2">
      <input type="email" required autoFocus className={`${inputClass} !w-64`} placeholder="name@example.com" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
      <button type="submit" className={buttonClass.primary} disabled={sending || !recipient}>
        <Mail className="w-4 h-4" /> {sending ? "Sending…" : `Send ${total}`}
      </button>
      <button type="button" className={buttonClass.secondary} onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}
