import * as Phaser from "phaser";
import GameScene, { newGameState, ITEM_NAMES, ITEM_A } from "./game_scene";
import { makeTool, usesLeft, useTool, describeTool, toolIcon, TOOLBAR_SLOTS, TOOL_TYPES } from "./tools";
import { LEGENDARY_CHANCE, OPEN_ROAD } from "./encounters";
import JourneyLog from "./journey";
import { RESOURCES, addResources } from "./resources";
import TopicFlow from "./ui/topic_flow";
import ForkPanel from "./ui/fork_panel";
import { renderSummary, copySummary } from "./ui/journey_summary";
import sheetUrl from "./assets/classic_rpg.png";
import extraUrl from "./assets/classic_rpg_extra.png";

// 16x16 pixel icons: the app's shared set, plus the quest's own item icons
const ICON_FILES = {
  ...import.meta.glob("../../assets/images/icons/*.png", { eager: true, query: "?url", import: "default" }),
  ...import.meta.glob("./assets/icons/*.png", { eager: true, query: "?url", import: "default" }),
};
const ICON_BASE = "https://acid-test.s3.us-west-2.amazonaws.com/game_icons/node";
const iconUrl = (name) =>
  ICON_FILES[`./assets/icons/${name}.png`] || ICON_FILES[`../../assets/images/icons/${name}.png`] || `${ICON_BASE}/${name}.png`;
const ITEM_ICONS = { boat: "icon_ship", pickaxe: "icon_pickaxe", axe: "icon_axe", rope: "icon_rope" };

// How the group gets unstuck; ?help=merchant or ?help=friend overrides it so both can be tried
const HELP_MODE = new URLSearchParams(location.search).get("help") === "friend" ? "friend" : "merchant";

// Used when a category has no icon assigned in the admin
const CATEGORY_ICONS = {
  "General Recovery Principles": "icon_light_bulb",
  Gratitude: "icon_heart",
  "12 Steps": "icon_transition",
  "Fellowship & Service": "icon_follow",
  "Slogans & Mantras": "icon_dialog",
  "Mindset Shifts": "icon_brain",
  "Special Occasions": "icon_trophy",
  "Serenity Prayer": "icon_star",
};
// Short names for the labels under stops on the map
const CATEGORY_SHORT = {
  "General Recovery Principles": "Principles",
  "Fellowship & Service": "Service",
  "Slogans & Mantras": "Slogans",
  "Mindset Shifts": "Mindset",
  "Special Occasions": "Occasions",
  "Serenity Prayer": "Serenity",
};
const SPARE_ICONS = ["icon_gem", "icon_parchment", "icon_key", "icon_map", "icon_ring", "icon_bell", "icon_potion", "icon_shield"];

// 16-bit palette; white icons read on all of them and none blend into the grass
const CATEGORY_COLORS = [0xd04648, 0x597dce, 0x8c3fbf, 0xd27d2c, 0x2c8c9c, 0x854c30, 0xd271a0, 0x30346d, 0x757161, 0x346524];
const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;

export default class QuestApp {
  constructor(root) {
    this.root = root;
    this.el = {};
    root.querySelectorAll("[data-quest]").forEach((node) => (this.el[node.dataset.quest] = node));
    root.querySelectorAll("[data-quest-action]").forEach((node) => {
      const [event, method] = node.dataset.questAction.split("->");
      node.addEventListener(event, (e) => this[method](e));
    });

    this.log = new JourneyLog((url, opts) => this.api(url, opts));
    this.fork = new ForkPanel(this.el.fork, { iconUrl, hex, onPick: (o) => this.headFor(o) });
    document.addEventListener("keydown", (e) => this.handleKey(e));
    // Leaving or backgrounding the page: send what hasn't been saved yet
    window.addEventListener("pagehide", () => this.saveOnExit());
    document.addEventListener("visibilitychange", () => document.hidden && this.saveOnExit());

    try {
      this.el.screenName.value = localStorage.getItem("questScreenName") || "";
    } catch {}
    this.show("login");
  }

