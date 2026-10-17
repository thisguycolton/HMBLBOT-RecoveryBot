// Client side of the journey log: queues structured entries and sends them in batches.
// Entries never contain free text or anything about who shared - only what happened.
export default class JourneyLog {
  constructor(api) {
    this.api = api;
    this.queue = [];
  }

  add(kind, fields = {}) {
    this.queue.push({ kind, ...fields });
  }

  async flush(sessionId) {
    if (!this.queue.length || !sessionId) return;
    const entries = this.queue.splice(0);
    try {
      await this.api(`/api/v1/quest_sessions/${sessionId}/log_entries`, { method: "POST", body: { entries } });
    } catch (e) {
      this.queue.unshift(...entries); // try again with the next save
      throw e;
    }
  }
}
