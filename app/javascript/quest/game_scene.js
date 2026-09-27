import * as Phaser from "phaser";
import World from "./world/world";
import { hash } from "./world/noise";
import {
  DIRS, CLEARED_AS, OBSTACLE_ITEM, key, parse, nodeAt, findRoute,
  reachableTargets, carveBranch, routeToSettlement, openDirections, spacingForAttempt,
} from "./world/paths";
import { F, X, XF, EXTRA_GID, WATER_PAIRS, SWAY_PAIRS, VILLAGER_WALK, VILLAGER_VARIANTS, STALL, waterFrame } from "./world/tiles";
import { placeName } from "./world/names";
import { ENCOUNTERS, rollEncounterKind, SPACING_BY_KIND, OPEN_ROAD } from "./encounters";
import {
  TOOL_TYPES, TOOL_NAMES, TOOL_A, normalizeTools, usesLeft, canAfford, missingTool, useTool, addTool, makeTool, describeTool,
} from "./tools";

// The board: a generated 16-bit world (cliffs, rivers, towns, castles) with the group's
// journey carved through it. The group picks a blinking stop, the traveler walks there,
// and the app shows the discussion card. Finishing a stop sprouts new paths from it.
//
// Game state (persisted by QuestApp):
//   seed               world seed; missing on older journeys, which keep the flat meadow
//   grid               { "x,y": tile } carved paths and visit records (see world/paths.js)
//   current_position   { x, y }
//   tools              [{ id, type, uses, max, legendary }] (see tools.js)

export const TILE = 16;
export const STATE_VERSION = 3;

const PLATE = { visited: 0x5d5a6e, mystery: 0xe8b33c, start: 0xf2e9c9 };
export const ITEM_NAMES = TOOL_NAMES;
export const ITEM_A = TOOL_A;
const OBSTACLE_NAMES = { ford: "A river", boulder: "A boulder", log: "A fallen tree", climb: "A cliff" };

const pick = (list, r) => list[Math.floor(r * list.length)];

