// Chip templates (ChipTemplate) as chip designs (ChipDesign), for previews and pickers.

// The words and look a template brings to a round chip, laid over `base` (a design's round part)
export function applyDefaults(round, defaults = {}) {
  const words = ["top_text", "bottom_text", "back_text", "back_ring_top", "back_ring_bottom", "milestone_at", "edge"];
  const out = { ...round };
  words.forEach((k) => { if (defaults[k] !== undefined) out[k] = defaults[k]; });
  return out;
}

// A scene from a template's latest version (or its draft): its art, the palette's colors, and
// the template's finish and metal unless `scene` says otherwise
export function sceneFrom(template, scene = {}, { draft = false } = {}) {
  const src = draft ? template.draft : template;
  const defaults = src.defaults || {};
  const palette = scene.palette || defaults.palette || Object.keys(src.palettes || {})[0];
  return {
    template_id: template.id, version: scene.version || template.version, title: template.title, latest: template.version,
    finish: defaults.finish || "enamel", metal: defaults.metal || "brass",
    ...scene,
    palette, art: src.art, colors: (src.palettes || {})[palette] || {},
  };
}

// A whole design showing `template` on round chips, from the default design
export function templateDesign(base, template, opts = {}) {
  const src = opts.draft ? template.draft : template;
  return {
    ...base,
    round: { ...applyDefaults(base.round, src.defaults), emblem: "scene", scene: sceneFrom(template, opts.scene, opts) },
  };
}

// The scene as it's saved: no art or colors (the server puts them back in)
export function storedScene(scene) {
  if (!scene) return scene;
  const { art, colors, title, latest, ...rest } = scene;
  return rest;
}

// Reads a picked file as text (an SVG upload)
export const readText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("Couldn't read that file."));
  reader.readAsText(file);
});
