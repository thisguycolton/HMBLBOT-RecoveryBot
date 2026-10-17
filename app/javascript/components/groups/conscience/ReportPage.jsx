import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import usePrintable, { printTitled } from "../../../lib/usePrintable";
import { api } from "../lib";
import { Card, ErrorNote, Loading, Message, Pill, dangerButton, primaryButton, quietButton } from "../ui";
import { money, moneyField, monthLabel, parseMoney, treasuryPath } from "./lib";

// The same sums the server does (TreasurerReport#summary), so the page shows them as you type
export function summarize({ opening, reserve, lines, splits }) {
  const sum = (kind) => lines.filter((l) => l.kind === kind).reduce((n, l) => n + (parseMoney(l.amount) || 0), 0);
  const income = sum("income");
  const expense = sum("expense");
  const openingCents = parseMoney(opening) || 0;
  const reserveCents = parseMoney(reserve) || 0;
  const closing = openingCents + income - expense;
  const above = closing - reserveCents;
  const base = Math.max(above, 0);
  const shares = splits.filter((s) => s.label.trim() && Number.isFinite(Number(s.percent))).map((s) => ({ label: s.label, percent: Number(s.percent), cents: Math.round((base * Number(s.percent)) / 100) }));
  return { opening: openingCents, income, expense, closing, reserve: reserveCents, above, shortfall: Math.max(-above, 0), shares, kept: base - shares.reduce((n, s) => n + s.cents, 0), percent: shares.reduce((n, s) => n + s.percent, 0) };
}

const formFrom = (r) => ({
  month: r.period_on.slice(0, 7), opening: moneyField(r.opening_cents), reserve: moneyField(r.reserve_cents), notes: r.notes, status: r.status, visibility: r.visibility,
  lines: r.lines.map((l) => ({ kind: l.kind, label: l.label, amount: moneyField(l.cents) })),
  splits: r.splits.map((s) => ({ label: s.label, percent: String(s.percent) })),
});

