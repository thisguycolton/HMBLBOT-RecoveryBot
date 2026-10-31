import React, { useEffect, useState } from "react";
import { Ban, Check, Eye, EyeOff, Plus, ShieldBan, ShieldCheck, TextSearch, Trash2, X } from "lucide-react";
import { Shell, ShellBand, ShellPanel } from "../ui/Shell";
import { inputClass, labelClass } from "../ui/styles";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";

// The list everything people write is checked against (LanguageRule / BlockedLanguage).
// Words are blurred until "Show words" so nobody has to read the list to open the page.
const LISTS = [
  {
    kind: "word",
    icon: Ban,
    title: "Blocked words and phrases",
    subtitle: "Caught as a whole word, so “spic” doesn't catch “spice”. Plurals, l33t (sp1c), spacing (s p i c) and look-alike letters are caught too.",
    placeholder: "a word or phrase",
  },
  {
    kind: "anywhere",
    icon: ShieldBan,
    title: "Blocked even inside other words",
    subtitle: "Also caught when it's part of a longer word or split up (“xxslur”, “sl ur”). Only for words that no ordinary word contains.",
    placeholder: "a word",
  },
  {
    kind: "allowed",
    icon: ShieldCheck,
    title: "Always allowed",
    subtitle: "Ordinary words or phrases that contain a blocked word, skipped before checking (“snigger”, “Maine Coon”, “a chink in the walls”). A space also matches a hyphen or nothing.",
    placeholder: "a word or phrase",
  },
];

export default function BlockedWordsPage({ notify }) {
  const [rules, setRules] = useState(null);
  const [shown, setShown] = useState(false);

  async function load() {
    try {
      setRules((await api("/language_rules")).rules);
    } catch (e) {
      notify(e.message, "error");
    }
  }
  useEffect(() => { load(); }, []);

  async function add(kind, term, note) {
    try {
      await api("/language_rules", { method: "POST", body: { language_rule: { kind, term, note } } });
      notify(kind === "allowed" ? `“${term}” is allowed now.` : "Added. It's blocked from now on.");
      await load();
      return true;
    } catch (e) {
      notify(e.message, "error");
      return false;
    }
  }

  async function remove(rule) {
    const what = rule.kind === "allowed" ? "It will be checked like any other text again." : "People will be able to post it again.";
    if (!window.confirm(`Take “${rule.term}” off the list? ${what}`)) return;
    try {
      await api(`/language_rules/${rule.id}`, { method: "DELETE" });
      notify("Removed.");
      await load();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  if (!rules) return <p className="py-16 text-center text-slate-500 dark:text-neutral-400 !font-sans">Loading…</p>;

  return (
    <div className="space-y-6">
      <Shell className="max-w-3xl">
        <ShellBand icon={ShieldBan} title="Blocked words" subtitle="Racist slurs and hate speech nobody can post anywhere: chat, notes, comments, profiles, documents, events and the rest. Ordinary swearing is fine. Changes apply right away." />
        <ShellPanel position="bottom" className="p-4 flex flex-wrap items-center gap-3">
          <p className="flex-1 min-w-[12rem] text-sm text-slate-600 dark:text-neutral-400 !font-sans">
            Someone who tries to post a blocked word is told why and keeps their text, so they can change it. Reports to admins aren't checked, so people can quote what was said to them.
          </p>
          <button type="button" className={buttonClass.secondary} onClick={() => setShown((s) => !s)} aria-pressed={shown}>
            {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {shown ? "Hide words" : "Show words"}
          </button>
        </ShellPanel>
      </Shell>

      <Tester notify={notify} />

      {LISTS.map((list) => (
        <RuleList key={list.kind} list={list} rules={rules.filter((r) => r.kind === list.kind)} shown={shown} onAdd={add} onRemove={remove} />
      ))}
    </div>
  );
}

function Tester({ notify }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);

  async function check(e) {
    e.preventDefault();
    try {
      setResult(await api("/language_rules/check", { method: "POST", body: { text } }));
    } catch (err) {
      notify(err.message, "error");
    }
  }

  return (
    <Shell className="max-w-3xl">
      <ShellBand icon={TextSearch} title="Try it" subtitle="See whether something would be turned away, before or after changing the list." />
      <ShellPanel position="bottom" className="p-4">
        <form className="grid gap-3" onSubmit={check}>
          <textarea className={`${inputClass} min-h-[5rem]`} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} placeholder="Paste or type some text…" aria-label="Text to try" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={buttonClass.primary} disabled={!text.trim()}><TextSearch className="w-4 h-4" /> Check</button>
            {result && (result.blocked ? (
              <p className="text-sm font-semibold text-red-700 dark:text-red-300 !font-sans" role="status">
                <X className="inline w-4 h-4 -mt-0.5" strokeWidth={2.5} /> Would be blocked: “{result.found}”
              </p>
            ) : (
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 !font-sans" role="status">
                <Check className="inline w-4 h-4 -mt-0.5" strokeWidth={2.5} /> Would go through
              </p>
            ))}
          </div>
        </form>
      </ShellPanel>
    </Shell>
  );
}

function RuleList({ list, rules, shown, onAdd, onRemove }) {
  const [term, setTerm] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    if (await onAdd(list.kind, term, note)) {
      setTerm("");
      setNote("");
    }
    setBusy(false);
  }

  return (
    <Shell className="max-w-3xl">
      <ShellBand icon={list.icon} title={`${list.title} (${rules.length})`} subtitle={list.subtitle} />
      <ShellPanel position="middle" className="p-4">
        {rules.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-neutral-400 !font-sans">Nothing here yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label={list.title}>
            {rules.map((rule) => (
              <li key={rule.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-neutral-800 pl-3 pr-1 py-1 text-sm text-slate-900 dark:text-neutral-100 !font-sans"
                  title={[rule.note, rule.created_by && `added by ${rule.created_by}`].filter(Boolean).join(" · ") || undefined}>
                <span className={shown || list.kind === "allowed" ? "" : "blur-sm select-none"} aria-hidden={!shown && list.kind !== "allowed"}>{rule.term}</span>
                <button type="button" className={`${buttonClass.bare} rounded-full p-1 text-slate-500 hover:text-red-700 dark:hover:text-red-300`} onClick={() => onRemove(rule)} aria-label={`Remove ${shown || list.kind === "allowed" ? rule.term : "this word"}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </ShellPanel>
      <ShellPanel position="bottom" className="p-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={submit}>
          <label className="block">
            <span className={labelClass}>{list.kind === "allowed" ? "Allow" : "Block"}</span>
            <input className={inputClass} value={term} onChange={(e) => setTerm(e.target.value)} placeholder={list.placeholder} maxLength={60} required />
          </label>
          <label className="block">
            <span className={labelClass}>Note (optional)</span>
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="why, for the next admin" maxLength={200} />
          </label>
          <button type="submit" className={buttonClass.primary} disabled={busy || !term.trim()}>
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Add
          </button>
        </form>
      </ShellPanel>
    </Shell>
  );
}
