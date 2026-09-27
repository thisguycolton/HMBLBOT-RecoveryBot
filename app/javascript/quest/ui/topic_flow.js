import { ENCOUNTERS, MERCHANT_PRICE, OPEN_ROAD } from "../encounters";
import { describeTool } from "../tools";
import { pickLenses, randomLens } from "../sharing";

// The topic card: ENCOUNTER -> TOPIC -> CHOOSE YOUR PATH -> SHARE (as many people as want to)
// -> CONTINUE. Pass is offered at every step and simply moves the journey on.
//
// deps: {
//   el: { head, icon, label, stage },          card elements
//   iconUrl(name), hex(color),
//   modes: [sharing modes], categories: [...],
//   draw({ categoryId, count, exclude }) -> [topics]
//   log(kind, fields)                           journey log (structured, no free text)
//   wallet: { coins(), spend(n) -> bool }       trail coins for the merchant
//   usedModes(topicId) -> [mode keys]           lenses already used on this topic
//   rollReward() -> tool                         what the merchant's offers pay out
//   lantern: { left(), use() }                  spirit lantern: lets someone else share
//   onResolve({ stop, topic, passed, reward }), onLeave()
// }
const SHARE_SECONDS = 180;

export default class TopicFlow {
  constructor(deps) {
    Object.assign(this, deps);
    this.chime = readChime();
  }

  // ---------- entry ----------

  async open(stop, category) {
    this.stop = stop;
    this.category = category;
    this.encounter = ENCOUNTERS[stop.kind] || ENCOUNTERS.topic;
    this.topic = null;
    this.lens = null;
    this.shares = 0;
    this.turnLogged = false;
    this.pendingReward = null;
    this.stopTimer();
    this.renderHead();
    if (stop.kind !== "help") this.log("encounter", { encounter: stop.kind });

    if (stop.kind === "merchant") return this.showOffer();
    this.loading();
    this.setTopic(await this.drawOne());
    this.log("draw", this.fields({ approach: this.encounter.approach }));
    if (stop.kind === "ghost") return this.showGhost();
    if (stop.kind === "mystery") {
      // Chaos: the road picks the topic and the way in; the group can still change either
      this.lens = randomLens(this.modes);
      return this.showShare();
    }
    this.showLenses();
  }

  close() {
    this.stopTimer();
  }

  // ---------- stages ----------

  // The topic decides the category shown on the card (icon, name, colour), whatever stop it
  // came from, so the group can always see where it's from
  setTopic(topic) {
    this.topic = topic;
    if (topic?.id) {
      const cat = topic.topic_category_id && (this.allCategories || this.categories || []).find((c) => c.id === topic.topic_category_id);
      this.category = cat || OPEN_ROAD;
    }
    this.renderHead();
  }

  renderHead() {
    const { stop, category } = this;
    const mystery = stop.kind === "mystery";
    const label =
      stop.kind === "help" ? (stop.mode === "merchant" ? "A story for the merchant" : "Calling a friend") :
      this.encounter.label;
    this.el.head.style.background = mystery ? "#e8b33c" : stop.kind === "campfire" ? "#d27d2c" :
      stop.kind === "merchant" ? "#854c30" : stop.kind === "ghost" ? "#3b3f6e" : category ? this.hex(category.color) : "#597dce";
    this.el.head.classList.toggle("quest-card-head-dark", mystery);
    const kindIcon = { mystery: "icon_interrogation", merchant: "icon_bag", campfire: "icon_light_bulb", ghost: "icon_skull" }[stop.kind];
    const showCategory = category && (this.topic || !kindIcon);
    this.el.icon.src = this.iconUrl(showCategory ? category.icon : kindIcon || "icon_path_follow");
    this.el.label.textContent = [label, category?.title].filter(Boolean).join(" · ");
  }

  loading() {
    fill(this.el.stage, h("p", { class: "quest-muted" }, "…"));
  }

  topicHeading(small = false) {
    const { title, subtitle } = displayTopic(this.topic);
    return h("div", { class: small ? "quest-topic quest-topic-small" : "quest-topic" },
      h("p", { class: "quest-topic-title" }, title || "Check-in"),
      subtitle ? h("p", { class: "quest-topic-subtitle" }, subtitle) : null,
    );
  }

  flavor() {
    const lines = this.encounter.lines;
    return lines ? h("p", { class: "quest-flavor" }, lines[Math.floor(Math.random() * lines.length)]) : null;
  }

