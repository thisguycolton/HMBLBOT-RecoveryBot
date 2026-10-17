import React, { useEffect, useState } from "react";
import { BellRing, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { inputClass, labelClass } from "../../ui/styles";
import Toggle from "../../ui/Toggle";
import { api, BLOCK_INFO, COLORS, updateTitle } from "../lib";
import { ActivitiesEditor, PhotosEditor } from "./ListEditors";

export function Field({ label, hint, children }) {
  return (
    <div>
      {label && <span className={labelClass}>{label}</span>}
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}

// A row of choices, like the admin suite's filters
export function Choice({ options, value, onChange }) {
  return (
    <div className="flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
      {options.map(([key, label]) => (
        <button key={key} type="button" onClick={() => onChange(key)} aria-pressed={value === key}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
            value === key ? "!bg-white text-slate-900 shadow-sm dark:!bg-neutral-950 dark:text-white" : "!bg-transparent text-slate-500 hover:text-slate-800 dark:text-neutral-400"
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}

const WIDTHS = [[3, "¼"], [4, "⅓"], [6, "½"], [8, "⅔"], [9, "¾"], [12, "Full"]];

// The right-hand panel's fields for the selected block. uploadPath takes its pictures;
// pollsFor is the event whose polls a Poll block picks from. On a group page there are no
// followers to send updates to (announces is false), `blockInfo` names its blocks and
// `extraFields` draws the fields of the group's own blocks.
export default function BlockInspector({ block, uploadPath, pollsFor, announces = true, followers, changed, onChange, onRemove, blockInfo = BLOCK_INFO, extraFields, textHint }) {
  const set = (field) => (value) => onChange({ [field]: value });
  const info = blockInfo[block.type];
  const Icon = info?.icon;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-200">{Icon && <Icon className="size-5" />}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{info?.label}</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">{info?.note}</p>
        </div>
        <button type="button" onClick={onRemove} className="grid size-8 place-items-center rounded-lg !bg-transparent text-slate-400 hover:!bg-rose-50 hover:text-rose-600 dark:hover:!bg-rose-950/40" aria-label="Delete block" title="Delete block">
          <Trash2 className="size-4" />
        </button>
      </div>

      {block.type === "heading" && (
        <>
          <Field label="Text" hint={textHint}><input className={inputClass} value={block.text} onChange={(e) => set("text")(e.target.value)} maxLength={200} /></Field>
          <Field label="Size"><Choice value={block.level} onChange={set("level")} options={[[1, "Large"], [2, "Medium"], [3, "Small"]]} /></Field>
          <Field label="Align"><Choice value={block.align} onChange={set("align")} options={[["left", "Left"], ["center", "Center"], ["right", "Right"]]} /></Field>
        </>
      )}

      {block.type === "notes" && (
        <>
          <Field label="Notes" hint={`Markdown: # headline, **bold**, - lists, [links](https://…)${textHint ? `. ${textHint}` : ""}`}>
            <textarea className={`${inputClass} min-h-40 font-mono !text-xs`} value={block.markdown} onChange={(e) => set("markdown")(e.target.value)} />
          </Field>
          {announces && <UpdateToggle
            checked={block.update}
            onChange={set("update")}
            label="Send as an update"
            description="Each time this note changes, everyone following the event gets it in the app and by email. The first line's # headline is the update's title."
            changed={changed}
            followers={followers}
            title={updateTitle(block.markdown)}
          />}
        </>
      )}

      {block.type === "guidelines" && (
        <>
          <Field label="Guidelines" hint="Markdown: a heading, then a list works well">
            <textarea className={`${inputClass} min-h-40 font-mono !text-xs`} value={block.markdown} onChange={(e) => set("markdown")(e.target.value)} />
          </Field>
          {announces && <UpdateToggle
            checked={block.notify}
            onChange={set("notify")}
            label="Tell participants when these change"
            description="Everyone following the event hears about each change, in the app and by email."
            changed={changed}
            followers={followers}
            title={updateTitle(block.markdown, "The guidelines changed")}
          />}
        </>
      )}

      {block.type === "agenda" && (
        <>
          <Field label="Title"><input className={inputClass} value={block.title} onChange={(e) => set("title")(e.target.value)} maxLength={120} /></Field>
          <Field label="Show as" hint="The side column always shows a compact list."><Choice value={block.view} onChange={set("view")} options={[["list", "List"], ["grid", "Grid"]]} /></Field>
          <Field label={`Activities (${block.activities.length})`} hint="Drag to change the order; the number follows.">
            <ActivitiesEditor uploadPath={uploadPath} activities={block.activities} onChange={set("activities")} />
          </Field>
        </>
      )}

      {block.type === "photo" && (
        <Field label="Photos" hint="Two or more turn into a carousel. Tapping a photo opens it full screen.">
          <PhotosEditor uploadPath={uploadPath} photos={block.photos} onChange={set("photos")} />
        </Field>
      )}

      {block.type === "gallery" && (
        <>
          <Field label="Title"><input className={inputClass} value={block.title} onChange={(e) => set("title")(e.target.value)} placeholder="Optional" maxLength={120} /></Field>
          <Field label="Photos" hint="Tapping a photo opens the shadow box carousel.">
            <PhotosEditor uploadPath={uploadPath} photos={block.photos} onChange={set("photos")} />
          </Field>
        </>
      )}

      {block.type === "conscience_agenda" && (
        <Field label="Title" hint="Shows the agenda of the business meeting this event is linked to, to the group's members."><input className={inputClass} value={block.title || ""} onChange={(e) => set("title")(e.target.value)} maxLength={120} /></Field>
      )}

      {block.type === "poll" && pollsFor && <PollPicker token={pollsFor} value={block.poll_token} onChange={set("poll_token")} />}

      {extraFields?.(block, set)}

      <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-neutral-800">
        <Field label="Color" hint="From the site's palette; it follows light and dark mode.">
          <ColorPicker value={block.color || "default"} onChange={set("color")} />
        </Field>
        <Field label="Column"><Choice value={block.region} onChange={set("region")} options={[["main", "Main"], ["side", "Side"]]} /></Field>
        <Field label="View" hint="Auto uses the side column's smaller view there and the larger view in the main column.">
          <Choice value={block.size || "auto"} onChange={set("size")} options={[["auto", "Auto"], ["compact", "Smaller"], ["full", "Larger"]]} />
        </Field>
        <Field label="Width" hint="Or drag the block's right edge on the page.">
          <Choice value={block.span} onChange={set("span")} options={WIDTHS} />
        </Field>
      </div>
    </div>
  );
}

// The palette's swatches (COLORS in ../lib)
export function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {COLORS.map((c) => (
        <button key={c.key} type="button" role="radio" aria-checked={value === c.key} title={c.label} aria-label={c.label} onClick={() => onChange(c.key)}
          className={`grid size-8 place-items-center rounded-full !p-0 ring-offset-2 ring-offset-white transition dark:ring-offset-neutral-900 ${c.swatch} ${value === c.key ? "ring-2 !ring-accent" : "hover:scale-110"}`}>
          {value === c.key && <span className={`size-2.5 rounded-full ${c.key === "default" ? "bg-accent" : "bg-white"}`} />}
        </button>
      ))}
    </div>
  );
}

function UpdateToggle({ checked, onChange, label, description, changed, followers, title }) {
  return (
    <div className="space-y-2 rounded-xl bg-accent/5 p-3 ring-1 ring-accent/15 dark:bg-accent/10">
      <Toggle checked={checked} onChange={onChange} label={label} description={description} />
      {checked && changed && (
        <p className="flex items-start gap-1.5 text-xs font-medium text-accent dark:text-sky-300">
          <BellRing className="mt-0.5 size-3.5 shrink-0" />
          {followers > 0
            ? `Saving sends “${title}” to ${followers} ${followers === 1 ? "person" : "people"}.`
            : "Nobody's following yet, so saving won't send anything."}
        </p>
      )}
    </div>
  );
}

// Pick one of the event's polls, or one you run; or start a new one for this event
function PollPicker({ token, value, onChange }) {
  const [polls, setPolls] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api(`/events/${token}/poll_options`).then((d) => setPolls(d.polls)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [token]);

  return (
    <Field label="Poll" hint="Picking a poll you run makes it this event's poll; voting in it with an account follows the event.">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!polls ? (
        <p className="text-sm text-slate-500">Loading polls…</p>
      ) : (
        <div className="space-y-1.5">
          {polls.length === 0 && <p className="text-sm text-slate-500 dark:text-neutral-400">No polls yet.</p>}
          {polls.map((p) => (
            <label key={p.token} className={`flex cursor-pointer items-start gap-2 rounded-xl p-2.5 ring-1 ${value === p.token ? "bg-accent/10 ring-accent" : "bg-white ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700"}`}>
              <input type="radio" name="poll" className="mt-1 accent-[var(--color-accent)]" checked={value === p.token} onChange={() => onChange(p.token)} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900 dark:text-white">{p.title}</span>
                <span className="block text-xs text-slate-500 dark:text-neutral-400">
                  {p.ballots_count} vote{p.ballots_count === 1 ? "" : "s"} · {p.closed ? "closed" : "open"}{p.linked ? " · this event's" : ""}
                </span>
              </span>
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <a href={`/schedule_polls/new?event=${token}`} target="_blank" rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl !bg-accent px-3 py-2 text-sm font-semibold !text-white">
              <ExternalLink className="size-4" /> New poll for this event
            </a>
            <button type="button" onClick={load} className="grid size-9 place-items-center rounded-xl !bg-neutral-100 text-slate-600 dark:!bg-neutral-800 dark:text-neutral-300" title="Refresh the list" aria-label="Refresh the list">
              <RefreshCw className="size-4" />
            </button>
          </div>
        </div>
      )}
    </Field>
  );
}
