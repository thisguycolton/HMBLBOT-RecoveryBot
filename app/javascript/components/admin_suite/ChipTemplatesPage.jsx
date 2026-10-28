import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Plus, Trash2, Upload } from "lucide-react";
import { api } from "../topicificator_admin/api";
import { buttonClass } from "../topicificator_admin/App";
import { inputClass, labelClass } from "../ui/styles";
import SegmentedControl from "../ui/SegmentedControl";
import { RoundChip } from "../recovery/Chip";
import { SpinningChip } from "../recovery/ChipModal";
import { METAL_LABELS } from "../recovery/ChipArt";
import ArtEditor from "../chips/ArtEditor";
import { applyDefaults, readText, templateDesign } from "../chips/lib";
import { Card } from "./App";

const PREVIEW = { key: "year", years: 1, label: "1 year" };

// Site Admin > Chip templates: the art groups can put on their chips (ChipTemplate). The list,
// and a template's editor (/chip_templates/:id).
export default function ChipTemplatesPage({ notify }) {
  const { id } = useParams();
  return id ? <TemplateEditor id={id} notify={notify} /> : <TemplateList notify={notify} />;
}

function Thumb({ base, template, size = 72 }) {
  if (!template.art && !template.draft?.art) return <div style={{ width: size, height: size }} className="rounded-full bg-neutral-200 dark:bg-neutral-800" />;
  return <RoundChip design={templateDesign(base, template, { draft: !template.art })} milestone={PREVIEW} size={size} />;
}

function Status({ template }) {
  const tone = template.status === "published" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{template.status === "published" ? `Published · v${template.version}` : "Draft"}</span>;
}

