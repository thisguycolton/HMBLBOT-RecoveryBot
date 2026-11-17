import React, { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

// A meeting's passcode (Meeting/OiaaMeeting conference_url_notes): "Password: 415542" as the feed
// gives it, or a bare "415542" labelled "Passcode". With `copy`, a click copies the code itself.

// "Passcode: 415542" for a bare code; notes that name themselves ("Password: …", "pwd 12") stay as they are
export function passcodeLabel(notes) {
  const text = (notes || "").trim();
  if (!text) return "";
  return /pass|pwd|code|pin\b|id\b/i.test(text) ? text : `Passcode: ${text}`;
}

// What to put on the clipboard: the code after "Password:" when there is one, else all of it
export function passcodeValue(notes) {
  const text = (notes || "").trim();
  const match = text.match(/(?:pass\s*(?:word|code)?|pwd|code)\s*[:=#-]?\s*(\S+)/i);
  return match ? match[1] : text;
}

export default function MeetingPasscode({ notes, copy = false, className = "" }) {
  const [copied, setCopied] = useState(false);
  const label = passcodeLabel(notes);
  if (!label) return null;
  const body = (
    <>
      <KeyRound className="size-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 break-words">{label}</span>
    </>
  );
  const cls = `inline-flex max-w-full items-center gap-1.5 text-sm ${className}`;
  if (!copy) return <span className={cls} data-testid="meeting-passcode">{body}</span>;

  const onCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(passcodeValue(notes));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button type="button" onClick={onCopy} title="Copy the passcode" data-testid="meeting-passcode"
      className={`${cls} text-left ${className.includes("!bg-") ? "" : "rounded-lg !bg-transparent hover:underline"}`}>
      {body}
      {copied ? <Check className="size-3.5 shrink-0 text-emerald-500" /> : <Copy className="size-3.5 shrink-0 opacity-50" />}
    </button>
  );
}
