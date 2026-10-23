// Live editing for a group document (GroupDocument::Live, DocumentChannel): a Yjs copy of the
// document that everyone with it open types into, and who's here with their cursors (awareness).
//
// The server numbers each edit (seq) and passes it on. This keeps the copy in step: it applies
// edits in order, fetches any it missed (a dropped connection, or one too big to come inline),
// resends its own until they come back, and now and then writes the merged copy down (with its
// HTML, which is what everyone else reads) so the server can forget the edits it covers.
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import { createConsumer } from "@rails/actioncable";
import { api } from "../components/groups/lib";

const toBase64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

// One color per person, the same on every screen
export const LIVE_COLORS = ["#2563eb", "#db2777", "#16a34a", "#ea580c", "#7c3aed", "#0d9488", "#dc2626", "#ca8a04", "#4f46e5", "#0891b2"];
export const liveColor = (key) => LIVE_COLORS[[...String(key ?? "")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % LIVE_COLORS.length];

let consumer = null;
const cable = () => (consumer ||= createConsumer());

const REMOTE = "remote";
const FOLD_AFTER_MS = 1500;

export default class LiveDocument {
  // onStatus(status): "connecting" | "live" | "offline"; onPending(n): edits not yet confirmed;
  // onReset(): the text was replaced another way (a restore), so start over; onSaved(info): a
  // copy was written down; onStarted(): the first copy now exists (for a reader who was waiting)
  constructor({ slug, id, canEdit, onStatus, onPending, onReset, onSaved, onStarted }) {
    Object.assign(this, { slug, id, canEdit, onStatus, onPending, onReset, onSaved, onStarted });
    this.doc = new Y.Doc();
    this.awareness = new Awareness(this.doc);
    this.title = this.doc.getText("title");
    this.epoch = 0;
    this.seq = 0; // the last numbered edit applied
    this.pending = new Map(); // mid -> base64, our edits the server hasn't passed back yet
    this.buffer = []; // messages that came before the copy loaded
    this.loaded = false;
    this.started = false; // a shared copy exists
    this.dirty = false; // we've edited since the copy was last written down
    this.mids = 0;
    this.getHtml = null; // set once the editor shows the copy (never write down a page that isn't there yet)
    this.destroyed = false;

    this.doc.on("update", (update, origin) => {
      if (origin === REMOTE || !this.canEdit || !this.started) return;
      const mid = `${this.doc.clientID}-${(this.mids += 1)}`;
      const b64 = toBase64(update);
      this.pending.set(mid, b64);
      this.onPending?.(this.pending.size);
      this.dirty = true;
      this.send("update", { update: b64, mid });
      this.scheduleFold();
    });
    this.awareness.on("update", ({ added, updated, removed }, origin) => {
      if (origin === REMOTE) return;
      const changed = [...added, ...updated, ...removed];
      if (changed.length) this.send("awareness", { update: toBase64(encodeAwarenessUpdate(this.awareness, changed)) });
    });
    this.onUnload = () => removeAwarenessStates(this.awareness, [this.doc.clientID], "unload");
    window.addEventListener("pagehide", this.onUnload);
  }

  // Subscribes first and loads after, so nothing that happens in between is missed
  connect() {
    this.onStatus?.("connecting");
    this.channel = cable().subscriptions.create(
      { channel: "DocumentChannel", group: this.slug, id: this.id, client: this.doc.clientID },
      {
        connected: () => this.connected(),
        disconnected: () => this.onStatus?.("offline"),
        rejected: () => this.onStatus?.("offline"),
        received: (m) => (this.loaded ? this.receive(m) : this.buffer.push(m)),
      },
    );
    return this;
  }

  async connected() {
    if (this.destroyed) return;
    try {
      if (!this.loaded) await this.load();
      else await this.catchUp();
    } catch {
      this.onStatus?.("offline");
      return;
    }
    // ours that didn't make it while we were away (sending one twice does no harm)
    if (this.started) for (const [mid, update] of this.pending) this.send("update", { update, mid });
    this.send("awareness", { update: toBase64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID])), hello: true });
    this.onStatus?.("live");
  }

  async load() {
    const snap = await api(`/groups/${this.slug}/documents/${this.id}/live`);
    this.me = snap.me;
    this.unversioned = snap.unversioned;
    this.apply(snap);
    this.loaded = true;
    // edits nobody wrote down yet (someone left mid-sentence): an editor folds them in
    if (this.canEdit && snap.updates?.length) { this.dirty = true; this.scheduleFold(); }
    const early = this.buffer;
    this.buffer = [];
    early.forEach((m) => this.receive(m));
  }

  // Puts a snapshot in (the copy and/or the edits after it)
  apply(snap) {
    this.epoch = snap.epoch;
    if (snap.state) {
      Y.applyUpdate(this.doc, fromBase64(snap.state), REMOTE);
      this.seq = Math.max(this.seq, snap.state_seq);
    }
    if (snap.state) this.started = true;
    (snap.updates || []).forEach((u) => {
      if (u.seq <= this.seq) return;
      Y.applyUpdate(this.doc, fromBase64(u.update), REMOTE);
      this.seq = u.seq;
    });
  }

  // The document had no shared copy yet: offer the one made from its HTML. If someone else's
  // got there first, theirs is used and ours is dropped (the caller builds ours in a scratch
  // Y.Doc, so dropping it is just not using it).
  async start(scratch, html) {
    const result = await api(`/groups/${this.slug}/documents/${this.id}/live`, {
      method: "POST", body: { start: toBase64(Y.encodeStateAsUpdate(scratch)), epoch: this.epoch, html },
    });
    this.apply(result);
    this.started = !!result.state;
    return result.started;
  }

  // Fetches every edit after the last one applied. Runs one at a time.
  catchUp() {
    this.catching = (this.catching || Promise.resolve()).then(async () => {
      if (this.destroyed) return;
      const snap = await api(`/groups/${this.slug}/documents/${this.id}/live?after=${this.seq}`);
      if (snap.epoch !== this.epoch) { this.reset(); return; }
      this.apply(snap);
    }).catch(() => {});
    return this.catching;
  }

  receive(m) {
    if (this.destroyed) return;
    if (m.type === "update") {
      if (m.from === this.doc.clientID && this.pending.delete(m.mid)) this.onPending?.(this.pending.size);
      if (m.seq <= this.seq) return;
      if (m.seq === this.seq + 1 && m.update) {
        Y.applyUpdate(this.doc, fromBase64(m.update), REMOTE);
        this.seq = m.seq;
      } else this.catchUp();
    } else if (m.type === "awareness") {
      if (m.from === this.doc.clientID) return;
      applyAwarenessUpdate(this.awareness, fromBase64(m.update), REMOTE);
      // someone just arrived: tell them we're here too
      if (m.hello) this.send("awareness", { update: toBase64(encodeAwarenessUpdate(this.awareness, [this.doc.clientID])) });
    } else if (m.type === "left") {
      if (m.from !== this.doc.clientID) removeAwarenessStates(this.awareness, [m.from], REMOTE);
    } else if (m.type === "stale") {
      this.reset();
    } else if (m.type === "reset") {
      if (m.epoch !== this.epoch) this.reset();
    } else if (m.type === "started") {
      if (!this.started) this.onStarted?.();
    } else if (m.type === "saved") {
      this.unversioned = m.unversioned;
      this.onSaved?.(m);
    }
  }

  reset() {
    if (this.destroyed || this.resetting) return;
    this.resetting = true;
    this.onReset?.();
  }

  send(action, data) {
    if (this.channel && !this.destroyed) this.channel.perform(action, { ...data, epoch: this.epoch });
  }

  scheduleFold() {
    clearTimeout(this.foldTimer);
    this.foldTimer = setTimeout(() => this.fold(), FOLD_AFTER_MS);
  }

  // The merged copy, with its HTML and title. It says it covers the edits up to the last one
  // applied; it also holds ours that aren't numbered yet, which come in again later (harmless).
  foldBody() {
    return { state: toBase64(Y.encodeStateAsUpdate(this.doc)), upto: this.seq, epoch: this.epoch, title: this.title.toString(), body: this.getHtml() };
  }

  // Writes the merged copy down
  async fold() {
    clearTimeout(this.foldTimer);
    if (!this.dirty || !this.started || this.destroyed || !this.getHtml) return;
    if (this.folding) { this.scheduleFold(); return; }
    this.folding = true;
    this.dirty = false;
    try {
      await api(`/groups/${this.slug}/documents/${this.id}/live`, { method: "POST", body: this.foldBody() });
    } catch {
      this.dirty = true;
      this.scheduleFold();
    } finally {
      this.folding = false;
    }
  }

  // Writes down what's on the page now (before a Save version)
  async flush() {
    for (let i = 0; i < 50 && this.folding; i += 1) await new Promise((r) => setTimeout(r, 100));
    this.dirty = true;
    await this.fold();
  }

  // Replaces the title's text with `value`, changing only the part that differs
  setTitle(value) {
    const old = this.title.toString();
    if (old === value) return;
    let start = 0;
    while (start < old.length && start < value.length && old[start] === value[start]) start += 1;
    let end = 0;
    while (end < old.length - start && end < value.length - start && old[old.length - 1 - end] === value[value.length - 1 - end]) end += 1;
    this.doc.transact(() => {
      this.title.delete(start, old.length - start - end);
      this.title.insert(start, value.slice(start, value.length - end));
    });
  }

  destroy() {
    if (this.destroyed) return;
    // leaving straight after typing: write it down on the way out
    if (this.dirty && this.started && this.getHtml) {
      fetch(`/api/groups/${this.slug}/documents/${this.id}/live`, {
        method: "POST", keepalive: true, credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "" },
        body: JSON.stringify(this.foldBody()),
      }).catch(() => {});
    }
    removeAwarenessStates(this.awareness, [this.doc.clientID], "unload");
    this.destroyed = true;
    clearTimeout(this.foldTimer);
    window.removeEventListener("pagehide", this.onUnload);
    this.channel?.unsubscribe();
    this.awareness.destroy();
    this.doc.destroy();
  }
}
