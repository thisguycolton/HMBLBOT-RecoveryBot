// The decisions log read like forum threads: a main motion, with what was moved about it nested
// under it. A motion sits under the one it applies to (an amendment under its motion, an
// amendment to the amendment under that, a motion to table under what it set aside), and a
// decision that replaces or amends an earlier one sits under that one, so the history of a rule
// reads as one thread. Oldest first inside a thread; threads with the latest activity first.

const day = (m) => m.decided_on || m.created_at?.slice(0, 10) || "";
const oldestFirst = (a, b) => day(a).localeCompare(day(b)) || a.id - b.id;

export function buildThreads(motions) {
  const byId = new Map(motions.map((m) => [m.id, m]));
  // what a motion hangs from: what it applies to, else what it replaces (if the viewer can see it)
  const up = (m) => (m.parent_id && byId.has(m.parent_id) ? m.parent_id : m.supersedes_id && byId.has(m.supersedes_id) ? m.supersedes_id : null);
  const kids = new Map();
  motions.forEach((m) => {
    const p = up(m);
    if (p) kids.set(p, [...(kids.get(p) || []), m]);
  });
  kids.forEach((list) => list.sort(oldestFirst));

  // The top of a motion's thread. Each link is checked against loops on its own, but one made of
  // both kinds is still possible, so stop at the first motion seen twice.
  const rootOf = (m) => {
    const seen = new Set([m.id]);
    let node = m;
    for (let p = up(node); p && !seen.has(p); p = up(node)) {
      seen.add(p);
      node = byId.get(p);
    }
    return node;
  };

  // Everyone in a thread, in reading order, with how deep each is nested
  const members = (root) => {
    const out = [];
    const seen = new Set();
    const walk = (m, depth) => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      out.push({ motion: m, depth });
      (kids.get(m.id) || []).forEach((k) => walk(k, depth + 1));
    };
    walk(root, 0);
    return out;
  };

  const rootIds = new Set();
  const roots = [];
  motions.forEach((m) => {
    const r = rootOf(m);
    if (!rootIds.has(r.id)) { rootIds.add(r.id); roots.push(r); }
  });
  const threads = roots.map((root) => {
    const list = members(root);
    const latest = list.reduce((a, b) => (oldestFirst(a.motion, b.motion) >= 0 ? a : b)).motion;
    return { root, members: list, latest };
  }).sort((a, b) => oldestFirst(b.latest, a.latest));

  return { threads, kids, rootOf, members };
}

// Everything below a motion (so it can't be put under one of its own)
export function below(motions, id) {
  const out = new Set();
  const walk = (pid) => motions.forEach((m) => {
    if (m.parent_id === pid && !out.has(m.id) && m.id !== id) { out.add(m.id); walk(m.id); }
  });
  walk(id);
  return out;
}
