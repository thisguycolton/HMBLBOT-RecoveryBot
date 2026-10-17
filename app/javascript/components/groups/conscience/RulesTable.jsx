import React from "react";
import { Card, Tray } from "../ui";
import { kindFacts } from "./lib";

const GROUP_ORDER = ["main", "subsidiary", "privileged", "incidental", "bring_back"];
const yes = (v) => (v === true ? "Yes" : v === "limited" ? "Limited" : v ? "Yes" : "No");
const VOTE = { majority: "Majority", two_thirds: "Two thirds", rescind: "Two thirds (majority with notice)", tie_sustains: "Tie sustains the chair", none: "Chair rules" };

// Robert's Rules at a glance, from the same list the motion form and its warnings use: what each kind
// of motion needs, and where it ranks (a motion is out of order while a higher one is pending)
export default function RulesTable({ kinds, groups }) {
  if (!kinds?.length) return null;
  return (
    <Tray label="Robert's Rules at a glance">
      <Card className="p-3 sm:p-4">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-neutral-200">What each motion needs, and what outranks what</summary>
          <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">The app records votes taken in the room. When a record doesn't follow these rules it says so, and still saves it. Your bylaws can ask for something different; set that on the motion.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                <tr><th className="py-1 pr-3 font-semibold">Motion</th><th className="px-2 font-semibold">Second</th><th className="px-2 font-semibold">Debate</th><th className="px-2 font-semibold">Amend</th><th className="px-2 font-semibold">Vote</th><th className="pl-2 text-right font-semibold">Rank</th></tr>
              </thead>
              {GROUP_ORDER.map((g) => (
                <tbody key={g} className="border-t border-neutral-200 dark:border-neutral-800">
                  <tr><th colSpan={6} className="pb-1 pt-3 text-left text-xs font-semibold text-accent">{groups[g]}</th></tr>
                  {kinds.filter((k) => k.group === g).sort((a, b) => (b.rank || 0) - (a.rank || 0)).map((k) => (
                    <tr key={k.key} className="align-top text-slate-700 dark:text-neutral-200" title={`${k.help ? `${k.help}. ` : ""}${kindFacts(k)}`}>
                      <td className="py-1 pr-3 font-medium text-slate-900 dark:text-white">{k.label}</td>
                      <td className="px-2">{yes(k.second)}</td><td className="px-2">{yes(k.debatable)}</td><td className="px-2">{yes(k.amendable)}</td><td className="px-2">{VOTE[k.vote]}</td>
                      <td className="pl-2 text-right tabular-nums text-slate-500">{k.rank || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </details>
      </Card>
    </Tray>
  );
}
