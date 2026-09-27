import { h } from "./topic_flow";

// "The road forks - ask the room." Lists the nearest places the group can head next, so the
// controller can read the choices aloud and pick with 1-4 (or tap the map).
//
// options: [{ x, y, name, hint, icon, color, blockedBy }]
export default class ForkPanel {
  constructor(el, { iconUrl, hex, onPick }) {
    this.el = el;
    this.iconUrl = iconUrl;
    this.hex = hex;
    this.onPick = onPick;
    this.options = [];
  }

  show(options) {
    this.options = options;
    if (!options.length) return this.hide();
    this.el.replaceChildren(
      h("p", { class: "quest-fork-title" }, options.length > 1 ? "The road forks. Ask the room:" : "The road continues:"),
      ...options.map((o, i) =>
        h("button", { class: "quest-fork-row", type: "button", onclick: () => this.onPick(o) },
          h("span", { class: "quest-choice-key" }, String(i + 1)),
          h("span", { class: "quest-fork-badge", style: `background:${o.color ? this.hex(o.color) : "#4a5bb8"}` },
            o.icon ? h("img", { src: this.iconUrl(o.icon), alt: "" }) : null),
          h("span", { class: "quest-fork-text" },
            h("strong", {}, o.name),
            h("span", {}, o.hint + (o.blockedBy ? ` · needs ${o.blockedBy}` : ""))),
        )),
    );
    this.el.hidden = false;
  }

  hide() {
    this.el.hidden = true;
  }

  handleKey(e) {
    if (this.el.hidden) return false;
    const n = Number(e.key);
    if (n >= 1 && n <= this.options.length) {
      this.onPick(this.options[n - 1]);
      return true;
    }
    return false;
  }
}
