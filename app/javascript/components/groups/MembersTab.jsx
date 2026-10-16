import React, { useState } from "react";
import { Check, Copy, RefreshCw, UserPlus, X } from "lucide-react";
import { inputClass } from "../ui/styles";
import { api, ROLE_LABELS, soberFor } from "./lib";
import Avatar from "./Avatar";
import { Card, ErrorNote, Pill, Tray, copy, dangerButton, primaryButton, quietButton } from "./ui";

// Members with their pictures and blurbs. Group admins also see join requests, add people
// by email, share the invite link, change roles and remove people.
export default function MembersTab({ group, reload, setGroup }) {
  const manage = group.can_manage;
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

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
                  <p className="font-medium text-slate-900 dark:text-white">{person.name}</p>
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

      <Tray label={`Members (${group.members.length})`}>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {group.members.map((person) => (
            <Card key={person.membership_id} className="flex gap-3 p-3">
              <Avatar person={person} size={48} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900 dark:text-white">
                  {person.name}
                  {person.role === "admin" && <Pill tone="accent">{ROLE_LABELS.admin}</Pill>}
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
