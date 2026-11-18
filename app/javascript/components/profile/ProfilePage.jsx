import React, { useEffect, useRef, useState } from "react";
import { Camera, Check, CircleAlert, CircleCheck, ExternalLink, Mic, Save, Trash2, Undo2, Zap } from "lucide-react";
import { hasPluginMethod, nativePlatform } from "../../lib/nativeApp";
import { VISIBILITY } from "../notes/lib";
import { inputClass, labelClass, selectClass } from "../ui/styles";
import { DateField, todayValue } from "../ui/DateFields";
import Toggle from "../ui/Toggle";
import PushSettings from "./PushSettings";
import WidgetSettings from "./WidgetSettings";
import AppLockSettings from "./AppLockSettings";
import AppInfoSettings from "./AppInfoSettings";
import { appLockHere } from "../../lib/appLock";
import SignInMethods from "./SignInMethods";
import { ReminderSetting } from "../recovery/ReminderSetting";
import { api } from "../groups/lib";
import Avatar from "../groups/Avatar";
import { soberFor } from "../groups/lib";
import { Card, ErrorNote, Pill, Tray, dangerButton, primaryButton, quietButton } from "../groups/ui";
import Skeleton from "../ui/Skeleton";

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

// Which tabs need the Save button and which save as you go. Profile and Account fields wait
// for Save (one PATCH for both); Privacy, Notifications and This phone keep each change at once.
const TABS = [
  { key: "profile", label: "Profile", saves: "button" },
  { key: "account", label: "Account", saves: "button" },
  { key: "privacy", label: "Privacy", saves: "instant" },
  { key: "notifications", label: "Notifications", saves: "instant" },
  // In the apps: the app lock and the Home Screen widgets (the key stays "widgets" for old links)
  { key: "widgets", label: "This phone", saves: "instant" },
  // Which app build this is and what's new in each (on the website: what's new in the apps)
  { key: "app-info", label: "App info", saves: "none" },
];
// Old links (reminder emails, the bell) point at a section; open the tab it lives on
const HASH_TAB = { app: "app-info", hosting: "notifications", reminders: "notifications", notifications: "notifications", widgets: "widgets", "app-lock": "widgets" };

// The same tests WidgetSettings and AppLockSettings use to show themselves: only in the iPhone
// and Android apps
const widgetsHere = () => (["ios", "android"].includes(nativePlatform()) && hasPluginMethod("WidgetBridge", "setWidgetStyle")) || appLockHere();

const emptyAccount = (p) => ({ email: p.email, password: "", password_confirmation: "", current_password: "" });
const formFrom = (p) => ({ name: p.name || "", username: p.username || "", bio: p.bio || "", sobriety_date: p.sobriety_date || "", show_sobriety_date: !!p.show_sobriety_date });

