import React, { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { api } from "../topicificator_admin/api";
import { showToast } from "../../lib/toast";
import { ErrorNote, primaryButton, quietButton } from "../groups/ui";
import Dialog from "../groups/chat/Dialog";
import { FlatChip } from "../recovery/ChipModal";

const SITE = "site";

const source = (c) => {
  if (c.source === "earned") return c.kind === "round" ? "Their own, earned" : `${c.label}, earned`;
  const edition = c.edition ? ` ${c.edition.name}${c.edition.serial ? ` No. ${c.edition.serial}` : ""}` : "";
  return c.source === "edition" ? `${c.group?.title}'s${edition}` : `From ${c.group?.title}${edition}${c.given_by ? `, given by ${c.given_by}` : ""}`;
};

// A site admin's "Change this chip" on a post that shares a chip someone was given or claimed
// by mistake: the same take-back as Site Admin > Members > Chips (ChipRevocation). The chip goes
// back, another from that milestone's stack goes on top, and the post shows that one instead.
// When the chip in the post isn't one they have anymore (taken back before, or its edition was
// deleted), or isn't one that can go back, the admin picks any chip they do have to show in the
// post instead; only the post changes.
export default function ChipSwapDialog({ item, onClose, onChange }) {
  const [stack, setStack] = useState(null);
  const [pick, setPick] = useState(null); // { chips, design, held } when only the post changes
  const [replacement, setReplacement] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const person = item.author;

  useEffect(() => {
    api(`/users/${person.id}/chips`).then((info) => {
      const found = info.stacks.find((s) => s.chips.some((c) => c.id === item.chip.id && c.revocable));
      if (!found) {
        // Theirs now, minus the one in the post: the same milestone first, then other round chips
        const rank = (c) => (c.slot === item.chip.slot ? 0 : c.shape === "round" ? 1 : 2);
        const chips = info.all.filter((c) => c.id !== item.chip.id).sort((a, b) => rank(a) - rank(b));
        if (chips.length === 0) return setError("They don't have any chips to show in its place.");
        setPick({ chips, design: info.design, held: info.all.some((c) => c.id === item.chip.id) });
        setReplacement(chips[0].id);
        return;
      }
      const others = found.chips.filter((c) => c.id !== item.chip.id);
      setStack({ ...found, others, design: info.design });
      setReplacement(others[0]?.id || (found.site_ok ? SITE : ""));
    }).catch((e) => setError(e.message));
  }, [person.id, item.chip.id]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (pick) {
        const { chip } = await api(`/users/${person.id}/post_chip`, { method: "POST", body: { note_id: item.id, chip_id: replacement } });
        onChange?.({ ...item, chip, chip_hidden: false });
        showToast("Changed.");
        onClose();
        return;
      }
      const { revocation } = await api(`/users/${person.id}/revoke_chip`, { method: "POST", body: { chip_id: item.chip.id, replacement_id: replacement, note } });
      onChange?.(revocation.replacement ? { ...item, chip: revocation.replacement } : { ...item, chip_hidden: true });
      showToast(revocation.replacement ? "Changed." : `Took it back. This post is hidden from others now.`);
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <Dialog title={`Change ${person.name.split(" ")[0]}'s ${item.chip.label} chip`} onClose={onClose}
      footer={(
        <>
          <span className="flex-1" />
          <button type="button" className={quietButton} onClick={onClose}>Cancel</button>
          <button type="button" className={primaryButton} onClick={save} disabled={saving || !(stack || (pick && replacement))}><Undo2 className="size-4" /> {saving ? "Changing…" : "Change chip"}</button>
        </>
      )}>
      <ErrorNote error={error} />
      {pick && (
        <div className="grid gap-3 text-sm">
          <p className="text-slate-600 dark:text-neutral-300">
            {pick.held ? "This chip isn't one that can be taken back, but you can show another of theirs in this post." : `${person.name.split(" ")[0]} doesn't have this chip anymore.`}
            {" "}Pick one of their chips to show in this post instead. Their Chips page doesn't change.
          </p>
          <fieldset className="grid max-h-80 gap-2 overflow-y-auto">
            {pick.chips.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input type="radio" name="replacement" checked={replacement === c.id} onChange={() => setReplacement(c.id)} />
                <FlatChip chip={c} design={pick.design} size={36} />
                <span><span className="font-medium">{c.label}</span> · {source(c)}</span>
              </label>
            ))}
          </fieldset>
          <p className="text-slate-500 dark:text-neutral-400">Their words in the post stay as they wrote them.</p>
        </div>
      )}
      {stack && (
        <div className="grid gap-3 text-sm">
          <p className="text-slate-600 dark:text-neutral-300">
            The chip in this post goes back ({source(item.chip)}). Pick what this post, and their {stack.label} on the Chips page, show instead.
          </p>
          <fieldset className="grid gap-2">
            {stack.others.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input type="radio" name="replacement" checked={replacement === c.id} onChange={() => setReplacement(c.id)} />
                <FlatChip chip={c} design={stack.design} size={36} /> {source(c)}
              </label>
            ))}
            {stack.site_ok && stack.others.length === 0 && (
              <label className="flex items-center gap-2">
                <input type="radio" name="replacement" checked={replacement === SITE} onChange={() => setReplacement(SITE)} />
                RecoveryBot's own {stack.label} chip, given to them now
              </label>
            )}
            <label className="flex items-center gap-2">
              <input type="radio" name="replacement" checked={replacement === ""} onChange={() => setReplacement("")} />
              Nothing: take it back and hide this post from others
            </label>
          </fieldset>
          <label className="grid gap-1">
            <span className="font-medium">Reason (optional, only site admins see it)</span>
            <textarea className="rounded-xl border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900" rows={2} maxLength={500} value={note}
              placeholder="Kept with the record of this change" onChange={(e) => setNote(e.target.value)} />
          </label>
          <p className="text-slate-500 dark:text-neutral-400">Their words in the post stay as they wrote them.</p>
        </div>
      )}
    </Dialog>
  );
}