  destroy() {
    this.flow?.close();
    this.destroyGame();
  }

  // ---------- screens ----------

  show(screen) {
    this.el.loginScreen.hidden = screen !== "login";
    this.el.sessionScreen.hidden = screen !== "sessions";
    this.el.hud.hidden = screen !== "game";
    if (screen !== "game") {
      this.el.modal.hidden = this.el.help.hidden = true;
      this.fork.hide();
    }
    this.el.error.hidden = true;
  }

  showError(message) {
    this.el.error.textContent = message;
    this.el.error.hidden = false;
  }

  async login(event) {
    event.preventDefault();
    const screenName = this.el.screenName.value.trim();
    if (!screenName) return;

    try {
      this.player = await this.api("/api/v1/quest_players/create_by_screen_name", {
        method: "POST",
        body: { quest_player: { screen_name: screenName } },
      });
      try { localStorage.setItem("questScreenName", screenName); } catch {}
      await this.openSessions();
    } catch (e) {
      this.showError("Couldn't sign in. Please try again.");
    }
  }

  async openSessions() {
    await this.save(true).catch(() => {});
    this.destroyGame();
    this.show("sessions");
    this.el.welcome.textContent = `Welcome, ${this.player.screen_name}!`;
    this.el.sessionList.innerHTML = "<p class='quest-muted'>Loading…</p>";
    this.el.topicSets.hidden = true;
    this.el.newJourneyButton.hidden = false;

    try {
      const [sessions, sets] = await Promise.all([
        this.api(`/api/v1/quest_players/${this.player.id}/quest_sessions`),
        this.topicSets ? Promise.resolve(this.topicSets) : this.api("/api/topic_sets"),
      ]);
      this.topicSets = sets;
      this.renderSessions(sessions);
    } catch {
      this.el.sessionList.innerHTML = "<p class='quest-muted'>Couldn't load your journeys.</p>";
    }
  }

  renderSessions(sessions) {
    this.el.sessionList.innerHTML = "";
    if (sessions.length === 0) {
      this.el.sessionList.innerHTML = "<p class='quest-muted'>No journeys yet. Start a new one below.</p>";
      return;
    }

    sessions.forEach((session) => {
      const stops = session.game_state?.history?.length || 0;
      const set = this.topicSets?.find((t) => t.id === session.topic_set_id);
      const row = document.createElement("div");
      row.className = "quest-session";
      row.innerHTML = `
        <button type="button" class="quest-session-open">
          <span class="quest-code"></span>
          <span class="quest-muted"></span>
        </button>
        <button type="button" class="quest-session-log" hidden>Log</button>
        <button type="button" class="quest-session-delete" aria-label="Delete journey">✕</button>
      `;
      row.querySelector(".quest-code").textContent = session.join_code;
      row.querySelector(".quest-muted").textContent = [
        set?.name,
        `${stops} stop${stops === 1 ? "" : "s"}`,
        session.status === "completed" ? "complete" : new Date(session.updated_at).toLocaleDateString(),
      ].filter(Boolean).join(" · ");
      row.querySelector(".quest-session-open").addEventListener("click", () => this.startGame(session));
      const logButton = row.querySelector(".quest-session-log");
      logButton.hidden = session.status !== "completed";
      logButton.setAttribute("aria-label", `Journey log for ${session.join_code}`);
      logButton.addEventListener("click", () => this.showLog(session));
      row.querySelector(".quest-session-delete").addEventListener("click", async () => {
        if (!confirm(`Delete journey ${session.join_code}?`)) return;
        await this.api(`/api/v1/quest_sessions/${session.id}`, { method: "DELETE" });
        this.openSessions();
      });
      this.el.sessionList.appendChild(row);
    });
  }