  reward() {
    if (this.pendingReward?.hidden) return h("p", { class: "quest-reward" }, "Finish this one to earn: ???");
    const item = this.pendingReward || (this.stop.kind === "help" ? this.stop.item : this.stop.reward);
    if (!item) return null;
    const what = typeof item === "string" ? this.itemName(item) : describeTool(item);
    return h("p", { class: "quest-reward" }, `Finish this one to earn: ${what}`);
  }

  // Merchant: three wares, one trail coin each (or on credit). A known topic and a topic from
  // a named category both show their reward; the mystery topic hides both.
  async showOffer() {
    this.loading();
    const [known] = await this.draw({ categoryId: null, count: 1, exclude: this.exclude() });
    const pool = this.categories?.length ? this.categories : [];
    const category = pool[Math.floor(Math.random() * pool.length)] || null;
    const wares = [
      known && { kind: "topic", topic: known, reward: this.rollReward(), title: displayTopic(known).title },
      category && { kind: "category", category, reward: this.rollReward(), title: `A topic from ${category.title}` },
      { kind: "mystery", reward: { hidden: true }, title: "A mystery topic" },
    ].filter(Boolean);

    const coins = this.wallet.coins();
    const price = coins >= MERCHANT_PRICE
      ? `Each costs ${MERCHANT_PRICE} trail coin. You have ${coins}.`
      : "You're out of trail coins. \u201cPay me next time, friend.\u201d";
    this.options = wares.map((w) => () => this.buy(w));
    fill(this.el.stage, 
      this.flavor(),
      h("p", { class: "quest-muted" }, price),
      h("div", { class: "quest-choices" }, ...wares.map((w, i) =>
        choice(i + 1, w.title, w.reward.hidden ? "Reward: ???" : `Reward: ${describeTool(w.reward)}`,
          w.reward.hidden ? this.iconUrl("icon_interrogation") : this.iconUrl(`tool_${w.reward.type}`), () => this.buy(w)))),
      this.footer([this.passButton()]),
    );
  }

  async buy(ware) {
    const paid = this.wallet.spend(MERCHANT_PRICE);
    this.pendingReward = ware.reward;
    if (ware.kind === "topic") {
      this.setTopic(ware.topic);
    } else {
      this.loading();
      const [topic] = await this.draw({ categoryId: ware.category?.id ?? null, count: 1, exclude: this.exclude() });
      if (ware.kind === "category") this.category = ware.category;
      this.setTopic(topic || { id: null, title: ware.category?.title || "Open share", subtitle: "" });
    }
    this.log("draw", this.fields({ approach: "safe", data: { cost: paid ? MERCHANT_PRICE : 0, credit: !paid, ware: ware.kind } }));
    this.showLenses();
  }

  // Ghost: a risky, voluntary question. Taking it earns a spirit lantern; declining is fine.
  showGhost() {
    this.options = [() => this.showLenses(), () => this.pass()];
    fill(this.el.stage,
      this.flavor(),
      this.topicHeading(),
      this.reward(),
      h("p", { class: "quest-muted" }, "The spirit lantern lets someone else share on a later topic."),
      this.footer([
        h("button", { class: "quest-btn", type: "button", onclick: () => this.showLenses() }, "Take the ghost's question"),
        h("button", { class: "quest-btn quest-btn-pass", type: "button", onclick: () => this.pass() }, "Not today"),
      ]),
    );
  }

  showLenses() {
    const lenses = pickLenses(this.modes, {
      used: this.topic ? this.usedModes(this.topic.id) : [],
      gentleOnly: !!this.encounter.gentleOnly,
      favor: this.encounter.favor || [],
    });
    this.options = lenses.map((m) => () => this.chooseLens(m));
    const checkIn = this.stop.kind === "campfire"
      ? h("button", { class: "quest-link", type: "button", onclick: () => this.justCheckIn() }, "Skip the topic, just check in")
      : null;

    fill(this.el.stage, 
      this.stop.kind === "campfire" ? this.flavor() : null,
      this.topicHeading(),
      h("p", { class: "quest-path-title" }, "Choose your path"),
      h("div", { class: "quest-choices" }, ...lenses.map((m, i) =>
        choice(i + 1, m.name, m.prompt, this.iconUrl(this.category?.icon || m.icon_name), () => this.chooseLens(m)))),
      this.reward(),
      h("div", { class: "quest-inline-actions" },
        h("button", { class: "quest-link", type: "button", onclick: () => this.showLenses() }, "Other paths"),
        this.stop.kind === "merchant" ? null :
          h("button", { class: "quest-link", type: "button", onclick: () => this.redraw() }, "Different topic"),
        checkIn,
      ),
      this.footer([this.passButton()]),
    );
  }

