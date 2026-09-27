import { levelAt, waterAt, SAFE_RADIUS } from "./terrain.js";
import { townInRegion, castleInRegion, TOWN_REGION, CASTLE_REGION } from "./settlements.js";

export { SAFE_RADIUS };

const key = (x, y) => `${x},${y}`;

// The generated world for one journey. Every query is a pure function of the seed, cached.
// A null seed is the original flat meadow, kept so older journeys load unchanged.
export default class World {
  constructor(seed) {
    this.seed = seed ?? null;
    this.flat = this.seed === null;
    this.cells = new Map();
  }

  level(x, y) {
    return this.flat ? 0 : levelAt(this.seed, x, y);
  }

  water(x, y) {
    return !this.flat && waterAt(this.seed, x, y);
  }

  // {
  //   level, water,
  //   face  - cliff face (lower ground directly below higher ground), not walkable
  //   lip   - top edge of a south-facing cliff
  //   rim   - plateau edge bits on higher ground: N=1 E=2 W=4
  //   part  - settlement piece ({ part: "house" | "well" | "path" | ... }) or null
  //   settlement, stop
  // }
  cell(x, y) {
    const k = key(x, y);
    let c = this.cells.get(k);
    if (c) return c;

    const level = this.level(x, y);
    const water = this.water(x, y);
    const { part, settlement, stop } = this.settlementAt(x, y);
    c = {
      level,
      water,
      face: !water && this.level(x, y - 1) > level,
      lip: !water && this.level(x, y + 1) < level,
      rim:
        (this.level(x, y - 1) < level ? 1 : 0) |
        (this.level(x + 1, y) < level ? 2 : 0) |
        (this.level(x - 1, y) < level ? 4 : 0),
      part,
      settlement,
      stop,
    };
    this.cells.set(k, c);
    return c;
  }

  settlementAt(x, y) {
    const none = { part: null, settlement: null, stop: null };
    if (this.flat) return none;
    const k = key(x, y);
    for (const s of this.settlementsNear(x, y)) {
      const part = s.tiles.get(k);
      if (part) return { part, settlement: s, stop: s.stops.find((st) => st.id === k) || null };
    }
    return none;
  }

  // Towns and castles whose regions touch (x, y)
  settlementsNear(x, y, radius = 0) {
    if (this.flat) return [];
    const found = [];
    const scan = (size, build) => {
      const r = 1 + Math.ceil(radius / size);
      const rx0 = Math.floor(x / size), ry0 = Math.floor(y / size);
      for (let ry = ry0 - r; ry <= ry0 + r; ry++) {
        for (let rx = rx0 - r; rx <= rx0 + r; rx++) {
          const s = build(this.seed, rx, ry);
          if (s) found.push(s);
        }
      }
    };
    scan(TOWN_REGION, townInRegion);
    scan(CASTLE_REGION, castleInRegion);
    return found;
  }

  // Building stops within `radius` tiles of (x, y)
  stopsNear(x, y, radius) {
    return this.settlementsNear(x, y, radius)
      .flatMap((s) => s.stops.map((st) => ({ ...st, settlement: s })))
      .filter((st) => Math.abs(st.x - x) + Math.abs(st.y - y) <= radius);
  }
}
