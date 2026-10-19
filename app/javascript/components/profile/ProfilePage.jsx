import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, ExternalLink, Trash2 } from "lucide-react";
import { VISIBILITY } from "../notes/lib";
import { inputClass, labelClass } from "../ui/styles";
import { DateField, todayValue } from "../ui/DateFields";
import Toggle from "../ui/Toggle";
import { api } from "../groups/lib";
import Avatar from "../groups/Avatar";
import { soberFor } from "../groups/lib";
import { Card, ErrorNote, Pill, Tray, dangerButton, primaryButton, quietButton } from "../groups/ui";

const BIO_MAX = 280;
const AVATAR_PX = 512;

// Crop the middle square of a picked image and shrink it, so uploads are small and the
// server never has to resize anything
function squareJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const out = Math.min(side, AVATAR_PX);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = out;
      canvas.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that picture."))), "image/jpeg", 0.88);
    };
    img.onerror = () => reject(new Error("That file isn't a picture we can read."));
    img.src = url;
  });
}

// /users/edit: name, picture and a short blurb (shown to people in your groups), then
// email and password
export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: "", username: "", bio: "", sobriety_date: "", show_sobriety_date: false });
  const [account, setAccount] = useState({ email: "", password: "", password_confirmation: "", current_password: "" });
  const [picture, setPicture] = useState(null); // { blob, url }
  const [removePicture, setRemovePicture] = useState(false);
  const [saving, setSaving] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);
  const [accountError, setAccountError] = useState(null);
  const fileRef = useRef(null);

  const load = (p) => {
    setProfile(p);
    setForm({ name: p.name || "", username: p.username || "", bio: p.bio || "", sobriety_date: p.sobriety_date || "", show_sobriety_date: !!p.show_sobriety_date });
    setAccount({ email: p.email, password: "", password_confirmation: "", current_password: "" });
    setPicture(null);
    setRemovePicture(false);
  };
  useEffect(() => { api("/profile").then(load).catch((e) => setError(e.message)); }, []);

  if (!profile) return error ? <ErrorNote error={error} /> : <p className="py-16 text-center !font-sans text-sm text-slate-500">Loading…</p>;

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const blob = await squareJpeg(file);
      setPicture({ blob, url: URL.createObjectURL(blob) });
      setRemovePicture(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const flash = (what) => {
    setSaved(what);
    setTimeout(() => setSaved(null), 2000);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving("profile");
    setError(null);
    const body = new FormData();
    body.append("profile[name]", form.name);
    body.append("profile[bio]", form.bio);
    if (profile.profiles_open) body.append("profile[username]", form.username);
    body.append("profile[sobriety_date]", form.sobriety_date);
    body.append("profile[show_sobriety_date]", form.show_sobriety_date ? "1" : "0");
    if (picture) body.append("profile[avatar]", picture.blob, "avatar.jpg");
    if (removePicture) body.append("profile[remove_avatar]", "1");
    try {
      load(await api("/profile", { method: "PATCH", form: body }));
      flash("profile");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  const saveAccount = async (e) => {
    e.preventDefault();
    setSaving("account");
    setAccountError(null);
    try {
      load(await api("/profile", { method: "PATCH", body: { profile: account } }));
      flash("account");
    } catch (err) {
      setAccountError(err.message);
    } finally {
      setSaving(null);
    }
  };

  // Who sees new highlights and notes on your profile; saved as soon as it's picked
  const saveDefault = async (key, value) => {
    setError(null);
    try {
      load(await api("/profile", { method: "PATCH", body: { profile: { [key]: value } } }));
      flash(key);
    } catch (err) {
      setError(err.message);
    }
  };

  const shownPerson = { name: form.name || profile.email, avatar_url: removePicture ? null : picture?.url || profile.avatar_url };

  return (
    <div className="mx-auto max-w-2xl space-y-6 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Your profile</h1>
        <p className="text-sm text-slate-600 dark:text-neutral-400">Your name, picture and blurb show to the people in your groups{profile.profiles_open ? " and on your profile" : ""}.</p>
        {profile.profiles_open && (
          <a href={profile.profile_path} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">See your profile <ExternalLink className="h-3.5 w-3.5" /></a>
        )}
      </div>

      <form onSubmit={saveProfile}>
        <Tray label="Profile">
          <Card className="space-y-5 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar person={shownPerson} size={88} />
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
                <button type="button" onClick={() => fileRef.current?.click()} className={quietButton}>
                  <Camera className="h-4 w-4" /> {shownPerson.avatar_url ? "Change picture" : "Add a picture"}
                </button>
                {shownPerson.avatar_url && (
                  <button type="button" onClick={() => { setPicture(null); setRemovePicture(Boolean(profile.avatar_url)); }} className={dangerButton}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                )}
              </div>
            </div>
            <div>
              <label htmlFor="p-name" className={labelClass}>Name</label>
              <input id="p-name" className={inputClass} value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="First name, or first name and last initial" />
            </div>
            {profile.profiles_open && (
              <div>
                <label htmlFor="p-username" className={labelClass}>Username</label>
                <div className="flex items-center rounded-xl ring-1 ring-neutral-200 focus-within:ring-2 focus-within:ring-accent dark:ring-neutral-700">
                  <span className="shrink-0 pl-3 text-sm text-slate-400">{location.host}/people/</span>
                  <input id="p-username" className="min-w-0 flex-1 rounded-r-xl border-0 bg-transparent py-2 pl-0.5 pr-3 text-sm text-slate-900 focus:ring-0 dark:text-white" value={form.username} maxLength={30}
                    onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">Lowercase letters, numbers and dashes. Only people signed in to RecoveryBot can see profiles.</p>
              </div>
            )}
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="p-bio" className={labelClass}>About you</label>
                <span className={`text-xs ${form.bio.length > BIO_MAX ? "text-rose-600" : "text-slate-400"}`}>{form.bio.length}/{BIO_MAX}</span>
              </div>
              <textarea id="p-bio" rows={3} className={inputClass} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="A line or two: your home group, what you're reading…" />
            </div>
            <div>
              <label htmlFor="p-sober" className={labelClass}>Sobriety date</label>
              <div className="flex flex-wrap items-center gap-3">
                <DateField id="p-sober" clearable className="w-48" max={todayValue()} value={form.sobriety_date || ""}
                  onChange={(sobriety_date) => setForm({ ...form, sobriety_date, show_sobriety_date: sobriety_date ? form.show_sobriety_date : false })} />
                {form.sobriety_date && <span className="text-sm text-slate-600 dark:text-neutral-300">{soberFor(form.sobriety_date)}</span>}
              </div>
              <Toggle className="mt-3" checked={form.show_sobriety_date} disabled={!form.sobriety_date}
                onChange={(show_sobriety_date) => setForm({ ...form, show_sobriety_date })}
                label="Show it to the people in my groups" />
            </div>
            <ErrorNote error={error} />
            <div className="flex items-center justify-end gap-3">
              {saved === "profile" && <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" /> Saved</span>}
              <button type="submit" disabled={saving === "profile" || form.bio.length > BIO_MAX} className={primaryButton}>
                {saving === "profile" ? "Saving…" : "Save profile"}
              </button>
            </div>
          </Card>
        </Tray>
      </form>

      {profile.profiles_open && (
        <Tray label="Privacy">
          <Card className="space-y-5 p-4">
            <p className="text-sm text-slate-600 dark:text-neutral-400">
              Who sees new things on your profile. You can still change each note or highlight on its own, and share notes to your groups.
            </p>
            {[["default_highlight_visibility", "New highlights"], ["default_note_visibility", "New notes"]].map(([key, label]) => (
              <fieldset key={key}>
                <legend className={`${labelClass} flex items-center gap-2`}>
                  {label}
                  {saved === key && <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-700 dark:text-emerald-300"><Check className="h-3.5 w-3.5" /> Saved</span>}
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {VISIBILITY.map((v) => {
                    const Icon = v.icon;
                    const on = profile[key] === v.value;
                    return (
                      <button key={v.value} type="button" aria-pressed={on} onClick={() => !on && saveDefault(key, v.value)}
                        className={`flex items-start gap-2 rounded-xl p-3 text-left ring-1 ${on ? "!bg-accent/10 ring-2 ring-accent dark:!bg-accent/20" : "!bg-transparent ring-neutral-200 hover:!bg-neutral-50 dark:ring-neutral-700 dark:hover:!bg-neutral-800"}`}>
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${on ? "text-accent" : "text-slate-500"}`} />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900 dark:text-white">{v.label}</span>
                          <span className="block text-xs text-slate-500 dark:text-neutral-400">{v.note}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </Card>
        </Tray>
      )}

      {profile.groups_open || profile.groups.length > 0 ? (
        <Tray label="Your groups" action={<a href="/groups/find" className="text-sm font-medium text-accent hover:underline">Find a group</a>}>
          <Card className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {profile.groups.length === 0 ? (
              <p className="p-4 text-sm text-slate-600 dark:text-neutral-400">You're not in a group yet.</p>
            ) : (
              profile.groups.map((g) => (
                <a key={g.slug} href={`/groups/${g.slug}`} className="flex items-center justify-between gap-2 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/60">
                  <span className="font-medium text-slate-900 dark:text-white">{g.title}</span>
                  {g.status === "requested" ? <Pill tone="amber">Request sent</Pill> : g.role === "admin" ? <Pill tone="accent">Admin</Pill> : <Pill>Member</Pill>}
                </a>
              ))
            )}
          </Card>
        </Tray>
      ) : null}

      <form onSubmit={saveAccount}>
        <Tray label="Account">
          <Card className="space-y-4 p-4">
            <div>
              <label htmlFor="p-email" className={labelClass}>Email</label>
              <input id="p-email" type="email" required autoComplete="email" className={inputClass} value={account.email}
                onChange={(e) => setAccount({ ...account, email: e.target.value })} />
              {profile.unconfirmed_email && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  We sent a link to {profile.unconfirmed_email}. Your email changes once you click it.
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="p-password" className={labelClass}>New password</label>
                <input id="p-password" type="password" autoComplete="new-password" className={inputClass} value={account.password}
                  placeholder="Leave blank to keep it" onChange={(e) => setAccount({ ...account, password: e.target.value })} />
              </div>
              <div>
                <label htmlFor="p-password2" className={labelClass}>New password again</label>
                <input id="p-password2" type="password" autoComplete="new-password" className={inputClass} value={account.password_confirmation}
                  onChange={(e) => setAccount({ ...account, password_confirmation: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="p-current" className={labelClass}>Current password</label>
              <input id="p-current" type="password" autoComplete="current-password" className={inputClass} value={account.current_password}
                placeholder="Needed to change your email or password" onChange={(e) => setAccount({ ...account, current_password: e.target.value })} />
            </div>
            <ErrorNote error={accountError} />
            <div className="flex items-center justify-end gap-3">
              {saved === "account" && <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" /> Saved</span>}
              <button type="submit" disabled={saving === "account" || (account.email === profile.email && !account.password)} className={primaryButton}>
                {saving === "account" ? "Saving…" : "Update account"}
              </button>
            </div>
          </Card>
        </Tray>
      </form>

      <DeleteAccount />
    </div>
  );
}

// Deleting the account takes the current password; afterwards they land on the home page
function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const remove = async (e) => {
    e.preventDefault();
    if (!window.confirm("Delete your account for good? This can't be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await api("/profile", { method: "DELETE", body: { current_password: password } });
      window.location.href = "/";
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Tray label="Delete account">
      <Card className="space-y-3 p-4">
        <p className="text-sm text-slate-600 dark:text-neutral-400">
          This removes your profile, notes, highlights, follows, RSVPs and group memberships. Records your groups keep, like minutes
          or a document you edited, stay with the group. <a href="/privacy#deleting" className="text-accent hover:underline">What gets deleted</a>
        </p>
        {open ? (
          <form onSubmit={remove} className="space-y-3">
            <div>
              <label htmlFor="p-delete-password" className={labelClass}>Your password</label>
              <input id="p-delete-password" type="password" required autoComplete="current-password" className={inputClass}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <ErrorNote error={error} />
            <div className="flex items-center justify-end gap-3">
              <button type="button" className={quietButton} onClick={() => { setOpen(false); setError(null); }}>Cancel</button>
              <button type="submit" disabled={busy || !password} className={dangerButton}>
                <Trash2 className="h-4 w-4" /> {busy ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex justify-end">
            <button type="button" className={dangerButton} onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" /> Delete account…</button>
          </div>
        )}
      </Card>
    </Tray>
  );
}