  // New journey: pick which Topicificator topic set the road draws from
  async newSession() {
    try {
      this.topicSets ||= await this.api("/api/topic_sets");
    } catch {
      this.showError("Couldn't load topic sets.");
      return;
    }
    this.el.newJourneyButton.hidden = true;
    this.el.topicSets.hidden = false;
    this.el.topicSetList.replaceChildren(
      ...(this.topicSets || []).map((set) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "quest-btn quest-btn-block";
        b.textContent = set.name;
        b.addEventListener("click", () => this.createSession(set));
        return b;
      })
    );
  }

  async createSession(set) {
    try {
      const session = await this.api(`/api/v1/quest_players/${this.player.id}/quest_sessions`, {
        method: "POST",
        body: { topic_set_id: set?.id, name: `${set?.name || "Journey"} · ${new Date().toLocaleDateString()}` },
      });
      await this.startGame(session);
    } catch {
      this.showError("Couldn't start a new journey.");
    }
  }

  // ---------- game ----------

  async startGame(session) {
    this.session = session;
    // Journeys from before world generation (version 2, no seed) keep their flat meadow;
    // anything older or empty starts a fresh generated world
    this.state = session.game_state?.version >= 2 ? session.game_state : newGameState();
    this.state.coins ||= 0;
    await this.loadResources(session);
    // pixel text on the map (category labels) needs the font before Phaser draws it
    try { await document.fonts.load("8px Silkscreen"); } catch {}
    this.state.topic_set_id ??= session.topic_set_id ?? null;

    try {
      [this.categories, this.modes] = await Promise.all([this.loadCategories(), this.loadModes()]);
    } catch {
      this.showError("Couldn't load topics.");
      return;
    }
    this.modeNames = Object.fromEntries(this.modes.map((m) => [m.key, m.name]));

    this.show("game");
    this.el.joinCode.textContent = session.join_code;
    this.updateHud();

    const icons = Object.fromEntries(
      [...this.allCategories.map((c) => c.icon), ...Object.values(ITEM_ICONS), "icon_interrogation", "icon_flag", "icon_path_follow", "icon_skull", "icon_projectile", "icon_visibility_off", OPEN_ROAD.icon]
        .map((n) => [n, iconUrl(n)])
    );

    this.destroyGame();
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.el.stage,
      backgroundColor: "#6aa84f",
      pixelArt: true,
      scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
      scene: [],
    });
    this.game.scene.add("GameScene", GameScene, true, {
      state: this.state,
      sheetUrl,
      extraUrl,
      icons,
      categories: this.categories,
      onArrive: (stop) => this.openStop(stop),
      onChange: () => this.save(),
      onNotice: (message) => this.notice(message),
      onLog: (kind, fields) => this.logEntry(kind, fields),
      onGate: (gates, open) => this.openGate(gates, open),
      onBlocked: (message) => {
        this.notice(message);
        this.pulseHelp();
      },
      onNeedsHelp: () => {
        this.pulseHelp();
        if (this.el.modal.hidden && this.el.help.hidden) this.openHelp();
      },
    });
    this.game.events.once("ready", () => setTimeout(() => this.showFork(), 800));
  }

  destroyGame() {
    this.flow?.close();
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
  }

  get scene() {
    return this.game?.scene.getScene("GameScene");
  }

  // Categories that actually have topics in this journey's topic set. Colours and icons come
  // from the full list so a category always looks the same.
  async loadCategories() {
    const [all, inSet] = await Promise.all([
      this.api("/topic_categories.json"),
      this.api(`/api/v1/quest_topics/categories?${new URLSearchParams(this.state.topic_set_id ? { topic_set_id: this.state.topic_set_id } : {})}`),
    ]);
    this.allCategories = all
      .sort((a, b) => a.id - b.id)
      .map((c, i) => ({
        id: c.id,
        title: c.title,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        icon: c.icon?.name || CATEGORY_ICONS[c.title] || SPARE_ICONS[i % SPARE_ICONS.length],
        short: CATEGORY_SHORT[c.title] || c.title.split(/[\s&]+/)[0],
      }));
    const ids = new Set(inSet.map((c) => c.id));
    return this.allCategories.filter((c) => ids.has(c.id));
  }

  async loadModes() {
    this.modesCache ||= await this.api("/api/v1/sharing_modes");
    return this.modesCache;
  }

  // Courage / Connection / Hope are group totals derived from the journey log. Journeys from
  // before they existed pick theirs up from the server's stats once.
  async loadResources(session) {
    if (this.state.resources) return;
    this.state.resources = {};
    if (!this.state.history?.length) return;
    try {
      const { stats } = await this.api(`/api/v1/quest_sessions/${session.id}/journey`);
      this.state.resources = { courage: stats.courage_found || 0, connection: stats.connections_made || 0, hope: stats.hope_found || 0 };
    } catch {}
  }

  // Every journey log entry goes through here, so shares can add to the group's resources
  logEntry(kind, fields = {}) {
    this.log.add(kind, fields);
    if (kind !== "share") return;
    addResources((this.state.resources ||= {}), { kind, ...fields });
    this.updateHud();
  }

  updateHud() {
    const stops = this.state.history?.length || 0;
    this.el.stepCount.textContent = `${stops} stop${stops === 1 ? "" : "s"}`;
    const counter = (icon, title, value, cls = "quest-item") => {
      const span = document.createElement("span");
      span.className = cls;
      span.title = title;
      const img = document.createElement("img");
      img.src = iconUrl(icon);
      img.alt = title;
      span.append(img, value);
      return span;
    };
    this.el.items.replaceChildren(
      counter("icon_coin", "trail coins", `×${this.state.coins || 0}`),
      ...RESOURCES.map((r) => counter(r.icon, r.name, String(this.state.resources?.[r.key] || 0), "quest-item quest-resource")),
    );
    this.renderToolbar();
  }

  // Nine slots, centred at the bottom: full-colour tools with a durability bar each.
  // Legendary tools get a gold frame and a moving glint instead of a bar.
  renderToolbar() {
    const tools = this.state.tools || [];
    this.el.toolbar.replaceChildren(
      ...Array.from({ length: TOOLBAR_SLOTS }, (_, i) => {
        const tool = tools[i];
        const slot = document.createElement("div");
        slot.className = "quest-slot" + (tool?.legendary ? " quest-slot-legendary" : "");
        if (!tool) return slot;
        slot.title = describeTool(tool);
        const icon = document.createElement("img");
        icon.src = iconUrl(toolIcon(tool));
        icon.alt = slot.title;
        const bar = document.createElement("div");
        bar.className = "quest-durability";
        const fill = document.createElement("div");
        fill.style.width = tool.legendary ? "100%" : `${(100 * tool.uses) / tool.max}%`;
        fill.className = tool.legendary ? "" : tool.uses / tool.max <= 0.34 ? "low" : tool.uses / tool.max <= 0.67 ? "mid" : "";
        bar.append(fill);
        slot.append(icon, bar);
        if (!tool.legendary && tool.max > 1) {
          const n = document.createElement("span");
          n.className = "quest-slot-count";
          n.textContent = tool.uses;
          slot.append(n);
        }
        return slot;
      })
    );
  }

  notice(message) {
    if (!message) return;
    this.el.toast.textContent = message;
    this.el.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.el.toast.hidden = true), 3200);
    this.updateHud();
  }

  // Saves are debounced so a walk + arrival turns into one request
  save(now = false) {
    if (!this.session) return Promise.resolve();
    this.updateHud();
    clearTimeout(this.saveTimer);
    this.el.saveStatus.textContent = "Saving…";
    const run = async () => {
      try {
        await Promise.all([
          this.api(`/api/v1/quest_sessions/${this.session.id}`, { method: "PATCH", body: { game_state: this.state } }),
          this.log.flush(this.session.id),
        ]);
        this.el.saveStatus.textContent = "Saved";
      } catch {
        this.el.saveStatus.textContent = "Not saved";
      }
    };
    if (now) return run();
    this.saveTimer = setTimeout(run, 400);
    return Promise.resolve();
  }

  // keepalive requests survive the page going away
  saveOnExit() {
    if (!this.session || !this.state) return;
    clearTimeout(this.saveTimer);
    const headers = {
      "Content-Type": "application/json",
      "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content,
    };
    const send = (url, method, body) => fetch(url, { method, headers, body: JSON.stringify(body), keepalive: true }).catch(() => {});
    send(`/api/v1/quest_sessions/${this.session.id}`, "PATCH", { game_state: this.state });
    const entries = this.log.queue.splice(0);
    if (entries.length) send(`/api/v1/quest_sessions/${this.session.id}/log_entries`, "POST", { entries });
  }

  recenter() {
    this.scene?.centerOnTraveler(true);
  }

  zoomIn() {
    this.scene?.zoomBy(1);
  }

  zoomOut() {
    this.scene?.zoomBy(-1);
  }

  // ---------- the road forks ----------

  showFork() {
    if (!this.scene || this.scene.moving || !this.el.modal.hidden || !this.el.help.hidden || !this.el.summary.hidden) return;
    this.fork.show(this.scene.forkOptions());
  }

  headFor(option) {
    this.fork.hide();
    this.log.add("fork", { data: { options: this.fork.options.length } });
    const before = this.scene.state.current_position;
    this.scene.travelTo(option.x, option.y);
    // blocked by an obstacle: nothing moved, so keep the choices up
    if (!this.scene.moving && before === this.scene.state.current_position) this.showFork();
  }

  // ---------- stops ----------

  openStop(stop) {
    this.fork.hide();
    if (stop.kind === "cannon") return this.openCannon(stop);
    if (this.scene) this.scene.locked = true;
    this.el.modal.hidden = false;
    this.flow?.close();
    this.flow = new TopicFlow({
      el: { head: this.el.modalBadge, icon: this.el.modalIcon, label: this.el.modalCategory, stage: this.el.cardStage },
      iconUrl,
      hex,
      modes: this.modes,
      itemName: (item) => ITEM_A[item],
      draw: (opts) => this.drawTopics(opts),
      fetchTopic: (id) => this.api(`/api/v1/quest_topics/${id}`),
      log: (kind, fields) => this.logEntry(kind, fields),
      earlier: () => this.earlierTopics(),
      wallet: {
        coins: () => this.state.coins || 0,
        spend: (n) => {
          if ((this.state.coins || 0) < n) return false;
          this.state.coins -= n;
          this.updateHud();
          return true;
        },
      },
      usedModes: (topicId) => this.usedModes(topicId),
      categories: this.categories,
      allCategories: this.allCategories,
      rollReward: () => makeTool(this.scene?.neededItem() ?? TOOL_TYPES[Math.floor(Math.random() * TOOL_TYPES.length)]),
      lantern: {
        left: () => usesLeft(this.state.tools || [], "lantern"),
        use: () => {
          useTool(this.state.tools, "lantern");
          this.updateHud();
        },
      },
      excludeIds: () => [...(this.state.used_topic_ids || [])],
      onResolve: (outcome) => this.resolveStop(outcome),
    });
    const category = this.categories.find((c) => c.id === stop.category_id) || this.allCategories.find((c) => c.id === stop.category_id)
      || (stop.kind === "topic" ? OPEN_ROAD : undefined);
    this.flow.open(stop, category);
  }

  resolveStop({ stop, topic, passed, message, reward }) {
    this.closeCard();
    if (reward && !passed) this.payReward(reward);
    if (stop.kind === "help") {
      this.finishHelp(stop, topic, passed);
      return;
    }
    // Every stop reached earns a trail coin, shared or passed
    this.state.coins = (this.state.coins || 0) + 1;
    if (topic?.id && !passed) this.rememberModes(topic.id);
    this.scene?.completeStop(stop.x, stop.y, { topic, passed });
    if (message) this.notice(message);
    setTimeout(() => this.showFork(), 700);
  }

  // Merchant wares pay out when finished. The mystery topic may hold a legendary tool.
  payReward(reward) {
    if (!this.scene) return;
    if (reward.hidden) {
      const type = this.scene.neededItem();
      const legendary = Math.random() < LEGENDARY_CHANCE;
      const tool = makeTool(type, legendary ? { legendary: true } : { min: 4 });
      this.scene.giveItem(tool, legendary ? `The mystery topic held a treasure: ${describeTool(tool)}!` : `The mystery topic held: ${describeTool(tool)}.`);
    } else {
      this.scene.giveItem(reward, `The merchant pays you: ${describeTool(reward)}.`);
    }
  }

  // The cannon: aim at any path or stop in view and fly over everything in between
  openCannon(stop) {
    if (this.scene) this.scene.locked = true;
    this.el.modal.hidden = false;
    this.el.modalBadge.style.background = "#57546f";
    this.el.modalBadge.classList.remove("quest-card-head-dark");
    this.el.modalIcon.src = iconUrl("icon_projectile");
    this.el.modalCategory.textContent = "Cannon";
    const p = (text, cls) => Object.assign(document.createElement("p"), { className: cls, textContent: text });
    const btn = (label, cls, onClick) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.textContent = label;
      b.addEventListener("click", onClick);
      return b;
    };
    const foot = document.createElement("div");
    foot.className = "quest-card-foot";
    foot.append(
      btn("Aim the cannon", "quest-btn", () => this.aimCannon(stop)),
      btn("Walk on", "quest-btn quest-btn-pass", () => this.closeModal())
    );
    this.el.cardStage.replaceChildren(
      p("An old cannon, loaded and pointed at the sky.", "quest-flavor"),
      p("Fire yourself to any path or stop you can see, right over rivers, boulders and cliffs. It only has one shot.", "quest-topic-subtitle"),
      foot
    );
    this.log.add("encounter", { encounter: "cannon" });
  }

  aimCannon(stop) {
    this.closeCard();
    this.el.aim.hidden = false;
    this.scene?.startAim((onAStop) => {
      this.el.aim.hidden = true;
      this.log.add("encounter", { encounter: "cannon", data: { fired: true } });
      this.state.coins = (this.state.coins || 0) + 1; // the cannon was a stop reached, too
      this.save();
      if (!onAStop) setTimeout(() => this.showFork(), 600); // a stop's card opens by itself
    });
  }

  cancelAim() {
    this.scene?.cancelAim();
    this.el.aim.hidden = true;
    this.showFork();
  }

  // ---------- locked gates ----------

  // The room votes; the Guide taps the result. Opening is always possible, so a gate never
  // blocks the way for good, and declining just means choosing another road.
  openGate(gates, open) {
    this.fork.hide();
    if (this.scene) this.scene.locked = true;
    this.el.modal.hidden = false;
    this.flow?.close();
    this.el.modalBadge.style.background = "#5c3841";
    this.el.modalBadge.classList.remove("quest-card-head-dark");
    this.el.modalIcon.src = iconUrl("icon_lock");
    this.el.modalCategory.textContent = "A locked gate";
    const choose = (opened) => {
      this.gateChoice = null;
      this.closeCard();
      if (opened) return open();
      this.log.add("gate", { data: { opened: false } });
      this.notice("The gate stays shut. Another road, then.");
      setTimeout(() => this.showFork(), 300);
    };
    this.gateChoice = choose;
    const btn = (n, label, cls, opened) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls;
      b.textContent = `${n} \u00b7 ${label}`;
      b.addEventListener("click", () => choose(opened));
      return b;
    };
    const p = (text, cls) => Object.assign(document.createElement("p"), { className: cls, textContent: text });
    const foot = document.createElement("div");
    foot.className = "quest-card-foot";
    foot.append(btn(1, "Open the gate", "quest-btn", true), btn(2, "Find another way", "quest-btn quest-btn-pass", false));
    this.el.cardStage.replaceChildren(
      p("An old wooden gate stands across the path, its latch rusted shut.", "quest-flavor"),
      p("Ask the room: open it and go on?", "quest-topic-title quest-gate-question"),
      p("Whatever the room decides is fine.", "quest-muted"),
      foot
    );
  }

  // Topics shared earlier this journey, newest first, for revisits and the Memory Stone
  earlierTopics() {
    const seen = new Map();
    for (const h of [...(this.state.history || [])].reverse()) {
      if (!h.topic_id || h.passed || seen.has(h.topic_id)) continue;
      seen.set(h.topic_id, {
        topic: { id: h.topic_id, title: h.title, subtitle: h.subtitle || "", topic_category_id: h.topic_category_id ?? null },
        category_id: h.category_id ?? null,
        used: this.usedModes(h.topic_id),
      });
    }
    return [...seen.values()];
  }

  // Lens history per topic, so a revisit offers a different way in
  usedModes(topicId) {
    return this.state.topic_modes?.[topicId] || [];
  }

  rememberModes(topicId) {
    const lens = this.flow?.lens?.key;
    if (!lens) return;
    this.state.topic_modes ||= {};
    const used = (this.state.topic_modes[topicId] ||= []);
    if (!used.includes(lens)) used.push(lens);
  }

  async drawTopics({ categoryId, count = 1, exclude = [], difficulty = null }) {
    const params = new URLSearchParams({ count });
    if (difficulty) params.set("difficulty", difficulty);
    if (this.state.topic_set_id) params.set("topic_set_id", this.state.topic_set_id);
    if (categoryId) params.set("category_id", categoryId);
    if (exclude.length) params.set("exclude_ids", exclude.join(","));
    try {
      return await this.api(`/api/v1/quest_topics/draw?${params}`);
    } catch {
      return [];
    }
  }

  closeModal() {
    // Leaving without resolving: the stop stays open and can be revisited
    this.closeCard();
    this.save();
    setTimeout(() => this.showFork(), 100);
  }

  closeCard() {
    this.gateChoice = null;
    this.flow?.close();
    this.el.modal.hidden = true;
    this.scene?.hideMerchant();
    if (this.scene) this.scene.locked = false;
  }

  // ---------- asking for help ----------

  pulseHelp() {
    this.el.helpButton.classList.remove("quest-pulse");
    void this.el.helpButton.offsetWidth; // restart the animation
    this.el.helpButton.classList.add("quest-pulse");
  }

  // The group can always earn their way forward: a wandering merchant trades an item for a
  // story, or they call a friend and share on a category of their choice.
  openHelp() {
    if (!this.scene) return;
    this.fork.hide();
    const item = this.scene.neededItem();
    const stuck = this.scene.needsHelp();
    this.el.help.hidden = false;
    this.scene.locked = true;
    this.el.helpOptions.replaceChildren();
    const pool = this.categories.length ? this.categories : this.allCategories;

    const lead = stuck ? "The way forward is blocked. " : "";
    if (HELP_MODE === "merchant") {
      const category = pool[Math.floor(Math.random() * pool.length)];
      this.scene.showMerchant();
      this.el.helpTitle.textContent = "A wandering merchant";
      this.el.helpBody.textContent =
        `${lead}A merchant stops by with ${ITEM_A[item]} to trade. The price? A story about ${category.title}.`;
      this.el.helpOptions.append(
        this.helpButton("Share a story", () => this.startHelpTopic({ mode: "merchant", item, category_id: category.id }))
      );
    } else {
      this.el.helpTitle.textContent = "Call a friend";
      this.el.helpBody.textContent =
        `${lead}A friend can bring you ${ITEM_A[item]}. Pick what you'd like to talk about while they're on their way.`;
      pool.forEach((c) =>
        this.el.helpOptions.append(
          this.helpButton(c.title, () => this.startHelpTopic({ mode: "friend", item, category_id: c.id }), hex(c.color))
        )
      );
    }
  }

  helpButton(label, onClick, color) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "quest-btn";
    if (color) b.style.background = color;
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  startHelpTopic(context) {
    this.el.help.hidden = true;
    this.openStop({ kind: "help", ...context });
  }

  finishHelp(stop, topic, passed) {
    this.log.add("help", { encounter: "help", topic_id: topic?.id ?? null, data: { mode: stop.mode, item: passed ? null : stop.item } });
    this.state.history.push({ kind: "help", help: stop.mode, topic_id: topic?.id ?? null, title: topic?.title ?? null, subtitle: topic?.subtitle ?? null, topic_category_id: topic?.topic_category_id ?? null, category_id: stop.category_id, item: stop.item, passed, at: new Date().toISOString() });
    if (topic?.id) this.state.used_topic_ids.push(topic.id);
    if (passed) {
      this.notice("No problem. The offer stands whenever you're ready.");
    } else {
      const tool = makeTool(stop.item);
      this.scene?.giveItem(
        tool,
        stop.mode === "merchant"
          ? `The merchant hands you: ${describeTool(tool)}. Safe travels!`
          : `Your friend brings you: ${describeTool(tool)}.`
      );
    }
    this.scene?.hideMerchant();
    this.scene?.drawGlows();
    this.save();
    setTimeout(() => this.showFork(), 400);
  }

  closeHelp() {
    this.el.help.hidden = true;
    this.scene?.hideMerchant();
    if (this.scene) this.scene.locked = false;
    this.showFork();
  }

  // ---------- quest complete ----------

  async endJourney() {
    if (!confirm("End this journey and see how far you came?")) return;
    this.fork.hide();
    await this.save(true);
    try {
      const summary = await this.api(`/api/v1/quest_sessions/${this.session.id}/complete`, { method: "POST" });
      this.session.status = "completed";
      if (this.scene) this.scene.locked = true;
      renderSummary(this.el.summaryBody, summary, {
        modeNames: this.modeNames,
        iconUrl,
        onCopy: async () => {
          await copySummary(summary);
          this.notice("Topics copied.");
        },
        onClose: () => {
          this.el.summary.hidden = true;
          this.openSessions();
        },
      });
      this.el.summary.hidden = false;
    } catch {
      this.notice("Couldn't end the journey. Try again.");
    }
  }

  // A finished journey, read back: Quest Complete plus the road step by step
  async showLog(session) {
    try {
      this.modesCache ||= await this.api("/api/v1/sharing_modes");
      const log = await this.api(`/api/v1/quest_sessions/${session.id}/log`);
      renderSummary(this.el.summaryBody, log, {
        modeNames: Object.fromEntries(this.modesCache.map((m) => [m.key, m.name])),
        iconUrl,
        onCopy: async () => {
          await copySummary(log);
          this.notice("Topics copied.");
        },
        onClose: () => (this.el.summary.hidden = true),
      });
      this.el.summary.hidden = false;
    } catch {
      this.showError("Couldn't load that journey's log.");
    }
  }

  // ---------- keyboard: one controller, many people ----------

  handleKey(e) {
    if (this.el.hud.hidden || e.target.closest?.("input, textarea")) return;
    if (e.key === "Escape" && this.scene?.aiming) return this.cancelAim();
    if (!this.el.modal.hidden && this.gateChoice && (e.key === "1" || e.key === "2")) {
      this.gateChoice(e.key === "1");
      return e.preventDefault();
    }
    const handled =
      (!this.el.modal.hidden && this.flow?.handleKey(e)) ||
      (this.el.modal.hidden && this.el.help.hidden && this.fork.handleKey(e));
    if (handled) e.preventDefault();
  }

  // ---------- helpers ----------

  async api(url, { method = "GET", body } = {}) {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`${method} ${url} failed: ${response.status}`);
    return response.json();
  }
}