// /users/edit, in tabs: Profile (name, picture, blurb, sobriety date, your groups), Account
// (email, password, ways to sign in, delete), Privacy, Notifications (reminders, this device, hosting) and, in
// the apps, This phone (app lock, widgets). A bar above the tabs shows when Profile or Account has changes that
// haven't been saved, from any tab, with Save and Discard; leaving the page then asks first.
export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(formFrom({}));
  const [account, setAccount] = useState({ email: "", password: "", password_confirmation: "", current_password: "" });
  const [picture, setPicture] = useState(null); // { blob, url }
  const [removePicture, setRemovePicture] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(() => {
    const h = location.hash.slice(1);
    return HASH_TAB[h] || (TABS.some((t) => t.key === h) ? h : "profile");
  });
  const fileRef = useRef(null);

  const load = (p) => {
    setProfile(p);
    setForm(formFrom(p));
    setAccount(emptyAccount(p));
    setPicture(null);
    setRemovePicture(false);
  };
  useEffect(() => { api("/profile").then(load).catch((e) => setError(e.message)); }, []);
  // /users/edit#hosting (from a reminder email) or #notifications: scroll to it on its tab
  const loaded = Boolean(profile);
  useEffect(() => {
    if (!loaded || !["#hosting", "#notifications", "#reminders", "#widgets", "#app-lock"].includes(location.hash)) return;
    const to = location.hash.slice(1);
    setTimeout(() => document.getElementById(to)?.scrollIntoView(), 300); // the notifications card loads on its own
  }, [loaded]);

  const profileDirty = Boolean(profile) && (JSON.stringify(form) !== JSON.stringify(formFrom(profile)) || Boolean(picture) || removePicture);
  const accountDirty = Boolean(profile) && (account.email.trim().toLowerCase() !== (profile.email || "").toLowerCase() || Boolean(account.password) || Boolean(account.password_confirmation));
  const dirty = profileDirty || accountDirty;

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!profile) return error ? <ErrorNote error={error} /> : <Skeleton variant="form" rows={5} />;

  const tabs = TABS.filter((t) => (t.key !== "privacy" || profile.profiles_open) && (t.key !== "widgets" || widgetsHere()));
  const current = tabs.find((t) => t.key === tab) || tabs[0];
  const choose = (key) => {
    setTab(key);
    history.replaceState(history.state, "", key === "profile" ? location.pathname + location.search : `#${key}`);
  };

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
    setTimeout(() => setSaved((s) => (s === what ? null : s)), 2500);
  };

  // What stops Save, and where to fix it
  const blocker = form.bio.length > BIO_MAX ? { tab: "profile", text: `About you is over ${BIO_MAX} characters.`, focus: "p-bio" }
    : accountDirty && profile.password_chosen && !account.current_password ? { tab: "account", text: "Enter your current password on the Account tab to change your email or password.", focus: "p-current" }
    : null;

  // One save for both tabs: the profile fields always, email and password only when changed
  const save = async (e) => {
    e?.preventDefault();
    if (!dirty || saving) return;
    if (blocker) {
      choose(blocker.tab);
      setTimeout(() => document.getElementById(blocker.focus)?.focus(), 50);
      return;
    }
    setSaving(true);
    setError(null);
    const body = new FormData();
    body.append("profile[name]", form.name);
    body.append("profile[bio]", form.bio);
    if (profile.profiles_open) body.append("profile[username]", form.username);
    body.append("profile[sobriety_date]", form.sobriety_date);
    body.append("profile[show_sobriety_date]", form.show_sobriety_date ? "1" : "0");
    if (picture) body.append("profile[avatar]", picture.blob, "avatar.jpg");
    if (removePicture) body.append("profile[remove_avatar]", "1");
    if (accountDirty) {
      Object.entries(account).forEach(([k, v]) => body.append(`profile[${k}]`, v));
    }
    try {
      load(await api("/profile", { method: "PATCH", form: body }));
      flash("form");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => { load(profile); setError(null); };

  // Who sees new notes on your profile, and hosting reminders; saved as soon as they're
  // picked. Only those fields go up, so unsaved Profile or Account edits stay as they are.
  const saveDefault = async (key, value) => {
    setError(null);
    try {
      const p = await api("/profile", { method: "PATCH", body: { profile: { [key]: value } } });
      setProfile(p);
      flash(key);
    } catch (err) {
      setError(err.message);
    }
  };

  const shownPerson = { name: form.name || profile.email, avatar_url: removePicture ? null : picture?.url || profile.avatar_url };
  const dirtyTabs = [profileDirty && "Profile", accountDirty && "Account"].filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl space-y-4 !font-sans [&_*]:!font-sans [&_p]:!text-left [&_p]:!hyphens-none">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Your profile</h1>
        <p className="text-sm text-slate-600 dark:text-neutral-400">Your name, picture and blurb show to the people in your groups{profile.profiles_open ? " and on your profile" : ""}.</p>
        {profile.profiles_open && (
          <a href={profile.profile_path} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">See your profile <ExternalLink className="h-3.5 w-3.5" /></a>
        )}
      </div>

      <div className="sticky top-[var(--nav-h,0px)] z-20 -mx-2 space-y-2 bg-white px-2 pb-2 pt-2 dark:bg-neutral-900">
        <SaveBar dirty={dirty} dirtyTabs={dirtyTabs} saving={saving} saved={saved === "form"} error={error} blocker={blocker} onSave={save} onDiscard={discard} />
        <div role="tablist" aria-label="Profile settings" className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-neutral-100 p-1 shadow-panel ring-1 ring-neutral-200/80 dark:bg-neutral-800 dark:ring-neutral-700">
          {tabs.map((t) => {
            const on = t.key === current.key;
            const changed = (t.key === "profile" && profileDirty) || (t.key === "account" && accountDirty);
            return (
              <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-selected={on} aria-controls={`panel-${t.key}`} onClick={() => choose(t.key)}
                className={`relative inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors ${
                  on ? "!bg-white font-semibold text-slate-900 shadow-sm dark:!bg-neutral-900 dark:text-white" : "!bg-transparent font-medium text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                }`}>
                {t.label}
                {changed && <span className="h-2 w-2 rounded-full bg-amber-500" title="Unsaved changes" aria-label="unsaved changes" />}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`panel-${current.key}`} aria-labelledby={`tab-${current.key}`} className="space-y-6">
        <SavesHow saves={current.saves} />

        {(current.key === "profile" || current.key === "account") && (
          <form id="profile-form" onSubmit={save} className="space-y-6">
            {current.key === "profile" && (
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
                </Card>
              </Tray>
            )}

            {current.key === "account" && (
              <Tray label="Email and password">
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
                  {profile.password_chosen ? (
                    <div>
                      <label htmlFor="p-current" className={labelClass}>Current password</label>
                      <input id="p-current" type="password" autoComplete="current-password" className={inputClass} value={account.current_password}
                        placeholder="Needed to change your email or password" onChange={(e) => setAccount({ ...account, current_password: e.target.value })} />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-neutral-400">
                      You sign in with Google or Apple. Choose a password here if you'd also like to log in with your email.
                    </p>
                  )}
                </Card>
              </Tray>
            )}
          </form>
        )}

        {current.key === "profile" && (profile.groups_open || profile.groups.length > 0) && (
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
        )}

        {current.key === "account" && <SignInMethods />}
        {current.key === "account" && <DeleteAccount passwordChosen={profile.password_chosen} />}

        {current.key === "privacy" && (
          <Tray label="Privacy">
            <Card className="space-y-5 p-4">
              <p className="text-sm text-slate-600 dark:text-neutral-400">
                Who sees new notes on your profile. You can still change each note on its own, and share notes to your groups.
                Highlights stay with you unless you open one and pick <em>Share to timeline</em>.
              </p>
              {[["default_note_visibility", "New notes"]].map(([key, label]) => (
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

        {current.key === "notifications" && (
          <>
            <section id="reminders" className="scroll-mt-40">
              <Tray label="Reminders">
                <Card className="space-y-4 p-4">
                  <p className="text-sm text-slate-600 dark:text-neutral-400">
                    A daily nudge in your notifications, and on your devices with notifications on. Nothing is sent until you turn one on,
                    and a reminder is skipped on days you've already written.
                  </p>
                  {["gratitude", "step"].map((which) => (
                    <ReminderSetting key={which} which={which} value={profile.reminders[which]}
                      onSaved={(reminders) => setProfile((p) => ({ ...p, reminders }))} />
                  ))}
                </Card>
              </Tray>
            </section>
            <PushSettings />
            {profile.hosting && <HostingSettings hosting={profile.hosting} save={saveDefault} saved={saved} />}
          </>
        )}

        {current.key === "widgets" && (
          <>
            <AppLockSettings />
            <WidgetSettings />
          </>
        )}

        {current.key === "app-info" && <AppInfoSettings />}
      </div>
    </div>
  );
}

// Above the tabs, so it's seen from every tab. Quiet when nothing waits for Save (with a word
// on which tabs need it); amber with Save and Discard when Profile or Account has changes.
function SaveBar({ dirty, dirtyTabs, saving, saved, error, blocker, onSave, onDiscard }) {
  if (!dirty) {
    return (
      <div role="status" className={`flex min-h-[3.25rem] items-center gap-2 rounded-2xl px-4 py-2.5 text-sm shadow-panel ring-1 ${error ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900" : saved ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900" : "bg-white text-slate-500 ring-neutral-200/80 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-800"}`}>
        {error ? <span>{error}</span> : saved ? (
          <><Check className="h-4 w-4 shrink-0" /> Your changes are saved.</>
        ) : (
          <><CircleCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> Everything is saved. Changes on Profile and Account wait for a Save button here.</>
        )}
      </div>
    );
  }
  return (
    <div role="region" aria-label="Unsaved changes" className="rounded-2xl bg-amber-50 px-4 py-2.5 shadow-panel ring-2 ring-amber-400 dark:bg-amber-950/80 dark:ring-amber-500">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="flex w-full min-w-0 items-center gap-2 text-sm font-medium text-amber-900 sm:w-auto sm:flex-1 dark:text-amber-100">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <span>Unsaved changes on {dirtyTabs.join(" and ")}.<span className="max-sm:hidden"> They don't apply until you save.</span></span>
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button type="button" onClick={onDiscard} disabled={saving} className={quietButton}><Undo2 className="h-4 w-4" /> Discard</button>
          <button type="submit" form="profile-form" onClick={(e) => { e.preventDefault(); onSave(); }} disabled={saving} className={primaryButton}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
      {(error || blocker) && <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">{error || blocker.text}</p>}
    </div>
  );
}

// One line at the top of each tab: whether its changes need the Save button or keep at once
function SavesHow({ saves }) {
  if (saves === "none") return null;
  return saves === "button" ? (
    <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
      <Save className="h-3.5 w-3.5 shrink-0" /> Changes here need <strong className="font-semibold text-slate-700 dark:text-neutral-200">Save changes</strong> in the bar above.
    </p>
  ) : (
    <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
      <Zap className="h-3.5 w-3.5 shrink-0" /> Changes here save as soon as you make them. No button needed.
    </p>
  );
}

const ROLE_LABEL = { host: "Host", co_host: "Co-host" };
const hoursLabel = (h) => (h === 24 ? "The day before (24 hours)" : h === 48 ? "Two days before" : `${h} hours before`);

// Only for hosts and co-hosts (on a group's host schedule, or marked as able to host): whether
// they're reminded before each meeting they're on, how early, and by email too. Saved as it's
// changed, like the privacy defaults.
function HostingSettings({ hosting, save, saved }) {
  const dateLabel = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return (
    <section id="hosting" className="scroll-mt-40">
      <Tray label="Hosting">
        <Card className="space-y-4 p-4">
          <p className="text-sm text-slate-600 dark:text-neutral-400">
            You host or co-host for {hosting.groups.map((g) => g.title).join(", ")}. These settings only show to hosts.
          </p>
          <Toggle checked={hosting.reminders} onChange={(v) => save("host_reminders", v)}
            label={<span className="inline-flex items-center gap-2">Remind me before meetings I'm on {saved === "host_reminders" && <Check className="h-3.5 w-3.5 text-emerald-600" />}</span>}
            description="A notification here (and on your devices with notifications on, and by email if you like) before each meeting you host, co-host or cover. Nothing is sent until you turn this on." />
          {hosting.reminders && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="p-host-hours" className={labelClass}>When</label>
                <select id="p-host-hours" className={selectClass} value={hosting.hours} onChange={(e) => save("host_reminder_hours", Number(e.target.value))}>
                  {hosting.hour_options.map((h) => <option key={h} value={h}>{hoursLabel(h)}</option>)}
                </select>
              </div>
              <Toggle className="sm:pt-6" checked={hosting.email} onChange={(v) => save("host_reminder_email", v)} label="Email me too" description="Sent to your account's email address." />
            </div>
          )}
          <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <p className={labelClass}>Coming up</p>
            {hosting.upcoming.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-neutral-400">You're not on the schedule in the next three weeks.</p>
            ) : (
              <ul className="space-y-1.5">
                {hosting.upcoming.map((c) => (
                  <li key={`${c.slug}-${c.meeting}-${c.on}-${c.role}`}>
                    <a href={`/groups/${c.slug}/meetings`} className="flex items-center gap-2 text-sm hover:text-accent">
                      <Mic className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="w-28 shrink-0 text-slate-500 dark:text-neutral-400">{dateLabel(c.on)}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-900 dark:text-white">{c.time} · {c.meeting}</span>
                      <Pill tone={c.role === "host" ? "accent" : undefined}>{ROLE_LABEL[c.role]}{c.cover ? ", covering" : ""}</Pill>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </Tray>
    </section>
  );
}

// Deleting the account takes the current password (or, for an account from Google with no
// password of their own, their email typed out); afterwards they land on the home page
function DeleteAccount({ passwordChosen = true }) {
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
      await api("/profile", { method: "DELETE", body: passwordChosen ? { current_password: password } : { confirm_email: password } });
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
              <label htmlFor="p-delete-password" className={labelClass}>{passwordChosen ? "Your password" : "Type your email address to confirm"}</label>
              <input id="p-delete-password" type={passwordChosen ? "password" : "email"} required autoComplete={passwordChosen ? "current-password" : "off"} className={inputClass}
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
