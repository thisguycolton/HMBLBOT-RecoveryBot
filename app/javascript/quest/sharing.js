// "Choose your path": pick a few sharing modes (lenses) for a topic. The same topic can be
// approached as a Story, a Check-In, a Lesson... so there's no finished question per topic.

// Pick `count` lenses: at least one gentle option, lenses this place favours first, and
// ones not yet used on this topic in this journey when there are enough of them.
export function pickLenses(modes, { used = [], gentleOnly = false, favor = [], count = 3, rng = Math.random } = {}) {
  let pool = modes.filter((m) => !gentleOnly || m.gentle);
  const fresh = pool.filter((m) => !used.includes(m.key));
  if (fresh.length >= count) pool = fresh;
  pool = shuffle(pool, rng);

  const chosen = [];
  const take = (m) => m && !chosen.includes(m) && chosen.length < count && chosen.push(m);
  take(pool.find((m) => favor.includes(m.key)));
  if (!chosen.some((m) => m.gentle)) take(pool.find((m) => m.gentle));
  pool.forEach(take);
  return chosen;
}

export const randomLens = (modes, rng = Math.random) => modes[Math.floor(rng() * modes.length)];

function shuffle(list, rng) {
  return list.map((v) => [rng(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}
