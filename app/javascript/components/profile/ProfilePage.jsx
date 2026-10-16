import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, Trash2 } from "lucide-react";
import { inputClass, labelClass } from "../ui/styles";
import { api } from "../groups/lib";
import Avatar from "../groups/Avatar";
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
  const [form, setForm] = useState({ name: "", bio: "" });
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
    setForm({ name: p.name || "", bio: p.bio || "" });
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

  const shownPerson = { name: form.name || profile.email, avatar_url: removePicture ? null : picture?.url || profile.avatar_url };

  return (
    <div className="mx-auto max-w-2xl space-y-6 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Your profile</h1>
        <p className="text-sm text-slate-600 dark:text-neutral-400">Your name, picture and blurb show to the people in your groups.</p>
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
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="p-bio" className={labelClass}>About you</label>
                <span className={`text-xs ${form.bio.length > BIO_MAX ? "text-rose-600" : "text-slate-400"}`}>{form.bio.length}/{BIO_MAX}</span>
              </div>
              <textarea id="p-bio" rows={3} className={inputClass} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="A line or two: your home group, your sobriety date, what you're reading…" />
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
    </div>
  );
}