function TemplateList({ notify }) {
  const [data, setData] = useState(null);
  const [title, setTitle] = useState("");
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const load = () => api("/chip_templates").then(setData).catch((e) => notify(e.message, "error"));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const importSvg = async (file) => {
    if (!file) return;
    try {
      const svg = await readText(file);
      const t = await api("/chip_templates", { method: "POST", body: { svg, title: title || file.name.replace(/\.svg$/i, "") } });
      navigate(`/chip_templates/${t.id}`);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      fileRef.current.value = "";
    }
  };
  const toggleHidden = async (t) => {
    try {
      await api(`/chip_templates/${t.id}`, { method: "PATCH", body: { template: { hidden: !t.hidden } } });
      notify(t.hidden ? "Shown to its group again." : "Hidden. Chips already given in it keep it.");
      load();
    } catch (e) { notify(e.message, "error"); }
  };

  if (!data) return <p className="py-16 text-center text-sm text-slate-500 !font-sans">Loading…</p>;
  return (
    <>
      <Card title="New template" subtitle="Import an SVG made of filled shapes. Each top-level group (Illustrator or Inkscape layer, Figma frame) becomes a layer, and its outlines become metal lines. Only art you own or have the rights to.">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1">
            <span className={labelClass}>Name</span>
            <input id="tpl-new-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunflower" />
          </label>
          <input ref={fileRef} id="tpl-new-file" type="file" accept=".svg,image/svg+xml" className="hidden" onChange={(e) => importSvg(e.target.files[0])} />
          <button type="button" className={buttonClass.primary} onClick={() => fileRef.current.click()}><Upload className="size-4" /> Import SVG</button>
        </div>
      </Card>

      <Card title="Templates" subtitle="Published templates show in every group's Chips designer. Editing one makes a new version when you publish; chips already out keep theirs.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.templates.map((t) => (
            <Link key={t.id} to={`/chip_templates/${t.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-accent/50 dark:border-neutral-800">
              <Thumb base={data.default} template={t} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="truncate font-semibold text-slate-900 dark:text-white">{t.title}</div>
                <div className="text-xs text-slate-500 dark:text-neutral-400">{{ round: "Round chips", triangle: "Meeting Maker", both: "Round and Meeting Maker" }[t.fits]}</div>
                <Status template={t} />
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <Card title="Groups' own art" subtitle="What groups imported for their own chips. Only that group sees it. Hide anything that shouldn't be on a chip.">
        {data.group_templates.length === 0 ? <p className="text-sm text-slate-500 !font-sans">No group has imported art yet.</p> : (
          <ul className="divide-y divide-slate-200 dark:divide-neutral-800">
            {data.group_templates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <Thumb base={data.default} template={t} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900 dark:text-white">{t.title}</div>
                  <div className="text-xs text-slate-500">{t.group?.title}{t.hidden ? " · hidden" : ""}</div>
                </div>
                <button type="button" className={buttonClass.secondary} onClick={() => toggleHidden(t)}>
                  {t.hidden ? <><Eye className="size-4" /> Show</> : <><EyeOff className="size-4" /> Hide</>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

const MILESTONE_AT = [
  { value: "badge", label: "Badge" }, { value: "cartouche", label: "Cartouche" }, { value: "rim", label: "Rim" }, { value: "none", label: "None" },
];
const EDGES = [{ value: "plain", label: "Plain" }, { value: "reeded", label: "Reeded" }, { value: "rope", label: "Rope" }, { value: "beads", label: "Beads" }];

function TemplateEditor({ id, notify }) {
  const [t, setT] = useState(null);
  const [base, setBase] = useState(null);
  const [palette, setPalette] = useState(null);
  const [hidden, setHidden] = useState([]); // preview only
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newPalette, setNewPalette] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api(`/chip_templates/${id}`), api("/chip_templates")]).then(([tpl, list]) => {
      setT(tpl);
      setBase(list.default);
      setPalette(tpl.draft.defaults.palette || Object.keys(tpl.draft.palettes)[0] || null);
    }).catch((e) => notify(e.message, "error"));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!t || !base) return <p className="py-16 text-center text-sm text-slate-500 !font-sans">Loading…</p>;
  const draft = t.draft;
  const defaults = draft.defaults;
  const setDraft = (patch) => { setT({ ...t, draft: { ...draft, ...patch } }); setDirty(true); };
  const setDefault = (patch) => setDraft({ defaults: { ...defaults, ...patch } });
  const setField = (patch) => { setT({ ...t, ...patch }); setDirty(true); };
  const scene = { finish: defaults.finish || "enamel", metal: defaults.metal || "brass", colors: draft.palettes[palette] || {}, palette, hidden, layout: defaults.layout };
  const round = templateDesign(base, { ...t, draft }, { draft: true, scene: { palette, hidden } });
  // The same art on a Meeting Maker chip
  const design = { ...round, meeting: { ...base.meeting, emblem: "scene", scene: round.round.scene, milestone_at: defaults.milestone_at || "badge", edge: defaults.edge || "plain", sides: ["Meeting", "Maker", "Your meeting"] } };
  const today = new Date().toISOString().slice(0, 10);
  const previews = [
    ...(t.fits !== "triangle" ? [{ id: "preview-round", shape: "round", kind: "round", milestone: PREVIEW, label: "1 year", on: today }] : []),
    ...(t.fits !== "round" ? [{ id: "preview-meeting", shape: "triangle", kind: "meeting", count: 10, label: "10 meetings", on: today }] : []),
  ];
  const baseColors = [...new Set(draft.art.layers.filter((l) => l.role === "enamel").flatMap((l) => l.shapes.map((s) => s.fill).filter(Boolean)))];

  const save = async () => {
    setBusy(true);
    try {
      const saved = await api(`/chip_templates/${t.id}`, { method: "PATCH", body: { template: { title: t.title, fits: t.fits, source: t.source || "", license: t.license || "", art: draft.art, palettes: draft.palettes, defaults: draft.defaults } } });
      setT(saved);
      setDirty(false);
      notify("Draft saved.");
      return saved;
    } catch (e) { notify(e.message, "error"); return null; } finally { setBusy(false); }
  };
  const publish = async () => {
    if (dirty && !(await save())) return;
    setBusy(true);
    try {
      setT(await api(`/chip_templates/${t.id}/publish`, { method: "POST" }));
      notify("Published. Groups can use this version now.");
    } catch (e) { notify(e.message, "error"); } finally { setBusy(false); }
  };
  const remove = async () => {
    try {
      await api(`/chip_templates/${t.id}`, { method: "DELETE" });
      notify(t.version ? "Retired. Chips already out keep it." : "Deleted.");
      navigate("/chip_templates");
    } catch (e) { notify(e.message, "error"); }
  };
  const setPaletteColor = (from, to) => setDraft({ palettes: { ...draft.palettes, [palette]: { ...(draft.palettes[palette] || {}), [from]: to } } });
  const addPalette = () => {
    const name = newPalette.trim();
    if (!name || draft.palettes[name]) return;
    setDraft({ palettes: { ...draft.palettes, [name]: {} } });
    setPalette(name);
    setNewPalette("");
  };
  const dropPalette = () => {
    const { [palette]: _gone, ...rest } = draft.palettes;
    setDraft({ palettes: rest });
    setPalette(Object.keys(rest)[0] || null);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/chip_templates" className={buttonClass.secondary}><ArrowLeft className="size-4" /> Templates</Link>
        <span className="flex-1" />
        {t.status === "published" && <Status template={t} />}
        {t.changed && t.version && <span className="text-sm text-amber-700 dark:text-amber-300">Changes since v{t.version}</span>}
        <button type="button" className={buttonClass.danger} onClick={remove}><Trash2 className="size-4" /> {t.version ? "Retire" : "Delete"}</button>
        <button type="button" className={buttonClass.secondary} disabled={busy || !dirty} onClick={save}>Save draft</button>
        <button type="button" className={buttonClass.primary} disabled={busy || (!dirty && !t.changed)} onClick={publish}>Publish{t.version ? ` v${t.version + 1}` : ""}</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="Art" subtitle="Paint shapes with the bucket. Lock a layer to keep groups from repainting it.">
          <ArtEditor mode="template" value={{ art: draft.art, scene }} base={base} look={applyDefaults({}, defaults)} fits={t.fits}
            onChange={(next) => {
              const patch = {};
              if (next.art !== draft.art) patch.art = next.art;
              if (next.scene.layout !== defaults.layout) patch.defaults = { ...defaults, layout: next.scene.layout };
              if (Object.keys(patch).length) setDraft(patch);
              setHidden(next.scene.hidden || []);
            }} />
        </Card>

        <div className="space-y-6">
          <Card title="Preview">
            <div className="flex flex-wrap items-center justify-center gap-4">
              {previews.map((chip) => (
                <SpinningChip key={`${chip.id}-${palette}-${defaults.finish}-${defaults.metal}`} chip={chip} design={design} size={previews.length > 1 ? 150 : 220} />
              ))}
            </div>
          </Card>
          <Card title="About it">
            <div className="space-y-3">
              <label className="block"><span className={labelClass}>Name</span><input id="tpl-title" className={inputClass} value={t.title} onChange={(e) => setField({ title: e.target.value })} /></label>
              <div><span className={labelClass}>Fits</span>
                <SegmentedControl value={t.fits} onChange={(v) => setField({ fits: v })} options={[{ value: "round", label: "Round" }, { value: "triangle", label: "Meeting Maker" }, { value: "both", label: "Both" }]} />
              </div>
              <label className="block"><span className={labelClass}>Where the art came from</span><input id="tpl-source" className={inputClass} value={t.source || ""} onChange={(e) => setField({ source: e.target.value })} placeholder="Drawn by …" /></label>
              <label className="block"><span className={labelClass}>License</span><input id="tpl-license" className={inputClass} value={t.license || ""} onChange={(e) => setField({ license: e.target.value })} placeholder="Owned by RecoveryBot, CC0, …" /></label>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Palettes" subtitle="Each palette swaps the art's colors. Groups pick one, then can repaint from there.">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.keys(draft.palettes).map((name) => (
                <button key={name} type="button" onClick={() => setPalette(name)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${name === palette ? "!bg-accent/10 text-accent ring-accent/40" : "!bg-transparent text-slate-600 ring-neutral-300 dark:text-neutral-300 dark:ring-neutral-700"}`}>
                  {name}{defaults.palette === name ? " · default" : ""}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input id="tpl-new-palette" className={inputClass} value={newPalette} onChange={(e) => setNewPalette(e.target.value)} placeholder="New palette name" />
              <button type="button" className={buttonClass.secondary} onClick={addPalette}><Plus className="size-4" /> Add</button>
            </div>
            {palette && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {baseColors.map((c) => (
                    <label key={c} className="flex items-center gap-2 rounded-lg px-2 py-1 ring-1 ring-neutral-200 dark:ring-neutral-700">
                      <span className="size-5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: c }} title={`Art color ${c}`} />
                      <span className="text-xs text-slate-400">→</span>
                      <input type="color" value={draft.palettes[palette]?.[c] || c} onChange={(e) => setPaletteColor(c, e.target.value)} className="h-6 w-10 cursor-pointer border-0 !bg-transparent p-0" aria-label={`${palette}: color for ${c}`} />
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={buttonClass.secondary} onClick={() => setDefault({ palette })}>Make it the default</button>
                  <button type="button" className={buttonClass.danger} onClick={dropPalette}>Remove {palette}</button>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card title="How it's shown" subtitle="What a group starts with when it picks this template. Groups can change all of it.">
          <div className="space-y-3">
            <div><span className={labelClass}>Finish</span>
              <SegmentedControl value={defaults.finish || "enamel"} onChange={(v) => setDefault({ finish: v })} options={[{ value: "enamel", label: "Enamel" }, { value: "struck", label: "Struck" }]} />
            </div>
            <div><span className={labelClass}>Metal</span>
              <SegmentedControl value={defaults.metal || "brass"} onChange={(v) => setDefault({ metal: v })} options={Object.entries(METAL_LABELS).map(([value, label]) => ({ value, label }))} />
            </div>
            <div><span className={labelClass}>Milestone</span><SegmentedControl value={defaults.milestone_at || "badge"} onChange={(v) => setDefault({ milestone_at: v })} options={MILESTONE_AT} /></div>
            <div><span className={labelClass}>Edge</span><SegmentedControl value={defaults.edge || "plain"} onChange={(v) => setDefault({ edge: v })} options={EDGES} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className={labelClass}>Around the top</span><input id="tpl-top" className={inputClass} value={defaults.top_text ?? ""} onChange={(e) => setDefault({ top_text: e.target.value })} /></label>
              <label className="block"><span className={labelClass}>Around the bottom</span><input id="tpl-bottom" className={inputClass} value={defaults.bottom_text ?? ""} onChange={(e) => setDefault({ bottom_text: e.target.value })} /></label>
              <label className="block"><span className={labelClass}>Back ring, top</span><input id="tpl-ring-top" className={inputClass} value={defaults.back_ring_top ?? ""} onChange={(e) => setDefault({ back_ring_top: e.target.value })} /></label>
              <label className="block"><span className={labelClass}>Back ring, bottom</span><input id="tpl-ring-bottom" className={inputClass} value={defaults.back_ring_bottom ?? ""} onChange={(e) => setDefault({ back_ring_bottom: e.target.value })} /></label>
            </div>
            <label className="block"><span className={labelClass}>On the back</span><textarea id="tpl-back" rows={3} className={inputClass} value={defaults.back_text ?? ""} onChange={(e) => setDefault({ back_text: e.target.value })} placeholder="Our own words or public domain, never quotes from copyrighted literature" /></label>
          </div>
        </Card>
      </div>
    </>
  );
}
