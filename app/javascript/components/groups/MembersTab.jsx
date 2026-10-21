import React, { useMemo, useState } from "react";
import { Check, Copy, RefreshCw, Search, UserPlus, X } from "lucide-react";
import { iconInputClass, inputClass } from "../ui/styles";
import { api, ROLE_LABELS, soberFor } from "./lib";
import Avatar from "./Avatar";
import { Card, ErrorNote, Pill, Tray, copy, dangerButton, primaryButton, quietButton } from "./ui";

// Members with their pictures and blurbs. Group admins also see join requests, add people
// by email, share the invite link, change roles and remove people.

// Everything the member search looks at: name, username, email and the roles shown as pills.
const searchText = (person) => [
  person.name,
  person.username,
  person.email,
  ROLE_LABELS[person.role],
  person.can_keep_records && "record keeper",
  person.can_schedule_hosts && "host coordinator",
  person.can_keep_treasury && "treasurer",
  person.can_host && "can host",
].filter(Boolean).join(" ").toLowerCase();

export default function MembersTab({ group, reload, setGroup }) {
  const manage = group.can_manage;
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");

  // Every word typed has to match somewhere, so "host coordinator" or "eli gmail" narrow it down.
  const members = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return group.members;
    return group.members.filter((person) => {
      const text = searchText(person);
      return words.every((word) => text.includes(word));
    });
  }, [group.members, query]);

  const call = async (path, options) => {
    setError(null);
    try {
      await api(`/groups/${group.slug}${path}`, options);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    await call("/memberships", { method: "POST", body: { email } });
    setEmail("");
  };

  const regenerate = async () => {
    if (!window.confirm("Make a new invite link? The old one stops working.")) return;
    try {
      setGroup(await api(`/groups/${group.slug}/regenerate_invite`, { method: "POST" }));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <ErrorNote error={error} />

      {manage && group.requests?.length > 0 && (
        <Tray label={`Asking to join (${group.requests.length})`}>
          <div className="space-y-1.5">
            {group.requests.map((person) => (
              <Card key={person.membership_id} className="flex flex-wrap items-center gap-3 p-3">
                <Avatar person={person} />
                <div className="min-w-[12rem] flex-1">
                  <p className="font-medium text-slate-900 dark:text-white">{person.username ? <a href={`/people/${person.username}`} className="!text-slate-900 hover:underline dark:!text-white">{person.name}</a> : person.name}</p>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">{person.email}</p>
                  {person.bio && <p className="mt-0.5 text-sm text-slate-600 dark:text-neutral-300">{person.bio}</p>}
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                <button type="button" onClick={() => call(`/memberships/${person.membership_id}`, { method: "PATCH", body: { status: "active" } })} className={primaryButton}>
                  <Check className="h-4 w-4" /> Let them in
                </button>
                <button type="button" onClick={() => call(`/memberships/${person.membership_id}`, { method: "DELETE" })} className={quietButton}>
                  <X className="h-4 w-4" /> Turn down
                </button>
                </div>
              </Card>
            ))}
          </div>
        </Tray>
      )}

      {manage && (
        <Tray label="Bring people in">
          <Card className="space-y-3 p-3">
            <div>
              <p className="text-sm text-slate-700 dark:text-neutral-200">Invite link: anyone who opens it joins the group, after making an account if they need one.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input readOnly className={`${inputClass} min-w-0 basis-full font-mono !text-xs sm:basis-auto sm:flex-1`} value={group.invite_url} onFocus={(e) => e.target.select()} />
                <button type="button" onClick={() => copy(group.invite_url, () => { setCopied(true); setTimeout(() => setCopied(false), 1500); })} className={quietButton}>
                  <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" onClick={regenerate} className={quietButton} title="Make a new link; the old one stops working">
                  <RefreshCw className="h-4 w-4" /> New link
                </button>
              </div>
            </div>
            <form onSubmit={add} className="flex flex-wrap gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <input type="email" required className={`${inputClass} min-w-0 flex-1`} placeholder="Add someone who has an account, by email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="submit" className={primaryButton}><UserPlus className="h-4 w-4" /> Add</button>
            </form>
          </Card>
        </Tray>
      )}

      <Tray label={query.trim() ? `Members (${members.length} of ${group.members.length})` : `Members (${group.members.length})`}>
        <div className="relative mb-2">
          <Search className={iconInputClass} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search members by name, email or role…"
            aria-label="Search members"
            className={`${inputClass} pl-9`}
          />
        </div>
        {members.length === 0 && (
          <Card className="p-4 text-center text-sm text-slate-500 dark:text-neutral-400">
            No one matches “{query.trim()}”.{" "}
            <button type="button" onClick={() => setQuery("")} className="font-medium text-blue-600 hover:underline dark:text-blue-400">Clear search</button>
          </Card>
        )}
        <div className="grid gap-1.5 sm:grid-cols-2">
          {members.map((person) => (
            <Card key={person.membership_id} className="flex gap-3 p-3">
              <a href={person.username ? `/people/${person.username}` : undefined} className="shrink-0" aria-label={`${person.name}'s profile`}><Avatar person={person} size={48} /></a>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-white">
                  {person.username ? <a href={`/people/${person.username}`} className="!text-slate-900 hover:underline dark:!text-white">{person.name}</a> : person.name}
                  {person.role === "admin" && <Pill tone="accent">{ROLE_LABELS.admin}</Pill>}
                  {person.can_keep_records && <Pill tone="green">Record keeper</Pill>}
                  {person.can_schedule_hosts && <Pill tone="green">Host coordinator</Pill>}
                  {person.can_keep_treasury && <Pill tone="green">Treasurer</Pill>}
                  {person.can_host && <Pill tone="green">Can host</Pill>}
                </p>
                {person.email && <p className="truncate text-xs text-slate-500 dark:text-neutral-400">{person.email}</p>}
                {person.sobriety_date && (
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300" title={`Sober since ${person.sobriety_date}`}>{soberFor(person.sobriety_date)}</p>
                )}
                {person.bio ? (
                  <p className="mt-1 text-sm text-slate-600 dark:text-neutral-300">{person.bio}</p>
                ) : (
                  <p className="mt-1 text-sm italic text-slate-400 dark:text-neutral-500">No blurb yet</p>
                )}
                {manage && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`}
                      onClick={() => call(`/memberships/${person.membership_id}`, { method: "PATCH", body: { role: person.role === "admin" ? "member" : "admin" } })}>
                      {person.role === "admin" ? "Make member" : "Make admin"}
                    </button>
                    <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`} title="Record keepers write the group's documents"
                      onClick={() => call(`/memberships/${person.membership_id}`, { method: "PATCH", body: { can_keep_records: !person.can_keep_records } })}>
                      {person.can_keep_records ? "Not a record keeper" : "Make record keeper"}
                    </button>
                    <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`} title="Schedules who hosts and co-hosts each meeting"
                      onClick={() => call(`/memberships/${person.membership_id}`, { method: "PATCH", body: { can_schedule_hosts: !person.can_schedule_hosts } })}>
                      {person.can_schedule_hosts ? "Not a host coordinator" : "Make host coordinator"}
                    </button>
                    <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`} title="Writes and posts the treasurer's reports"
                      onClick={() => call(`/memberships/${person.membership_id}`, { method: "PATCH", body: { can_keep_treasury: !person.can_keep_treasury } })}>
                      {person.can_keep_treasury ? "Not treasurer" : "Make treasurer"}
                    </button>
                    <button type="button" className={`${quietButton} !px-2 !py-1 !text-xs`} title="Can host or co-host: reads the format kept for hosts and hears when a host won't be there"
                      onClick={() => call(`/memberships/${person.membership_id}`, { method: "PATCH", body: { can_host: !person.can_host } })}>
                      {person.can_host ? "Can't host" : "Can host"}
                    </button>
                    <button type="button" className={`${dangerButton} !px-2 !py-1 !text-xs`}
                      onClick={() => window.confirm(`Remove ${person.name} from ${group.title}?`) && call(`/memberships/${person.membership_id}`, { method: "DELETE" })}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Tray>
    </div>
  );
}
