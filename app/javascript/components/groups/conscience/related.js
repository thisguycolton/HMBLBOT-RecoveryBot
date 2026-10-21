// Finding decisions that might be about the same thing as another one, all in the browser
// (the log is loaded whole). Each motion becomes a bag of word stems, its title counting
// double; two motions score by TF-IDF cosine, so words every motion uses ("motion", "group")
// count for little and rare shared words ("camera", "urn") for a lot. A stem that only
// shares its start with another ("sponsor" / "sponsorship") gets part credit, which catches
// most of what a fuzzy match would. Pattern search lets people look further with a regex.

const STOP = new Set(`a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing done down during each few for from further had has have having he her here
hers him his how i if in into is it its itself just let may me might more most must my no nor not now of off on once only or
other our ours out over own per same shall she should so some such than that the their theirs them then there these they this
those through to too under until up upon us very via was we were what when where which while who whom why will with would
you your yours yes motion motions move moved moves moving propose proposed proposes proposal suggest suggested suggests
group groups member members meeting meetings vote voted votes passed pass fail failed second seconded make made new
like want wants need needs going one two us thing things get got
around alot lot lots really every still well much many back take put use used way able ask asked asking request requested
requests accept accepted carried carries carry approve approved agree agreed discuss discussed discussion people person
someone anyone everyone next last part`.split(/\s+/));

// Plural and verb endings off, so "cameras" meets "camera" and "memes" meets "meme"
export function stem(word) {
  let w = word;
  if (w.length > 5 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 5 && /(ss|sh|ch|x|z)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 6 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 5 && w.endsWith("ed")) w = w.slice(0, -2);
  return w;
}

// Stems with the word each first came from, so the reason shown reads as the person wrote it
export function words(text) {
  const out = [];
  for (const raw of (text || "").toLowerCase().match(/[a-z0-9][a-z0-9'’]*/g) || []) {
    const word = raw.replace(/['’](s|t|re|ll|ve|d)?$/, "");
    if (STOP.has(word)) continue;
    if (/^\d+$/.test(word) ? word.length > 4 : word.length < 3) continue;
    out.push([stem(word), word]);
  }
  return out;
}

const TITLE_WEIGHT = 2;

function bag(m) {
  const terms = new Map();
  const shown = new Map();
  const add = (text, weight) => words(text).forEach(([s, w]) => { terms.set(s, (terms.get(s) || 0) + weight); if (!shown.has(s)) shown.set(s, w); });
  add(m.title, TITLE_WEIGHT);
  add(m.text, 1);
  add(m.amended_text, 1);
  return { terms, shown };
}

// Built once per load of the log, then asked about one motion at a time
export function relatedIndex(motions) {
  const bags = new Map(motions.map((m) => [m.id, bag(m)]));
  const df = new Map();
  bags.forEach(({ terms }) => terms.forEach((_, s) => df.set(s, (df.get(s) || 0) + 1)));
  const n = Math.max(1, motions.length);
  const idf = (s) => Math.log(1 + n / (df.get(s) || 1));
  const vectors = new Map();
  bags.forEach(({ terms }, id) => {
    const v = new Map();
    let norm = 0;
    terms.forEach((tf, s) => { const w = (1 + Math.log(tf)) * idf(s); v.set(s, w); norm += w * w; });
    vectors.set(id, { v, norm: Math.sqrt(norm) || 1 });
  });

  // The motion's rarest words, the ones that say what it's about, as a ready-made pattern
  const keyTerms = (id, count = 4) => {
    const b = bags.get(id);
    const vec = vectors.get(id);
    if (!b || !vec) return [];
    return [...vec.v.entries()]
      .filter(([s]) => (df.get(s) || 0) > 1 || b.terms.get(s) >= TITLE_WEIGHT)
      .sort((x, y) => y[1] - x[1])
      .slice(0, count)
      // the stem when it's how the word starts (so it matches every ending), else the word itself
      .map(([s]) => (b.shown.get(s).startsWith(s) ? s : b.shown.get(s)));
  };

  const related = (id, { limit = 8, min = 0.08 } = {}) => {
    const a = vectors.get(id);
    if (!a) return [];
    const results = [];
    motions.forEach((m) => {
      if (m.id === id) return;
      const b = vectors.get(m.id);
      let dot = 0;
      const shared = [];
      a.v.forEach((wa, s) => {
        const wb = b.v.get(s);
        if (wb) { dot += wa * wb; shared.push([s, wa * wb]); return; }
        if (s.length < 4) return;
        // part credit for a shared beginning of at least four letters
        let best = 0;
        let bestStem = null;
        b.v.forEach((w, t) => {
          if (t.length >= 4 && t !== s && (t.startsWith(s) || s.startsWith(t)) && w > best) { best = w; bestStem = t; }
        });
        if (bestStem) { dot += 0.6 * wa * best; shared.push([s, 0.6 * wa * best]); }
      });
      const score = dot / (a.norm * b.norm);
      if (score >= min) {
        const reason = shared.sort((x, y) => y[1] - x[1]).slice(0, 3).map(([s]) => bags.get(id).shown.get(s));
        results.push({ motion: m, score, shared: reason });
      }
    });
    return results.sort((x, y) => y.score - x.score).slice(0, limit);
  };

  return { related, keyTerms };
}

// A pattern typed by a person: a case-insensitive regex, or null with the reason it isn't one
export function toRegex(pattern) {
  const p = (pattern || "").trim();
  if (!p) return { re: null, error: null };
  try {
    return { re: new RegExp(p, "i"), error: null };
  } catch (e) {
    return { re: null, error: "That pattern isn't a valid regular expression." };
  }
}

export const searchableText = (m) => [m.title, m.text, m.amended_text, m.note, m.moved_by, m.seconded_by].filter(Boolean).join("\n");
