import React, { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Save } from "lucide-react";
import { inputClass, labelClass, selectClass } from "../../ui/styles";
import { api } from "../lib";
import { Card, ErrorNote, Loading, primaryButton, quietButton } from "../ui";
import { KINDS } from "./lib";

const MARKS = [["none", "No logo"], ["group_logo", "The group's logo"], ["seal", "A seal or logo of its own"]];

// One folder's letterhead: what's at the top of its documents, and a footer
function TemplateCard({ group, template, hasGroupLogo, canEdit, onSaved }) {
  const info = KINDS.find((k) => k.key === template.kind);
  const [form, setForm] = useState({ mark: template.mark, header_text: template.header_text || "", subheader_text: template.subheader_text || "", footer_text: template.footer_text || "", align: template.align });
  const [seal, setSeal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setSaved(false); };
  const markUrl = form.mark === "seal" ? (seal ? URL.createObjectURL(seal) : template.seal_url) : form.mark === "group_logo" ? group.logo_url : null;
  const Icon = info.icon;

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(`template[${k}]`, v ?? ""));
    if (seal) body.append("template[seal]", seal);
    try {
      onSaved(await api(`/groups/${group.slug}/document_templates/${template.kind}`, { method: "PATCH", form: body }));
      setSeal(null);
      setSaved(true);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900 dark:text-white">{info.label}</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">{info.note}</p>
        </div>
      </div>

      {/* How the top of the page will look */}
      <div className="rounded-xl bg-white p-4 text-slate-900 ring-1 ring-neutral-200">
        <div className={`flex gap-3 border-b border-slate-200 pb-3 ${form.align === "center" ? "flex-col items-center text-center" : form.align === "right" ? "flex-row-reverse items-center text-right" : "items-center"}`}>
          {markUrl && <img src={markUrl} alt="" className="h-12 w-auto max-w-[120px] rounded-[22%] object-contain" />}
          <div>
            <p className="text-sm font-bold">{(form.header_text || (form.mark === "none" ? "No letterhead" : "")).replace("{{group}}", group.title)}</p>
            {form.subheader_text && <p className="text-xs text-slate-500">{form.subheader_text.replace("{{group}}", group.title)}</p>}
          </div>
        </div>
        <p className="pt-3 text-xs text-slate-400">The document starts here…</p>
        {form.footer_text && <p className="mt-3 border-t border-slate-200 pt-2 text-center text-[11px] text-slate-500">{form.footer_text}</p>}
      </div>

      {canEdit && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`t-mark-${template.kind}`} className={labelClass}>Logo or seal</label>
              <select id={`t-mark-${template.kind}`} className={selectClass} value={form.mark} onChange={(e) => set({ mark: e.target.value })}>
                {MARKS.map(([v, l]) => <option key={v} value={v} disabled={v === "group_logo" && !hasGroupLogo}>{l}{v === "group_logo" && !hasGroupLogo ? " (add one in Group settings)" : ""}</option>)}
              </select>
              {form.mark === "seal" && (
                <>
                  <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { setSeal(e.target.files[0] || null); setSaved(false); e.target.value = ""; }} />
                  <button type="button" className={`${quietButton} mt-2`} onClick={() => fileRef.current.click()}><ImagePlus className="size-4" /> {markUrl ? "Change the seal" : "Upload a seal"}</button>
                </>
              )}
            </div>
            <div>
              <label htmlFor={`t-align-${template.kind}`} className={labelClass}>Line it up</label>
              <select id={`t-align-${template.kind}`} className={selectClass} value={form.align} onChange={(e) => set({ align: e.target.value })}>
                <option value="center">Centered, logo above</option>
                <option value="left">Left, logo beside</option>
                <option value="right">Right, logo beside</option>
              </select>
            </div>
            <div>
              <label htmlFor={`t-head-${template.kind}`} className={labelClass}>Heading</label>
              <input id={`t-head-${template.kind}`} maxLength={160} className={inputClass} value={form.header_text} onChange={(e) => set({ header_text: e.target.value })} placeholder="{{group}}" />
            </div>
            <div>
              <label htmlFor={`t-sub-${template.kind}`} className={labelClass}>Line under it</label>
              <input id={`t-sub-${template.kind}`} maxLength={160} className={inputClass} value={form.subheader_text} onChange={(e) => set({ subheader_text: e.target.value })} placeholder="A group of Alcoholics Anonymous" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`t-foot-${template.kind}`} className={labelClass}>Footer</label>
              <input id={`t-foot-${template.kind}`} maxLength={300} className={inputClass} value={form.footer_text} onChange={(e) => set({ footer_text: e.target.value })} placeholder="Approved by group conscience · for members' use" />
            </div>
          </div>
          <ErrorNote error={error} />
          <div className="flex items-center justify-end gap-3">
            {saved && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Saved.</span>}
            <button type="button" disabled={busy} className={primaryButton} onClick={save}><Save className="size-4" /> {busy ? "Saving…" : "Save"}</button>
          </div>
        </>
      )}
    </Card>
  );
}

// Document templates (group dashboard): a letterhead for each folder of documents. "{{group}}" in
// the heading or the line under it is the group's name.
export default function DocumentTemplates({ group }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api(`/groups/${group.slug}/document_templates`).then(setData).catch((e) => setError(e.message)), [group.slug]);
  useEffect(() => { load(); }, [load]);
  if (!data) return error ? <ErrorNote error={error} /> : <Loading />;
  const onSaved = (t) => setData((d) => ({ ...d, templates: d.templates.map((x) => (x.kind === t.kind ? t : x)) }));
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-neutral-300">Each folder's documents can open with a letterhead: the group's logo or a seal, a heading and a line under it, and a footer. It shows on the page, in print and in Save as PDF. Write {"{{group}}"} for the group's name.</p>
      <div className="grid gap-4 xl:grid-cols-2">
        {data.templates.map((t) => <TemplateCard key={t.kind} group={group} template={t} hasGroupLogo={data.has_group_logo} canEdit={data.can_edit} onSaved={onSaved} />)}
      </div>
    </div>
  );
}
