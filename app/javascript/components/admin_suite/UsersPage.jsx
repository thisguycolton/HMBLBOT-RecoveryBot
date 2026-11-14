import React, { Fragment, useEffect, useState } from "react";
import { Bell, Check, Search, Shield, ShieldOff, Trash2, Users } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import SegmentedControl from "../ui/SegmentedControl";
import { inputClass } from "../ui/styles";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { formatCount } from "./App";
import { InlineSkeleton } from "../ui/Skeleton";

const FILTERS = [
  { value: "", label: "Everyone" },
  { value: "pending", label: "Email not confirmed" },
  { value: "admins", label: "Admins" },
];

export default function UsersPage({ notify }) {
  const [filter, setFilter] = useState(() => new URLSearchParams(window.location.search).get("filter") || "");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [diag, setDiag] = useState(null); // { id, info } for the member whose notifications are open

  // Why someone isn't getting reminders or push: opens under their row
  async function showNotifications(user) {
    if (diag?.id === user.id) return setDiag(null);
    setDiag({ id: user.id, info: null });
    try {
      const info = await api(`/users/${user.id}/notifications`);
      setDiag((d) => (d?.id === user.id ? { id: user.id, info } : d));
    } catch (e) {
      setDiag(null);
      notify(e.message, "error");
    }
  }

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

  // People confirm their own email; this is for someone whose email never arrives
  const approve = (user) => window.confirm(`Confirm ${user.email} without the email link? Only do this if you know the address is theirs.`) &&
    change(user, "/confirm", null, `Confirmed ${user.email}. They've been emailed that they can log in.`);
  function toggleAdmin(user) {
    const verb = user.admin ? "Remove admin access from" : "Make";
    if (!window.confirm(`${verb} ${user.email}${user.admin ? "?" : " an admin?"}`)) return;
    change(user, "", { admin: !user.admin }, user.admin ? `${user.email} is no longer an admin.` : `${user.email} is now an admin.`);
  }

  // For good, like deleting your own account: typing their email is the confirmation
  async function remove(user) {
    const typed = window.prompt(`Delete ${user.email}'s account for good? Their notes, step work, chips and messages go with it, and it can't be undone.${user.readings_count ? ` Their ${user.readings_count} archive reading${user.readings_count === 1 ? "" : "s"} move to you.` : ""}\n\nType their email address to confirm:`);
    if (typed === null) return;
    try {
      await api(`/users/${user.id}`, { method: "DELETE", body: { confirm_email: typed } });
      notify(`Deleted ${user.email}'s account.`);
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  return (
    <Shell>
      <ShellBand icon={Users} title="Members" subtitle={data ? `${formatCount(data.total)} ${data.total === 1 ? "account" : "accounts"}${data.total > data.limit ? `, showing the newest ${data.limit}` : ""}` : <InlineSkeleton className="w-40" />} />
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
                <Fragment key={u.id}>
                <tr>
                  <td className={td}>
                    <p className="font-medium text-slate-900 dark:text-white">{u.name || u.email}</p>
                    {u.name && <p className="text-slate-500">{u.email}</p>}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{shortDate(u.created_at)}</td>
                  <td className={`${td} whitespace-nowrap`}>{u.last_seen_at ? shortDate(u.last_seen_at) : "—"}</td>
                  <td className={`${td} tabular-nums`}>{formatCount(u.readings_count)}</td>
                  <td className={td}>
                    {!u.confirmed && <Badge tone="warn">Unconfirmed</Badge>}
                    {u.admin && <Badge>Admin</Badge>}
                    {u.is_you && <Badge>You</Badge>}
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    <button type="button" className={buttonClass.secondary} onClick={() => showNotifications(u)} aria-expanded={diag?.id === u.id}
                      aria-label={`${u.email}'s notifications`} title="Notifications and reminders">
                      <Bell className="w-4 h-4" />
                    </button>
                    {!u.confirmed && (
                      <button type="button" className={buttonClass.secondary} onClick={() => approve(u)}>
                        <Check className="w-4 h-4" strokeWidth={2.5} /> Confirm for them
                      </button>
                    )}
                    {!u.is_you && (
                      <button type="button" className={u.admin ? buttonClass.danger : buttonClass.secondary} onClick={() => toggleAdmin(u)}>
                        {u.admin ? <><ShieldOff className="w-4 h-4" /> Remove admin</> : <><Shield className="w-4 h-4" /> Make admin</>}
                      </button>
                    )}
                    {!u.is_you && !u.admin && (
                      <button type="button" className={buttonClass.danger} onClick={() => remove(u)} aria-label={`Delete ${u.email}'s account`} title="Delete account">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
                {diag?.id === u.id && (
                  <tr><td colSpan={6} className="px-4 pb-4 bg-neutral-50 dark:bg-neutral-900/60">{diag.info ? <NotificationInfo info={diag.info} /> : <InlineSkeleton />}</td></tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </ShellPanel>
    </Shell>
  );
}

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never");

// Site Admin > Members > the bell button: their reminders, time zone and notification devices
function NotificationInfo({ info }) {
  const row = "flex gap-2 py-0.5";
  const label = "w-40 shrink-0 text-slate-500 dark:text-neutral-400";
  const names = { gratitude: "Gratitude reminder", step: "10th step reminder" };
  return (
    <div className="grid gap-4 pt-3 text-sm sm:grid-cols-2">
      <div>
        <p className={row}><span className={label}>Their time</span><span>{info.local_time} ({info.time_zone}{info.time_zone_saved ? "" : ", site default"})</span></p>
        {Object.entries(info.reminders).map(([k, r]) => (
          <p key={k} className={row}><span className={label}>{names[k] || k}</span>
            <span>{r.on ? `On at ${r.at}` : "Off"}{r.on && ` · last sent ${r.reminded_on || "never"}`}{r.on && r.written_today && " · already written today (skipped)"}</span></p>
        ))}
        <p className={row}><span className={label}>Reminders pushed</span><span>{info.reminders_pushed ? "Yes" : "No, they turned reminder pushes off"}</span></p>
        {info.turned_off.length > 0 && <p className={row}><span className={label}>Push turned off for</span><span>{info.turned_off.join(", ")}</span></p>}
        {!info.app_push_ready && <p className="py-0.5 text-amber-700 dark:text-amber-300">App notifications aren't set up on the server (FIREBASE_SERVICE_ACCOUNT).</p>}
      </div>
      <div>
        <p className="font-semibold text-slate-700 dark:text-neutral-200">Devices getting notifications</p>
        {info.apps.length + info.browsers.length === 0 && <p className="py-0.5 text-amber-700 dark:text-amber-300">None. Push can't reach them until they open the app signed in, or turn notifications on in a browser.</p>}
        {[...info.apps.map((d) => ({ ...d, label: `${d.label}${d.app_version ? ` ${d.app_version}` : ""}` })), ...info.browsers].map((d, i) => (
          <p key={i} className={row}><span className="min-w-0 flex-1">{d.label}</span><span className="text-slate-500 dark:text-neutral-400">added {when(d.created_at)} · last sent {when(d.last_sent_at)}</span></p>
        ))}
        <p className="mt-3 font-semibold text-slate-700 dark:text-neutral-200">Latest in their bell</p>
        {info.recent.length === 0 && <p className="py-0.5 text-slate-500">Nothing yet.</p>}
        {info.recent.map((n, i) => (
          <p key={i} className={row}><span className="min-w-0 flex-1 truncate">{n.title}</span><span className="text-slate-500 dark:text-neutral-400">{when(n.created_at)}</span></p>
        ))}
      </div>
    </div>
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
