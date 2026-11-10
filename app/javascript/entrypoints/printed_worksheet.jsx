// One of a member's worksheets laid out for paper, from a 30 minute print link
// (/worksheet/print/:token, StepWorkPrintsController). The home screen app on iPhones and iPads
// can't print, so the worksheet's Print button opens this in a Safari view, where it can.
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Printer, Share } from "lucide-react";

import "../styles/tailwind.css";
import "../styles/reader.css";

import { primaryButton } from "../components/groups/ui";
import PrintableWorksheet from "../components/recovery/steps/PrintableWorksheet";

const label = (w) => (w.tool_key === "drop-the-rock" || w.tool_key?.startsWith("step6-7-") ? "Steps 6 and 7" : `Step ${w.step}`);

function PrintedWorksheet({ work, blank }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="w-full px-4 py-6 !font-sans [&_*]:!font-sans print:p-0">
      <div className="mx-auto mb-4 flex max-w-[7.5in] flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-neutral-400">
          <Share className="size-4 shrink-0" /> No print window? Tap Share, then Print. Close this when you're done.
        </p>
        <button type="button" className={primaryButton} onClick={() => window.print()}><Printer className="size-4" /> Print</button>
      </div>
      <PrintableWorksheet work={work} label={label(work)} blank={blank} by={null}
        className="rounded-3xl p-6 shadow-panel ring-1 ring-neutral-200 print:rounded-none print:p-0 print:shadow-none print:ring-0" />
    </div>
  );
}

const mount = document.getElementById("printed-worksheet-root");
const data = document.getElementById("printed-worksheet-data");
if (mount && data) {
  const work = JSON.parse(data.textContent);
  document.title = `${work.name} | RecoveryBot`;
  createRoot(mount).render(<PrintedWorksheet work={work} blank={mount.dataset.blank === "true"} />);
}
