import React, { useEffect, useState } from "react";
import { Check, Search, Shield, ShieldOff, Users } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass } from "../ui/styles";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { formatCount } from "./App";

const FILTERS = [
  { value: "", label: "Everyone" },
  { value: "pending", label: "Waiting for approval" },
  { value: "admins", label: "Admins" },
];

export default function UsersPage({ notify }) {
  const [filter, setFilter] = useState(() => new URLSearchParams(window.location.search).get("filter") || "");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);

  async function load() {
    try {
      setData(await api(`/users?${new URLSearchParams({ q: search, filter })}`));
    } catch (e) {
      notify(e.message, "error");
    }
  }
  useEffect(() => { load(); }, [filter, search]);

  async function change(user, path, body, message) {
    try {
      await api(`/users/${user.id}${path}`, { method: "PATCH", body });
      notify(message);
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  const approve = (user) => change(user, "/confirm", null, `Approved ${user.email}. They've been emailed.`);
  function toggleAdmin(user) {
    const verb = user.admin ? "Remove admin access from" : "Make";
    if (!window.confirm(`${verb} ${user.email}${user.admin ? "?" : " an admin?"}`)) return;
    change(user, "", { admin: !user.admin }, user.admin ? `${user.email} is no longer an admin.` : `${user.email} is now an admin.`);
  }

  return (
    <Shell>
      <ShellBand icon={Users} title="Members" subtitle={data ? `${formatCount(data.total)} ${data.total === 1 ? "account" : "accounts"}${data.total > data.limit ? `, showing the newest ${data.limit}` : ""}` : "Loading…"} />
      <ShellPanel position="middle" className="p-4 flex flex-wrap items-center gap-3">
        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
        <form className="flex gap-2 flex-1 min-w-[16rem]" onSubmit={(e) => { e.preventDefault(); setSearch(query.trim()); }}>
          <input className={inputClass} placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit" className={buttonClass.secondary} aria-label="Search"><Search className="w-4 h-4" /></button>
        </form>
      </ShellPanel>
      <ShellPanel position="bottom" className="overflow-x-auto">
        {!data ? null : data.users.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 !font-sans">No members match.</p>
        ) : (
          <table className="w-full text-sm !font-sans [&_*]:!font-sans">
            <thead className="border-b border-neutral-200 dark:border-neutral-700">
              <tr>{["Member", "Joined", "Last seen", "Readings", "Status", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className={td}>
                    <p className="font-medium text-slate-900 dark:text-white">{u.name || u.email}</p>
                    {u.name && <p className="text-slate-500">{u.email}</p>}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{shortDate(u.created_at)}</td>
                  <td className={`${td} whitespace-nowrap`}>{u.last_seen_at ? shortDate(u.last_seen_at) : "—"}</td>
                  <td className={`${td} tabular-nums`}>{formatCount(u.readings_count)}</td>
                  <td className={td}>
                    {!u.confirmed && <Badge tone="warn">Waiting</Badge>}
                    {u.admin && <Badge>Admin</Badge>}
                    {u.is_you && <Badge>You</Badge>}
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {!u.confirmed && (
                      <button type="button" className={buttonClass.primary} onClick={() => approve(u)}>
                        <Check className="w-4 h-4" strokeWidth={2.5} /> Approve
                      </button>
                    )}
                    {!u.is_you && (
                      <button type="button" className={u.admin ? buttonClass.danger : buttonClass.secondary} onClick={() => toggleAdmin(u)}>
                        {u.admin ? <><ShieldOff className="w-4 h-4" /> Remove admin</> : <><Shield className="w-4 h-4" /> Make admin</>}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ShellPanel>
    </Shell>
  );
}

export const th = "px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400";
export const td = "px-4 py-2 align-middle text-slate-800 dark:text-neutral-200";

export const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function Badge({ tone, children }) {
  const colors = tone === "warn"
    ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
    : "bg-accent-tint text-accent-ink dark:bg-accent/30 dark:text-white";
  return <span className={`inline-block mr-1 rounded-full px-2 py-0.5 text-xs font-semibold ${colors}`}>{children}</span>;
}