function Summary({ s }) {
  const row = (label, value, strong, key = label) => (
    <div key={key} className={`flex justify-between gap-4 py-1 ${strong ? "border-t border-neutral-300 font-semibold text-slate-900 dark:border-neutral-600 dark:text-white" : "text-slate-700 dark:text-neutral-200"}`}><dt>{label}</dt><dd className="tabular-nums">{value}</dd></div>
  );
  return (
    <dl className="text-sm">
      {row("Opening balance", money(s.opening))}
      {row("Income", money(s.income))}
      {row("Expenses", `−${money(s.expense)}`)}
      {row("Closing balance", money(s.closing), true)}
      {row("Prudent reserve", `−${money(s.reserve)}`)}
      {s.shortfall > 0 ? row("Short of the reserve by", money(s.shortfall), true) : row("Above the reserve", money(s.above), true)}
      {s.shares.length > 0 && s.above > 0 && (
        <>
          <div className="mt-3 border-t border-neutral-200 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-neutral-700 dark:text-neutral-400">Shared</div>
          {s.shares.map((x, i) => row(`${x.label} (${x.percent}%)`, money(x.cents), false, `share${i}`))}
          {s.kept !== 0 && row("Kept by the group", money(s.kept))}
        </>
      )}
      {s.shortfall > 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">The month ended under the reserve, so nothing is shared.</p>}
    </dl>
  );
}

// One month's report (/conscience/treasury/:id, or /new): income and expense lines, the prudent
// reserve and the split, with the sums as you type. A new one starts from the last month.
export default function ReportPage({ group, id = null }) {
  usePrintable();
  const slug = group.slug;
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [form, setForm] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api(`/groups/${slug}/treasurer_reports`).then((d) => {
      setCanEdit(d.can_edit);
      setCanDelete(d.can_delete);
      if (id) {
        const found = d.reports.find((r) => String(r.id) === String(id));
        if (!found) { setError("That report isn't here."); return; }
        setReport(found);
        setForm(formFrom(found));
        return;
      }
      if (!d.can_edit) { setError("Only this group's record keepers can write reports."); return; }
      // a new month starts from the last: what it ended with, the reserve, the split, the usual lines
      const last = d.reports[0];
      const next = last ? new Date(Number(last.period_on.slice(0, 4)), Number(last.period_on.slice(5, 7)), 1) : new Date();
      setForm({
        month: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
        opening: last ? moneyField(last.summary.closing_cents) : "", reserve: last ? moneyField(last.reserve_cents) : "",
        notes: "", status: "draft", visibility: "members",
        lines: last ? last.lines.map((l) => ({ kind: l.kind, label: l.label, amount: "" })) : [{ kind: "income", label: "Seventh Tradition", amount: "" }, { kind: "expense", label: "Rent", amount: "" }],
        splits: last ? last.splits.map((s) => ({ label: s.label, percent: String(s.percent) })) : [],
      });
    }).catch((e) => setError(e.message));
  }, [slug, id]);
  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const s = useMemo(() => (form ? summarize(form) : null), [form]);
  if (error && !form) return <Message title="That report isn't here" text={error}><Link to={treasuryPath(slug)} className="mt-4 inline-block text-sm text-accent hover:underline">Back to reports</Link></Message>;
  if (!form) return <Loading />;

  const change = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };
  const setLine = (i, patch) => change({ lines: form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const setSplit = (i, patch) => change({ splits: form.splits.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        period_on: `${form.month}-01`, opening_cents: parseMoney(form.opening) || 0, reserve_cents: parseMoney(form.reserve) || 0, notes: form.notes,
        status: form.status, visibility: form.visibility,
        lines: form.lines.filter((l) => parseMoney(l.amount) != null).map((l) => ({ kind: l.kind, label: l.label, cents: parseMoney(l.amount) })),
        splits: form.splits.filter((x) => x.label.trim()).map((x) => ({ label: x.label, percent: x.percent })),
      };
      const saved = await api(`/groups/${slug}/treasurer_reports${report ? `/${report.id}` : ""}`, { method: report ? "PATCH" : "POST", body: { treasurer_report: body } });
      setDirty(false);
      if (report) { setReport(saved); setForm(formFrom(saved)); } else navigate(treasuryPath(slug, saved.id), { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!window.confirm("Delete this report? This can't be undone.")) return;
    try { await api(`/groups/${slug}/treasurer_reports/${report.id}`, { method: "DELETE" }); setDirty(false); navigate(treasuryPath(slug)); } catch (e) { setError(e.message); }
  };

  const lineGroup = (kind, title) => (
    <div>
      <h3 className={labelClass}>{title}</h3>
      <div className="space-y-2">
        {form.lines.map((l, i) => l.kind === kind && (
          <div key={i} className="flex gap-2">
            {canEdit ? (
              <>
                <input aria-label={`${title} item`} maxLength={80} className={inputClass} value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder="What for" />
                <input aria-label="Amount" inputMode="decimal" className={`${inputClass} !w-32 text-right tabular-nums`} value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} placeholder="0.00" />
                <button type="button" aria-label="Remove" onClick={() => change({ lines: form.lines.filter((_, j) => j !== i) })} className="grid size-9 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-400 hover:text-rose-600"><X className="size-4" /></button>
              </>
            ) : <p className="flex w-full justify-between text-sm text-slate-700 dark:text-neutral-200"><span>{l.label}</span><span className="tabular-nums">{money(parseMoney(l.amount) || 0)}</span></p>}
          </div>
        ))}
        {canEdit && <button type="button" onClick={() => change({ lines: [...form.lines, { kind, label: "", amount: "" }] })} className={`${quietButton} !px-2.5 !py-1 !text-xs`}><Plus className="size-3.5" /> Add a line</button>}
      </div>
    </div>
  );

  const title = `Treasurer's report, ${monthLabel(`${form.month}-01`)}`;
  return (
    <div className="space-y-4">
      <Link to={treasuryPath(slug)} className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline print:hidden"><ChevronLeft className="size-4" /> Treasurer's reports</Link>
      <div className="space-y-4 print:hidden">
        <ErrorNote error={error} />
        <Card className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="min-w-0 flex-1 !text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
            {form.status === "draft" && <Pill tone="amber">Draft</Pill>}
            <button type="button" className={quietButton} onClick={() => printTitled(title)}><Printer className="size-4" /> Print</button>
            {canEdit && <button type="button" onClick={save} disabled={saving || (!dirty && !!report)} className={primaryButton}><Save className="size-4" /> {saving ? "Saving…" : "Save"}</button>}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-5">
              {canEdit && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><label htmlFor="r-month" className={labelClass}>Month</label><input id="r-month" type="month" required className={inputClass} value={form.month} onChange={(e) => change({ month: e.target.value })} /></div>
                  <div><label htmlFor="r-status" className={labelClass}>Status</label><select id="r-status" className={selectClass} value={form.status} onChange={(e) => change({ status: e.target.value })}><option value="draft">Draft (record keepers)</option><option value="posted">Posted (members read it)</option></select></div>
                  <div><label htmlFor="r-vis" className={labelClass}>Who can see it</label><select id="r-vis" className={selectClass} value={form.visibility} onChange={(e) => change({ visibility: e.target.value })}><option value="members">Members</option><option value="keepers">Record keepers</option></select></div>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="r-open" className={labelClass}>Opening balance</label>{canEdit ? <input id="r-open" inputMode="decimal" className={`${inputClass} text-right tabular-nums`} value={form.opening} onChange={(e) => change({ opening: e.target.value })} placeholder="0.00" /> : <p className="text-sm tabular-nums">{money(s.opening)}</p>}</div>
                <div><label htmlFor="r-reserve" className={labelClass}>Prudent reserve to keep</label>{canEdit ? <input id="r-reserve" inputMode="decimal" className={`${inputClass} text-right tabular-nums`} value={form.reserve} onChange={(e) => change({ reserve: e.target.value })} placeholder="0.00" /> : <p className="text-sm tabular-nums">{money(s.reserve)}</p>}</div>
              </div>
              {lineGroup("income", "Income")}
              {lineGroup("expense", "Expenses")}
              <div>
                <h3 className={labelClass}>How what's above the reserve is shared</h3>
                <div className="space-y-2">
                  {form.splits.map((x, i) => (
                    <div key={i} className="flex gap-2">
                      {canEdit ? (
                        <>
                          <input aria-label="Who it goes to" maxLength={80} className={inputClass} value={x.label} onChange={(e) => setSplit(i, { label: e.target.value })} placeholder="e.g. District" />
                          <div className="relative"><input aria-label="Percent" inputMode="decimal" className={`${inputClass} !w-24 pr-7 text-right tabular-nums`} value={x.percent} onChange={(e) => setSplit(i, { percent: e.target.value })} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span></div>
                          <button type="button" aria-label="Remove" onClick={() => change({ splits: form.splits.filter((_, j) => j !== i) })} className="grid size-9 shrink-0 place-items-center rounded-lg !bg-transparent text-slate-400 hover:text-rose-600"><X className="size-4" /></button>
                        </>
                      ) : <p className="text-sm text-slate-700 dark:text-neutral-200">{x.label} ({x.percent}%)</p>}
                    </div>
                  ))}
                  {canEdit && <button type="button" onClick={() => change({ splits: [...form.splits, { label: "", percent: "" }] })} className={`${quietButton} !px-2.5 !py-1 !text-xs`}><Plus className="size-3.5" /> Add a share</button>}
                  {s.percent > 100 && <p className="text-xs text-rose-700 dark:text-rose-300">The shares add up to {s.percent}%. They can't pass 100%.</p>}
                  {form.splits.length === 0 && !canEdit && <p className="text-sm italic text-slate-500">Not shared out.</p>}
                </div>
              </div>
              <div>
                <label htmlFor="r-notes" className={labelClass}>Notes</label>
                {canEdit ? <textarea id="r-notes" rows={3} maxLength={5000} className={inputClass} value={form.notes} onChange={(e) => change({ notes: e.target.value })} placeholder="Anything the group should know. First names and last initials only." /> : <p className="whitespace-pre-line text-sm text-slate-700 dark:text-neutral-200">{form.notes || "—"}</p>}
              </div>
            </div>

            <aside className="h-fit rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-950 lg:sticky lg:top-[calc(var(--nav-h,56px)+1rem)]"><Summary s={s} /></aside>
          </div>
          {report && canDelete && <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800"><button type="button" onClick={remove} className={dangerButton}><Trash2 className="size-4" /> Delete this report</button></div>}
        </Card>
      </div>

      <article className="meeting-print hidden print:block">
        <h1>{group.title}</h1>
        <p className="meeting-print__meta">{title}</p>
        <Summary s={s} />
        {form.lines.some((l) => parseMoney(l.amount) != null) && (
          <table><thead><tr><th>Item</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>
              {["income", "expense"].flatMap((kind) => form.lines.filter((l) => l.kind === kind && parseMoney(l.amount) != null).map((l, i) => <tr key={`${kind}${i}`}><td>{kind === "income" ? "Income" : "Expense"}: {l.label}</td><td style={{ textAlign: "right" }}>{money(parseMoney(l.amount))}</td></tr>))}
            </tbody></table>
        )}
        {form.notes && <p className="meeting-print__wording">{form.notes}</p>}
      </article>
    </div>
  );
}