  chooseLens(mode) {
    this.lens = mode;
    this.showShare();
  }

  justCheckIn() {
    this.topic = null;
    this.lens = this.modes.find((m) => m.key === "check_in") || this.modes.find((m) => m.gentle);
    this.showShare();
  }

  async redraw() {
    this.loading();
    this.setTopic(await this.drawOne(true));
    this.log("draw", this.fields({ approach: this.encounter.approach, data: { redraw: true } }));
    this.showLenses();
  }

  // nextTurn: someone new has said they'll share, so this turn counts even without the timer
  showShare(nextTurn = false) {
    this.options = [];
    this.timeLeft = SHARE_SECONDS;
    this.turnLogged = false;
    this.turnClaimed = nextTurn;
    this.timerBar = h("div", { class: "quest-timer-fill" });
    this.timerText = h("span", { class: "quest-timer" });
    this.timerButton = h("button", { class: "quest-btn quest-btn-secondary", type: "button", onclick: () => this.toggleTimer() }, "Begin share");
    this.chimeButton = h("button", { class: "quest-link", type: "button", onclick: () => this.toggleChime(), title: "Soft chime at 3 minutes" });

    fill(this.el.stage, 
      this.topicHeading(),
      h("div", { class: "quest-lens-prompt" },
        this.lens?.icon_name ? h("img", { src: this.iconUrl(this.lens.icon_name), alt: "" }) : null,
        h("div", {},
          h("p", { class: "quest-lens-name" }, this.lens?.name || ""),
          h("p", { class: "quest-lens-text" }, this.lens?.prompt || "")),
      ),
      this.reward(),
      h("div", { class: "quest-timer-row" }, this.timerText, this.timerButton, this.chimeButton),
      h("div", { class: "quest-timer-track" }, this.timerBar),
      h("div", { class: "quest-inline-actions" },
        h("button", { class: "quest-link", type: "button", onclick: () => this.changeLens() }, "Choose a different path")),
      this.footer([
        this.lantern?.left() > 0
          ? h("button", { class: "quest-btn quest-btn-secondary", type: "button", title: "Uses one spirit lantern charge", onclick: () => this.nextSharer() },
              `Someone else shares \u00b7 lantern \u00d7${this.lantern.left() === Infinity ? "\u221e" : this.lantern.left()}`)
          : null,
        h("button", { class: "quest-btn", type: "button", onclick: () => this.finish() }, "Continue the journey"),
        this.passButton(),
      ]),
    );
    this.renderTimer();
  }

  changeLens() {
    this.stopTimer();
    this.showLenses();
  }

  footer(buttons) {
    return h("div", { class: "quest-card-foot" }, ...buttons);
  }

  passButton() {
    return h("button", { class: "quest-btn quest-btn-pass", type: "button", title: "Some paths aren't ours to walk today.", onclick: () => this.pass() },
      "Pass");
  }

  // ---------- outcomes ----------

  logShare() {
    if (this.turnLogged) return;
    this.turnLogged = true;
    this.shares++;
    this.log("share", this.fields({ sharing_mode_key: this.lens?.key }));
  }

  nextSharer() {
    if (!(this.lantern?.left() > 0)) return;
    this.lantern.use();
    this.logShare();
    this.stopTimer();
    this.showShare(true);
  }

  finish() {
    // count the current turn if someone claimed it, or if nobody used the timer at all
    if (this.turnClaimed || this.shares === 0) this.logShare();
    this.stopTimer();
    this.onResolve({ stop: this.stop, topic: this.topic, passed: false, reward: this.pendingReward });
  }

  pass() {
    this.stopTimer();
    if (this.shares === 0) {
      this.log("pass", this.fields({}));
      this.onResolve({ stop: this.stop, topic: this.topic, passed: true, message: "Some paths aren't ours to walk today." });
    } else {
      this.onResolve({ stop: this.stop, topic: this.topic, passed: false, reward: this.pendingReward });
    }
  }

  // ---------- timer: quiet, never a buzzer ----------