export function newGameState(seed = Math.floor(Math.random() * 2 ** 31)) {
  return {
    version: STATE_VERSION,
    seed,
    grid: { [key(0, 0)]: { type: "start", visited: true } },
    current_position: { x: 0, y: 0 },
    tools: [],
    used_topic_ids: [],
    history: [],
  };
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  // data: { state, sheetUrl, extraUrl, icons: { name: url }, categories: [{ id, title, color, icon }],
  //         onArrive(stop), onChange(), onNotice(message), onBlocked(message), onNeedsHelp() }
  init(data) {
    this.state = data.state;
    normalizeTools(this.state);
    this.world = new World(this.state.seed);
    this.sheetUrl = data.sheetUrl;
    this.extraUrl = data.extraUrl;
    this.icons = data.icons;
    this.categories = data.categories;
    this.categoryById = new Map(this.categories.map((c) => [c.id, c]));
    this.onArrive = data.onArrive;
    this.onChange = data.onChange;
    this.onNotice = data.onNotice;
    this.onBlocked = data.onBlocked;
    this.onNeedsHelp = data.onNeedsHelp;
    this.onLog = data.onLog; // journey log entries: moves, obstacles, items
    this.moving = false;
    this.locked = false;
    this.villagers = new Map(); // settlement id -> wandering villagers
  }

  get grid() {
    return this.state.grid;
  }

  get tools() {
    return this.state.tools;
  }

  preload() {
    this.load.spritesheet("rpg", this.sheetUrl, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet("extra", this.extraUrl, { frameWidth: 16, frameHeight: 16 });
    for (const [name, url] of Object.entries(this.icons)) {
      if (url) this.load.image(`icon:${name}`, url);
    }
    // A missing icon just leaves the plate blank
    this.load.on("loaderror", () => {});
  }

  create() {
    this.makeTextures();
    this.makeAnimations();

    this.markerLayer = this.add.container(0, 0).setDepth(20);
    this.glowLayer = this.add.container(0, 0).setDepth(21);
    this.makeTraveler();

    // First visit to a fresh board: sprout the opening paths
    if (!Object.values(this.grid).some((t) => t.type === "topic")) {
      this.sproutFrom(0, 0);
      this.onChange?.();
    }

    this.redraw();
    this.setupInput();

    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setZoom(this.defaultZoom());
    this.centerOnTraveler(false);
    this.scale.on("resize", () => {
      const { x, y } = cam.midPoint; // view centre as last drawn
      cam.centerOn(x, y);
    });

    // Two-frame water shimmer, stepped like an old console
    this.waterPhase = 0;
    this.time.addEvent({
      delay: 550,
      loop: true,
      callback: () => {
        if (!this.waterLayer) return;
        const from = this.waterPhase, to = 1 - this.waterPhase;
        WATER_PAIRS.forEach((pair) => this.waterLayer.replaceByIndex(pair[from], pair[to]));
        this.waterPhase = to;
      },
    });

    // Foliage sways in two groups, half a beat apart, so the forest doesn't move in lockstep
    this.swayPhase = [0, 0];
    [0, 1].forEach((group) =>
      this.time.addEvent({
        delay: 900,
        startAt: group * 450,
        loop: true,
        callback: () => {
          const layer = this.decorLayers?.[group];
          if (!layer) return;
          const from = this.swayPhase[group], to = 1 - from;
          SWAY_PAIRS.forEach((pair) => layer.replaceByIndex(pair[from], pair[to]));
          this.swayPhase[group] = to;
        },
      })
    );
    this.time.addEvent({ delay: 1400, loop: true, callback: () => this.wanderVillagers() });

    // Blink the "go here" brackets on and off
    this.time.addEvent({
      delay: 420,
      loop: true,
      callback: () => this.glowLayer.setVisible(!this.glowLayer.visible),
    });

    this.time.delayedCall(300, () => this.checkHelp());
  }

  defaultZoom() {
    const { width, height } = this.scale;
    return Phaser.Math.Clamp(Math.round(Math.min(width, height) / 190), 3, 6);
  }

  // ---------- art ----------

  makeTextures() {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Marker plate: 24x24 bevelled tile, white so it can be tinted per category.
    // The 16px icon sits inside with a 2px band of plate colour showing around it.
    g.clear();
    g.fillStyle(0x14101e, 1).fillRect(1, 0, 22, 24).fillRect(0, 1, 24, 22);
    g.fillStyle(0xffffff, 1).fillRect(2, 2, 20, 20);
    g.generateTexture("plate", 24, 24);

    // Bevel overlay: light top-left edge, dark bottom-right edge
    g.clear();
    g.fillStyle(0xffffff, 0.45).fillRect(2, 2, 20, 1).fillRect(2, 2, 1, 20);
    g.fillStyle(0x000000, 0.35).fillRect(2, 21, 20, 1).fillRect(21, 2, 1, 20);
    g.generateTexture("bevel", 24, 24);

    // Drop shadows under plates and the traveler
    g.clear();
    g.fillStyle(0x000000, 0.3).fillRect(2, 0, 16, 1).fillRect(0, 1, 20, 2).fillRect(2, 3, 16, 1);
    g.generateTexture("plateShadow", 20, 4);
    g.clear();
    g.fillStyle(0x000000, 0.3).fillRect(2, 0, 8, 1).fillRect(0, 1, 12, 2).fillRect(2, 3, 8, 1);
    g.generateTexture("shadow", 12, 4);

    // Corner brackets around selectable stops: ink outline with a pale yellow core
    g.clear();
    g.fillStyle(0x14101e, 1);
    [[0, 0, 7, 3], [0, 0, 3, 7], [25, 0, 7, 3], [29, 0, 3, 7], [0, 29, 7, 3], [0, 25, 3, 7], [25, 29, 7, 3], [29, 25, 3, 7]]
      .forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
    g.fillStyle(0xfff3a0, 1);
    [[1, 1, 5, 1], [1, 1, 1, 5], [26, 1, 5, 1], [30, 1, 1, 5], [1, 30, 5, 1], [1, 26, 1, 5], [26, 30, 5, 1], [30, 26, 1, 5]]
      .forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
    g.generateTexture("brackets", 32, 32);

    g.destroy();
  }

  makeAnimations() {
    const extra = (names) => this.anims.generateFrameNumbers("extra", { frames: names.map(XF) });
    if (!this.anims.exists("merchant-idle")) {
      this.anims.create({ key: "merchant-idle", frames: extra(["merchant_2", "merchant_2", "merchant_1", "merchant_2"]), frameRate: 2, repeat: -1 });
      this.anims.create({ key: "campfire", frames: extra(["campfire_0", "campfire_1", "campfire_2", "campfire_1"]), frameRate: 6, repeat: -1 });
      this.anims.create({ key: "ghost", frames: extra(["ghost_0", "ghost_1"]), frameRate: 3, repeat: -1 });
      for (let v = 0; v < VILLAGER_VARIANTS; v++) {
        for (const [dir, frames] of Object.entries(VILLAGER_WALK)) {
          this.anims.create({ key: `villager${v}-${dir}`, frames: extra(frames.map((n) => `villager${v}_${n}`)), frameRate: 6, repeat: -1 });
        }
      }
    }
    for (const [dir, frames] of Object.entries(F.walk)) {
      if (this.anims.exists(`walk-${dir}`)) continue;
      this.anims.create({
        key: `walk-${dir}`,
        frames: this.anims.generateFrameNumbers("rpg", { frames }),
        frameRate: 8,
        repeat: -1,
      });
    }
  }

  makeTraveler() {
    const { x, y } = this.state.current_position;
    this.travelerShadow = this.add.image(0, 0, "shadow").setDepth(29);
    this.traveler = this.add.sprite(x * TILE + TILE / 2, y * TILE + TILE / 2 - 3, "rpg", 2).setDepth(30);
    this.syncShadow();
  }

  syncShadow() {
    this.travelerShadow.setPosition(this.traveler.x, this.traveler.y + 9);
  }

  // ---------- drawing ----------

  redraw() {
    this.drawMap();
    this.drawMarkers();
    this.drawGlows();
    this.spawnVillagers();
  }

  bounds() {
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    for (const k of Object.keys(this.grid)) {
      const [x, y] = parse(k);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const pad = 24;
    return { ox: minX - pad, oy: minY - pad, w: maxX - minX + pad * 2 + 1, h: maxY - minY + pad * 2 + 1 };
  }

  isWater(x, y) {
    const t = this.grid[key(x, y)]?.type;
    return this.world.cell(x, y).water || t === "water" || t === "ford" || t === "bridge";
  }

  // Anything a dirt road should open towards
  isRoad(x, y) {
    return nodeAt(this.world, this.grid, x, y).walkable;
  }

  drawMap() {
    this.map?.destroy();
    const { ox, oy, w, h } = this.bounds();
    this.map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: w, height: h });
    const sets = [
      this.map.addTilesetImage("rpg", "rpg", TILE, TILE, 0, 0, 0),
      this.map.addTilesetImage("extra", "extra", TILE, TILE, 0, 0, EXTRA_GID),
    ];
    const layer = (name, depth) => this.map.createBlankLayer(name, sets, ox * TILE, oy * TILE).setDepth(depth);

    const L = {
      ground: layer("ground", 0),
      cliff: layer("cliff", 1),
      water: layer("water", 2),
      corner: layer("corner", 3),
      rim: layer("rim", 4),
      road: layer("road", 5),
      build: layer("build", 6),
      decor: layer("decor", 7),
      decorB: layer("decorB", 7),
    };
    this.waterLayer = L.water;
    this.waterPhase = 0;
    this.decorLayers = [L.decor, L.decorB];
    this.swayPhase = [0, 0];

    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        this.drawCell(L, tx + ox, ty + oy, tx, ty);
      }
    }
  }

  drawCell(L, x, y, tx, ty) {
    const c = this.world.cell(x, y);
    const g = this.grid[key(x, y)];
    L.ground.putTileAt(pick(F.grass, hash(7, x, y)), tx, ty);

    // Water, with shorelines and inner corners
    if (this.isWater(x, y)) {
      const land = (dx, dy) => !this.isWater(x + dx, y + dy);
      const mask = (land(0, -1) ? 1 : 0) | (land(1, 0) ? 2 : 0) | (land(0, 1) ? 4 : 0) | (land(-1, 0) ? 8 : 0);
      L.water.putTileAt(waterFrame(mask), tx, ty);
      const corner =
        (land(1, -1) && !land(1, 0) && !land(0, -1) ? 1 : 0) |
        (land(1, 1) && !land(1, 0) && !land(0, 1) ? 2 : 0) |
        (land(-1, 1) && !land(-1, 0) && !land(0, 1) ? 4 : 0) |
        (land(-1, -1) && !land(-1, 0) && !land(0, -1) ? 8 : 0);
      if (corner) L.corner.putTileAt(X(`shorecorner_${corner}`), tx, ty);
    } else {
      // Cliffs: rock face below higher ground, a lip along its top, rims on the other sides
      if (c.face) L.cliff.putTileAt(F.face, tx, ty);
      else if (c.lip) {
        const left = this.world.cell(x - 1, y).lip, right = this.world.cell(x + 1, y).lip;
        L.cliff.putTileAt(!left ? F.lip.L : !right ? F.lip.R : F.lip.M, tx, ty);
      }
      if (c.rim) L.rim.putTileAt(X(`cliffedge_${c.rim}`), tx, ty);
    }

    if (c.part) this.drawPart(L, c.part, x, y, tx, ty);

    if (g) this.drawGridTile(L, g, x, y, tx, ty);
    else if (!c.part && !this.isWater(x, y)) this.placeScenery(L, x, y, tx, ty);
  }

  drawPart(L, p, x, y, tx, ty) {
    switch (p.part) {
      case "house":
        L.build.putTileAt(F.house[p.row][p.col], tx, ty);
        break;
      case "well":
        L.build.putTileAt(F.well, tx, ty);
        break;
      case "fence":
        L.build.putTileAt(p.row === 0 || p.row === 3 ? F.fenceH : F.fenceV, tx, ty);
        break;
      case "soil":
        L.road.putTileAt(X("soil"), tx, ty);
        L.decor.putTileAt(F.crops[p.crop % F.crops.length], tx, ty);
        break;
      case "barrel":
        L.decor.putTileAt(F.barrel, tx, ty);
        break;
      case "castle":
        L.build.putTileAt(
          p.gate ? F.castleGate :
          p.top ? X("parapet") :
          p.tower ? F.castleTower :
          p.window ? F.castleWindow :
          F.castleWall[(x + y) & 1],
          tx, ty
        );
        break;
      case "path":
      case "gate":
        this.drawDirt(L.road, x, y, tx, ty);
        break;
    }
  }

  drawGridTile(L, g, x, y, tx, ty) {
    const axis = g.axis === "h" ? "h" : "v";
    switch (g.type) {
      case "water":
      case "ford":
        break; // drawn as water; fords get a boat hint marker
      case "bridge":
        L.road.putTileAt(X(`bridge_${axis}`), tx, ty);
        break;
      case "stairs":
        L.road.putTileAt(X(`stairs_${axis}`), tx, ty);
        break;
      case "ladder":
        L.road.putTileAt(X(`ladder_${axis}`), tx, ty);
        break;
      case "climb":
        break; // bare cliff; a rope hint marks it
      case "boulder":
        this.drawDirt(L.road, x, y, tx, ty);
        L.decor.putTileAt(pick(F.rocks, hash(3, x, y)), tx, ty);
        break;
      case "log":
        this.drawDirt(L.road, x, y, tx, ty);
        L.decor.putTileAt(X(`log_${axis}`), tx, ty);
        break;
      case "stump":
        this.drawDirt(L.road, x, y, tx, ty);
        L.decor.putTileAt(X("stump"), tx, ty);
        break;
      case "stop":
        break; // visit record only; the building draws itself
      default:
        this.drawDirt(L.road, x, y, tx, ty);
    }
  }

  drawDirt(layer, x, y, tx, ty) {
    const edges = [[0, -1, "T"], [1, 0, "R"], [0, 1, "B"], [-1, 0, "L"]]
      .filter(([dx, dy]) => !this.isRoad(x + dx, y + dy))
      .map(([, , s]) => s)
      .join("");
    layer.putTileAt(F.dirt[edges] ?? 84, tx, ty);
  }

  // Deterministic scenery. Trees span several tiles, so check every cell they cover.
  // Nothing sits right beside a route, on water, cliffs or buildings.
  placeScenery(L, x, y, tx, ty) {
    // alternate sway groups; every piece of one tree stays in the same group
    const decor = hash(7, x, y, 99) < 0.5 ? L.decor : L.decorB;
    const open = (dx, dy) => {
      const ax = x + dx, ay = y + dy;
      const c = this.world.cell(ax, ay);
      if (this.grid[key(ax, ay)] || c.part || c.water || c.face || c.lip) return false;
      if (DIRS.some((d) => this.grid[key(ax + d.x, ay + d.y)] || this.world.cell(ax + d.x, ay + d.y).part)) return false;
      return !L.decor.hasTileAt(tx + dx, ty + dy) && !L.decorB.hasTileAt(tx + dx, ty + dy);
    };
    if (!open(0, 0)) return;

    const r = hash(7, x, y, 7);
    if (r < 0.035 && open(1, 0) && open(0, 1) && open(1, 1)) {
      F.bigTree.forEach((row, dy) => row.forEach((frame, dx) => decor.putTileAt(frame, tx + dx, ty + dy)));
    } else if (r < 0.085 && open(0, 1)) {
      decor.putTileAt(F.pine[0], tx, ty);
      decor.putTileAt(F.pine[1], tx, ty + 1);
    } else if (r < 0.105) {
      decor.putTileAt(F.bush, tx, ty);
    } else if (r < 0.125) {
      decor.putTileAt(pick(F.rocks, hash(7, x, y, 10)), tx, ty);
    } else if (r < 0.18) {
      decor.putTileAt(pick(F.flowers, hash(7, x, y, 11)), tx, ty);
    } else if (r < 0.22) {
      decor.putTileAt(pick(F.plants, hash(7, x, y, 12)), tx, ty);
    }
  }

  drawMarkers() {
    this.markerLayer.removeAll(true);
    const center = (x, y) => [x * TILE + TILE / 2, y * TILE + TILE / 2];

    for (const [k, tile] of Object.entries(this.grid)) {
      const [x, y] = parse(k);
      const [cx, cy] = center(x, y);

      // Hints on obstacles, so the group knows which item gets them through
      const hint = { ford: "icon_ship", climb: "icon_rope" }[tile.type];
      if (hint && (tile.type !== "ford" || tile.crossing === k || !tile.crossing)) {
        const icon = this.addIcon(hint, cx, cy);
        if (icon) this.markerLayer.add(icon.setAlpha(0.75));
        continue;
      }
      if (tile.type !== "topic" && tile.type !== "start") continue;

      const kind = tileKind(tile);
      if (kind === "merchant") {
        this.addSprite("rpg", STALL, cx + 9, cy - 4, 0.95);
        if (!tile.visited) this.addSprite("extra", XF("merchant_2"), cx - 3, cy - 3, 1, "merchant-idle");
        continue;
      }
      if (kind === "campfire") {
        this.addSprite("extra", XF("campfire_0"), cx, cy - 2, tile.visited ? 0.55 : 1, "campfire");
        continue;
      }
      if (kind === "ghost") {
        const ghost = this.addSprite("extra", XF("ghost_0"), cx, cy - 3, tile.visited ? 0.25 : 0.85, "ghost");
        this.tweens.add({ targets: ghost, y: cy - 6, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        continue;
      }
      if (kind === "cannon") {
        this.addSprite("extra", XF(tile.visited ? "cannon_smoke" : "cannon"), cx, cy - 2, tile.visited ? 0.6 : 1);
        continue;
      }

      let color, icon, tint = 0xffffff;
      if (tile.type === "start") {
        color = PLATE.start; icon = "icon_flag"; tint = 0x6b3d1f;
      } else if (tile.visited) {
        color = PLATE.visited; icon = this.categoryById.get(tile.category_id)?.icon; tint = 0xb5b2c2;
      } else if (tile.mystery) {
        color = PLATE.mystery; icon = "icon_interrogation"; tint = 0x4a2a08;
      } else {
        const cat = this.categoryById.get(tile.category_id) || OPEN_ROAD;
        color = cat.color; icon = cat.icon;
        this.addLabel(cx, cy + 14, cat.short || cat.title);
      }
      this.addPlate(cx, cy - 1, color, icon, tint);
    }
    // Buildings (houses, wells, castles) carry no plate: the building is the marker, and the
    // blinking brackets show when the group can go there
  }

  addPlate(cx, cy, color, icon, tint = 0xffffff) {
    const parts = [
      this.add.image(cx, cy + 13, "plateShadow"),
      this.add.image(cx, cy, "plate").setTint(color),
      this.add.image(cx, cy, "bevel"),
    ];
    const glyph = icon && this.addIcon(icon, cx, cy);
    if (glyph) parts.push(glyph.setTint(tint));
    this.markerLayer.add(parts);
  }

  // A small pixel-font caption under a stop, so its category reads straight off the map
  addLabel(x, y, text) {
    const label = this.add.text(x, y, text.toUpperCase(), {
      fontFamily: "Silkscreen, monospace",
      fontSize: "8px",
      color: "#ffffff",
      stroke: "#14101e",
      strokeThickness: 3,
    }).setOrigin(0.5, 0);
    this.markerLayer.add(label);
    return label;
  }

  addSprite(sheet, frame, x, y, alpha = 1, anim = null) {
    const sprite = this.add.sprite(x, y, sheet, frame).setAlpha(alpha);
    if (anim) {
      // start each at a random point so neighbours don't animate in unison
      const frames = this.anims.get(anim)?.frames.length || 1;
      sprite.play({ key: anim, startFrame: Math.floor(Math.random() * frames) });
    }
    this.markerLayer.add(sprite);
    return sprite;
  }

  addIcon(name, x, y) {
    const k = `icon:${name}`;
    return this.textures.exists(k) ? this.add.image(x, y, k) : null;
  }

  // Villagers stroll around the towns in view
  spawnVillagers() {
    const { ox, oy, w, h } = this.bounds();
    for (const s of this.world.settlementsNear(ox + w / 2, oy + h / 2, Math.max(w, h))) {
      if (s.kind !== "town" || this.villagers.has(s.id)) continue;
      const paths = [...s.tiles.entries()].filter(([, p]) => p.part === "path").map(([k]) => parse(k));
      const folk = [];
      const count = 2 + Math.floor(hash(this.state.seed ?? 0, s.cx, s.cy, 61) * 2);
      for (let i = 0; i < count && paths.length; i++) {
        const [x, y] = paths[Math.floor(Math.random() * paths.length)];
        const v = Math.floor(Math.random() * VILLAGER_VARIANTS);
        const sprite = this.add.sprite(x * TILE + TILE / 2, y * TILE + TILE / 2 - 3, "extra", XF(`villager${v}_2`)).setDepth(25);
        folk.push({ sprite, x, y, v, tiles: s.tiles });
      }
      this.villagers.set(s.id, folk);
    }
  }

  wanderVillagers() {
    for (const folk of this.villagers.values()) {
      for (const f of folk) {
        if (f.moving || Math.random() < 0.4) continue;
        const options = DIRS.filter((d) => f.tiles.get(key(f.x + d.x, f.y + d.y))?.part === "path");
        const d = options[Math.floor(Math.random() * options.length)];
        if (!d) continue;
        f.x += d.x; f.y += d.y; f.moving = true;
        f.sprite.setFlipX(d.x > 0).play(`villager${f.v}-${d.y > 0 ? "down" : d.y < 0 ? "up" : "side"}`, true);
        this.tweens.add({
          targets: f.sprite,
          x: f.x * TILE + TILE / 2,
          y: f.y * TILE + TILE / 2 - 3,
          duration: 700,
          onComplete: () => { f.moving = false; f.sprite.anims.stop(); f.sprite.setFrame(XF(`villager${f.v}_2`)); },
        });
      }
    }
  }

  // Blinking brackets on every stop the group can walk to (obstacles or not)
  drawGlows() {
    this.glowLayer.removeAll(true);
    const here = this.state.current_position;
    for (const t of reachableTargets(this.world, this.grid, here).targets) {
      this.glowLayer.add(this.add.image(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2 - 1, "brackets"));
    }
  }

  // ---------- stops ----------

  // Building stops get a category from their position; castles favour the 12 Steps
  stopCategory(stop) {
    if (stop.kind === "castle") {
      const steps = this.categories.find((c) => /12 steps/i.test(c.title));
      if (steps) return steps.id;
    }
    return pick(this.categories, hash(this.state.seed ?? 0, stop.x, stop.y, 17))?.id ?? null;
  }

  // What the app needs to show a stop's card
  describe(x, y) {
    const node = nodeAt(this.world, this.grid, x, y);
    if (node.topic) {
      const kind = tileKind(node.topic);
      const reward =
        kind === "mystery" ? makeTool(this.neededItem()) :
        kind === "ghost" ? makeTool("lantern", { max: 3 }) : null;
      return { x, y, kind, mystery: kind === "mystery", category_id: node.topic.category_id ?? null, reward };
    }
    if (node.stop) {
      return { x, y, kind: node.stop.kind, mystery: false, category_id: this.stopCategory(node.stop), reward: node.stop.kind === "well" ? makeTool(this.neededItem()) : null };
    }
    return null;
  }

  arrive(x, y) {
    this.arrival = this.describe(x, y);
    if (this.arrival) this.onArrive?.(this.arrival);
  }

  // ---------- world generation ----------

  // Grow the journey from (x, y): first towards any nearby town or castle we aren't linked
  // to yet, then 2-3 random branches ending in topic tiles.
  sproutFrom(x, y) {
    const want = Phaser.Math.Between(2, 3);
    const origin = { x, y };
    let made = 0;

    const { seen, targets } = reachableTargets(this.world, this.grid, origin);
    // obstacles ease in: none near spawn or early on, more as the journey goes on
    const progress = (this.state.history?.length || 0) / 10;
    const toTown = routeToSettlement(this.world, this.grid, origin, seen, 14, { progress });
    if (toTown) {
      this.writeCells(toTown);
      made++;
    }

    const cats = Phaser.Utils.Array.Shuffle([...this.categories]);
    const targetKeys = new Set(targets.map((t) => key(t.x, t.y)));
    for (let attempt = 0; attempt < 40 && made < want; attempt++) {
      // cycle through directions, least crowded first
      const spacing = spacingForAttempt(attempt, made);
      if (spacing === null) break;
      if (attempt % 4 === 0) this.sproutDirs = openDirections(this.grid, origin);
      const branch = carveBranch(this.world, this.grid, origin, this.sproutDirs[attempt % 4], Math.random, {
        spacing,
        progress,
        isTarget: (ax, ay) => targetKeys.has(key(ax, ay)),
      });
      if (!branch) continue;
      this.writeCells(branch.joined ? branch.cells : branch.cells.slice(0, -1));
      if (branch.end) {
        let kind = rollEncounterKind(Math.random());
        if (SPACING_BY_KIND[kind] && this.kindNear(kind, branch.end, SPACING_BY_KIND[kind])) kind = "topic";
        const cat = kind === "topic" ? cats[made % cats.length] : null;
        this.grid[key(branch.end.x, branch.end.y)] = {
          type: "topic",
          kind,
          category_id: cat?.id ?? null,
          visited: false,
          mystery: kind === "mystery",
        };
      }
      made++;
    }
    return made;
  }

  // Rare encounters (merchants, ghosts, cannons) stay spread out
  kindNear(kind, { x, y }, spacing) {
    return Object.entries(this.grid).some(([k, t]) => {
      if (tileKind(t) !== kind) return false;
      const [mx, my] = parse(k);
      return Math.abs(mx - x) + Math.abs(my - y) < spacing;
    });
  }

  // The next places the group can head for, nearest first, named so they can be read aloud
  forkOptions(limit = 4) {
    const here = this.state.current_position;
    return reachableTargets(this.world, this.grid, here).targets
      .map((t) => {
        const r = findRoute(this.world, this.grid, here, t);
        const stop = this.describe(t.x, t.y);
        if (!r || !stop) return null;
        const missing = missingTool(r.needs, this.tools);
        const cat = this.categoryById.get(stop.category_id) || (stop.kind === "topic" ? OPEN_ROAD : null);
        const enc = ENCOUNTERS[stop.kind] || ENCOUNTERS.topic;
        return {
          x: t.x,
          y: t.y,
          distance: r.route.length,
          name: placeName(this.world, t.x, t.y),
          hint: this.forkHint(stop, enc, cat),
          icon: { mystery: "icon_interrogation", merchant: "icon_bag", campfire: "icon_light_bulb", ghost: "icon_skull", cannon: "icon_projectile" }[stop.kind]
            ?? cat?.icon ?? "icon_path_follow",
          color: { mystery: 0xe8b33c, merchant: 0x854c30, campfire: 0xd27d2c, ghost: 0x5b6ee1, cannon: 0x57546f }[stop.kind]
            ?? cat?.color ?? 0x597dce,
          blockedBy: missing ? ITEM_NAMES[missing] : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  // "North house · Gratitude": tells apart the buildings of one town when read aloud
  forkHint(stop, enc, cat) {
    if (!["house", "well", "castle"].includes(stop.kind)) return enc.hint(cat);
    const s = this.world.cell(stop.x, stop.y).settlement;
    let where = "";
    if (stop.kind === "house" && s) {
      const dx = stop.x - s.cx, dy = stop.y - s.cy;
      const ns = dy < -1 ? "North" : dy > 1 ? "South" : "";
      const ew = dx < -1 ? "west" : dx > 1 ? "east" : "";
      where = ns && ew ? `${ns}${ew} ` : ns ? `${ns} ` : ew ? `${ew[0].toUpperCase()}${ew.slice(1)} ` : "";
    }
    const label = stop.kind === "house" ? `${where}house` : stop.kind === "well" ? "Village well" : "Castle";
    return [label.charAt(0).toUpperCase() + label.slice(1), cat?.title].filter(Boolean).join(" · ");
  }

  writeCells(cells) {
    for (const c of cells) {
      const tile = { type: c.type };
      if (c.axis) tile.axis = c.axis;
      if (c.crossing) tile.crossing = c.crossing;
      this.grid[key(c.x, c.y)] = tile;
    }
  }

  // If nothing is left to walk to, grow from wherever the journey can still branch
  ensureFrontier() {
    const here = this.state.current_position;
    if (reachableTargets(this.world, this.grid, here).targets.length) return;
    const candidates = Phaser.Utils.Array.Shuffle(
      Object.entries(this.grid)
        .filter(([, t]) => t.type === "start" || t.type === "stop" || (t.type === "topic" && t.visited))
        .map(([k]) => parse(k))
    );
    for (const [x, y] of candidates.slice(0, 40)) {
      if (this.sproutFrom(x, y) > 0 && reachableTargets(this.world, this.grid, here).targets.length) return;
    }
  }

  // ---------- items and help ----------

  // The item that would open up the easiest blocked stop, or a random one
  neededItem() {
    const here = this.state.current_position;
    let best = null;
    for (const t of reachableTargets(this.world, this.grid, here).targets) {
      const r = findRoute(this.world, this.grid, here, t);
      if (!r) continue;
      const missing = TOOL_TYPES.map((i) => [i, Math.max(0, r.needs[i] - usesLeft(this.tools, i))]).filter(([, n]) => n > 0);
      if (!missing.length) continue;
      const total = missing.reduce((s, [, n]) => s + n, 0);
      if (!best || total < best.total) best = { total, item: missing[0][0] };
    }
    return best?.item ?? pick(TOOL_TYPES, Math.random());
  }

  // True when every stop in reach needs items the group doesn't have
  needsHelp() {
    const here = this.state.current_position;
    // an unfired cannon underfoot is always a way forward
    const underfoot = this.grid[key(here.x, here.y)];
    if (underfoot && tileKind(underfoot) === "cannon" && !underfoot.visited) return false;
    const { targets } = reachableTargets(this.world, this.grid, here);
    if (!targets.length) return false;
    return !targets.some((t) => {
      const r = findRoute(this.world, this.grid, here, t);
      return r && canAfford(r.needs, this.tools);
    });
  }

  checkHelp() {
    if (!this.moving && !this.locked && this.needsHelp()) this.onNeedsHelp?.();
  }

  // tool: a tool object (tools.js) or a tool type to roll
  giveItem(tool, message) {
    if (typeof tool === "string") tool = makeTool(tool);
    const result = addTool(this.tools, tool);
    const name = TOOL_NAMES[tool.type];
    let extra = "";
    if (result.alreadyLegendary) extra = ` You already carry a legendary ${name}, so you left it.`;
    else if (result.merged) extra = ` Your ${name} now has ${result.kept.uses} use${result.kept.uses === 1 ? "" : "s"}` +
      (result.wasted ? ", as many as it can hold." : ".");
    else if (result.dropped === tool) extra = " Your toolbar is full, so you left it behind.";
    else if (result.dropped) extra = ` You left a worn ${TOOL_NAMES[result.dropped.type]} behind to make room.`;
    this.onNotice?.((message || `You received: ${describeTool(tool)}!`) + extra);
    this.onLog?.("item", { data: { item: tool.type, uses: tool.uses, legendary: tool.legendary } });
    this.onChange?.();
    return tool;
  }

  // A tinted traveler stands in as the wandering merchant
  showMerchant() {
    this.hideMerchant();
    const { x, y } = this.traveler;
    this.merchant = this.add.sprite(x + 48, y, "rpg", 20).setTint(0xffb46b).setDepth(30);
    this.merchant.play("walk-side");
    this.tweens.add({
      targets: this.merchant,
      x: x + 16,
      duration: 700,
      onComplete: () => this.merchant?.anims.stop(),
    });
  }

  hideMerchant() {
    this.merchant?.destroy();
    this.merchant = null;
  }

  // ---------- movement ----------

  travelTo(x, y) {
    const here = this.state.current_position;
    const found = findRoute(this.world, this.grid, here, { x, y });
    if (!found) return;

    if (!canAfford(found.needs, this.tools)) {
      const item = missingTool(found.needs, this.tools);
      const blocker = found.route.find((s) => s.obstacle && OBSTACLE_ITEM[s.obstacle] === item);
      this.onBlocked?.(`${OBSTACLE_NAMES[blocker.obstacle]} blocks the way. You need ${ITEM_A[item]}.`);
      return;
    }

    this.moving = true;
    this.cameras.main.startFollow(this.traveler, true, 0.1, 0.1);
    this.walkStep(found.route, 0, () => {
      this.cameras.main.stopFollow();
      this.centerOnTraveler(true); // the follow lags behind; settle on the traveler
      this.traveler.anims.stop();
      this.traveler.setFrame(2).setFlipX(false);
      this.moving = false;
      this.state.current_position = { x, y };
      this.onLog?.("move", { data: { tiles: found.route.length } });
      this.drawGlows();
      this.onChange?.();
      this.arrive(x, y);
    });
  }

  walkStep(route, i, done) {
    if (i >= route.length) return done();
    const step = route[i];
    const from = i === 0 ? this.state.current_position : route[i - 1];
    const dx = step.x - from.x, dy = step.y - from.y;

    const anim = dy > 0 ? "walk-down" : dy < 0 ? "walk-up" : "walk-side";
    this.traveler.setFlipX(dx > 0);
    if (this.traveler.anims.currentAnim?.key !== anim) this.traveler.play(anim);

    const tile = this.grid[key(step.x, step.y)];
    if (tile && OBSTACLE_ITEM[tile.type]) this.clearObstacle(tile);

    this.tweens.add({
      targets: this.traveler,
      x: step.x * TILE + TILE / 2,
      y: step.y * TILE + TILE / 2 - 3,
      duration: 230,
      onUpdate: () => this.syncShadow(),
      onComplete: () => this.walkStep(route, i + 1, done),
    });
  }

  // Spend the item and leave the cleared version behind for next time
  clearObstacle(tile) {
    const was = tile.type;
    const { tool, broke } = useTool(this.tools, OBSTACLE_ITEM[was]);
    const cells = was === "ford" && tile.crossing
      ? Object.values(this.grid).filter((t) => t.type === "ford" && t.crossing === tile.crossing)
      : [tile];
    cells.forEach((t) => (t.type = CLEARED_AS[was]));
    this.onLog?.("obstacle", { data: { obstacle: was, item: OBSTACLE_ITEM[was] } });
    const note = tool?.legendary ? ` Your legendary ${TOOL_NAMES[tool.type]} never wears out.`
      : broke ? ` Your ${TOOL_NAMES[tool.type]} wore out.`
      : tool ? ` (${tool.uses} use${tool.uses === 1 ? "" : "s"} left)` : "";
    this.onNotice?.({
      ford: "You rowed across and built a bridge.",
      boulder: "You broke the boulder with your pickaxe.",
      log: "You chopped through the fallen tree.",
      climb: "You climbed the cliff and left a ladder.",
    }[was] + note);
    this.redraw();
  }

  // Called by QuestApp once the group has finished discussing a stop
  // outcome: { topic, passed }. A pass moves the journey on exactly like a share does.
  completeStop(x, y, { topic = null, passed = false } = {}) {
    const k = key(x, y);
    const arrival = this.arrival?.x === x && this.arrival?.y === y ? this.arrival : this.describe(x, y);
    const topicTile = this.grid[k]?.type === "topic" ? this.grid[k] : null;
    const record = topic ? { id: topic.id, title: topic.title } : null;

    if (topicTile) {
      topicTile.visited = true;
      topicTile.topic = record;
    } else {
      this.grid[k] = { type: "stop", visited: true, topic: record };
    }
    if (topic?.id) this.state.used_topic_ids.push(topic.id);
    this.state.history.push({
      kind: arrival?.kind ?? "topic",
      topic_id: topic?.id ?? null,
      title: topic?.title ?? null,
      category_id: arrival?.category_id ?? null,
      mystery: !!arrival?.mystery,
      passed,
      at: new Date().toISOString(),
    });

    if (arrival?.reward && !passed) {
      const giver = { mystery: "The mystery", well: "The well keeper", ghost: "The ghost" }[arrival.kind] || "The road";
      this.giveItem(arrival.reward, `${giver} gives you: ${describeTool(arrival.reward)}!`);
    }

    // Buildings branch out from the path in front of their door
    const origin = topicTile ? { x, y } : { x, y: y + 1 };
    if (!this.sproutFrom(origin.x, origin.y)) {
      const s = this.world.cell(x, y).settlement;
      const edges = s
        ? [...s.tiles.entries()].filter(([, p]) => p.part === "path").map(([kk]) => parse(kk))
            .sort((a, b) => Math.hypot(b[0] - s.cx, b[1] - s.cy) - Math.hypot(a[0] - s.cx, a[1] - s.cy))
        : [];
      for (const [ex, ey] of edges.slice(0, 8)) if (this.sproutFrom(ex, ey)) break;
    }
    this.ensureFrontier();

    this.arrival = null;
    this.redraw();
    this.onChange?.();
    this.time.delayedCall(600, () => this.checkHelp());
  }

  // ---------- the cannon ----------

  // Aim mode: the next tap on any walkable tile in view fires the traveler there,
  // flying over every obstacle. onLanded(onAStop) is called at touchdown.
  startAim(onLanded) {
    this.aiming = { onLanded };
    this.locked = false;
  }

  cancelAim() {
    this.aiming = null;
  }

  canLandAt(x, y) {
    const view = this.cameras.main.worldView;
    const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
    if (!view.contains(cx, cy)) return false;
    const here = this.state.current_position;
    if (here.x === x && here.y === y) return false;
    const g = this.grid[key(x, y)];
    if (g && OBSTACLE_ITEM[g.type]) return false; // land beside an obstacle, not on it
    return nodeAt(this.world, this.grid, x, y).walkable;
  }

  fireCannon(x, y) {
    const { onLanded } = this.aiming;
    this.aiming = null;
    const from = this.state.current_position;
    const cannon = this.grid[key(from.x, from.y)];
    if (cannon && tileKind(cannon) === "cannon") cannon.visited = true;

    this.moving = true;
    const tx = x * TILE + TILE / 2, ty = y * TILE + TILE / 2 - 3;
    const sx = this.traveler.x, sy = this.traveler.y;
    const height = Math.min(160, 40 + Math.hypot(tx - sx, ty - sy) * 0.4);
    this.cameras.main.startFollow(this.traveler, true, 0.12, 0.12);
    this.traveler.setFrame(2);
    this.redraw();
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 900,
      ease: "Sine.easeInOut",
      onUpdate: (tw) => {
        const t = tw.getValue();
        this.traveler.setPosition(sx + (tx - sx) * t, sy + (ty - sy) * t - Math.sin(Math.PI * t) * height);
        this.traveler.setAngle(360 * t);
        this.travelerShadow.setPosition(sx + (tx - sx) * t, sy + (ty - sy) * t + 9).setScale(1 - 0.6 * Math.sin(Math.PI * t));
      },
      onComplete: () => {
        this.traveler.setAngle(0);
        this.travelerShadow.setScale(1);
        this.cameras.main.stopFollow();
        this.centerOnTraveler(true);
        this.moving = false;
        this.state.current_position = { x, y };
        this.onLog?.("move", { data: { tiles: Math.round(Math.hypot(x - from.x, y - from.y)), cannon: true } });
        this.drawGlows();
        this.onChange?.();
        const node = nodeAt(this.world, this.grid, x, y);
        onLanded?.(!!node.target);
        if (node.target) this.arrive(x, y);
      },
    });
  }

  // ---------- camera / input ----------

  centerOnTraveler(animate = true) {
    const cam = this.cameras.main;
    if (animate) cam.pan(this.traveler.x, this.traveler.y, 500, "Sine.easeInOut");
    else cam.centerOn(this.traveler.x, this.traveler.y);
  }

  // Whole-number zoom steps keep the pixel art crisp
  zoomBy(step) {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(Math.round(cam.zoom) + step, 2, 6));
  }

  setupInput() {
    const cam = this.cameras.main;
    let down = null;
    let dragging = false;

    this.input.on("pointerdown", (p) => {
      down = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
      dragging = false;
    });

    this.input.on("pointermove", (p) => {
      if (!down || !p.isDown) return;
      const dx = p.x - down.x, dy = p.y - down.y;
      if (!dragging && Math.hypot(dx, dy) > 8) dragging = true;
      if (dragging) {
        cam.stopFollow();
        cam.setScroll(down.scrollX - dx / cam.zoom, down.scrollY - dy / cam.zoom);
      }
    });

    this.input.on("pointerup", (p) => {
      const wasTap = down && !dragging;
      down = null;
      if (!wasTap) return;
      const world = cam.getWorldPoint(p.x, p.y);
      this.handleTap(Math.floor(world.x / TILE), Math.floor(world.y / TILE));
    });

    let wheelAt = 0;
    this.input.on("wheel", (_p, _o, _dx, dy) => {
      // one step per flick rather than per wheel event
      if (this.time.now - wheelAt < 150) return;
      wheelAt = this.time.now;
      this.zoomBy(dy > 0 ? -1 : 1);
    });
  }

  handleTap(x, y) {
    if (this.aiming && !this.moving) {
      if (this.canLandAt(x, y)) this.fireCannon(x, y);
      else this.onNotice?.("The cannon can land on any path or stop you can see.");
      return;
    }
    if (this.moving || this.locked) return;
    // Tapping anywhere on a building (roof or walls) heads for its door
    let node = nodeAt(this.world, this.grid, x, y);
    if (!node.target) {
      const door = this.world.cell(x, y).settlement?.stops.find((st) => Math.abs(st.x - x) <= 1 && st.y - y >= 0 && st.y - y <= 2);
      if (!door || !nodeAt(this.world, this.grid, door.x, door.y).target) return;
      x = door.x; y = door.y;
      node = nodeAt(this.world, this.grid, x, y);
    }

    const here = this.state.current_position;
    if (here.x === x && here.y === y) {
      // Standing on a stop that was closed without finishing: reopen it
      this.arrive(x, y);
    } else {
      this.travelTo(x, y);
    }
  }
}

// Encounter kind of a topic tile (older journeys only have the mystery flag)
function tileKind(tile) {
  return tile.kind || (tile.mystery ? "mystery" : "topic");
}
