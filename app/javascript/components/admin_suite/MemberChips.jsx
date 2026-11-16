import React, { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { inputClass } from "../ui/styles";
import { InlineSkeleton } from "../ui/Skeleton";
import { FlatChip } from "../recovery/ChipModal";
import { Badge, shortDate } from "./UsersPage";

const SITE = "site";

// Where a chip came from, in a line
function source(chip) {
  if (!chip) return "nothing";
  const on = chip.on ? shortDate(`${chip.on}T12:00:00`) : "";
  if (chip.source === "earned") return `Their own, earned ${on}`;
  const edition = chip.edition ? `${chip.edition.name}${chip.edition.serial ? ` No. ${chip.edition.serial}` : ""}, ` : "";
  if (chip.source === "edition") return `${chip.group?.title}'s ${edition}claimed ${on}`;
  return `${edition}From ${chip.group?.title}${chip.given_by ? `, given by ${chip.given_by}` : ""} · ${on}`;
}

// Site Admin > Members > the chip button: the milestones where they were given or claimed a
// chip (only those can go back; earned ones come from their own sobriety date or writing).
// Taking one back puts another chip from the same stack on top, or RecoveryBot's own when
// nothing else is there, and tells them (ChipRevocation).
export default function MemberChips({ user, notify }) {
  const [info, setInfo] = useState(null);
  const [taking, setTaking] = useState(null); // { chip, stack, replacement, note }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/users/${user.id}/chips`).then(setInfo).catch((e) => notify(e.message, "error"));
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function start(chip, stack) {
    const others = stack.chips.filter((c) => c.id !== chip.id);
    setTaking({ chip, stack, replacement: others[0]?.id || (stack.site_ok ? SITE : ""), note: "" });
  }

  async function takeBack(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const next = await api(`/users/${user.id}/revoke_chip`, {
        method: "POST", body: { chip_id: taking.chip.id, replacement_id: taking.replacement, note: taking.note },
      });
      setInfo(next);
      setTaking(null);
      notify(`Took back ${user.name || user.email}'s ${taking.chip.label} chip. They've been told.`);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (!info) return <div className="pt-3"><InlineSkeleton /></div>;

  return (
    <div className="grid max-w-3xl gap-4 pt-3 text-sm">
      {info.stacks.length === 0 && (
        <p className="text-slate-500 dark:text-neutral-400">No chips they were given or claimed. Earned chips come from their own sobriety date and writing, so they can't be taken back.</p>
      )}
      {info.stacks.map((stack) => (
        <div key={stack.slot}>
          <p className="font-semibold text-slate-700 dark:text-neutral-200">{stack.label}</p>
          <ul className="mt-1 grid gap-1">
            {stack.chips.map((chip) => (
              <li key={chip.id} className="flex flex-wrap items-center gap-3 py-1">
                <FlatChip chip={chip} design={info.design} size={44} />
                <span className="min-w-0">
                  {source(chip)} {chip.top && stack.chips.length > 1 && <Badge>On top</Badge>}
                </span>
                {chip.revocable && taking?.chip.id !== chip.id && (
                  <button type="button" className={buttonClass.danger} onClick={() => start(chip, stack)}>
                    <Undo2 className="w-4 h-4" /> Take back
                  </button>
                )}
              </li>
            ))}
          </ul>
          {taking?.stack.slot === stack.slot && (
            <form onSubmit={takeBack} className="mt-2 grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
              <fieldset className="grid gap-1">
                <legend className="mb-1 font-medium text-slate-800 dark:text-neutral-100">Put on top of their {stack.label} instead</legend>
                {stack.chips.filter((c) => c.id !== taking.chip.id).map((c) => (
                  <label key={c.id} className="flex items-center gap-2">
                    <input type="radio" name="replacement" checked={taking.replacement === c.id} onChange={() => setTaking({ ...taking, replacement: c.id })} />
                    <FlatChip chip={c} design={info.design} size={32} /> {source(c)}
                  </label>
                ))}
                {stack.site_ok && !stack.chips.some((c) => c.id !== taking.chip.id) && (
                  <label className="flex items-center gap-2">
                    <input type="radio" name="replacement" checked={taking.replacement === SITE} onChange={() => setTaking({ ...taking, replacement: SITE })} />
                    RecoveryBot's own {stack.label} chip, given to them now
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <input type="radio" name="replacement" checked={taking.replacement === ""} onChange={() => setTaking({ ...taking, replacement: "" })} />
                  Nothing, just take it back
                </label>
              </fieldset>
              <label className="grid gap-1">
                <span className="font-medium text-slate-800 dark:text-neutral-100">Note to them (optional)</span>
                <textarea className={inputClass} rows={2} maxLength={500} value={taking.note} placeholder="Shows in the notification they get"
                  onChange={(e) => setTaking({ ...taking, note: e.target.value })} />
              </label>
              <p className="text-slate-500 dark:text-neutral-400">
                Posts where they shared it stay up with their words, and show the new chip instead.
                {" "}If nothing goes on top, those posts are hidden from everyone else.
              </p>
              <div className="flex gap-2">
                <button type="submit" className={buttonClass.primary} disabled={busy}>Take back the {stack.label} chip</button>
                <button type="button" className={buttonClass.secondary} onClick={() => setTaking(null)} disabled={busy}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      ))}
      {info.history.length > 0 && (
        <div>
          <p className="font-semibold text-slate-700 dark:text-neutral-200">Taken back before</p>
          <ul className="mt-1 grid gap-1">
            {info.history.map((r) => (
              <li key={r.id} className="text-slate-600 dark:text-neutral-300">
                {shortDate(r.created_at)}: {r.revoked_by || "An admin"} took back the {r.label} chip ({source(r.chip)}) and put {r.replacement ? source(r.replacement).replace(/^./, (c) => c.toLowerCase()) : "nothing"} on top.
                {r.posts_swapped > 0 && ` ${r.posts_swapped} post${r.posts_swapped === 1 ? "" : "s"} now show the new chip.`}
                {r.posts_hidden > 0 && ` ${r.posts_hidden} post${r.posts_hidden === 1 ? "" : "s"} hidden from others.`}
                {r.note && <span className="block text-slate-500 dark:text-neutral-400">Note: {r.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