  toggleTimer() {
    if (this.timerInterval) return this.pauseTimer();
    this.logShare();
    if (this.timeLeft <= 0) this.timeLeft = SHARE_SECONDS;
    this.timerInterval = setInterval(() => {
      this.timeLeft -= 1;
      if (this.timeLeft === 0 && this.chime) chime();
      if (this.timeLeft <= 0) this.pauseTimer();
      this.renderTimer();
    }, 1000);
    this.renderTimer();
  }

  pauseTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.renderTimer();
  }

  stopTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }

  renderTimer() {
    if (!this.timerText) return;
    const t = Math.max(0, this.timeLeft);
    const done = t === 0;
    this.timerText.textContent = done ? "The journey continues…" : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
    this.timerText.classList.toggle("quest-timer-done", done);
    this.timerBar.style.width = `${(100 * (SHARE_SECONDS - t)) / SHARE_SECONDS}%`;
    this.timerButton.textContent = this.timerInterval ? "Pause" : this.turnLogged ? (done ? "More time" : "Resume") : "Begin share";
    this.chimeButton.textContent = this.chime ? "♪ chime on" : "♪ chime off";
  }

  toggleChime() {
    this.chime = !this.chime;
    try { localStorage.setItem("questChime", this.chime ? "on" : "off"); } catch {}
    this.renderTimer();
  }

  // ---------- keyboard: one controller, many people ----------

  handleKey(e) {
    const n = Number(e.key);
    if (n >= 1 && n <= (this.options?.length || 0)) { this.options[n - 1](); return true; }
    if (e.key === "p" || e.key === "P") { this.pass(); return true; }
    if (e.key === " " && this.timerButton?.isConnected) { this.toggleTimer(); return true; }
    if (e.key === "Enter" && this.timerButton?.isConnected) { this.finish(); return true; }
    return false;
  }

  // ---------- helpers ----------

  fields(extra) {
    return { encounter: this.stop.kind, topic_id: this.topic?.id ?? null, ...extra };
  }

  exclude() {
    return this.excludeIds();
  }

  async drawOne(different = false) {
    const exclude = this.exclude();
    if (different && this.topic?.id) exclude.push(this.topic.id);
    // the first draw at a mystery or campfire can come from anywhere; after that ("Different
    // topic") the group stays in the category of the topic they were shown
    const anywhere = !different && (this.stop.kind === "mystery" || this.stop.kind === "campfire" || this.stop.kind === "ghost");
    const categoryId = anywhere ? null : this.category?.id ?? null;
    const [topic] = await this.draw({ categoryId, count: 1, exclude });
    return topic || { id: null, title: this.category?.title || "Open share", subtitle: "Share whatever is on your heart today." };
  }
}

// Many library topics were split mid-phrase on import ("Letting Go (of" / "People, Places and
// Things)"). Rejoin them when the title clearly runs on; keep real subtitles ("Step Four" /
// "Made a searching...") separate.
export function displayTopic(topic) {
  const title = topic?.title?.trim() || "";
  const subtitle = topic?.subtitle?.trim() || "";
  if (!subtitle) return { title, subtitle: "" };
  const runsOn = /[(,\-&]$|\b(of|the|and|a|an|to|for|in|on|with|or|my|your|our|is|are)$/i.test(title) || /^[a-z)(]/.test(subtitle);
  return runsOn ? { title: `${title} ${subtitle}`, subtitle: "" } : { title, subtitle };
}

// Replace a container's contents, skipping optional (null) parts
function fill(el, ...children) {
  el.replaceChildren(...children.filter((c) => c != null && c !== false));
}

// Tiny DOM builder: h("p", { class: "x", onclick }, "text", child...)
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null && c !== false));
  return node;
}

function choice(n, title, detail, icon, onclick) {
  return h("button", { class: "quest-choice", type: "button", onclick },
    h("span", { class: "quest-choice-key" }, String(n)),
    icon ? h("img", { src: icon, alt: "" }) : null,
    h("span", { class: "quest-choice-text" },
      h("strong", {}, title),
      detail ? h("span", {}, detail) : null),
  );
}

function readChime() {
  try { return localStorage.getItem("questChime") === "on"; } catch { return false; }
}

// A soft two-note chime, generated so there's no jarring buzzer sound file
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + i * 0.35 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.35 + 1.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 1.3);
    });
  } catch {}
}
